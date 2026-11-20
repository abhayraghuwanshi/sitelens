import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { DecisionSelect, LABELS } from '../pages/PageReview.jsx';
import { Page } from './Page.jsx';
import { PageTimeline } from './PageTimeline.jsx';

// One page (docs/redesign/prototype.html → a page): its title and one status
// word, one sentence on what it does for you, then its timeline (PageTimeline:
// every change, busy day, note and to-do as dated events, each with its proof,
// ending in Now). Searches, the content cycle and your decision sit behind
// Details. Editing the page itself (title, description, the file) is a click
// away (?edit=1).
const fmtD = (d, o = { day: 'numeric', month: 'short' }) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-US'));
const rank = (p) => (p == null ? '—' : `#${Math.round(p)}`);
const ctrAt = (p) => (p == null ? 0 : p <= 1.5 ? 0.28 : p <= 2.5 ? 0.15 : p <= 3.5 ? 0.11 : p <= 5.5 ? 0.07 : p <= 10.5 ? 0.03 : p <= 20.5 ? 0.01 : 0.002);
const SHORT = { cut: 'Cut', 'improve-content': 'Improve', 'improve-title': 'New title', 'not-found': 'Not in search', watch: 'Small', new: 'Too new', keep: 'Working', needed: 'Needed' };
const TONE = { cut: 'down', 'improve-content': 'warn', 'improve-title': 'warn', 'not-found': 'warn', watch: 'muted', new: 'muted', keep: 'up', needed: 'up' };
const CYCLE = { grow: ['Grow', 'up'], improve: ['Improve', 'warn'], cut: ['Cut', 'down'], new: ['Too new', 'muted'], wait: ['Too new', 'muted'] };

