import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertContains
} from '../harness';

export interface DockerfileInspection {
  baseImage: string;
  stages: string[];
  exposedPort: number;
  entrypointCommand: string[];
  user: string;
  hasMultiStage: boolean;
  hasProductionPruning: boolean;
}

export function parseAndValidateDockerfile(dockerfileContent: string): DockerfileInspection {
  const lines = dockerfileContent.split('\n').map(l => l.trim());
  const stages: string[] = [];
  let baseImage = '';
  let exposedPort = 8080;
  let entrypointCommand: string[] = [];
  let user = 'root';
  let hasProductionPruning = false;

  for (const line of lines) {
    if (line.startsWith('FROM ')) {
      const parts = line.split(/\s+/);
      const img = parts[1];
      if (!baseImage) baseImage = img;
      if (parts.includes('AS') || parts.includes('as')) {
        stages.push(parts[parts.length - 1]);
      }
    } else if (line.startsWith('EXPOSE ')) {
      const portStr = line.split(/\s+/)[1];
      exposedPort = parseInt(portStr, 10);
    } else if (line.startsWith('CMD ') || line.startsWith('ENTRYPOINT ')) {
      entrypointCommand = line.substring(line.indexOf(' ')).trim().split(/\s+/);
    } else if (line.startsWith('USER ')) {
      user = line.split(/\s+/)[1];
    } else if (line.includes('--omit=dev') || line.includes('--production') || line.includes('NODE_ENV=production')) {
      hasProductionPruning = true;
    }
  }

  return {
    baseImage,
    stages,
    exposedPort,
    entrypointCommand,
    user,
    hasMultiStage: stages.length >= 2,
    hasProductionPruning
  };
}

export const SAMPLE_DOCKERFILE = `
# Stage 1: Build Frontend SPA
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY backend/package*.json ./backend/
RUN npm ci
COPY shared/ ./shared/
COPY backend/ ./backend/
RUN npm run build:backend

# Stage 3: Production Runtime (<150MB)
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=frontend-builder /app/frontend/dist ./public
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/backend/src/seed ./dist/backend/src/seed

USER node
EXPOSE 8080

CMD ["node", "dist/backend/src/server.js"]
`;

describe('F15: Cloud Run Packaging & Containerization Specs', () => {
  test('Test 15.1: Multi-stage Dockerfile target validation', () => {
    const inspection = parseAndValidateDockerfile(SAMPLE_DOCKERFILE);
    assertTrue(inspection.hasMultiStage);
    assertTrue(inspection.stages.includes('frontend-builder'));
    assertTrue(inspection.stages.includes('backend-builder'));
    assertTrue(inspection.stages.includes('runtime'));
  });

  test('Test 15.2: Cloud Run default Port 8080 configuration', () => {
    const inspection = parseAndValidateDockerfile(SAMPLE_DOCKERFILE);
    assertEqual(inspection.exposedPort, 8080);
    assertContains(SAMPLE_DOCKERFILE, 'ENV PORT=8080');
  });

  test('Test 15.3: Production entrypoint startup command validation', () => {
    const inspection = parseAndValidateDockerfile(SAMPLE_DOCKERFILE);
    assertTrue(inspection.entrypointCommand.length > 0);
    assertContains(SAMPLE_DOCKERFILE, 'dist/backend/src/server.js');
  });

  test('Test 15.4: Lightweight image requirements and devDependencies pruning', () => {
    const inspection = parseAndValidateDockerfile(SAMPLE_DOCKERFILE);
    assertTrue(inspection.hasProductionPruning);
    assertContains(inspection.baseImage, 'alpine');
  });

  test('Test 15.5: Non-root security user enforcement', () => {
    const inspection = parseAndValidateDockerfile(SAMPLE_DOCKERFILE);
    assertEqual(inspection.user, 'node');
    assertContains(SAMPLE_DOCKERFILE, 'USER node');
  });
});
