import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api, setAuthenticated, onAccessRevoked, ApiError } from '../api';
import RevokedDialog from '../components/RevokedDialog';

interface User {
  _id: string;
  steamId: string;
  displayName: string;
  avatar: string;
  role: 'owner' | 'admin' | 'manager';
  clanId?: { _id: string; name: string; tag: string } | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Poll /auth/me at this interval so an idle tab still picks up revokes
 *  within ~30s, not just on the user's next click. */
const POLL_INTERVAL_MS = 30_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokeReason, setRevokeReason] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const fetchUser = useCallback(async () => {
    try {
      const data = await api<User>('/auth/me');
      setUser(data);
      setAuthenticated(true);
    } catch (err) {
      // Don't blow away a logged-in state on a transient revoke event —
      // the revoke dialog handler takes care of the redirect itself.
      if (!(err instanceof ApiError && err.code === 'access_revoked')) {
        setUser(null);
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchUser(); }, [fetchUser]);

  // Subscribe to revoke events from the api wrapper.
  useEffect(() => {
    return onAccessRevoked((msg) => {
      // Only react if we currently believe we're logged in — avoid showing
      // the dialog when the api throws revoke during the very first
      // /auth/me on an already-logged-out tab.
      if (userRef.current) {
        setRevokeReason(msg);
      }
    });
  }, []);

  // Periodic poll — keeps idle tabs honest. Skip while no user is logged
  // in or while the revoke dialog is already showing.
  useEffect(() => {
    if (!user || revokeReason) return;
    const id = window.setInterval(() => { fetchUser(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, revokeReason, fetchUser]);

  const login = () => {
    window.location.href = '/api/auth/steam';
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
    setAuthenticated(false);
  };

  const acknowledgeRevoke = () => {
    setRevokeReason(null);
    setUser(null);
    setAuthenticated(false);
    // Full reload via location so any cached state is dropped, and the
    // login page can render its own error banner from the query param.
    window.location.href = '/login?error=revoked';
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refetchUser: fetchUser }}
    >
      {children}
      {revokeReason && (
        <RevokedDialog reason={revokeReason} onAcknowledge={acknowledgeRevoke} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
