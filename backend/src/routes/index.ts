/**
 * SME AutoPilot — Master Routes Aggregator
 * backend/src/routes/index.ts
 */

import { Router } from 'express';
import { healthRouter } from './health.routes';
import { aiRouter } from './ai.routes';
import { googleRouter } from './google.routes';
import { ordersRouter } from './orders.routes';
import { inventoryRouter } from './inventory.routes';

export * from './health.routes';
export * from './ai.routes';
export * from './google.routes';
export * from './orders.routes';
export * from './inventory.routes';

export const apiRouter = Router();

// Health endpoints
apiRouter.use(healthRouter);

// Multimodal AI endpoints
apiRouter.use('/api/ai', aiRouter);
apiRouter.use('/api/v1/ai', aiRouter);

// Google Ecosystem SPI endpoints
apiRouter.use('/api/google', googleRouter);
apiRouter.use('/api/v1/google', googleRouter);

// Orders convenience endpoints
apiRouter.use('/api/orders', ordersRouter);
apiRouter.use('/api/v1/orders', ordersRouter);

// Inventory convenience endpoints
apiRouter.use('/api/inventory', inventoryRouter);
apiRouter.use('/api/v1/inventory', inventoryRouter);
