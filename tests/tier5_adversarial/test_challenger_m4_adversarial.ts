import fs from 'fs';
import path from 'path';
import http from 'http';
import {
  describe,
  test,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertRange,
  assertContains,
  assertMatch,
  assertDefined,
  assertThrows,
  runAllRegisteredSuites
} from '../harness';

import { resolveServerPort, app } from '../../backend/src/server';

// ============================================================================
// HELPER: IN-MEMORY HTTP REQUEST DISPATCHER (NO EXTERNAL NETWORK REQUIRED)
// ============================================================================
interface HttpResponseSimulation {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json: any;
  durationMs: number;
}

function simulateExpressRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  requestBody?: any
): Promise<HttpResponseSimulation> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const serverInstance = http.createServer(app);

    serverInstance.listen(0, '127.0.0.1', () => {
      const addr = serverInstance.address() as { port: number };
      const port = addr.port;

      const postData = requestBody
        ? (typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody))
        : undefined;

      const reqHeaders: Record<string, string> = {
        ...headers
      };

      if (postData && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: urlPath,
          method,
          headers: reqHeaders,
          timeout: 2000
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            const durationMs = Date.now() - startTime;
            serverInstance.close();
            let parsedJson: any = null;
            try {
              parsedJson = JSON.parse(responseData);
            } catch {
              parsedJson = null;
            }
            resolve({
              statusCode: res.statusCode || 500,
              headers: res.headers,
              body: responseData,
              json: parsedJson,
              durationMs
            });
          });
        }
      );

      req.on('error', (err) => {
        const durationMs = Date.now() - startTime;
        serverInstance.close();
        resolve({
          statusCode: 500,
          headers: {},
          body: err.message,
          json: { error: err.message },
          durationMs
        });
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  });
}

// ============================================================================
// DOCKERFILE PARSER & ADVERSARIAL AUDITOR
// ============================================================================
interface DockerfileAST {
  stages: { name: string; baseImage: string }[];
  workdirs: string[];
  runCommands: string[];
  copyInstructions: { from?: string; chown?: string; src: string; dest: string }[];
  envVars: Record<string, string>;
  user: string;
  exposedPort: number;
  healthcheck?: { command: string; interval?: string; timeout?: string; retries?: string };
  cmd: string[];
  isCmdJsonArray: boolean;
}

function parseDockerfileAST(content: string): DockerfileAST {
  const lines = content.split('\n');
  const stages: { name: string; baseImage: string }[] = [];
  const workdirs: string[] = [];
  const runCommands: string[] = [];
  const copyInstructions: { from?: string; chown?: string; src: string; dest: string }[] = [];
  const envVars: Record<string, string> = {};
  let user = 'root';
  let exposedPort = 0;
  let healthcheck: DockerfileAST['healthcheck'];
  let cmd: string[] = [];
  let isCmdJsonArray = false;

  let currentLine = '';
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#')) continue;

    if (raw.endsWith('\\')) {
      currentLine += raw.slice(0, -1).trim() + ' ';
      continue;
    } else {
      currentLine += raw;
    }

    const trimmed = currentLine.trim();
    currentLine = '';

    if (trimmed.startsWith('FROM ')) {
      const match = trimmed.match(/^FROM\s+([^\s]+)(?:\s+[aA][sS]\s+([^\s]+))?/);
      if (match) {
        stages.push({ baseImage: match[1], name: match[2] || `stage_${stages.length}` });
      }
    } else if (trimmed.startsWith('WORKDIR ')) {
      workdirs.push(trimmed.substring(8).trim());
    } else if (trimmed.startsWith('RUN ')) {
      runCommands.push(trimmed.substring(4).trim());
    } else if (trimmed.startsWith('COPY ')) {
      const tokens = trimmed.substring(5).trim().split(/\s+/);
      let fromStage: string | undefined;
      let chown: string | undefined;
      const srcDestTokens: string[] = [];

      for (const token of tokens) {
        if (token.startsWith('--from=')) {
          fromStage = token.substring(7);
        } else if (token.startsWith('--chown=')) {
          chown = token.substring(8);
        } else {
          srcDestTokens.push(token);
        }
      }

      if (srcDestTokens.length >= 2) {
        copyInstructions.push({
          from: fromStage,
          chown,
          src: srcDestTokens[0],
          dest: srcDestTokens[srcDestTokens.length - 1]
        });
      }
    } else if (trimmed.startsWith('ENV ')) {
      const envRest = trimmed.substring(4).trim();
      const parts = envRest.split(/\s+/);
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k && v !== undefined) envVars[k] = v;
      }
    } else if (trimmed.startsWith('USER ')) {
      user = trimmed.substring(5).trim();
    } else if (trimmed.startsWith('EXPOSE ')) {
      exposedPort = parseInt(trimmed.substring(7).trim(), 10);
    } else if (trimmed.startsWith('HEALTHCHECK ')) {
      const hcTokens = trimmed.substring(12).trim();
      let interval: string | undefined;
      let timeout: string | undefined;
      let retries: string | undefined;

      const intMatch = hcTokens.match(/--interval=([^\s]+)/);
      if (intMatch) interval = intMatch[1];
      const toMatch = hcTokens.match(/--timeout=([^\s]+)/);
      if (toMatch) timeout = toMatch[1];
      const retMatch = hcTokens.match(/--retries=([^\s]+)/);
      if (retMatch) retries = retMatch[1];

      const cmdMatch = hcTokens.match(/CMD\s+(.+)$/);
      healthcheck = {
        command: cmdMatch ? cmdMatch[1].trim() : '',
        interval,
        timeout,
        retries
      };
    } else if (trimmed.startsWith('CMD ')) {
      const cmdRaw = trimmed.substring(4).trim();
      if (cmdRaw.startsWith('[') && cmdRaw.endsWith(']')) {
        isCmdJsonArray = true;
        try {
          cmd = JSON.parse(cmdRaw);
        } catch {
          cmd = [cmdRaw];
        }
      } else {
        isCmdJsonArray = false;
        cmd = cmdRaw.split(/\s+/);
      }
    }
  }

  return {
    stages,
    workdirs,
    runCommands,
    copyInstructions,
    envVars,
    user,
    exposedPort,
    healthcheck,
    cmd,
    isCmdJsonArray
  };
}

