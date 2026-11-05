import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { SearchTopics } from './SearchTopics.jsx';

const METRICS = [
  { key: 'clicks', label: 'Clicks' },
  { key: 'impressions', label: 'Impressions' },
];

export function Search({ site, range }) {
  const data = useAsync((o) => api.get(`/sites/${site.id}/search${qs({ range, fresh: o?.fresh })}`), [site.id, range]);
  const [metric, setMetric] = useState('clicks');
  const [open, setOpen] = useState('');

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;

  const s = data.data;
  const byQuery = new Map();
  for (const row of s.queryPages || []) {
    if (!byQuery.has(row.query)) byQuery.set(row.query, []);
    byQuery.get(row.query).push(row);
  }

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Clicks', value: formatNumber(s.current.clicks), raw: s.current.clicks, previous: s.previous.clicks },
          { label: 'Impressions', value: formatNumber(s.current.impressions), raw: s.current.impressions, previous: s.previous.impressions },
          { label: 'CTR', value: formatPercent(s.current.ctr), raw: s.current.ctr, previous: s.previous.ctr },
          { label: 'Avg. position', value: formatDecimal(s.current.position, 1), raw: s.current.position, previous: s.previous.position, invert: true,
            help: 'Lower is better. Position 1 is the top result.' },
        ]}
      />
      <p class="note">Search Console data lags about {s.range.lagDays || 2} days, so this range is {s.range.startLabel} – {s.range.endLabel}.</p>

      <SearchTopics site={site} range={range} />

      <div class="grid cols-2-1">
        <Card title={`Google Search ${metric}`} actions={<Segmented label="Search metric" value={metric} options={METRICS} onChange={setMetric} />}>
          <LineChart labels={s.trend.map((t) => formatDate(String(t.date || t.key).replaceAll('-', '')))}
            series={[{ label: METRICS.find((m) => m.key === metric).label, values: s.trend.map((t) => t[metric]) }]}
            format={(v, axis) => formatNumber(v, { compact: axis })} height={240} />
        </Card>
        <Card title="Opportunities" sub="Queries worth working on">
          {s.opportunities?.length ? (
            <div class="insights">
              {s.opportunities.map((o) => (
                <div class="insight info" key={o.query}>
                  <span class="mark" aria-hidden="true" />
                  <div>
                    <div class="title">{o.query}</div>
                    <div class="detail">
                      {o.type === 'striking' ? `Position ${formatDecimal(o.position, 1)} with ${formatNumber(o.impressions)} impressions.` : `Top-3 but only ${formatPercent(o.ctr)} CTR.`}
                      {o.potential ? ` Could add roughly ${formatNumber(o.potential)} clicks.` : ''}
                    </div>
                  </div>
                </div>
              ))}
              <p class="note">Estimates use a generic CTR-by-position curve — a prioritization hint, not a forecast.</p>
            </div>
          ) : (
            <p class="muted small">No obvious opportunities in this range.</p>
          )}
        </Card>
      </div>

      <div class="grid cols-2">
        <Card title="Top queries" sub="Click a query to see the pages it lands on" flush>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Query</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">CTR</th><th class="num">Pos.</th></tr></thead>
              <tbody>
                {s.queries.slice(0, 25).map((q) => (
                  <Fragment key={q.query}>
                    <tr class={`clickable${open === q.query ? ' selected' : ''}`} onClick={() => setOpen(open === q.query ? '' : q.query)}>
                      <td class="cell-path">{q.query}</td>
                      <td class="num">{formatNumber(q.clicks)}</td>
                      <td class="num">{formatNumber(q.impressions)}</td>
                      <td class="num">{formatPercent(q.ctr)}</td>
                      <td class="num">{formatDecimal(q.position, 1)}</td>
                    </tr>
                    {open === q.query &&
                      (byQuery.get(q.query) || []).map((p) => (
                        <tr key={`${q.query}:${p.url}`}>
                          <td class="cell-path" style={{ paddingLeft: '32px' }}><code>{p.path}</code></td>
                          <td class="num">{formatNumber(p.clicks)}</td>
                          <td class="num">{formatNumber(p.impressions)}</td>
                          <td class="num">{formatPercent(p.ctr)}</td>
                          <td class="num">{formatDecimal(p.position, 1)}</td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Top pages in Google" flush>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Page</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">CTR</th><th class="num">Pos.</th></tr></thead>
              <tbody>
                {s.pages.slice(0, 25).map((p) => (
                  <tr key={p.url}>
                    <td class="cell-path"><code>{p.path}</code></td>
                    <td class="num">{formatNumber(p.clicks)}</td>
                    <td class="num">{formatNumber(p.impressions)}</td>
                    <td class="num">{formatPercent(p.ctr)}</td>
                    <td class="num">{formatDecimal(p.position, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
