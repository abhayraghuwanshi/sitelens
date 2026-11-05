import { formatNumber, formatPercent, formatDuration, formatDecimal, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Delta, BarList } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { useAnnotations } from '../components/Annotations.jsx';
import { Icon } from '../components/icons.jsx';
import { SummaryLine } from '../components/Journey.jsx';
import { countryName, flagForCountry } from '@shared/site.js';
import { useLive } from './Overview.jsx';
import { ServerTrafficCard } from './Firebase.jsx';
import { useSiteProduct, HEALTH_STAGES } from '../product.js';
import { tabHref, tabId } from '../stages.js';

// A stage of the journey on one page: a card per source with its headline
// number, each opening that source's full view. Cards read endpoints the
// views already use (and cache); nothing here runs a BigQuery query, so
// warehouse views get a card without a number.

// Views that keep their own long history take 7d/28d/90d only.
const histRange = (range) => (['7d', '28d', '90d'].includes(range) ? range : '7d');
const DAYS = { today: 1, week: 7, '7d': 7, '28d': 28, '90d': 90 };

function rangeDates(range) {
  const day = (offset) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  return { from: day((DAYS[range] || 28) - 1), to: day(0) };
}

// Which connection each site view needs (mirrors VIEWS in App.jsx).
const NEEDS = {
  pages: 'api', search: 'search', bing: 'bing', ai: 'api', demand: 'search', articles: 'content',
  paths: 'warehouse', funnels: 'warehouse', events: 'warehouse', sessions: 'warehouse', retention: 'warehouse',
};
const NEED_LABEL = { api: 'Google Analytics', search: 'Search Console', bing: 'Bing Webmaster Tools', warehouse: 'the BigQuery export', content: 'a site address' };

export function StagePage({ site, range, stage }) {
  const Body = BODIES[stage.key];
  const shown = new Set(Body.views);
  const more = stage.tabs.filter((t) => !shown.has(tabId(t)));
  return (
    <>
      <Body site={site} range={range} stage={stage} />
      {more.length > 0 && (
        <p class="note stage-more">
          Also in {stage.label}: {more.map((t, i) => <span key={tabId(t)}>{i > 0 && ' · '}<a href={tabHref(t, site)}>{t.label}</a></span>)}
        </p>
      )}
    </>
  );
}

/* ---------- cards ---------- */

function Cards({ children }) {
  return <ol class="stage-cards">{children}</ol>;
}

// One source. `src` is a useAsync result (or null for a link-only card);
// `pick(data)` → { value, raw?, previous?, meta } or null when it has nothing.
function SourceCard({ site, view, href, label, icon, src = null, pick = null, empty = 'Nothing yet', linkOnly = '' }) {
  const need = NEEDS[view];
  const locked = need && !site.modes[need];
  const to = href || `#/site/${site.id}/${view}`;
  let c;
  if (locked) c = { value: 'Not connected', meta: `Needs ${NEED_LABEL[need]}`, off: true, to: `#/site/${site.id}/setup` };
  else if (!src) c = { value: linkOnly, meta: '', link: true };
  else if (src.error) c = { value: 'Couldn’t load', meta: src.error.message, off: true };
  else if (!src.data) c = { value: '…', meta: '', off: true };
  else c = pick(src.data) || { value: empty, meta: '', off: true };
  return (
    <li>
      <a class={`journey-step stage-card${c.off ? ' off' : ''}${c.link ? ' link' : ''}`} href={c.to || to}>
        <span class="journey-head">
          {icon && <Icon name={icon} size={13} />}
          {label}
          {locked && <Icon name="lock" size={11} />}
          <Icon name="chevron" size={12} />
        </span>
        <span class={c.link ? 'journey-line' : 'journey-value'}>{c.value}</span>
        {(c.meta || c.previous !== undefined) && (
          <span class="journey-line">
            {c.previous !== undefined && Number.isFinite(c.raw) && <Delta current={c.raw} previous={c.previous} />} {c.meta}
          </span>
        )}
      </a>
    </li>
  );
}

