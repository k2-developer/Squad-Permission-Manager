import { type Request, type Response, type NextFunction } from 'express';
import { badRequest } from '../utils/errors.js';

type ValidationRule = {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
  maxLength?: number;
  pattern?: RegExp;
};

export function validateBody(rules: ValidationRule[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body?.[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rule.type && typeof value !== rule.type) {
        errors.push(`${rule.field} must be a ${rule.type}`);
      }

      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push(`${rule.field} exceeds max length of ${rule.maxLength}`);
      }

      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(`${rule.field} has invalid format`);
      }
    }

    if (errors.length > 0) {
      next(badRequest(errors.join('; ')));
      return;
    }

    next();
  };
}
