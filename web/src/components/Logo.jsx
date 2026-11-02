// SiteLens Studio mark: the extension's orange→teal tile and rising bars, seen
// through a lens; the amber dot is the lens glint. Source of truth for
// web/public/logo.svg (same drawing) and favicon.svg (heavier strokes for 16px).
export function Logo({ size = 28, title = 'SiteLens Studio' }) {
  return (
    <svg class="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <linearGradient id="sl-bg" x1="0" y1="0" x2="1" y2="1.3">
          <stop offset="0" stop-color="#db562d" />
          <stop offset="1" stop-color="#0f766e" />
        </linearGradient>
        <radialGradient id="sl-hi" cx="0.18" cy="0.08" r="0.62">
          <stop offset="0" stop-color="#ffab80" stop-opacity=".22" />
          <stop offset="1" stop-color="#ffab80" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="3.5" y="3.5" width="57" height="57" rx="15" fill="url(#sl-bg)" />
      <rect x="3.5" y="3.5" width="57" height="57" rx="15" fill="url(#sl-hi)" />
      <circle cx="29" cy="29" r="16" fill="none" stroke="#fff" stroke-width="4" />
      <path d="M41 41l8.5 8.5" stroke="#fff" stroke-width="5.6" stroke-linecap="round" />
      <rect x="21" y="30" width="4.6" height="7" rx="2.3" fill="#fff" />
      <rect x="26.8" y="25.5" width="4.6" height="11.5" rx="2.3" fill="#fff" />
      <rect x="32.6" y="21" width="4.6" height="16" rx="2.3" fill="#fff" />
      <circle cx="40.3" cy="17.7" r="3.8" fill="#f6c453" />
    </svg>
  );
}
