/**
 * SME AutoPilot — Backend Express REST & SSE Server
 * backend/src/server.ts
 *
 * Multimodal AI Operations Platform for Vietnamese Online Merchants
 * (#BuildwithGoogleAI AI Riser Vietnam 2026)
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { apiRouter } from './routes';
import { requestLogger, errorHandler, notFoundHandler } from './middleware';

export const app: Express = express();

// ============================================================================
// 1. GLOBAL MIDDLEWARE
// ============================================================================

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Mode', 'X-Requested-With']
}));

// Body Parsers with 50MB limit for high-resolution VietQR receipts and audio
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logger
app.use(requestLogger);

// Dynamic Mode Resolver Middleware (X-App-Mode header)
app.use((req: Request, res: Response, next: NextFunction) => {
  const modeHeader = req.headers['x-app-mode'] as string | undefined;
  if (modeHeader) {
    req.app.locals.mode = modeHeader.toLowerCase();
  }
  next();
});

// ============================================================================
// 2. API & SSE ROUTES
// ============================================================================

app.use(apiRouter);

// ============================================================================
// 3. STATIC SPA SERVING & HTML5 FALLBACK
// ============================================================================

export function configureStaticServing(expressApp: Express): string | null {
  const candidateFrontendPaths = [
    process.env.STATIC_PATH,
    process.env.FRONTEND_DIST,
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'dist/public'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
    path.resolve(__dirname, '../../public')
  ].filter(Boolean) as string[];

  let frontendDistPath: string | null = null;
  for (const p of candidateFrontendPaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      frontendDistPath = p;
      break;
    }
  }

  if (frontendDistPath) {
    // 1. Serve static assets with long-term immutable caching for hashed chunks
    expressApp.use(express.static(frontendDistPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html')) {
          // index.html must never be cached: it points at hash-versioned bundles
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));

    // 2. HTML5 SPA Fallback for client-side routing
    expressApp.use((req: Request, res: Response, next: NextFunction) => {
      // Exclude API, SSE, and healthcheck paths
      if (req.path.startsWith('/api') || req.path.startsWith('/healthz') || req.path.startsWith('/health')) {
        return next();
      }

      // Only handle GET / HEAD requests for SPA routing
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      // MIME Safety: If request has a file extension (.js, .css, .png, etc.), do NOT return index.html
      // Let it fall through to notFoundHandler to return a proper 404
      if (path.extname(req.path)) {
        return next();
      }

      const indexHtml = path.join(frontendDistPath!, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexHtml);
      } else {
        next();
      }
    });
  }

  return frontendDistPath;
}

export const activeFrontendDistPath = configureStaticServing(app);

// ============================================================================
// 4. ERROR HANDLING
// ============================================================================

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Structured 500 & error handler
app.use(errorHandler);

// ============================================================================
// 5. SERVER LIFECYCLE & GRACEFUL SHUTDOWN
// ============================================================================

export function resolveServerPort(envPort?: string | number): number {
  if (envPort === undefined || envPort === null) return 8080;
  const str = String(envPort).trim();
  if (str === '') return 8080;
  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return 8080;
  }
  return parsed;
}

export let server: http.Server | null = null;

export function startServer(port: number = resolveServerPort(process.env.PORT)): Promise<http.Server> {
  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`🚀 SME AutoPilot Express Server listening on port ${port} (Mode: ${process.env.APP_MODE || 'DEMO'})`);
      resolve(server!);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err) => {
        if (err) return reject(err);
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Graceful shutdown handling
const handleSignal = (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
  stopServer().then(() => {
    console.log('[Server] Shutdown complete.');
    process.exit(0);
  }).catch((err) => {
    console.error('[Server] Error during shutdown:', err);
    process.exit(1);
  });
};

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));

if (require.main === module) {
  const PORT = resolveServerPort(process.env.PORT);
  startServer(PORT);
}
