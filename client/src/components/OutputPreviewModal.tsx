import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Copy, RefreshCw, ExternalLink, Terminal } from 'lucide-react';
import { useI18n } from '../i18n';
import { useToast } from './ui/Toast';

interface Props {
  /** Full output URL — `${origin}/output/<secretToken>`. */
  url: string;
  /** Server name for the modal header. */
  serverName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Fetches and displays the live Admins.cfg generated for a single Squad
 * server. Identical formatting/colouring to the landing IniBlock so the
 * admin sees exactly what a Squad-server would receive when it polls.
 *
 * Loaded lazily — the fetch only fires when `open` flips true and re-runs
 * when the user hits Refresh. Bypasses the in-memory cache by appending a
 * cache-buster query string; this is read-only and the backend doesn't
 * mind extra params.
 */
export default function OutputPreviewModal({ url, serverName, open, onClose }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const fetchOutput = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${url}?_=${Date.now()}`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setContent(text);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchOutput();
    else { setContent(null); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  // ESC closes; click outside the inner panel closes too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast('success', t('srvIniCopied'));
    } catch {
      toast('error', t('apiCopyFailed'));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-surface-950/75 backdrop-blur-sm px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-surface-700/60 bg-surface-900 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center w-9 h-9 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-400 shrink-0">
              <Terminal size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold truncate">{t('srvIniPreview')}</p>
              <p className="font-mono text-[11px] text-surface-500 truncate">{serverName} · Admins.cfg</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-700/40 bg-surface-950/40">
          <button onClick={fetchOutput} disabled={loading} className="btn-secondary py-1.5 px-3 text-[13px]">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {t('srvIniRefresh')}
          </button>
          <button onClick={onCopy} disabled={!content} className="btn-secondary py-1.5 px-3 text-[13px]">
            <Copy size={13} />
            {t('srvIniCopy')}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-1.5 px-3 text-[13px]"
            title={url}
          >
            <ExternalLink size={13} />
            {t('srvIniOpenRaw')}
          </a>
          <div className="flex-1" />
          {content && (
            <div className="font-mono text-[10px] tracking-wider text-surface-500">
              {content.split('\n').length} {t('srvIniLines')} · {(content.length / 1024).toFixed(1)} KB
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-surface-950/40 min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center h-32 text-surface-500 text-sm">
              {t('loading') as string}
            </div>
          )}
          {error && !loading && (
            <div className="p-6 text-sm text-red-400 font-mono">{error}</div>
          )}
          {content && !loading && (
            <pre className="font-mono text-[12.5px] leading-[1.65] px-5 py-4 text-surface-300">
              <code>{colorize(content)}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Same INI syntax colouring used on the landing IniBlock — comments grey,
 * `Group=` accent, `Admin=` emerald, trailing `// comment` italicised. Done
 * line-by-line so React can key each row + show line numbers.
 */
function colorize(text: string): ReactNode {
  return text.split('\n').map((line, i) => {
    let cls = 'text-surface-300';
    if (line.startsWith(';') || line.startsWith('//')) cls = 'text-surface-500 italic';
    else if (line.startsWith('Group=')) cls = 'text-accent-400';
    else if (line.startsWith('Admin=')) cls = 'text-emerald-300';

    const commentIdx = line.indexOf('//');
    const hasTrailingComment = commentIdx > 0 && !line.startsWith('//') && !line.startsWith(';');

    return (
      <div key={i} className="flex">
        <span className="w-10 select-none text-surface-700 text-right pr-3 shrink-0">
          {String(i + 1).padStart(2, ' ')}
        </span>
        {hasTrailingComment ? (
          <span className="flex-1">
            <span className={cls}>{line.slice(0, commentIdx)}</span>
            <span className="text-surface-500 italic">{line.slice(commentIdx)}</span>
          </span>
        ) : (
          <span className={`flex-1 ${cls}`}>{line || ' '}</span>
        )}
      </div>
    );
  });
}
