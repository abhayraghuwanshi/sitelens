import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Segmented, Loading, ErrorState } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { CommentBody } from '../components/ClaudeComments.jsx';
import { Page } from './Page.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';
import { DayPanel, usualOf } from './Timeline.jsx';
import { LeftOutLine } from './LeaveOut.jsx';
import { AddTodo, useTodos } from '../components/Todos.jsx';
import { Marked } from '../components/Marks.jsx';

// Yesterday is one whole day, set against the same weekday a week before.
const weekday = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

// One site's period as a story: ask Claude, what's waiting on you, what happened
// (a sentence and the days, each one opening beside the page), who brought the
// visits, what it led to and what to do next.
const RANGES = [{ key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: '7d', label: '7 days' }, { key: '28d', label: '28 days' }, { key: '90d', label: '90 days' }];
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const long = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY = 86_400_000;
const addD = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const pct = (c) => (c === null || !Number.isFinite(c) ? '—' : `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}%`);
const KIND_ICON = { deploy: 'rocket', release: 'github', post: 'megaphone', extension: 'puzzle', mention: 'chat', note: 'star', claude: 'sparkles' };

// The address with some params changed ('' removes one), for this Story.
const storyHref = (site, params, patch) => {
  const p = new URLSearchParams(params);
  for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
  const q = p.toString();
  return `#/site/${site.id}${q ? `?${q}` : ''}`;
};

export function Story({ site, params, waiting }) {
  // One period for the whole app: the Story and the reports share it.
  const [saved, setSaved] = usePersistent('range', '28d');
  const wanted = params.get('range') || saved;
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const pick = (key) => {
    setSaved(key);
    location.hash = `/site/${site.id}?range=${key}`;
  };

  const isToday = range === 'today';
  const back = range === 'yesterday' ? 7 : undefined;
  const story = useAsync(() => (isToday ? null : api.get(`/sites/${site.id}/story${qs({ range })}`)), [site.id, range]);
  const r = story.data?.range;
  const span = r ? { site: site.id, from: r.from, to: r.to } : null;
  // A few weeks before the period too: a usual weekday, and the days before a dragged stretch.
  const metrics = useAsync(() => (span ? api.get(`/calendar/metrics${qs({ ...span, from: addD(span.from, -Math.max(28, daysIn(span))) })}`) : null), [span?.from, span?.to, site.id]);
  const sources = useAsync(() => (span ? api.get(`/calendar/breakdown${qs({ ...span, by: 'source', limit: 6, back })}`) : null), [span?.from, span?.to, site.id]);
  const marks = useAsync(() => (span ? api.get(`/annotations${qs({ from: span.from, to: span.to, scope: `site:${site.id}` })}`) : null), [span?.from, span?.to, site.id]);

  return (
    <Page title={site.label}
      sub={isToday ? 'Today so far, against a usual day like it' : r && back ? `${weekday(r.from)} ${short(r.from)}, against the ${weekday(r.from)} before` : r ? `${short(r.from)} – ${short(r.to)}, against the ${range.replace('d', '')} days before · whole days only` : site.host}
      actions={<Segmented label="Period" value={range} options={RANGES} onChange={pick} />}>
      <Ask site={site} span={span} />
      <Waiting site={site} waiting={waiting} />
      <SetupNote site={site} />
      {!isToday && <LeftOutLine site={site} range={range} />}
      {isToday ? <><Today site={site} onYesterday={() => pick('yesterday')} /><NextSteps site={site} range="7d" /></> : story.error ? <ErrorState error={story.error} onRetry={story.reload} /> : !story.data ? <Loading height={260} /> : (
        <>
          <Traffic site={site} params={params} story={story.data} span={span} metrics={metrics.data} marks={marks.data?.annotations || []} />
          <Sources site={site} rows={sources.data?.rows} changes={story.data.changes} range={range} />
          <Results site={site} range={range} n="" />
          <NextSteps site={site} range={range} />
        </>
      )}
    </Page>
  );
}

const daysIn = (span) => Math.round((Date.parse(span.to) - Date.parse(span.from)) / DAY) + 1;