export function PageView({ site, path, back }) {
  const row = useAsync(() => api.get(`/sites/${site.id}/page-goal${qs({ path, range: '90d' })}`), [site.id, path]);
  const hub = useAsync(() => api.get(`/sites/${site.id}/search-hub${qs({ range: '90d' })}`).catch(() => null), [site.id]);
  const cycles = useAsync(() => api.get(`/sites/${site.id}/content-cycles`).catch(() => null), [site.id]);
  const [more, setMore] = useState(false);

  if (row.error) return <Page title={path} back={back}><ErrorState error={row.error} onRetry={row.reload} /></Page>;
  if (!row.data) return <Page title={path} back={back}><Loading height={420} owl label="Reading the page: its searches, visits and changes…" /></Page>;
  const r = row.data;

  // Its searches (Google, from Search Console's page × search report), with where Bing has the same search.
  const bingOf = new Map((hub.data?.queries || []).map((q) => [q.key, q.bing]));
  const searches = (hub.data?.queryPages || []).filter((q) => q.path === path).map((q) => {
    const gain = Math.round((q.impressions || 0) * Math.max(0, ctrAt(3) - ctrAt(q.position)));
    const bing = bingOf.get(q.query);
    const split = bing?.position && q.position && Math.abs(bing.position - q.position) >= 5;
    return { ...q, gain, bing, split, state: q.position <= 3.5 ? 'top' : q.position <= 10.5 ? 'p1' : 'p2' };
  }).sort((a, b) => b.clicks - a.clicks);
  const best = searches[0] || (r.google?.queries?.[0] ? { query: r.google.queries[0].query } : null);

  // One status word: this cycle's verdict, else the page review's.
  const cyc = cycles.data?.report?.rows?.find((x) => x.path === path);
  const [word, tone] = cyc && CYCLE[cyc.verdict] ? CYCLE[cyc.verdict] : [SHORT[r.suggestion] || r.suggestion, TONE[r.suggestion] || ''];

  // One sentence: what it does for you, and where its next visits are.
  const chance = [...searches].filter((q) => q.gain > 0).sort((a, b) => b.gain - a.gain)[0];
  const href = `#/site/${site.id}/pages?article=${encodeURIComponent(path)}`;

  return (
    <Page title={<>{r.title || path} <span class={`nx-pill ${tone} pv-stat`} title={cyc?.why || r.reason}>{word}</span></>} sub={path} back={back}
      actions={<a class="btn" href={`${href}&edit=1`}><Icon name="pages" size={13} /> Edit the page</a>}>
      <p class="nx-answer">
        <b>{fmt(r.visits)}</b> visits in 90 days{r.google?.clicks ? <>, <b>{fmt(r.google.clicks)}</b> from Google search</> : ''}{best ? <>, mostly from “{best.query}”</> : ''}.{chance ? <> The next <b>{fmt(chance.gain)}</b> visits are in “{chance.query}”.</> : ''}
      </p>
      {!r.inSitemap && <p class="nx-note-line warn"><Icon name="triangle" size={14} /><span><b>Not in the sitemap.</b> Search engines find it only through links.</span></p>}

      <PageTimeline site={site} path={path} />

      <button type="button" class="todo-link pv-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Hide the details' : 'Details: every search, content cycle, your decision'}
      </button>
      {more && (
        <>
          {searches.length > 0 && (
            <section class="card card-plain nx-tight" aria-label="Every search">
              <h3 class="nx-label-sm">Every search</h3>
              <div class="pv-qrow pv-qhead" aria-hidden="true"><span>Search</span><span class="nx-num">Google</span><span class="nx-num">Bing</span><span class="nx-num">Seen</span><span class="nx-num">Clicks</span><span>Where it stands</span></div>
              {[...searches].sort((a, b) => b.gain - a.gain || b.clicks - a.clicks).map((q) => (
                <div key={q.query} class="pv-qrow">
                  <span class="nx-qn">“{q.query}”</span><span class="nx-num">{rank(q.position)}</span><span class="nx-num">{rank(q.bing?.position)}</span>
                  <span class="nx-num">{fmt(q.impressions)}</span><span class="nx-num">{fmt(q.clicks)}</span>
                  <span>{q.state === 'top' ? <span class="good">Top 3</span> : q.state === 'p1' ? 'Page 1' : <span class="bad">Page 2+</span>}{q.gain ? <small class="muted"> · +{fmt(q.gain)} in the top 3</small> : ''}</span>
                </div>
              ))}
            </section>
          )}
          {cyc && (
            <section class="card card-plain pv-cycle" aria-label="Content cycle">
              <div class="pv-cyhead">
                <span><small class="muted">Content cycle · {fmtD(cycles.data.report.start)} – {fmtD(cycles.data.report.end)}</small><b class={tone === 'up' ? 'good' : tone === 'down' ? 'bad' : ''}>{word}</b></span>
                <a class="todo-link" href={`#/site/${site.id}/pages?tab=cycles`}>Every page this cycle →</a>
              </div>
              <p class="m-0">{cyc.why}</p>
              <div class="pv-checks">
                <span><small>Google</small>{cyc.google ? `${rank(cyc.google.position)}${cyc.google.query ? ` for “${cyc.google.query}”` : ''}` : 'Not showing up'}</span>
                <span><small>Bing</small>{cyc.bing ? rank(cyc.bing.position) : 'Not showing up'}</span>
                <span><small>AI answers</small>{cyc.ai?.cited ? `Cited ${cyc.ai.cited} times${cyc.ai.engines?.length ? ` by ${cyc.ai.engines.join(', ')}` : ''}` : 'Not cited'}</span>
              </div>
            </section>
          )}
          <section class="card card-plain" aria-label="Your decision">
            <h3 class="nx-label-sm">Your decision</h3>
            <p class="m-0 small"><b>{LABELS[r.suggestion]}.</b> {r.reason}</p>
            <div><DecisionSelect site={site} row={r} onSaved={row.reload} /></div>
            {r.ai ? <p class="muted small m-0">AI assistants sent {fmt(r.ai)} visits in 90 days.</p> : null}
          </section>
        </>
      )}
    </Page>
  );
}
