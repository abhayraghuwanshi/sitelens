import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo, useTodos } from '../components/Todos.jsx';
import { DecisionSelect, LABELS } from '../pages/PageReview.jsx';
import { Page } from './Page.jsx';

// One page (docs/redesign → Pages → a page's view): its title and one status
// word, two sentences on what it does for you and the one thing that matters
// now, its visits over 90 days with each change marked and its goal, the
// searches it's found for (and could be), what changed and what happened
// after, one next step, and everything else behind Details. Editing the page
// itself (title, description, the file) is a click away (?edit=1).
const DAY = 86_400_000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addD = (d, n) => iso(Date.parse(`${d}T00:00:00Z`) + n * DAY);
const fmtD = (d, o = { day: 'numeric', month: 'short' }) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-US'));
const pct = (c) => `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}%`;
const rank = (p) => (p == null ? '—' : `#${Math.round(p)}`);
const ctrAt = (p) => (p == null ? 0 : p <= 1.5 ? 0.28 : p <= 2.5 ? 0.15 : p <= 3.5 ? 0.11 : p <= 5.5 ? 0.07 : p <= 10.5 ? 0.03 : p <= 20.5 ? 0.01 : 0.002);
const SHORT = { cut: 'Cut', 'improve-content': 'Improve', 'improve-title': 'New title', 'not-found': 'Not in search', watch: 'Small', new: 'Too new', keep: 'Working', needed: 'Needed' };
const TONE = { cut: 'down', 'improve-content': 'warn', 'improve-title': 'warn', 'not-found': 'warn', watch: 'muted', new: 'muted', keep: 'up', needed: 'up' };
const CYCLE = { grow: ['Grow', 'up'], improve: ['Improve', 'warn'], cut: ['Cut', 'down'], new: ['Too new', 'muted'], wait: ['Too new', 'muted'] };
const KIND_ICON = { deploy: 'rocket', release: 'github', post: 'megaphone', mention: 'chat', note: 'star', edit: 'pages', todo: 'check' };

