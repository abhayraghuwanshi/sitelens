import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Page } from './Page.jsx';

// Journeys: where a visit came from × the page it landed on × what it did,
// from BigQuery (so the site's leave-out rule applies). Steps and the outcome
// are the site's own goals in Setup.
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–');
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
const SEARCH = new Set(['Google', 'Bing', 'DuckDuckGo', 'Baidu', 'Yandex', 'Ecosia']);
const AI = new Set(['ChatGPT', 'Perplexity', 'Gemini', 'Claude', 'Copilot']);

export function family(source, host) {
  const s = String(source || '').toLowerCase();
  if (host && (s === host || s.endsWith(`.${host}`)) || s === 'localhost') return 'Your own site';
  for (const [re, name] of FAMILIES) if (re.test(s)) return name;
  return s.replace(/^www\./, '') || 'No referrer';
}

const kindOf = (name) => (SEARCH.has(name) ? 'search' : AI.has(name) ? 'AI assistant' : name === 'No referrer' ? '' : name === 'Your own site' ? 'a new visit while on the site' : 'link');
export const pageName = (path) => (path === '/' ? 'The home page' : !path || path === '(not set)' ? 'No page recorded' : path);

// The site's goals and its journeys, grouped by source family × landing page.
export function useJourneys(site, range) {
  const config = useAsync(() => api.get(`/sites/${site.id}/config`).catch(() => null), [site.id]);
  const goals = config.data?.config?.goals || [];
  const outcome = goals.find((g) => g.source === 'event' && g.role === 'outcome');
  const steps = goals.filter((g) => g.source === 'event' && g.role === 'step');
  const ready = Boolean(site.modes?.warehouse && outcome);
  const data = useAsync(() => (ready ? api.get(`/sites/${site.id}/warehouse/journeys${qs({ range, steps: steps.map((g) => g.match).join(','), outcome: outcome.match, min: 3 })}`) : null),
    [site.id, range, ready && outcome.match, steps.map((g) => g.match).join()]);

  const groups = new Map();
  for (const j of data.data?.journeys || []) {
    const name = family(j.source, site.host);
    const key = `${name}|${j.landing}`;
    const g = groups.get(key) || { key, name, landing: j.landing, sessions: 0, engaged: 0, converted: 0, steps: {}, sources: new Set() };
    g.sessions += j.sessions;
    g.engaged += j.engaged;
    g.converted += j.converted;
    for (const [k, v] of Object.entries(j.steps)) g.steps[k] = (g.steps[k] || 0) + v;
    g.sources.add(j.source);
    groups.set(key, g);
  }
  const journeys = [...groups.values()].sort((a, b) => b.converted - a.converted || b.sessions - a.sessions);
  // Steps in the order visitors reach them: the most common first.
  const order = steps.map((g) => ({ ...g, total: journeys.reduce((n, j) => n + (j.steps[g.match] || 0), 0) })).sort((a, b) => b.total - a.total);
  return { config, data, ready, outcome, steps: order, journeys };
}

export function JourneysPage({ site, params }) {
  const wanted = params.get('range') || '28d';
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const j = useJourneys(site, range);
  const [open, setOpen] = useState(params.get('open') || '');

  let body;
  if (!site.modes?.warehouse) body = <p class="nx-dim">Journeys need the site’s GA4 BigQuery export. Connect it in Setup.</p>;
  else if (j.config.data && !j.outcome) body = <p class="nx-dim">Journeys need an outcome to count: add a goal event in Setup (for example a download or a sign-up).</p>;
  else if (j.data.error) body = <ErrorState error={j.data.error} onRetry={j.data.reload} />;
  else if (!j.data.data) body = <Loading height={320} />;
  else {
    const first = j.journeys[0] ? `${j.journeys[0].key}` : '';
    const current = open === '' ? first : open;
    body = (
      <div class="nx-journeys">
        <div class="nx-jrow nx-jhead" aria-hidden="true"><span>Came from</span><span>Landed on</span><span class="nx-num">Visits</span><span class="nx-num">{j.outcome.label}</span><span /></div>
        {j.journeys.map((x) => (
          <JourneyRow key={x.key} site={site} j={x} steps={j.steps} outcome={j.outcome} range={range}
            open={current === x.key} onToggle={() => setOpen(current === x.key ? '-' : x.key)} />
        ))}
        <p class="nx-note">A journey shows once it has 3 visits in the period; the rest are in Explore → Sessions. “Came from” is the first page’s utm_source, else its referrer.{site.leaveOut?.countries?.length ? ' Bot-like visits are left out (Setup).' : ''}</p>
      </div>
    );
  }

  return (
    <Page title="Journeys" sub="How people come: where from, the page they land on, and what they do next"
      actions={<Segmented label="Period" value={range} options={RANGES} onChange={(key) => { location.hash = `/site/${site.id}/journeys?range=${key}`; }} />}>
      <a class="nx-more" href={`#/site/${site.id}?range=${range}`}>← Story</a>
      <section class="nx-card">{body}</section>
    </Page>
  );
}

