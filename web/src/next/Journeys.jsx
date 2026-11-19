import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Page } from './Page.jsx';
import { Marked } from '../components/Marks.jsx';
import { Editor, labeller } from '../pages/Funnels.jsx';

// Journeys: one goal at a time. The steps down it, who gets there, and the
// routes that bring people in or lose them — all from BigQuery, so a site's
// leave-out rule applies. Steps are the site's own funnels, or a suggestion
// while it has none; Paths and the raw events sit under Raw data.
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const share = (x) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x * 100)}%`);
const RANGES = [{ key: '7d', label: '7 days' }, { key: '28d', label: '28 days' }, { key: '90d', label: '90 days' }];

// A referrer host or utm_source, as a person would name it.
const FAMILIES = [
  [/^\(direct\)$/, 'No referrer'],
  [/google\./, 'Google'], [/^google$/, 'Google'],
  [/bing\./, 'Bing'], [/^bing$/, 'Bing'],
  [/duckduckgo/, 'DuckDuckGo'], [/baidu/, 'Baidu'], [/yandex/, 'Yandex'], [/ecosia/, 'Ecosia'],
  [/reddit/, 'Reddit'], [/producthunt/, 'Product Hunt'], [/ycombinator/, 'Hacker News'],
  [/chatgpt|openai/, 'ChatGPT'], [/perplexity/, 'Perplexity'], [/gemini\.google|bard\.google/, 'Gemini'], [/claude\.ai/, 'Claude'], [/copilot/, 'Copilot'],
  [/chromewebstore/, 'Chrome Web Store'], [/github/, 'GitHub'], [/^t\.co$|twitter|x\.com/, 'X'], [/linkedin/, 'LinkedIn'], [/youtube/, 'YouTube'],
];
export function family(source, host) {
  const s = String(source || '').toLowerCase();
  if (host && (s === host || s.endsWith(`.${host}`)) || s === 'localhost') return 'Your own site';
  for (const [re, name] of FAMILIES) if (re.test(s)) return name;
  return s.replace(/^www\./, '') || 'No referrer';
}

export const pageName = (path) => (path === '/' ? 'The home page' : !path || path === '(not set)' ? 'No page recorded' : path);

const shortPage = (path) => (path === '/' ? 'Home' : !path || path === '(not set)' ? 'No page' : path);
const lower = (s) => String(s || '').toLowerCase();

// A step's name: the site's goal label for an event, the page for a page.
function stepLabel(step, goals) {
  if (step.kind === 'page') return shortPage(step.value);
  return goals.find((g) => g.source === 'event' && g.match === step.value)?.label || step.value.replace(/_/g, ' ');
}
const stepKind = (step) => `${step.kind === 'event' ? 'event' : 'page'} ${step.value}`;

const WHO = [{ key: 'source', label: 'Source' }, { key: 'system', label: 'Device' }, { key: 'browser', label: 'Browser' }, { key: 'country', label: 'Country' }];

export function JourneysPage({ site, params }) {
  const wanted = params.get('range') || '28d';
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const config = useAsync(() => api.get(`/sites/${site.id}/config`).catch(() => null), [site.id]);
  const goals = config.data?.config?.goals || [];
  const outcome = goals.find((g) => g.source === 'event' && g.role === 'outcome');
  const declared = config.data?.config?.funnels || [];
  const suggestions = useAsync(() => (site.modes?.warehouse ? api.get(`/sites/${site.id}/warehouse/funnel-suggestions${qs({ range })}`).catch(() => null) : null), [site.id, range, site.modes?.warehouse]);
  // The site's own funnel for this outcome first; a suggestion while it has none.
  const wantedFunnel = (list) => list.find((f) => f.steps?.at(-1)?.kind === 'event' && f.steps.at(-1).value === outcome?.match);
  const chosen = wantedFunnel(declared) || wantedFunnel(suggestions.data?.funnels || []) || declared[0] || suggestions.data?.funnels?.[0];
  const picks = [
    ...(declared || []).map((f) => ({ key: `yours:${f.name}`, name: f.name, steps: f.steps, from: 'yours' })),
    ...((suggestions.data?.funnels) || []).map((f) => ({ key: `suggested:${f.name}:${f.goal}`, name: f.name, steps: f.steps, from: 'suggested', why: f.why })),
  ];
  const [pickKey, setPickKey] = useState(null);
  const viewing = pickKey ? picks.find((p) => p.key === pickKey) || null : null;
  const steps = viewing?.steps || chosen?.steps || [];
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const edit = params?.get('edit') === '1';
  const editingMode = editing || edit;
  const effSteps = draft || steps;
  const stepsKey = effSteps.map((s) => `${s.kind}:${s.value}`).join(',');

  const funnel = useAsync(() => (outcome && effSteps.length ? api.post(`/sites/${site.id}/warehouse/funnel`, { range, steps: effSteps }) : null),
    [site.id, range, stepsKey, outcome?.match]);

  const [who, setWho] = useState('source');
  const segments = useAsync(() => (outcome && effSteps.length
    ? api.get(`/sites/${site.id}/warehouse/segments${qs({ range, by: who, outcome: outcome.match, steps: stepsKey })}`)
    : null), [site.id, range, who, stepsKey, outcome?.match]);

  const routes = useAsync(() => (outcome
    ? api.get(`/sites/${site.id}/warehouse/routes${qs({ range, outcome: outcome.match, limit: 60 })}`)
    : null), [site.id, range, outcome?.match]);

  const events = useAsync(() => (site.modes?.warehouse ? api.get(`/sites/${site.id}/warehouse/events${qs({ range })}`).catch(() => null) : null), [site.id, range, site.modes?.warehouse]);

  let body;
  if (!site.modes?.warehouse) body = <p class="muted">Journeys read each visit from the site’s GA4 BigQuery export. Connect it in the site’s settings to see them.</p>;
  else if (config.error) body = <ErrorState error={config.error} onRetry={config.reload} />;
  else if (!config.data) body = <Loading height={300} />;
  else if (!outcome) body = <NoOutcome site={site} />;
  else if (!steps.length && !suggestions.data && !suggestions.error) body = <Loading height={240} />;
  else if (!steps.length) body = <NoSteps site={site} range={range} />;
  else if (funnel.error) body = <ErrorState error={funnel.error} onRetry={funnel.reload} />;
  else if (!funnel.data) body = <Loading height={320} />;
  else {
    const first = funnel.data.steps?.[0]?.sessions || 0;
    const last = funnel.data.steps?.at(-1)?.sessions || 0;
    const average = first ? last / first : 0;
    body = (
      <div class="nx-jpage">
        {picks.length > 1 && (
          <nav class="nx-fn-picker" aria-label="Funnels">
            {picks.map((p) => (
              <button key={p.key} type="button" class={`nx-fn-chip${JSON.stringify(p.steps) === JSON.stringify(steps) ? ' active' : ''}`} title={p.why}
                onClick={() => setPickKey(pickKey === p.key ? null : p.key)}>
                {p.name}{p.from === 'suggested' && <span class="nx-fn-tag">suggested</span>}
              </button>
            ))}
          </nav>
        )}
        {first > 0
          ? <p class="nx-lede"><Answer steps={funnel.data.steps} goals={goals} outcome={outcome} /></p>
          : <p class="muted">No visits reached the first step in this period. Try a longer range, or edit the steps.</p>}
        {first > 0 && <Stairs steps={funnel.data.steps} goals={goals} site={site} range={range} outcome={outcome} onEdit={() => setEditing(true)} />}
        <WhoGetsThere site={site} who={who} setWho={setWho} data={segments} steps={funnel.data.steps} goals={goals} outcome={outcome} average={average} />
        <RoutesCard site={site} data={routes} outcome={outcome} average={average} range={range} />
        <p class="nx-rawlink muted small">
          Also: <a href={`#/site/${site.id}/journeys?tab=retention&range=${range}`}>Retention</a> · Raw data:{' '}
          <a href={`#/site/${site.id}/raw?tab=events&range=${range}`}>Events</a> ·{' '}
          <a href={`#/site/${site.id}/raw?tab=paths&range=${range}`}>Sessions</a> ·{' '}
          <a href={`#/site/${site.id}/raw?tab=sql&range=${range}`}>SQL</a>
        </p>
      </div>
    );
  }

  return (
    <Page title="Journeys" sub="How people get to your goal, and where they stop"
      actions={
        <span class="nx-head-ctl">
          {outcome && <span class="chip" title="The site’s outcome goal">{outcome.label}</span>}
          <button class="btn" type="button" onClick={() => setEditing(true)}>Edit steps</button>
          <Segmented label="Period" value={range} options={RANGES} onChange={(key) => { location.hash = `/site/${site.id}/journeys?range=${key}`; }} />
        </span>
      }>
      {editingMode ? (
        <Editor
          site={site}
          steps={effSteps}
          setSteps={setDraft}
          apply={() => { setEditing(false); }}
          declared={declared}
          eventNames={(events.data?.events || []).map((e) => e.name)}
          run={effSteps}
          label={labeller(goals)}
        />
      ) : body}
    </Page>
  );
}

