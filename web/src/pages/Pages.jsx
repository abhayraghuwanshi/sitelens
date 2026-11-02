import { useMemo, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDuration, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, Loading, ErrorState, KpiStrip } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';

const COLUMNS = [
  { key: 'views', label: 'Views', format: formatNumber },
  { key: 'users', label: 'Users', format: formatNumber },
  { key: 'engagementRate', label: 'Engagement', format: (v) => formatPercent(v, 0) },
  { key: 'avgDuration', label: 'Avg. time', format: formatDuration },
];

export function Pages({ site, range, params }) {
  const dash = useAsync(() => api.get(`/sites/${site.id}/dashboard${qs({ range })}`), [site.id, range]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ key: 'views', desc: true });
  const selected = params.get('path') || '';

  const pages = dash.data?.reports.pages || [];
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return pages
      .filter((p) => !q || p.path.toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q))
      .sort((a, b) => (sort.desc ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]));
  }, [pages, filter, sort]);

  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  if (!dash.data) return <Loading height={480} />;

  const siteViews = dash.data.reports.overview.current.screenPageViews || 1;
  const maxViews = Math.max(1, ...pages.map((p) => p.views));
  const page = pages.find((p) => p.path === selected);
  const select = (path) => navigate(`/site/${site.id}/pages${path ? `?path=${encodeURIComponent(path)}` : ''}`);

  return (
    <>
      {page && <PageDetail site={site} range={range} page={page} siteViews={siteViews} onClose={() => select('')} />}
      <Card
        title="Pages"
        sub={`${formatNumber(pages.length)} pages GA4 reported`}
        actions={<input type="search" placeholder="Filter by path or title" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} aria-label="Filter pages" />}
        flush
      >
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Page</th>
                <th class="num" style={{ width: '120px' }}>Share</th>
                {COLUMNS.map((c) => (
                  <th class="num" key={c.key} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : true })}>
                      {c.label} {sort.key === c.key ? (sort.desc ? '↓' : '↑') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.path} class={`clickable${p.path === selected ? ' selected' : ''}`} onClick={() => select(p.path)}
                  tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && select(p.path)}>
                  <td class="cell-path">
                    <code>{p.path}</code>
                    <span class="t">{p.title}</span>
                  </td>
                  <td class="num">
                    <div class="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <span class="small muted">{formatPercent(p.views / siteViews, 1)}</span>
                      <div class="inline-bar" style={{ width: '60px' }}><span style={{ width: `${(p.views / maxViews) * 100}%` }} /></div>
                    </div>
                  </td>
                  {COLUMNS.map((c) => (
                    <td class="num" key={c.key}>{c.format(p[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p class="muted" style={{ padding: '8px 16px' }}>No pages match “{filter}”.</p>}
        </div>
      </Card>
    </>
  );
}

function PageDetail({ site, range, page, siteViews, onClose }) {
  const trend = useAsync(() => api.get(`/sites/${site.id}/page-trend${qs({ range, path: page.path })}`), [site.id, range, page.path]);
  const [metric, setMetric] = useState('screenPageViews');
  const label = { screenPageViews: 'Views', activeUsers: 'Users', sessions: 'Sessions' }[metric];
  return (
    <Card
      title={page.path}
      sub={page.title}
      actions={
        <>
          <a class="btn ghost" href={`https://${site.host}${page.path}`} target="_blank" rel="noreferrer">Open page ↗</a>
          {site.modes.warehouse && <a class="btn ghost" href={`#/site/${site.id}/paths?start=${encodeURIComponent(page.path)}`}>Paths from here</a>}
          <button class="btn ghost" type="button" onClick={onClose}>Close</button>
        </>
      }
    >
      <div class="stack">
        <KpiStrip
          items={[
            { label: 'Views', value: formatNumber(page.views), meta: `${formatPercent(page.views / siteViews)} of site` },
            { label: 'Users', value: formatNumber(page.users) },
            { label: 'Engagement', value: formatPercent(page.engagementRate) },
            { label: 'Avg. time', value: formatDuration(page.avgDuration) },
          ]}
        />
        <div class="row">
          {['screenPageViews', 'activeUsers', 'sessions'].map((m) => (
            <button key={m} type="button" class={`btn${m === metric ? ' primary' : ''}`} onClick={() => setMetric(m)}>
              {{ screenPageViews: 'Views', activeUsers: 'Users', sessions: 'Sessions' }[m]}
            </button>
          ))}
        </div>
        {trend.error ? (
          <ErrorState error={trend.error} />
        ) : trend.data ? (
          <LineChart labels={trend.data.map((t) => t.label || formatDate(t.date))} series={[{ label, values: trend.data.map((t) => t[metric]) }]}
            format={(v, axis) => formatNumber(v, { compact: axis })} height={200} />
        ) : (
          <Loading height={200} />
        )}
      </div>
    </Card>
  );
}
