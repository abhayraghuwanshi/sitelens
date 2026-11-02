import { useState } from 'preact/hooks';
import { useElementWidth } from '../hooks.js';
import { placeAnnotations, kindColor } from './annotations.js';

export { kindColor };

// Line chart with a crosshair tooltip. One y-axis only. By default series[0] is
// the primary (solid, accent) and later series are comparisons (dashed, muted);
// series that set `color` are drawn solid in that color (categorical mode).
// series: [{ label, values: number[], color? }], labels: string[] (x categories)
// annotations (optional): [{ date: 'YYYY-MM-DD', label, kind, url? }] drawn as
// vertical markers at the matching entry of `dates` (aligned with labels;
// 'YYYY-MM-DD', 'YYYYMMDD' or 'YYYYMMDDHH' — hourly charts mark the day's first hour).
// onSelect (optional): called with the hovered index on click, e.g. to explain that day.
export function LineChart({ series, labels, height = 240, format = String, area = true, tooltipTitle, annotations = [], dates = [], onSelect }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 12, bottom: 26, left: 44 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const n = labels.length;
  const finite = series.flatMap((s) => s.values.filter(Number.isFinite));
  const peak = Math.max(1, ...finite);
  // Small whole-number data (daily installs…) gets whole-number gridlines, never 1.25 rounded to "1".
  const integral = finite.every(Number.isInteger) && peak <= 10;
  const max = integral ? (peak <= 4 ? 4 : peak <= 6 ? 6 : peak <= 8 ? 8 : 10) : niceMax(peak);
  const x = (i) => (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v) => h - (v / max) * h;
  const ticks = integral
    ? Array.from({ length: max / (max <= 6 ? 1 : 2) + 1 }, (_, i) => i * (max <= 6 ? 1 : 2))
    : [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));
  const markers = placeAnnotations(annotations, dates);
  const hoverNotes = hover === null ? [] : markers.find((m) => m.i === hover)?.items || [];

  const line = (values) =>
    values.map((v, i) => (Number.isFinite(v) ? `${i === 0 || !Number.isFinite(values[i - 1]) ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}` : '')).join('');

  function onMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left - pad.left;
    const i = Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / w) * (n - 1))));
    setHover(i);
  }

  const primary = series[0];
  const colorOf = (s, k) => s.color || (k === 0 ? 'var(--series-1)' : 'var(--series-muted)');
  const dashed = (s, k) => !s.color && k > 0;
  const showArea = area && series.length === 1;
  return (
    <div class="chart" ref={ref}>
      {width > 0 && (
        <svg height={height} role="img" aria-label={`${primary?.label || 'Trend'} over time`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={onSelect ? () => hover !== null && onSelect(hover) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            <g class="grid">
              {ticks.map((t) => (
                <line key={t} x1={0} x2={w} y1={y(t)} y2={y(t)} stroke-dasharray={t === 0 ? undefined : '2 3'} class={t === 0 ? 'baseline' : ''} />
              ))}
            </g>
            <g class="axis">
              {ticks.map((t) => (
                <text key={t} x={-8} y={y(t)} dy="0.32em" text-anchor="end">{format(t, true)}</text>
              ))}
              {labels.map((label, i) =>
                i % labelEvery === 0 ? (
                  <text key={i} x={x(i)} y={h + 18} text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{label}</text>
                ) : null,
              )}
            </g>
            {showArea && primary && n > 1 && (
              <path d={`${line(primary.values)}L${x(n - 1)},${h}L${x(0)},${h}Z`} fill="var(--series-1)" opacity="0.08" />
            )}
            {/* Draw back to front so series[0] sits on top. */}
            {series.map((s, k) => ({ s, k })).reverse().map(({ s, k }) => (
              <path key={k} d={line(s.values)} fill="none" stroke={colorOf(s, k)} stroke-width="2"
                stroke-dasharray={dashed(s, k) ? '4 4' : undefined} stroke-linejoin="round" stroke-linecap="round" />
            ))}
            {/* A point with no finite neighbour draws no line segment; show it as a dot. */}
            {series.map((s, k) => s.values.map((v, i) =>
              Number.isFinite(v) && !Number.isFinite(s.values[i - 1]) && !Number.isFinite(s.values[i + 1])
                ? <circle key={`${k}:${i}`} cx={x(i)} cy={y(v)} r={2.5} fill={colorOf(s, k)} />
                : null,
            ))}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--border-strong)" />
                {series.map((s, k) =>
                  Number.isFinite(s.values[hover]) ? (
                    <circle key={k} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={colorOf(s, k)} stroke="var(--surface)" stroke-width="2" />
                  ) : null,
                )}
              </g>
            )}
            <rect width={w} height={h} fill="transparent" />
            {markers.map((m) => (
              <g key={m.i} class="annotation" tabindex="0" role="note" aria-label={m.items.map((a) => `${a.date}: ${a.label}`).join('; ')}
                onFocus={() => setHover(m.i)} onBlur={() => setHover(null)} onMouseEnter={() => setHover(m.i)} style={{ outline: 'none' }}>
                <line x1={x(m.i)} x2={x(m.i)} y1={0} y2={h} stroke={kindColor(m.items[0].kind)} stroke-dasharray="3 3" opacity="0.8" pointer-events="none" />
                <rect x={x(m.i) - 4} y={-6} width={8} height={8} rx={m.items.length > 1 ? 1 : 4} fill={kindColor(m.items[0].kind)}
                  stroke="var(--surface)" stroke-width="1.5" style={{ cursor: 'default' }} />
                <rect x={x(m.i) - 6} y={-8} width={12} height={h + 8} fill="transparent" />
              </g>
            ))}
          </g>
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div class="tooltip" style={{ left: `${Math.min(width - 80, Math.max(80, pad.left + x(hover)))}px`, top: `${pad.top + Math.min(...series.map((s) => (Number.isFinite(s.values[hover]) ? y(s.values[hover]) : h)))}px` }}>
          <div class="tt-title">{tooltipTitle ? tooltipTitle(hover) : labels[hover]}</div>
          {series.map((s, k) => (
            <div class="tt-row" key={k}>
              <span class="tt-key">
                <i style={{ background: colorOf(s, k) }} />
                {s.label}
              </span>
              <b>{Number.isFinite(s.values[hover]) ? format(s.values[hover]) : '—'}</b>
            </div>
          ))}
          {hoverNotes.map((a) => (
            <div class="tt-row" key={a.id || a.label} style={{ marginTop: '4px', justifyContent: 'flex-start' }}>
              <span class="tt-key"><i style={{ background: kindColor(a.kind), borderRadius: '50%' }} />{a.label}</span>
            </div>
          ))}
          {onSelect && <div class="tt-hint">Click to see what happened</div>}
        </div>
      )}
      {series.length > 1 && (
        <div class="legend" style={{ marginTop: '6px' }}>
          {series.map((s, k) => (
            <span key={k}>
              <i class={dashed(s, k) ? 'dashed' : ''} style={dashed(s, k) ? undefined : { background: colorOf(s, k) }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function niceMax(value) {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export function Sparkline({ values, width = 120, height = 32 }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values.map((v, i) => `${n <= 1 ? 0 : (i / (n - 1)) * width},${height - 2 - (v / max) * (height - 4)}`);
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  );
}
