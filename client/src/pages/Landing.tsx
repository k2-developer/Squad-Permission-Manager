import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import {
  Github, Globe, Swords, Server, MessageSquare, Lock,
  Link2, Users, ArrowRight, ArrowUpRight, ExternalLink, Menu, X, Check,
  Shield,
} from 'lucide-react';
import DashboardPreview from '../components/landing/DashboardPreview';
import IniBlock from '../components/landing/IniBlock';
import Logo from '../components/Logo';

const GITHUB_URL = 'https://github.com/k2-developer/Squad-Permission-Manager';

/**
 * Original Steam wordmark/glyph — same vector we use on the Login page,
 * extracted here so the landing CTA can reuse it without circular imports.
 */
function SteamIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.979 0C5.678 0 .511 4.86.022 10.94l6.432 2.658a3.387 3.387 0 0 1 1.912-.587c.063 0 .126.002.188.006l2.861-4.142V8.81a4.53 4.53 0 0 1 4.524-4.524 4.53 4.53 0 0 1 4.524 4.524 4.53 4.53 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.003.105.003.158a3.392 3.392 0 0 1-3.392 3.392 3.396 3.396 0 0 1-3.358-2.935L.142 14.47C1.283 19.957 6.14 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.542 2.542 0 0 0 4.873-.934 2.547 2.547 0 0 0-2.544-2.544c-.164 0-.326.016-.484.047l1.522.63a1.873 1.873 0 0 1-1.422 3.463l-.472-.052zm8.399-5.726a3.024 3.024 0 0 0 3.02-3.02 3.024 3.024 0 0 0-3.02-3.02 3.024 3.024 0 0 0-3.02 3.02 3.024 3.024 0 0 0 3.02 3.02zm-.005-5.286a2.27 2.27 0 1 1 0 4.54 2.27 2.27 0 0 1 0-4.54z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Scroll-reveal hook. Watches all .spm-reveal nodes and adds .in once
 * each one enters the viewport. Re-runs when the dependency changes,
 * so locale switches re-animate sections that may have re-rendered.
 * ──────────────────────────────────────────────────────────────────── */
