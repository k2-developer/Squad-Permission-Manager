import Header from '../components/layout/Header';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import { useOrg } from '../context/OrgContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Shield, Layers, Clock, ServerIcon } from 'lucide-react';
import type { TranslationKey } from '../i18n';

interface Stats {
  serverCount: number;
  groupCount: number;
  entryCount: number;
  pendingCount: number;
}

export default function Dashboard() {
  const { t } = useI18n();
  const { currentOrgId, loading: orgLoading } = useOrg();
  const { data: stats, loading } = useApi<Stats>(
    currentOrgId ? `/config/stats?orgId=${currentOrgId}` : null,
    [currentOrgId]
  );

  if (orgLoading || loading) return <LoadingSpinner />;

  if (!currentOrgId) {
    return (
      <>
        <Header title={t('dashTitle')} subtitle={t('dashSubtitle')} />
        <div className="card text-sm text-surface-400">
          {t('noOrgYet')}
        </div>
      </>
    );
  }

  const cards: { labelKey: TranslationKey; value: number; icon: any; color: string }[] = [
    { labelKey: 'statWhitelisted', value: stats?.entryCount ?? 0, icon: Shield, color: 'text-emerald-400' },
    { labelKey: 'statServers', value: stats?.serverCount ?? 0, icon: ServerIcon, color: 'text-blue-400' },
    { labelKey: 'statGroups', value: stats?.groupCount ?? 0, icon: Layers, color: 'text-amber-400' },
    { labelKey: 'statPending', value: stats?.pendingCount ?? 0, icon: Clock, color: 'text-orange-400' },
  ];

  return (
    <>
      <Header title={t('dashTitle')} subtitle={t('dashSubtitle')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.labelKey} className="card">
            <div className="flex items-center justify-between">
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="mt-4 text-3xl font-bold">{card.value}</p>
            <p className="mt-1 text-sm text-surface-400">{t(card.labelKey)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
