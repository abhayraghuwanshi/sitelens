import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Page } from './Page.jsx';

// Journeys: where a visit came from × the page it landed on × what it did,
// from BigQuery (so the site's leave-out rule applies). Steps and the outcome
// are the site's own goals (set on its Edit page).
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
    const g = groups.get(key) || { key, name, landing: j.landing, sessions: 0, engaged: 0, converted: 0, steps: {}, sources: new Set(), first: {}, systems: {}, systemsConverted: {}, browsers: {}, browsersConverted: {} };
    g.sessions += j.sessions;
    g.engaged += j.engaged;
    g.converted += j.converted;
    for (const [k, v] of Object.entries(j.steps)) g.steps[k] = (g.steps[k] || 0) + v;
    g.sources.add(j.source);
    for (const [k, v] of Object.entries(j.systems || {})) g.systems[k] = (g.systems[k] || 0) + v;
    for (const [k, v] of Object.entries(j.systemsConverted || {})) g.systemsConverted[k] = (g.systemsConverted[k] || 0) + v;
    for (const [k, v] of Object.entries(j.browsers || {})) g.browsers[k] = (g.browsers[k] || 0) + v;
    for (const [k, v] of Object.entries(j.browsersConverted || {})) g.browsersConverted[k] = (g.browsersConverted[k] || 0) + v;
    // No-referrer visits: where each visitor first came from, by family.
    for (const f of j.firstSources || []) {
      const fam = family(f.source, site.host);
      g.first[fam] = (g.first[fam] || 0) + f.n;
    }
    groups.set(key, g);
  }
  const journeys = [...groups.values()].sort((a, b) => b.converted - a.converted || b.sessions - a.sessions);
  // Steps in the order visitors reach them: the most common first.
  const order = steps.map((g) => ({ ...g, total: journeys.reduce((n, j) => n + (j.steps[g.match] || 0), 0) })).sort((a, b) => b.total - a.total);
  return { config, data, ready, outcome, steps: order, journeys, systems: data.data?.systems || [] };
}

export function JourneysPage({ site, params }) {
  const wanted = params.get('range') || '28d';
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const j = useJourneys(site, range);
  const [open, setOpen] = useState(params.get('open') || '');

  let body;
  if (!site.modes?.warehouse) body = <p class="nx-dim">Journeys need the site’s GA4 BigQuery export. Connect it in the site’s settings.</p>;
  else if (j.config.data && !j.outcome) body = <p class="nx-dim">Journeys need an outcome to count: add a goal event in the site’s settings (for example a download or a sign-up).</p>;
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
        <p class="nx-note">A journey shows once it has 3 visits in the period; the rest are in Explore → Sessions. “Came from” is the first page’s utm_source, else its referrer; for visits with neither, “first came from” is where that visitor first found the site.{site.leaveOut?.countries?.length ? ' Bot-like visits are left out (see the site’s settings).' : ''}</p>
      </div>
    );
  }

  return (
    <Page title="Journeys" sub="How people come: where from, the page they land on, and what they do next"
      actions={<Segmented label="Period" value={range} options={RANGES} onChange={(key) => { location.hash = `/site/${site.id}/journeys?range=${key}`; }} />}>
      <a class="nx-more" href={`#/site/${site.id}?range=${range}`}>← Story</a>
      {j.data.data && j.outcome && <Summary j={j} />}
      <section class="nx-card">{body}</section>
    </Page>
  );
}

