interface Props {
  /** Pixel size (square). Defaults to 24. */
  size?: number;
  /** Tailwind class for the primary stroke colour. Defaults to currentColor. */
  className?: string;
  /** Show "SPM" wordmark after the glyph. */
  withWordmark?: boolean;
  /** Force-compact (skip HUD corners + pip) regardless of size. */
  compact?: boolean;
}

/**
 * SPM brand mark — a tactical shield silhouette with an inset stencil "S"
 * monogram. Drawn at viewBox 64×64 (more headroom for crisp strokes) so the
 * inner monogram fills the centre and reads clearly even at 24-32px.
 *
 * Decorative HUD corner brackets and the permission-pip dot only render
 * when the displayed size is large enough (>= 28px) to keep small renders
 * (favicon, nav, mobile chips) from looking cluttered.
 *
 * Single inline SVG, no external dependencies — safe to embed anywhere.
 */
export default function Logo({ size = 24, className = 'text-accent-400', withWordmark = false, compact = false }: Props) {
  const showDetail = !compact && size >= 28;

  const glyph = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SPM"
    >
      {/* Shield silhouette — chevron-notched top, slightly tapered to a point.
          Fill is a subtle tint of currentColor; stroke is the brand outline. */}
      <path
        d="M32 4 L55 10 V28 C55 41.5 46.8 51.5 32 59 C17.2 51.5 9 41.5 9 28 V10 Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* HUD corner brackets, top-left + bottom-right, only at meaningful sizes */}
      {showDetail && (
        <>
          <path d="M4 8 V4 H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M56 60 H60 V56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Stencil monogram "S" — fills the central 60% of the shield.
          Drawn as a single filled path so it scales without losing weight. */}
      <path
        d="M20 20
           H44
           V27
           H27
           V30
           H44
           V44
           H20
           V37
           H37
           V34
           H20
           Z"
        fill="currentColor"
      />

      {/* Permission-pip dot — top right of shield, only on larger renders. */}
      {showDetail && (
        <circle cx="47" cy="16" r="2.6" fill="currentColor" />
      )}
    </svg>
  );

  if (!withWordmark) return glyph;

  return (
    <span className="inline-flex items-center gap-2">
      {glyph}
      <span className="font-bold text-sm tracking-tight">SPM</span>
    </span>
  );
}
