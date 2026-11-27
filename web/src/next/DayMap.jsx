import { useMemo } from 'preact/hooks';
import { CENTRE, W, lonX, latY, landDots, fitView } from './LiveMap.jsx';
import { REGION, SOURCE_NAME, sourceKind } from './Live.jsx';

// One day on the night map: an owl per country, bigger with more visits.
// With each visit known (BigQuery): the owl takes the colour of where most of
// them came from, its eyes are open when most stayed (2+ pages or 10s+), and a
// green dot marks a goal reached there; clicking one picks that country.
// With only GA4's country counts, every owl is the plain amber-eyed one.

const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');

// people: Live-shaped visitors, or null; countries: [{ label, value }] from the day.
export function dayPlaces(people, countries) {
  const out = new Map();
  if (people) {
    for (const p of people) {
      const code = REGION[p.country] || '';
      const c = out.get(code || p.country) || { code, country: p.country || 'Unknown', users: 0, stayed: 0, goals: 0, sources: new Map() };
      c.users += 1;
      if (p.pages.length > 1 || p.last - p.first >= 10_000) c.stayed += 1;
      if (p.did.some((d) => d.kind === 'goal')) c.goals += 1;
      const k = sourceKind(p.source);
      c.sources.set(k, (c.sources.get(k) || 0) + 1);
      c.top = c.top || p.source;
      out.set(code || p.country, c);
    }
    for (const c of out.values()) c.kind = [...c.sources.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  } else {
    for (const r of countries || []) {
      if (!r.value) continue;
      const code = REGION[r.label] || '';
      out.set(code || r.label, { code, country: r.label, users: r.value });
    }
  }
  return [...out.values()];
}

const KIND_NAME = { search: 'search', ai: 'AI answers', social: 'social', direct: 'direct visits', link: 'other sites', none: 'unknown places' };

export function DayMap({ places, detailed, picked = '', onPick, phone = false }) {
  const { pins, vb, labels } = useMemo(() => {
    const pins = places.filter((p) => CENTRE[p.code]).map((p) => {
      const [lon, lat] = CENTRE[p.code];
      return { ...p, x: lonX(lon), y: latY(lat), size: 9 + Math.min(11, Math.sqrt(p.users) * 2.4) };
    }).sort((a, b) => b.users - a.users); // biggest first, so small owls sit on top
    const vb = fitView(pins, phone);
    const placed = [];
    const labels = [];
    for (const p of pins) {
      const lx = ((p.x - vb[0]) / vb[2]) * 100;
      const ly = ((p.y - vb[1]) / vb[3]) * 100;
      if (placed.length >= (phone ? 3 : 5) || placed.some(([px, py]) => Math.abs(px - lx) < 16 && Math.abs(py - ly) < 10)) continue;
      placed.push([lx, ly]);
      labels.push({ ...p, lx, ly });
    }
    return { pins, vb, labels };
  }, [places, phone]);
  const k = vb[2] / W;
  const missing = places.filter((p) => !CENTRE[p.code]).reduce((n, p) => n + p.users, 0);
  const tip = (p) => [
    `${p.country}: ${fmt(p.users)} ${p.users === 1 ? 'visit' : 'visits'}`,
    detailed ? `${fmt(p.stayed)} stayed` : '',
    detailed && p.goals ? `${fmt(p.goals)} reached a goal` : '',
    detailed ? `mostly ${KIND_NAME[p.kind]}${p.kind === 'link' || p.kind === 'search' ? ` (${SOURCE_NAME(p.top)})` : ''}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <div class="lv-map tl-daymap-map">
      <svg viewBox={vb.map((v) => v.toFixed(1)).join(' ')} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={pins.length ? `Map: visits from ${pins.map((p) => p.country).join(', ')}` : 'Map: no visits with a known country'}>
        <g class="lv-land">{landDots().map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.85 * Math.max(0.6, k)).toFixed(2)} />)}</g>
        {pins.map((p) => {
          const awake = detailed ? p.stayed * 2 >= p.users : true;
          const s = (p.size * k) / 64;
          const on = picked && picked === (p.code || p.country);
          return (
            <g key={p.code} class={`tl-mowl${detailed ? ` src-${p.kind}` : ''}${on ? ' on' : ''}${picked && !on ? ' dim' : ''}${onPick ? ' pick' : ''}`}
              transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${s.toFixed(4)}) translate(-32 -34)`}
              onClick={onPick ? () => onPick(on ? '' : p.code || p.country) : undefined}>
              <title>{tip(p)}</title>
              {onPick && <circle class="tl-mowl-hit" cx="32" cy="34" r="44" />}
              {on && <circle class="tl-mowl-ring" cx="32" cy="34" r="34" />}
              <path class="tl-mowl-body" d="M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z" />
              <circle class="tl-mowl-disc" cx="22.5" cy="34" r="10" />
              <circle class="tl-mowl-disc" cx="41.5" cy="34" r="10" />
              {awake ? (
                <g class="tl-mowl-eyes">
                  <circle cx="22.5" cy="34" r="4.6" class="lv-owl-ring" />
                  <circle cx="41.5" cy="34" r="5.2" class="lv-owl-amber" />
                </g>
              ) : (
                <g class="tl-mowl-shut"><path d="M16.5 35 Q22.5 39 28.5 35" /><path d="M35.5 35 Q41.5 39 47.5 35" /></g>
              )}
              <path class="lv-owl-amber" d="M32 44.5 L29 48 L32 52 L35 48 Z" />
              {detailed && p.goals > 0 && <circle class="tl-mowl-goal" cx="10" cy="10" r="9" />}
            </g>
          );
        })}
      </svg>
      {labels.map((p) => (
        <span key={p.code} class={`lv-pinlab tl-mlab${p.lx > 72 ? ' flip' : ''}`} style={{ left: `${p.lx.toFixed(1)}%`, top: `${p.ly.toFixed(1)}%` }}>
          {p.country} · {fmt(p.users)}
        </span>
      ))}
      {missing > 0 && <span class="lv-map-note">{fmt(missing)} more without a known country</span>}
    </div>
  );
}
