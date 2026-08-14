/**
 * SME AutoPilot — Request Validation Middleware
 * backend/src/middleware/validate.ts
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared';

export interface ValidationSchema {
  requiredFields?: string[];
  types?: Record<string, string>;
}

/**
 * Pure helper function for schema validation
 */
export function validateRequestBody(
  schema: { requiredFields: string[]; types?: Record<string, string> },
  body: any
): { isValid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Request body must be a valid JSON object' };
  }

  for (const field of schema.requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return { isValid: false, error: `Missing required parameter: '${field}'` };
    }
    const expectedType = schema.types?.[field];
    if (expectedType && typeof body[field] !== expectedType) {
      return {
        isValid: false,
        error: `Field '${field}' must be of type ${expectedType}, received ${typeof body[field]}`
      };
    }
  }

  return { isValid: true };
}

/**
 * Express middleware factory for validating request bodies
 */
export function validateBody(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Request body must be a valid JSON object'
        },
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }

    if (schema.requiredFields && schema.requiredFields.length > 0) {
      for (const field of schema.requiredFields) {
        if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'MISSING_REQUIRED_FIELD',
              message: `Missing required parameter: '${field}'`
            },
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
        }

        const expectedType = schema.types?.[field];
        if (expectedType && typeof req.body[field] !== expectedType) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'INVALID_FIELD_TYPE',
              message: `Field '${field}' must be of type ${expectedType}, received ${typeof req.body[field]}`
            },
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
        }
      }
    }

    next();
  };
}
