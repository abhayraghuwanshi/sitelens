import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Card, Loading, ErrorState, Delta, Segmented } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { SearchTopics } from './SearchTopics.jsx';
import { Demand } from './Demand.jsx';
import { Stat, Submit } from './Bing.jsx';

// Searches (server/search-hub.mjs), a view of the Pages tab: how Google and
// Bing find the site, what people search for, and where each search ranks in
// both engines. Pages themselves (and their index status) are in All pages.
const ENGINES = [{ key: 'google', label: 'Google' }, { key: 'bing', label: 'Bing' }];
const METRICS = [{ key: 'clicks', label: 'Clicks' }, { key: 'impressions', label: 'Impressions' }];
const MARKETS = ['us/en-US', 'gb/en-GB', 'in/en-IN', 'ca/en-CA', 'au/en-AU', 'de/de-DE'];
const pos = (v) => (v === null || v === undefined ? '—' : formatDecimal(v, 1));
const pct = (v) => (v === null || v === undefined ? '—' : formatPercent(v));

// part 'summary': the high level for the top of Pages (both engines' totals and
// the daily chart). part 'details': demand, rankings by search, and Bing crawl
// health, folded under the page list. Both read the same (cached) report.
export function SearchHub({ site, range, part = 'all' }) {
  const hub = useAsync(() => api.get(`/sites/${site.id}/search-hub${qs({ range })}`), [site.id, range]);
  if (hub.error) return part === 'details' ? null : <ErrorState error={hub.error} onRetry={hub.reload} />;
  if (!hub.data) return part === 'details' ? null : <Loading height={part === 'summary' ? 200 : 300} />;
  const h = hub.data;
  const summary = (
    <div class="search-summary">
      <div class="search-summary-side">
        <EngineTotals h={h} site={site} />
        {part === 'summary' && <ClosestWins site={site} rows={h.opportunities} count={h.queries.length} />}
      </div>
      <BothChart h={h} />
    </div>
  );
  if (part === 'summary') return summary;

  const details = <SearchViews site={site} range={range} h={h} />;
  if (part === 'details') return details;
  return <div class="search-hub">{summary}{details}</div>;
}

// The site's searches under the page list: one section, three views.
const VIEWS = [
  { key: 'rank', label: 'Where you rank' },
  { key: 'demand', label: 'What people search for' },
  { key: 'crawl', label: 'Bing crawl' },
];

function SearchViews({ site, range, h }) {
  const [saved, setSaved] = usePersistent('searchView', 'rank');
  const views = VIEWS.filter((v) => v.key !== 'crawl' || h.bing.crawl);
  const view = views.some((v) => v.key === saved) ? saved : 'rank';
  return (
    <section class="search-views" aria-label="Searches">
      <header class="search-views-head">
        <div>
          <h2>Searches</h2>
          <p class="muted small">
            {view === 'rank' ? `${h.queries.length} searches that show the site, with Google and Bing side by side.`
              : view === 'demand' ? 'What people search for: new and rising searches, your topics, and Bing’s volume for any keyword.'
              : 'How Bing crawls the site, and new or changed pages to send it.'}
          </p>
        </div>
        <Segmented label="Searches view" value={view} options={views} onChange={setSaved} />
      </header>
      {view === 'rank' && (
        <>
          <Opportunities rows={h.opportunities} />
          <Card flush><RankTable rows={h.queries} first="Search" queryPages={h.queryPages} /></Card>
        </>
      )}
      {view === 'demand' && (
        <>
          <SearchTopics site={site} range={range} />
          {site.modes?.search && <Demand site={site} range={range} />}
          <BingVolume seeds={h.queries.slice(0, 3).map((q) => q.key)} />
        </>
      )}
      {view === 'crawl' && (
        <div class="grid cols-2-1">
          <Crawl c={h.bing.crawl.latest} />
          <Submit site={site} quota={h.bing.quota} host={h.bing.siteUrl} />
        </div>
      )}
    </section>
  );
}

