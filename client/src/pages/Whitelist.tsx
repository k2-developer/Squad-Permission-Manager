import { useState, useMemo, useEffect } from 'react';
import Header from '../components/layout/Header';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import { useOrg } from '../context/OrgContext';
import { api } from '../api';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Plus, Trash2, Search, Copy, Globe, Server as ServerIcon } from 'lucide-react';
import Select from '../components/ui/Select';
import DurationPicker from '../components/DurationPicker';
import { usePendingCount } from '../context/PendingCountContext';

interface Player {
  _id: string;
  username: string;
  steamId64: string;
  eosId: string;
}

interface ServerRef { _id: string; name: string }

interface Group {
  _id: string;
  name: string;
  tag?: string;
  type?: 'clan' | 'vip' | 'admin' | 'custom';
  serverScope?: 'all' | 'selected';
  serverIds?: ServerRef[];
}

interface Entry {
  _id: string;
  playerId: Player;
  groupId: Group;
  insertedBy: { displayName: string };
  approved: boolean;
  expiresAt?: string;
  createdAt: string;
}

/**
 * SteamID with an inline copy affordance — Steam icon on the left
 * (purely decorative) and a click-anywhere-to-copy interaction. Shows a
 * brief toast on success. Used in tables where admins routinely need to
 * paste a SteamID into Discord / their notes.
 */
function SteamIdChip({ steamId }: { steamId?: string }) {
  const toast = useToast();
  if (!steamId) return <span className="font-mono text-[11px] text-surface-500">—</span>;
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(steamId);
      toast('success', `SteamID copied: ${steamId.slice(0, 6)}…${steamId.slice(-4)}`);
    } catch {
      toast('error', 'Failed to copy');
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title={`Copy ${steamId}`}
      className="group inline-flex items-center gap-1.5 font-mono text-[11px] text-surface-500 hover:text-surface-300 transition-colors max-w-full"
    >
      <SteamGlyph className="w-3 h-3 text-surface-600 group-hover:text-accent-400 transition-colors shrink-0" />
      <span className="truncate">{steamId}</span>
      <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 shrink-0" />
    </button>
  );
}

/** Steam logo — same outline approximation we use elsewhere. */
function SteamGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.979 0C5.678 0 .511 4.86.022 10.94l6.432 2.658a3.387 3.387 0 0 1 1.912-.587c.063 0 .126.002.188.006l2.861-4.142V8.81a4.53 4.53 0 0 1 4.524-4.524 4.53 4.53 0 0 1 4.524 4.524 4.53 4.53 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.003.105.003.158a3.392 3.392 0 0 1-3.392 3.392 3.396 3.396 0 0 1-3.358-2.935L.142 14.47C1.283 19.957 6.14 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.542 2.542 0 0 0 4.873-.934 2.547 2.547 0 0 0-2.544-2.544c-.164 0-.326.016-.484.047l1.522.63a1.873 1.873 0 0 1-1.422 3.463l-.472-.052zm8.399-5.726a3.024 3.024 0 0 0 3.02-3.02 3.024 3.024 0 0 0-3.02-3.02 3.024 3.024 0 0 0-3.02 3.02 3.024 3.024 0 0 0 3.02 3.02zm-.005-5.286a2.27 2.27 0 1 1 0 4.54 2.27 2.27 0 0 1 0-4.54z" />
    </svg>
  );
}

/**
 * Compact display of which Squad servers this entry will end up on. Server
 * scope is a group-level property, so all entries in the same clan share the
 * same set — but admins still want to see it per-row to verify at a glance.
 *
 *   - 'all' → globe icon + label "All"
 *   - 'selected' with 1-2 servers → list them inline
 *   - 'selected' with 3+ → first one + "+N" pill (full list on hover via title)
 *   - 'selected' with 0 ids → "— · no servers" tinted amber (misconfigured group)
 */
