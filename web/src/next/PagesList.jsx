import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, Segmented, PullDown } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { LABELS, TONE } from '../pages/PageReview.jsx';
import { hrefWith } from './Drawer.jsx';
import { usePhoneWidth } from './Page.jsx';

// All pages: one line per page, by its title: one status word, its visits,
// its search clicks, and what its best search would add in the top 3. The
// page's own view (its searches, goal, changes, decision) is a click away.
const SHORT = { cut: 'Cut', 'improve-content': 'Improve', 'improve-title': 'New title', 'not-found': 'Not in search', watch: 'Small', new: 'Too new', keep: 'Working', needed: 'Needed' };
const TONE_PILL = { bad: 'down', warn: 'warn', idle: 'muted', good: 'up' };
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const ctrAt = (p) => (p == null ? 0 : p <= 1.5 ? 0.28 : p <= 2.5 ? 0.15 : p <= 3.5 ? 0.11 : p <= 5.5 ? 0.07 : p <= 10.5 ? 0.03 : p <= 20.5 ? 0.01 : 0.002);
const SORTS = [{ key: 'visits', label: 'Most visits' }, { key: 'rising', label: 'Rising' }, { key: 'chance', label: 'Biggest chance' }];
// The list's order lives in the address (?sort=chance), so it sits in the page's header
// as a view setting (behind the options button on a phone) and a sorted link keeps it.
const sortOf = (params) => (SORTS.some((x) => x.key === params?.get('sort')) ? params.get('sort') : 'visits');
const showOf = (params) => params?.get('show') || '';

