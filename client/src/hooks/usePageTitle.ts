import { useEffect } from 'react';

/**
 * Set document.title for the lifetime of the calling component. When the
 * component unmounts, the global RouteTitleSync re-runs on the next route
 * change and restores the static page title — so callers don't need to
 * reset it manually.
 *
 * Pass `null` while data is still loading to avoid clobbering the
 * default title with an empty value.
 */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    if (title && title.trim()) {
      document.title = title;
    }
  }, [title]);
}
