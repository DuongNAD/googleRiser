/**
 * SME AutoPilot — Request Logger Middleware
 * backend/src/middleware/requestLogger.ts
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    // Suppress spam during automated tests unless error
    if (process.env.NODE_ENV !== 'test' || res.statusCode >= 400) {
      console.log(`[${new Date().toISOString()}] [${logLevel}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
}
