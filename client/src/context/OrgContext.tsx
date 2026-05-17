import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

interface OrgSummary {
  _id: string;
  name: string;
  slug: string;
  serverCount?: number;
  playerCount?: number;
}

interface OrgState {
  orgs: OrgSummary[];
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const OrgContext = createContext<OrgState | null>(null);

const STORAGE_KEY = 'spm_current_org_id';

/**
 * Provides the user's organizations and which one is currently active.
 * The selected org persists across page reloads via localStorage.
 *
 * On mount, fetches `/orgs/mine`. If the stored org is still in the list,
 * it stays selected; otherwise the first org is selected. If the user has
 * no orgs, `currentOrgId` is null and pages that depend on it should render
 * a "create an organization first" hint.
 */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* */ }
  }, []);

  const refetch = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setCurrentOrgIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api<OrgSummary[]>('/orgs/mine');
      setOrgs(list);
      let stored: string | null = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* */ }
      const hasStored = !!stored && list.some((o) => o._id === stored);
      const next = hasStored ? stored : list[0]?._id ?? null;
      setCurrentOrgIdState(next);
      // If the stored org no longer belongs to us (deleted / removed by an
      // admin), drop it from storage so a hard refresh doesn't keep
      // resurrecting a dead id that the backend will 403/404 on.
      try {
        if (next) localStorage.setItem(STORAGE_KEY, next);
        else localStorage.removeItem(STORAGE_KEY);
      } catch { /* */ }
    } catch {
      setOrgs([]);
      setCurrentOrgIdState(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) refetch();
  }, [authLoading, refetch]);

  return (
    <OrgContext.Provider value={{ orgs, currentOrgId, setCurrentOrgId, loading, refetch }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
