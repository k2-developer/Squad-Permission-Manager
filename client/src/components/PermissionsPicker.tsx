import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useI18n, type TranslationKey } from '../i18n';
import Checkbox from './ui/Checkbox';

interface SquadPermission {
  key: string;
  descKey: TranslationKey;
  unused?: boolean;
}

interface PermGroup {
  titleKey: TranslationKey;
  perms: SquadPermission[];
}

const GROUPS: PermGroup[] = [
  {
    titleKey: 'permGroupAccess',
    perms: [{ key: 'reserve', descKey: 'permDescReserve' }],
  },
  {
    titleKey: 'permGroupModeration',
    perms: [
      { key: 'kick', descKey: 'permDescKick' },
      { key: 'ban', descKey: 'permDescBan' },
      { key: 'immune', descKey: 'permDescImmune' },
      { key: 'chat', descKey: 'permDescChat' },
      { key: 'canseeadminchat', descKey: 'permDescCanseeadminchat' },
    ],
  },
  {
    titleKey: 'permGroupServer',
    perms: [
      { key: 'changemap', descKey: 'permDescChangemap' },
      { key: 'pause', descKey: 'permDescPause' },
      { key: 'private', descKey: 'permDescPrivate' },
      { key: 'config', descKey: 'permDescConfig' },
      { key: 'manageserver', descKey: 'permDescManageserver' },
      { key: 'balance', descKey: 'permDescBalance' },
      { key: 'cheat', descKey: 'permDescCheat' },
    ],
  },
  {
    titleKey: 'permGroupSpectate',
    perms: [
      { key: 'cameraman', descKey: 'permDescCameraman' },
      { key: 'demos', descKey: 'permDescDemos' },
      { key: 'clientdemos', descKey: 'permDescClientdemos' },
      { key: 'debug', descKey: 'permDescDebug' },
    ],
  },
  {
    titleKey: 'permGroupTeam',
    perms: [
      { key: 'teamchange', descKey: 'permDescTeamchange' },
      { key: 'forceteamchange', descKey: 'permDescForceteamchange' },
    ],
  },
  {
    titleKey: 'permGroupOther',
    perms: [
      { key: 'featuretest', descKey: 'permDescFeaturetest' },
      { key: 'startvote', descKey: 'permDescStartvote', unused: true },
    ],
  },
];

const KNOWN_KEYS: Set<string> = new Set(GROUPS.flatMap((g) => g.perms.map((p) => p.key)));
const ALL_KNOWN: string[] = [...KNOWN_KEYS];

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function PermissionsPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const selected = useMemo(() => new Set(value), [value]);

  // Preserve any permissions that aren't in the known list (e.g. saved before
  // this picker existed) so editing a group doesn't silently strip them.
  const customSelected = useMemo(
    () => value.filter((p) => !KNOWN_KEYS.has(p)),
    [value]
  );

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange([...next]);
  };

  const selectAll = () => onChange([...new Set([...ALL_KNOWN, ...customSelected])]);
  const clearAll = () => onChange(customSelected);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-medium text-surface-400">
          {t('grpPermsList')}
        </label>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-surface-500">
            {t('grpPermsSelected').replace('{n}', String(selected.size))}
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-accent-400 hover:text-accent-300"
          >
            {t('grpPermsSelectAll')}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-surface-400 hover:text-surface-200"
          >
            {t('grpPermsClear')}
          </button>
        </div>
      </div>

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 rounded-lg border border-surface-700 bg-surface-900/40 p-2">
          {value.map((key) => {
            const known = KNOWN_KEYS.has(key);
            return (
              <span
                key={key}
                className={
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] ' +
                  (known
                    ? 'bg-accent-500/10 text-accent-300'
                    : 'bg-amber-500/10 text-amber-300')
                }
              >
                {key}
                <button
                  type="button"
                  onClick={() => toggle(key, false)}
                  className="text-current/70 hover:text-current"
                  aria-label={`Remove ${key}`}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="max-h-[340px] overflow-y-auto rounded-lg border border-surface-700 bg-surface-900/40 p-3 space-y-4">
        {GROUPS.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              {t(group.titleKey)}
            </p>
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {group.perms.map((perm) => {
                const checked = selected.has(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={
                      'flex items-start gap-2.5 rounded-md px-1.5 py-1 cursor-pointer select-none ' +
                      'hover:bg-surface-800/60 ' +
                      (perm.unused ? 'opacity-60' : '')
                    }
                  >
                    <Checkbox
                      size="sm"
                      checked={checked}
                      onChange={(e) => toggle(perm.key, e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] text-surface-100">
                        {perm.key}
                      </span>
                      <span className="block text-[11px] leading-snug text-surface-500">
                        {t(perm.descKey)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {customSelected.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-500/80">
              {t('permGroupCustom')}
            </p>
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {customSelected.map((key) => (
                <label
                  key={key}
                  className="flex items-start gap-2.5 rounded-md px-1.5 py-1 cursor-pointer select-none hover:bg-surface-800/60"
                >
                  <Checkbox
                    size="sm"
                    checked
                    onChange={(e) => toggle(key, e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[12px] text-amber-300/90">
                      {key}
                    </span>
                    <span className="block text-[11px] leading-snug text-surface-500">
                      {t('permDescCustom')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
