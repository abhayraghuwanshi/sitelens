import { useState } from 'preact/hooks';
import { formatDuration } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, WarehouseMeta, PathChain, Segmented } from '../components/ui.jsx';
import { family, pageName } from '../next/Journeys.jsx';
import { Sankey } from '../charts/Sankey.jsx';

const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–');

export function Sessions({ site, range, params }) {
  const [path, setPath] = useState(params.get('path') || params.get('start') || '');
  const [depth, setDepth] = useState('4');
  const [converted, setConverted] = useState('');
  const [query, setQuery] = useState({ path: params.get('path') || params.get('start') || '', converted: '' });
  const config = useAsync(() => api.get(`/sites/${site.id}/config`).catch(() => null), [site.id]);
  const outcome = (config.data?.config?.goals || []).find((g) => g.source === 'event' && g.role === 'outcome') || null;
  const data = useAsync((o) => api.get(`/sites/${site.id}/warehouse/sessions${qs({ range, ...query, limit: 100, fresh: o?.fresh })}`), [site.id, range, query.path, query.converted]);
  const summary = useAsync(
    (o) => (config.loading ? null : api.get(`/sites/${site.id}/warehouse/sessions-summary${qs({ range, ...query, outcome: outcome?.match || '', fresh: o?.fresh })}`)),
    [site.id, range, query.path, query.converted, config.loading, outcome?.match],
  );
  // The flow starts from the filtered page: a session can only flow on from where it began.
  const flow = useAsync((o) => api.get(`/sites/${site.id}/warehouse/paths${qs({ range, depth, start: query.path, top: 16, fresh: o?.fresh })}`),
    [site.id, range, depth, query.path]);
  const filterTo = (page) => { setPath(page); setQuery({ path: page, converted: converted.trim() }); };

  return (
    <>
      <form class="toolbar" onSubmit={(e) => { e.preventDefault(); setQuery({ path: path.trim(), converted: converted.trim() }); }}>
        <label class="sr-only" for="s-path">Visited page</label>
        <input id="s-path" type="text" style={{ width: '240px' }} placeholder="Visited page, e.g. /pricing" value={path} onInput={(e) => setPath(e.currentTarget.value)} />
        <label class="sr-only" for="s-conv">Fired event</label>
        <input id="s-conv" type="text" style={{ width: '240px' }} placeholder="Fired event, e.g. sign_up" value={converted} onInput={(e) => setConverted(e.currentTarget.value)} />
        <button class="btn" type="submit">Filter</button>
        {(query.path || query.converted) && <button class="btn" type="button" onClick={() => { setPath(''); setConverted(''); setQuery({ path: '', converted: '' }); }}>Clear</button>}
      </form>

      {summary.error ? <ErrorState error={summary.error} onRetry={summary.reload} />
        : summary.data?.summary ? <Summary s={summary.data.summary} site={site} outcome={outcome} query={query} onPage={filterTo} flow={flow} depth={depth} setDepth={setDepth} />
        : summary.data ? null : <Loading height={260} />}

      {data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <Loading height={480} />
      ) : (
        <Card title="Sessions" sub={`The ${data.data.sessions.length} most recent${summary.data?.summary ? ` of ${fmt(summary.data.summary.sessions)}` : ''}`} flush>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr><th>Started</th><th>Journey</th><th class="num">Duration</th><th>Came from</th><th>System</th><th>Country</th></tr>
              </thead>
              <tbody>
                {data.data.sessions.map((s) => (
                  <tr key={`${s.user}:${s.sessionId}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(s.startedAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      <div class="muted small">{s.returning ? 'Returning' : 'New'}</div>
                    </td>
                    <td>
                      <PathChain pages={s.pages} />
                      <div class="small muted" style={{ marginTop: '3px' }}>
                        {s.pageCount} pages · {s.eventCount} events
                        {s.conversions > 0 && <span class="chip good" style={{ marginLeft: '6px' }}>{query.converted} ×{s.conversions}</span>}
                      </div>
                    </td>
                    <td class="num">{formatDuration(s.durationSec)}</td>
                    <td class="small">{s.visitSource ? family(s.visitSource, site.host) : <>{s.source} <span class="muted">/ {s.medium}</span></>}</td>
                    <td class="small">{s.system ? <>{s.system}{s.browser && <span class="muted"> · {s.browser}</span>}</> : s.device}</td>
                    <td class="small">{s.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.data.sessions.length && <p class="muted" style={{ padding: '8px 16px' }}>No sessions match.</p>}
          </div>
          <div style={{ padding: '8px 16px 10px' }}><WarehouseMeta data={data.data} /></div>
        </Card>
      )}
      <p class="note">The summary counts every session that matches the filters; the list shows the 100 most recent. “Came from” is the visit’s utm_source, else its referrer. User IDs are GA4’s pseudonymous device IDs.</p>
    </>
  );
}

const MORE = [
  { key: 'source', label: 'Came from' },
  { key: 'system', label: 'System' },
  { key: 'browser', label: 'Browser' },
  { key: 'country', label: 'Country' },
];

// Every matching session at a glance: totals, what stands out, and where they
// land, leave and come from. Clicking a page filters the list to it.
const DEPTHS = [3, 4, 5, 6].map((d) => ({ key: String(d), label: `${d} steps` }));

function Summary({ s, site, outcome, query, onPage, flow, depth, setDepth }) {
  const [more, setMore] = useState('source');
  if (!s.sessions) return null;
  const label = outcome?.label;
  const sources = groupBy(s.source, (name) => family(name, site.host));
  const lists = { source: sources, system: s.system, browser: s.browser.filter((x) => x.name !== '(not set)'), country: s.country.filter((x) => x.name !== '(not set)') };
  const notes = findings(s, sources, label);
  const scope = query.path || query.converted
    ? `Sessions${query.path ? ` that visited ${query.path}` : ''}${query.converted ? `${query.path ? ' and' : ''} that fired ${query.converted}` : ''}`
    : 'All sessions in the period';
  return (
    <section class="nx-card nx-jsum" aria-label="Sessions summary">
      <p class="muted small" style={{ margin: 0 }}>{scope}</p>
      <div class="nx-jsum-stats nx-tiles">
        <div><b>{fmt(s.sessions)}</b><span class="muted small">sessions</span></div>
        <div><b>{fmt(s.people)}</b><span class="muted small">people · {pct(s.returning, s.sessions)} returning visits</span></div>
        <div><b>{pct(s.onePage, s.sessions)}</b><span class="muted small">saw only one page</span></div>
        <div><b>{formatDuration(s.medianSec)}</b><span class="muted small">median time on site</span></div>
        {label && <div><b class={s.converted ? 'good' : ''}>{fmt(s.converted)}</b><span class="muted small">{label.toLowerCase()} · {pct(s.converted, s.sessions)}</span></div>}
      </div>
      {notes.length > 0 && (
        <div>
          <h3 class="nx-jsum-h">What stands out</h3>
          <ul class="nx-jfind nx-jfind-3">
            {notes.map((n) => (
              <li key={n.title} class={`tone-${n.tone}`}><b>{n.title}</b><span class="muted small">{n.detail}</span></li>
            ))}
          </ul>
        </div>
      )}
      <div class="nx-ssum-flow">
        <div class="nx-jsum-bar">
          <h3 class="nx-jsum-h">{query.path ? `How sessions that landed on ${query.path} move` : 'How sessions move'}</h3>
          <Segmented label="Steps" value={depth} options={DEPTHS} onChange={setDepth} />
        </div>
        {flow.error ? <ErrorState error={flow.error} onRetry={flow.reload} />
          : !flow.data ? <Loading height={340} />
          : <Sankey edges={flow.data.edges} total={flow.data.total} height={340} onSelect={onPage} />}
        <p class="muted small" style={{ margin: '6px 0 0' }}>Reloads collapsed. Click a page to filter everything to it.</p>
      </div>
      <div class="nx-ssum-lists">
        <TopList title="Landed on" rows={s.landing} total={s.sessions} label={label} name={pageName} onPick={onPage} />
        <TopList title="Left from" rows={withExitRate(s.exit, flow.data?.exits)} total={s.sessions} label={label} name={pageName} onPick={onPage} />
        <TopList title={MORE.find((m) => m.key === more).label} rows={lists[more]} total={s.sessions} label={label}
          head={<Segmented label="Show" value={more} options={MORE.map((m) => ({ ...m, label: m.label === 'Came from' ? 'Source' : m.label }))} onChange={setMore} />} />
      </div>
    </section>
  );
}

function TopList({ title, rows, total, label, name = (x) => x, onPick, head }) {
  const max = Math.max(1, ...rows.map((x) => x.n));
  return (
    <div>
      <div class="nx-jsum-bar"><h3 class="nx-jsum-h">{title}</h3>{head}</div>
      <div class="nx-ssum-rows">
        <div class={`nx-ssum-row nx-ssum-head${label ? '' : ' nolabel'}`} aria-hidden="true"><span /><span class="nx-num">Sessions</span>{label && <span class="nx-num" title={label}>Conv.</span>}</div>
        {rows.slice(0, 6).map((x) => {
          const inner = (
            <>
              <span class="nx-ssum-name" title={x.name}>{name(x.name)}</span>
              <span class="nx-num">{fmt(x.n)} {x.exitRate != null
                ? <span class={`small ${x.exitRate >= 0.7 ? 'bad' : 'muted'}`} title="Exit rate: the share of this page's views that were the last page of the session">{Math.round(x.exitRate * 100)}% exit</span>
                : <span class="muted small">{pct(x.n, total)}</span>}</span>
              {label && <span class="nx-num small"><b class={x.converted ? 'good' : 'muted'}>{fmt(x.converted)}</b></span>}
              <span class="nx-bar nx-ssum-bar"><span style={{ width: `${Math.max(1.5, (x.n / max) * 100)}%` }} /></span>
            </>
          );
          return onPick && x.name !== '(not set)'
            ? <button type="button" class={`nx-ssum-row${label ? '' : ' nolabel'}`} key={x.name} title={`Show sessions that visited ${x.name}`} onClick={() => onPick(x.name)}>{inner}</button>
            : <div class={`nx-ssum-row${label ? '' : ' nolabel'}`} key={x.name}>{inner}</div>;
        })}
        {!rows.length && <span class="muted small">Nothing recorded.</span>}
      </div>
    </div>
  );
}

// Left-from pages with their exit rate (exits ÷ page views) from the flow query.
function withExitRate(rows, exits) {
  const by = new Map((exits || []).map((e) => [e.page, e]));
  return rows.map((x) => {
    const e = by.get(x.name);
    return e && e.views ? { ...x, exitRate: e.exits / e.views } : x;
  });
}

// Merge raw values that name the same thing (google.com, www.google.co.in → Google).
function groupBy(rows, nameOf) {
  const m = new Map();
  for (const r of rows) {
    const name = nameOf(r.name);
    const g = m.get(name) || { name, n: 0, converted: 0 };
    g.n += r.n;
    g.converted += r.converted;
    m.set(name, g);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

// A page's name inside a sentence (“the home page”, not “The home page”).
const inline = (path) => pageName(path).replace(/^The /, 'the ').replace(/^No page recorded$/, 'no recorded page');

// What stands out, from the summary's own numbers only. Top lists are
// approximate counts of the top values, so findings only read the big ones.
function findings(s, sources, label) {
  const out = [];
  const rate = (x) => (x.n ? x.converted / x.n : 0);
  const quick = s.quick / s.sessions;
  if (quick >= 0.3) {
    out.push({ tone: 'bad', title: `${pct(s.quick, s.sessions)} left within 10 seconds`, detail: 'Either they aren’t real visitors (bots land and leave), or the page didn’t answer what they came for.' });
  }
  if (s.onePage / s.sessions >= 0.6) {
    out.push({ tone: 'warn', title: `${pct(s.onePage, s.sessions)} saw only one page`, detail: 'Most visits never go past the page they land on: give each landing page a clear next step.' });
  }
  const topExit = s.exit[0];
  if (topExit && topExit.n / s.sessions >= 0.15) {
    out.push({ tone: 'warn', title: `Most visits end on ${inline(topExit.name)}`, detail: `${fmt(topExit.n)} sessions (${pct(topExit.n, s.sessions)}) leave from it${label ? `, and ${fmt(topExit.converted)} of them had ${label.toLowerCase()}` : ''}.` });
  }
  if (label && s.converted) {
    const newVisits = s.sessions - s.returning;
    const newConv = s.converted - s.convertedReturning;
    if (s.returning >= 20 && newVisits >= 20) {
      const r = s.convertedReturning / s.returning;
      const n = newConv / newVisits;
      if (r >= n * 2 || n >= r * 2) {
        const hi = r > n ? 'Returning' : 'New';
        const lo = r > n ? 'new' : 'returning';
        const times = Math.min(r, n) > 0 ? Math.round(Math.max(r, n) / Math.min(r, n)) : 0;
        out.push({
          tone: 'good',
          title: times && times <= 10 ? `${hi} visitors convert ${times}× as often` : `${hi} visitors convert; ${lo} ones almost never do`,
          detail: `Returning ${pct(s.convertedReturning, s.returning)}, new ${pct(newConv, newVisits)}.${r < n ? ' Returning visitors may simply have converted already.' : ''}`,
        });
      }
    }
    const bestPage = s.landing.filter((x) => x.name !== '(not set)' && x.n >= 10 && x.converted).sort((a, b) => rate(b) - rate(a))[0];
    if (bestPage) out.push({ tone: 'good', title: `Best landing page: ${pageName(bestPage.name)}`, detail: `${pct(bestPage.converted, bestPage.n)} of its ${fmt(bestPage.n)} sessions had ${label.toLowerCase()}.` });
    const deadPage = s.landing.filter((x) => x.name !== '(not set)' && x.n >= 20 && !x.converted)[0];
    if (deadPage) out.push({ tone: 'bad', title: `${pageName(deadPage.name)}: ${fmt(deadPage.n)} sessions, none converted`, detail: `It's one of the most common ways in. Does it lead to “${label}”?` });
    const bigSource = sources.filter((x) => x.n / s.sessions >= 0.1 && rate(x) < (s.converted / s.sessions) / 3)[0];
    if (bigSource) out.push({ tone: 'warn', title: `${bigSource.name}: ${pct(bigSource.n, s.sessions)} of sessions, ${pct(bigSource.converted, bigSource.n)} convert`, detail: `The site overall converts at ${pct(s.converted, s.sessions)}.` });
  }
  return out.slice(0, 6);
}
