// The Kauzl owl as an SVG string, shared by the static build and the pages.
// Left pupil is an empty ring (before), right one is filled (after). The
// eyes follow the pointer and blink (site.js / site.css), and the ring fills
// in once you start using a tool: the owl has noticed.

const BODY = 'M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z';

// variant 'ink' = dark owl for light grounds; 'paper' = light owl for ink grounds.
export function owl(size = 64, { variant = 'ink', label = '', className = '' } = {}) {
  const body = variant === 'paper' ? '#F6F7F9' : '#121522';
  const white = variant === 'paper' ? '#121522' : '#FFFFFF';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="owl ${className}" viewBox="0 0 64 64" width="${size}" height="${size}" ${a11y}>
<path d="${BODY}" fill="${body}"/>
<g class="eyes"><circle cx="22.5" cy="34" r="9.5" fill="${white}"/><circle cx="41.5" cy="34" r="9.5" fill="${white}"/>
<g class="pupils"><circle class="before" cx="22.5" cy="34" r="4.2" fill="none" stroke="#F5A524" stroke-width="2.6"/><circle cx="41.5" cy="34" r="5" fill="#F5A524"/></g></g>
<path d="M32 44 L28.8 47.6 L32 52 L35.2 47.6 Z" fill="#F5A524"/>
</svg>`;
}

// The owl with a speech bubble, for empty states only (never in results).
export function owlSays(text, size = 44) {
  return `<div class="owl-says">${owl(size)}<p class="bubble">${text}</p></div>`;
}