const n = (v) => formatNumber(v);
const dayLabel = (d) => formatDate(String(d).replace(/-/g, ''));

// A daily chart with what shipped marked on it, so a jump lines up with its cause.
function Trend({ site, title, sub, dates, series, format = (v, axis) => formatNumber(v, { compact: axis }) }) {
  const notes = useAnnotations([`site:${site.id}`], dates);
  return (
    <Card title={title} sub={sub}>
      <LineChart labels={dates.map(dayLabel)} series={series} format={format} height={220} annotations={notes.annotations} dates={dates} />
    </Card>
  );
}
const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;

/* ---------- 1 Ship: what did we change? ---------- */

const KIND_ICON = { deploy: 'rocket', release: 'github', post: 'megaphone', extension: 'puzzle', mention: 'chat', note: 'code' };

function Ship({ site, range }) {
  const { from, to } = rangeDates(range);
  const events = useAsync(() => api.get(`/calendar/events${qs({ site: site.id, from, to })}`), [site.id, from, to]);
  const articles = useAsync(() => (site.modes.content ? api.get(`/sites/${site.id}/articles${qs({ range: histRange(range) })}`) : null), [site.id, range]);
  const vitals = useAsync(() => (site.host && !site.demo ? api.get(`/vitals/sites/${site.id}`) : null), [site.id]);
  const list = events.data?.events || [];
  const count = (kind) => list.filter((e) => e.kind === kind).length;
  const latest = (kind) => [...list].reverse().find((e) => e.kind === kind);
  const kindCard = (kind, word) => () => (count(kind) ? { value: plural(count(kind), word), meta: `Latest: ${latest(kind).label}` } : null);
  const shipped = list.filter((e) => KIND_ICON[e.kind] && e.kind !== 'mention').slice().reverse();
  const product = useSiteProduct(site).data;

  return (
    <>
      <Cards>
        <SourceCard site={site} href={`#/vercel?site=${site.id}`} label="Deploys" icon="rocket" src={events} pick={kindCard('deploy', 'deploy')} empty="No deploys logged" />
        <SourceCard site={site} href={`#/github?site=${site.id}`} label="Releases" icon="github" src={events} pick={kindCard('release', 'release')} empty="No releases" />
        <SourceCard site={site} href="#/posts" label="My posts" icon="megaphone" src={events} pick={kindCard('post', 'post')} empty="No posts" />
        <SourceCard site={site} view="articles" label="My articles" icon="pages" src={articles}
          pick={(d) => d.totals?.articles ? { value: plural(d.totals.articles, 'article'), meta: `${formatPercent(d.totals.share, 0)} of site sessions` } : null} empty="No articles found" />
        <SourceCard site={site} href={`#/health?site=${site.id}`} label="Site health" icon="pulse" src={vitals}
          pick={(d) => d.uptime?.checks ? { value: `${formatPercent(d.uptime.pct, 1)} up`, meta: d.latest?.mobile?.score ? `Mobile speed score ${d.latest.mobile.score}` : 'Last 7 days' } : null}
          empty="Not checked yet" linkOnly="Uptime and page speed" />
      </Cards>
      <div class={product ? 'grid cols-2-1' : ''}>
      <Card title="What shipped" sub="Deploys, releases and posts in this period, newest first">
        {events.error ? <p class="muted small">Couldn’t load: {events.error.message}</p> : !events.data ? <p class="muted small">Loading…</p> : shipped.length ? (
          <ul class="stage-timeline">
            {shipped.slice(0, 12).map((e) => (
              <li key={e.id}>
                <span class="muted small mono">{e.date.slice(5)}</span>
                <Icon name={KIND_ICON[e.kind]} size={13} />
                {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.label}</a> : <span>{e.label}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted small" style={{ margin: 0 }}>Nothing logged in this period. Vercel deploys, GitHub releases and your posts show up here once they’re connected.</p>
        )}
      </Card>
      {product && <HealthChecks product={product} range={range} />}
      </div>
    </>
  );
}
Ship.views = ['vercel', 'github', 'posts', 'articles', 'health'];

// Is the site still up, reachable and fast: domain, DNS and SSL, the last
// deploy, uptime and Core Web Vitals, each graded (server/journey.mjs).
function HealthChecks({ product, range }) {
  const journey = useAsync(() => api.get(`/journey/${product.id}${qs({ range: histRange(range) })}`), [product.id, range]);
  const stages = (journey.data?.stages || []).filter((st) => HEALTH_STAGES.includes(st.key));
  return (
    <Card title="Health checks" sub="Domain, deploys, uptime and speed">
      {journey.error ? <p class="muted small">Couldn’t load: {journey.error.message}</p> : !journey.data ? <p class="muted small">Checking…</p> : (
        <div class="stack" style={{ gap: '12px' }}>
          {stages.map((st) => (
            <div key={st.key}>
              <div class="health-head"><span class={`status-dot ${st.status}`} aria-hidden="true" /><b>{st.label}</b> <span class="muted small">{st.headline}</span></div>
              <ul class="checks">
                {st.items.map((i) => (
                  <li key={i.label} class={i.status === 'good' ? 'ok' : i.status === 'warn' ? 'warn' : i.status === 'bad' ? 'bad' : ''}>
                    {i.label}: <span class="muted">{i.text}</span>
                  </li>
                ))}
              </ul>
              {st.key === 'domain' && st.renewUrl && st.status !== 'good' && <a class="small" href={st.renewUrl} target="_blank" rel="noreferrer">Renew at {st.registrar}</a>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- 2 Get found: who noticed? ---------- */

function Found({ site, range }) {
  const google = useAsync(() => (site.modes.search ? api.get(`/sites/${site.id}/search${qs({ range })}`) : null), [site.id, range]);
  const bing = useAsync(() => (site.modes.bing ? api.get(`/bing/sites/${site.id}${qs({ range: histRange(range) })}`) : null), [site.id, range]);
  const ai = useAsync(() => (site.modes.api ? api.get(`/ai-search/sites/${site.id}${qs({ range: histRange(range) })}`) : null), [site.id, range]);
  const demand = useAsync(() => (site.modes.search ? api.get(`/sites/${site.id}/search-demand${qs({ range })}`) : null), [site.id, range]);
  const mentions = useAsync(() => api.get(`/mentions${qs({ range: histRange(range) })}`), [range]);
  const clicks = (d) => ({ value: `${n(d.current.clicks)} clicks`, raw: d.current.clicks, previous: d.previous.clicks, meta: `${n(d.current.impressions)} impressions · avg. position ${formatDecimal(d.current.position, 1)}` });

  return (
    <>
      <Cards>
        <SourceCard site={site} view="search" label="Google" icon="search" src={google} pick={clicks} />
        <SourceCard site={site} view="bing" label="Bing" icon="globe" src={bing} pick={clicks} />
        <SourceCard site={site} view="ai" label="AI search" icon="sparkles" src={ai}
          pick={(d) => {
            const r = d.referrals;
            const named = (d.answers?.results || []).filter((q) => q.latest);
            const rate = named.length ? named.reduce((a, q) => a + (q.mentionRate || 0), 0) / named.length : null;
            return r ? { value: `${n(r.sessions)} visits from assistants`, raw: r.sessions, previous: r.previous, meta: rate !== null ? `Named in ${formatPercent(rate, 0)} of answers checked` : 'Answers not checked yet' } : null;
          }} />
        <SourceCard site={site} view="demand" label="Demand" icon="trend" src={demand}
          pick={(d) => {
            const top = [...(d.groups || [])].filter((g) => g.name !== 'Other').sort((a, b) => b.clicks - a.clicks)[0];
            return top ? { value: `${plural(d.groups.length, 'query group')}`, meta: `${top.name} brings the most: ${n(top.clicks)} clicks` } : null;
          }} />
        <SourceCard site={site} href="#/mentions" label="Mentions" icon="chat" src={mentions}
          pick={(d) => {
            const total = Object.values(d.totals || {}).reduce((a, b) => a + b, 0);
            return { value: plural(total, 'mention'), meta: 'Hacker News, Reddit and Product Hunt, across all your sites' };
          }} />
      </Cards>
      {google.data?.trend?.length > 0 && (
        <div class="grid cols-2-1">
          <Trend site={site} title="Search clicks" sub={bing.data ? 'Google, and Bing dashed' : 'Google'} dates={google.data.trend.map((t) => t.date)}
            series={[
              { label: 'Google', values: google.data.trend.map((t) => t.clicks) },
              ...(bing.data ? [{ label: 'Bing', values: google.data.trend.map((t) => bingClicks(bing.data).get(t.date) ?? null) }] : []),
            ]} />
          <Card title="Top queries" sub="Google clicks">
            <BarList rows={google.data.queries.slice(0, 8)} label={(r) => r.query} value={(r) => r.clicks} format={formatNumber} />
          </Card>
        </div>
      )}
    </>
  );
}

function bingClicks(d) {
  return new Map((d.range?.dates || []).map((date, i) => [date, d.series?.clicks?.[i]]));
}
Found.views = ['search', 'bing', 'ai', 'demand', 'mentions'];

/* ---------- 3 Arrive / 4 Engage: from the GA4 dashboard ---------- */

function useDashboard(site, range) {
  return useAsync(() => (site.modes.api ? api.get(`/sites/${site.id}/dashboard${qs({ range })}`) : null), [site.id, range]);
}
const ov = (d) => d.reports.overview;

function Arrive({ site, range }) {
  const dash = useDashboard(site, range);
  return (
    <>
      <Cards>
        <SourceCard site={site} view="pages" label="Visits" icon="users" src={dash}
          pick={(d) => ({ value: `${n(ov(d).current.sessions)} sessions`, raw: ov(d).current.sessions, previous: ov(d).previous.sessions, meta: `${n(ov(d).current.activeUsers)} people` })} />
        <SourceCard site={site} view="pages" label="Top source" icon="globe" src={dash}
          pick={(d) => {
            const [top] = d.reports.channels;
            const total = d.reports.channels.reduce((a, c) => a + c.sessions, 0);
            return top ? { value: top.channel, meta: `${formatPercent(top.sessions / total, 0)} of sessions` } : null;
          }} />
        <SourceCard site={site} view="pages" label="Top landing page" icon="pages" src={dash}
          pick={(d) => {
            const [top] = d.reports.entryPages;
            return top ? { value: top.path, meta: `${n(top.sessions)} sessions start here` } : null;
          }} />
        <SourceCard site={site} view="sessions" label="Sessions" icon="layers" linkOnly="Read individual visits, page by page" />
      </Cards>
      {dash.data && (
        <>
          <Trend site={site} title="Sessions over time" sub="With what shipped marked" dates={dash.data.reports.trend.map((t) => t.date)}
            series={[{ label: 'Sessions', values: dash.data.reports.trend.map((t) => t.sessions) }]} />
          <div class="grid cols-2">
            <Card title="Where they came from" sub="Sessions by channel">
              <BarList rows={dash.data.reports.channels} label={(r) => r.channel} value={(r) => r.sessions} format={formatNumber} extra={(r) => formatPercent(r.engagementRate, 0)} />
            </Card>
            <Card title="Where they landed" sub="First page of each session">
              <BarList rows={dash.data.reports.entryPages.slice(0, 8)} label={(r) => r.path} value={(r) => r.sessions} format={formatNumber} extra={(r) => formatPercent(r.engagementRate, 0)} />
            </Card>
          </div>
          <div class="grid cols-3">
            <LiveCard site={site} initial={dash.data.live} />
            <Card title="Countries" sub="People">
              <BarList rows={dash.data.reports.countries.slice(0, 8)} label={(r) => `${flagForCountry(r.country)} ${countryName(r.country)}`} value={(r) => r.users} format={formatNumber} />
            </Card>
            <Card title="Devices" sub="Sessions">
              <BarList rows={dash.data.reports.devices} label={(r) => r.device[0].toUpperCase() + r.device.slice(1)} value={(r) => r.sessions} format={formatNumber}
                extra={(r) => formatPercent(r.engagementRate, 0)} />
            </Card>
          </div>
        </>
      )}
      {!site.demo && <ServerTrafficCard site={site} range={range} />}
    </>
  );
}
Arrive.views = ['pages', 'sessions'];

// Who's on the site now, refreshed every minute.
function LiveCard({ site, initial }) {
  const live = useLive(site, initial);
  return (
    <Card title={`${formatNumber(live?.total || 0)} on the site now`} sub={live?.scopedByStream ? 'This stream · last 5 minutes' : 'Last 5 minutes'}>
      {live?.top?.length ? <BarList rows={live.top} label={(r) => r.title} value={(r) => r.users} format={formatNumber} />
        : <p class="muted small">Nobody on the site right now.</p>}
    </Card>
  );
}

function Engage({ site, range }) {
  const dash = useDashboard(site, range);
  return (
    <>
      <Cards>
        <SourceCard site={site} view="pages" label="Engaged" icon="pulse" src={dash}
          pick={(d) => ({ value: `${formatPercent(ov(d).current.engagementRate, 0)} engaged`, raw: ov(d).current.engagementRate, previous: ov(d).previous.engagementRate, meta: 'Stayed 10s+, saw 2+ pages, or converted' })} />
        <SourceCard site={site} view="pages" label="Time on site" icon="calendar" src={dash}
          pick={(d) => ({ value: formatDuration(ov(d).current.averageSessionDuration), raw: ov(d).current.averageSessionDuration, previous: ov(d).previous.averageSessionDuration,
            meta: `${formatDecimal(ov(d).current.screenPageViews / Math.max(1, ov(d).current.sessions), 1)} pages per visit` })} />
        <SourceCard site={site} view="paths" label="Paths" icon="flow" linkOnly="The routes visitors take through the site" />
        <SourceCard site={site} view="funnels" label="Funnels" icon="funnel" linkOnly="Where visitors drop off on the way to a goal" />
        <SourceCard site={site} view="events" label="Events" icon="bolt" linkOnly="Everything the site’s tracking sends" />
      </Cards>
      {dash.data && <EngagedPages pages={dash.data.reports.entryPages} />}
    </>
  );
}

// Landing pages with enough sessions to judge, best and worst at holding people.
function EngagedPages({ pages }) {
  const judged = pages.filter((p) => p.sessions >= 5).sort((a, b) => b.engagementRate - a.engagementRate);
  if (judged.length < 2) return null;
  const half = Math.min(5, Math.ceil(judged.length / 2));
  const rows = (list) => (
    <BarList rows={list} label={(r) => r.path} value={(r) => r.engagementRate} max={1} format={(v) => formatPercent(v, 0)} extra={(r) => `${formatNumber(r.sessions)} sessions`} />
  );
  return (
    <div class="grid cols-2">
      <Card title="Holds people best" sub="Landing pages by engaged sessions">{rows(judged.slice(0, half))}</Card>
      <Card title="Loses people" sub="Landing pages where most leave">{rows(judged.slice(-half).reverse())}</Card>
    </div>
  );
}
Engage.views = ['pages', 'paths', 'funnels', 'events'];

/* ---------- 5 Pay off: did it work? ---------- */

function PayOff({ site, range }) {
  const products = useSiteProduct(site);
  const product = products.data;
  const outcomes = useAsync(() => (product ? api.get(`/outcomes/${product.id}${qs({ range: histRange(range) })}`) : null), [product?.id, range]);
  const href = product ? `#/outcomes/${product.id}?site=${site.id}` : `#/outcomes?site=${site.id}`;
  const d = outcomes.data;

  return (
    <>
      {d?.headline && <SummaryLine summary={{ text: d.headline, status: (d.insights || []).some((i) => i.tone === 'bad') ? 'warn' : 'good' }} />}
      <Cards>
        {!products.loading && !product && <SourceCard site={site} href={`#/product?site=${site.id}`} label="Outcomes" icon="target" linkOnly="Set up this site’s product to measure results" />}
        {(d?.scorecard || []).slice(0, 4).map((s) => (
          <SourceCard key={s.key} site={site} href={href} label={s.label} icon="target" src={outcomes}
            pick={() => ({ value: s.format === 'decimal' ? formatDecimal(s.value, 1) : n(s.value), raw: s.value, ...(s.previous !== undefined ? { previous: s.previous } : {}), meta: s.meta })} />
        ))}
        {product && !d && <SourceCard site={site} href={href} label="Outcomes" icon="target" src={outcomes} pick={() => null} />}
        <SourceCard site={site} view="retention" label="Retention" icon="cohort" linkOnly="How many come back, week by week" />
      </Cards>
      {d?.series?.dates?.length > 0 && (
        <div class="grid cols-2-1">
          <Trend site={site} title={d.series.goalsLabel || 'Outcomes'} sub="Per day, with what shipped marked" dates={d.series.dates}
            series={[
              { label: d.series.goalsLabel || 'Goals', values: d.series.goals },
              ...(d.series.installs?.some((v) => v > 0) ? [{ label: 'Store installs', values: d.series.installs }] : []),
            ]} />
          <Card title="What to do next" sub="From Outcomes">
            {(d.insights || []).length ? (
              <div class="insights">
                {d.insights.slice(0, 4).map((i) => (
                  <div class={`insight ${i.tone === 'bad' ? 'bad' : i.tone === 'warn' ? 'warn' : 'good'}`} key={i.key}>
                    <span class="mark" aria-hidden="true" />
                    <div><div class="title">{i.title}</div><div class="detail">{i.action || i.detail}</div></div>
                  </div>
                ))}
              </div>
            ) : <p class="muted small">Nothing stands out this period.</p>}
          </Card>
        </div>
      )}
      {product && <ProductGrowth product={product} range={range} />}
    </>
  );
}

// The product beyond the site: its store listing and repos, one small chart
// each, on the same days as everything else.
const GROWTH = [
  { key: 'stars', label: 'GitHub stars', area: false },
  { key: 'downloads', label: 'Release downloads' },
  { key: 'storeUsers', label: 'Store users', area: false },
  { key: 'listingViews', label: 'Store listing views' },
  { key: 'repoViews', label: 'Repo views' },
];

function ProductGrowth({ product, range }) {
  const data = useAsync(() => api.get(`/products/${product.id}${qs({ range: histRange(range) })}`), [product.id, range]);
  const dates = data.data?.range.dates || [];
  const notes = useAnnotations(data.data?.scopes || [], dates);
  if (!data.data) return null;
  const { series } = data.data;
  // A line needs two known days, and an all-zero line says nothing.
  const charts = GROWTH.filter((c) => (series[c.key] || []).filter((v) => v !== null).length > 1 && series[c.key].some((v) => v > 0));
  if (!charts.length) return null;
  return (
    <Card title="Beyond the site" sub={`${product.label}: store listing and repos, with what shipped marked`}>
      <div class="growth-grid">
        {charts.map((c) => (
          <div key={c.key}>
            <div class="small muted" style={{ marginBottom: '2px' }}>{c.label}</div>
            <LineChart labels={dates.map(dayLabel)} series={[{ label: c.label, values: series[c.key].map((v) => (v === null ? NaN : v)) }]}
              format={(v, axis) => formatNumber(v, { compact: axis })} height={140} area={c.area !== false} annotations={notes.annotations} dates={dates} />
          </div>
        ))}
      </div>
    </Card>
  );
}
PayOff.views = ['outcomes', 'retention'];

const BODIES = { ship: Ship, found: Found, arrive: Arrive, engage: Engage, payoff: PayOff };
