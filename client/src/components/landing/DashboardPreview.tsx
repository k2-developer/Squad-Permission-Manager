/**
 * Dashboard preview shown inside the landing Hero — a real screenshot of
 * the Whitelist tab dropped into our HUD window-chrome. Two locales:
 * the file in /public is chosen by current UI language. Falling back to
 * the EN screenshot when the RU one is missing keeps the page from
 * showing a broken image.
 *
 * Files live in `client/public/landing/`:
 *   - whitelist-en.png  (English UI screenshot)
 *   - whitelist-ru.png  (Russian UI screenshot)
 *
 * Both are taken at the same resolution (recommended 1440×900 viewport,
 * cropped to the panel area below the URL bar). Keep PNG compressed —
 * ~300 KB each is fine, anything above 600 KB and the page feels heavy.
 */
import { useI18n } from '../../i18n';

const FILE_BY_LOCALE: Record<string, string> = {
  ru: '/landing/whitelist-ru.png',
  en: '/landing/whitelist-en.png',
};

export default function DashboardPreview() {
  const { locale } = useI18n();
  const src = FILE_BY_LOCALE[locale] ?? FILE_BY_LOCALE.en;

  const onError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    // Fall back to EN file if the localized one is missing in /public.
    const img = e.currentTarget;
    if (img.src.endsWith(FILE_BY_LOCALE.en)) return;
    img.src = FILE_BY_LOCALE.en;
  };

  return (
    <div className="spm-hud-corners mx-auto max-w-6xl rounded-xl border border-surface-700/60 bg-surface-900/70 backdrop-blur-sm shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7),0_0_0_1px_rgba(96,165,250,0.04)] overflow-hidden">
      <span className="spm-hud-bl" />
      <span className="spm-hud-br" />

      {/* Window chrome — traffic-light dots + fake URL + ONLINE indicator.
          We keep this in code so it renders at any pixel density rather
          than baking it into the screenshot. */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-surface-700/50 bg-surface-900/90">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-surface-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-surface-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-surface-700" />
        </div>
        <div className="font-mono text-[10px] tracking-wider text-surface-500 hidden sm:block">
          spm.your-server.gg / whitelist
        </div>
        <div className="font-mono text-[10px] tracking-wider text-surface-500">
          <span className="text-emerald-400">●</span> ONLINE
        </div>
      </div>

      {/* Real screenshot. The image already carries our dark theme so we
          don't need an inner background or padding around it. */}
      <img
        src={src}
        alt="SquadPermissionManager — Whitelist"
        onError={onError}
        className="block w-full h-auto bg-surface-950"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
