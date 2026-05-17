import rateLimit from 'express-rate-limit';

// Global: 100 req/min per IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Auth endpoints: 5 attempts per 60s per IP
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Public endpoints: 20 req/min per IP
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Whitelist output endpoint: 60 req/min per IP. Cached responses don't hit
// the DB, but uncached requests trigger 3 DB queries — protect against floods.
export const outputLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Write operations: 30 req/min per IP
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write operations' },
  keyGenerator: (req) => req.ip || 'unknown',
});