describe('Tier 5 Challenger M4: Cloud Run Packaging & Deployment Adversarial Stress Suite', () => {

  const rootDir = path.resolve(__dirname, '../../');
  const dockerfilePath = path.join(rootDir, 'Dockerfile');
  const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
  const cloudBuildPath = path.join(rootDir, 'cloudbuild.yaml');
  const dockerIgnorePath = path.join(rootDir, '.dockerignore');
  const deployShPath = path.join(rootDir, 'deploy_cloud_run.sh');
  const deployPs1Path = path.join(rootDir, 'deploy_cloud_run.ps1');

  // ==========================================================================
  // SECTION 1: DOCKERFILE AST & MULTI-STAGE CONFIGURATION RIGOR
  // ==========================================================================

  test('ADV-M4-1.1: Production Dockerfile exists, parses valid AST, and implements 3 distinct stages', () => {
    assertTrue(fs.existsSync(dockerfilePath), 'Dockerfile must exist at workspace root');
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const ast = parseDockerfileAST(content);

    assertEqual(ast.stages.length, 3, 'Dockerfile must have exactly 3 build stages');
    assertEqual(ast.stages[0].name, 'frontend-builder');
    assertEqual(ast.stages[1].name, 'backend-builder');
    assertEqual(ast.stages[2].name, 'runtime');

    // Base image consistency across all stages
    for (const stage of ast.stages) {
      assertMatch(stage.baseImage, /^node:22-alpine/, `Stage "${stage.name}" must standardize on Node 22 Alpine LTS`);
    }
  });

  test('ADV-M4-1.2: Production Dockerfile executes non-root execution, exposes Port 8080, and configures JSON array CMD', () => {
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const ast = parseDockerfileAST(content);

    // Non-root security
    assertEqual(ast.user, 'node', 'Runtime stage must execute as non-root user "node" (UID 1000)');

    // Cloud Run standard port
    assertEqual(ast.exposedPort, 8080, 'Must expose standard Cloud Run port 8080');
    assertEqual(ast.envVars['PORT'], '8080', 'Default ENV PORT must be 8080');
    assertEqual(ast.envVars['NODE_ENV'], 'production', 'Default ENV NODE_ENV must be production');
    assertEqual(ast.envVars['APP_MODE'], 'DEMO', 'Default ENV APP_MODE must be DEMO');

    // Direct exec signal handling (JSON array CMD format)
    assertTrue(ast.isCmdJsonArray, 'CMD instruction MUST be formatted as a JSON array to handle SIGTERM/SIGINT correctly');
    assertEqual(ast.cmd[0], 'node');
    assertEqual(ast.cmd[1], 'dist/backend/src/server.js');
  });

  test('ADV-M4-1.3: Production Dockerfile defines Alpine-compatible wget healthcheck probe and file ownership', () => {
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const ast = parseDockerfileAST(content);

    assertDefined(ast.healthcheck, 'HEALTHCHECK directive must be defined');
    assertTrue(
      ast.healthcheck.command.includes('wget -qO- http://localhost:8080/healthz'),
      'HEALTHCHECK must use Alpine-native "wget" (curl is not installed by default in Alpine)'
    );
    assertEqual(ast.healthcheck.interval, '30s');
    assertEqual(ast.healthcheck.timeout, '5s');
    assertEqual(ast.healthcheck.retries, '3');

    // Verify COPY instructions in runtime stage use --chown=node:node
    const chownCopies = ast.copyInstructions.filter(c => c.chown === 'node:node');
    assertTrue(chownCopies.length >= 2, 'Runtime COPY instructions must enforce --chown=node:node for non-root access');
  });

  // ==========================================================================
  // SECTION 2: DOCKER COMPOSE & CLOUD BUILD YAML ADVERSARIAL VALIDATION
  // ==========================================================================

  test('ADV-M4-2.1: docker-compose.yml defines local port mapping 8080:8080, healthcheck, and demo defaults', () => {
    assertTrue(fs.existsSync(dockerComposePath), 'docker-compose.yml must exist at workspace root');
    const composeContent = fs.readFileSync(dockerComposePath, 'utf-8');

    assertContains(composeContent, 'version:', 'Must specify Compose file version');
    assertContains(composeContent, 'sme-autopilot:');
    assertContains(composeContent, '"8080:8080"');
    assertContains(composeContent, 'PORT=8080');
    assertContains(composeContent, 'NODE_ENV=production');
    assertContains(composeContent, 'APP_MODE=DEMO');
    assertContains(composeContent, 'USE_MOCK_GOOGLE=true');
    assertContains(composeContent, 'wget');
    assertContains(composeContent, 'http://localhost:8080/healthz');
    assertContains(composeContent, 'restart: unless-stopped');
  });

  test('ADV-M4-2.2: cloudbuild.yaml enforces GCP Cloud Run resource parameters (512Mi, 1 CPU, 80 concurrency, asia-southeast1)', () => {
    assertTrue(fs.existsSync(cloudBuildPath), 'cloudbuild.yaml must exist at workspace root');
    const buildContent = fs.readFileSync(cloudBuildPath, 'utf-8');

    // Steps verification
    assertContains(buildContent, "id: 'build-image'");
    assertContains(buildContent, "id: 'push-image'");
    assertContains(buildContent, "id: 'deploy-cloud-run'");

    // Cloud Run deployment flags
    assertContains(buildContent, "'--region'");
    assertContains(buildContent, "'${_REGION}'");
    assertContains(buildContent, "'--platform'");
    assertContains(buildContent, "'managed'");
    assertContains(buildContent, "'--allow-unauthenticated'");
    assertContains(buildContent, "'--port'");
    assertContains(buildContent, "'8080'");
    assertContains(buildContent, "'--memory'");
    assertContains(buildContent, "'512Mi'");
    assertContains(buildContent, "'--cpu'");
    assertContains(buildContent, "'1'");
    assertContains(buildContent, "'--concurrency'");
    assertContains(buildContent, "'80'");

    // Substitutions
    assertContains(buildContent, "_REGION: 'asia-southeast1'");
    assertContains(buildContent, "_SERVICE_NAME: 'sme-autopilot-service'");
    assertContains(buildContent, 'logging: CLOUD_LOGGING_ONLY');
  });

  // ==========================================================================
  // SECTION 3: PORT RESOLUTION ADVERSARIAL BOUNDARY MATRIX
  // ==========================================================================

  test('ADV-M4-3.1: resolveServerPort handles undefined, null, empty strings, and whitespace with standard 8080 fallback', () => {
    assertEqual(resolveServerPort(undefined), 8080);
    assertEqual(resolveServerPort(null as any), 8080);
    assertEqual(resolveServerPort(''), 8080);
    assertEqual(resolveServerPort('   '), 8080);
    assertEqual(resolveServerPort('\t\n'), 8080);
  });

  test('ADV-M4-3.2: resolveServerPort handles out-of-bounds, negative, floating point, and NaN port strings', () => {
    assertEqual(resolveServerPort('-1'), 8080);
    assertEqual(resolveServerPort('-8080'), 8080);
    assertEqual(resolveServerPort('0'), 8080);
    assertEqual(resolveServerPort('65536'), 8080);
    assertEqual(resolveServerPort('999999'), 8080);
    assertEqual(resolveServerPort('invalid_text'), 8080);
    assertEqual(resolveServerPort('NaN'), 8080);
    assertEqual(resolveServerPort('undefined'), 8080);
    assertEqual(resolveServerPort(NaN as any), 8080);
    assertEqual(resolveServerPort(Infinity as any), 8080);
  });

  test('ADV-M4-3.3: resolveServerPort correctly parses valid TCP port numbers and padded strings', () => {
    assertEqual(resolveServerPort('80'), 80);
    assertEqual(resolveServerPort('443'), 443);
    assertEqual(resolveServerPort('3000'), 3000);
    assertEqual(resolveServerPort('8080'), 8080);
    assertEqual(resolveServerPort('65535'), 65535);
    assertEqual(resolveServerPort('  8080  '), 8080);
    assertEqual(resolveServerPort(8080), 8080);
    assertEqual(resolveServerPort(3000), 3000);
    assertEqual(resolveServerPort(80), 80);
  });

  // ==========================================================================
  // SECTION 4: HEALTHCHECK ENDPOINTS LATENCY, CONTRACT & ERROR HARNESS
  // ==========================================================================

  test('ADV-M4-4.1: Liveness probe GET /healthz executes sub-50ms and satisfies JSON payload schema', async () => {
    const res = await simulateExpressRequest('GET', '/healthz');

    assertEqual(res.statusCode, 200, '/healthz must return HTTP 200 OK');
    assertTrue(res.durationMs < 50, `Healthz latency must be <50ms, took ${res.durationMs}ms`);
    assertDefined(res.json);
    assertEqual(res.json.status, 'ok');
    assertTrue(typeof res.json.uptime === 'number');
    assertTrue(typeof res.json.timestamp === 'string');
    assertMatch(res.json.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('ADV-M4-4.2: Readiness & diagnostics probe GET /api/health executes sub-50ms with deep service telemetry', async () => {
    const res = await simulateExpressRequest('GET', '/api/health');

    assertEqual(res.statusCode, 200, '/api/health must return HTTP 200 OK');
    assertTrue(res.durationMs < 50, `API Health latency must be <50ms, took ${res.durationMs}ms`);
    assertDefined(res.json);
    assertEqual(res.json.status, 'ok');
    assertEqual(res.json.success, true);
    assertDefined(res.json.mode);
    assertDefined(res.json.services);
    assertDefined(res.json.system);

    // Verify individual service flags
    assertEqual(res.json.services.sheets, true);
    assertEqual(res.json.services.gmail, true);
    assertEqual(res.json.services.calendar, true);
    assertEqual(res.json.services.maps, true);
    assertEqual(res.json.services.firestore, true);

    // Verify system memory telemetry
    assertTrue(res.json.system.memoryUsage.heapUsed > 0);
    assertTrue(res.json.system.uptime >= 0);
  });

  test('ADV-M4-4.3: Healthcheck alias GET /health returns identical 200 OK diagnostics', async () => {
    const res = await simulateExpressRequest('GET', '/health');
    assertEqual(res.statusCode, 200);
    assertEqual(res.json.status, 'ok');
    assertEqual(res.json.success, true);
  });

  test('ADV-M4-4.4: Disallowed HTTP methods on /healthz (POST/PUT/DELETE) return 404 cleanly without crashing server', async () => {
    const postRes = await simulateExpressRequest('POST', '/healthz', {}, { test: true });
    assertEqual(postRes.statusCode, 404);
    assertFalse(postRes.json.success);

    const putRes = await simulateExpressRequest('PUT', '/healthz', {}, {});
    assertEqual(putRes.statusCode, 404);

    const deleteRes = await simulateExpressRequest('DELETE', '/healthz');
    assertEqual(deleteRes.statusCode, 404);
  });

  // ==========================================================================
  // SECTION 5: STATIC SPA SERVING, MIME TYPE GUARDS & TRAVERSAL DEFENSE
  // ==========================================================================

  test('ADV-M4-5.1: Missing static file with extension (e.g. /app.js) returns 404 and does NOT return index.html', async () => {
    const res = await simulateExpressRequest('GET', '/nonexistent_script_file_12345.js');
    assertEqual(res.statusCode, 404);
    assertFalse(res.body.includes('<!DOCTYPE html>'), 'MIME Guard: Must not serve HTML for missing .js asset');
    assertFalse(res.json?.success, 'Missing file with extension must fall through to 404 handler');
  });

  test('ADV-M4-5.2: Missing CSS and image assets fall through to 404 instead of returning HTML', async () => {
    const cssRes = await simulateExpressRequest('GET', '/assets/missing_style.css');
    assertEqual(cssRes.statusCode, 404);
    assertFalse(cssRes.body.includes('<!DOCTYPE html>'));

    const pngRes = await simulateExpressRequest('GET', '/images/missing_logo.png');
    assertEqual(pngRes.statusCode, 404);
    assertFalse(pngRes.body.includes('<!DOCTYPE html>'));
  });

  test('ADV-M4-5.3: Path traversal with file extensions returns 404 without leaking server files', async () => {
    const traversalRes = await simulateExpressRequest('GET', '/../../../etc/shadow.txt');
    assertEqual(traversalRes.statusCode, 404);
    assertFalse(traversalRes.body.includes('<!DOCTYPE html>'));
    assertFalse(traversalRes.json?.success);
  });

  // ==========================================================================
  // SECTION 6: .DOCKERIGNORE HYGIENE & SENSITIVE FILE ISOLATION
  // ==========================================================================

  test('ADV-M4-6.1: .dockerignore covers all node_modules, git, agents, dist, tests, secrets, and logs', () => {
    assertTrue(fs.existsSync(dockerIgnorePath), '.dockerignore must exist');
    const content = fs.readFileSync(dockerIgnorePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    // Critical security & size exclusions
    const expectedRules = [
      'node_modules',
      '.git',
      '.agents',
      '.env',
      'tests/',
      'coverage/',
      '*.log',
      'dist',
      'credentials.json',
      'service-account*.json'
    ];

    for (const rule of expectedRules) {
      const match = lines.some(l => l === rule || l.startsWith(rule) || rule.startsWith(l));
      assertTrue(match, `.dockerignore must exclude rule matching "${rule}"`);
    }
  });

  // ==========================================================================
  // SECTION 7: DEPLOYMENT SCRIPTS (BASH & POWERSHELL) FAIL-SAFE VALIDATION
  // ==========================================================================

  test('ADV-M4-7.1: deploy_cloud_run.sh contains fail-fast set -e, gcloud prerequisite check, and proper flags', () => {
    assertTrue(fs.existsSync(deployShPath), 'deploy_cloud_run.sh must exist');
    const sh = fs.readFileSync(deployShPath, 'utf-8');

    assertContains(sh, 'set -e', 'Bash deploy script must have set -e for fail-fast');
    assertContains(sh, 'command -v gcloud', 'Must verify gcloud is installed');
    assertContains(sh, 'REGION="asia-southeast1"');
    assertContains(sh, '--region "$REGION"');
    assertContains(sh, '--memory 512Mi');
    assertContains(sh, '--cpu 1');
    assertContains(sh, '--port 8080');
    assertContains(sh, '--allow-unauthenticated');
    assertContains(sh, 'APP_MODE=DEMO');
  });

  test('ADV-M4-7.2: deploy_cloud_run.ps1 contains Get-Command gcloud, error handling, and matching flags', () => {
    assertTrue(fs.existsSync(deployPs1Path), 'deploy_cloud_run.ps1 must exist');
    const ps1 = fs.readFileSync(deployPs1Path, 'utf-8');

    assertContains(ps1, 'Get-Command gcloud', 'PowerShell script must verify gcloud cmdlet');
    assertContains(ps1, '$REGION = "asia-southeast1"');
    assertContains(ps1, '--memory 512Mi');
    assertContains(ps1, '--cpu 1');
    assertContains(ps1, '--port 8080');
    assertContains(ps1, '--allow-unauthenticated');
    assertContains(ps1, 'APP_MODE=DEMO');
    assertContains(ps1, '$LASTEXITCODE');
  });
});

if (require.main === module) {
  runAllRegisteredSuites().then(results => {
    let failed = 0;
    for (const r of results) {
      console.log(`Suite: ${r.name} (${r.passed}/${r.total} passed)`);
      failed += r.failed;
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
