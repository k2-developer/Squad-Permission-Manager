import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import { useOrg } from '../context/OrgContext';
import { api } from '../api';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Checkbox from '../components/ui/Checkbox';
import ServerScopePicker from '../components/ServerScopePicker';
import PermissionsPicker from '../components/PermissionsPicker';
import { Plus, Edit2, Trash2, Users, UserCog, Server as ServerIcon, Globe } from 'lucide-react';

/**
 * A clan manager is identified by SteamID — the same SteamID their Steam
 * login will present. `displayName`/`avatar` are resolved server-side from
 * existing User records when available, and `registered: false` means the
 * SteamID has been pre-assigned but the person hasn't logged in yet.
 */
interface Manager {
  steamId: string;
  displayName: string | null;
  avatar: string;
  registered: boolean;
}
// Backend now populates serverIds with `{_id, name}` so cards can show
// names; older callers send plain strings. Accept both at type level.
type ServerRef = string | { _id: string; name?: string };

interface Clan {
  _id: string;
  name: string;
  tag: string;
  permissions: string[];
  playerCount: number;
  playerLimit: number;
  requireApproval: boolean;
  managers: Manager[];
  serverScope: 'all' | 'selected';
  serverIds: ServerRef[];
}

function serverRefId(r: ServerRef): string {
  return typeof r === 'string' ? r : r._id;
}
function serverRefName(r: ServerRef): string | undefined {
  return typeof r === 'string' ? undefined : r.name;
}

function pluralizeServers(n: number, locale: string): string {
  if (locale !== 'ru') return n === 1 ? 'server' : 'servers';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сервер';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сервера';
  return 'серверов';
}

function ServerScopeSummary({ refs }: { refs: ServerRef[] }) {
  const { locale } = useI18n();
  const names = refs.map(serverRefName).filter((n): n is string => !!n);
  if (names.length > 0) {
    const shown = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? ` +${names.length - 3}` : '';
    return (
      <>
        <ServerIcon size={11} className="shrink-0" />
        <span className="truncate normal-case tracking-normal text-surface-400">
          {shown}{more}
        </span>
      </>
    );
  }
  return (
    <>
      <ServerIcon size={11} className="shrink-0" />
      <span>{refs.length} {pluralizeServers(refs.length, locale)}</span>
    </>
  );
}

