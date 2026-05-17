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
import { Plus, Edit2, Trash2, Copy, RefreshCcw, Server as ServerIcon, FileCode } from 'lucide-react';
import Checkbox from '../components/ui/Checkbox';
import OutputPreviewModal from '../components/OutputPreviewModal';

interface ServerItem {
  _id: string;
  name: string;
  address: string;
  slug: string;
  secretToken: string;
  cacheTtl: number;
  preferEosId: boolean;
  createdAt: string;
}

function buildOutputUrl(s: Pick<ServerItem, 'slug' | 'secretToken'>): string {
  const prefix = `${window.location.origin}/output`;
  return s.slug ? `${prefix}/${s.slug}/${s.secretToken}` : `${prefix}/${s.secretToken}`;
}

function shortOutputUrl(s: Pick<ServerItem, 'slug' | 'secretToken'>): string {
  const prefix = `${window.location.origin}/output`;
  const tail = `${s.secretToken.slice(0, 8)}…`;
  return s.slug ? `${prefix}/${s.slug}/${tail}` : `${prefix}/${tail}`;
}

// Same rules as backend `slugify` — lowercase, [a-z0-9-], cyrillic
// transliterated, max 32 chars. Kept in sync so the live preview in the
// form matches what the server will actually store.
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export default function Servers() {
  const { t } = useI18n();
  const { currentOrgId } = useOrg();
  const toast = useToast();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState<ServerItem | null>(null);
  const [previewServer, setPreviewServer] = useState<ServerItem | null>(null);

  const { data: servers, loading, refetch } = useApi<ServerItem[]>(
    currentOrgId ? `/servers?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );

  const remove = async (id: string) => {
    if (!(await confirm({ message: t('srvDeleteConfirm'), danger: true }))) return;
    try {
      await api(`/servers/${id}`, { method: 'DELETE' });
      toast('success', t('srvDeleted'));
      refetch();
    } catch (err: any) { toast('error', err.message); }
  };

  const regenerate = async (id: string) => {
    if (!(await confirm({ message: t('srvRegenerateConfirm'), danger: true }))) return;
    try {
      await api(`/servers/${id}/regenerate-token`, { method: 'POST' });
      toast('success', t('srvRegenerated'));
      refetch();
    } catch (err: any) { toast('error', err.message); }
  };

  const copyUrl = async (s: ServerItem) => {
    try {
      await navigator.clipboard.writeText(buildOutputUrl(s));
      toast('success', t('srvUrlCopied'));
    } catch { toast('error', t('apiCopyFailed')); }
  };

  if (!currentOrgId) {
    return (
      <>
        <Header title={t('srvTitle')} subtitle={t('srvSubtitle')} />
        <div className="card text-sm text-surface-400">{t('noOrgYet')}</div>
      </>
    );
  }

  return (
    <>
      <Header
        title={t('srvTitle')}
        subtitle={t('srvSubtitle')}
        actions={
          <button className="btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}>
            <Plus size={16} /> {t('srvNew')}
          </button>
        }
      />

      {loading ? <LoadingSpinner /> : servers?.length === 0 ? (
        <div className="card text-center py-16 text-surface-500">
          <ServerIcon size={28} className="mx-auto mb-3 text-surface-600" />
          <p>{t('srvEmpty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
          {servers?.map((s) => (
            <div key={s._id} className="card group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <ServerIcon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEdit(s); setFormOpen(true); }} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => remove(s._id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-surface-500 mb-1 block">{t('srvOutputUrl')}</label>
                  <div className="flex items-stretch gap-1.5">
                    <code className="flex-1 truncate rounded-lg bg-surface-900 px-2 py-1.5 font-mono text-[10px] text-surface-400">
                      {shortOutputUrl(s)}
                    </code>
                    <button
                      onClick={() => setPreviewServer(s)}
                      className="rounded-lg bg-surface-800 px-2 text-accent-400 hover:bg-accent-500/10"
                      title={t('srvIniPreview')}
                    >
                      <FileCode size={12} />
                    </button>
                    <button
                      onClick={() => copyUrl(s)}
                      className="rounded-lg bg-surface-800 px-2 hover:bg-surface-700"
                      title={t('srvCopyUrl')}
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => regenerate(s._id)}
                      className="rounded-lg bg-surface-800 px-2 text-amber-400 hover:bg-amber-500/10"
                      title={t('srvRegenerate')}
                    >
                      <RefreshCcw size={12} />
                    </button>
                  </div>
                </div>

                {s.preferEosId && (
                  <div className="flex justify-end pt-1">
                    <span className="badge bg-surface-800 text-surface-400 font-mono text-[10px]">EOS ID</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServerFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEdit(null); }}
        server={edit}
        orgId={currentOrgId}
        onSuccess={refetch}
      />

      <OutputPreviewModal
        open={!!previewServer}
        onClose={() => setPreviewServer(null)}
        url={previewServer ? buildOutputUrl(previewServer) : ''}
        serverName={previewServer?.name || ''}
      />
    </>
  );
}

function ServerFormModal({ open, onClose, server, orgId, onSuccess }: {
  open: boolean; onClose: () => void; server: ServerItem | null; orgId: string;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(server?.name ?? '');
  const [slug, setSlug] = useState(server?.slug ?? '');
  // Track whether the user has manually touched the slug field. If they
  // haven't, the slug auto-mirrors the name; once they edit it, we stop
  // overwriting their value.
  const [slugTouched, setSlugTouched] = useState(!!server?.slug);

  // Reset state when the modal switches between create / edit / different
  // server — same reason as Groups.tsx (modal is mounted once and reused).
  useEffect(() => {
    setName(server?.name ?? '');
    setSlug(server?.slug ?? '');
    setSlugTouched(!!server?.slug);
  }, [server]);

  const onNameChange = (v: string) => {
    setName(v);
    // Clearing the name field re-arms slug auto-gen — otherwise the slug
    // gets stuck at the old value while the user is rewriting the name.
    if (v.trim() === '') {
      setSlugTouched(false);
      setSlug('');
      return;
    }
    if (!slugTouched) setSlug(slugifyName(v));
  };
  const onSlugChange = (v: string) => {
    setSlug(slugifyName(v));
    setSlugTouched(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const body: Record<string, unknown> = {
        orgId,
        name,
        // address + cacheTtl are no longer exposed in the form. Address is
        // a pure-cosmetic label and cacheTtl is a power-user knob the
        // default value of 60s already handles for 99% of installs.
        preferEosId: fd.get('preferEosId') === 'on',
        slug,
      };
      if (server) {
        await api(`/servers/${server._id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast('success', t('srvUpdated'));
      } else {
        await api('/servers', { method: 'POST', body: JSON.stringify(body) });
        toast('success', t('srvCreated'));
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('error', err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={server ? t('srvEdit') : t('srvNew')}>
      <form key={server?._id || 'new'} onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('srvName')} *</label>
          <input
            name="name"
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            maxLength={100}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">{t('srvSlug')}</label>
          <input
            name="slug"
            className="input font-mono text-xs"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder={t('srvSlugPlaceholder')}
            maxLength={32}
          />
          <p className="mt-1 text-xs text-surface-500">{t('srvSlugHint')}</p>
        </div>
        <div>
          <Checkbox
            name="preferEosId"
            defaultChecked={server?.preferEosId || false}
            label={t('srvPreferEos')}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('saving') : server ? t('save') : t('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
