import { useMemo, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, usePersistent, navigate, withParam } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Empty, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { ArticleEditor } from './ArticleEditor.jsx';

// What you published on your own site (sitemap + content files in the repo),
// and what each article brings: landing sessions by source, views, search.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'traffic', label: 'Bringing traffic', test: (r) => r.sessions || r.views },
  { key: 'none', label: 'No traffic', test: (r) => r.path && !r.sessions && !r.views },
  { key: 'google', label: 'Not in Google', test: (r) => r.path && !r.search?.impressions, needs: 'notInGoogle' },
  { key: 'sitemap', label: 'Not in sitemap', test: (r) => r.file && !r.inSitemap },
  { key: 'source', label: 'No source file', test: (r) => r.inSitemap && !r.file, needs: 'noSource' },
];

const SORTS = {
  sessions: (r) => r.sessions,
  views: (r) => r.views,
  clicks: (r) => r.search?.clicks || 0,
  impressions: (r) => r.search?.impressions || 0,
  published: (r) => r.published || r.lastmod || '',
};

export function Articles({ site, range, params }) {
  const open = params?.get('article') || '';
  if (open) return <ArticleEditor site={site} range={range} path={open} onClose={() => navigate(withParam('article', ''))} />;
  return <ArticleList site={site} range={range} />;
}

