import Header from '../components/layout/Header';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import { api } from '../api';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Trash2, Copy } from 'lucide-react';
import Select from '../components/ui/Select';

interface UserItem {
  _id: string; steamId: string; displayName: string; avatar: string;
  role: string; clanId?: { name: string; tag: string }; lastLogin: string; createdAt: string;
}

const ROLES = ['owner', 'admin', 'manager'];

function CopyableSteamId({ steamId }: { steamId: string }) {
  const toast = useToast();
  const onCopy = async () => {
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
      className="group inline-flex items-center gap-1.5 font-mono text-[12px] text-surface-400 hover:text-surface-200 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5 text-surface-600 group-hover:text-accent-400 transition-colors shrink-0">
        <path d="M11.979 0C5.678 0 .511 4.86.022 10.94l6.432 2.658a3.387 3.387 0 0 1 1.912-.587c.063 0 .126.002.188.006l2.861-4.142V8.81a4.53 4.53 0 0 1 4.524-4.524 4.53 4.53 0 0 1 4.524 4.524 4.53 4.53 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.003.105.003.158a3.392 3.392 0 0 1-3.392 3.392 3.396 3.396 0 0 1-3.358-2.935L.142 14.47C1.283 19.957 6.14 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.542 2.542 0 0 0 4.873-.934 2.547 2.547 0 0 0-2.544-2.544c-.164 0-.326.016-.484.047l1.522.63a1.873 1.873 0 0 1-1.422 3.463l-.472-.052zm8.399-5.726a3.024 3.024 0 0 0 3.02-3.02 3.024 3.024 0 0 0-3.02-3.02 3.024 3.024 0 0 0-3.02 3.02 3.024 3.024 0 0 0 3.02 3.02zm-.005-5.286a2.27 2.27 0 1 1 0 4.54 2.27 2.27 0 0 1 0-4.54z" />
      </svg>
      <span>{steamId}</span>
      <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 shrink-0" />
    </button>
  );
}

export default function UsersPage() {
  const { t } = useI18n();
  const { data: users, loading, refetch } = useApi<UserItem[]>('/users');
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const changeRole = async (userId: string, role: string) => {
    try {
      await api(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      toast('success', t('usersRoleUpdated'));
      refetch();
    } catch (err: any) { toast('error', err.message); }
  };

  const deleteUser = async (userId: string) => {
    if (!(await confirm({ message: t('usersDeleteConfirm'), danger: true }))) return;
    try {
      await api(`/users/${userId}`, { method: 'DELETE' });
      toast('success', t('usersDeleted'));
      refetch();
    } catch (err: any) { toast('error', err.message); }
  };

  return (
    <>
      <Header title={t('usersTitle')} subtitle={t('usersSubtitle')} />
      {loading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-surface-700/50 text-left font-mono text-[11px] uppercase tracking-wider text-surface-500">
                <th className="px-6 py-4 font-medium">{t('usersUser')}</th>
                <th className="px-6 py-4 font-medium">{t('wlSteamId')}</th>
                <th className="px-6 py-4 font-medium">{t('usersRole')}</th>
                <th className="px-6 py-4 font-medium">{t('usersClan')}</th>
                <th className="px-6 py-4 font-medium">{t('usersLastLogin')}</th>
                <th className="px-6 py-4 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {users?.map((u) => (
                <tr key={u._id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3.5">
                      <img src={u.avatar} alt="" className="h-10 w-10 rounded-full bg-surface-700" />
                      <span className="text-[15px] font-medium">{u.displayName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <CopyableSteamId steamId={u.steamId} />
                  </td>
                  <td className="px-6 py-4">
                    {u._id === me?._id ? (
                      <span className="badge bg-accent-500/10 text-accent-400 capitalize">{u.role}</span>
                    ) : (
                      <Select
                        className="w-[150px]"
                        value={u.role}
                        onChange={(v) => changeRole(u._id, v)}
                        options={ROLES
                          .filter((r) => me?.role === 'owner' || r !== 'owner')
                          .map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 text-surface-400 text-[13px]">{u.clanId ? `[${u.clanId.tag}] ${u.clanId.name}` : '—'}</td>
                  <td className="px-6 py-4 text-surface-400 text-[12px]">{new Date(u.lastLogin).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {u._id !== me?._id && (
                      <button onClick={() => deleteUser(u._id)} className="rounded-lg p-2 text-surface-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
