import { useState } from 'preact/hooks';

// Hover any chart for its numbers: an invisible column per point over the chart; the one under the
// pointer shows a guide line and a small label with that point's numbers. Put it inside the chart's
// box (position: relative). `x(i)` is where point i sits, in % of the width (bars: centre of the bar).
//   <HoverLayer count={28} text={(i) => `Thu 13 Nov · 41 visits`} />
export function HoverLayer({ count, text, x = (i) => (count > 1 ? (i / (count - 1)) * 100 : 50), guide = true }) {
  const [at, setAt] = useState(-1);
  if (!count) return null;
  const left = at >= 0 ? x(at) : 0;
  return (
    <span class="hvr" onMouseLeave={() => setAt(-1)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <span key={i} class="hvr-c" onMouseEnter={() => setAt(i)} />)}
      {at >= 0 && (
        <>
          {guide && <i class="hvr-line" style={`left:${left}%`} />}
          <b class={`hvr-tip${left > 70 ? ' r' : left < 30 ? ' l' : ''}`} style={`left:${left}%`}>{text(at)}</b>
        </>
      )}
    </span>
  );
}

export const dayOf = (from, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
export const shortDay = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