function JourneyRow({ site, j, steps, outcome, range, open, onToggle }) {
  const rate = j.sessions ? j.converted / j.sessions : 0;
  const kind = kindOf(j.name);
  const chain = [
    { label: 'Landed', n: j.sessions },
    ...steps.map((s) => ({ label: s.label, n: j.steps[s.match] || 0 })),
    { label: outcome.label, n: j.converted, last: true },
  ];
  return (
    <div class={`nx-journey${open ? ' open' : ''}`}>
      <button type="button" class="nx-jrow" onClick={onToggle} aria-expanded={open}>
        <span><b>{j.name}</b>{kind && <span class="nx-dim small"> · {kind}</span>}</span>
        <span class="nx-path">{pageName(j.landing)}</span>
        <span class="nx-num">{fmt(j.sessions)}</span>
        <span class="nx-num"><b class={j.converted ? 'good' : ''}>{fmt(j.converted)}</b> <span class="nx-dim small">{pct(j.converted, j.sessions)}</span></span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div class="nx-jbody">
          <div class="nx-funnel">
            {chain.map((s, i) => {
              const prev = i ? chain[i - 1].n : s.n;
              const lost = prev ? Math.round((1 - s.n / prev) * 100) : 0;
              return (
                <div class="nx-fstep" key={s.label}>
                  <span class="nx-dim">{s.label}</span>
                  <span class="nx-bar"><span class={s.last ? 'last' : ''} style={{ width: `${Math.max(1.5, (s.n / Math.max(1, j.sessions)) * 100)}%` }} /></span>
                  <b class="nx-num">{fmt(s.n)}</b>
                  <span class={`small ${i && lost >= 50 ? 'bad' : 'nx-dim'}`}>{i === 0 ? '' : lost > 0 ? `${lost}% dropped` : 'none dropped'}</span>
                </div>
              );
            })}
          </div>
          <p class="nx-lede">{read(j, rate, steps)}</p>
          <div class="nx-action-row">
            <a class="nx-btn" href={`#/site/${site.id}/sessions?range=${range}&path=${encodeURIComponent(j.landing)}`}>Sessions that landed here</a>
            <a class="nx-btn" href={`#/site/${site.id}/paths?range=${range}`}>Where they went next</a>
            {SEARCH.has(j.name) && <a class="nx-btn" href={`#/site/${site.id}/search`}>Searches behind it</a>}
          </div>
        </div>
      )}
    </div>
  );
}

// One plain reading of the journey, from its own numbers only.
function read(j, rate, steps) {
  const engaged = j.sessions ? j.engaged / j.sessions : 0;
  const reach = steps[0] ? (j.steps[steps[0].match] || 0) / Math.max(1, j.sessions) : null;
  if (rate >= 0.15) return `A strong way in: ${pct(j.converted, j.sessions)} of these visits convert.`;
  if (reach !== null && reach < 0.25 && engaged >= 0.5) return `Visitors stay (${pct(j.engaged, j.sessions)} engaged) but few reach “${steps[0].label}”: the page doesn’t lead them there.`;
  if (engaged < 0.25) return `Most leave without engaging (${pct(j.engaged, j.sessions)} engaged): check whether these are real visitors, or whether the page answers what they came for.`;
  if (!j.converted) return `Visitors look around (${pct(j.engaged, j.sessions)} engaged) but none converted in this period.`;
  return `${pct(j.converted, j.sessions)} convert and ${pct(j.engaged, j.sessions)} engage.`;
}
