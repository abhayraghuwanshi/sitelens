import { useMemo, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Empty, Segmented } from '../components/ui.jsx';
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
const ENGINES = [
  { key: 'google', label: 'Google', unit: 'clicks' },
  { key: 'bing', label: 'Bing', unit: 'clicks', hint: 'Also feeds Copilot, DuckDuckGo and ChatGPT search' },
  { key: 'ai', label: 'AI assistants', unit: 'visits + citations' },
];
const DECIDED = { keep: 'kept', improve: 'to improve', merge: 'to merge', remove: 'to remove' };
const num = (v) => (v ? formatNumber(v) : <span class="muted">0</span>);
// A page's own view (the article editor) lives under Explore → Pages.
const pageHref = (site, path) => `#/site/${site.id}/pages?article=${encodeURIComponent(path)}`;
const shortDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function ContentCycles({ site }) {
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
      <CycleHead site={site} d={d} cycle={cycle} setCycle={setCycle} onSaved={data.reload} />
      {d.cycles.length > 1 && <History cycles={d.cycles} />}
      {d.report ? <Report site={site} r={d.report} current={d.current} onSaved={data.reload} /> : <Waiting c={d.current} />}
    </>
  );
}

// Before the first numbers: what the cycle is doing and on which dates it fills in.
function Waiting({ c }) {
  const steps = [
    { on: c.start, label: 'Cycle started', text: 'Studio counts every article from this day.' },
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
        <p>Every cycle Studio measures each article over that exact window. It counts Google and Bing clicks separately and checks whether AI assistants cite the article or send readers. It also counts how many readers stayed (convinced) and how many went on to download or sign up (acted).</p>
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

function CycleHead({ site, d, cycle, setCycle, onSaved }) {
  const c = d.current;
  const s = d.settings;
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
    ...d.cycles.slice(-6).map((x) => ({ key: String(x.n), label: `#${x.n}`, title: `${x.start} to ${x.end}` })),
    { key: 'live', label: `#${c.n} so far`, title: c.measuredTo ? `${c.start} to ${c.measuredTo}` : 'No search data yet' },
  ];
  const shown = cycle || (d.cycles.length ? String(d.cycles.at(-1).n) : 'live');
  return (
    <>
      <div class="meta-line items-center">
        <span>{`Cycle ${c.n}, day ${c.day} of ${s.days} (${shortDate(c.start)} to ${shortDate(c.end)})${s.on ? '' : ', paused'}`}</span>
        <Segmented label="Which cycle" value={shown} onChange={setCycle} options={options} />
        <label class="small"><input type="checkbox" checked={s.askAi} onChange={(e) => save({ askAi: e.currentTarget.checked })} /> AI checks each cycle</label>
        <button class="btn ghost" type="button" onClick={() => save({ on: !s.on })}>{s.on ? 'Pause' : 'Resume'}</button>
      </div>
      {d.demo && <p class="note m-0">Sample cycles: open one of your own sites to run real ones.</p>}
      {msg && <p class="note m-0">{msg}</p>}
    </>
  );
}

function History({ cycles }) {
  return (
    <Card title="Cycle by cycle" sub="What all articles brought in each finished cycle" flush>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Cycle</th><th class="num">Articles</th><th class="num">Visits</th><th class="num">Acted</th><th class="num">Google clicks</th><th class="num">Bing clicks</th><th class="num">AI citations</th></tr></thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.n}>
                <td>#{c.n} <span class="small muted">{shortDate(c.start)}–{shortDate(c.end)}</span></td>
                <td class="num">{formatNumber(c.articles)}</td>
                <td class="num">{num(c.visits)}</td>
                <td class="num">{num(c.conversions)}</td>
                <td class="num">{num(c.google)}</td>
                <td class="num">{num(c.bing)}</td>
                <td class="num">{num(c.aiCited)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Report({ site, r, current, onSaved }) {
  const t = r.totals;
  const [only, setOnly] = useState('');
  const [category, setCategory] = useState('');
  const rows = useMemo(() => r.rows.filter((x) => (!only || x.verdict === only) && (!category || x.category === category)), [r, only, category]);
  const off = Object.entries(r.sources || {}).filter(([k, v]) => k !== 'ai' && v !== true);
  const todos = useTodos({ site: site.id });
  return (
    <>
      <p class="note m-0">
        {r.kind === 'live'
          ? `Cycle ${r.n} so far: ${shortDate(r.start)} to ${shortDate(r.end)}. Search engines report about two days late, so the newest day can still fill in and the next one arrives tomorrow. Changes compare it with the cycle before, scaled to the same number of days.${current?.verdictsOn ? ` Verdicts are final on ${shortDate(current.verdictsOn)}.` : ''}`
          : `Cycle ${r.n}: ${r.start} to ${r.end}.`}
        {' '}{r.goals?.length ? `“Acted” counts readers who went on to ${r.goals.map((g) => g.replace(/_/g, ' ')).join(' or ')}.` : 'No download or sign-up event found in GA4, so “acted” stays at 0.'}
        {' '}{r.sources?.ai ? `${formatNumber(r.sources.ai)} AI answers were checked in this window.` : 'No AI answer checks ran in this window, so citations are 0. Run them from AI search.'}
      </p>
      {off.length > 0 && <p class="note m-0">{off.map(([k, v]) => `${{ google: 'Search Console', bing: 'Bing', ga4: 'GA4' }[k]}: ${v || 'not connected'}.`).join(' ')}</p>}

      <KpiStrip items={[
        { label: 'Articles', value: formatNumber(t.articles), meta: `${formatNumber(t.unseen)} unseen by Google and Bing` },
        { label: 'Visits', value: formatNumber(t.visits), meta: t.visits ? `${formatPercent(t.engaged / t.visits, 0)} stayed (convinced)` : 'landing on an article', help: 'GA4 sessions that started on an article. Stayed: engaged sessions (10s+, 2+ pages or a key event).' },
        { label: 'Acted', value: formatNumber(t.conversions), meta: t.visits ? `${formatPercent(t.conversions / t.visits, 1)} of visits` : 'downloads, sign-ups', help: 'Users who landed on an article and fired one of the site’s goal events.' },
        { label: 'Google clicks', value: formatNumber(t.google) },
        { label: 'Bing clicks', value: formatNumber(t.bing) },
        { label: 'AI', value: formatNumber(t.aiCited), meta: `citations · ${formatNumber(t.aiVisits)} visits`, help: 'Times an answer check cited one of these articles, and visits ChatGPT, Perplexity and other assistants sent.' },
      ]} />

      <div class="cycle-cats">
        {r.categories.map((c) => <CategoryCard key={c.name} c={c} on={category === c.name} onPick={() => setCategory(category === c.name ? '' : c.name)} />)}
      </div>

      <div class="review-chips" role="group" aria-label="Filter by verdict">
        <button type="button" class={`rv-chip${!only ? ' on' : ''}`} onClick={() => setOnly('')}>All <b>{r.rows.length}</b></button>
        {Object.keys(VERDICTS).filter((k) => r.counts[k]).map((k) => (
          <button type="button" key={k} title={VERDICTS[k].title} class={`rv-chip tone-${VERDICTS[k].tone}${only === k ? ' on' : ''}`} onClick={() => setOnly(only === k ? '' : k)}>{VERDICTS[k].label} <b>{r.counts[k]}</b></button>
        ))}
        {category && <button type="button" class="rv-chip on" onClick={() => setCategory('')}>{category} ✕</button>}
      </div>

      <Card flush>
        {rows.length ? (
          <div class="table-wrap">
            <table class="data review">
              <thead>
                <tr>
                  <th>Article</th>
                  <th class="num" title="Google clicks · impressions">Google</th>
                  <th class="num" title="Bing clicks · impressions">Bing</th>
                  <th class="num" title="AI visits · times an answer check cited it">AI</th>
                  <th class="num" title="Visits that started on it">Visits</th>
                  <th class="num" title="Share of those visits that engaged">Stayed</th>
                  <th class="num" title="Readers who went on to a goal (download, sign-up…)">Acted</th>
                  <th class="num" title="Value against its previous cycle: visits, plus 5 per reader who acted and 3 per AI citation">Change</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>{rows.map((x) => <ArticleRow key={x.path} site={site} x={x} categories={r.categories} todos={todos.data?.todos || []} onSaved={onSaved} />)}</tbody>
            </table>
          </div>
        ) : <div class="pad-16"><Empty title="Nothing matches">Try another verdict or category.</Empty></div>}
      </Card>
      <p class="note">Value ranks articles within a category. It counts each visit as 1, each reader who acted as 5, and each AI citation as 3, because someone who read the answer may never visit. <b>Grow</b> goes to the top third of a category when its readers stay, <b>cut</b> to articles with no clicks, no AI and no readers two cycles running. Acting on a verdict saves it as the page’s decision on the Pages review.</p>
    </>
  );
}

function CategoryCard({ c, on, onPick }) {
  const change = c.previous ? c.value / c.previous - 1 : null;
  return (
    <Card class={`cycle-cat${on ? ' on' : ''}`} title={<button type="button" class="link-btn" onClick={onPick} title="Show only this category">{c.name}</button>}
      sub={`${c.articles} article${c.articles === 1 ? '' : 's'}${change !== null && Number.isFinite(change) ? ` · ${change >= 0 ? '+' : ''}${formatPercent(change, 0)} on the cycle before` : ''}`}>
      <div class="cycle-funnel small">
        <span><b>{formatNumber(c.visits)}</b> came</span>
        <span>→ <b>{formatNumber(c.engaged)}</b> stayed{c.visits ? ` (${formatPercent(c.engaged / c.visits, 0)})` : ''}</span>
        <span>→ <b>{formatNumber(c.conversions)}</b> acted{c.visits ? ` (${formatPercent(c.conversions / c.visits, 1)})` : ''}</span>
      </div>
      <table class="data cycle-engines">
        <tbody>
          {ENGINES.map((e) => {
            const v = c.engines[e.key];
            return (
              <tr key={e.key} title={e.hint || ''}>
                <th>{e.label}</th>
                <td class="num">{num(v.value)}</td>
                <td class="small muted" title="Readers this engine sent who acted, of all it sent">{v.visits ? `${formatNumber(v.conversions)}/${formatNumber(v.visits)} acted` : ''}</td>
                <td class="small">{v.leader ? <span title={v.leader.path}>{v.leader.title || v.leader.path}</span> : <span class="muted">nothing yet</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {c.engines.agree === false && <p class="small muted" style={{ margin: '6px 0 0' }}>The engines favour different articles here, so compare what the leaders do differently.</p>}
    </Card>
  );
}

function ArticleRow({ site, x, categories, todos, onSaved }) {
  const change = x.previous === null ? null : x.previous === 0 ? (x.value ? Infinity : 0) : x.value / x.previous - 1;
  return (
    <tr>
      <td class="cell-path" style={{ maxWidth: '360px' }}>
        <a href={pageHref(site, x.path)} class="review-page">{x.title || x.path}</a>
        <div class="small muted" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <code>{x.path}</code>
          <CategoryInput site={site} x={x} categories={categories} onSaved={onSaved} />
          {x.google?.query && <span title="Top Google query this cycle">“{x.google.query}”</span>}
        </div>
      </td>
      <td class="num" title={x.google?.position ? `Avg. position ${formatDecimal(x.google.position, 1)}` : ''}>{x.google ? <>{num(x.google.clicks)} <span class="muted">· {formatNumber(x.google.impressions)}</span></> : <span class="muted">—</span>}</td>
      <td class="num" title={x.bing?.position ? `Avg. position ${formatDecimal(x.bing.position, 1)}` : ''}>{x.bing ? <>{num(x.bing.clicks)} <span class="muted">· {formatNumber(x.bing.impressions)}</span></> : <span class="muted">—</span>}</td>
      <td class="num" title={x.ai?.prompts?.length ? `Cited for: ${x.ai.prompts.join(' · ')}` : ''}>{num(x.ai?.sessions)} <span class="muted">· {formatNumber(x.ai?.cited || 0)}</span></td>
      <td class="num">{num(x.visits)}</td>
      <td class="num">{x.visits ? formatPercent(x.engaged / x.visits, 0) : '—'}</td>
      <td class="num">{num(x.conversions)}</td>
      <td class="num">{change === null ? <span class="muted">—</span> : change === Infinity ? <span class="delta up">new</span> : <span class={change > 0 ? 'delta up' : change < 0 ? 'delta down' : 'muted'}>{change > 0 ? '+' : ''}{formatPercent(change, 0)}</span>}</td>
      <td style={{ minWidth: '240px' }}>
        <span class={`rv-tag ${VERDICTS[x.verdict].tone}`} title={VERDICTS[x.verdict].title}>{VERDICTS[x.verdict].label}</span>
        {x.decision && <span class="rv-goal" title={x.decision.note || ''}>{DECIDED[x.decision.decision] || x.decision.decision}</span>}
        <div class="small muted mt-4">{x.why}</div>
        <Act site={site} x={x} todos={todos} onSaved={onSaved} />
      </td>
    </tr>
  );
}

function CategoryInput({ site, x, categories, onSaved }) {
  const [value, setValue] = useState(x.category);
  const id = `cats-${site.id}`;
  const save = async () => {
    const next = value.trim();
    if (next === x.category) return;
    await api.post(`/sites/${site.id}/content-cycles/category`, { path: x.path, category: next });
    onSaved();
  };
  return (
    <>
      <input class="cycle-cat-input" type="text" list={id} value={value} aria-label={`Category of ${x.path}`} title={x.categoryFrom === 'you' ? 'Your category' : x.categoryFrom === 'topic' ? 'From the site’s search topics; type to change' : 'From the URL; type to change'}
        onInput={(e) => setValue(e.currentTarget.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      <datalist id={id}>{categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>
    </>
  );
}

// One click from a verdict to a decision or a to-do.
function Act({ site, x, todos, onSaved }) {
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
  if (x.verdict === 'grow') {
    return (
      <div class="row mt-6 gap-6">
        <AddTodo site={site} added={added} class="btn cycle-act" label="To-do: write a follow-up"
          todo={{ title: `Write a follow-up to ${x.title || x.path}${x.google?.query ? ` around “${x.google.query}”` : ''}`, detail: x.why, link, from, subject: { kind: 'search', key: x.path } }} />
      </div>
    );
  }
  if (x.verdict === 'cut' || x.verdict === 'improve') {
    const decided = x.decision?.decision;
    return (
      <div class="row mt-6 gap-6">
        {decided ? <button class="btn ghost cycle-act" type="button" disabled={busy} onClick={() => act('clear')}>Undo decision</button>
          : <button class="btn cycle-act" type="button" disabled={busy} onClick={() => act(x.verdict)}>{x.verdict === 'cut' ? 'Mark to remove' : 'Mark to improve'}</button>}
        {x.verdict === 'improve' && <a class="btn ghost cycle-act" href={pageHref(site, x.path)}>Open in editor</a>}
      </div>
    );
  }
  return null;
}
