import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import Checkbox from './ui/Checkbox';
import { Server as ServerIcon } from 'lucide-react';

interface ServerItem {
  _id: string;
  name: string;
  address: string;
}

interface Props {
  /** Org whose servers to list — null while still loading. */
  orgId: string | null;
  /** Current scope value. */
  scope: 'all' | 'selected';
  /** Selected server ids when scope === 'selected'. */
  serverIds: string[];
  onChange: (next: { scope: 'all' | 'selected'; serverIds: string[] }) => void;
}

/**
 * Form section for picking which Squad servers a clan or group applies to.
 * - "All servers" — selected by default; clan-managers don't need to think
 *   about server topology at all.
 * - "Selected servers" — reveals a checkbox list of the org's servers. The
 *   group is invisible to (and excluded from the INI output of) any server
 *   not checked.
 *
 * Mirrors the data model exactly: `serverScope` + `serverIds[]` on Group.
 */
export default function ServerScopePicker({ orgId, scope, serverIds, onChange }: Props) {
  const { t } = useI18n();
  const { data: servers } = useApi<ServerItem[]>(
    orgId ? `/servers?orgId=${orgId}` : null,
    [orgId]
  );

  const toggleId = (id: string) => {
    const next = serverIds.includes(id)
      ? serverIds.filter((x) => x !== id)
      : [...serverIds, id];
    onChange({ scope: 'selected', serverIds: next });
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-surface-400">
        {t('scopeLabel')}
      </label>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <button
          type="button"
          onClick={() => onChange({ scope: 'all', serverIds: [] })}
          className={
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors flex-1 ' +
            (scope === 'all'
              ? 'border-accent-500/50 bg-accent-500/10 text-accent-300'
              : 'border-surface-700/50 bg-surface-900/50 text-surface-300 hover:bg-surface-800/50')
          }
        >
          <span
            className={
              'h-2 w-2 rounded-full ' + (scope === 'all' ? 'bg-accent-400' : 'bg-surface-600')
            }
          />
          <span className="font-medium">{t('scopeAll')}</span>
          <span className="text-xs text-surface-500 ml-auto">{servers?.length ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onChange({
              scope: 'selected',
              serverIds: serverIds.length > 0 ? serverIds : [],
            })
          }
          className={
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors flex-1 ' +
            (scope === 'selected'
              ? 'border-accent-500/50 bg-accent-500/10 text-accent-300'
              : 'border-surface-700/50 bg-surface-900/50 text-surface-300 hover:bg-surface-800/50')
          }
        >
          <span
            className={
              'h-2 w-2 rounded-full ' + (scope === 'selected' ? 'bg-accent-400' : 'bg-surface-600')
            }
          />
          <span className="font-medium">{t('scopeSelected')}</span>
          {scope === 'selected' && (
            <span className="text-xs text-surface-500 ml-auto">{serverIds.length}</span>
          )}
        </button>
      </div>

      {scope === 'selected' && (
        <div className="rounded-lg border border-surface-700/50 bg-surface-900/50 p-3 space-y-1.5">
          {!servers && <p className="text-xs text-surface-500">…</p>}
          {servers && servers.length === 0 && (
            <p className="text-xs text-surface-500 px-1">{t('scopeNoServers')}</p>
          )}
          {servers?.map((s) => (
            <label
              key={s._id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-surface-800/40 cursor-pointer"
            >
              <Checkbox checked={serverIds.includes(s._id)} onChange={() => toggleId(s._id)} />
              <ServerIcon size={13} className="text-surface-500" />
              <span className="text-sm flex-1 truncate">{s.name}</span>
              <span className="font-mono text-[10px] text-surface-500 truncate">{s.address || '—'}</span>
            </label>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-surface-500">{t('scopeHint')}</p>
    </div>
  );
}
