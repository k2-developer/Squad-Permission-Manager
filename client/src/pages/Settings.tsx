import Header from '../components/layout/Header';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function SettingsPage() {
  const { t } = useI18n();
  const { data: info, loading } = useApi<{ name: string; version: string }>('/config/info');
  const { data: discord } = useApi<{ connected: boolean; username: string | null }>('/discord/status');

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Header title={t('settTitle')} subtitle={t('settSubtitle')} />
      <div className="space-y-5 max-w-2xl">
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">{t('settApp')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-400">{t('settName')}</span><span>{info?.name}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">{t('settVersion')}</span><span className="font-mono">{info?.version}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">{t('settDiscord')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">{t('status')}</span>
              <span className={discord?.connected ? 'text-emerald-400' : 'text-red-400'}>{discord?.connected ? t('settConnected') : t('settDisconnected')}</span>
            </div>
            {discord?.username && <div className="flex justify-between"><span className="text-surface-400">{t('settBotUser')}</span><span>{discord.username}</span></div>}
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">{t('settConfig')}</h3>
          <p className="text-sm text-surface-400">{t('settConfigDesc')}</p>
        </div>
      </div>
    </>
  );
}
