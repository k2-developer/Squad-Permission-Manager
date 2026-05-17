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
import { Plus, Edit2, Trash2, Shield, Server as ServerIcon, Globe } from 'lucide-react';
import Checkbox from '../components/ui/Checkbox';
import ServerScopePicker from '../components/ServerScopePicker';
import PermissionsPicker from '../components/PermissionsPicker';

// Backend populates `serverIds` with `{_id, name}` for cheap rendering on
// the cards; older callers and writes use string ids. Accept both.
type ServerRef = string | { _id: string; name?: string };

interface Group {
  _id: string;
  name: string;
  type: 'clan' | 'vip' | 'admin' | 'custom';
  permissions: string[];
  requireApproval: boolean;
  serverScope: 'all' | 'selected';
  serverIds: ServerRef[];
}

function serverRefId(r: ServerRef): string {
  return typeof r === 'string' ? r : r._id;
}
function serverRefName(r: ServerRef): string | undefined {
  return typeof r === 'string' ? undefined : r.name;
}

function ServerScopeSummary({ refs }: { refs: ServerRef[] }) {
  const { t, locale } = useI18n();
  const names = refs.map(serverRefName).filter((n): n is string => !!n);
  const count = refs.length;

  // If we have names (populated by the backend), surface them — much more
  // useful than just "1 серверов". Fall back to a properly pluralized count.
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
      <span>{count} {pluralizeServers(count, locale)}</span>
    </>
  );
}

function pluralizeServers(n: number, locale: string): string {
  if (locale !== 'ru') return n === 1 ? 'server' : 'servers';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сервер';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сервера';
  return 'серверов';
}

export default function Groups() {
  const { t } = useI18n();
  const { currentOrgId } = useOrg();
  const { data: groups, loading, refetch } = useApi<Group[]>(
    currentOrgId ? `/groups?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );
  const toast = useToast();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: t('grpDeleteConfirm'), danger: true }))) return;
    try {
      await api(`/groups/${id}`, { method: 'DELETE' });
      toast('success', t('grpDeleted'));
      refetch();
    } catch (err: any) { toast('error', err.message); }
  };

  return (
    <>
      <Header title={t('grpTitle')} subtitle={t('grpSubtitle')} actions={
        <button className="btn-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> {t('grpNew')}</button>
      } />

      {loading ? <LoadingSpinner /> : groups?.length === 0 ? (
        <div className="card text-center py-16 text-surface-500">
          <Shield size={28} className="mx-auto mb-3 text-surface-600" />
          <p>{t('grpEmpty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
          {groups?.map((group) => (
            <div key={group._id} className="card group/card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"><Shield size={16} /></div>
                  <div>
                    <p className="font-semibold">{group.name}</p>
                    <p className="text-xs text-surface-500">{group.permissions.length} {t('grpPermissions')}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button onClick={() => { setEditGroup(group); setFormOpen(true); }} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(group._id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.permissions.map((p) => <span key={p} className="badge bg-surface-800 text-surface-300 font-mono text-[11px]">{p}</span>)}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-surface-500 font-mono uppercase tracking-wider">
                <span className="flex items-center gap-1.5 min-w-0">
                  {group.serverScope === 'all' ? (
                    <>
                      <Globe size={11} />
                      {t('scopeAll')}
                    </>
                  ) : (
                    <ServerScopeSummary refs={group.serverIds} />
                  )}
                </span>
                {group.requireApproval && <span className="text-amber-400/80 ml-auto">● {t('clansApprovalReq')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <GroupFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditGroup(null); }} group={editGroup} orgId={currentOrgId} onSuccess={refetch} />
    </>
  );
}

function GroupFormModal({ open, onClose, group, orgId, onSuccess }: { open: boolean; onClose: () => void; group: Group | null; orgId: string | null; onSuccess: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(group?.name || '');
  const [permissions, setPermissions] = useState<string[]>(group?.permissions ?? []);
  const [requireApproval, setRequireApproval] = useState(group?.requireApproval || false);
  const [scope, setScope] = useState<'all' | 'selected'>(group?.serverScope ?? 'all');
  const [serverIds, setServerIds] = useState<string[]>(
    (group?.serverIds ?? []).map(serverRefId)
  );
  const [submitting, setSubmitting] = useState(false);

  // Modal is mounted once and reused for create + edit. When `group` switches
  // (e.g. user opens "Edit Server 1" after closing "New group"), reset state
  // from the new prop — otherwise stale defaults like name='' silently submit.
  useEffect(() => {
    setName(group?.name || '');
    setPermissions(group?.permissions ?? []);
    setRequireApproval(group?.requireApproval || false);
    setScope(group?.serverScope ?? 'all');
    // Normalize populated `{_id, name}` server refs to plain string ids so the
    // checkbox picker (which compares against string ids) can match them.
    setServerIds((group?.serverIds ?? []).map(serverRefId));
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const baseBody = {
        name,
        permissions,
        requireApproval,
        serverScope: scope,
        serverIds: scope === 'selected' ? serverIds : [],
      };
      if (group) {
        await api(`/groups/${group._id}`, { method: 'PATCH', body: JSON.stringify(baseBody) });
        toast('success', t('grpUpdated'));
      } else {
        if (!orgId) throw new Error('No organization selected');
        await api('/groups', {
          method: 'POST',
          body: JSON.stringify({ ...baseBody, orgId, type: 'custom' }),
        });
        toast('success', t('grpCreated'));
      }
      onSuccess(); onClose();
    } catch (err: any) { toast('error', err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={group ? t('grpEditGroup') : t('grpNewGroup')}>
      <form key={group?._id || 'new'} onSubmit={handleSubmit} className="space-y-4">
        <div><label className="mb-1.5 block text-xs font-medium text-surface-400">{t('clansName')} *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <PermissionsPicker value={permissions} onChange={setPermissions} />
        <Checkbox
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
          label={t('grpApprovalReq')}
        />
        <ServerScopePicker
          orgId={orgId}
          scope={scope}
          serverIds={serverIds}
          onChange={({ scope: s, serverIds: ids }) => { setScope(s); setServerIds(ids); }}
        />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t('saving') : group ? t('save') : t('create')}</button>
        </div>
      </form>
    </Modal>
  );
}
