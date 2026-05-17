import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingCount } from '../../context/PendingCountContext';
import { useI18n } from '../../i18n';
import LangSwitch from '../ui/LangSwitch';
import {
  LayoutDashboard, Shield, Swords, Menu,
  X, Clock, Layers, Server as ServerIcon, UserCog, Settings, Key, LogOut, Monitor,
} from 'lucide-react';
import Logo from '../Logo';
import type { TranslationKey } from '../../i18n';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: any;
  roles: string[] | null;
}

// Bottom bar — 4 main tabs (5th slot reserved for Menu button).
const bottomTabs: NavItem[] = [
  { to: '/', labelKey: 'navDashboard', icon: LayoutDashboard, roles: null },
  { to: '/whitelist', labelKey: 'navWhitelist', icon: Shield, roles: null },
  { to: '/approvals', labelKey: 'navApprovals', icon: Clock, roles: null },
  { to: '/clans', labelKey: 'navClans', icon: Swords, roles: ['owner', 'admin'] },
];

// Full menu items (drawer)
const allItems: NavItem[] = [
  { to: '/', labelKey: 'navDashboard', icon: LayoutDashboard, roles: null },
  { to: '/whitelist', labelKey: 'navWhitelist', icon: Shield, roles: null },
  { to: '/approvals', labelKey: 'navApprovals', icon: Clock, roles: null },
  { to: '/clans', labelKey: 'navClans', icon: Swords, roles: ['owner', 'admin'] },
  { to: '/groups', labelKey: 'navGroups', icon: Layers, roles: ['owner', 'admin'] },
  { to: '/servers', labelKey: 'navServers', icon: ServerIcon, roles: ['owner', 'admin'] },
  { to: '/users', labelKey: 'navUsers', icon: UserCog, roles: ['owner'] },
  { to: '/settings', labelKey: 'navSettings', icon: Settings, roles: ['owner', 'admin'] },
  { to: '/api-keys', labelKey: 'navApiKeys', icon: Key, roles: ['owner', 'admin'] },
];

interface Props {
  onRequestDesktop: () => void;
}

export default function MobileNav({ onRequestDesktop }: Props) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { count: pendingCount } = usePendingCount();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const hasRole = (roles: string[] | null) =>
    !roles || (user && roles.includes(user.role));

  const visibleTabs = bottomTabs.filter((item) => hasRole(item.roles));

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <>
      {/* Bottom tab bar */}
      <div className="fixed bottom-3 left-3 right-3 z-50 flex h-14 items-center justify-around rounded-2xl border border-surface-700/50 bg-surface-900/95 backdrop-blur-lg shadow-xl lg:hidden">
        {visibleTabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-0 flex-1"
          >
            {({ isActive: active }) => (
              <>
                <span className="relative">
                  <item.icon
                    size={20}
                    className={active ? 'text-accent-400' : 'text-surface-500'}
                  />
                  {item.to === '/approvals' && pendingCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-600 px-[3px] text-[9px] font-bold text-white">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] font-medium truncate ${
                    active ? 'text-accent-400' : 'text-surface-500'
                  }`}
                >
                  {t(item.labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}

        {/* More / Menu button */}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-0 flex-1"
        >
          <Menu size={20} className={menuOpen ? 'text-accent-400' : 'text-surface-500'} />
          <span className={`text-[10px] font-medium ${menuOpen ? 'text-accent-400' : 'text-surface-500'}`}>
            Menu
          </span>
        </button>
      </div>

      {/* Full-screen mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-surface-950/95 backdrop-blur-lg lg:hidden overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800/50">
            <div className="flex items-center gap-3">
              <Logo size={34} className="text-accent-400" />
              <span className="font-bold text-base">SPM</span>
            </div>
            <div className="flex items-center gap-3">
              <LangSwitch />
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-surface-400 hover:bg-surface-800"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* User card */}
          {user && (
            <div className="mx-5 mt-5 mb-4 flex items-center gap-3 rounded-xl bg-surface-900 border border-surface-800 p-3">
              <img
                src={user.avatar}
                alt={user.displayName}
                className="h-10 w-10 rounded-full bg-surface-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-surface-500 capitalize">{user.role}</p>
              </div>
            </div>
          )}

          {/* Navigation items */}
          <nav className="px-3 py-2 space-y-0.5">
            {allItems
              .filter((item) => hasRole(item.roles))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(item.to)
                      ? 'bg-accent-600/15 text-accent-400'
                      : 'text-surface-300 active:bg-surface-800'
                  }`}
                >
                  <item.icon size={18} className="shrink-0" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
          </nav>

          {/* Bottom actions */}
          <div className="px-5 mt-4 pb-8 space-y-3 border-t border-surface-800/50 pt-4">
            <button
              onClick={onRequestDesktop}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm text-surface-400 active:bg-surface-800 transition-colors"
            >
              <Monitor size={18} className="shrink-0" />
              Desktop version
            </button>

            {user && (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm text-red-400 active:bg-surface-800 transition-colors"
              >
                <LogOut size={18} className="shrink-0" />
                {t('logOut')}
              </button>
            )}

            <p className="pt-4 text-center text-[10px] font-mono uppercase tracking-wider text-surface-600">
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
    </>
  );
}
