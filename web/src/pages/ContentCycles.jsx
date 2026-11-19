import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, withParam } from '../hooks.js';
import { Card, Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { RedditCycles } from './RedditCycles.jsx';
import { AddTodo, useTodos } from '../components/Todos.jsx';

// Content cycles (server/content-cycles.mjs): every N days (14 by default) each
// article is measured for that window in Google, Bing and AI, with the readers
// it brought and how many acted, then judged against its previous cycle:
// grow the winners, improve the near-misses, cut what nothing finds.
export const VERDICTS = {
  grow: { label: 'Grow', tone: 'good', title: 'One of the strongest in its category: write more like it' },
  improve: { label: 'Improve', tone: 'warn', title: 'Shown or visited, but it doesn’t win the click or convince' },
  keep: { label: 'Keep', tone: 'good', title: 'Earns a little' },
  watch: { label: 'Watch', tone: 'warn', title: 'Nothing this cycle: cut it if the next is the same' },
  cut: { label: 'Cut', tone: 'bad', title: 'Nothing found it: merge or remove' },
  new: { label: 'Too new', tone: 'idle', title: 'Search engines take a few weeks to place a new page' },
};
const DECIDED = { keep: 'kept', improve: 'to improve', merge: 'to merge', remove: 'to remove' };
// A page's own view (the article editor) lives under Explore → Pages.
const pageHref = (site, path) => `#/site/${site.id}/pages?article=${encodeURIComponent(path)}`;
const shortDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Two kinds of cycle: articles judged on search and AI, and Reddit posts
// planned by Claude and judged on the readers they bring (?kind=reddit).
export function ContentCycles({ site, params }) {
  const kind = params?.get('kind') === 'reddit' ? 'reddit' : 'articles';
  const pick = (key) => { location.hash = withParam('kind', key === 'reddit' ? 'reddit' : '', withParam('post', '', withParam('view', ''))); };
  const inner = Boolean(params?.get('post') || params?.get('view'));
  return (
    <>
      {!inner && (
        <div class="meta-line items-center">
          <Segmented label="Kind of cycle" value={kind} onChange={pick} options={[
            { key: 'articles', label: 'Articles', title: 'Your articles in Google, Bing and AI answers' },
            { key: 'reddit', label: 'Reddit', title: 'Reddit posts researched by Claude and measured by the readers they bring' },
          ]} />
        </div>
      )}
      {kind === 'reddit' ? <RedditCycles site={site} params={params} /> : <ArticleCycles site={site} />}
    </>
  );
}

function ArticleCycles({ site }) {
  const [cycle, setCycle] = useState('');
  const data = useAsync(() => api.get(`/sites/${site.id}/content-cycles${qs({ cycle })}`), [site.id, cycle]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) {
    return <><p class="note">Measuring every article in Google, Bing, AI answers and GA4 for this cycle. The first time takes up to a minute.</p><Loading height={420} /></>;
  }
  const d = data.data;
  if (!d.settings.start) return <StartCycles site={site} d={d} onSaved={data.reload} />;
  return (
    <>
      {d.report ? <Board site={site} d={d} r={d.report} current={d.current} cycle={cycle} setCycle={setCycle} onSaved={data.reload} />
        : <><CycleHead site={site} d={d} cycle={cycle} setCycle={setCycle} onSaved={data.reload} /><Waiting c={d.current} /></>}
    </>
  );
}

// Before the first numbers: what the cycle is doing and on which dates it fills in.
function Waiting({ c }) {
  const steps = [
    { on: c.start, label: 'Cycle started', text: 'Kauzl counts every article from this day.' },
    { on: c.firstDataOn, label: 'First numbers', text: `Google and Bing report each day about two days late, so ${shortDate(c.start)} shows up here on ${shortDate(c.firstDataOn)}. After that, one more day arrives each morning.` },
    { on: c.end, label: 'Cycle ends', text: `The last day counted. Cycle ${c.n + 1} starts the next day.` },
    { on: c.verdictsOn, label: 'Verdicts', text: 'Once the last day has arrived, each article is judged: grow, improve, keep or cut.' },
  ];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card title={`Waiting for ${shortDate(c.start)}’s numbers`} sub={c.paused ? 'Paused: resume to keep measuring' : `They arrive on ${shortDate(c.firstDataOn)}`}>
      <p>Nothing is wrong. Search engines publish each day’s clicks about two days after it ends, so a new cycle starts empty.</p>
      <ol class="cycle-steps">
        {steps.map((s) => (
          <li key={s.label} class={s.on <= today ? 'done' : ''}>
            <b>{shortDate(s.on)}</b> · {s.label}
            <div class="small muted">{s.text}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function StartCycles({ site, d, onSaved }) {
  const [days, setDays] = useState(d.settings.days || 14);
  const [askAi, setAskAi] = useState(true);
  const [msg, setMsg] = useState('');
  const start = async () => {
    setMsg('');
    try {
      await api.post(`/sites/${site.id}/content-cycles`, { on: true, days: Number(days), askAi });
      onSaved();
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <Card title="Test your articles in cycles" sub="Publish many, keep what search and AI pick up, cut the rest">
      <div>
        <p>Every cycle Kauzl measures each article over that exact window. It counts Google and Bing clicks separately and checks whether AI assistants cite the article or send readers. It also counts how many readers stayed (convinced) and how many went on to download or sign up (acted).</p>
        <p>When a cycle ends, each article gets a verdict against its previous cycle. <b>Grow</b> means write more like it, <b>improve</b> means it's shown but loses the click, and <b>cut</b> means nothing found it two cycles running. Articles are compared within their category (your search topics, else the URL section), so a niche guide isn't judged against your biggest post.</p>
        {(d.needs.search || d.needs.ga4) && <p class="note">{d.needs.search ? 'No Search Console property is linked, so Google numbers will be missing. ' : ''}{d.needs.ga4 ? 'No GA4 property is linked, so visits and conversions will be missing.' : ''}</p>}
      </div>
      <div class="row mt-12 items-center gap-12">
        <label class="small">Cycle length <input type="number" min="7" max="60" value={days} style={{ width: '64px' }} onInput={(e) => setDays(e.currentTarget.value)} /> days</label>
        <label class="small"><input type="checkbox" checked={askAi} onChange={(e) => setAskAi(e.currentTarget.checked)} /> Run AI answer checks at the start of each cycle (uses API credits)</label>
        <button class="btn primary" type="button" onClick={start}>Start the first cycle today</button>
      </div>
      {msg && <p class="note">{msg}</p>}
    </Card>
  );
}

// The top line: which cycle, how far along, and the cycle switcher.
function CycleHead({ site, d, cycle, setCycle, onSaved, need }) {
  const c = d.current;
  const s = d.settings;
  const r = d.report;
  const [msg, setMsg] = useState('');
  const save = async (patch) => {
    setMsg('');
    try {
      await api.post(`/sites/${site.id}/content-cycles`, patch);
      onSaved();
    } catch (err) {
      setMsg(err.message);
    }
  };
  const options = [
    ...d.cycles.slice(-5).map((x) => ({ key: String(x.n), label: shortDate(x.start), title: `Cycle ${x.n}: ${shortDate(x.start)} – ${shortDate(x.end)}` })),
    { key: 'live', label: 'This one so far', title: c.measuredTo ? `Cycle ${c.n}: ${shortDate(c.start)} – ${shortDate(c.measuredTo)}` : 'No search data yet' },
  ];
  const shown = cycle || (d.cycles.length ? String(d.cycles.at(-1).n) : 'live');
  const day = Math.min(c.day, s.days);
  const pct = Math.round((day / s.days) * 100);
  const head = need === undefined ? `Cycle ${shortDate(c.start)} – ${shortDate(c.end)}`
    : need ? `${need} page${need === 1 ? ' needs' : 's need'} a decision` : 'Nothing needs a decision';
  const facts = [
    need === undefined ? null : `Cycle ${shortDate(c.start)} – ${shortDate(c.end)}`,
    r ? `${r.rows.length} pages judged on Google, Bing and AI` : null,
    r?.kind === 'live' && c.verdictsOn ? `verdicts final ${shortDate(c.verdictsOn)}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <header class="cb-head">
      <div class="cb-top">
        <h2>{head}</h2>
        <span class="cb-progwrap" title={r?.kind === 'live' ? 'Google and Bing report about two days late, so the newest days can still change' : ''}>
          <span class="nx-prog cb-prog"><i style={{ width: `${pct}%` }} /></span>
          <small>{s.on ? `Day ${day} of ${s.days}` : `Paused on day ${day} of ${s.days}`}</small>
        </span>
      </div>
      <div class="cb-sub">
        <span class="muted">{facts}</span>
        <span class="cb-ctrl">
          {options.length > 1 && <Segmented label="Which cycle" value={shown} onChange={setCycle} options={options} />}
          <label class="small muted"><input type="checkbox" checked={s.askAi} onChange={(e) => save({ askAi: e.currentTarget.checked })} /> AI checks</label>
          <button class="link-btn small" type="button" onClick={() => save({ on: !s.on })}>{s.on ? 'Pause' : 'Resume'}</button>
        </span>
      </div>
      {d.demo && <p class="note m-0">Sample cycles: open one of your own sites to run real ones.</p>}
      {msg && <p class="note m-0">{msg}</p>}
    </header>
  );
}

// Four columns, one card per page. Keep sits with Grow, Watch with Cut.
const COLUMNS = [
  { name: 'Grow', tone: 'up', verdicts: ['grow', 'keep'] },
  { name: 'Improve', tone: 'warn', verdicts: ['improve'] },
  { name: 'Cut', tone: 'down', verdicts: ['cut', 'watch'] },
  { name: 'Too new', tone: 'muted', verdicts: ['new'] },
];
const DOT = { grow: 'up', keep: 'up', improve: 'warn', watch: 'down', cut: 'down', new: 'muted' };

// A page needs you this cycle when its verdict has a next step nobody has taken:
// a winner with no follow-up to-do yet, or an improve/cut not yet marked.
const needsYou = (x, todos) =>
  (x.verdict === 'grow' && !todos.some((t) => t.from === `cycle:${x.path}`))
  || ((x.verdict === 'improve' || x.verdict === 'cut') && !x.decision?.decision);
// Biggest first: winners by what they earn, improves by the readers and
// impressions at stake, cuts by how long they've been live with nothing.
const ORDER = {
  Grow: (a, b) => b.value - a.value,
  Improve: (a, b) => (b.visits || 0) + (b.google?.impressions || 0) / 10 - (a.visits || 0) - (a.google?.impressions || 0) / 10,
  Cut: (a, b) => (a.published || '9').localeCompare(b.published || '9'),
  'Too new': () => 0,
};
const SHOWN = 3;

function Board({ site, d, r, current, cycle, setCycle, onSaved }) {
  const todos = useTodos({ site: site.id });
  const list = todos.data?.todos || [];
  const off = Object.entries(r.sources || {}).filter(([k, v]) => k !== 'ai' && v !== true);
  const need = r.rows.filter((x) => needsYou(x, list)).length;
  return (
    <>
      {off.length > 0 && <p class="note m-0">{off.map(([k, v]) => `${{ google: 'Search Console', bing: 'Bing', ga4: 'GA4' }[k]}: ${v || 'not connected'}.`).join(' ')}</p>}
      <CycleHead site={site} d={d} cycle={cycle} setCycle={setCycle} onSaved={onSaved} need={need} />
      <div class="cboard">
        {COLUMNS.map((col) => (
          <Column key={col.name} col={col} rows={r.rows.filter((x) => col.verdicts.includes(x.verdict)).sort(ORDER[col.name])}
            site={site} r={r} current={current} todos={list} onSaved={onSaved} />
        ))}
      </div>
      <p class="note">Each page is judged once a cycle against the others in its category: <b>Grow</b> (it’s working, add to it), <b>Improve</b> (shown or visited, but it loses the click or the reader), <b>Cut</b> (nothing found it: merge or redirect it), or <b>Too new</b>. Only pages waiting on you get a card; the rest fold into the line at the bottom of each column. Acting on a verdict saves it as the page’s decision.</p>
    </>
  );
}

// Full cards for the first few that need you; the rest as one-line rows.
function Column({ col, rows, site, r, current, todos, onSaved }) {
  const [more, setMore] = useState(false);
  const [quietOpen, setQuietOpen] = useState(false);
  const open = rows.filter((x) => needsYou(x, todos));
  const quiet = rows.filter((x) => !needsYou(x, todos));
  const cards = open.slice(0, SHOWN);
  const rest = open.slice(SHOWN);
  const counts = {};
  for (const x of quiet) {
    const k = x.verdict === 'new' ? 'too new' : x.verdict === 'keep' ? 'keep' : x.verdict === 'watch' ? 'to watch' : x.verdict === 'grow' ? 'with a to-do' : 'already marked';
    counts[k] = (counts[k] || 0) + 1;
  }
  const quietLine = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(' · ');
  const row = (x) => <CompactRow key={x.path} site={site} x={x} todos={todos} onSaved={onSaved} />;
  return (
    <section class="ccol" aria-label={col.name}>
      <h3><span class={col.tone}>{col.name}</span> · {open.length ? `${open.length} to decide` : 'nothing to decide'}</h3>
      {cards.map((x) => <PageCard key={x.path} site={site} x={x} r={r} current={current} todos={todos} onSaved={onSaved} />)}
      {rest.length > 0 && (more
        ? <div class="crows">{rest.map(row)}</div>
        : <button type="button" class="ccol-more" onClick={() => setMore(true)}>Show {rest.length} more to decide</button>)}
      {quiet.length > 0 && (
        <>
          <button type="button" class="ccol-quiet" aria-expanded={quietOpen} onClick={() => setQuietOpen(!quietOpen)}>
            {open.length ? 'Plus ' : ''}{quietLine}{col.name === 'Too new' && current?.verdictsOn ? ` · judged ${shortDate(current.verdictsOn)}` : ''} {quietOpen ? '▴' : '▾'}
          </button>
          {quietOpen && <div class="crows">{quiet.map(row)}</div>}
        </>
      )}
      {!rows.length && <p class="small muted m-0">None this cycle.</p>}
    </section>
  );
}

// One line: the page, its reason on hover, and where it stands.
function CompactRow({ site, x, todos, onSaved }) {
  const [busy, setBusy] = useState(false);
  const decided = x.decision?.decision;
  const todo = todos.find((t) => t.from === `cycle:${x.path}`);
  const state = decided ? `Marked ${DECIDED[decided] || decided}`
    : todo ? (todo.status === 'done' ? 'To-do done' : 'To-do open')
    : { keep: 'Keep', watch: 'Watch', new: 'Too new' }[x.verdict] || '';
  const undo = async () => {
    setBusy(true);
    try {
      await api.post(`/sites/${site.id}/content-cycles/act`, { path: x.path, verdict: 'clear' });
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="crow" title={x.reason || x.why}>
      <a href={pageHref(site, x.path)}>{x.title || x.path}</a>
      <span class="small muted">{state}{decided && <> · <button type="button" class="link-btn" disabled={busy} onClick={undo}>Undo</button></>}</span>
    </div>
  );
}

function PageCard({ site, x, r, current, todos, onSaved }) {
  const label = x.verdict === 'keep' ? 'Keep' : x.verdict === 'watch' ? 'Watch' : '';
  const dots = [...(x.past || []), { n: r.n, start: r.start, verdict: x.verdict, now: true }];
  return (
    <article class="ccard">
      <a class="ccard-title" href={pageHref(site, x.path)} title={x.path}>{x.title || x.path}</a>
      {label && <span class={`ccard-sub ${DOT[x.verdict]}`}>{label}</span>}
      <span class="cwhy" title={x.why}>{x.reason || x.why}</span>
      <div class="cfoot">
        <Next site={site} x={x} current={current} todos={todos} onSaved={onSaved} />
        <span class="cdots" aria-label="Verdict each cycle">
        {dots.map((h) => <span key={h.n} class={`cdot ${DOT[h.verdict]}`} title={`${shortDate(h.start)}: ${VERDICTS[h.verdict].label}${h.now ? ' (this cycle)' : ''}`}><i />{monthOf(h.start)}</span>)}
        </span>
      </div>
    </article>
  );
}
const monthOf = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

// What to do this cycle, and where it stands: one click from a verdict to a
// decision or a to-do.
function Next({ site, x, current, todos, onSaved }) {
  const [busy, setBusy] = useState(false);
  const act = async (verdict) => {
    setBusy(true);
    try {
      await api.post(`/sites/${site.id}/content-cycles/act`, { path: x.path, verdict });
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  const from = `cycle:${x.path}`;
  const added = todos.find((t) => t.from === from);
  const link = pageHref(site, x.path);
  const decided = x.decision?.decision;
  return (
    <div class="cnext">
      {x.verdict === 'grow' && (
        <AddTodo site={site} added={added} class="btn cycle-act" label="To-do: write a follow-up"
          todo={{ title: `Write a follow-up to ${x.title || x.path}${x.google?.query ? ` around “${x.google.query}”` : ''}`, detail: x.why, link, from, subject: { kind: 'search', key: x.path } }} />
      )}
      {(x.verdict === 'cut' || x.verdict === 'improve') && (decided
        ? <button class="btn ghost cycle-act" type="button" disabled={busy} onClick={() => act('clear')}>Undo</button>
        : <button class="btn cycle-act" type="button" disabled={busy} onClick={() => act(x.verdict)}>{x.verdict === 'cut' ? 'Mark to remove' : 'Mark to improve'}</button>)}
      {x.verdict === 'improve' && <a class="btn ghost cycle-act" href={link}>Open in editor</a>}
    </div>
  );
}