export function PageView({ site, path, back }) {
  const last = iso(Date.now() - DAY);
  const from = addD(last, -89);
  const row = useAsync(() => api.get(`/sites/${site.id}/page-goal${qs({ path, range: '90d' })}`), [site.id, path]);
  const hub = useAsync(() => api.get(`/sites/${site.id}/search-hub${qs({ range: '90d' })}`).catch(() => null), [site.id]);
  const series = useAsync(() => api.get(`/calendar/breakdown${qs({ site: site.id, from, to: last, by: 'page', daily: 1, key: path })}`).catch(() => null), [site.id, path, from]);
  const events = useAsync(() => api.get(`/calendar/events${qs({ site: site.id, from, to: last })}`).catch(() => null), [site.id, from]);
  const detail = useAsync(() => (site.demo ? null : api.get(`/sites/${site.id}/articles/detail${qs({ path, range: '28d' })}`).catch(() => null)), [site.id, path]);
  const cycles = useAsync(() => api.get(`/sites/${site.id}/content-cycles`).catch(() => null), [site.id]);
  const todos = useTodos({ site: site.id });
  const [more, setMore] = useState(false);

  if (row.error) return <Page title={path} back={back}><ErrorState error={row.error} onRetry={row.reload} /></Page>;
  if (!row.data) return <Page title={path} back={back}><Loading height={420} owl label="Reading the page: its searches, visits and changes…" /></Page>;
  const r = row.data;

  // Its days: visits that landed on it.
  const dates = series.data?.dates || [];
  const vals = series.data?.rows?.[0]?.days || dates.map(() => 0);
  const byDate = new Map(dates.map((d, i) => [d, vals[i]]));
  const sumDays = (a, n) => Array.from({ length: n }, (_, i) => byDate.get(addD(a, i)) || 0).reduce((x, y) => x + y, 0);
  // What changed: marks that name the page, edits made in Kauzl, and to-dos done for it.
  const file = r.file?.file || '';
  const mentions = (text) => path !== '/' && (String(text || '').includes(path) || (file && String(text || '').includes(file)));
  const pageTodos = (todos.data?.todos || []).filter((t) => (t.link || '').includes(encodeURIComponent(path)) || (t.from || '').includes(`:${path}`) || (path !== '/' && t.title.includes(path)));
  const changes = [
    ...(events.data?.events || []).filter((e) => mentions(e.label) || mentions(e.url)).map((e) => ({ date: e.date, kind: KIND_ICON[e.kind] ? e.kind : 'note', title: e.label, url: e.url })),
    ...(detail.data?.updates || []).map((u) => ({ date: u.date, kind: 'edit', title: u.label.replace(/^[^:]*:\s*/, '') || 'Edited in Kauzl', url: (u.body || '').split('\n')[0].startsWith('http') ? u.body.split('\n')[0] : '' })),
    ...pageTodos.filter((t) => t.status === 'done' && t.doneAt).map((t) => ({ date: iso(t.doneAt), kind: 'todo', title: t.title })),
  ].filter((c) => c.date >= from).sort((a, b) => (a.date < b.date ? 1 : -1));
  // Each change: visits in the 3 weeks after it against the 3 weeks before (or as many days as there are).
  const effectOf = (c) => {
    const n = Math.min(21, Math.floor((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${c.date}T00:00:00Z`)) / DAY));
    if (n < 3) return { early: true };
    const before = sumDays(addD(c.date, -n), n);
    const after = sumDays(addD(c.date, 1), n);
    return before ? { c: after / before - 1, n } : { none: true };
  };

  // Its searches (Google, from Search Console's page × search report), with where Bing has the same search.
  const bingOf = new Map((hub.data?.queries || []).map((q) => [q.key, q.bing]));
  const searches = (hub.data?.queryPages || []).filter((q) => q.path === path).map((q) => {
    const gain = Math.round((q.impressions || 0) * Math.max(0, ctrAt(3) - ctrAt(q.position)));
    const bing = bingOf.get(q.query);
    const split = bing?.position && q.position && Math.abs(bing.position - q.position) >= 5;
    return { ...q, gain, bing, split, state: q.position <= 3.5 ? 'top' : q.position <= 10.5 ? 'p1' : 'p2' };
  }).sort((a, b) => b.clicks - a.clicks);
  const found = searches.filter((q) => q.state !== 'p2').slice(0, 4);
  const could = searches.filter((q) => q.gain > 0 && !found.includes(q)).sort((a, b) => b.gain - a.gain).slice(0, 3);
  const chance = [...searches].filter((q) => q.gain > 0).sort((a, b) => b.gain - a.gain)[0];
  const best = searches[0] || (r.google?.queries?.[0] ? { query: r.google.queries[0].query } : null);

  // One status word: this cycle's verdict, else the page review's.
  const cyc = cycles.data?.report?.rows?.find((x) => x.path === path);
  const [word, tone] = cyc && CYCLE[cyc.verdict] ? CYCLE[cyc.verdict] : [SHORT[r.suggestion] || r.suggestion, TONE[r.suggestion] || ''];

  // Two sentences: what it does for you, then the one thing that matters now.
  const visits = vals.reduce((a, b) => a + b, 0) || r.visits;
  const lastChange = changes[0];
  const lastEffect = lastChange && effectOf(lastChange);
  const now = lastChange && lastEffect?.early ? `The ${fmtD(lastChange.date)} change is too new to judge.`
    : lastChange && lastEffect?.c !== undefined && Math.abs(lastEffect.c) >= 0.1 ? `Visits ${lastEffect.c > 0 ? 'rose' : 'slipped'} ${pct(lastEffect.c).replace(/^[+−]/, '')} after the ${fmtD(lastChange.date)} change.`
    : chance ? <>The next <b>{fmt(chance.gain)}</b> visits are in “{chance.query}”.</> : r.goal?.servingText || '';

  // One next step: the goal's, else an open to-do's, else nothing to do.
  const open = pageTodos.find((t) => t.status === 'open');
  const next = r.goal?.next;
  const [step, why] = open ? [open.title, 'An open to-do for this page.']
    : next ? [next.title, [next.why, next.gain && `Worth ${next.gain}.`, next.checkBy && `Check by ${fmtD(next.checkBy)}.`].filter(Boolean).join(' ')]
    : ['Nothing to do right now', 'It’s doing its job.'];
  const goal = r.goal?.target ? { text: r.goal.target.title, share: r.goal.progress?.share } : next ? { text: next.title, share: null } : null;
  const href = `#/site/${site.id}/pages?article=${encodeURIComponent(path)}`;

  return (
    <Page title={<>{r.title || path} <span class={`nx-pill ${tone} pv-stat`} title={cyc?.why || r.reason}>{word}</span></>} sub={path} back={back}
      actions={<a class="btn" href={`${href}&edit=1`}><Icon name="pages" size={13} /> Edit the page</a>}>
      <p class="nx-answer">
        <b>{fmt(visits)}</b> visits in 90 days{r.google?.clicks ? <>, <b>{fmt(r.google.clicks)}</b> from Google search</> : ''}{best ? <>, mostly from “{best.query}”</> : ''}. {now}
      </p>
      {!r.inSitemap && <p class="nx-note-line warn"><Icon name="triangle" size={14} /><span><b>Not in the sitemap.</b> Search engines find it only through links.</span></p>}

      <section class="card card-plain pv-chart" aria-label="Visits, last 90 days">
        <div class="pv-chhead">
          <h2 class="nx-h2">Visits <span class="muted small">· last 90 days{changes.length ? ', with each change marked' : ''}</span></h2>
          {goal && (
            <span class="pv-goal"><span class="muted small">Goal: {goal.text}</span>{goal.share != null && <span class="nx-prog"><i style={`width:${Math.round(goal.share * 100)}%`} /></span>}</span>
          )}
        </div>
        {!series.data && series.loading ? <Loading height={140} />
          : series.data?.rows?.length ? <Chart dates={dates} vals={vals} changes={changes} />
          : <p class="muted small m-0">No daily visits are stored for this page yet: Kauzl keeps each day’s top 100 landing pages, and this one hasn’t been among them.</p>}
      </section>

      <div class="pv-cols">
        <section class="card card-plain pv-box" aria-label="Found for">
          <h3 class="nx-label-sm">Found for</h3>
          {!hub.data ? <p class="muted small m-0">{hub.loading ? 'Reading searches…' : 'Connect Search Console to see the searches it shows up for.'}</p>
            : found.length ? found.map((q) => <QueryRow key={q.query} site={site} q={q} right={<span class="nx-num muted">{fmt(q.clicks)}</span>} />)
            : <p class="muted small m-0">No search shows it on page 1 yet.</p>}
          {could.length > 0 && (
            <>
              <h3 class="nx-label-sm pv-gap">Could be found for</h3>
              {could.map((q) => <QueryRow key={q.query} site={site} q={q} right={<span class="nx-num good">+{fmt(q.gain)}</span>} />)}
            </>
          )}
        </section>
        <section class="card card-plain pv-box" aria-label="What changed">
          <h3 class="nx-label-sm">What changed</h3>
          {changes.length ? changes.slice(0, 2).map((c, i) => <ChangeRow key={i} c={c} e={effectOf(c)} />)
            : <p class="muted small m-0">No changes tracked for this page in 90 days. Deploys and commits that name it, edits made here, and to-dos you tick off show up here.</p>}
          {changes.length > 2 && <button type="button" class="todo-link" onClick={() => setMore(true)}>All {changes.length} changes →</button>}
        </section>
      </div>

      <div class="pv-next">
        <span class="pv-nl">Next</span>
        <span class="pv-nb"><b>{step}</b><small>{why}</small></span>
        <span class="nx-btns">
          {!open && next && <AddTodo site={site} todo={{ title: next.title, from: `goal:${path}:${next.key}`, link: href, subject: { kind: 'page', key: path } }} label="To-do" />}
          {open && <a class="btn" href={`#/site/${site.id}/inbox?tab=todos&open=${open.id}`}>Open the to-do</a>}
        </span>
      </div>

      <button type="button" class="todo-link pv-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Hide the details' : 'Details: every search, every change, content cycle, your decision'}
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
          {changes.length > 0 && (
            <section class="card card-plain" aria-label="Every change">
              <h3 class="nx-label-sm">Changes · and what happened after each</h3>
              {changes.map((c, i) => <ChangeRow key={i} c={c} e={effectOf(c)} />)}
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

function QueryRow({ site, q, right }) {
  return (
    <a class="pv-ff" href={`#/site/${site.id}/search?q=${encodeURIComponent(q.query)}`}>
      <span class="nx-qn">“{q.query}”</span>
      <span class={`nx-pill${q.state === 'top' ? ' up' : ''}`} title={q.split ? `Google ${rank(q.position)}, Bing ${rank(q.bing.position)}` : `Google ${rank(q.position)}`}>
        {rank(q.position)}{q.split && <i class="pv-engdot" />}
      </span>
      {right}
    </a>
  );
}

function ChangeRow({ c, e }) {
  return (
    <div class="pv-chg">
      <span class="muted">{fmtD(c.date)}</span>
      <span class="nx-hk"><Icon name={KIND_ICON[c.kind] || 'star'} size={13} /></span>
      <span class="pv-chb">
        <b>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a> : c.title}</b>
        <span class={e.early || e.none ? 'muted' : e.c >= 0.1 ? 'good' : e.c <= -0.1 ? 'bad' : 'muted'}>
          {e.early ? 'Too early to judge' : e.none ? 'No visits before it to compare' : `Visits ${pct(e.c)} in the ${e.n} days after`}
        </span>
      </span>
    </div>
  );
}

// Its visits each day, with a dashed line and an icon at each change.
function Chart({ dates, vals, changes }) {
  const n = dates.length;
  if (n < 2) return <p class="muted small m-0">No visits recorded yet.</p>;
  const mx = Math.max(1, ...vals);
  const W = 600;
  const H = 130;
  const X = (i) => (i / (n - 1)) * W;
  const Y = (v) => H - (v / mx) * (H - 6);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const marks = changes.map((c) => ({ ...c, i: dates.indexOf(c.date) })).filter((c) => c.i >= 0);
  const pos = (i) => `${((i / (n - 1)) * 100).toFixed(2)}%`;
  return (
    <div class="pv-plotwrap">
      <span class="tl-ylab" style="top:0">{fmt(mx)}</span>
      <div class="pv-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="var(--accent)" opacity=".1" />
          <path d={line} fill="none" stroke="var(--accent)" stroke-width="1.8" vector-effect="non-scaling-stroke" />
        </svg>
        {marks.map((m, k) => <span key={k} class="pv-hline" style={`left:${pos(m.i)}`} />)}
        <div class="tl-cols">{dates.map((d, i) => <span key={d} title={`${fmtD(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmt(vals[i])} visits${marks.filter((m) => m.i === i).map((m) => ` · ${m.title}`).join('')}`} />)}</div>
      </div>
      <div class="tl-marks pv-marks">{marks.map((m, k) => <span key={k} style={`left:${pos(m.i)}`} title={`${fmtD(m.date)}: ${m.title}`}><Icon name={KIND_ICON[m.kind] || 'star'} size={11} /></span>)}</div>
      <div class="tl-xl pv-xl"><span style="left:0%">{fmtD(dates[0])}</span><span style="left:100%">{fmtD(dates[n - 1])}</span></div>
    </div>
  );
}
