import { type Request, type Response, type NextFunction } from 'express';

/**
 * Recursively strip keys starting with $ or containing dots
 * to prevent MongoDB operator injection ($gt, $ne, $regex etc)
 */
function deepSanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepSanitize);

  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    // Block MongoDB operators and dot notation
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = deepSanitize(obj[key]);
  }
  return clean;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    // Sanitize query string values (not keys, Express handles those)
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === 'object' && val !== null) {
        // Block operator-style query params like ?clanId[$ne]=null
        req.query[key] = undefined as any;
      }
    }
  }
  next();
}
