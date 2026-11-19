import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { Campaigns } from './Campaigns.jsx';
import { family } from './Journeys.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';
import { Posts } from '../pages/Posts.jsx';
import { Mentions } from '../pages/Mentions.jsx';

// Traffic: where visits come from and whether they're worth it, as one page
// (docs/redesign/README.md): the answer, the mix, the sources by kind, what you
// put out, and who talked about you. A source opens in the drawer (?src=); the
// full campaign report and the tagged-link builder are a click away at the end.
const KINDS = [
  ['search', 'Search', 'var(--series-1)'], ['ai', 'AI answers', 'var(--series-7)'], ['social', 'Communities', 'var(--series-2)'],
  ['direct', 'Direct', 'var(--series-muted)'], ['link', 'Other sites', 'var(--series-4)'], ['email', 'Email', 'var(--series-5)'], ['paid', 'Paid', 'var(--series-8)'],
];
const SEARCH = new Set(['Google', 'Bing', 'DuckDuckGo', 'Baidu', 'Yandex', 'Ecosia']);
const AI = new Set(['ChatGPT', 'Perplexity', 'Gemini', 'Claude', 'Copilot']);
const SOCIAL = new Set(['Reddit', 'Hacker News', 'Product Hunt', 'X', 'LinkedIn', 'YouTube']);
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const share = (v) => `${Math.round(v * 100)}%`;
const rate = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
function change(now, before) {
  if (!before) return now ? { text: 'new', tone: 'good' } : { text: '—', tone: 'muted' };
  const c = now / before - 1;
  return { text: `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}%`, tone: c >= 0.05 ? 'good' : c <= -0.05 ? 'bad' : 'muted' };
}

function kindOf(name, medium) {
  const m = String(medium || '').toLowerCase();
  if (/^(cpc|ppc|paid|paidsearch|display|cpm)/.test(m)) return 'paid';
  if (/e-?mail|newsletter/.test(m)) return 'email';
  if (name === 'No referrer') return 'direct';
  if (AI.has(name)) return 'ai';
  if (SEARCH.has(name) || m === 'organic') return 'search';
  if (SOCIAL.has(name) || /social/.test(m)) return 'social';
  return 'link';
}

// GA4 source / medium rows → one row per named source, grouped by kind.
function bySource(rows, host) {
  const out = new Map();
  for (const r of rows) {
    const name = family(r.source === '(direct)' ? '(direct)' : r.source, host);
    const kind = kindOf(name, r.medium);
    const k = `${kind}:${name}`;
    const s = out.get(k) || { key: k, name, kind, sessions: 0, engaged: 0, keyEvents: 0, previous: 0, parts: [] };
    s.sessions += r.sessions;
    s.engaged += r.engaged;
    s.keyEvents += r.keyEvents;
    s.previous += r.previous;
    s.parts.push(r);
    out.set(k, s);
  }
  return [...out.values()].sort((a, b) => b.sessions - a.sessions);
}

