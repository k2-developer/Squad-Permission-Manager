import { type Request, type Response, type NextFunction } from 'express';
import { forbidden, unauthorized } from '../utils/errors.js';
import type { UserRole } from '../models/User.js';

// Lower number = higher privilege. There are only two real admin tiers
// (owner / admin); manager has no system-level access on its own.
const ROLE_LEVELS: Record<UserRole, number> = {
  owner: 0,
  admin: 5,
  manager: 100,
};

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(unauthorized()); return; }

    const userLevel = ROLE_LEVELS[req.user.role];
    const maxAllowedLevel = Math.max(...allowed.map((r) => ROLE_LEVELS[r]));

    if (userLevel <= maxAllowedLevel) next();
    else next(forbidden('Insufficient permissions'));
  };
}

/** Convenience wrapper for "any admin-tier role (owner or admin)". */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(unauthorized()); return; }
  if (ROLE_LEVELS[req.user.role] > ROLE_LEVELS.admin) {
    next(forbidden('Admin access required'));
    return;
  }
  next();
}

/** Convenience wrapper for "owner only". */
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(unauthorized()); return; }
  if (req.user.role !== 'owner') {
    next(forbidden('Owner access required'));
    return;
  }
  next();
}

export function isAdminTier(role: UserRole): boolean {
  return ROLE_LEVELS[role] <= ROLE_LEVELS.admin;
}