// Ask Claude: a question about this site, answered on the page by the analyst
// (the same tools the MCP server gives Claude Code). The answer is also kept as a
// Claude note on the day it's about, so it shows on the Timeline.
const ASKS = ['Why did visits change in this period?', 'Which page should I improve next?', 'Is traffic from AI tools worth it?'];

function Ask({ site, span }) {
  const status = useAsync(() => api.get('/claude/status').catch(() => null), []);
  const [q, setQ] = useState('');
  const [state, setState] = useState(null); // { q, busy } | { q, answer } | { q, error }
  const hasKey = Boolean(status.data?.source);
  const today = new Date().toISOString().slice(0, 10);
  const from = span?.from || addD(today, -28);
  const to = span?.to || addD(today, -1);

  async function ask(question) {
    const text = question.trim();
    if (!text || state?.busy) return;
    setState({ q: text, busy: true });
    try {
      const out = await api.post(`/sites/${site.id}/claude/analyze`, { from, to, question: text });
      setState({ q: text, answer: out.comment });
      setQ('');
    } catch (err) {
      setState({ q: text, error: err.hint ? `${err.message} ${err.hint}` : err.message });
    }
  }

  return (
    <section class="card card-plain nx-ask" aria-label="Ask Claude">
      <form class="nx-askin" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <Icon name="chat" size={16} />
        <label class="sr-only" for="nx-ask-q">Ask Claude about {site.label}</label>
        <input id="nx-ask-q" type="text" maxLength={500} value={q} disabled={!hasKey || state?.busy}
          placeholder={`Ask anything about ${site.label}…`} onInput={(e) => setQ(e.currentTarget.value)} />
        {hasKey && q.trim() && <button type="submit" class="btn primary" disabled={state?.busy}>Ask</button>}
        {state && !state.busy && <button type="button" class="nx-link" onClick={() => setState(null)}>Clear</button>}
      </form>
      {!status.data ? null : !hasKey ? (
        <p class="muted small m-0">Claude answers here using the Anthropic key saved for AI answer checks. <a href="#/account?i=anthropic">Add a key</a></p>
      ) : state?.busy ? (
        <p class="nx-ask-answer"><b>{state.q}</b><span class="muted"> Claude is reading your numbers. This usually takes 20–60 seconds.</span></p>
      ) : state?.error ? (
        <p class="nx-ask-answer"><b>{state.q}</b> <span class="bad">{state.error}</span></p>
      ) : state?.answer ? (
        <div class="nx-ask-answer">
          <b>{state.answer.label}</b>
          {state.answer.body && <CommentBody text={state.answer.body} />}
          <a class="muted small" href={`#/site/${site.id}/timeline?month=${state.answer.date.slice(0, 7)}&day=${state.answer.date}`}>Kept as a Claude note on {short(state.answer.date)} →</a>
        </div>
      ) : (
        <div class="nx-chips">
          {ASKS.map((x) => <button key={x} type="button" class="nx-chip" onClick={() => ask(x)}>{x}</button>)}
        </div>
      )}
    </section>
  );
}

// One line for everything waiting on you here: alerts, to-dos and goals behind.
function Waiting({ site, waiting }) {
  if (!waiting) return null;
  const n = waiting.alerts + waiting.todos + waiting.goals;
  if (!n) return null;
  const parts = [
    waiting.alerts && `${waiting.alerts} alert${waiting.alerts === 1 ? '' : 's'}`,
    waiting.todos && `${waiting.todos} to-do${waiting.todos === 1 ? '' : 's'}`,
    waiting.goals && `${waiting.goals} goal${waiting.goals === 1 ? '' : 's'} behind`,
  ].filter(Boolean);
  return (
    <a class="nx-needs" href={`#/site/${site.id}/inbox`}>
      <Icon name="inbox" size={16} />
      <span><b>{n} waiting on you</b> · {parts.join(', ')}</span>
      <span class="nx-needs-go">Inbox →</span>
    </a>
  );
}

// Setup that stops a part of the story from being told (not an alert, so not in the Inbox).
function SetupNote({ site }) {
  const ai = useAsync(() => api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null), [site.id]);
  if (!ai.data || ai.data.lastRun || !ai.data.prompts?.length) return null;
  return (
    <a class="nx-callout" href={`#/site/${site.id}/search?tab=ai`}>
      <Icon name="triangle" size={14} />
      <span><b>AI answer checks have never run.</b> {ai.data.prompts.length} questions are set up{ai.data.keySource ? '' : ' but no Anthropic key is set'}, so Kauzl can’t say whether assistants name you.</span>
    </a>
  );
}

