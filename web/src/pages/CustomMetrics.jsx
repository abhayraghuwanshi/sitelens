import { formatNumber } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Delta } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';

const TOTAL_LABEL = { sum: 'total', average: 'daily average', latest: 'latest day' };
const shortDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// One custom metric: its period total vs the previous one, and the daily line
// (split by its top dimensions when the query returns a dimension column).
export function MetricChart({ metric, annotations = [], height = 200 }) {
  const fmt = (v, axis) => formatNumber(v, { compact: axis });
  const series = metric.dimensions?.length > 1
    ? [{ label: 'All', values: metric.values }, ...metric.dimensions.map((d) => ({ label: d.name, values: d.values }))]
    : [{ label: metric.label || 'Value', values: metric.values }];
  return (
    <div class="stack" style={{ gap: '8px' }}>
      <div class="row" style={{ alignItems: 'baseline', gap: '8px' }}>
        <b style={{ fontSize: 'var(--text-2xl)' }}>{metric.total === null ? '—' : formatNumber(metric.total)}</b>
        <span class="muted small">{metric.unit || ''} {TOTAL_LABEL[metric.summary || 'sum']}</span>
        <Delta current={metric.total} previous={metric.previous} />
      </div>
      <LineChart labels={metric.dates.map(shortDay)} dates={metric.dates} series={series} format={fmt} height={height} annotations={annotations} />
    </div>
  );
}

// Overview: every custom metric of the site, or nothing when it has none.
export function CustomMetricsCard({ site, range, annotations }) {
  const data = useAsync(() => api.get(`/sites/${site.id}/metrics${qs({ range })}`), [site.id, range]);
  const metrics = data.data?.metrics || [];
  if (!metrics.length) return null;
  return (
    <div class={`grid ${metrics.length > 1 ? 'cols-2' : ''}`}>
      {metrics.map((m) => (
        <Card key={m.id} title={m.label} sub={m.error ? 'Custom metric' : `${shortDay(m.range.start)} – ${shortDay(m.range.end)} · ${m.source === 'd1' ? 'Cloudflare D1' : m.source}`}
          actions={<a class="btn ghost" href={`#/settings?i=metrics&edit=${m.id}`}>Edit</a>}>
          {m.error ? (
            <div class="stack" style={{ gap: '4px' }}>
              <p class="small" style={{ margin: 0, color: 'var(--critical-ink)' }}>{m.error.message}</p>
              {m.error.hint && <p class="note" style={{ margin: 0 }}>{m.error.hint}</p>}
            </div>
          ) : <MetricChart metric={m} annotations={annotations} />}
        </Card>
      ))}
    </div>
  );
}