export function TrafficView({ site, range, params }) {
  const data = useAsync(() => api.get(`/sites/${site.id}/campaigns${qs({ range })}`), [site.id, range]);
  const [openKind, setOpenKind] = useState(null);
  const [full, setFull] = useState(false);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={320} owl label="Reading where visits come from…" />;
  const d = data.data;
  const host = String(site.host || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const sources = bySource(d.sources || [], host);
  const total = sources.reduce((n, s) => n + s.sessions, 0);
  const events = sources.reduce((n, s) => n + s.keyEvents, 0);
  const avg = total ? events / total : 0;
  const kinds = KINDS.map(([k, label, color]) => {
    const list = sources.filter((s) => s.kind === k);
    const sessions = list.reduce((n, s) => n + s.sessions, 0);
    return { k, label, color, list, sessions, keyEvents: list.reduce((n, s) => n + s.keyEvents, 0), previous: list.reduce((n, s) => n + s.previous, 0) };
  }).filter((k) => k.sessions > 0);
  const worth = (x) => {
    if (!avg || x.sessions < 10) return ['', 'muted'];
    const r = x.keyEvents / x.sessions;
    return r >= avg * 1.3 ? ['Converts', 'good'] : r <= avg * 0.5 ? ['Mostly browsing', 'muted'] : ['Average', ''];
  };
  const src = params.get('src') || '';
  const opened = sources.find((s) => s.key === src);
  const top = kinds[0];
  const growing = kinds.filter((k) => k.previous && k.sessions >= 10).sort((a, b) => b.sessions / b.previous - a.sessions / a.previous)[0];
  const bestRate = avg ? kinds.filter((k) => k.sessions >= 20).sort((a, b) => b.keyEvents / b.sessions - a.keyEvents / a.sessions)[0] : null;
  const tagged = (d.campaigns || []).slice(0, 5);

  if (!total) return <p class="nx-empty">No visits in this period yet.</p>;
  return (
    <div class="nx-traffic">
      <p class="nx-answer">
        <b>{fmt(total)}</b> visits. {top.label} brought {share(top.sessions / total)}.
        {growing && growing.sessions > growing.previous && <> {growing.label} grew most ({change(growing.sessions, growing.previous).text}).</>}
        {bestRate && bestRate.keyEvents > 0 && <> Visitors from <b>{bestRate.label.toLowerCase()}</b> reach a key event most often ({rate(bestRate.keyEvents / bestRate.sessions)}, against {rate(avg)} on average).</>}
      </p>

      <section class="nx-block" aria-label="The mix">
        <h2 class="nx-h2">The mix <span class="muted small">· where visits come from{avg ? ', and how often each kind reaches a key event' : ''}</span></h2>
        <div class="card card-plain">
          <div class="nx-mixbar" role="img" aria-label={kinds.map((k) => `${k.label} ${share(k.sessions / total)}`).join(', ')}>
            {kinds.map((k) => <span key={k.k} style={`flex:${k.sessions};background:${k.color}`} title={`${k.label}: ${fmt(k.sessions)} visits`} />)}
          </div>
          <div class="nx-mixleg">
            {kinds.map((k) => {
              const [w, tone] = worth(k);
              return (
                <span key={k.k} class="nx-mlrow">
                  <i style={`background:${k.color}`} /><b>{k.label}</b><span class="muted">{share(k.sessions / total)}</span>
                  {avg ? <span class={tone}>{rate(k.keyEvents / k.sessions)} {w ? `· ${w.toLowerCase()}` : ''}</span> : null}
                </span>
              );
            })}
          </div>
          {avg ? <p class="muted small m-0">Key events: GA4’s key events (sign-ups, purchases…). Average {rate(avg)} of visits.</p> : null}
        </div>
      </section>

      <section class="nx-block" aria-label="By source">
        <h2 class="nx-h2">By source <span class="muted small">· open a kind for its sources, a source for its detail</span></h2>
        <div class="card card-plain nx-tight">
          <div class="nx-trow nx-thead" aria-hidden="true"><span>Kind</span><span class="nx-num">Visits</span><span class="nx-num">Change</span><span>Worth it?</span></div>
          {kinds.map((k) => {
            const c = change(k.sessions, k.previous);
            const [w, tone] = worth(k);
            const isOpen = openKind === k.k;
            return (
              <div key={k.k}>
                <button type="button" class={`nx-trow nx-tgroup${isOpen ? ' open' : ''}`} aria-expanded={isOpen} onClick={() => setOpenKind(isOpen ? null : k.k)}>
                  <span class="nx-tgn"><Icon name="chevron" size={12} /><i style={`background:${k.color}`} /><b>{k.label}</b><small>{k.list.slice(0, 2).map((s) => s.name).join(', ')}{k.list.length > 2 ? ` +${k.list.length - 2}` : ''}</small></span>
                  <span class="nx-num">{fmt(k.sessions)}</span><span class={`nx-num ${c.tone}`}>{c.text}</span><span class={tone}>{w}</span>
                </button>
                {isOpen && k.list.map((s) => {
                  const sc = change(s.sessions, s.previous);
                  const [sw, st] = worth(s);
                  return (
                    <a key={s.key} class={`nx-trow nx-tsub${src === s.key ? ' on' : ''}`} href={hrefWith('src', s.key)}>
                      <span>{s.name}</span><span class="nx-num">{fmt(s.sessions)}</span><span class={`nx-num ${sc.tone}`}>{sc.text}</span><span class={st}>{sw}</span>
                    </a>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {(tagged.length > 0 || d.ads?.linked) && (
        <section class="nx-block" aria-label="Tagged links and ads">
          <h2 class="nx-h2">Tagged links and ads <span class="muted small">· campaigns{d.ads?.linked ? ' and Google Ads' : ''}</span></h2>
          <div class="card card-plain nx-tight">
            {tagged.map((c) => {
              const cc = change(c.sessions, c.previous);
              return (
                <div key={c.campaign} class="nx-orow">
                  <span class="nx-hk"><Icon name="megaphone" size={14} /></span>
                  <span class="nx-ob"><b>{c.campaign}</b><small class="muted">{c.parts?.slice(0, 2).map((p) => `${p.source} / ${p.medium}`).join(', ')}</small></span>
                  <span class="nx-num">{fmt(c.sessions)}<small>visits</small></span>
                  <span class={`nx-num ${cc.tone}`}>{cc.text}<small>change</small></span>
                  <span class="nx-num">{fmt(c.keyEvents)}<small>key events</small></span>
                </div>
              );
            })}
            {d.ads?.linked && (d.ads.campaigns || []).slice(0, 3).map((a) => (
              <div key={a.campaign} class="nx-orow">
                <span class="nx-hk"><Icon name="target" size={14} /></span>
                <span class="nx-ob"><b>{a.campaign}</b><small class="muted">Google Ads · ${fmt(a.cost)} spent</small></span>
                <span class="nx-num">{fmt(a.sessions)}<small>visits</small></span>
                <span class="nx-num">{a.keyEvents ? `$${fmt(a.cost / a.keyEvents)}` : '—'}<small>per key event</small></span>
                <span class="nx-num">{fmt(a.keyEvents)}<small>key events</small></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section class="nx-block" aria-label="What you put out">
        <h2 class="nx-h2">What you put out <span class="muted small">· posts, newsletters and links, and what they brought</span></h2>
        <Posts range={range} id={params.get('post') || undefined} />
      </section>

      <section class="nx-block" aria-label="Who talked about you">
        <h2 class="nx-h2">Who talked about you <span class="muted small">· mentions elsewhere</span></h2>
        <Mentions range={range} />
      </section>

      <button type="button" class="todo-link" aria-expanded={full} onClick={() => setFull(!full)}>{full ? 'Hide the full report' : 'Every campaign and source / medium, and the tagged-link builder'}</button>
      {full && <Campaigns site={site} range={range} />}

      {opened && <SourcePanel site={site} s={opened} avg={avg} total={total} campaigns={d.campaigns || []} onClose={() => { location.hash = hrefWith('src', '').slice(1); }} />}
    </div>
  );
}

function SourcePanel({ site, s, avg, total, campaigns, onClose }) {
  const c = change(s.sessions, s.previous);
  const kind = KINDS.find(([k]) => k === s.kind)?.[1];
  const r = s.sessions ? s.keyEvents / s.sessions : 0;
  const used = campaigns.filter((x) => x.parts?.some((p) => family(p.source) === s.name));
  return (
    <Drawer title={<>{s.name} <span class="muted">· {kind}</span></>} onClose={onClose}>
      <p class="nx-big">
        <b>{fmt(s.sessions)}</b> visits ({share(s.sessions / total)} of all), {c.text === 'new' ? 'new this period' : <span class={c.tone}>{c.text}</span>}{c.text !== 'new' && ' on the period before'}.
        {avg ? <> {rate(r)} reached a key event, against {rate(avg)} on average.</> : null}
      </p>
      <table class="nx-mini-table">
        <thead><tr><th>Source / medium</th><th>Visits</th><th>Engaged</th><th>Key events</th></tr></thead>
        <tbody>
          {s.parts.sort((a, b) => b.sessions - a.sessions).slice(0, 8).map((p) => (
            <tr key={`${p.source}/${p.medium}`}><th>{p.source} / {p.medium}</th><td>{fmt(p.sessions)}</td><td>{p.sessions ? share(p.engaged / p.sessions) : '—'}</td><td>{fmt(p.keyEvents)}</td></tr>
          ))}
        </tbody>
      </table>
      {used.length > 0 && (
        <div class="nx-drawer-sec">
          <h3 class="nx-label-sm">Tagged links from it</h3>
          <ul class="nx-plain-list">{used.slice(0, 5).map((x) => <li key={x.campaign}><b>{x.campaign}</b> <span class="muted">· {fmt(x.sessions)} visits</span></li>)}</ul>
        </div>
      )}
      <div class="nx-btns">
        <a class="btn" href={`#/site/${site.id}/timeline`}><Icon name="calendar" size={13} /> See it by day</a>
        {site.modes?.warehouse && <a class="btn" href={`#/site/${site.id}/journeys`}><Icon name="route" size={13} /> Where they go</a>}
        <AddTodo site={site} todo={{ title: `Look into ${s.name} traffic`, from: `source:${s.name}`, subject: { kind: 'source', key: s.name } }} label="To-do" />
      </div>
    </Drawer>
  );
}
