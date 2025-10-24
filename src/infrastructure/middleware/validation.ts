import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '@/infrastructure/log/logger.js';
import { SERVER } from '@/infrastructure/log/log-events.js';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.error({
          event: SERVER.ERROR,
          msg: 'Validation failed',
          data: { errors: errorMessages },
        });

        res.status(400).json({
          error: 'Validation failed',
          details: errorMessages,
        });
      } else {
        logger.error({
          event: SERVER.ERROR,
          msg: 'Unexpected validation error',
          err: error as Error,
        });

        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
