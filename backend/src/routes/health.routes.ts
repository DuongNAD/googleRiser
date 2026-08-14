/**
 * SME AutoPilot — Health & Readiness Probes
 * backend/src/routes/health.routes.ts
 */

import { Router, Request, Response } from 'express';
import { getGoogleFactory } from '../google/factory';
import { getGeminiClient } from '../ai/geminiClient';

export const healthRouter = Router();

/**
 * Liveness Probe: GET /healthz
 */
healthRouter.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Readiness & Diagnostics Probe: GET /api/health (and /health)
 */
healthRouter.get(['/api/health', '/health'], (req: Request, res: Response) => {
  const factory = getGoogleFactory();
  const gemini = getGeminiClient();
  const mode = factory.getMode().toLowerCase() as 'demo' | 'live';
  const isDemo = mode === 'demo';

  const healthData = {
    status: 'ok' as const,
    mode,
    activeIndustry: (global as any).activeIndustry || 'fashion',
    services: {
      gemini: !gemini.isDemoMode() || isDemo,
      sheets: true,
      gmail: true,
      calendar: true,
      maps: true,
      firestore: true
    },
    system: {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  res.status(200).json({
    success: true,
    data: healthData,
    ...healthData,
    timestamp: new Date().toISOString()
  });
});
