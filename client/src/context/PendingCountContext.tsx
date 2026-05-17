import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { useOrg } from './OrgContext';

interface PendingCtx {
  count: number;
  refresh: () => Promise<void>;
}

const Ctx = createContext<PendingCtx>({ count: 0, refresh: async () => {} });

// 15s is the sweet spot — short enough that Discord-side approvals reflect
// in the badge quickly, long enough that a single tab doesn't hammer the
// API. If polling load becomes a problem, swap this for an SSE / WS push.
const POLL_MS = 15_000;

export function PendingCountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const [count, setCount] = useState(0);
  const location = useLocation();
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !currentOrgId) {
      setCount(0);
      return;
    }
    try {
      const list = await api<unknown[]>(`/whitelist/pending?orgId=${currentOrgId}`);
      setCount(Array.isArray(list) ? list.length : 0);
    } catch {
      // Don't blow up the nav badge over a transient fetch error.
    }
  }, [user, currentOrgId]);

  // Fetch on login/org-change and whenever the user navigates — cheap, makes
  // the badge feel live without aggressive polling.
  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);

  // Polling safety net for users who sit on one page for a long time.
  useEffect(() => {
    if (!user || !currentOrgId) return;
    timerRef.current = window.setInterval(() => {
      // Re-check inside the callback — `user` may have been cleared by a
      // revoke handler between scheduling and firing.
      if (user && currentOrgId) refresh();
    }, POLL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [user, currentOrgId, refresh]);

  return <Ctx.Provider value={{ count, refresh }}>{children}</Ctx.Provider>;
}

export function usePendingCount() {
  return useContext(Ctx);
}
