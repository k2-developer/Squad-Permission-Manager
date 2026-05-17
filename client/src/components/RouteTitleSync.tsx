import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useI18n, type TranslationKey } from '../i18n';

/**
 * Document title format: "{page} · SPM" for app pages, full marketing
 * string for the landing. Updating one place keeps the entire app
 * consistent — pages don't need to remember to set their own title.
 *
 * Dynamic routes (e.g. /clan/:code) intentionally fall back to the
 * static page name here; the matching page component is free to override
 * `document.title` once it has the data (see usePageTitle()).
 */

const BRAND = 'SPM';

// Static route → translation key. Order matters for prefix matches:
// '/clan/' comes before '/clans' because Map iterates insertion order
// and `startsWith` greedy-matches the first hit.
const STATIC_TITLES = new Map<string, TranslationKey | string>([
  ['/', 'navDashboard'],
  ['/welcome', 'titleLanding'],
  ['/login', 'titleLogin'],
  ['/auth/callback', 'titleAuthCallback'],
  ['/whitelist', 'navWhitelist'],
  ['/approvals', 'navApprovals'],
  ['/clans', 'navClans'],
  ['/clan/', 'navClans'], // public clan pages override this once loaded
  ['/groups', 'navGroups'],
  ['/applications', 'navApplications'],
  ['/servers', 'navServers'],
  ['/users', 'navUsers'],
  ['/settings', 'navSettings'],
  ['/api-keys', 'navApiKeys'],
]);

function resolveTitleKey(pathname: string): TranslationKey | string | null {
  if (STATIC_TITLES.has(pathname)) return STATIC_TITLES.get(pathname)!;
  // Prefix match — pick the longest matching prefix to be deterministic.
  let best: { prefix: string; key: TranslationKey | string } | null = null;
  for (const [prefix, key] of STATIC_TITLES) {
    if (prefix !== '/' && pathname.startsWith(prefix)) {
      if (!best || prefix.length > best.prefix.length) {
        best = { prefix, key };
      }
    }
  }
  return best?.key ?? null;
}

export default function RouteTitleSync() {
  const { pathname } = useLocation();
  const params = useParams();
  const { t, locale } = useI18n();

  useEffect(() => {
    const key = resolveTitleKey(pathname);
    let title: string;

    if (!key) {
      title = BRAND;
    } else if (key === 'titleLanding') {
      // Marketing-style title for the landing.
      title = `${BRAND} — ${t('landHero')}`;
    } else {
      const page = t(key as TranslationKey);
      title = `${page} · ${BRAND}`;
    }

    document.title = title;
    // Note: params is included in deps so /:code transitions retrigger,
    // letting the clan page's own effect overwrite this default.
  }, [pathname, params, locale, t]);

  return null;
}
