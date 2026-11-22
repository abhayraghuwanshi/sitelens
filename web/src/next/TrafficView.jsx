import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { Campaigns } from './Campaigns.jsx';
import { AdMoney, moneyFormat } from './AdMoney.jsx';
import { family } from './Journeys.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';
import { Accounts, AddByUrl, LinkBuilder } from '../pages/Posts.jsx';

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
  const [fresh, setFresh] = useState(0);
  const data = useAsync(() => api.get(`/sites/${site.id}/campaigns${qs({ range, ...(fresh ? { fresh: 1 } : {}) })}`), [site.id, range, fresh]);
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
  const money = moneyFormat(d.currency);
  const spent = d.money?.spent || 0;
  const worth = (x) => {
    // Paid: what each key event cost, from the spend below.
    if ((x.k === 'paid' || x.kind === 'paid') && spent) return x.keyEvents ? [`${money(spent / x.keyEvents)} per key event`, ''] : ['Paid, no key events', 'bad'];
    if (!avg || x.sessions < 10) return ['', 'muted'];
    const r = x.keyEvents / x.sessions;
    return r >= avg * 1.3 ? ['Converts', 'good'] : r <= avg * 0.5 ? ['Mostly browsing', 'muted'] : ['Average', ''];
  };
  const src = params.get('src') || '';
  const opened = sources.find((s) => s.key === src);
  const top = kinds[0];
  const growing = kinds.filter((k) => k.previous && k.sessions >= 10).sort((a, b) => b.sessions / b.previous - a.sessions / a.previous)[0];
  const bestRate = avg ? kinds.filter((k) => k.sessions >= 20).sort((a, b) => b.keyEvents / b.sessions - a.keyEvents / a.sessions)[0] : null;

  if (!total) return <p class="nx-empty">No visits in this period yet.</p>;
  return (
    <div class="nx-traffic">
      <p class="nx-answer">
        <b>{fmt(total)}</b> visits. {top.label} brought {share(top.sessions / total)}.
        {growing && growing.sessions > growing.previous && <> {growing.label} grew most ({change(growing.sessions, growing.previous).text}).</>}
        {bestRate && bestRate.keyEvents > 0 && <> Visitors from <b>{bestRate.label.toLowerCase()}</b> reach a key event most often ({rate(bestRate.keyEvents / bestRate.sessions)}, against {rate(avg)} on average).</>}
        {spent > 0 && <> You spent <b>{money(spent)}</b> on ads.</>}
        {d.money?.earned > 0 && <> Ads on your site earned <b>{money(d.money.earned)}</b>.</>}
      </p>

      <section class="nx-block" aria-label="The mix">
        <h2 class="nx-h2">The mix <span class="nx-h2-sub">where visits come from{avg ? ', and how often each kind reaches a key event' : ''}</span></h2>
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
        <h2 class="nx-h2">By source <span class="nx-h2-sub">open a kind for its sources, a source for its detail</span></h2>
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

      <AdMoney site={site} d={d} onChanged={() => setFresh((n) => n + 1)} />

      <PutOut site={site} host={host} range={range} campaigns={d.campaigns || []} ads={d.ads} spend={d.spend} money={money} open={params.get('post') || ''} />
      <TalkedAbout site={site} range={range} />

      <button type="button" class="todo-link" aria-expanded={full} onClick={() => setFull(!full)}>{full ? 'Hide the full report' : 'Every campaign and source / medium, and the tagged-link builder'}</button>
      {full && <Campaigns site={site} range={range} />}

      {opened && <SourcePanel site={site} s={opened} avg={avg} total={total} campaigns={d.campaigns || []} onClose={() => { location.hash = hrefWith('src', '').slice(1); }} />}
    </div>
  );
}

const day = (t) => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
const hostOf = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

