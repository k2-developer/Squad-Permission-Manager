const STEAM_ID_RE = /^\d{17}$/;
const EOS_ID_RE = /^[0-9a-f]{32}$/i;
const INJECTION_RE = /[=\n\r\t]/; // Block INI special chars anywhere
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

export function isValidSteamId(id: string): boolean {
  return typeof id === 'string' && STEAM_ID_RE.test(id);
}

export function isValidEosId(id: string): boolean {
  return typeof id === 'string' && EOS_ID_RE.test(id);
}

export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_RE.test(id);
}

export function hasInjection(value: string): boolean {
  return typeof value !== 'string' || INJECTION_RE.test(value);
}

/**
 * Strip characters that could break rendering, storage, or downstream consumers.
 * - Control chars: cause INI / log / display corruption.
 * - `$`: Mongo operator prefix (defence-in-depth alongside the deep sanitizer).
 * - `<`, `>`, `"`, `'`, `` ` ``: HTML-context separators. React escapes output,
 *   but the same fields are echoed into Discord embeds and (future) emails
 *   where escaping is different — strip at the source.
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\0\n\r\t\x00-\x1f\x7f]/g, '')
    .replace(/\$/g, '')
    .replace(/[<>"'`]/g, '')
    .trim()
    .slice(0, 1000);
}

/**
 * Validate that a user-supplied URL is safe to embed in `<img src>` / `<a href>`.
 * Allows only http: and https: — blocks `javascript:`, `data:`, `vbscript:`,
 * `file:` and other schemes that can execute or exfiltrate.
 * Empty string is considered valid (means "unset").
 */
export function isSafeUrl(value: unknown): value is string {
  if (value === '' || value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Basic cyrillic → latin transliteration so a Russian server name still
// produces a usable URL slug (otherwise everything would strip to empty).
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

/**
 * Build a URL-safe slug from a free-form name. Lowercase, [a-z0-9-],
 * cyrillic transliterated, ≤32 chars. Returns '' if nothing usable remains
 * (caller picks the fallback).
 */
export function slugify(value: string): string {
  if (typeof value !== 'string') return '';
  const transliterated = value
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/** Strip + validate. Returns '' for empty/invalid input. */
export function sanitizeUrl(value: unknown): string {
  if (!isSafeUrl(value)) return '';
  if (typeof value !== 'string' || value === '') return '';
  return value.trim().slice(0, 2048);
}