// Today so far, from GA4's real-time and today reports. Today isn't over, so it
// is set against a usual same weekday's whole day, not against yesterday.
function Today({ site, onYesterday }) {
  const dash = useAsync(() => api.get(`/sites/${site.id}/dashboard?range=today`), [site.id]);
  const live = useAsync(() => api.get(`/sites/${site.id}/live`).catch(() => null), [site.id]);
  const to = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const from = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const past = useAsync(() => api.get(`/calendar/metrics${qs({ site: site.id, from, to })}`).catch(() => null), [site.id, to]);
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  if (!dash.data) return <section class="card card-plain"><Loading height={240} /></section>;

  const rep = dash.data.reports;
  const now = rep.overview.current;
  const day = rep.trend[0]?.date || '';
  const weekday = (day ? new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}T12:00:00Z`) : new Date()).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const same = (past.data?.days || []).filter((d) => d.weekday === weekday && Number.isFinite(d.sessions));
  const usual = same.length ? Math.round(same.reduce((n, d) => n + d.sessions, 0) / same.length) : null;
  // Hours are in the property's time zone; the last one reported is "now".
  const trend = rep.trend;
  const left = 23 - (trend.at(-1)?.hour ?? 23);
  const countries = rep.countries.slice(0, 3).filter((c) => c.sessions > 0);
  const headline = usual === null
    ? `${fmt(now.sessions)} visits so far today.`
    : `${fmt(now.sessions)} visits so far today${left > 0 ? `, with ${left} hour${left === 1 ? '' : 's'} to go` : ''}. A usual ${weekday} has ${fmt(usual)} by the end of the day.`;

  return (
    <section class="card card-plain" aria-label="Today">
      <SectionHead title="Today so far" more={{ href: `#/site/${site.id}/pages?range=today`, label: 'Today’s pages' }} />
      <p class="nx-headline">{headline}</p>
      <p class="nx-lede">
        {Math.round((now.engagementRate || 0) * 100)}% engaged.
        {countries.length > 0 && ` Most came from ${countries.map((c) => `${c.country} (${fmt(c.sessions)})`).join(', ')}.`}
        {live.data && ` On the site right now: ${fmt(live.data.total)}${live.data.top?.[0] ? `, reading “${live.data.top[0].title}”` : ''}.`}
      </p>
      {trend.length > 1 && (
        <LineChart height={160} labels={trend.map((t) => t.label)} series={[{ label: 'Visits', values: trend.map((t) => t.sessions) }]} />
      )}
      <div class="nx-cols">
        <div>
          <div class="nx-label-sm">How they came</div>
          <ul class="nx-rows">
            {rep.channels.slice(0, 5).map((c) => (
              <li key={c.channel}><a href={`#/site/${site.id}/pages?range=today`}><span class="nx-path">{c.channel}</span><span class="nx-num">{fmt(c.sessions)}</span><span class="muted small">{Math.round(c.engagementRate * 100)}% engaged</span></a></li>
            ))}
          </ul>
        </div>
        <div>
          <div class="nx-label-sm">Where they landed</div>
          <ul class="nx-rows">
            {rep.entryPages.slice(0, 5).map((p) => (
              <li key={p.path}><a href={`#/site/${site.id}/pages?range=today`}><span class="nx-path">{capital(pageName(p.path))}</span><span class="nx-num">{fmt(p.sessions)}</span><span class="muted small">{Math.round(p.engagementRate * 100)}% engaged</span></a></li>
            ))}
          </ul>
        </div>
      </div>
      <p class="note">
        Today’s story stops here: Search Console reports 2–3 days late, and downloads, journeys and the reasons people leave fill in once the day is over.{' '}
        <button type="button" class="nx-link" onClick={onYesterday}>See yesterday in full</button>
      </p>
    </section>
  );
}

