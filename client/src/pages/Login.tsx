import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Bug, ShieldAlert } from 'lucide-react';
import LangSwitch from '../components/ui/LangSwitch';
import Logo from '../components/Logo';

export default function Login() {
  const { user, loading, login, refetchUser } = useAuth();
  const { t } = useI18n();
  const [devMode, setDevMode] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [params] = useSearchParams();
  const error = params.get('error');

  // Check if backend is in dev mode
  useEffect(() => {
    fetch('/api/auth/dev-mode', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.devMode) setDevMode(true); })
      .catch(() => {});
  }, []);

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refetchUser();
      }
    } catch { /* ignore */ }
    finally { setDevLoading(false); }
  };

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LangSwitch />
      </div>

      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-accent-600/10 border border-accent-500/20 shadow-[0_0_0_6px_rgba(59,130,246,0.05)]">
          <Logo size={72} className="text-accent-400" />
        </div>

        <h1 className="mb-2 text-2xl sm:text-3xl font-bold tracking-tight">
          {t('landHero')}
        </h1>
        <p className="mb-6 text-surface-400 text-sm sm:text-base">
          {t('landSignIn')}
        </p>

        {/* Steam-callback or revoke-modal can land us here with an error code. */}
        {(error === 'not_invited' || error === 'revoked') && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
            <ShieldAlert size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-amber-200 font-medium">
                {error === 'revoked' ? t('revokedTitle') : t('loginNotInvitedTitle')}
              </p>
              <p className="text-xs text-amber-300/80 mt-1">
                {error === 'revoked' ? t('revokedBody') : t('loginNotInvitedBody')}
              </p>
            </div>
          </div>
        )}
        {error === 'steam_failed' && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left">
            <ShieldAlert size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{t('loginSteamFailed')}</p>
          </div>
        )}

        <button
          onClick={login}
          className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-surface-800 border border-surface-700 px-6 py-3.5 text-sm font-medium text-surface-100 hover:bg-surface-700 transition-colors"
        >
          <SteamIcon />
          {t('signInWithSteam')}
        </button>

        {/* Dev-only login button */}
        {devMode && (
          <button
            onClick={handleDevLogin}
            disabled={devLoading}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            <Bug size={16} />
            {devLoading ? 'Logging in...' : 'Dev Login (skip Steam)'}
          </button>
        )}

        <p className="mt-6 text-xs text-surface-600">
          {t('firstUserRoot')}
        </p>

        <Link to="/welcome" className="mt-4 inline-block text-xs text-accent-400 hover:underline">
          {t('landGetStarted')}
        </Link>

        <p className="mt-8 text-[10px] font-mono uppercase tracking-wider text-surface-600">
          powered by{' '}
          <a
            href="https://squadpanel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-500 hover:text-accent-400"
          >
            squadpanel.com
          </a>
        </p>
      </div>
    </div>
  );
}

function SteamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 10.94l6.432 2.658a3.387 3.387 0 0 1 1.912-.587c.063 0 .126.002.188.006l2.861-4.142V8.81a4.53 4.53 0 0 1 4.524-4.524 4.53 4.53 0 0 1 4.524 4.524 4.53 4.53 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.003.105.003.158a3.392 3.392 0 0 1-3.392 3.392 3.396 3.396 0 0 1-3.358-2.935L.142 14.47C1.283 19.957 6.14 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.542 2.542 0 0 0 4.873-.934 2.547 2.547 0 0 0-2.544-2.544c-.164 0-.326.016-.484.047l1.522.63a1.873 1.873 0 0 1-1.422 3.463l-.472-.052zm8.399-5.726a3.024 3.024 0 0 0 3.02-3.02 3.024 3.024 0 0 0-3.02-3.02 3.024 3.024 0 0 0-3.02 3.02 3.024 3.024 0 0 0 3.02 3.02zm-.005-5.286a2.27 2.27 0 1 1 0 4.54 2.27 2.27 0 0 1 0-4.54z" />
    </svg>
  );
}