export default function Clans() {
  const { t } = useI18n();
  const { currentOrgId } = useOrg();
  const { data: clans, loading, refetch } = useApi<Clan[]>(
    currentOrgId ? `/clans?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );
  const toast = useToast();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editClan, setEditClan] = useState<Clan | null>(null);

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: t('clansDeleteConfirm'), danger: true }))) return;
    try {
      await api(`/clans/${id}`, { method: 'DELETE' });
      toast('success', t('clansDeleted'));
      refetch();
    } catch (err: any) { toast('error', err.message); }
  };

  if (!currentOrgId) {
    return (
      <>
        <Header title={t('clansTitle')} subtitle={t('clansSubtitle')} />
        <div className="card text-sm text-surface-400">{t('noOrgYet')}</div>
      </>
    );
  }

  return (
    <>
      <Header
        title={t('clansTitle')}
        subtitle={t('clansSubtitle')}
        actions={
          <button className="btn-primary" onClick={() => { setEditClan(null); setFormOpen(true); }}>
            <Plus size={16} /> {t('clansNew')}
          </button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : clans?.length === 0 ? (
        <div className="card text-center py-16 text-surface-500">{t('clansEmpty')}</div>
      ) : (
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
          {clans?.map((clan) => (
            <div key={clan._id} className="card group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400 font-bold text-sm shrink-0">
                    {clan.tag.slice(0, 3) || '·'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">[{clan.tag}] {clan.name}</p>
                    <p className="text-xs text-surface-500 flex items-center gap-1.5 mt-0.5">
                      <Users size={12} />
                      {clan.playerCount}/{clan.playerLimit}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditClan(clan); setFormOpen(true); }} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(clan._id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {clan.permissions.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {clan.permissions.map((p) => (
                    <span key={p} className="badge bg-surface-800 text-surface-300 font-mono text-[10px]">{p}</span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 border-t border-surface-700/40 text-[11px] text-surface-500 font-mono uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <UserCog size={11} />
                  {clan.managers?.length || 0} {t('clansManagers')}
                </span>
                <span className="flex items-center gap-1.5 min-w-0">
                  {clan.serverScope === 'all' ? (
                    <>
                      <Globe size={11} />
                      {t('scopeAll')}
                    </>
                  ) : (
                    <ServerScopeSummary refs={clan.serverIds} />
                  )}
                </span>
                {clan.requireApproval && <span className="text-amber-400/80 ml-auto">● {t('clansApprovalReq')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ClanFormModal
        open={formOpen || !!editClan}
        onClose={() => { setFormOpen(false); setEditClan(null); }}
        clan={editClan}
        orgId={currentOrgId}
        onSuccess={refetch}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function ClanFormModal({ open, onClose, clan, orgId, onSuccess }: {
  open: boolean; onClose: () => void; clan: Clan | null; orgId: string | null; onSuccess: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  // SteamID-based managers — pasted/typed as a newline- or comma-separated list.
  const [managerInput, setManagerInput] = useState(
    clan?.managers?.map((m) => m.steamId).join('\n') ?? ''
  );
  const [scope, setScope] = useState<'all' | 'selected'>(clan?.serverScope ?? 'all');
  const [serverIds, setServerIds] = useState<string[]>(
    (clan?.serverIds ?? []).map(serverRefId)
  );
  const [permissions, setPermissions] = useState<string[]>(clan?.permissions ?? ['reserve']);

  // Modal is mounted once and reused — sync state when `clan` prop changes
  // (edit different clan, switch from "new" to edit, etc.).
  useEffect(() => {
    setManagerInput(clan?.managers?.map((m) => m.steamId).join('\n') ?? '');
    setScope(clan?.serverScope ?? 'all');
    setServerIds((clan?.serverIds ?? []).map(serverRefId));
    setPermissions(clan?.permissions ?? ['reserve']);
  }, [clan]);

  // Parse the textarea into clean SteamID list (each line/comma → one id).
  const parsedManagerIds = managerInput
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const validManagerIds = parsedManagerIds.filter((s) => /^\d{17}$/.test(s));
  const invalidManagerIds = parsedManagerIds.filter((s) => !/^\d{17}$/.test(s));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalidManagerIds.length > 0) {
      toast('error', t('clansLeadersBadSteamId'));
      return;
    }
    setSubmitting(true);
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const body: any = {
        name: fd.get('name'),
        tag: fd.get('tag'),
        playerLimit: parseInt(fd.get('playerLimit') as string) || 50,
        requireApproval: fd.get('requireApproval') === 'on',
        permissions,
        managers: validManagerIds,
        serverScope: scope,
        serverIds: scope === 'selected' ? serverIds : [],
      };
      if (clan) {
        await api(`/clans/${clan._id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast('success', t('clansUpdated'));
      } else {
        if (!orgId) throw new Error('No organization');
        body.orgId = orgId;
        await api('/clans', { method: 'POST', body: JSON.stringify(body) });
        toast('success', t('clansCreated'));
      }
      onSuccess(); onClose();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={clan ? t('clansEditClan') : t('clansNewClan')} wide>
      <form key={clan?._id || 'new'} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('clansName')} *</label>
            <input name="name" className="input" defaultValue={clan?.name || ''} required maxLength={64} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('clansTag')} *</label>
            <input name="tag" className="input" defaultValue={clan?.tag || ''} maxLength={10} required />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('clansSlotLimit')}</label>
          <input name="playerLimit" type="number" className="input max-w-[140px]" defaultValue={clan?.playerLimit || 50} min={1} max={100000} />
          <p className="mt-1 text-xs text-surface-500">{t('clansSlotLimitHint')}</p>
        </div>

        <PermissionsPicker value={permissions} onChange={setPermissions} />

        <Checkbox
          name="requireApproval"
          defaultChecked={clan?.requireApproval ?? false}
          label={t('clansRequireApproval')}
        />

        <ServerScopePicker
          orgId={orgId}
          scope={scope}
          serverIds={serverIds}
          onChange={({ scope: s, serverIds: ids }) => { setScope(s); setServerIds(ids); }}
        />

        {/* Clan leaders — SteamID-based. The leader doesn't need a panel
            account yet; their next Steam login matches this list. */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            {t('clansLeadersLabel')}
          </label>
          <p className="text-xs text-surface-500 mb-2">{t('clansLeadersHint')}</p>
          <textarea
            value={managerInput}
            onChange={(e) => setManagerInput(e.target.value)}
            placeholder={'76561198000000001\n76561198000000002'}
            className="input min-h-[80px] resize-y font-mono text-xs"
          />

          {/* Live preview: resolved names for already-registered managers,
              "not registered yet" for fresh SteamIDs, errors for malformed. */}
          {(clan?.managers && clan.managers.length > 0) || validManagerIds.length > 0 || invalidManagerIds.length > 0 ? (
            <div className="mt-2 space-y-1">
              {validManagerIds.map((sid) => {
                const existing = clan?.managers.find((m) => m.steamId === sid);
                const isRegistered = existing?.registered;
                return (
                  <div key={sid} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-surface-900/40">
                    <span className="font-mono text-surface-400">{sid}</span>
                    {isRegistered ? (
                      <>
                        {existing!.avatar && <img src={existing!.avatar} alt="" className="w-4 h-4 rounded-full" />}
                        <span className="text-surface-200 truncate flex-1">{existing!.displayName}</span>
                      </>
                    ) : (
                      <span className="text-surface-500 italic flex-1">{t('clansLeadersNotRegistered')}</span>
                    )}
                  </div>
                );
              })}
              {invalidManagerIds.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-red-500/10">
                  <span className="font-mono text-red-300">{s}</span>
                  <span className="text-red-400">{t('clansLeadersBadSteamId')}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('saving') : clan ? t('save') : t('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
