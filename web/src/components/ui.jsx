import { Fragment } from 'preact';
import { formatDelta } from '@shared/format.js';
import { Icon } from './icons.jsx';

export function Card({ title, sub, actions, children, flush = false, class: className = '' }) {
  return (
    <section class={`card ${className}`}>
      {(title || actions) && (
        <header class="card-head">
          {title && <h2>{title}</h2>}
          {sub && <span class="sub">{sub}</span>}
          <span class="spacer" />
          {actions}
        </header>
      )}
      <div class={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.key} aria-pressed={o.key === value} title={o.title || o.label} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Delta vs previous period. `invert` for metrics where lower is better (position).
export function Delta({ current, previous, invert = false }) {
  const d = formatDelta(current, previous);
  if (d.pct === null) return <span class="delta flat">—</span>;
  const good = invert ? d.direction === 'down' : d.direction === 'up';
  const tone = d.direction === 'flat' ? 'flat' : good ? 'up' : 'down';
  const arrow = d.direction === 'up' ? '↑' : d.direction === 'down' ? '↓' : '→';
  return (
    <span class={`delta ${tone}`} title={`${d.direction === 'down' ? '−' : '+'}${d.label} vs previous period`}>
      <span aria-hidden="true">{arrow}</span>
      {d.label}
      <span class="sr-only">{d.direction === 'up' ? 'increase' : d.direction === 'down' ? 'decrease' : 'no change'}</span>
    </span>
  );
}

export function KpiStrip({ items }) {
  return (
    <div class="kpis">
      {items.map((item) => (
        <div class="kpi" key={item.label} title={item.help || ''}>
          <div class="label">
            {item.dot && <span class="dot live" aria-hidden="true" />}
            {item.label}
          </div>
          <div class="value">{item.value}</div>
          <div class="meta">
            {item.previous !== undefined && <Delta current={item.raw} previous={item.previous} invert={item.invert} />}
            {item.meta && <span>{item.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Loading({ height = 240 }) {
  return <div class="skeleton" style={{ height: `${height}px` }} aria-label="Loading" role="status" />;
}

// Where each setup error is fixed.
const SETTINGS_FOR = {
  auth: '#/settings?i=google',
  'needs-github': '#/settings?i=github',
  'needs-property': '#/settings?tab=sites',
  'needs-search': '#/settings?tab=sites',
  'needs-warehouse': '#/settings?tab=sites',
};

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  const setup = ['needs-warehouse', 'needs-property', 'needs-search', 'auth', 'no-data', 'needs-github'].includes(error.kind);
  return (
    <div class={`state${setup ? '' : ' error'}`} role={setup ? undefined : 'alert'}>
      <h3>{setup ? setupTitle(error.kind) : 'Something went wrong'}</h3>
      <p>{error.message}</p>
      {error.hint && <p class="hint">{error.hint}</p>}
      <div class="row">
        {setup && error.kind !== 'no-data' && (
          <a class="btn primary" href={SETTINGS_FOR[error.kind] || '#/settings'}>
            Open settings
          </a>
        )}
        {onRetry && !setup && (
          <button class="btn" type="button" onClick={() => onRetry({ fresh: true })}>
            <Icon name="refresh" size={14} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

function setupTitle(kind) {
  return {
    'needs-warehouse': 'Connect BigQuery for this view',
    'needs-property': 'Link a GA4 property',
    'needs-search': 'Link Search Console',
    auth: 'Connect Google',
    'no-data': 'No export data in this range',
    'needs-github': 'Connect GitHub',
  }[kind];
}

export function Empty({ title, children }) {
  return (
    <div class="state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function BarList({ rows, value, label, format, extra, max: maxOverride }) {
  const max = maxOverride || Math.max(1, ...rows.map(value));
  return (
    <div class="barlist">
      {rows.map((row, i) => {
        const v = value(row);
        return (
          <div class="barlist-row" key={i} title={`${label(row)} — ${format(v)}`}>
            <span class="bar" style={{ width: `calc(${(v / max) * 100}% - 16px)` }} />
            <span class="name">{label(row)}</span>
            <span class="val">
              {format(v)}
              {extra && <small>{extra(row)}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function WarehouseMeta({ data }) {
  if (!data) return null;
  const source = { demo: 'Demo events', bigquery: 'BigQuery · raw events', rollup: 'BigQuery · sessions rollup' }[data.source];
  return (
    <div class="meta-line">
      <span>
        <Icon name="database" size={13} /> {source}
      </span>
      <span>
        {data.range.startDate} → {data.range.endDate}
      </span>
      {data.range.intradayDays > 0 && (
        <span title="Days without a daily events_ table are read from the streaming export's events_intraday_ tables.">
          {data.range.intradayDays} of {data.range.intradayDays + data.range.dailyDays} days from streaming tables
        </span>
      )}
      {data.source !== 'demo' && <span>{data.cacheHit ? 'cached' : `scanned ${humanBytes(data.bytes)}`}</span>}
      {data.source !== 'demo' && data.ms > 0 && <span>{(data.ms / 1000).toFixed(1)}s</span>}
    </div>
  );
}

export function humanBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}

export function PathChain({ pages, max = 8 }) {
  const shown = pages.slice(0, max);
  return (
    <span class="path-chain">
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span class="arrow">→</span>}
          <code>{p}</code>
        </Fragment>
      ))}
      {pages.length > max && <span class="muted small">+{pages.length - max}</span>}
    </span>
  );
}
