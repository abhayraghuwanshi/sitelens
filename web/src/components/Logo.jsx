// Kauzl mark: a small owl (German "Kauz") on an ink tile. The left pupil is an
// empty ring (before), the right one filled (after). Source of truth for
// web/public/logo.svg (same drawing) and favicon.svg (simplified for 16px).
export function Logo({ size = 28, title = 'Kauzl' }) {
  return (
    <svg class="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#121522" />
      <g transform="translate(8.96 9.96) scale(.72)">
        <path d="M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z" fill="#F6F7F9" />
        <circle cx="22.5" cy="34" r="9.5" fill="#121522" />
        <circle cx="41.5" cy="34" r="9.5" fill="#121522" />
        <circle cx="22.5" cy="34" r="4.2" fill="none" stroke="#F5A524" stroke-width="2.6" />
        <circle cx="41.5" cy="34" r="5" fill="#F5A524" />
        <path d="M32 44 L28.8 47.6 L32 52 L35.2 47.6 Z" fill="#F5A524" />
      </g>
    </svg>
  );
}
