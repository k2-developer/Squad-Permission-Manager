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
import { Plus, Trash2, Copy, AlertTriangle, KeyRound } from 'lucide-react';
import Checkbox from '../components/ui/Checkbox';

interface ApiKeyItem {
  _id: string;
  name: string;
  prefix: string;
  permissions: string[];
  createdBy?: { displayName: string };
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface CreatedKey {
  _id: string;
  name: string;
  prefix: string;
  permissions: string[];
  expiresAt: string | null;
  createdAt: string;
  key: string;
}

export default function ApiKeysPage() {
  const { t } = useI18n();
  const { currentOrgId } = useOrg();
  const toast = useToast();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);

  const { data: keys, loading, refetch } = useApi<ApiKeyItem[]>(
    currentOrgId ? `/api-keys?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );

  const revoke = async (id: string) => {
    if (!(await confirm({ message: t('apiRevokeConfirm'), danger: true }))) return;
    try {
      await api(`/api-keys/${id}`, { method: 'DELETE' });
      toast('success', t('apiRevoked'));
      refetch();
    } catch (err: any) {
      toast('error', err.message);
    }
  };

  if (!currentOrgId) {
    return (
      <>
        <Header title={t('apiTitle')} subtitle={t('apiSubtitle')} />
        <div className="card text-sm text-surface-400">{t('noOrgYet')}</div>
      </>
    );
  }

  return (
    <>
      <Header
        title={t('apiTitle')}
        subtitle={t('apiSubtitle')}
        actions={
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> {t('apiCreate')}
          </button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : keys?.length === 0 ? (
        <div className="card text-center py-16 text-surface-500">
          <KeyRound size={28} className="mx-auto mb-3 text-surface-600" />
          <p>{t('apiEmpty')}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-surface-700/50 text-left text-xs uppercase text-surface-500">
                <th className="px-5 py-3 font-medium">{t('apiName')}</th>
                <th className="px-5 py-3 font-medium">{t('apiPrefix')}</th>
                <th className="px-5 py-3 font-medium">{t('apiScopes')}</th>
                <th className="px-5 py-3 font-medium">{t('apiLastUsed')}</th>
                <th className="px-5 py-3 font-medium">{t('apiExpires')}</th>
                <th className="px-5 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {keys?.map((k) => {
                const isRevoked = !!k.revokedAt;
                const isExpired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
                return (
                  <tr key={k._id} className={`hover:bg-surface-800/50 transition-colors ${isRevoked || isExpired ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 font-medium">
                      {k.name}
                      {isRevoked && <span className="ml-2 badge bg-red-500/10 text-red-400">{t('apiRevokedBadge')}</span>}
                      {!isRevoked && isExpired && <span className="ml-2 badge bg-amber-500/10 text-amber-400">{t('apiExpiredBadge')}</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-surface-400">{k.prefix}…</td>
                    <td className="px-5 py-3 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {k.permissions.map((p) => (
                          <span key={p} className="badge bg-surface-800 text-surface-300 font-mono text-[10px]">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-surface-400 text-xs">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-surface-400 text-xs">
                      {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : t('never')}
                    </td>
                    <td className="px-5 py-3">
                      {!isRevoked && (
                        <button
                          onClick={() => revoke(k._id)}
                          className="rounded-lg p-1.5 text-surface-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          title={t('apiRevoke')}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        orgId={currentOrgId}
        onSuccess={(k) => { setFormOpen(false); setCreatedKey(k); refetch(); }}
      />

      {createdKey && (
        <RevealModal createdKey={createdKey} onClose={() => setCreatedKey(null)} />
      )}
    </>
  );
}

const ALL_PERMS = [
  'whitelist:read',
  'whitelist:write',
  'whitelist:approve',
  'players:read',
  'groups:read',
  'servers:read',
];

function CreateModal({ open, onClose, orgId, onSuccess }: {
  open: boolean; onClose: () => void; orgId: string;
  onSuccess: (k: CreatedKey) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<string[]>(['whitelist:read']);
  const [expiresIn, setExpiresIn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal stays mounted across opens — reset to defaults whenever it opens
  // so a cancelled or errored previous attempt doesn't leak into the next.
  useEffect(() => {
    if (open) {
      setName('');
      setPerms(['whitelist:read']);
      setExpiresIn('');
    }
  }, [open]);

  const toggle = (p: string) => setPerms((prev) =>
    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast('error', t('apiNameRequired')); return; }
    if (perms.length === 0) { toast('error', t('apiOnePermissionRequired')); return; }
    setSubmitting(true);
    try {
      const body: any = { orgId, name: name.trim(), permissions: perms };
      if (expiresIn) {
        const days = parseInt(expiresIn);
        if (Number.isFinite(days) && days > 0) body.expiresInDays = days;
      }
      const created = await api<CreatedKey>('/api-keys', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onSuccess(created);
      setName(''); setPerms(['whitelist:read']); setExpiresIn('');
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('apiCreate')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('apiName')} *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          <p className="mt-1 text-xs text-surface-500">{t('apiNameHint')}</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('apiScopes')} *</label>
          <div className="flex flex-col gap-2 rounded-lg border border-surface-700/50 bg-surface-900/50 p-3">
            {ALL_PERMS.map((p) => (
              <Checkbox
                key={p}
                size="sm"
                checked={perms.includes(p)}
                onChange={() => toggle(p)}
                wrapperClassName="w-full"
                label={<span className="font-mono text-xs leading-none">{p}</span>}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('apiExpiresInDays')}</label>
          <input
            type="number"
            className="input max-w-[220px]"
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            min={1}
            max={3650}
            placeholder={t('apiExpiresPlaceholder')}
          />
          <p className="mt-1 text-xs text-surface-500">{t('apiExpiresHint')}</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('saving') : t('apiCreate')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RevealModal({ createdKey, onClose }: { createdKey: CreatedKey; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(createdKey.key);
      toast('success', t('apiCopied'));
    } catch {
      toast('error', t('apiCopyFailed'));
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t('apiCreatedTitle')}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold mb-1">{t('apiSaveNow')}</p>
            <p className="text-xs text-amber-300/80">{t('apiSaveNowDesc')}</p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('apiYourKey')}</label>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={createdKey.key}
              className="input flex-1 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button onClick={copy} className="btn-secondary px-3" title={t('apiCopy')}>
              <Copy size={15} />
            </button>
          </div>
        </div>

        <div className="text-xs text-surface-500 space-y-1">
          <p><span className="text-surface-400">{t('apiName')}:</span> {createdKey.name}</p>
          <p><span className="text-surface-400">{t('apiScopes')}:</span> <span className="font-mono">{createdKey.permissions.join(', ')}</span></p>
          {createdKey.expiresAt && (
            <p><span className="text-surface-400">{t('apiExpires')}:</span> {new Date(createdKey.expiresAt).toLocaleDateString()}</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-primary">{t('apiDone')}</button>
        </div>
      </div>
    </Modal>
  );
}