function JourneyRow({ site, j, steps, outcome, range, open, onToggle }) {
  const rate = j.sessions ? j.converted / j.sessions : 0;
  const kind = kindOf(j.name);
  // For “No referrer”: the known first-ever sources of these visitors, biggest first.
  const first = j.name === 'No referrer'
    ? Object.entries(j.first || {}).filter(([name]) => name !== 'No referrer').sort((a, b) => b[1] - a[1])
    : [];
  const firstKnown = first.reduce((n, [, v]) => n + v, 0);
  const chain = [
    { label: 'Landed', n: j.sessions },
    ...steps.map((s) => ({ label: s.label, n: j.steps[s.match] || 0 })),
    { label: outcome.label, n: j.converted, last: true },
  ];
  return (
    <div class={`nx-journey${open ? ' open' : ''}`}>
      <button type="button" class="nx-jrow" onClick={onToggle} aria-expanded={open}>
        <span><b>{j.name}</b>{kind && <span class="nx-dim small"> · {kind}</span>}
          {first.length > 0 && <span class="nx-dim small nx-jfirst">first came from {first.slice(0, 2).map(([name]) => name).join(', ')}</span>}</span>
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
          <SystemSplit j={j} outcome={outcome} />
          {j.name === 'No referrer' && (
            <p class="nx-dim small">
              {first.length
                ? <>Where these visitors first came from: {first.map(([name, n]) => `${name} ${fmt(n)}`).join(' · ')}. The other {fmt(Math.max(0, j.sessions - firstKnown))} have no known source: links opened from apps, email or bookmarks, typed addresses, or bots.</>
                : <>None of these visitors has a known first source: links opened from apps, email or bookmarks, typed addresses, or bots. Tag links you share (and links your app opens) with utm_source to see them here.</>}
            </p>
          )}
          <div class="nx-action-row">
            <a class="nx-btn" href={`#/site/${site.id}/sessions?range=${range}&path=${encodeURIComponent(j.landing)}`}>Sessions that landed here</a>
            <a class="nx-btn" href={`#/site/${site.id}/sessions?range=${range}&start=${encodeURIComponent(j.landing)}`}>Where they went next</a>
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

// Summary rows come back per system × browser; roll them up by one of the two.
// Browsers under 2% of visits fold into “Other”.
const BROWSER = (b) => (!b || b === '(not set)' ? 'Unknown' : b);
function rollUp(rows, by, total) {
  const m = new Map();
  for (const r of rows) {
    const name = by === 'browser' ? BROWSER(r.browser) : r.name;
    const g = m.get(name) || { name, sessions: 0, converted: 0 };
    g.sessions += r.sessions;
    g.converted += r.converted;
    m.set(name, g);
  }
  let list = [...m.values()].sort((a, b) => b.sessions - a.sessions);
  if (by === 'browser') {
    const small = list.filter((x) => x.sessions / total < 0.02 || x.name === 'Unknown');
    list = list.filter((x) => !small.includes(x));
    const rest = small.reduce((acc, x) => ({ ...acc, sessions: acc.sessions + x.sessions, converted: acc.converted + x.converted }), { name: 'Other', sessions: 0, converted: 0 });
    if (rest.sessions) list.push(rest);
  }
  return list;
}

// The period at a glance: every visit (not only the listed journeys), split by
// system or browser, and what stands out — each a short headline with one line under it.
function Summary({ j }) {
  const [by, setBy] = useState('system');
  const total = j.systems.reduce((acc, x) => ({
    sessions: acc.sessions + x.sessions, converted: acc.converted + x.converted, noReferrer: acc.noReferrer + x.noReferrer,
  }), { sessions: 0, converted: 0, noReferrer: 0 });
  if (!total.sessions) return null;
  const label = j.outcome.label;
  const hasBrowser = j.systems.some((x) => BROWSER(x.browser) !== 'Unknown');
  const rows = rollUp(j.systems, hasBrowser ? by : 'system', total.sessions);
  const max = Math.max(...rows.map((x) => x.sessions));
  const notes = findings(j, total, label).slice(0, 5);
  return (
    <section class="nx-card nx-jsum" aria-label="Summary">
      <div class="nx-jsum-stats">
        <div><b>{fmt(total.sessions)}</b><span class="nx-dim small">visits</span></div>
        <div><b class={total.converted ? 'good' : ''}>{fmt(total.converted)}</b><span class="nx-dim small">{label.toLowerCase()}</span></div>
        <div><b>{pct(total.converted, total.sessions)}</b><span class="nx-dim small">of visits convert</span></div>
        <div><b>{pct(total.noReferrer, total.sessions)}</b><span class="nx-dim small">came with no referrer</span></div>
      </div>
      <div class="nx-jsum-grid">
        <div>
          <div class="nx-jsum-bar">
            <h3 class="nx-jsum-h">By {hasBrowser ? by : 'system'}</h3>
            {hasBrowser && <Segmented label="Split by" value={by} options={[{ key: 'system', label: 'System' }, { key: 'browser', label: 'Browser' }]} onChange={setBy} />}
          </div>
          <div class="nx-jsys" role="table" aria-label={`Visits and ${label.toLowerCase()} by ${by}`}>
            <div class="nx-jsys-row nx-jsys-head" role="row"><span role="columnheader" /><span role="columnheader" /><span class="nx-num" role="columnheader">Visits</span><span class="nx-num" role="columnheader" title={label}>Converted</span></div>
            {rows.map((x) => (
              <div class="nx-jsys-row" role="row" key={x.name}>
                <span role="cell">{x.name}</span>
                <span class="nx-bar" role="cell"><span style={{ width: `${Math.max(1.5, (x.sessions / max) * 100)}%` }} /></span>
                <span class="nx-num" role="cell">{fmt(x.sessions)}</span>
                <span class="nx-num" role="cell"><b class={x.converted ? 'good' : 'nx-dim'}>{fmt(x.converted)}</b> <span class="nx-dim small nx-jsys-pct">{pct(x.converted, x.sessions)}</span></span>
              </div>
            ))}
          </div>
        </div>
        {notes.length > 0 && (
          <div>
            <h3 class="nx-jsum-h nx-jsum-bar">What stands out</h3>
            <ul class="nx-jfind">
              {notes.map((n) => (
                <li key={n.title} class={`tone-${n.tone}`}>
                  <b>{n.title}</b>
                  <span class="nx-dim small">{n.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// What stands out, from the period's own numbers only: the best way in, the
// biggest leak, and systems that don't convert. Systems under 5% of visits are
// too small to read into.
function findings(j, total, label) {
  const out = [];
  const what = label.toLowerCase();
  const overall = total.converted / total.sessions;
  const rate = (x) => (x.sessions ? x.converted / x.sessions : 0);
  const share = (x) => x.sessions / total.sessions;
  const ways = j.journeys.filter((x) => x.name !== 'Your own site');
  const best = ways.filter((x) => x.converted).sort((a, b) => b.converted - a.converted || rate(b) - rate(a))[0];
  if (best) out.push({ tone: 'good', title: `Best way in: ${best.name} → ${pageName(best.landing)}`, detail: `${fmt(best.converted)} of ${fmt(best.sessions)} visits (${pct(best.converted, best.sessions)}) ${what}.` });
  const leak = ways.filter((x) => rate(x) < overall / 2).sort((a, b) => b.sessions - a.sessions)[0];
  if (leak) out.push({ tone: 'bad', title: `Biggest leak: ${leak.name} → ${pageName(leak.landing)}`, detail: `${fmt(leak.sessions)} visits, ${leak.converted ? `only ${fmt(leak.converted)}` : 'none'} converted.` });
  const systems = rollUp(j.systems, 'system', total.sessions);
  const big = systems.filter((x) => share(x) >= 0.05);
  const phones = big.find((x) => x.name === 'Phones and tablets');
  if (phones && share(phones) >= 0.1 && rate(phones) < overall / 3) {
    out.push({ tone: 'warn', title: `Phones: ${pct(phones.sessions, total.sessions)} of visits, ${pct(phones.converted, phones.sessions)} convert`, detail: 'If it needs a computer, let phone visitors send themselves the link for later.' });
  }
  for (const x of big.filter((x) => x !== phones && !x.converted && x.sessions >= 20)) {
    out.push({ tone: 'bad', title: `${x.name}: ${fmt(x.sessions)} visits, none converted`, detail: `Is there a ${x.name} version, and does the page say so?` });
  }
  const ranked = big.filter((x) => x !== phones && x.converted).sort((a, b) => rate(b) - rate(a));
  if (ranked.length >= 2 && rate(ranked[0]) >= rate(ranked.at(-1)) * 2) {
    const low = ranked.at(-1);
    out.push({ tone: 'warn', title: `${low.name} converts at ${pct(low.converted, low.sessions)}, ${ranked[0].name} at ${pct(ranked[0].converted, ranked[0].sessions)}`, detail: `Check that the page and “${label}” work on ${low.name}.` });
  }
  // Browsers on computers only, so phone visits don't hide a browser that's broken.
  const desk = j.systems.filter((x) => x.name !== 'Phones and tablets');
  const deskTotal = desk.reduce((n, x) => n + x.sessions, 0);
  const deskConv = desk.reduce((n, x) => n + x.converted, 0);
  if (deskTotal && deskConv) {
    const browsers = rollUp(desk, 'browser', deskTotal).filter((x) => x.name !== 'Other' && x.sessions / deskTotal >= 0.05 && x.sessions >= 20);
    const deskRate = deskConv / deskTotal;
    for (const x of browsers.filter((b) => rate(b) < deskRate / 3)) {
      out.push({ tone: 'warn', title: `${x.name} on computers: ${fmt(x.sessions)} visits, ${x.converted ? `only ${pct(x.converted, x.sessions)}` : 'none'} converted`, detail: `Other browsers convert at ${pct(deskConv - x.converted, deskTotal - x.sessions)}. Check that “${label}” works in ${x.name}.` });
    }
  }
  return out;
}

// One journey's visits and outcome by system and by browser.
function SystemSplit({ j, outcome }) {
  const line = (title, counts, conv) => {
    const rows = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return null;
    return (
      <p class="nx-dim small nx-jsplit">
        {title}: {rows.map(([name, n], i) => (
          <span key={name}>{i ? ' · ' : ''}{name} {fmt(n)}{conv?.[name] ? <> (<span class="good">{fmt(conv[name])}</span> {outcome.label.toLowerCase()})</> : ''}</span>
        ))}
      </p>
    );
  };
  const browsers = Object.fromEntries(Object.entries(j.browsers || {}).filter(([k]) => k !== '(not set)'));
  return <>{line('By system', j.systems, j.systemsConverted)}{line('By browser', browsers, j.browsersConverted)}</>;
}