function ArticleList({ site, range }) {
  const [scope, setScope] = usePersistent('articles-scope', 'articles');
  const [rereading, setRereading] = useState(false);
  const all = scope === 'pages';
  const url = (fresh) => `/sites/${site.id}/articles${qs({ range, all: all ? 1 : '', fresh: fresh ? 1 : '' })}`;
  const data = useAsync(() => api.get(url(false)), [site.id, range, all]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'sessions', desc: true });

  async function reread() {
    setRereading(true);
    try {
      await api.get(url(true));
    } finally {
      setRereading(false);
      data.reload();
    }
  }

  const d = data.data;
  const rows = useMemo(() => {
    if (!d) return [];
    const test = FILTERS.find((f) => f.key === filter)?.test;
    const q = query.trim().toLowerCase();
    const value = SORTS[sort.key];
    return d.rows
      .filter((r) => (!test || test(r)) && (!q || `${r.title} ${r.path} ${r.file?.file || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = value(a);
        const y = value(b);
        const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
        return sort.desc ? -c : c;
      });
  }, [d, filter, query, sort]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!d) return <><Loading height={40} /><Loading height={92} /><Loading height={360} /></>;

  const t = d.totals;
  const notes = Object.entries(d.notes).filter(([, v]) => v);
  const filters = FILTERS.filter((f) => !f.needs || t[f.needs] !== null);
  const head = (key, label) => (
    <th class="num" aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : true })}>
        {label} {sort.key === key ? (sort.desc ? '↓' : '↑') : ''}
      </button>
    </th>
  );

  return (
    <>
      <div class="meta-line" style={{ alignItems: 'center' }}>
        <span><Icon name="globe" size={13} /> {d.sitemaps.length ? `${formatNumber(d.sitemapUrls)} URLs from ${d.sitemaps.length} sitemap${d.sitemaps.length === 1 ? '' : 's'}` : 'no sitemap'}</span>
        <span><Icon name="github" size={13} /> {d.repos.length ? d.repos.map((r) => `${r.name} (${r.files} file${r.files === 1 ? '' : 's'})`).join(', ') : 'no repo'}</span>
        <Segmented label="Which pages" value={scope} onChange={setScope} options={[
          { key: 'articles', label: 'Articles', title: 'Blog, docs, guides and other dated or sectioned content, plus anything with a source file' },
          { key: 'pages', label: 'All pages', title: 'Every URL in the sitemap' },
        ]} />
        <button class="btn ghost" type="button" disabled={rereading} onClick={reread}>
          <Icon name="refresh" size={13} /> {rereading ? 'Reading…' : 'Re-read sitemap & code'}
        </button>
      </div>

      {notes.map(([k, v]) => <p class="note" key={k} style={{ margin: 0 }}><b>{{ sitemap: 'Sitemap', code: 'GitHub', ga4: 'GA4', search: 'Search Console' }[k]}:</b> {v}</p>)}

      <KpiStrip items={[
        { label: all ? 'Pages' : 'Articles', value: formatNumber(t.articles), meta: `${formatNumber(t.withTraffic)} with traffic` },
        { label: 'Sessions they started', value: formatNumber(t.sessions), meta: t.share === null ? 'GA4 landing page' : `${formatPercent(t.share, 0)} of the site`, help: 'GA4 sessions whose landing page is one of these, in this range.' },
        { label: 'No traffic', value: formatNumber(t.noTraffic), meta: 'no views in range' },
        ...(t.notInGoogle !== null ? [{ label: 'Not in Google', value: formatNumber(t.notInGoogle), meta: 'no impressions', help: 'Search Console showed these URLs in no results this range: not indexed, or not ranking for anything.' }] : []),
        ...(t.notInSitemap ? [{ label: 'Not in sitemap', value: formatNumber(t.notInSitemap), meta: 'in code only' }] : []),
      ]} />

      <Card title={all ? 'Pages' : 'Articles'} sub="Where each one’s readers came from, and how it does in Google"
        actions={
          <div class="row">
            <Segmented label="Filter" value={filter} onChange={setFilter} options={filters} />
            <input type="search" placeholder="Filter by title, path or file" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Filter articles" />
          </div>
        } flush>
        {rows.length ? (
          <div class="table-wrap">
            <table class="data posts-table">
              <thead>
                <tr>
                  <th>Article</th>
                  {head('sessions', 'Sessions')}
                  <th>From</th>
                  {head('views', 'Views')}
                  {head('clicks', 'Clicks')}
                  {head('impressions', 'Impr.')}
                  <th>Top query</th>
                  {head('published', 'Published')}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => <Row key={r.path || r.file.href || r.file.file} r={r} site={site} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            <Empty title={d.rows.length ? 'Nothing matches' : 'No articles found'}>
              {d.rows.length ? 'Try another filter.' : all ? 'No sitemap URLs or content files were found.' : 'Nothing under /blog, /docs, /posts and the like. Switch to All pages to see every sitemap URL.'}
            </Empty>
          </div>
        )}
      </Card>
      <p class="note">Sessions count visits that <i>started</i> on the article (GA4 landing page); views include readers who arrived from elsewhere on the site. Search numbers lag about two days.</p>
    </>
  );
}

function Row({ r, site }) {
  const href = r.path ? `#${withParam('article', r.path)}` : '';
  const q = r.search?.queries?.[0];
  return (
    <tr>
      <td style={{ maxWidth: '420px' }}>
        {href ? <a href={href}>{r.title || r.path}</a> : <span>{r.title || r.file.file}</span>}
        <div class="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {r.path && <a class="mono muted" href={r.url || `https://${site.host}${r.path}`} target="_blank" rel="noreferrer">{r.path}</a>}
          {r.file && (r.file.href
            ? <a class="muted" href={r.file.href} target="_blank" rel="noreferrer" title={`${r.file.repo}/${r.file.file}`}><Icon name="github" size={11} /> {r.file.file.split('/').pop()}</a>
            : <span><Icon name="github" size={11} /> {r.file.file.split('/').pop()}</span>)}
          {r.file && !r.inSitemap && <span class="chip accent">not in sitemap</span>}
          {!r.path && <span class="chip">no URL with traffic</span>}
        </div>
      </td>
      <td class="num">{r.sessions ? formatNumber(r.sessions) : <span class="muted">—</span>}</td>
      <td class="small muted">{r.sources.map((s) => `${s.label} ${formatNumber(s.sessions)}`).join(' · ')}</td>
      <td class="num">{r.views ? formatNumber(r.views) : <span class="muted">—</span>}</td>
      <td class="num">{r.search ? formatNumber(r.search.clicks) : <span class="muted">—</span>}</td>
      <td class="num" title={r.search ? `Avg. position ${formatDecimal(r.search.position)}` : ''}>{r.search ? formatNumber(r.search.impressions) : <span class="muted">—</span>}</td>
      <td class="small">{q ? <span title={`${formatNumber(q.clicks)} clicks · ${formatNumber(q.impressions)} impressions · position ${formatDecimal(q.position)}`}>{q.query}</span> : <span class="muted">—</span>}</td>
      <td class="small muted mono" style={{ whiteSpace: 'nowrap' }} title={r.published ? 'Published' : r.lastmod ? 'Sitemap lastmod' : ''}>{r.published || r.lastmod || '—'}</td>
    </tr>
  );
}