function ServersCell({ group, allLabel }: { group?: Group; allLabel: string }) {
  if (!group) return <span className="text-surface-500">—</span>;
  if (group.serverScope === 'all' || !group.serverScope) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-surface-300">
        <Globe size={12} className="text-surface-500" />
        {allLabel}
      </span>
    );
  }
  const ids = group.serverIds ?? [];
  if (ids.length === 0) {
    return <span className="font-mono text-[12px] text-amber-400/70">— · no servers</span>;
  }
  if (ids.length <= 2) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-surface-300 max-w-[200px]">
        <ServerIcon size={12} className="text-surface-500 shrink-0" />
        <span className="truncate">{ids.map((s) => s.name).join(', ')}</span>
      </span>
    );
  }
  const rest = ids.length - 1;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] text-surface-300"
      title={ids.map((s) => s.name).join(', ')}
    >
      <ServerIcon size={12} className="text-surface-500 shrink-0" />
      <span className="truncate max-w-[120px]">{ids[0].name}</span>
      <span className="font-mono text-[10px] text-surface-500 px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700/60">
        +{rest}
      </span>
    </span>
  );
}

/** Active/pending/expired pill — matches the landing dashboard preview. */
function StatusPill({ kind }: { kind: 'active' | 'pending' | 'expired' }) {
  if (kind === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]" />
        ACTIVE
      </span>
    );
  }
  if (kind === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] tracking-wider text-accent-400 bg-accent-500/10 border border-accent-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
        PENDING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] tracking-wider text-surface-500 bg-surface-800 border border-surface-700/60">
      <span className="w-1.5 h-1.5 rounded-full bg-surface-500" />
      EXPIRED
    </span>
  );
}

/**
 * Two-part badge for the Group column.
 *   [TYPE] [tag] Name
 *
 * Type chip is colour-coded (clan/vip/admin/custom) and always Latin/EN —
 * it's a tag for screenshot readability, not a translation target.
 * The clan tag + name come from user data and stay as the admin entered
 * them; we keep them English-only by convention because they end up in
 * Squad's Admins.cfg.
 */
function GroupBadge({ group }: { group?: Group }) {
  if (!group) return <span className="text-surface-500">—</span>;
  const t = group.type ?? 'custom';
  const palette: Record<string, { chip: string; text: string }> = {
    clan:   { chip: 'bg-accent-500/15 text-accent-300 border-accent-500/25',   text: 'text-accent-200' },
    vip:    { chip: 'bg-amber-500/15 text-amber-300 border-amber-500/25',      text: 'text-amber-200' },
    admin:  { chip: 'bg-red-500/15 text-red-300 border-red-500/25',            text: 'text-red-200' },
    custom: { chip: 'bg-surface-800 text-surface-300 border-surface-700/60',   text: 'text-surface-200' },
  };
  const c = palette[t] ?? palette.custom;
  const label = group.tag ? `[${group.tag}] ${group.name}` : group.name;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] tracking-wider uppercase border ${c.chip}`}
      >
        {t}
      </span>
      <span className={`text-[13px] font-medium truncate ${c.text}`}>{label}</span>
    </span>
  );
}

/** Translation packs for the two relative-time helpers. Kept inline so
    they don't bloat the global i18n dictionary with twenty near-identical
    keys. */
const RELATIVE_PAST = {
  en: { s: 's ago', m: 'm ago', h: 'h ago', d: 'd ago', mo: 'mo ago' },
  ru: { s: 'с назад', m: 'м назад', h: 'ч назад', d: 'д назад', mo: 'мес назад' },
} as const;

const RELATIVE_FUTURE = {
  en: {
    lt1: 'today', s: 'in {n}s', m: 'in {n}m', h: 'in {n}h',
    hm: 'in {h}h {m}m', d: 'in {n}d', dh: 'in {d}d {h}h',
    mo: 'in {n}mo', past: 'expired',
  },
  ru: {
    lt1: 'сегодня', s: 'через {n}с', m: 'через {n}м', h: 'через {n}ч',
    hm: 'через {h}ч {m}м', d: 'через {n}д', dh: 'через {d}д {h}ч',
    mo: 'через {n}мес', past: 'истёк',
  },
} as const;

type Loc = 'en' | 'ru';

function relativeTime(iso: string, loc: Loc): string {
  const dict = RELATIVE_PAST[loc];
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}${dict.s}`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}${dict.m}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}${dict.h}`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}${dict.d}`;
  const months = Math.floor(days / 30);
  return `${months}${dict.mo}`;
}

/**
 * Future-relative time with the precision admins actually care about:
 *   < 1 min     → "today" / "сегодня"
 *   < 1 hour    → "in 35m"
 *   < 24 hours  → "in 3h 25m"   (combo — gives a usable hint at end-of-day)
 *   < 3 days    → "in 2d 5h"    (still actionable for short-term VIPs)
 *   < 30 days   → "in 14d"
 *   else        → "in 2mo"
 */