// What happened: the period in a sentence, then the days. Hover reads a day,
// click opens it beside the page, drag across days sums them against the days
// before; Table shows every number, sortable, with Copy as CSV.
function Traffic({ site, params, story, span, metrics, marks }) {
  const [mode, setMode] = usePersistent('story-chart', 'chart');
  const all = metrics?.days || [];
  const map = new Map(all.map((d) => [d.date, d]));
  const days = all.filter((d) => d.date >= span.from && d.date <= span.to);
  const traffic = story.metric === 'sessions';
  const key = traffic ? 'sessions' : 'clicks';
  const usual = (d, k = key) => usualOf(map, d, k);
  const go = (patch) => { location.hash = storyHref(site, params, patch); };
  const open = params.get('day') || '';
  const [selA, selB] = (params.get('sel') || '').split('~');
  const sel = selA && selB && days.some((d) => d.date === selA) ? [days.findIndex((d) => d.date === selA), days.findIndex((d) => d.date === selB)] : null;
  const lead = story.changes[0];
  const ctx = { map, usual, last: span.to, L: null, lens: 'change', go, today: new Date().toISOString().slice(0, 10) };
  const marksOn = (date) => marks.filter((m) => m.date === date);

  return (
    <section class="card card-plain" aria-label="What happened">
      <SectionHead title="What happened" more={{ href: `#/site/${site.id}/timeline`, label: 'Timeline' }} />
      <p class={`nx-headline tone-${story.tone}`}>{story.headline}</p>
      {lead && (
        <p class="nx-lede">
          <a href={`#/site/${site.id}/${lead.kind === 'query' ? 'search' : lead.kind === 'source' ? 'traffic' : 'pages'}`}>{lead.text}</a>
          {lead.cause && <> <Cause e={lead.cause} lead="Around then" /></>}
        </p>
      )}
      {days.length > 1 && (
        <>
          <div class="nx-chhead">
            <span class="nx-label-sm">{traffic ? 'Visits each day' : 'Search clicks each day'}{traffic && <span class="muted"> · dashed is a usual day</span>}</span>
            <span class="tl-seg small" role="group" aria-label="Show as">
              {[['chart', 'Chart'], ['table', 'Table']].map(([k, l]) => (
                <button key={k} type="button" class={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
              ))}
            </span>
          </div>
          {mode === 'table' ? <DayTable site={site} days={days} usual={usual} marksOn={marksOn} onOpen={(date) => go({ day: date, sel: '' })} /> : (
            <>
              <LineChart height={200}
                labels={days.map((d) => short(d.date))} dates={days.map((d) => d.date)}
                tooltipTitle={(i) => long(days[i].date)}
                series={traffic
                  ? [{ label: 'Visits', values: days.map((d) => d.sessions ?? NaN) }, { label: 'A usual day', values: days.map((d) => usual(d.date) ?? NaN) }]
                  : [{ label: 'Search clicks', values: days.map((d) => d.clicks ?? NaN) }]}
                annotations={marks} selected={sel}
                hint="Click to open this day"
                onSelect={(i) => go({ day: days[i].date, sel: '' })}
                onRange={(a, b) => go({ sel: `${days[a].date}~${days[b].date}`, day: '' })} />
              <p class="muted small m-0">Hover to read a day · click to open it · drag across days to sum them up · ← → keys work too</p>
            </>
          )}
        </>
      )}
      {open && (
        <Drawer title="Day" onClose={() => go({ day: '' })}>
          <DayPanel scope={site.id} date={open} ctx={ctx} />
        </Drawer>
      )}
      {sel && (
        <Drawer title={`${short(selA)} – ${short(selB)} · ${sel[1] - sel[0] + 1} days`} onClose={() => go({ sel: '' })}>
          <StretchPanel site={site} from={selA} to={selB} map={map} marks={marks.filter((m) => m.date >= selA && m.date <= selB)} onDay={(date) => go({ day: date, sel: '' })} />
        </Drawer>
      )}
    </section>
  );
}

// Every day of the period as a row: sortable, each row opens its day.
const TABLE_COLS = [['date', 'Day'], ['sessions', 'Visits'], ['chg', 'vs usual'], ['clicks', 'Search clicks'], ['marks', 'What happened']];

function DayTable({ days, usual, marksOn, onOpen }) {
  const [sort, setSort] = useState(['date', 'desc']);
  const [copied, setCopied] = useState(false);
  const rows = days.map((d) => {
    const u = usual(d.date, 'sessions');
    return { date: d.date, sessions: d.sessions, chg: Number.isFinite(d.sessions) && u ? d.sessions / u - 1 : null, clicks: d.clicks, marks: marksOn(d.date).map((m) => m.label).join(', ') };
  });
  const [sk, sd] = sort;
  rows.sort((a, b) => {
    const x = a[sk] ?? -Infinity, y = b[sk] ?? -Infinity;
    return (x > y ? 1 : x < y ? -1 : 0) * (sd === 'asc' ? 1 : -1);
  });
  const by = (k) => setSort(([k0, d0]) => [k, k0 === k && d0 === 'desc' ? 'asc' : 'desc']);
  const num = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '' : String(v));
  async function copy() {
    const csv = [TABLE_COLS.map(([, l]) => l).join(','), ...rows.map((r) => [r.date, num(r.sessions), r.chg === null ? '' : (r.chg * 100).toFixed(0) + '%', num(r.clicks), `"${r.marks.replaceAll('"', '""')}"`].join(','))].join('\n');
    try { await navigator.clipboard.writeText(csv); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard refused */ }
  }
  return (
    <>
      <div class="nx-dtable-wrap">
        <table class="nx-dtable">
          <thead><tr>{TABLE_COLS.map(([k, l]) => (
            <th key={k} class={k !== 'date' && k !== 'marks' ? 'num' : ''} aria-sort={sk === k ? (sd === 'asc' ? 'ascending' : 'descending') : undefined}>
              <button type="button" onClick={() => by(k)}>{l}{sk === k ? (sd === 'asc' ? ' ↑' : ' ↓') : ''}</button>
            </th>
          ))}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.date} tabIndex={0} onClick={() => onOpen(r.date)} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.date)}>
              <td>{long(r.date)}</td>
              <td class="num">{Number.isFinite(r.sessions) ? fmt(r.sessions) : '—'}</td>
              <td class={`num ${r.chg === null ? 'muted' : r.chg >= 0 ? 'good' : 'bad'}`}>{pct(r.chg)}</td>
              <td class="num">{Number.isFinite(r.clicks) ? fmt(r.clicks) : '—'}</td>
              <td class="nx-dtable-mk">{r.marks || <span class="muted">—</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div class="nx-chhead">
        <span class="muted small">Click a row to open that day. Click a heading to sort.</span>
        <button type="button" class="nx-chip" onClick={copy}>{copied ? 'Copied' : 'Copy as CSV'}</button>
      </div>
    </>
  );
}

