import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../utils/errors.js';
import { User, type UserRole } from '../models/User.js';
import { Group } from '../models/Group.js';

export interface JwtPayload {
  userId: string;
  steamId: string;
  role: UserRole;
}

const IS_PROD = process.env.NODE_ENV === 'production';

// `secure: true` cookies are NEVER sent by browsers over plain HTTP. So if
// production is intentionally running over http:// (IP / LAN install with
// ALLOW_INSECURE_HTTP=true), forcing Secure breaks login entirely — the
// browser drops the cookies and the panel never sees them on the next
// request. Tie Secure to the URL protocol the panel is actually served on,
// not to NODE_ENV.
const SERVING_HTTPS =
  (process.env.CLIENT_URL ?? '').startsWith('https://') ||
  (process.env.STEAM_REALM ?? '').startsWith('https://');

const COOKIE_OPTS_BASE = {
  httpOnly: true,
  secure: IS_PROD && SERVING_HTTPS,
  sameSite: IS_PROD && SERVING_HTTPS ? 'strict' as const : 'lax' as const,
  path: '/',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('spm_access', accessToken, {
    ...COOKIE_OPTS_BASE,
    maxAge: 15 * 60 * 1000, // 15 min
  });
  res.cookie('spm_refresh', refreshToken, {
    ...COOKIE_OPTS_BASE,
    path: '/api/auth', // refresh token only sent to auth routes
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('spm_access', { ...COOKIE_OPTS_BASE });
  res.clearCookie('spm_refresh', { ...COOKIE_OPTS_BASE, path: '/api/auth' });
}

/**
 * Sentinel error code returned in 401 JSON when access was withdrawn at
 * runtime (e.g. owner removed the user's SteamID from every clan's
 * managers list). The frontend listens for this code and shows a modal
 * instead of a silent redirect.
 */
export const REVOKED_ERROR_CODE = 'access_revoked';

/**
 * Cheap per-request authorization check. On top of the JWT signature check
 * it also re-reads the user from the DB and verifies that their access is
 * still valid:
 *
 *   - User record must still exist (catches "owner deleted me").
 *   - For role=manager, at least one clan must still list their SteamID in
 *     `managers` (catches "owner kicked me from every clan").
 *
 * If either check fails the request is rejected 401 with `code:'access_revoked'`
 * and both cookies are cleared so the browser stops sending the stale
 * session immediately.
 *
 * Cost: one User.findById + (only for managers) one Group.exists. Both are
 * indexed lookups; total overhead ~1ms in single-host setups. Cheaper than
 * any alternative that would still react instantly.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.spm_access || extractBearerToken(req);
  if (!token) {
    next(unauthorized('No token provided'));
    return;
  }

  let payload: JwtPayload;
  try {
    // Pin the algorithm — `jsonwebtoken` otherwise honours whatever `alg`
    // header the attacker put on the token (including `none`), which is the
    // classic JWT confusion attack.
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    next(unauthorized('Invalid or expired token'));
    return;
  }

  try {
    const user = await User.findById(payload.userId).select('steamId role');
    if (!user) {
      clearAuthCookies(res);
      next(unauthorized('Account no longer exists', REVOKED_ERROR_CODE));
      return;
    }

    if (user.role === 'manager') {
      const stillManager = await Group.exists({
        type: 'clan',
        managers: user.steamId,
      });
      if (!stillManager) {
        clearAuthCookies(res);
        next(unauthorized('Access revoked', REVOKED_ERROR_CODE));
        return;
      }
    }

    // Use the up-to-date role from the DB rather than the JWT, so a
    // mid-session promote/demote takes effect immediately too.
    (req as any).user = {
      userId: user._id.toString(),
      steamId: user.steamId,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTtl,
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] }) as JwtPayload;
}