function relativeUntil(iso: string, loc: Loc): string {
  const dict = RELATIVE_FUTURE[loc];
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs < 0) return dict.past;

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return dict.lt1;

  const min = Math.floor(sec / 60);
  if (min < 60) return dict.m.replace('{n}', String(min));

  const totalHr = Math.floor(min / 60);
  const remMin = min % 60;
  if (totalHr < 24) {
    return remMin > 0
      ? dict.hm.replace('{h}', String(totalHr)).replace('{m}', String(remMin))
      : dict.h.replace('{n}', String(totalHr));
  }

  const days = Math.floor(totalHr / 24);
  const remHr = totalHr % 24;
  if (days < 3) {
    return remHr > 0
      ? dict.dh.replace('{d}', String(days)).replace('{h}', String(remHr))
      : dict.d.replace('{n}', String(days));
  }
  if (days < 30) return dict.d.replace('{n}', String(days));

  const months = Math.floor(days / 30);
  return dict.mo.replace('{n}', String(months));
}

/** "12 июн" / "12 Jun" — locale-aware day + short month. */
function shortDate(iso: string | undefined, loc: Loc): string {
  if (!iso) return '—';
  const tag = loc === 'ru' ? 'ru-RU' : 'en-GB';
  return new Date(iso).toLocaleDateString(tag, { day: '2-digit', month: 'short' });
}