// What you put out: your posts (newest first), then tagged links and ad
// campaigns, as one short list. Managing accounts, adding posts and building
// tagged links happen in the drawer (AddPanel).
function PutOut({ site, host, range, campaigns, ads, spend, money, open }) {
  const data = useAsync(() => api.get(`/posts${qs({ range })}`), [range]);
  const [all, setAll] = useState(false);
  const d = data.data;
  const mine = d?.products.find((p) => hostOf(p.url) === host);
  const posts = (d?.items || []).filter((p) => !mine || p.product === mine.id);
  const brought = posts.map((p) => p.sessions || 0).filter(Boolean).sort((x, y) => x - y);
  const usual = brought.length >= 3 ? brought[Math.floor(brought.length / 2)] : 0;
  const verdict = (n) => {
    if (!n) return ['No visits measured', 'muted'];
    if (!usual) return ['', ''];
    const x = n / usual;
    return x >= 1.8 ? [`${Math.round(x * 10) / 10}× a usual post`, 'good'] : x <= 0.55 ? ['Below a usual post', 'muted'] : ['About a usual post', ''];
  };
  const platform = (k) => d?.platforms.find((x) => x.key === k)?.label || k;
  const rows = [
    ...posts.map((p) => ({
      key: p.id, id: p.id, when: day(p.createdAt), icon: 'megaphone',
      title: p.title || p.link, sub: [platform(p.platform), p.community].filter(Boolean).join(' · '),
      visits: p.sessions ? `${p.attribution === 'timing' ? '~' : ''}${fmt(p.sessions)}` : '—', v: verdict(p.sessions),
    })),
    ...campaigns.map((c) => ({
      key: `c:${c.campaign}`, when: 'Link', icon: 'out', title: c.campaign,
      sub: `Tagged link · ${c.parts?.slice(0, 2).map((x) => `${x.source} / ${x.medium}`).join(', ') || ''}`, visits: fmt(c.sessions),
      v: c.keyEvents ? [`${fmt(c.keyEvents)} key event${c.keyEvents === 1 ? '' : 's'}`, 'good'] : ['No key events', 'muted'],
    })),
    ...(ads?.linked ? ads.campaigns || [] : []).map((a) => ({
      key: `a:${a.campaign}`, when: 'Ad', icon: 'target', title: a.campaign, sub: `Google Ads · ${money(a.cost)} spent`, visits: fmt(a.sessions),
      v: a.keyEvents ? [`${money(a.cost / a.keyEvents)} per key event`, ''] : ['No key events', 'bad'],
    })),
    ...(spend?.entries || []).filter((e) => e.inPeriod).map((e) => ({
      key: `s:${e.id}`, when: day(Date.parse(`${e.start}T12:00:00Z`)), icon: 'target', title: e.name, sub: `Ad · ${money(e.spent)} spent`, visits: fmt(e.sessions),
      v: e.keyEvents ? [`${money(e.spent / e.keyEvents)} per key event`, ''] : ['No key events', 'bad'],
    })),
  ];
  const shown = all ? rows : rows.slice(0, 4);
  const opened = open && posts.find((p) => p.id === open);
  const [adding, setAdding] = useState(false);
  return (
    <section class="nx-block" aria-label="What you put out">
      <h2 class="nx-h2">What you put out <span class="nx-h2-sub">posts, tagged links and ads, with what they brought in the 3 days after</span></h2>
      <div class="card card-plain nx-tight">
        {data.error ? <p class="muted small m-0">Couldn’t read your posts: {data.error.message}</p>
          : !d ? <Loading height={120} />
          : !rows.length ? <p class="muted small m-0">Nothing yet. Add your accounts and Kauzl picks up your posts and what they brought.</p>
          : shown.map((r) => {
            const cells = (
              <>
                <span class="muted small">{r.when}</span>
                <span class="nx-hk"><Icon name={r.icon} size={14} /></span>
                <span class="nx-ob"><b>{r.title}</b><small class="muted">{r.sub}</small></span>
                <span class="nx-num">{r.visits}<small>visits</small></span>
                <span class={`nx-ov ${r.v[1]}`}>{r.v[0]}</span>
              </>
            );
            return r.id
              ? <a key={r.key} class={`nx-orow nx-orow-out nx-oclick${open === r.id ? ' on' : ''}`} href={hrefWith('post', r.id)}>{cells}</a>
              : <div key={r.key} class="nx-orow nx-orow-out">{cells}</div>;
          })}
        <div class="nx-cardfoot">
          {rows.length > 4 ? <button type="button" class="todo-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button> : <span />}
          <button type="button" class="btn" onClick={() => setAdding(true)}><Icon name="plus" size={12} /> Add a post</button>
        </div>
      </div>
      {adding && d && <AddPanel d={d} product={mine?.id || ''} onChanged={data.reload} onClose={() => setAdding(false)} />}
      {opened && <PostPanel post={opened} platform={platform(opened.platform)} usual={usual} onClose={() => { location.hash = hrefWith('post', '').slice(1); }} />}
    </section>
  );
}

// Adding a post, making a tagged link, or naming your accounts: in the drawer,
// so the Traffic page stays where it was.
function AddPanel({ d, product, onChanged, onClose }) {
  const [tab, setTab] = useState('add');
  const tabs = [['add', 'Add a post'], ['link', 'Make a tagged link'], ['accounts', 'Your accounts']];
  return (
    <Drawer title="Add a post" onClose={onClose}>
      <div class="tabs" role="tablist">
        {tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} class={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'add' && <>
        <p class="muted small m-0">For LinkedIn, X, a blog or anything else Kauzl can’t read. Posts from your accounts come in by themselves.</p>
        <AddByUrl bare products={d.products} product={product} onAdded={onChanged} />
      </>}
      {tab === 'link' && <>
        <p class="muted small m-0">Share this instead of the bare address and the visits it brings are counted exactly.</p>
        <LinkBuilder bare data={d} />
      </>}
      {tab === 'accounts' && <Accounts bare data={d} onSaved={onChanged} />}
    </Drawer>
  );
}

// One post in the drawer: what it brought, where those visits landed, the post itself.
function PostPanel({ post, platform, usual, onClose }) {
  const data = useAsync(() => api.get(`/posts/item${qs({ id: post.id })}`), [post.id]);
  const d = data.data;
  const w = d?.window;
  const n = d?.sessions ?? post.sessions;
  const approx = (d?.attribution || post.attribution) === 'timing';
  return (
    <Drawer title={<>{platform}{post.community ? <span class="muted"> · {post.community}</span> : null}</>} onClose={onClose}>
      <h3 class="nx-post-t">{post.title}</h3>
      <p class="nx-big">
        {n ? <><b>{approx ? '~' : ''}{fmt(n)}</b> visits in the 3 days after {day(post.createdAt)}</> : <>No visits measured after {day(post.createdAt)}</>}
        {usual && n ? <>, {n >= usual * 1.8 ? <span class="good">{Math.round((n / usual) * 10) / 10}× a usual post</span> : n <= usual * 0.55 ? 'below a usual post' : 'about a usual post'}</> : null}.
        {w?.sessions ? <> {Math.round((w.engaged / w.sessions) * 100)}% stayed to read, {fmt(w.keyEvents)} reached a key event.</> : null}
      </p>
      {approx && n ? <p class="muted small m-0">~ means counted from timing: {platform} visits around the post. A tagged link gives exact numbers.</p> : null}
      {data.error ? <p class="muted small">Couldn’t read the details: {data.error.message}</p> : !d ? <Loading height={100} /> : d.landing?.length > 0 && (
        <div class="nx-drawer-sec">
          <h3 class="nx-label-sm">Where they landed</h3>
          <ul class="nx-plain-list">{d.landing.slice(0, 5).map((r) => <li key={r.label}><b>{r.label === '/' ? 'Home' : r.label}</b> <span class="muted">· {fmt(r.sessions)} visits</span></li>)}</ul>
        </div>
      )}
      {d?.post?.text && (
        <div class="nx-drawer-sec">
          <h3 class="nx-label-sm">The post</h3>
          <p class="nx-post-x">{d.post.text.slice(0, 360)}{d.post.text.length > 360 ? '…' : ''}</p>
        </div>
      )}
      <div class="nx-btns">
        <a class="btn" href={post.permalink} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> Open on {platform}</a>
      </div>
    </Drawer>
  );
}

// Who talked about you: mentions of this site elsewhere, newest first.
function TalkedAbout({ site, range }) {
  const data = useAsync(() => api.get(`/mentions${qs({ range })}`), [range]);
  const [all, setAll] = useState(false);
  const label = { hn: 'Hacker News', reddit: 'Reddit', ph: 'Product Hunt' };
  const items = (data.data?.items || []).filter((m) => !m.scopes?.length || m.scopes.includes(`site:${site.id}`));
  const shown = all ? items : items.slice(0, 3);
  const [sync, setSync] = useState('');
  async function syncNow() {
    setSync('Syncing…');
    try {
      const r = await api.post('/mentions/sync');
      const added = Object.values(r.added || {}).reduce((a, b) => a + b, 0);
      setSync(added ? `${added} new` : 'Up to date');
      data.reload();
    } catch (err) {
      setSync(err.message);
    }
  }
  return (
    <section class="nx-block" aria-label="Who talked about you">
      <h2 class="nx-h2">Who talked about you <span class="nx-h2-sub">mentions elsewhere</span></h2>
      <div class="card card-plain nx-tight">
        {data.error ? <p class="muted small m-0">Couldn’t read mentions: {data.error.message}</p>
          : !data.data ? <Loading height={90} />
          : !items.length ? <p class="muted small m-0">No mentions in this period.</p>
          : shown.map((m) => (
            <div key={m.id} class="nx-orow nx-orow-out">
              <span class="muted small">{day(m.createdAt)}</span>
              <span class="nx-hk"><Icon name="chat" size={14} /></span>
              <a class="nx-olink" href={m.permalink || m.url} target="_blank" rel="noreferrer"><span class="nx-ob"><b>{m.title}</b><small class="muted">{[label[m.source] || m.source, m.community, m.author].filter(Boolean).join(' · ')}</small></span></a>
              {m.points ? <span class="nx-num">{fmt(m.points)}<small>points</small></span> : <span />}
            </div>
          ))}
        <div class="nx-cardfoot">
          {items.length > 3 ? <button type="button" class="todo-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${items.length}`}</button> : <span />}
          <span class="row gap-6 items-center">
            {sync && <span class="muted small">{sync}</span>}
            <button type="button" class="todo-link" disabled={sync === 'Syncing…'} onClick={syncNow}>Sync now</button>
          </span>
        </div>
      </div>
    </section>
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
