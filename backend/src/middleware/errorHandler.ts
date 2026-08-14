/**
 * SME AutoPilot — Structured Error Handling Middleware
 * backend/src/middleware/errorHandler.ts
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Standardized helper for creating error responses
 */
export function createErrorResponse(code: string, message: string, details?: any): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {})
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * 404 Not Found Catch-All Middleware
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const path = req.originalUrl || req.url;
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${path} does not exist`
    },
    timestamp: new Date().toISOString()
  };
  res.status(404).json(response);
}

/**
 * Global Structured Error Handler Middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isProd = process.env.NODE_ENV === 'production';

  // Handle JSON parse error (SyntaxError with status 400)
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body'
      },
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  // Handle Payload Too Large (413)
  if (err.type === 'entity.too.large' || (err as any).status === 413) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds limit'
      },
      timestamp: new Date().toISOString()
    };
    res.status(413).json(response);
    return;
  }

  const statusCode = err.statusCode || (err as any).status || 500;
  const errorCode = err.code || (statusCode === 400 ? 'BAD_REQUEST' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  const message = isProd && statusCode === 500 ? 'An unexpected server error occurred' : err.message || 'Internal server error';

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(isProd ? {} : err.details ? { details: err.details } : err.stack ? { details: err.stack } : {})
    },
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
}