export default function Whitelist() {
  const { t, locale } = useI18n();
  const loc: Loc = locale === 'ru' ? 'ru' : 'en';
  const { currentOrgId } = useOrg();
  const [selectedGroup, setSelectedGroup] = useState('');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  const params = new URLSearchParams();
  if (currentOrgId) params.set('orgId', currentOrgId);
  if (selectedGroup) params.set('groupId', selectedGroup);

  const { data: entries, loading, refetch } = useApi<Entry[]>(
    currentOrgId ? `/whitelist?${params.toString()}` : null,
    [currentOrgId, selectedGroup]
  );
  const { data: groups, refetch: refetchGroups } = useApi<Group[]>(
    currentOrgId ? `/groups?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );

  // Re-fetch groups whenever the add-player dialog opens — the user may have
  // created/renamed groups on another tab/page since this view mounted, and
  // the original fetch only fires when `currentOrgId` changes.
  useEffect(() => {
    if (addOpen) refetchGroups();
  }, [addOpen, refetchGroups]);

  // Newest first by default — what the user usually wants to see.
  const sorted = useMemo(() => {
    if (!entries) return entries;
    return [...entries].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [entries]);

  // Memoize — was re-scanning every entry on every keystroke / parent re-render.
  // With ~5k entries the search felt visibly laggy.
  const filtered = useMemo(() => {
    if (!sorted) return sorted;
    if (!search) return sorted;
    const s = search.toLowerCase();
    return sorted.filter(
      (e) =>
        e.playerId?.username?.toLowerCase().includes(s) ||
        e.playerId?.steamId64?.includes(s)
    );
  }, [sorted, search]);

  const handleRemove = async (id: string) => {
    try {
      await api(`/whitelist/${id}`, { method: 'DELETE' });
      toast('success', t('wlPlayerRemoved'));
      refetch();
    } catch (err: any) {
      toast('error', err.message);
    }
  };

  return (
    <>
      <Header
        title={t('wlTitle')}
        subtitle={t('wlSubtitle')}
        actions={
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> {t('wlAddPlayer')}
          </button>
        }
      />

      <div className="mb-5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <Select
          className="sm:w-[260px]"
          value={selectedGroup}
          onChange={setSelectedGroup}
          placeholder={t('wlAllGroups')}
          groups={[
            {
              label: t('wlAllGroups'),
              options: [{ value: '', label: t('wlAllGroups') }],
            },
            {
              label: t('wlClans'),
              options: (groups || [])
                .filter((g) => g.type === 'clan')
                .map((g) => ({ value: g._id, label: `[${g.tag}] ${g.name}` })),
            },
            {
              label: t('wlOtherGroups'),
              options: (groups || [])
                .filter((g) => g.type !== 'clan')
                .map((g) => ({ value: g._id, label: g.name })),
            },
          ]}
        />
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input className="input pl-9" placeholder={t('wlSearchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
        {/* Mobile / tablet — card list. Table below kicks in at lg. */}
        <div className="lg:hidden space-y-2.5 pb-24">
          {filtered?.length === 0 && (
            <div className="card text-center py-10 text-surface-500 text-sm">{t('wlNoEntries')}</div>
          )}
          {filtered?.map((entry) => {
            const initials = (entry.playerId?.username || '??').slice(0, 2).toUpperCase();
            const now = Date.now();
            const exp = entry.expiresAt ? new Date(entry.expiresAt).getTime() : null;
            const isExpired = exp !== null && exp < now;
            const status: 'active' | 'pending' | 'expired' = !entry.approved
              ? 'pending'
              : isExpired
                ? 'expired'
                : 'active';
            return (
              <div key={entry._id} className="card p-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-surface-700 to-surface-800 border border-surface-700/50 grid place-items-center text-[12px] font-mono font-bold text-surface-300 shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] text-surface-100 font-medium truncate">
                          {entry.playerId?.username || '—'}
                        </div>
                        <SteamIdChip steamId={entry.playerId?.steamId64} />
                      </div>
                      <StatusPill kind={status} />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <GroupBadge group={entry.groupId} />
                      <ServersCell group={entry.groupId} allLabel={t('wlAllServers')} />
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
                      <div className="text-surface-500">
                        <span className="uppercase tracking-wider text-[10px]">{t('wlAdded')}: </span>
                        <span className="text-surface-300">{relativeTime(entry.createdAt, loc)}</span>
                      </div>
                      <div className="text-surface-500">
                        <span className="uppercase tracking-wider text-[10px]">{t('wlExpires')}: </span>
                        {entry.expiresAt ? (
                          <span className="text-surface-300">{relativeUntil(entry.expiresAt, loc)}</span>
                        ) : (
                          <span className="text-surface-500">{t('never')}</span>
                        )}
                      </div>
                      {entry.insertedBy?.displayName && (
                        <div className="col-span-2 text-surface-500 truncate">
                          <span className="uppercase tracking-wider text-[10px]">{t('wlAddedBy')}: </span>
                          <span className="text-surface-300">{entry.insertedBy.displayName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(entry._id)}
                    className="rounded-lg p-2 text-surface-500 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
                    aria-label={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {(filtered?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between px-1 pt-1 font-mono text-[11px] text-surface-500">
              <span>{filtered?.length || 0} {t('wlEntriesShown')}</span>
              <span className="flex items-center gap-2 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 spm-node-pulse" />
                {t('wlSyncOk')}
              </span>
            </div>
          )}
        </div>

        {/* Desktop — original table view. */}
        <div className="hidden lg:block card overflow-x-auto p-0">
          <table className="w-full min-w-[940px]">
            <thead>
              <tr className="border-b border-surface-700/50 text-left font-mono text-[11px] uppercase tracking-wider text-surface-500">
                <th className="px-6 py-4 font-medium">{t('wlPlayer')}</th>
                <th className="px-6 py-4 font-medium">{t('wlGroup')}</th>
                <th className="px-6 py-4 font-medium">{t('wlServers')}</th>
                <th className="px-6 py-4 font-medium">{t('wlAddedBy')}</th>
                <th className="px-6 py-4 font-medium">{t('wlAdded')}</th>
                <th className="px-6 py-4 font-medium">{t('wlExpires')}</th>
                {/* Status column header aligns flush-left with the StatusPill
                    below it (also left-anchored), so СТАТУС / STATUS sits
                    directly above the ACTIVE pill rather than at the cell's
                    right edge. */}
                <th className="px-6 py-4 font-medium">{t('wlStatus')}</th>
                <th className="px-6 py-4 font-medium w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/60">
              {filtered?.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-surface-500">{t('wlNoEntries')}</td></tr>
              )}
              {filtered?.map((entry) => {
                const initials = (entry.playerId?.username || '??').slice(0, 2).toUpperCase();
                const now = Date.now();
                const exp = entry.expiresAt ? new Date(entry.expiresAt).getTime() : null;
                const isExpired = exp !== null && exp < now;
                const status: 'active' | 'pending' | 'expired' = !entry.approved
                  ? 'pending'
                  : isExpired
                    ? 'expired'
                    : 'active';
                return (
                  <tr key={entry._id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-surface-700 to-surface-800 border border-surface-700/50 grid place-items-center text-[12px] font-mono font-bold text-surface-300 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[15px] text-surface-100 font-medium truncate">{entry.playerId?.username || '—'}</div>
                          <SteamIdChip steamId={entry.playerId?.steamId64} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <GroupBadge group={entry.groupId} />
                    </td>
                    <td className="px-6 py-4">
                      <ServersCell group={entry.groupId} allLabel={t('wlAllServers')} />
                    </td>
                    <td className="px-6 py-4 text-surface-400 text-[13px] truncate max-w-[180px]">{entry.insertedBy?.displayName || '—'}</td>
                    <td className="px-6 py-4 font-mono text-[12px] text-surface-400">
                      {relativeTime(entry.createdAt, loc)}
                    </td>
                    <td className="px-6 py-4 font-mono text-[12px]">
                      {entry.expiresAt ? (
                        <div className="leading-tight">
                          <div className="text-surface-300">{shortDate(entry.expiresAt, loc)}</div>
                          <div className="text-[11px] text-surface-500 mt-0.5">
                            {relativeUntil(entry.expiresAt, loc)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-surface-500">{t('never')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill kind={status} />
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleRemove(entry._id)} className="rounded-lg p-2 text-surface-500 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Sync status bar — mimics live "synced to N servers" hint. */}
          <div className="flex items-center justify-between px-6 h-12 border-t border-surface-700/40 bg-surface-950/40">
            <div className="font-mono text-[11px] tracking-wider text-surface-500">
              {filtered?.length || 0} {t('wlEntriesShown')} · {t('wlSyncedLabel')}
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 spm-node-pulse" />
              {t('wlSyncOk')}
            </div>
          </div>
        </div>
        </>
      )}

      <AddPlayerModal open={addOpen} onClose={() => setAddOpen(false)} orgId={currentOrgId} groups={groups || []} onSuccess={refetch} />
    </>
  );
}

function AddPlayerModal({ open, onClose, orgId, groups, onSuccess }: {
  open: boolean; onClose: () => void; orgId: string | null; groups: Group[]; onSuccess: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { refresh: refreshPending } = usePendingCount();
  const [form, setForm] = useState({ username: '', steamId64: '', eosId: '', groupId: '' });
  // null = forever (no expiry).
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const update = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  // Reset every field whenever the dialog opens — a cancelled or errored
  // previous attempt shouldn't leak its values into a new add.
  useEffect(() => {
    if (open) {
      setForm({ username: '', steamId64: '', eosId: '', groupId: '' });
      setDurationHours(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) { toast('error', t('noOrgYet')); return; }
    setSubmitting(true);
    try {
      const created = await api<{ approved: boolean }>('/whitelist', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          username: form.username,
          steamId64: form.steamId64 || undefined,
          eosId: form.eosId || undefined,
          groupId: form.groupId,
          durationHours: durationHours ?? undefined,
        }),
      });
      // The entry may have landed in pending — surface that explicitly so the
      // admin doesn't go looking for it in the main whitelist tab.
      toast('success', created.approved ? t('wlPlayerAdded') : t('wlPlayerPending'));
      onSuccess();
      if (!created.approved) refreshPending();
      onClose();
      setForm({ username: '', steamId64: '', eosId: '', groupId: '' });
      setDurationHours(null);
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('wlAddPlayer')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('wlUsername')} *</label>
          <input className="input" value={form.username} onChange={(e) => update('username', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-surface-400">Steam ID64</label>
            <input className="input" value={form.steamId64} onChange={(e) => update('steamId64', e.target.value)} placeholder="76561198..." />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('wlEosId')}</label>
            <input className="input" value={form.eosId} onChange={(e) => update('eosId', e.target.value)} placeholder="0002a..." />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('wlGroup')} *</label>
          <Select
            className="w-full"
            value={form.groupId}
            onChange={(v) => update('groupId', v)}
            placeholder={t('wlSelectGroup')}
            groups={[
              {
                label: t('wlClans'),
                options: groups
                  .filter((g) => g.type === 'clan')
                  .map((g) => ({ value: g._id, label: `[${g.tag}] ${g.name}` })),
              },
              {
                label: t('wlOtherGroups'),
                options: groups
                  .filter((g) => g.type !== 'clan')
                  .map((g) => ({ value: g._id, label: g.name })),
              },
            ]}
          />
        </div>
        <DurationPicker value={durationHours} onChange={setDurationHours} />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t('wlAdding') : t('wlAddPlayer')}</button>
        </div>
      </form>
    </Modal>
  );
}