// One row per engine: clicks, impressions, CTR, position, each against the period before.
function EngineTotals({ h, site }) {
  return (
    <Card flush>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Engine</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Avg. position</th></tr></thead>
          <tbody>
            {ENGINES.map(({ key, label }) => {
              const e = h[key];
              if (e.error) {
                const setup = !site.demo && ['needs-bing', 'bing-site', 'needs-search'].includes(e.error.kind);
                return (
                  <tr key={key}>
                    <td><b>{label}</b></td>
                    <td colSpan={4} class="muted small">
                      {e.error.message} {setup && <a href={key === 'bing' ? '#/settings?i=bing' : '#/settings?tab=sites'}>Set it up</a>}
                    </td>
                  </tr>
                );
              }
              const c = e.current;
              const p = e.previous || {};
              return (
                <tr key={key}>
                  <td><b>{label}</b></td>
                  <td class="num">{formatNumber(c.clicks)} <Delta current={c.clicks} previous={p.clicks} /></td>
                  <td class="num">{formatNumber(c.impressions)} <Delta current={c.impressions} previous={p.impressions} /></td>
                  <td class="num">{pct(c.ctr)}</td>
                  <td class="num">{pos(c.position)} {p.position ? <Delta current={c.position} previous={p.position} invert /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Both engines on one daily chart.
function BothChart({ h }) {
  const [metric, setMetric] = useState('clicks');
  const g = new Map((h.google.trend || []).map((t) => [String(t.date), t[metric]]));
  const b = new Map((h.bing.range?.dates || []).map((d, i) => [d, h.bing.series?.[metric]?.[i]]));
  const dates = [...new Set([...g.keys(), ...b.keys()])].sort();
  if (dates.length < 2) return null;
  const series = [
    ...(g.size ? [{ label: 'Google', values: dates.map((d) => g.get(d) ?? NaN) }] : []),
    ...(b.size ? [{ label: 'Bing', values: dates.map((d) => (b.get(d) === null || b.get(d) === undefined ? NaN : b.get(d))) }] : []),
  ];
  return (
    <Card title={`Search ${metric} per day`} actions={<Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />}>
      <LineChart labels={dates.map((d) => formatDate(d.replaceAll('-', '')))} series={series} format={(v, axis) => formatNumber(v, { compact: axis })} height={220} />
    </Card>
  );
}

// The three searches nearest a win, and the way into all of them.
function ClosestWins({ site, rows, count }) {
  return (
    <Card title="Closest wins" sub="Searches near the top of Google">
      {rows.length ? (
        <ul class="wins">
          {rows.slice(0, 3).map((o) => (
            <li key={o.query} title="Estimated with a generic click-rate-by-position curve: a way to rank them, not a forecast.">
              <b>{o.query}</b>
              <span class="small muted">position {pos(o.position)}{o.potential ? ` · about +${formatNumber(o.potential)} clicks` : ''}</span>
            </li>
          ))}
        </ul>
      ) : <p class="small muted">Nothing close to the top yet.</p>}
      <a class="nx-more" href={`#/site/${site.id}/pages?view=searches`}>All {count} searches, demand and Bing crawl <Icon name="chevron" size={12} /></a>
    </Card>
  );
}

// Searches close to winning (Google), as a row of tiles over the table.
export function Opportunities({ rows }) {
  if (!rows.length) return null;
  return (
    <div class="opps" aria-label="Opportunities">
      {rows.slice(0, 4).map((o) => (
        <div class="opp" key={o.query} title="Estimated with a generic click-rate-by-position curve: a way to rank them, not a forecast.">
          <span class="small muted">{o.type === 'striking' ? 'Close to the top 3' : 'Top 3, few clicks'}</span>
          <b>{o.query}</b>
          <span class="small">position {pos(o.position)} · {formatNumber(o.impressions)} impressions</span>
          {o.potential > 0 && <span class="small good">about +{formatNumber(o.potential)} clicks</span>}
        </div>
      ))}
    </div>
  );
}

function Side({ s }) {
  if (!s) return <><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></>;
  return <><td class="num">{formatNumber(s.clicks)}</td><td class="num">{formatNumber(s.impressions)}</td><td class="num">{pos(s.position)}</td></>;
}

// Searches or pages, Google | Bing. Searches open to their pages; pages to their index status.
function RankTable({ rows, first, queryPages = [], site, pages }) {
  const [open, setOpen] = useState('');
  const [all, setAll] = useState(false);
  if (!rows.length) return <p class="muted small inset">Nothing reported for this range.</p>;
  const shown = all ? rows : rows.slice(0, 25);
  return (
    <div class="table-wrap">
      <table class="data search-both">
        <thead>
          <tr><th rowSpan={2}>{first}</th><th colSpan={3} class="engine">Google</th><th colSpan={3} class="engine">Bing</th></tr>
          <tr><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">Pos.</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">Pos.</th></tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Fragment key={r.key}>
              <tr class={`clickable${open === r.key ? ' selected' : ''}`} onClick={() => setOpen(open === r.key ? '' : r.key)}>
                <td class="cell-path">{pages ? <code>{r.key}</code> : r.key}</td>
                <Side s={r.google} /><Side s={r.bing} />
              </tr>
              {open === r.key && !pages && queryPages.filter((p) => p.query === r.key).map((p) => (
                <tr key={`${r.key}:${p.path}`}>
                  <td class="cell-path" style={{ paddingLeft: '32px' }}><code>{p.path}</code></td>
                  <td class="num">{formatNumber(p.clicks)}</td><td class="num">{formatNumber(p.impressions)}</td><td class="num">{pos(p.position)}</td>
                  <td colSpan={3} class="muted small">Bing doesn’t split searches by page</td>
                </tr>
              ))}
              {open === r.key && pages && <tr><td colSpan={7}><PageDetail site={site} path={r.key} /></td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
      {rows.length > 25 && <button type="button" class="btn ghost" style={{ margin: '8px 16px' }} onClick={() => setAll(!all)}>{all ? 'Show the top 25' : `Show all ${rows.length}`}</button>}
    </div>
  );
}

// Is the page indexed in Google and Bing, and when were they last there?
export function PageDetail({ site, path, links = true }) {
  const [check, setCheck] = useState({ busy: false, data: null, error: null });
  const run = async () => {
    setCheck({ busy: true, data: null, error: null });
    try {
      setCheck({ busy: false, data: await api.get(`/sites/${site.id}/index-status${qs({ path })}`), error: null });
    } catch (error) {
      setCheck({ busy: false, data: null, error });
    }
  };
  const g = check.data?.google;
  const b = check.data?.bing;
  return (
    <div class="page-detail">
      <div class="row gap-8 wrap">
        <button type="button" class="btn" disabled={check.busy} onClick={run}><Icon name="search" size={12} /> {check.busy ? 'Checking…' : check.data ? 'Check again' : 'Check index status'}</button>
        {links && site.modes?.content && path !== '/' && <a class="btn ghost" href={`#/site/${site.id}/pages?article=${encodeURIComponent(path)}`}>Open the page</a>}
        {links && <a class="btn ghost" href={`#/site/${site.id}/pages?path=${encodeURIComponent(path)}`}>Traffic</a>}
      </div>
      {check.error && <p class="small text-bad">{check.error.message}</p>}
      {check.data && (
        <dl class="index-status">
          <dt>Google</dt>
          <dd>
            {g.note ? <span class="muted">{g.note}</span> : <>
              <b class={g.indexed ? 'good' : 'bad'}>{g.indexed ? 'Indexed' : 'Not indexed'}</b>
              {g.coverage && ` · ${g.coverage}`}{g.lastCrawled && ` · last crawled ${g.lastCrawled}`}
              {g.googleCanonical && g.userCanonical && g.googleCanonical !== g.userCanonical && <> · Google picked a different canonical: <code>{g.googleCanonical}</code></>}
              {g.link && <> · <a href={g.link} target="_blank" rel="noreferrer">Open in Search Console <Icon name="external" size={11} /></a></>}
            </>}
          </dd>
          <dt>Bing</dt>
          <dd>
            {b.note && !b.known ? <span class="muted">{b.known === false ? 'Bing hasn’t seen this URL yet. Submit it below.' : b.note}</span> : <>
              <b class={b.known ? 'good' : 'bad'}>{b.known ? 'Known to Bing' : 'Not seen yet'}</b>
              {b.lastCrawled && ` · last crawled ${b.lastCrawled}`}{b.discovered && ` · found ${b.discovered}`}{b.httpStatus && ` · HTTP ${b.httpStatus}`}
            </>}
          </dd>
        </dl>
      )}
    </div>
  );
}

// Bing keyword research: weekly search volume for any keywords, and related searches.
export function BingVolume({ seeds }) {
  const [text, setText] = useState(seeds.join(', '));
  const [market, setMarket] = useState(MARKETS[0]);
  const [res, setRes] = useState({ busy: false, data: null, error: null });
  const [open, setOpen] = useState('');
  const look = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setRes({ busy: true, data: null, error: null });
    try {
      setRes({ busy: false, data: await api.get(`/search/keywords${qs({ q: text, market })}`), error: null });
    } catch (error) {
      setRes({ busy: false, data: null, error });
    }
  };
  return (
    <Card title="Search volume (Bing)" sub="How often people search for any keyword, including ones you don’t rank for yet. Google publishes no volumes.">
      <form class="row gap-8 wrap" onSubmit={look}>
        <input type="text" style={{ flex: '1 1 280px' }} value={text} placeholder="raycast windows, raycast alternative" aria-label="Keywords, comma-separated" onInput={(e) => setText(e.currentTarget.value)} />
        <select value={market} onChange={(e) => setMarket(e.currentTarget.value)} aria-label="Market">{MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <button type="submit" class="btn primary" disabled={res.busy || !text.trim()}>{res.busy ? 'Looking…' : 'Look up'}</button>
      </form>
      {res.error && <p class="small text-bad">{res.error.message}{res.error.kind === 'needs-bing' && <> <a href="#/settings?i=bing">Connect Bing</a></>}</p>}
      {res.data && (
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Keyword</th><th class="num">Last 4 weeks</th><th class="num">4 weeks before</th><th class="num">Change</th></tr></thead>
            <tbody>
              {res.data.keywords.map((k) => (
                <Fragment key={k.keyword}>
                  <tr class={`clickable${open === k.keyword ? ' selected' : ''}`} onClick={() => setOpen(open === k.keyword ? '' : k.keyword)}>
                    <td class="cell-path">{k.keyword} {k.related.length > 0 && <span class="muted small">· {k.related.length} related</span>}</td>
                    <td class="num">{formatNumber(k.last4Weeks)}</td>
                    <td class="num">{formatNumber(k.previous4Weeks)}</td>
                    <td class="num"><Delta current={k.last4Weeks} previous={k.previous4Weeks} /></td>
                  </tr>
                  {open === k.keyword && k.related.map((r) => (
                    <tr key={`${k.keyword}:${r.keyword}`}>
                      <td class="cell-path" style={{ paddingLeft: '32px' }}>{r.keyword}</td>
                      <td class="num">{formatNumber(r.impressions)}</td><td colSpan={2} class="muted small">in the last 90 days</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p class="note">Bing searches in {res.data.market}. Bing’s index also feeds DuckDuckGo, Copilot and ChatGPT search.</p>
        </div>
      )}
    </Card>
  );
}

function Crawl({ c }) {
  return (
    <Card title="Crawl health" sub={c ? `Latest Bing crawl report: ${c.date}` : 'No crawl report yet'}>
      {c ? (
        <div class="crawl-grid">
          <Stat label="Pages in index" value={c.inIndex} />
          <Stat label="Crawled" value={c.crawled} />
          <Stat label="Crawl errors" value={c.errors} bad={c.errors > 0} />
          <Stat label="4xx" value={c.code4xx} bad={c.code4xx > 0} />
          <Stat label="5xx" value={c.code5xx} bad={c.code5xx > 0} />
          <Stat label="Blocked by robots.txt" value={c.blocked} />
        </div>
      ) : <p class="muted small">Bing hasn’t reported crawl stats for this site yet.</p>}
    </Card>
  );
}
