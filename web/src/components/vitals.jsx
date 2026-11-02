import '../vitals.css';

const LABELS = { lcp: 'LCP', inp: 'INP', cls: 'CLS', tbt: 'TBT', fcp: 'FCP' };
const RATING = { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' };

export function formatMetric(metric, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const v = Number(value);
  if (metric === 'cls') return v.toFixed(2);
  if (metric === 'lcp' || metric === 'fcp') return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

export const formatPct = (p, digits = 2) => (p === null || p === undefined ? '—' : `${(p * 100).toFixed(p === 1 ? 0 : digits)}%`);

export function formatAgo(at, now = Date.now()) {
  if (!at) return 'never';
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

// One Core Web Vital: field p75 solid, Lighthouse lab value dashed (INP falls back to TBT).
export function CwvBadge({ metric, data }) {
  if (!data) return <span class="cwv" title={`${LABELS[metric]}: no data yet`}><span class="k">{LABELS[metric]}</span> —</span>;
  const shown = data.metric || metric;
  const title = `${LABELS[shown]} ${formatMetric(shown, data.value)} · ${RATING[data.rating] || ''} · ${data.source === 'field' ? 'real Chrome users (p75)' : 'Lighthouse lab run'}`;
  return (
    <span class={`cwv ${data.rating || ''}${data.source === 'lab' ? ' lab' : ''}`} title={title}>
      <span class="k">{LABELS[shown]}</span>
      <b>{formatMetric(shown, data.value)}</b>
    </span>
  );
}

export function statusClass(last) {
  if (!last) return '';
  return last.ok ? 'on' : 'down';
}

export function HealthStrip({ health }) {
  if (!health || !health.host) return null;
  const { uptime, vitals } = health;
  const last = uptime?.last;
  return (
    <div class="health-strip">
      <span class="up" title={last ? `Last check ${formatAgo(last.at)}: ${last.ok ? `HTTP ${last.status} in ${last.ms}ms` : last.error}` : 'Not checked yet'}>
        <span class={`dot ${statusClass(last)}`} aria-hidden="true" />
        {uptime?.week?.checks ? `${formatPct(uptime.week.pct)} up · 7d` : 'Not checked yet'}
        <span class="sr-only">{last ? (last.ok ? 'Site is up' : 'Site is down') : ''}</span>
      </span>
      {['lcp', 'inp', 'cls'].map((m) => <CwvBadge key={m} metric={m} data={vitals?.[m]} />)}
    </div>
  );
}
