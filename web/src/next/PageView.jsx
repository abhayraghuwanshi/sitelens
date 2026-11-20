import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { DecisionSelect, LABELS } from '../pages/PageReview.jsx';
import { Page } from './Page.jsx';
import { PageTimeline, TOOL_ICON } from './PageTimeline.jsx';

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
  // Bing's own report for this page: the searches it showed the page for, in Bing's wording.
  const bingPage = useAsync(() => (site.demo ? null : api.get(`/bing/sites/${site.id}/page-queries${qs({ path })}`).catch(() => null)), [site.id, path]);
  const cycles = useAsync(() => api.get(`/sites/${site.id}/content-cycles`).catch(() => null), [site.id]);
  const [more, setMore] = useState(false);
  const [version, setVersion] = useState(0);

  if (row.error) return <Page title={path} back={back}><ErrorState error={row.error} onRetry={row.reload} /></Page>;
  if (!row.data) return <Page title={path} back={back}><Loading height={420} owl label="Reading the page: its searches, visits and changes…" /></Page>;
  const r = row.data;

  // Its searches (Google, from Search Console's page × search report), with where Bing has the same search.
  const bingPageOf = new Map((bingPage.data?.queries || []).map((q) => [q.query.toLowerCase(), q]));
  const bingOf = new Map((hub.data?.queries || []).map((q) => [q.key, bingPageOf.get(q.key) || q.bing]));
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
      actions={<span class="nx-btns"><a class="btn" href={`${href}&edit=1`}><Icon name="pages" size={13} /> Edit the page</a></span>}>
      <p class="nx-answer">
        <b>{fmt(r.visits)}</b> visits in 90 days{r.google?.clicks ? <>, <b>{fmt(r.google.clicks)}</b> from Google search</> : ''}{best ? <>, mostly from “{best.query}”</> : ''}.{chance ? <> The next <b>{fmt(chance.gain)}</b> visits are in “{chance.query}”.</> : ''}
      </p>
      {!r.inSitemap && <p class="nx-note-line warn"><Icon name="triangle" size={14} /><span><b>Not in the sitemap.</b> Search engines find it only through links.</span></p>}

      <PageChecks site={site} path={path} onRan={() => setVersion((v) => v + 1)} />
      <PageTimeline site={site} path={path} version={version} />
      <PageSearches site={site} path={path} bingPage={bingPage.data} />

      <button type="button" class="todo-link pv-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Hide the details' : 'Details: content cycle, your decision'}
      </button>
      {more && (
        <>
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

// The searches the page is found for, on Google (GET /page-searches) or Bing (Bing's report for the
// page), one engine at a time: each with 13 weeks of how often it was searched, whether that's rising,
// where the page ranks and its clicks. Demand and rank side by side say whether a move is the trend or the page.
function PageSearches({ site, path, bingPage }) {
  const res = useAsync(() => (site.demo ? null : api.get(`/sites/${site.id}/page-searches${qs({ path })}`).catch(() => null)), [site.id, path]);
  const [eng, setEng] = useState('');
  const [all, setAll] = useState(false);
  const google = res.data?.searches || [];
  const bing = bingPage?.queries || [];
  if (!google.length && !bing.length) return res.loading ? <section class="card card-plain ps ps-load" aria-hidden="true" /> : null;
  const on = eng || (google.length ? 'google' : 'bing');
  const list = on === 'google' ? google : bing;
  const shown = all ? list : list.slice(0, 8);
  const enough = list.filter((q) => q.impressions >= 10);
  const up = enough.filter((q) => q.change != null && q.change >= 0.15).length, down = enough.filter((q) => q.change != null && q.change <= -0.15).length;
  const pick = (k) => { setEng(k); setAll(false); };
  return (
    <section class="card card-plain ps" aria-label="Searches it’s found for">
      <div class="ps-h">
        <h2 class="nx-label-sm">Searches it’s found for</h2>
        <span class="ps-tabs" role="tablist" aria-label="Search engine">
          {[['google', 'Google', google.length], ['bing', 'Bing', bing.length]].map(([k, l, n]) => (
            <button key={k} type="button" role="tab" aria-selected={on === k} class={on === k ? 'on' : ''} onClick={() => pick(k)}>{l} <b>{n}</b></button>
          ))}
        </span>
      </div>
      <p class="muted small m-0">{list.length ? `${list.length} searches · 13 weeks${up || down ? ` · ${up} searched more, ${down} less` : ''}${on === 'bing' ? ' · Bing’s own report for this page' : ''}` : on === 'bing' ? 'Bing hasn’t shown this page for any search in 90 days.' : 'Google hasn’t shown this page for any search in 13 weeks.'}</p>
      {list.length > 0 && <div class="ps-row ps-head" aria-hidden="true"><span>Search</span><span>Searched, 13 weeks</span><span class="nx-num">Trend</span><span class="nx-num">Position</span><span class="nx-num">Clicks</span></div>}
      {shown.map((q) => {
        const mx = Math.max(1, ...q.weeks.map((w) => w.impressions));
        const moved = q.position != null && q.was != null && Math.abs(q.was - q.position) >= 1 ? (q.was > q.position ? 'up' : 'down') : '';
        // Under 10 views a percentage is noise (3 views → 0 is "−100%").
        const ch = q.impressions < 10 ? (q.change == null ? 'new' : 'few') : q.change == null ? 'new' : Math.round(q.change * 100);
        return (
          <a key={q.query} class="ps-row" href={`#/site/${site.id}/search?range=90d${on === 'bing' ? '&eng=bing' : ''}&q=${encodeURIComponent(q.query)}`}>
            <span class="ps-q">“{q.query}”<small>{fmt(q.impressions)} {q.impressions === 1 ? 'view' : 'views'}</small></span>
            <span class="ps-spark" title={q.weeks.map((w) => w.impressions).join(', ')}>{q.weeks.map((w, i) => <i key={i} style={`height:${Math.max(6, (w.impressions / mx) * 100)}%`} class={i >= q.weeks.length - 4 ? 'now' : ''} />)}</span>
            <span class={`nx-num ${ch === 'few' ? 'muted' : ch === 'new' || ch >= 15 ? 'good' : ch <= -15 ? 'bad' : 'muted'}`} title={ch === 'few' ? 'Too few views to call a trend' : undefined}>{ch === 'few' ? 'few' : ch === 'new' ? 'new' : `${ch > 0 ? '↑' : ch < 0 ? '↓' : ''}${Math.abs(ch)}%`}</span>
            <span class="nx-num">{rank(q.position)}{moved && <small class={moved === 'up' ? 'good' : 'bad'}>{moved === 'up' ? '▲' : '▼'} {rank(q.was)}</small>}</span>
            <span class="nx-num">{fmt(q.clicks)}</span>
          </a>
        );
      })}
      {list.length > 8 && <button type="button" class="todo-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
      {list.length > 0 && <p class="muted small m-0">Trend: searches in the last 4 weeks against the 4 before.{on === 'google' ? ' ▲/▼: your position 13 weeks ago.' : ''} Click a search for its full trend.</p>}
    </section>
  );
}

// The page's checks, run here: one tile per check with its last result, and Run. A run lands on the
// timeline below (server/diagnose.mjs → page-events), so it reloads after each one.
function PageChecks({ site, path, onRan }) {
  const ov = useAsync(() => (site.demo ? null : api.get(`/sites/${site.id}/diagnose${qs({ path })}`).catch(() => null)), [site.id, path]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!ov.data) return null;
  const run = async (tool) => {
    setBusy(tool);
    setError('');
    try {
      const r = await api.post(`/sites/${site.id}/diagnose/run`, { path, tool });
      if (r.failed) setError(`${r.findings?.[0]?.text || 'The check couldn’t run.'}`);
      ov.reload();
      onRan();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  const short = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <section class="pc" aria-label="Checks">
      <div class="pc-h"><h2 class="nx-label-sm">Checks</h2><a class="todo-link small" href={`#/site/${site.id}/diagnose?path=${encodeURIComponent(path)}`}>All in Diagnose →</a></div>
      <div class="pc-grid">
        {ov.data.tools.map((t) => (
          <div key={t.key} class={`pc-t ${t.last?.tone || ''}`}>
            <span class="pc-ic"><Icon name={TOOL_ICON[t.key] || 'search'} size={14} /></span>
            <span class="pc-b">
              <b>{t.name.replace('As Googlebot and GPTBot', 'As crawlers see it')}</b>
              <small>{t.last ? <><span class={`pc-r ${t.last.tone || ''}`}>{t.last.headline}</span> · {short(t.last.date)}</> : 'Not run yet'}</small>
            </span>
            <button type="button" class="pc-run" disabled={Boolean(busy)} onClick={() => run(t.key)} aria-label={`Run ${t.name}`} aria-busy={busy === t.key}>
              {busy === t.key ? <span class="pc-spin" /> : <Icon name="play" size={11} />}{busy === t.key ? 'Running' : 'Run'}
            </button>
          </div>
        ))}
      </div>
      {error && <p class="nx-error small m-0" role="alert">{error}</p>}
    </section>
  );
}