// A dragged stretch of days: its totals against as many days before it, the
// sources and pages that changed most, and what happened in it.
const STRETCH = [['sessions', 'Visits'], ['users', 'People'], ['views', 'Page views'], ['clicks', 'Search clicks']];

function StretchPanel({ site, from, to, map, marks, onDay }) {
  const n = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
  const span = { site: site.id, from, to };
  const sources = useAsync(() => api.get(`/calendar/breakdown${qs({ ...span, by: 'source', limit: 12 })}`), [site.id, from, to]);
  const pages = useAsync(() => api.get(`/calendar/breakdown${qs({ ...span, by: 'page', limit: 12 })}`), [site.id, from, to]);
  const sum = (a, b, k) => {
    let t = 0, any = false;
    for (let d = a; d <= b; d = addD(d, 1)) { const v = map.get(d)?.[k]; if (Number.isFinite(v)) { t += v; any = true; } }
    return any ? t : null;
  };
  const moved = (rows) => (rows || []).map((r) => ({ ...r, d: r.value - (r.previous || 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  const List = ({ title, q, name }) => (
    <div class="tl-sec">
      <h3 class="nx-label-sm">{title}</h3>
      {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : !q.data ? <Loading height={80} /> : moved(q.data.rows).map((r) => (
        <div key={r.key} class="tl-num"><span>{name(r.key)}</span><b>{fmt(r.value)}</b><span class="muted">{fmt(r.previous)}</span><span class={r.d >= 0 ? 'good' : 'bad'}>{r.d >= 0 ? '+' : '−'}{fmt(Math.abs(r.d))}</span></div>
      ))}
    </div>
  );
  return (
    <div class="tl-in">
      <div class="tl-sec">
        <h3 class="nx-label-sm">Against the {n} days before</h3>
        <div class="tl-nums">
          {STRETCH.map(([k, l]) => {
            const v = sum(from, to, k);
            if (v === null) return null;
            const p = sum(addD(from, -n), addD(from, -1), k);
            const c = p ? v / p - 1 : null;
            return <div key={k} class="tl-num"><span>{l}</span><b>{fmt(v)}</b><span class="muted">{p === null ? '—' : fmt(p)}</span><span class={c === null ? 'muted' : c >= 0 ? 'good' : 'bad'}>{pct(c)}</span></div>;
          })}
        </div>
      </div>
      <List title="Sources that changed most" q={sources} name={(k) => k} />
      <List title="Pages that changed most" q={pages} name={(k) => (k === '/' ? 'Home page' : k)} />
      {marks.length > 0 && (
        <div class="tl-sec">
          <h3 class="nx-label-sm">What happened</h3>
          {marks.map((m, i) => (
            <button key={m.id || i} type="button" class="tl-erow" onClick={() => onDay(m.date)}>
              <span class="muted">{short(m.date)}</span>
              <span class="tl-et">{m.label}</span>
            </button>
          ))}
        </div>
      )}
      <span class="nx-chips"><a class="nx-chip" href={`#/site/${site.id}/timeline?z=28d&end=${to}`}>Open in Timeline →</a></span>
    </div>
  );
}

// One day against the average of the same weekday before it.
const usualDay = (d) => {
  if (!Number.isFinite(d.sessions) || !d.baseline) return 'Not enough earlier days to say what a usual one looks like.';
  const p = Math.round((d.sessions / d.baseline - 1) * 100);
  return `${fmt(d.sessions)} visits, against ${fmt(d.baseline)} on a usual ${d.weekday}${Math.abs(p) < 10 ? ': about normal.' : `: ${Math.abs(p)}% ${p > 0 ? 'more' : 'fewer'}.`}`;
};

function Cause({ e, lead }) {
  const label = <><Icon name={KIND_ICON[e.kind] || 'star'} size={12} /> {lead}: {e.label}</>;
  return e.url
    ? <a class="nx-cause" href={e.url} target="_blank" rel="noreferrer">{label}</a>
    : <span class="nx-cause">{label}</span>;
}

function Sources({ site, rows, changes, range }) {
  if (!rows) return <section class="card card-plain"><Loading height={160} /></section>;
  const max = Math.max(1, ...rows.map((r) => r.value || 0));
  const lead = changes.find((c) => c.kind === 'source');
  return (
    <section class="card card-plain" aria-label="Who brought them">
      <SectionHead title="Who brought them" more={{ href: `#/site/${site.id}/traffic?range=${range}`, label: 'Full report in Traffic' }} />
      {lead && <p class="nx-lede">{lead.text}</p>}
      <div class="nx-table" role="table" aria-label="Visits by source">
        <div class="nx-tr nx-th" role="row"><span role="columnheader">Source</span><span role="columnheader">Visits</span><span role="columnheader">Change</span><span role="columnheader" aria-hidden="true" /></div>
        {rows.map((r) => (
          <div class="nx-tr" role="row" key={r.key}>
            <span role="cell"><Marked kind="source" name={r.key}><b>{r.key}</b></Marked></span>
            <span role="cell" class="nx-num">{fmt(r.value)}</span>
            <span role="cell"><Change value={r.value} previous={r.previous} /></span>
            <span role="cell" class="nx-bar" aria-hidden="true"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <p class="note">“Direct” is every visit without a referrer: typed links, app links and likely bots.</p>
    </section>
  );
}

// What the visits led to, in three kinds that aren't added up: what visitors did
// on the site (GA4 goal events, steps on the way to the outcome), what got the
// product (store installs, release downloads) and who keeps using it (custom
// metrics). Without any of those it says what to connect instead of guessing.
const GOT = { installs: 'Chrome Web Store', downloads: 'GitHub files, not people', stars: 'GitHub stars gained' };
const hasHistory = (x) => x.previous !== null && x.previous !== undefined;

export function Results({ site, range, n = '5', title = 'What it led to', more = true }) {
  const products = useAsync(() => api.get('/products').catch(() => null), []);
  const product = products.data?.products?.find((p) => p.siteId === site.id);
  // A product carries the store/repo numbers, but its site may not have one: the
  // site's own goals (.sitelens.yml, or the events it sends) still say what the
  // period led to, so read those instead of dropping the section.
  const out = useAsync(() => {
    if (!products.data) return null;
    const url = product ? `/outcomes/${product.id}` : `/sites/${site.id}/outcomes`;
    return api.get(`${url}${qs({ range })}`).catch(() => null);
  }, [products.data, product?.id, site.id, range]);
  const metrics = useAsync(() => api.get(`/sites/${site.id}/metrics${qs({ range })}`).catch(() => ({ metrics: [] })), [site.id, range]);
  if (!products.data || (!out.data && out.loading)) return <section class="card card-plain"><Loading height={160} /></section>;
  const all = out.data?.goals?.list || [];
  const outcomesHref = `#/site/${site.id}/outcomes?range=${range}`;

  // On the site: the outcome first, then the steps that lead to it, biggest first.
  const onSite = all.filter((g) => g.source === 'event' || g.source === 'page')
    .sort((a, b) => (b.role === 'outcome') - (a.role === 'outcome') || b.count - a.count);
  const got = all.filter((g) => GOT[g.source] && g.role === 'outcome')
    .sort((a, b) => hasHistory(b) - hasHistory(a));
  const usage = (metrics.data?.metrics || []).map((m) => ({
    id: m.id,
    label: m.label.replace(/[\s·]+$/, ''),
    count: m.error ? null : m.total,
    previous: m.previous,
    note: m.error ? m.error.message : m.summary === 'average' ? 'average a day' : 'in this period',
  }));
  const nothing = onSite.length === 0 && got.length === 0 && usage.length === 0;

  return (
    <section class="card card-plain" aria-label="What it led to">
      <SectionHead n={n} title={title} more={more ? { href: outcomesHref, label: 'Outcomes' } : null} />
      <div class="nx-outcomes">
        {nothing ? (
          <a class="nx-callout nx-okind-empty" href={outcomesHref}>
            <Icon name="target" size={14} />
            <span>No outcome yet. Pick the events that mean someone got what they came for (a sign-up, a purchase, a download), and this shows what the period led to.</span>
          </a>
        ) : (
          <>
            {onSite.length > 0 && (
              <OutcomeKind icon="target" title="On the site" note="Visitors, from GA4" href={outcomesHref}
                items={onSite.map((g) => ({ id: g.id, label: g.label, count: g.unavailable ? null : g.count, previous: g.previous, note: g.unavailable || (g.role === 'step' ? 'on the way' : '') }))} />
            )}
            {got.length > 0 && (
              <OutcomeKind icon="download" title="Got the product" note="Counted outside the site" href={outcomesHref}
                items={got.map((g) => ({ id: g.id, label: g.label, count: g.unavailable ? null : g.count, previous: g.previous, note: g.unavailable || GOT[g.source] }))} />
            )}
            {usage.length > 0 ? (
              <OutcomeKind icon="users" title="Kept using it" note="Custom metrics" href="#/account?tab=metrics" items={usage} />
            ) : (
              <a class="nx-callout nx-okind-empty" href="#/account?tab=metrics">
                <Icon name="database" size={14} />
                <span>A download isn’t a user. Connect the app’s own numbers (launches, weekly active users, uninstalls) as custom metrics, and this shows who stays.</span>
              </a>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// One kind of outcome: its headline number large, the rest as short rows.
function OutcomeKind({ icon, title, note, href, items }) {
  const [lead, ...rest] = items;
  return (
    <a class="nx-okind" href={href}>
      <div class="nx-label-sm"><Icon name={icon} size={12} /> {title}<span class="nx-okind-src">{note}</span></div>
      <div class="nx-okind-lead">
        <b>{amount(lead.count)}</b>
        <span>{lead.label}{lead.note && <span class="muted small"> · {lead.note}</span>}</span>
        <Shift item={lead} />
      </div>
      {rest.length > 0 && (
        <ul class="nx-okind-rows">
          {rest.map((x) => (
            <li key={x.id}>
              <span class="nx-path">{x.label}{x.note && <span class="muted small"> · {x.note}</span>}</span>
              <span class="nx-num">{amount(x.count)}</span>
              <Shift item={x} />
            </li>
          ))}
        </ul>
      )}
    </a>
  );
}

const amount = (v) => (v === null || v === undefined ? '–' : v < 10 && v % 1 ? v.toFixed(1) : fmt(v));
const Shift = ({ item }) => (item.count === null ? <span /> : hasHistory(item) ? <Change value={item.count} previous={item.previous} /> : <span class="muted small">no history</span>);

// What to do next (server/next-steps.mjs): fix what dropped, get found in
// search, convert more, and do more of what worked. Each one can go on your
// to-dos; ticking it off there marks the day on the Timeline.
const GROUPS = [
  { key: 'fix', label: 'Fix what dropped', icon: 'triangle' },
  { key: 'found', label: 'Get found', icon: 'search' },
  { key: 'convert', label: 'Convert more', icon: 'target' },
  { key: 'grow', label: 'Bring more visits', icon: 'trend' },
];

// Only the reason: Outcomes' findings carry their advice after "Do:", which
// goes onto the to-do (detail) rather than the list.
const brief = (why) => String(why || '').split(/\s+Do:\s/)[0].trim();

// A plain list: what to change, why in one line, what it's worth, and one
// button. The title opens the place to make the change.
function NextSteps({ site, range }) {
  const next = useAsync(() => api.get(`/sites/${site.id}/next-steps${qs({ range })}`), [site.id, range]);
  const todos = useTodos({ site: site.id });
  if (next.error) return <section class="card card-plain"><ErrorState error={next.error} onRetry={next.reload} /></section>;
  if (!next.data) return <section class="card card-plain"><Loading height={200} /></section>;
  const steps = next.data.steps;
  const added = new Map((todos.data?.todos || []).filter((t) => t.from).map((t) => [t.from, t]));
  const open = todos.data?.open || 0;

  return (
    <section class="card card-plain nx-next" aria-label="What to do next">
      <SectionHead title="What to do next" more={{ href: `#/site/${site.id}/todos`, label: open ? `Your to-dos (${open})` : 'Your to-dos' }} />
      {!steps.length && <p class="muted m-0">Nothing stands out for this period.</p>}
      {GROUPS.map((g) => {
        const list = steps.filter((x) => x.group === g.key);
        if (!list.length) return null;
        return (
          <div class="nx-nlist-group" key={g.key}>
            <h3 class="nx-nlist-lbl">{g.label}</h3>
            <ul class="nx-nlist">
              {list.map((x) => (
                <li class="nx-nrow" key={x.key}>
                  <a class="nx-nmain" href={x.link} title={x.linkLabel} {...(x.link.startsWith('https:') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    <b>{x.title}</b>
                    <span>{brief(x.why)}</span>
                  </a>
                  <span class="nx-nworth">{x.worth || ''}</span>
                  <AddTodo site={site} added={added.get(x.key)} class="btn" label="Add to to-dos" todo={{ title: x.title, detail: x.why, link: x.link, from: x.key, subject: x.subject, baseline: x.baseline }} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const pageName = (path) => (path === '/' ? 'the home page' : !path || path === '(not set)' ? 'no page recorded' : path);

// A change against the period before. From almost nothing, the starting
// number says more than a percentage does ("from 1", not "up 12200%").
export function Change({ value, previous }) {
  if (!previous) return value ? <span class="good small">new</span> : <span class="muted">–</span>;
  if (previous * 4 < value) return <span class="good small">from {fmt(previous)}</span>;
  const p = Math.round((value / previous - 1) * 100);
  if (!p) return <span class="muted small">same</span>;
  return <span class={`${p > 0 ? 'good' : 'bad'} small`}>{p > 0 ? '↑' : '↓'} {Math.abs(p)}%</span>;
}

export function SectionHead({ n, title, more }) {
  return (
    <div class="nx-section-head">
      <h2 class="nx-h2">{n && <span class="nx-step" aria-hidden="true">{n}</span>}{title}</h2>
      {more && <a class="nx-more" href={more.href}>{more.label} <Icon name="chevron" size={12} /></a>}
    </div>
  );
}