function useScrollReveal(dep: unknown) {
  useEffect(() => {
    const els = document.querySelectorAll('.spm-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

/* ───── Header ─────────────────────────────────────────────────────── */

function Header() {
  const { t, locale, setLocale } = useI18n();
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const flipLang = () => setLocale(locale === 'en' ? 'ru' : 'en');

  return (
    <header
      className={
        'sticky top-0 z-40 transition-colors backdrop-blur-xl ' +
        (scrolled
          ? 'bg-surface-950/80 border-b border-surface-700/50'
          : 'bg-surface-950/40 border-b border-transparent')
      }
    >
      <div className="mx-auto max-w-7xl 3xl:max-w-[88rem] px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/welcome" className="flex items-center gap-3">
          <Logo size={40} className="text-accent-400" />
          <span className="font-bold text-base tracking-tight text-surface-100">SPM</span>
          <span className="hidden md:inline-block ml-2 text-[10px] font-mono uppercase tracking-[0.14em] text-surface-500 border border-surface-700/60 rounded px-1.5 py-0.5">
            v1.0
          </span>
        </Link>

        {/* Desktop nav — keep this typography close to the existing app's
            (Inter, normal weight, no caps-tracking) per user preference. */}
        <nav className="hidden md:flex items-center gap-2">
          <button
            onClick={flipLang}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors"
            aria-label="Switch language"
          >
            <Globe size={15} />
            <span>{locale.toUpperCase()}</span>
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors"
          >
            <Github size={15} />
            <span>{t('landHeaderGithub')}</span>
          </a>
          {user ? (
            <Link
              to="/"
              className="flex items-center gap-2 h-9 px-4 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium transition-colors"
            >
              {t('landHeaderDashboard')}
              <ArrowRight size={14} />
            </Link>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 h-9 px-4 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-12px_rgba(37,99,235,0.6)] transition-colors"
            >
              <SteamIcon size={15} />
              <span>{t('landHeaderSignin')}</span>
            </button>
          )}
        </nav>

        {/* Mobile */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden grid place-items-center w-9 h-9 rounded-md text-surface-300 hover:bg-surface-800/60"
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-surface-700/50 bg-surface-950/95 backdrop-blur-xl">
          <div className="px-5 py-3 flex flex-col gap-1">
            <button
              onClick={flipLang}
              className="flex items-center gap-2 h-10 px-3 rounded-md text-sm text-surface-300 hover:bg-surface-800/60"
            >
              <Globe size={16} /> <span>{locale.toUpperCase()}</span>
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-10 px-3 rounded-md text-sm text-surface-300 hover:bg-surface-800/60"
            >
              <Github size={16} /> {t('landHeaderGithub')}
            </a>
            {user ? (
              <Link to="/" className="flex items-center gap-2 h-10 px-3 rounded-md bg-accent-600 text-white text-sm font-medium justify-center">
                {t('landHeaderDashboard')}
              </Link>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 h-10 px-3 rounded-md bg-accent-600 text-white text-sm font-medium justify-center"
              >
                <SteamIcon size={16} /> {t('landHeaderSignin')}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ───── Hero ────────────────────────────────────────────────────────── */

function Hero() {
  const { t } = useI18n();
  const { user, login } = useAuth();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 spm-bg-grid spm-bg-grid-fade pointer-events-none" />
      <div className="absolute inset-0 spm-hero-glow pointer-events-none" />

      <div className="relative mx-auto max-w-7xl 3xl:max-w-[88rem] px-5 md:px-8 pt-20 md:pt-24 pb-16 md:pb-24">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow meta line — single tag describing the scope of the
              product (whitelist + groups + clans + REST API). */}
          <div className="spm-infoline mb-7 flex items-center gap-3 flex-wrap justify-center spm-reveal">
            <span>{t('landHeroEyebrow')}</span>
          </div>

          {/* Logo badge — larger to anchor the hero. */}
          <div className="spm-reveal mb-7 grid place-items-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-accent-600/10 border border-accent-500/20 shadow-[0_0_0_6px_rgba(59,130,246,0.04)]">
            <Logo size={56} className="text-accent-400" />
          </div>

          <h1 className="spm-reveal text-3xl sm:text-4xl md:text-5xl lg:text-6xl 3xl:text-7xl font-extrabold tracking-tight text-surface-100 leading-[1.05] max-w-4xl">
            {t('landHero')}
          </h1>

          <p className="spm-reveal mt-5 max-w-2xl text-base md:text-lg text-surface-400 leading-relaxed">
            {t('landHeroSub')}
          </p>

          {/* CTAs — kept in the same positions as the previous landing.
              Primary = "Get Started" or "Dashboard" for signed-in users. */}
          <div className="spm-reveal mt-8 flex flex-col sm:flex-row items-center gap-3">
            {user ? (
              <Link
                to="/"
                className="group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_10px_30px_-12px_rgba(37,99,235,0.7)] transition-colors min-w-[148px]"
              >
                {t('landHeaderDashboard')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <button
                onClick={login}
                className="group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_10px_30px_-12px_rgba(37,99,235,0.7)] transition-colors min-w-[148px]"
              >
                {t('landHeroCtaPrimary')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-surface-800/80 hover:bg-surface-800 border border-surface-700/60 text-surface-100 text-sm font-semibold transition-colors min-w-[148px]"
            >
              <Github size={16} />
              {t('landHeroCtaSecondary')}
              <ArrowUpRight size={13} className="text-surface-400" />
            </a>
          </div>

          {/* Tiny trust line */}
          <div className="spm-reveal mt-6 spm-infoline">
            <span>{t('landMetaVersion')}</span>
            <span className="text-surface-700 mx-3">·</span>
            <span>{t('landMetaSector')}</span>
          </div>
        </div>

        {/* Hero visual — dashboard preview */}
        <div className="spm-reveal mt-14 md:mt-20">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

/* ───── Open Source ─────────────────────────────────────────────────── */

function OpenSourceBlock() {
  const { t } = useI18n();
  // Stats strip — license + deployment. The third "$0 forever" stat was
  // removed because the panel is fully self-hosted and pricing isn't a
  // selling point we want to lead with.
  const stats = [
    { v: t('landOSStat1'), l: t('landOSStat1Lbl') },
    { v: t('landOSStat2'), l: t('landOSStat2Lbl') },
  ];
  return (
    <section className="px-5 md:px-8 py-16 md:py-20">
      <div className="spm-reveal spm-hud-corners mx-auto max-w-3xl rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-surface-900/40 p-7 md:p-9">
        <span className="spm-hud-bl" style={{ borderColor: 'rgba(52,211,153,0.4)' }} />
        <span className="spm-hud-br" style={{ borderColor: 'rgba(52,211,153,0.4)' }} />

        <div className="flex items-start gap-5">
          <div className="grid place-items-center w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <Github size={20} className="text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-400/80 mb-1">// LICENSE: MIT</div>
            <h3 className="text-emerald-300 text-xl md:text-2xl font-bold tracking-tight">{t('landOSTitle')}</h3>
            <p className="mt-2 text-surface-400 leading-relaxed max-w-xl">{t('landOSDesc')}</p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 text-sm font-medium"
            >
              {t('landOSLink')} <ExternalLink size={13} />
            </a>
          </div>
        </div>

        <div className="mt-7 pt-6 border-t border-emerald-500/10 grid grid-cols-2 gap-4">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="font-mono text-emerald-300 text-xl md:text-2xl font-semibold tracking-tight">{s.v}</div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-surface-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── How it works ────────────────────────────────────────────────── */

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { tag: t('landHIWStep1Tag'), title: t('landHIWStep1Title'), body: t('landHIWStep1Body'), icon: <Users size={18} /> },
    { tag: t('landHIWStep2Tag'), title: t('landHIWStep2Title'), body: t('landHIWStep2Body'), icon: <Link2 size={18} /> },
    { tag: t('landHIWStep3Tag'), title: t('landHIWStep3Title'), body: t('landHIWStep3Body'), icon: <Shield size={18} /> },
  ];
  return (
    <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-surface-700/30">
      <div className="mx-auto max-w-7xl 3xl:max-w-[88rem]">
        <div className="spm-reveal max-w-2xl">
          <div className="spm-infoline mb-3">// SECTION 02 · DEPLOY</div>
          <h2 className="text-3xl md:text-4xl 3xl:text-5xl font-extrabold tracking-tight text-surface-100">
            {t('landHIWTitle')}
          </h2>
          <p className="mt-3 text-surface-400 text-base md:text-lg leading-relaxed">{t('landHIWSubtitle')}</p>
        </div>

        <div className="spm-reveal mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-surface-700/40 rounded-xl overflow-hidden border border-surface-700/50">
          {steps.map((s, i) => (
            <div key={i} className="relative bg-surface-900 p-6 md:p-7 flex flex-col gap-4 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid place-items-center w-9 h-9 rounded-md bg-accent-500/10 border border-accent-500/20 text-accent-400">
                    {s.icon}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-surface-500">{s.tag}</div>
                </div>
                <div className="font-mono text-3xl font-bold text-surface-800 group-hover:text-accent-500/30 transition-colors">
                  {String(i + 1).padStart(2, '0')}
                </div>
              </div>

              <h3 className="text-xl font-semibold tracking-tight text-surface-100">{s.title}</h3>
              <p className="text-surface-400 leading-relaxed text-sm">{s.body}</p>

              {i < steps.length - 1 && (
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 z-10">
                  <div className="grid place-items-center w-6 h-6 rounded-full bg-surface-950 border border-surface-700/60 text-surface-500">
                    <ArrowRight size={12} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── INI Showcase ────────────────────────────────────────────────── */

function IniShowcase() {
  const { t } = useI18n();
  const bullets = [t('landIniBullet1'), t('landIniBullet2'), t('landIniBullet3')];
  return (
    <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-surface-700/30">
      <div className="mx-auto max-w-7xl 3xl:max-w-[88rem] grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="spm-reveal lg:col-span-5">
          <div className="spm-infoline mb-3">// SECTION 03 · OUTPUT</div>
          <h2 className="text-3xl md:text-4xl 3xl:text-5xl font-extrabold tracking-tight text-surface-100">
            {t('landIniTitle')}
          </h2>
          <p className="mt-4 text-surface-400 text-base md:text-lg leading-relaxed">{t('landIniBody')}</p>
          <ul className="mt-7 space-y-3">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-surface-300 text-sm md:text-base">
                <span className="mt-0.5 grid place-items-center w-5 h-5 rounded bg-accent-500/10 border border-accent-500/30 shrink-0">
                  <Check size={11} className="text-accent-400" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="spm-reveal lg:col-span-7">
          <div className="spm-hud-corners rounded-xl border border-surface-700/60 bg-surface-900/80 overflow-hidden">
            <span className="spm-hud-bl" />
            <span className="spm-hud-br" />
            <IniBlock />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───── Features grid ───────────────────────────────────────────────── */

function FeaturesGrid() {
  const { t } = useI18n();
  const feats = [
    { icon: <Swords size={20} />,        title: t('landF1Title'), body: t('landF1Body'), tag: 'CLAN.OPS' },
    { icon: <Server size={20} />,        title: t('landF2Title'), body: t('landF2Body'), tag: 'WHITELIST' },
    { icon: <MessageSquare size={20} />, title: t('landF3Title'), body: t('landF3Body'), tag: 'DISCORD' },
    { icon: <Lock size={20} />,          title: t('landF4Title'), body: t('landF4Body'), tag: 'STEAM-AUTH' },
    { icon: <Link2 size={20} />,         title: t('landF5Title'), body: t('landF5Body'), tag: 'SIGNED.URLS' },
    { icon: <Users size={20} />,         title: t('landF6Title'), body: t('landF6Body'), tag: 'RBAC' },
  ];

  // Follow-light: track cursor coordinates as CSS vars per card so the
  // ::before gradient illuminates from where the mouse is.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-surface-700/30">
      <div className="mx-auto max-w-7xl 3xl:max-w-[88rem]">
        <div className="spm-reveal max-w-2xl mb-12">
          <div className="spm-infoline mb-3">// SECTION 04 · CAPABILITIES</div>
          <h2 className="text-3xl md:text-4xl 3xl:text-5xl font-extrabold tracking-tight text-surface-100">
            {t('landFeatTitle')}
          </h2>
          <p className="mt-3 text-surface-400 text-base md:text-lg leading-relaxed">{t('landFeatSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 spm-reveal">
          {feats.map((f, i) => (
            <div
              key={i}
              onMouseMove={onMove}
              className="spm-feat-card relative rounded-xl border border-surface-700/50 bg-surface-900/40 p-6"
            >
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-surface-500">{f.tag}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400/80 shadow-[0_0_0_3px_rgba(96,165,250,0.12)]" />
              </div>

              <div className="grid place-items-center w-10 h-10 rounded-md bg-accent-500/10 border border-accent-500/20 text-accent-400 mb-5">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-surface-100">{f.title}</h3>
              <p className="mt-2 text-surface-400 leading-relaxed text-sm">{f.body}</p>

              <div className="mt-5 pt-4 border-t border-surface-700/30 font-mono text-[10px] tracking-wider text-surface-500 flex items-center justify-between">
                <span>// MODULE.{String(i + 1).padStart(2, '0')}</span>
                <span className="text-emerald-400/80">●&nbsp;LIVE</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── Footer ──────────────────────────────────────────────────────── */

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-surface-700/40 mt-10">
      <div className="mx-auto max-w-7xl 3xl:max-w-[88rem] px-5 md:px-8 py-4 flex flex-col sm:flex-row sm:h-16 sm:py-0 items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 text-surface-500 text-xs">
          <div className="hidden sm:flex items-center gap-2">
            <Logo size={24} className="text-accent-400" />
            <span className="font-mono text-[10px] tracking-wider uppercase">{t('landFooterEdition')}</span>
          </div>
          <span className="hidden sm:inline text-surface-700">·</span>
          <span>{t('landFooter')}</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-surface-500">
          <a
            href="https://squadpanel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-surface-300 transition-colors"
          >
            powered by <span className="text-accent-400 font-medium">squadpanel.com</span>
          </a>
          <span className="text-surface-700">·</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
          >
            <Github size={13} />
            {t('landHeaderGithub')}
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ───── Page ────────────────────────────────────────────────────────── */

export default function Landing() {
  const { locale } = useI18n();
  useScrollReveal(locale);

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      <Header />
      <main>
        <Hero />
        <OpenSourceBlock />
        <HowItWorks />
        <IniShowcase />
        <FeaturesGrid />
      </main>
      <Footer />
    </div>
  );
}
