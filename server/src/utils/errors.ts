/**
 * AppError carries an HTTP status, a human message, and an optional
 * machine-readable `code` (e.g. "access_revoked") that the frontend can
 * key off without parsing the message.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(msg = 'Not found', code?: string) {
  return new AppError(404, msg, code);
}

export function forbidden(msg = 'Forbidden', code?: string) {
  return new AppError(403, msg, code);
}

export function unauthorized(msg = 'Unauthorized', code?: string) {
  return new AppError(401, msg, code);
}

export function badRequest(msg = 'Bad request', code?: string) {
  return new AppError(400, msg, code);
}
