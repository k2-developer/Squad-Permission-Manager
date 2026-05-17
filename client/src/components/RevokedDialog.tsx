import { useEffect, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { useI18n } from '../i18n';
import Logo from './Logo';

interface Props {
  /** Message returned by the server (`Access revoked` / `Account no longer exists`). */
  reason: string | null;
  onAcknowledge: () => void;
  /** Seconds before the dialog auto-redirects. Default 8. */
  countdown?: number;
}

/**
 * Full-screen blocking dialog shown when the API tells us the current
 * session was revoked mid-use (e.g. owner removed this SteamID from every
 * clan's managers list, or deleted the account).
 *
 * The user can't navigate anywhere inside the panel from here — clicking
 * the button (or letting the countdown finish) sends them to /login with
 * an explanatory query param.
 */
export default function RevokedDialog({ reason, onAcknowledge, countdown = 8 }: Props) {
  const { t } = useI18n();
  const [secondsLeft, setSecondsLeft] = useState(countdown);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onAcknowledge();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, onAcknowledge]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoked-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-950/85 backdrop-blur-md px-4 animate-in fade-in"
    >
      <div className="w-full max-w-md text-center">
        {/* Logo + accent ring */}
        <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-3xl bg-red-500/10 border border-red-500/30 shadow-[0_0_0_8px_rgba(239,68,68,0.06)]">
          <ShieldOff size={44} className="text-red-400" />
        </div>

        <h2 id="revoked-title" className="text-2xl font-bold tracking-tight text-surface-100 mb-2">
          {t('revokedTitle')}
        </h2>
        <p className="text-sm text-surface-300 leading-relaxed mb-1">
          {t('revokedBody')}
        </p>
        {reason && reason !== t('revokedBody') && (
          <p className="text-xs font-mono text-surface-500 mb-2">{reason}</p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onAcknowledge}
            className="btn-primary justify-center h-11 px-6 text-sm font-semibold"
            autoFocus
          >
            {t('revokedSignInAgain')}
          </button>
          <p className="text-xs text-surface-500">
            {t('revokedAutoRedirect').replace('{n}', String(secondsLeft))}
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-[10px] text-surface-600">
          <Logo size={16} className="text-surface-700" />
          <span className="font-mono uppercase tracking-wider">SPM</span>
        </div>
      </div>
    </div>
  );
}