// One page review per site and period, shared by the list and (on a phone) the header's
// filter, so they don't fetch it twice; kept 5 minutes, or until refreshed.
const reviews = new Map();
function loadReview(siteId, range, fresh = false) {
  const key = `${siteId}:${range}`;
  const hit = reviews.get(key);
  if (!fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const p = api.get(`/sites/${siteId}/page-review${qs({ range, fresh: fresh ? 1 : undefined })}`);
  p.catch(() => reviews.delete(key));
  reviews.set(key, { p, at: Date.now() });
  return p;
}
// Each page's last 28 full days of visits, day by day, against the 28 before: a ticker for which
// pages are coming up. Read from the calendar's stored daily landing pages (top 100 a day).
const TREND_DAYS = 28;
const trends = new Map();
const isoDay = (t) => new Date(t).toLocaleDateString('en-CA');
function loadTrend(siteId) {
  const hit = trends.get(siteId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const to = isoDay(Date.now() - 86_400_000);
  const from = isoDay(Date.now() - TREND_DAYS * 86_400_000);
  const p = api.get(`/calendar/breakdown${qs({ site: siteId, by: 'page', from, to, daily: 1, limit: 200 })}`)
    .then((r) => new Map((r.rows || []).map((x) => [x.key, { now: x.value, before: x.previous, days: x.days || [] }])));
  p.catch(() => trends.delete(siteId));
  trends.set(siteId, { p, at: Date.now() });
  return p;
}
// Change in %, only when there's enough to compare (a page going 1 → 3 isn't news).
export const trendPct = (t) => (!t || t.now + t.before < 8 ? null : t.before ? Math.round(((t.now - t.before) / t.before) * 100) : Infinity);

// The ticker: a small line of the 28 days, green rising, red falling, and the change.
function Ticker({ t, wide = false }) {
  const pct = trendPct(t);
  if (!t || !t.days.length) return <span class="tk muted">—</span>;
  const fresh = pct === Infinity; // no visits in the 28 days before: a new page, not a % rise
  const tone = pct == null || Math.abs(pct) < 10 ? 'flat' : pct > 0 ? 'up' : 'down';
  const w = wide ? 64 : 44, h = wide ? 20 : 16;
  const max = Math.max(1, ...t.days);
  // A 7-day average smooths weekday dips, like a moving average on a price chart.
  const sm = t.days.map((_, i) => { const win = t.days.slice(Math.max(0, i - 6), i + 1); return win.reduce((a, b) => a + b, 0) / win.length; });
  const pts = sm.map((v, i) => `${((i / (sm.length - 1 || 1)) * w).toFixed(1)},${(h - 1.5 - (v / max) * (h - 3)).toFixed(1)}`).join(' ');
  return (
    <span class={`tk ${tone}`} title={`Last ${TREND_DAYS} days: ${fmt(t.now)} visits, against ${fmt(t.before)} the ${TREND_DAYS} before`}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} /></svg>
      <span class="tk-pct">{pct == null ? '—' : fresh ? '▲ New' : `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''}${Math.abs(pct)}%`}</span>
    </span>
  );
}

const pickShow = (key) => { location.hash = hrefWith('show', key).slice(1); };

// A phone's header: which pages to show, as a pull-down beside the period and sort.
export function PagesFilter({ site, range, params }) {
  const data = useAsync(() => loadReview(site.id, range), [site.id, range]);
  if (!data.data) return null;
  const d = data.data;
  const options = [{ key: '', label: `All ${d.rows.length}`, title: `All pages · ${d.rows.length}` },
    ...Object.keys(LABELS).filter((k) => d.counts[k]).map((k) => ({ key: k, label: `${SHORT[k]} ${d.counts[k]}`, title: `${SHORT[k]} · ${d.counts[k]}` }))];
  return <PullDown label="Show" value={showOf(params)} options={options} onChange={pickShow} />;
}

export function PagesSort({ params }) {
  return <Segmented label="Sort" value={sortOf(params)} options={SORTS} onChange={(key) => { location.hash = hrefWith('sort', key === 'visits' ? '' : key).slice(1); }} />;
}

// Its best chance: the search that would add most in the top 3.
function chanceOf(r) {
  let best = null;
  for (const q of r.google?.queries || []) {
    if (!q.position || q.position <= 3.5) continue;
    const gain = Math.round((q.impressions || 0) * Math.max(0, ctrAt(3) - ctrAt(q.position)));
    if (!best || gain > best.gain) best = { query: q.query, gain };
  }
  return best;
}

export function PagesList({ site, range, params }) {
  const only = showOf(params);
  const setOnly = pickShow;
  const phone = usePhoneWidth();
  const sort = sortOf(params);
  const [all, setAll] = useState(false);
  const data = useAsync((o) => loadReview(site.id, range, Boolean(o?.fresh)), [site.id, range]);
  const trend = useAsync(() => loadTrend(site.id).catch(() => null), [site.id]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={360} owl label="Reading every page: the sitemap, GA4, Google and Bing…" />;
  const d = data.data;
  const tr = trend.data || new Map();
  const rows = d.rows.map((r) => ({ ...r, chance: chanceOf(r), clicks: (r.google?.clicks || 0) + (r.bing?.clicks || 0), trend: tr.get(r.path) || null }));
  // Rising: most extra visits than the 28 days before first (a big page up 30% beats a tiny one up 300%).
  const rise = (r) => (trendPct(r.trend) == null ? -Infinity : r.trend.now - r.trend.before);
  const order = Object.keys(LABELS).filter((k) => d.counts[k]);
  const list = rows
    .filter((r) => !only || r.suggestion === only)
    .sort((a, b) => (sort === 'chance' ? (b.chance?.gain || 0) - (a.chance?.gain || 0) : sort === 'rising' ? rise(b) - rise(a) || b.visits - a.visits : b.visits - a.visits || b.clicks - a.clicks));
  const shown = all ? list : list.slice(0, 25);
  const href = (r) => `#/site/${site.id}/pages?article=${encodeURIComponent(r.path)}`;

  return (
    <div class="nx-pages">
      {!phone && <div class="nx-chips" role="group" aria-label="Show">
          <button type="button" class={`nx-chip${!only ? ' on' : ''}`} onClick={() => setOnly('')}>All <span>{d.rows.length}</span></button>
          {order.map((k) => (
            <button type="button" key={k} class={`nx-chip${only === k ? ' on' : ''}`} title={LABELS[k]} onClick={() => setOnly(only === k ? '' : k)}>{SHORT[k]} <span>{d.counts[k]}</span></button>
          ))}
      </div>}
      {phone ? (
        <div class="nx-mlist">
          {shown.map((r) => {
            const tone = TONE_PILL[TONE[r.suggestion]] || 'muted';
            const chance = sort === 'chance';
            return (
              <a key={r.path} class="nx-mrow" href={href(r)}>
                <span class="nx-mrow-main">
                  <b>{r.title || r.path}</b>
                  <span class="nx-mrow-sub"><span class={`nx-mrow-tag ${tone}`}><i />{SHORT[r.suggestion] || r.suggestion}</span>{r.title && <span class="nx-mrow-path">{r.path}</span>}</span>
                </span>
                <span class={`nx-mrow-n${chance && r.chance?.gain >= 10 ? ' good' : ''}`}>
                  <b>{chance ? (r.chance?.gain >= 10 ? `+${fmt(r.chance.gain)}` : '—') : fmt(r.visits)}</b>
                  {chance ? <small>in top 3</small> : <Ticker t={r.trend} />}
                </span>
                <Icon name="chevron" size={13} class="nx-mrow-go" />
              </a>
            );
          })}
          {list.length > 25 && <button type="button" class="nx-mrow-more" onClick={() => setAll(!all)}>{all ? 'Show the top 25' : `Show all ${list.length} pages`}</button>}
        </div>
      ) : (
      <div class="card card-plain nx-tight">
        <div class="nx-prow nx-phead" aria-hidden="true"><span>Page</span><span>Now</span><span class="nx-num">Visits</span><span class="nx-num" title="Visits in the last 28 days against the 28 before">28-day trend</span><span class="nx-num">Search clicks</span><span class="nx-num">In the top 3</span></div>
        {shown.map((r) => (
          <a key={r.path} class="nx-prow" href={href(r)} title={r.path}>
            <span class="nx-ob"><b>{r.title || r.path}</b>{r.title && <small class="muted">{r.path}{!r.inSitemap ? ' · not in the sitemap' : ''}</small>}</span>
            <span><span class={`nx-pill ${TONE_PILL[TONE[r.suggestion]] || ''}`} title={r.reason}>{SHORT[r.suggestion] || r.suggestion}</span></span>
            <span class="nx-num">{fmt(r.visits)}</span>
            <span class="nx-num"><Ticker t={r.trend} wide /></span>
            <span class="nx-num">{r.google || r.bing ? fmt(r.clicks) : <span class="muted">—</span>}</span>
            <span class={`nx-num ${r.chance?.gain >= 10 ? 'good' : 'muted'}`} title={r.chance ? `“${r.chance.query}”` : ''}>{r.chance?.gain >= 10 ? `+${fmt(r.chance.gain)}` : '—'}</span>
          </a>
        ))}
        {list.length > 25 && <button type="button" class="todo-link nx-more-rows" onClick={() => setAll(!all)}>{all ? 'Show the top 25' : `Show all ${list.length} pages`}</button>}
      </div>
      )}
      <p class="muted small m-0">
        {d.rows.length} pages{d.sources?.sitemap ? `, ${d.sources.sitemap} from the sitemap` : ''}; numbers cover {d.period?.label || 'the period'}, the word is judged on 90 days.
        “In the top 3” is the extra visits its best search would bring there (an estimate).{' '}
        <button type="button" class="todo-link" onClick={() => data.reload({ fresh: true })} disabled={data.loading}><Icon name="refresh" size={11} /> Read again</button>
      </p>
    </div>
  );
}