// The answer first: how many get there, and the one place most are lost.
function Answer({ steps, goals, outcome }) {
  const first = steps[0]?.sessions || 0;
  const last = steps.at(-1)?.sessions || 0;
  const gaps = steps.slice(1).map((s, i) => ({ i, lost: (steps[i].sessions || 0) - (s.sessions || 0) }));
  const worst = gaps.reduce((a, b) => (b.lost > a.lost ? b : a), gaps[0] || { i: 0, lost: 0 });
  const before = steps[worst.i + 1];
  const oneIn = Math.round(first / Math.max(1, last));
  const rate = pct(last, first);
  return (
    <>
      <b>{oneIn > 1 ? `1 in ${oneIn}` : rate}</b> visitors reach “{lower(outcome.label)}” ({rate}).
      {before && worst.lost > 0 && <> You lose the most before “{stepLabel(before, goals)}”: <b>{pct(worst.lost, steps[worst.i].sessions)}</b> never get there.</>}
    </>
  );
}

// Steps down the goal, with the drop between each one.
export function Stairs({ steps, goals, site, range, outcome, bare, onEdit }) {
  const first = steps[0]?.sessions || 0;
  const content = (
    <>
      <div class="nx-stairs">
        {steps.map((s, i) => {
          const next = steps[i + 1];
          const lost = next ? s.sessions - next.sessions : 0;
          return [
            <div class="nx-stair" key={`s${i}`}>
              <span class="nx-stair-name"><b>{stepLabel(s, goals)}</b><span class="nx-stair-kind">{stepKind(s)}</span></span>
              <span class="nx-stair-bar"><span style={{ width: `${Math.max(0.6, (s.sessions / Math.max(1, first)) * 100)}%` }} /></span>
              <span class="nx-stair-num">
                <b>{fmt(s.sessions)}</b>
                <small>{i ? `${pct(s.sessions, first)} of all · ${share(s.stepRate)} of the step before` : 'everyone'}</small>
              </span>
            </div>,
            next && (
              <div class="nx-leakrow" key={`l${i}`}>
                <span />
                <a class="nx-leak" href={stopHref(site, range, s)}>
                  <b>{fmt(lost)} stopped here</b> ({pct(lost, s.sessions)}) <span>see where they went →</span>
                </a>
              </div>
            ),
          ];
        }).flat()}
      </div>
      <p class="note">Steps for “{outcome.label}” come from the site’s file or a suggestion. {onEdit ? (
        <a href={`#/site/${site.id}/journeys?tab=funnels&range=${range}&edit=1`} onClick={(e) => { e.preventDefault(); onEdit(); }}>Edit steps</a>
      ) : (
        <a href={`#/site/${site.id}/journeys?tab=funnels&range=${range}&edit=1`}>Edit steps</a>
      )}</p>
    </>
  );
  if (bare) return <>{content}</>;
  return (
    <section class="card card-plain" aria-label="Steps to the goal">
      {content}
    </section>
  );
}

