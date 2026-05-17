const API_BASE = '/api';

// Tokens are stored in httpOnly cookies — JS never touches them.
// We only track auth state (logged in or not) via a flag.
let isAuthenticated = false;

export function setAuthenticated(val: boolean) {
  isAuthenticated = val;
}

export function getIsAuthenticated() {
  return isAuthenticated;
}

/* ─── Revoked-session event bus ──────────────────────────────────────────
 * When the server returns 401 with `code:'access_revoked'` (typically because
 * an admin removed the user mid-session), we emit an event so AuthContext can
 * surface a modal instead of silently 401-looping. Listeners get the human
 * message the server included.
 */
type Listener = (msg: string) => void;
const revokedListeners = new Set<Listener>();

export function onAccessRevoked(fn: Listener): () => void {
  revokedListeners.add(fn);
  return () => revokedListeners.delete(fn);
}

function emitRevoked(msg: string) {
  for (const fn of revokedListeners) {
    try { fn(msg); } catch { /* ignore */ }
  }
}

async function refreshAccessToken(): Promise<{ ok: boolean; revokedMsg?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      if (body?.code === 'access_revoked') {
        return { ok: false, revokedMsg: body.error || 'Access revoked' };
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // 401 handling: try a refresh, then re-issue the original request.
  // If the server flags the failure as `access_revoked`, surface it to
  // AuthContext (modal) and reject the call without further retries.
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.code === 'access_revoked') {
      emitRevoked(body.error || 'Access revoked');
      isAuthenticated = false;
      throw new ApiError(401, body.error || 'Access revoked', 'access_revoked');
    }

    const refreshed = await refreshAccessToken();
    if (refreshed.ok) {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      // Re-check after the retry — possible the user got revoked between
      // refresh issuance and this new call.
      if (res.status === 401) {
        const body2 = await res.clone().json().catch(() => ({}));
        if (body2?.code === 'access_revoked') {
          emitRevoked(body2.error || 'Access revoked');
          isAuthenticated = false;
          throw new ApiError(401, body2.error || 'Access revoked', 'access_revoked');
        }
      }
    } else {
      isAuthenticated = false;
      if (refreshed.revokedMsg) {
        emitRevoked(refreshed.revokedMsg);
        throw new ApiError(401, refreshed.revokedMsg, 'access_revoked');
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || 'Request failed', body.code);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
