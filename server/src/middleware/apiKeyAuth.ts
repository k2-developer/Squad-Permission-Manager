import { type Request, type Response, type NextFunction } from 'express';
import { ApiKey, hashApiKey, type ApiPermission } from '../models/ApiKey.js';
import { forbidden, unauthorized } from '../utils/errors.js';

const RAW_KEY_RE = /^spm_[A-Za-z0-9_-]{20,}$/;

/**
 * Express middleware that authenticates a request via `Authorization: Bearer spm_...`.
 * Populates `req.apiKey` on success. Use `requireApiPermission()` after this to
 * enforce scopes on individual routes.
 *
 * NOTE: this is separate from `authenticate` (cookie/JWT). The public-API router
 * uses this *instead* of `authenticate`. Sessions and API keys never mix on a
 * single request — the chosen mechanism determines the auth context.
 */
export async function authenticateApiKey(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing Bearer token'));
    return;
  }
  const raw = header.slice(7).trim();
  if (!RAW_KEY_RE.test(raw)) {
    next(unauthorized('Invalid API key format'));
    return;
  }

  const hash = hashApiKey(raw);
  const key = await ApiKey.findOne({ keyHash: hash });
  if (!key) {
    next(unauthorized('Invalid API key'));
    return;
  }
  if (key.revokedAt) {
    next(unauthorized('API key revoked'));
    return;
  }
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
    next(unauthorized('API key expired'));
    return;
  }

  // Best-effort lastUsedAt update — failures don't block the request.
  ApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  (req as any).apiKey = key;
  next();
}

/** Require the calling API key to have ALL of the given permissions. */
export function requireApiPermission(...perms: ApiPermission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = (req as any).apiKey;
    if (!key) { next(unauthorized()); return; }
    const granted: ApiPermission[] = key.permissions || [];
    for (const p of perms) {
      if (!granted.includes(p)) {
        next(forbidden(`Missing required permission: ${p}`));
        return;
      }
    }
    next();
  };
}

/** Helper to get the org id this key is scoped to (always an ObjectId). */
export function apiKeyOrgId(req: Request): string {
  const key = (req as any).apiKey;
  return key.orgId.toString();
}