// Where a leak go: page steps open the Sessions flow from that page; event
// steps open the sessions that fired it.
function stopHref(site, range, step) {
  const filter = step.kind === 'page' ? `path=${encodeURIComponent(step.value)}` : `converted=${encodeURIComponent(step.value)}`;
  return `#/site/${site.id}/raw?tab=paths&range=${range}&${filter}`;
}

// One row per source / device / browser / country: the same steps, counted for
// that segment, beside the average.
function WhoGetsThere({ site, who, setWho, data, steps, goals, outcome, average }) {
  const rows = mergeSegments(data.data?.segments || [], who, site, steps.length);
  return (
    <section class="card card-plain" aria-label="Who gets there">
      <div class="nx-jsum-bar">
        <h2 class="nx-h2">Who gets there <span class="muted small">· {share(average)} on average</span></h2>
        <Segmented label="Compare by" value={who} options={WHO} onChange={setWho} />
      </div>
      {data.error ? <ErrorState error={data.error} onRetry={data.reload} />
        : !data.data ? <Loading height={160} />
        : !rows.length ? <p class="muted">No visits in this period.</p>
        : (
          <div class="nx-who" role="table" aria-label={`Visits and ${outcome.label} by ${who}`}>
            <div class="nx-who-row nx-who-head" role="row">
              <span role="columnheader" /><span role="columnheader">Each step</span>
              <span class="nx-num" role="columnheader">Visits</span>
              <span class="nx-num" role="columnheader">Get there</span>
              <span role="columnheader" />
            </div>
            {rows.map((x) => {
              const rate = x.sessions ? x.converted / x.sessions : 0;
              const better = rate >= average * 1.1;
              const worse = rate <= average * 0.9;
              const tip = steps.map((s, i) => `${stepLabel(s, goals)} ${fmt(x.steps[i])}`).join(' · ');
              return (
                <div class="nx-who-row" role="row" key={x.name}>
                  <span role="cell"><Marked kind={who === 'source' ? 'source' : who === 'country' ? 'country' : 'browser'} name={x.name}>{x.name}</Marked></span>
                  <span class="nx-who-bars" role="cell" title={tip} aria-label={tip}>
                    {x.steps.map((n, i) => <i key={i} style={{ height: `${Math.max(3, (n / Math.max(1, x.sessions)) * 22)}px` }} />)}
                  </span>
                  <span class="nx-num" role="cell">{fmt(x.sessions)}</span>
                  <b class="nx-num" role="cell">{pct(x.converted, x.sessions)}</b>
                  <span class={`nx-num ${better ? 'good' : worse ? 'bad' : 'muted'}`} role="cell">{better ? 'better' : worse ? 'worse' : 'average'}</span>
                </div>
              );
            })}
          </div>
        )}
    </section>
  );
}

