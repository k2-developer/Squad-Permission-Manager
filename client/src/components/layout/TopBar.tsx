import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingCount } from '../../context/PendingCountContext';
import { useI18n } from '../../i18n';
import LangSwitch from '../ui/LangSwitch';
import {
  LayoutDashboard, Clock, Swords, Layers, Server as ServerIcon,
  UserCog, Settings, Key, LogOut, ChevronDown, Shield,
} from 'lucide-react';
import Logo from '../Logo';
import type { TranslationKey } from '../../i18n';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: any;
  roles: string[] | null;
}

const mainNav: NavItem[] = [
  { to: '/', labelKey: 'navDashboard', icon: LayoutDashboard, roles: null },
  { to: '/whitelist', labelKey: 'navWhitelist', icon: Shield, roles: null },
  { to: '/approvals', labelKey: 'navApprovals', icon: Clock, roles: null },
  { to: '/clans', labelKey: 'navClans', icon: Swords, roles: ['owner', 'admin'] },
  { to: '/groups', labelKey: 'navGroups', icon: Layers, roles: ['owner', 'admin'] },
];

const adminNav: NavItem[] = [
  { to: '/servers', labelKey: 'navServers', icon: ServerIcon, roles: ['owner', 'admin'] },
  { to: '/users', labelKey: 'navUsers', icon: UserCog, roles: ['owner'] },
  { to: '/settings', labelKey: 'navSettings', icon: Settings, roles: ['owner', 'admin'] },
  { to: '/api-keys', labelKey: 'navApiKeys', icon: Key, roles: ['owner', 'admin'] },
];

export default function TopBar() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { count: pendingCount } = usePendingCount();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const hasRole = (roles: string[] | null) =>
    !roles || (user && roles.includes(user.role));

  const visibleAdmin = adminNav.filter((i) => hasRole(i.roles));

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 hidden lg:block border-b border-surface-800/50 bg-surface-950/80 backdrop-blur-lg">
      <div className="mx-auto max-w-screen-2xl 3xl:max-w-screen-3xl 4xl:max-w-screen-4xl px-6 xl:px-10">
        <div className="flex h-16 items-center gap-1">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-2.5 mr-7 shrink-0">
            <Logo size={38} className="text-accent-400" />
            <span className="text-lg font-bold tracking-tight">SPM</span>
          </NavLink>

          {/* Main nav items */}
          <nav className="flex items-center gap-0.5">
            {mainNav
              .filter((item) => hasRole(item.roles))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${
                      isActive
                        ? 'bg-accent-600/15 text-accent-400'
                        : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                    }`
                  }
                >
                  <item.icon size={16} className="shrink-0" />
                  {t(item.labelKey)}
                  {item.to === '/approvals' && pendingCount > 0 && (
                    <span className="-ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}

            {/* Admin dropdown */}
            {visibleAdmin.length > 0 && (
              <AdminDropdown items={visibleAdmin} />
            )}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: lang + profile.
              Org switcher hidden — single-tenant deployment, the default org
              is auto-created at first login. */}
          <div className="flex items-center gap-2">
            <LangSwitch />

            {/* Profile dropdown */}
            {user && (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] hover:bg-surface-800 transition-colors"
                >
                  <img
                    src={user.avatar || undefined}
                    alt={user.displayName}
                    className="h-8 w-8 rounded-full bg-surface-700"
                  />
                  <span className="text-[14px] font-medium text-surface-200 max-w-[140px] truncate">
                    {user.displayName}
                  </span>
                  <ChevronDown size={15} className={`text-surface-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-surface-700/50 bg-surface-900 py-1.5 shadow-xl">
                    <div className="px-3 py-2 border-b border-surface-800 mb-1">
                      <p className="text-sm font-medium truncate">{user.displayName}</p>
                      <p className="text-xs text-surface-500 capitalize">{user.role}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-surface-800 transition-colors"
                    >
                      <LogOut size={15} />
                      {t('logOut')}
                    </button>
                    <div className="border-t border-surface-800 mt-1 pt-1.5 px-3 pb-1">
                      <p className="text-[9px] font-mono uppercase tracking-wider text-surface-600 text-center">
                        powered by{' '}
                        <a
                          href="https://squadpanel.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-500"
                        >
                          squadpanel.com
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function AdminDropdown({ items }: { items: NavItem[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isAnyActive = items.some((i) =>
    i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${
          isAnyActive
            ? 'bg-accent-600/15 text-accent-400'
            : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
        }`}
      >
        <Settings size={15} />
        Admin
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-surface-700/50 bg-surface-900 py-1.5 shadow-xl">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-accent-400 bg-accent-600/10'
                    : 'text-surface-300 hover:bg-surface-800'
                }`
              }
            >
              <item.icon size={15} className="shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
