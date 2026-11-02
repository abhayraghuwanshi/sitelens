// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// Small, dependency-free formatting helpers used by the panel and options.

const numberFmt = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatNumber(n, { compact = false } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (compact && Math.abs(v) >= 1000) return compactFmt.format(v).toLowerCase();
  return numberFmt.format(Math.round(v));
}

export function formatDecimal(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const fixed = v.toFixed(digits);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

export function formatPercent(fraction, digits = 1) {
  const v = Number(fraction);
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits).replace(/\.0$/, '')}%`;
}

export function formatDuration(seconds) {
  const v = Math.max(0, Math.round(Number(seconds) || 0));
  if (v < 60) return `${v}s`;
  const m = Math.floor(v / 60);
  const s = v % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

export function formatSecondsShort(seconds) {
  const v = Math.max(0, Math.round(Number(seconds) || 0));
  if (v < 60) return `${v}s`;
  const m = Math.floor(v / 60);
  const s = v % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function formatDelta(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) {
    return { pct: null, direction: 'flat', label: '—' };
  }
  const pct = (cur - prev) / prev;
  const direction = pct > 0.005 ? 'up' : pct < -0.005 ? 'down' : 'flat';
  return {
    pct,
    direction,
    label: pct === 0 ? '0%' : `${Math.abs(pct * 100).toFixed(Math.abs(pct) < 0.1 ? 1 : 0)}%`,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseGaDate(value) {
  // GA4 returns YYYYMMDD.
  const s = String(value || '');
  if (!/^\d{8}$/.test(s)) return null;
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

export function formatDate(value, { withYear = false } = {}) {
  const d = value instanceof Date ? value : parseGaDate(value);
  if (!d) return '—';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${withYear ? `, ${d.getUTCFullYear()}` : ''}`;
}

export function formatRelative(timestamp) {
  if (!timestamp) return 'never';
  const diff = Date.now() - Number(timestamp);
  if (!Number.isFinite(diff) || diff < 0) return 'just now';
  const sec = Math.round(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function plural(n, one, many = `${one}s`) {
  return `${formatNumber(n)} ${Number(n) === 1 ? one : many}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function sum(rows, key) {
  return (rows || []).reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);
}

export function safeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