// Sources arrive as exact hosts; roll them up by the family people recognise.
function mergeSegments(list, who, site, stepCount) {
  const map = new Map();
  for (const x of list) {
    const name = who === 'source' ? family(x.name, site.host) : x.name;
    const row = map.get(name) || { name, sessions: 0, converted: 0, steps: Array.from({ length: stepCount }, () => 0) };
    row.sessions += x.sessions || 0;
    row.converted += x.converted || 0;
    (x.steps || []).forEach((n, i) => { row.steps[i] = (row.steps[i] || 0) + n; });
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 8);
}

// Where they came from › where they landed › where they went, and how often
// that route turned into the goal.
function RoutesCard({ site, data, outcome, average }) {
  const [sort, setSort] = useState('best');
  const all = (data.data?.routes || []).map((r) => ({ ...r, rate: r.sessions ? r.converted / r.sessions : 0 })).filter((r) => r.sessions >= 3);
  const rows = all
    .sort(sort === 'best'
      ? (a, b) => b.converted - a.converted || b.rate - a.rate || b.sessions - a.sessions
      : (a, b) => a.rate - b.rate || b.sessions - a.sessions)
    .slice(0, 5);
  return (
    <section class="card card-plain" aria-label="Routes">
      <div class="nx-jsum-bar">
        <h2 class="nx-h2">Routes <span class="muted small">· where they came from › where they landed › where they went</span></h2>
        <Segmented label="Routes" value={sort} options={[{ key: 'best', label: 'Bring the most' }, { key: 'leaky', label: 'Lose the most' }]} onChange={setSort} />
      </div>
      {data.error ? <ErrorState error={data.error} onRetry={data.reload} />
        : !data.data ? <Loading height={160} />
        : !rows.length ? <p class="muted">No routes with enough visits in this period.</p>
        : (
          <div class="nx-routes" role="table" aria-label="Routes">
            <div class="nx-route nx-route-head" role="row">
              <span role="columnheader" /><span class="nx-num" role="columnheader">Visits</span>
              <span class="nx-num" role="columnheader">{outcome.label}</span><span class="nx-num" role="columnheader">Rate</span>
            </div>
            {rows.map((r, i) => (
              <div class="nx-route" role="row" key={i}>
                <span class="nx-rpath" role="cell">
                  {[family(r.source, site.host), ...r.path].map((p, j) => [j > 0 && <span class="nx-sep" key={`p${j}`}>›</span>, <span class="nx-rc" key={`c${j}`}>{j === 0 ? p : shortPage(p)}</span>]).flat()}
                  <span class="nx-sep">›</span>
                  <span class={`nx-rc ${r.rate >= average ? 'ok' : 'no'}`}>{r.rate >= average ? outcome.label : 'mostly left'}</span>
                </span>
                <span class="nx-num" role="cell">{fmt(r.sessions)}</span>
                <span class="nx-num" role="cell">{fmt(r.converted)}</span>
                <b class={`nx-num ${r.rate >= average ? 'good' : 'bad'}`} role="cell">{(r.rate * 100).toFixed(1)}%</b>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function NoOutcome({ site }) {
  return (
    <p class="muted">
      Journeys need an outcome to count.{' '}
      <a href={`#/account?tab=sites&edit=${encodeURIComponent(site.id)}`}>Add a goal event</a> in the site’s settings, like a download or a sign-up.
    </p>
  );
}

function NoSteps({ site, range }) {
  return (
    <p class="muted">
      This site has no funnel steps for its outcome yet.{' '}
      <a href={`#/site/${site.id}/journeys?tab=funnels&range=${range}&edit=1`}>Set the steps</a> — paste the pages people pass through, or name the events.
    </p>
  );
}


