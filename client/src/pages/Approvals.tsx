import Header from '../components/layout/Header';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import { useOrg } from '../context/OrgContext';
import { usePendingCount } from '../context/PendingCountContext';
import { api } from '../api';
import { useToast } from '../components/ui/Toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Check, X } from 'lucide-react';

interface PendingEntry {
  _id: string;
  playerId: { username: string; steamId64: string; eosId: string };
  groupId: { name: string; tag?: string; type?: 'clan' | 'vip' | 'admin' | 'custom' };
  insertedBy: { displayName: string };
  createdAt: string;
}

export default function Approvals() {
  const { t } = useI18n();
  const { currentOrgId } = useOrg();
  const { data: pending, loading, refetch } = useApi<PendingEntry[]>(
    currentOrgId ? `/whitelist/pending?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );
  const toast = useToast();
  const { refresh: refreshPending } = usePendingCount();

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api(`/whitelist/${id}/${action}`, { method: 'PATCH' });
      toast('success', action === 'approve' ? t('apprApproved') : t('apprRejected'));
      refetch();
      refreshPending();
    } catch (err: any) {
      toast('error', err.message);
    }
  };

  return (
    <>
      <Header title={t('apprTitle')} subtitle={`${pending?.length || 0} ${t('apprPending')}`} />

      {loading ? (
        <LoadingSpinner />
      ) : pending?.length === 0 ? (
        <div className="card text-center py-16 text-surface-500">{t('apprNone')}</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
          {pending?.map((entry) => (
            <div key={entry._id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold truncate">{entry.playerId?.username}</p>
                  <p className="text-[12px] font-mono text-surface-500 mt-1 truncate">
                    {entry.playerId?.steamId64 || entry.playerId?.eosId}
                  </p>
                </div>
                <span className="badge bg-amber-500/10 text-amber-400 shrink-0">PENDING</span>
              </div>
              <div className="space-y-2 text-[14px] text-surface-400 mb-5">
                <p>{t('wlGroup')}: <span className="text-surface-200">
                  {entry.groupId?.tag ? `[${entry.groupId.tag}] ` : ''}{entry.groupId?.name}
                </span></p>
                <p>{t('wlAddedBy')}: <span className="text-surface-200">{entry.insertedBy?.displayName}</span></p>
                <p>{t('apprDate')}: <span className="text-surface-200">{new Date(entry.createdAt).toLocaleString()}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(entry._id, 'approve')} className="btn-success flex-1"><Check size={16} /> {t('apprApprove')}</button>
                <button onClick={() => handleAction(entry._id, 'reject')} className="btn-danger flex-1"><X size={16} /> {t('apprReject')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
