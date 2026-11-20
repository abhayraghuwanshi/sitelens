
const I = {
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
  pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chev: '<path d="M8 10l4 4 4-4"/>',
  updown: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 4-8 11-9-1 7-5 10-9 11z"/>',
  mega: '<path d="M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  arrows: '<path d="M4 17h13M13 13l4 4-4 4M20 7H7M11 3L7 7l4 4"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  chart: '<path d="M4 19h16"/><path d="M5 15l4-5 4 3 6-7"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  fwd: '<path d="M9 6l6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
};
const ic = (n, s = 16) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${I[n]}</svg>`;
const LOGO = (s = 26) => `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="15" fill="#121522"/><g transform="translate(8.96 9.96) scale(.72)"><path d="M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z" fill="#F6F7F9"/><circle cx="22.5" cy="34" r="9.5" fill="#121522"/><circle cx="41.5" cy="34" r="9.5" fill="#121522"/><circle cx="22.5" cy="34" r="4.2" fill="none" stroke="#F5A524" stroke-width="2.6"/><circle cx="41.5" cy="34" r="5" fill="#F5A524"/><path d="M32 44 L28.8 47.6 L32 52 L35.2 47.6 Z" fill="#F5A524"/></g></svg>`;
const fmt = (n) => n.toLocaleString('en-US');

// Example data, shaped like the app's own.
const SITES = [
  { id: 'kauzl', label: 'kauzl.com', host: 'kauzl.com', live: 3, visits: 4210, chg: 18, line: 'Visits rose 18%, mostly Google search to the new pricing page.' },
  { id: 'docs', label: 'Docs', host: 'docs.kauzl.com', wh: false, live: 1, visits: 1830, chg: -6, line: 'Visits fell 6%; the MCP setup page lost two Google spots.' },
  { id: 'demo', label: 'Sample store', host: 'Sample data', live: 5, visits: 12940, chg: 3, line: 'Steady. ChatGPT referrals doubled from a small base.' },
];
const INBOX = [
  { site: 'kauzl', k: 'alert', t: 'Google picked a different address for the GA4 BigQuery guide', s: 'Indexing · found today · 2,120 visits a month', go: 'view:pages|tab:health|ix:/guides/ga4-bigquery-export' },
  { site: 'kauzl', k: 'alert', t: 'Signups fell 40% on Tuesday', s: 'Goal alert · 2 days ago' },
  { site: 'kauzl', k: 'todo', id: 't1', t: 'Rewrite the pricing page title for “analytics for small sites”', s: 'From Search · 18 clicks a week at stake' },
  { site: 'kauzl', k: 'todo', id: 't2', t: 'Add FAQ schema to the GA4 setup guide', s: 'From Page review' },
  { site: 'kauzl', k: 'todo', id: 't4', t: 'Put the UTM definition in the first sentence', s: 'From How it reads · 6,600 searches a month' },
  { site: 'docs', k: 'todo', id: 't3', t: 'Merge the two MCP setup pages', s: 'They compete for the same search' },
  { site: 'demo', k: 'alert', t: 'Checkout errors doubled', s: 'Event alert · today' },
  { site: 'demo', k: 'alert', t: 'Bing clicks up 3× on product pages', s: 'Search alert · yesterday' },
];
const REPORTS = [
  { g: 'Content', items: [['pages', 'Pages', 'Every page and the searches that find it'], ['cycles', 'Content cycles', 'Grow, improve or cut each article'], ['ai', 'AI answers', 'Where AI tools cite you']] },
  { g: 'Traffic', items: [['campaigns', 'Campaigns', 'Tagged links, sources, Google Ads'], ['overview', 'Overview', 'The GA4 summary']] },
  { g: 'Behaviour', items: [['sessions', 'Sessions', 'Visits and the paths they take'], ['funnels', 'Funnels', 'Where people drop out'], ['retention', 'Retention', 'Who comes back'], ['events', 'Events', 'Every tracked event']] },
  { g: 'Data', items: [['sql', 'SQL', 'Ask the warehouse directly']] },
];
const ALL_REPORTS = REPORTS.flatMap((g) => g.items.map(([k, l, d]) => ({ k, l, d, g: g.g })));
const VIEWS = [['timeline', 'Timeline', 'calendar'], ['inbox', 'Inbox', 'inbox'], ['pages', 'Pages', 'doc'], ['search', 'Search', 'search'], ['traffic', 'Traffic', 'arrows'], ['journeys', 'Journeys', 'route'], ['goals', 'Goals', 'target'], ['tools', 'Diagnose', 'terminal']];
const RANGES = [['today', 'Today'], ['7d', '7d'], ['28d', '28d'], ['90d', '90d']];
const OLD_TABS = ['Pages', 'Campaigns', 'Content cycles', 'AI answers', 'Sessions', 'Funnels', 'Retention', 'Events', 'SQL', 'Overview'];

const S = {
  mode: 'after', device: 'desktop',
  scope: 'kauzl', view: 'timeline', tab: null, raw: null, ask: null, range: '28d', inboxF: 'all',
  pop: null, // 'scopes' | 'user' | 'cmd' | 'more' | 'day'
  cal: { metric: 'visits', lens: 'change', zoom: 'month', month: '2026-11', end: '2026-11-17', view: 'calendar', cmp: 'usual', rank: 'top', mxAll: false, dtab: null, day: null, focus: null, layers: ['deploy', 'content', 'search', 'found', 'todo', 'post', 'release', 'mention', 'alert'] },
  g: '2026-11-15',
  stack: [], ptrack: null, runs: [], tpage: '/guides/what-is-a-utm-code', tres: null, page: null, pfilter: 'all', psort: 'visits', pdet: false, src: null, tg: null, madd: false, msrc: null, metrics: null, mform: {}, flow: null, fpeek: null, pushT: 'curl', pushGot: false, bot: null, botV: 0, botRaw: false, botAs: 'google', yf: null, setupSite: null, ix: null, todo: null, thist: false, q: null, qAll: null, outAll: false, qtable: false, eng: 'both', ladAll: false,
  jgoal: 'signup', jsteps: {}, jleak: null, jedit: false, jby: 'source', jroutes: 'best',
  chartMode: 'chart', srange: null, tsort: ['date', 'desc'], copied: false,
  b: 'story', bSite: 'kauzl', bMenu: false, bTab: 'Pages',
};
try { const d = localStorage.getItem('kz-nav-device'); if (d) S.device = d; } catch (e) {}
if (window.innerWidth < 620) S.device = 'phone';

const site = (id) => SITES.find((s) => s.id === id);
const inboxFor = (scope) => INBOX.filter((m) => scope === 'all' || m.site === scope);
const liveFor = (scope) => scope === 'all' ? SITES.reduce((n, s) => n + s.live, 0) : site(scope).live;
const scopeName = (scope) => scope === 'all' ? 'All sites' : site(scope).label;

/* ---------- Shared page bodies ---------- */
function rangeText() {
  return { today: 'Today so far, against a usual day like it', '7d': '11 – 17 Nov, against the 7 days before', '28d': '21 Oct – 17 Nov, against the 28 days before', '90d': '19 Aug – 17 Nov, against the 90 days before' }[S.range];
}
function rangeCtl(phone) {
  if (phone) return '';
  return `<div class="mini-seg" role="group" aria-label="Period">${RANGES.map(([k, l]) => `<button type="button" class="${S.range === k ? 'on' : ''}" data-act="range:${k}">${l}</button>`).join('')}</div>`;
}
function spark() {
  const pts = [22, 25, 21, 27, 24, 30, 28, 26, 31, 29, 34, 33, 38, 36, 41, 39, 44, 42, 47, 45, 51, 48, 46, 52, 55, 53, 58, 60];
  const w = 600, h = 90, max = 64;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - (v / max) * h]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const mx = (14 / 27) * w;
  return `<svg viewBox="0 0 ${w} ${h + 4}" width="100%" height="90" preserveAspectRatio="none" aria-label="Visits by day, rising">
    <path d="${line} L${w},${h} L0,${h} Z" fill="var(--accent)" opacity=".12"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <line x1="${mx}" x2="${mx}" y1="0" y2="${h}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
function head(title, sub, opts = {}) {
  const crumb = opts.crumb ? `<div class="crumb"><button type="button" data-act="${opts.crumb[1]}">${opts.crumb[0]}</button><span>›</span><span>${opts.crumb[2]}</span></div>` : '';
  const gear = opts.gear ? `<button type="button" class="icon-btn" aria-label="Site settings" title="Site settings">${ic('gear', 15)}</button>` : '';
  return `<div class="head"><div>${crumb}<h3>${title}</h3>${sub ? `<div class="sub2">${sub}</div>` : ''}</div><div class="head-r">${opts.right ?? rangeCtl(opts.phone)}${gear}</div></div>`;
}
function storyBody(scope, phone, go, ask) {
  if (scope === 'all') {
    return head('Sites', 'Last 28 whole days, against the 28 before', { phone, right: phone ? '' : `<button type="button" class="icon-btn" aria-label="Add a site">${ic('plus', 15)}</button>` }) +
      SITES.map((s) => `<button type="button" class="sitecard" data-act="${go('site', s.id)}"><span class="nm"><span class="dot${s.live ? ' on' : ''}"></span>${s.label}</span><span class="ln">${s.line}</span><span class="num"><b>${fmt(s.visits)}</b><span class="${s.chg >= 0 ? 'up' : 'down'}">${s.chg >= 0 ? '↑' : '↓'} ${Math.abs(s.chg)}%</span></span></button>`).join('');
  }
  const s = site(scope), gb = ask ? goalsFor(scope).filter((g) => g.st === 'behind').length : 0, n = inboxFor(scope).length + gb;
  return head(s.label, rangeText(), { phone, gear: !phone }) + (ask ? askBox(scope) : '') +
    (n ? `<button type="button" class="needs" data-act="${go('inbox')}">${ic('inbox')}<span><b>${n} waiting on you</b> · ${inboxFor(scope).filter((m) => m.k === 'alert').length} alert, ${inboxFor(scope).filter((m) => m.k === 'todo').length} to-dos${gb ? `, ${gb} goals behind` : ''}</span><span class="go">Inbox →</span></button>` : '') +
    `<div class="card"><p class="big">Visits <b class="${s.chg >= 0 ? 'up' : 'down'}">${s.chg >= 0 ? 'rose' : 'fell'} ${Math.abs(s.chg)}%</b> to ${fmt(s.visits)}. Most of the change came from Google search after the pricing page shipped on 4 Nov.</p>${ask ? '' : spark()}</div>${ask ? storyChart(scope, phone) : ''}
     <div class="card"><h4>Who brought them</h4><div class="rows">
       <div class="r"><span>Google</span><span>2,140</span><span class="up">↑ 24%</span></div>
       <div class="r"><span>Direct</span><span>980</span><span class="muted">—</span></div>
       <div class="r"><span>ChatGPT</span><span>310</span><span class="up">↑ 60%</span></div>
       <div class="r"><span>Reddit</span><span>420</span><span class="up">↑ 2.2×</span></div>
     </div><button type="button" class="linkish" data-act="${go('report', 'campaigns')}">Full report in Campaigns →</button></div>`;
}
// Goals in the Inbox: every goal with where it stands. "All" shows only the ones that are behind.
const INBOX_GOALS = [
  { site: 'kauzl', t: 'Sign-ups: 200 a month', now: '141 so far', w: 70, st: 'behind', why: 'Fell after the 10 Nov deploy, mostly on phones.', go: 'view:journeys' },
  { site: 'kauzl', t: 'Pricing: 6% of visitors sign up', now: '4.1%', w: 68, st: 'behind', why: 'Same cause: the moved sign-up button.', go: 'view:pages|pg:/pricing' },
  { site: 'kauzl', t: 'Kauzl vs Plausible: top 5 for “plausible alternative”', now: '#16', w: 30, st: 'behind', why: 'New page, 3 days old. Too early to push.', go: 'view:pages|pg:/kauzl-vs-plausible' },
  { site: 'kauzl', t: 'GA4 MCP guide: 250 search clicks a month', now: '120', w: 48, st: 'on track', why: 'Up 3 weeks in a row.', go: 'view:pages|pg:/guides/google-analytics-mcp-server' },
  { site: 'kauzl', t: 'GA4 BigQuery guide: 70% read to the end', now: '62%', w: 88, st: 'on track', why: 'New section added 12 Nov.', go: 'view:pages|pg:/guides/ga4-bigquery-export' },
  { site: 'docs', t: 'Quickstart: half reach step 3', now: '52%', w: 100, st: 'reached', why: 'Reached on 9 Nov.', go: 'noop' },
  { site: 'demo', t: 'Checkout: 3% of visits buy', now: '2.1%', w: 70, st: 'behind', why: 'Checkout errors doubled today.', go: 'noop' },
];
const goalsFor = (scope) => INBOX_GOALS.filter((g) => scope === 'all' || g.site === scope);
// Waiting on you: alerts, to-dos, and goals that are behind.
const inboxCount = (scope) => inboxFor(scope).length + goalsFor(scope).filter((g) => g.st === 'behind').length;
const GST = { behind: ['Behind', 'down'], 'on track': ['On track', 'up'], reached: ['Reached', 'up'] };
function goalRow(g, scope) {
  return `<div class="msg goalmsg"><span class="k goal">${ic('target', 14)}</span><span class="gtop">${scope === 'all' ? `<span class="tag">${site(g.site).label}</span>` : ''}<span>${g.t}</span><b class="${GST[g.st][1]}">${GST[g.st][0]}</b></span><span class="gbar"><span class="prog"><i style="width:${g.w}%"></i></span><small>now ${g.now} · ${g.why}</small><button type="button" class="linkish" data-act="${g.go}">Open →</button></span></div>`;
}
/* ---------- To-dos: handed to an agent, reported back, checked by Kauzl ---------- */
// One to-do is a thread. Agents post through MCP report_todo; Kauzl names the agent from the
// MCP client that called (Claude Code, Claude Desktop, Cursor, ChatGPT…) and the model if it says.
// Stages: open → proposed (waiting on you) → changed → live → checked.
const TSTAGES = [['open', 'Open'], ['proposed', 'Proposed'], ['changed', 'Changed'], ['live', 'Live'], ['checked', 'Checked']];
const AGENTS = { cc: ['Claude Code', 'C'], cd: ['Claude Desktop', 'C'], cursor: ['Cursor', 'Cu'], gpt: ['ChatGPT', 'G'], you: ['You', 'A'], kauzl: ['Kauzl', 'K'] };
const TODOS = {
  t1: { stage: 'proposed', page: '/pricing', why: '“analytics for small sites” · #9 on Google, 1,600 searches a month, 1.1% click rate where #9 usually gets 2.5%.',
    entries: [
      { by: 'you', at: '14 Nov', note: 'Made from Search · Next moves.' },
      { by: 'cc', model: 'Opus 5.5', at: 'Today 11:42', found: 'The title leads with the brand, and the search words appear only at the end, cut off on phones. Bing shows the page at #5 for the same search with the same title, so the content is fine; the snippet is the problem.',
        changed: { kind: 'title', old: 'Kauzl Pricing · Plans for every team', new: 'Simple analytics for small sites · Kauzl pricing', where: 'site/src/pages/pricing.astro', pr: '#214 (draft)' },
        expected: 'Click rate on “analytics for small sites” from 1.1% toward 2.5% within 2 weeks of Google recrawling. That is about +18 visits a week.', check: '9 Dec' },
    ] },
  t2: { stage: 'live', page: '/guides/ga4-bigquery-export', why: 'Page review: the guide answers 6 questions people search for but has no FAQ markup.',
    entries: [
      { by: 'you', at: '6 Nov', note: 'Made from Page review.' },
      { by: 'cursor', at: '8 Nov', found: '6 questions in the guide match searches with 50+ a month.', changed: { kind: 'code', old: '', new: 'FAQPage JSON-LD with 6 questions', where: 'guides/ga4-bigquery-export.mdx', pr: '#209 merged' }, expected: 'FAQ results on Google within 3 weeks; clicks on the 6 searches up 20%.', check: '29 Nov' },
      { by: 'kauzl', at: '10 Nov', auto: 'Saw it live: the page changed on 9 Nov (commit a41c2e). Google recrawled it on 10 Nov. I’ll check the numbers on 29 Nov.' },
    ] },
  t3: { stage: 'open', page: '/mcp/setup', why: 'Two pages rank for “kauzl mcp setup” and swap places week to week; neither gets above #6.', entries: [{ by: 'you', at: 'Yesterday', note: 'Made from Search.' }] },
  t4: { stage: 'open', page: '/guides/what-is-a-utm-code', why: 'How it reads: the definition comes in the third paragraph, and the guide slipped from #4 to #10 for “what is a utm code”. Google and AI answers quote the opening.', entries: [{ by: 'you', at: 'Today', note: 'Made from How it reads.' }] },
};
const STAGE_PILL = { open: ['Not started', 'muted'], proposed: ['Needs your OK', 'warn'], changed: ['Changed', ''], live: ['Live · checking 29 Nov', 'up'], checked: ['Checked', 'up'] };
function agentChip(e) {
  const [n, a] = AGENTS[e.by];
  return `<span class="agent a-${e.by}"><span class="av">${a}</span><b>${n}</b>${e.model ? `<small>${e.model}</small>` : ''}${e.by !== 'you' && e.by !== 'kauzl' ? '<small class="via">via MCP</small>' : ''}</span>`;
}
function todoPanel(id) {
  const m = INBOX.find((x) => x.id === id), T = TODOS[id];
  if (!m || !T) return '';
  const rep = [...T.entries].reverse().find((e) => e.changed), auto = T.entries.find((e) => e.auto);
  const who = (e) => `<span class="agent a-${e.by}"><span class="av">${AGENTS[e.by][1]}</span>${AGENTS[e.by][0]}</span>`;
  // One headline per stage: what's true and what, if anything, you do next.
  const lead = T.stage === 'proposed' ? `${who(rep)}<span>proposes a new title · ${rep.at.split(' ')[0].toLowerCase()}</span>`
    : T.stage === 'live' ? `<span class="tpill up">Live</span><span>since 9 Nov · Kauzl checks the numbers on ${rep.check}</span>`
    : `<span class="tpill">Not started</span><span>made ${T.entries[0].at.toLowerCase()}</span>`;
  let main = '';
  if (rep) {
    const c = rep.changed;
    main = `<div class="tprop">
      ${c.kind === 'title' ? `<span class="tl">Now</span><span class="tpv was">${c.old}</span><span class="tl">New</span><span class="tpv now">${c.new}</span>` : `<span class="tl">Added</span><span class="tpv now">${c.new}</span>`}
    </div>
    <p class="twhy">${rep.found.split('. ')[0].replace(/\.$/, '')}.</p>
    <p class="texp"><b>Expect</b> ${rep.expected.split('. ')[0].replace(/\.$/, '')}.</p>
    ${T.stage === 'proposed' ? `<span class="tbtns"><button type="button" class="jbtn primary" data-act="noop">Approve and open the PR</button><button type="button" class="chip" data-act="noop">Try another</button></span>` : ''}`;
  } else {
    main = `<p class="twhy">${T.why}</p>
    <div class="thand"><span class="muted small2">Hand it to an agent with the Kauzl MCP</span><span class="tbtns"><button type="button" class="jbtn primary" data-act="noop">Copy prompt for Claude Code</button><button type="button" class="chip" data-act="noop">Other agent ${ic('chev', 12)}</button></span></div>`;
  }
  const hist = T.entries.map((e) => `<li><span class="muted">${e.at}</span><span>${AGENTS[e.by][0]}${e.note ? ` · ${e.note.replace(/\.$/, '')}` : e.auto ? ' · saw it go live, recrawled 10 Nov' : e.changed ? ` · ${T.stage === 'proposed' ? 'proposed' : 'changed'}, PR ${e.changed.pr}` : ''}</span></li>`).join('');
  const open = S.thist;
  return `<div class="insp-in tpanel"><div class="insp-h"><b>${m.t}</b><button type="button" class="icon-btn" data-act="todo:none|close" aria-label="Close">${ic('x', 14)}</button></div>
    <div class="tlead">${lead}</div>
    ${main}
    <div class="tfoot"><button type="button" class="linkish" data-act="thist" aria-expanded="${open}">${open ? 'Hide' : 'History'} · ${T.entries.length}</button>${rep ? `<button type="button" class="linkish" data-act="noop">Send back to an agent</button>` : ''}<button type="button" class="linkish" data-act="ppage:${T.page}">Open the page</button></div>
    ${open ? `<ol class="thist">${hist}</ol>` : ''}</div>`;
}
function inboxBody(scope, phone) {
  const f = S.inboxF, msgs = inboxFor(scope), goals = goalsFor(scope), behind = goals.filter((g) => g.st === 'behind');
  const count = { all: msgs.length + behind.length, alert: msgs.filter((m) => m.k === 'alert').length, todo: msgs.filter((m) => m.k === 'todo').length, goal: goals.length };
  const chips = [['all', 'All'], ['alert', 'Alerts'], ['todo', 'To-dos'], ['goal', 'Goals']].map(([k, l]) => `<button type="button" class="chip${f === k ? ' on' : ''}" data-act="inboxF:${k}">${l} ${count[k]}</button>`).join('');
  const msgRow = (m) => {
    const T = m.id && TODOS[m.id], last = T && [...T.entries].reverse().find((e) => e.by !== 'you'), pill = T && STAGE_PILL[T.stage];
    const sub = T ? `${last ? `${AGENTS[last.by][0]} · ${last.at}` : 'To-do'} · ${m.s}` : m.s;
    const inner = `<span class="k ${m.k}">${ic(m.k === 'alert' ? 'bell' : 'check', 14)}</span><span class="mt2">${scope === 'all' ? `<span class="tag">${site(m.site).label}</span>` : ''}${m.t}${pill ? ` <span class="tpill ${pill[1]}">${pill[0]}</span>` : ''}</span><small>${sub}</small>`;
    if (m.go) return `<button type="button" class="msg msgb" data-act="${m.go}${phone ? '|pop:ix' : ''}">${inner}</button>`;
    return T ? `<button type="button" class="msg msgb${S.stack.length && stackTop().v === m.id ? ' on' : ''}" data-act="pclear|ptodo:${m.id}">${inner}</button>` : `<div class="msg">${inner}</div>`;
  };
  let body;
  if (f === 'goal') {
    const order = ['behind', 'on track', 'reached'];
    body = order.map((st) => { const gs = goals.filter((g) => g.st === st); return gs.length ? `<h5 class="ibh">${GST[st][0]} · ${gs.length}</h5>${gs.map((g) => goalRow(g, scope)).join('')}` : ''; }).join('') + `<p class="muted small2">Site goals come from the site’s .sitelens.yml; page goals are set on each page. <button type="button" class="linkish" data-act="view:goals">All goals →</button></p>`;
  } else if (f === 'all') body = behind.map((g) => goalRow(g, scope)).join('') + msgs.map(msgRow).join('');
  else body = msgs.filter((m) => m.k === f).map(msgRow).join('');
  return head('Inbox', scope === 'all' ? 'What’s waiting on you, every site' : `What’s waiting on you for ${site(scope).label}`, { phone, right: phone ? '' : `<button type="button" class="icon-btn" aria-label="Alert settings" title="Alert settings">${ic('bell', 15)}</button><button type="button" class="icon-btn" aria-label="Add a to-do" title="Add a to-do">${ic('plus', 15)}</button>` }) +
    `<div class="chips">${chips}</div><div class="inbox">${body || '<p class="empty">Nothing waiting.</p>'}</div>`;
}
function liveBodyToday(scope, phone, go) {
  if (scope === 'all') {
    return head('Live now', 'Every site, right now', { phone, right: '' }) + `<div class="card"><div class="livebig"><span class="dot on"></span>${liveFor('all')}</div><div class="rows">${SITES.map((s) => `<div class="r"><span>${s.label}</span><span>${s.live}</span><span></span></div>`).join('')}</div></div>`;
  }
  const s = site(scope);
  return head('Live', `Who is on ${s.label} right now`, { phone, right: '' }) + `<div class="card"><div class="livebig"><span class="dot on"></span>${s.live}</div><span class="muted">people in the last 30 minutes</span></div>
    <div class="card"><h4>On these pages</h4><div class="rows"><div class="r"><span>/pricing</span><span>2</span><span></span></div><div class="r"><span>/guides/ga4-bigquery-export</span><span>1</span><span></span></div></div></div>`;
}
/* ---------- Live: who's on the site right now, where from, reading what ---------- */
// Example people on each site in the last 30 minutes: [minutes ago, country, city, page, source, device, did].
const LIVE_PEOPLE = {
  kauzl: [[0, 'Germany', 'Berlin', '/pricing', 'Google', 'Desktop · Chrome', 'Reading the plans'], [1, 'United States', 'Austin', '/guides/ga4-bigquery-export', 'ChatGPT', 'Desktop · Arc', 'Scrolled to the end'], [3, 'India', 'Bengaluru', '/pricing', 'Direct', 'Phone · Chrome', 'Signed up'], [6, 'United States', 'Denver', '/kauzl-vs-plausible', 'Reddit', 'Phone · Safari', 'Left after 40s'], [11, 'United Kingdom', 'London', '/', 'Google', 'Desktop · Firefox', 'Went on to pricing'], [17, 'Brazil', 'São Paulo', '/guides/track-chatgpt-traffic', 'Perplexity', 'Desktop · Chrome', 'Read for 3 min'], [24, 'Germany', 'Munich', '/docs', 'github.com', 'Desktop · Chrome', 'Opened 4 pages']],
  docs: [[2, 'Netherlands', 'Amsterdam', '/mcp/setup', 'Google', 'Desktop · Chrome', 'Copied the setup command'], [9, 'United States', 'Seattle', '/quickstart', 'Direct', 'Desktop · Safari', 'Read for 2 min']],
  demo: [[0, 'United States', 'Chicago', '/sale', 'Google Ads', 'Phone · Safari', 'Added to cart'], [1, 'Canada', 'Toronto', '/product/hoodie', 'Instagram', 'Phone · Safari', 'Looking at sizes'], [2, 'United States', 'Miami', '/', 'Direct', 'Desktop · Chrome', 'Browsing'], [4, 'Mexico', 'Monterrey', '/sale', 'Google', 'Phone · Chrome', 'Checkout error'], [5, 'United States', 'Boston', '/product/mug', 'Bing', 'Desktop · Edge', 'Bought a mug']],
};
const COUNTRY_CODE = { Germany: 'DE', 'United States': 'US', India: 'IN', 'United Kingdom': 'GB', Brazil: 'BR', Netherlands: 'NL', Canada: 'CA', Mexico: 'MX' };
const DID_TONE = (d) => (/Signed up|Bought|Added to cart/.test(d) ? 'up' : /error|Left/.test(d) ? 'down' : '');
function liveMinutes(scope) {
  return Array.from({ length: 30 }, (_, i) => Math.max(0, Math.round((scope === 'demo' ? 3 : scope === 'all' ? 5 : 1.4) * (0.4 + rnd(i * 4.7 + scope.length) * 1.2) + (i > 25 ? 1 : 0))));
}
function liveCount(list, key) {
  const m = new Map();
  for (const p of list) m.set(p[key], (m.get(p[key]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
/* ---------- Live, as a control room: a night map of where people are, where they are on the path, and what they just did ---------- */
// Rough continent outlines (longitude, latitude), only to lay down a dotted world. Not for navigation.
const LAND = [
  [[-168, 65], [-140, 70], [-95, 72], [-75, 62], [-60, 52], [-66, 45], [-75, 35], [-81, 25], [-97, 26], [-105, 22], [-97, 16], [-83, 9], [-78, 8], [-90, 15], [-105, 20], [-117, 32], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 80], [-60, 82], [-70, 77]],
  [[-80, 10], [-62, 11], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-73, -50], [-72, -30], [-70, -18], [-81, -5]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [5, 58], [10, 63], [20, 70], [30, 70], [40, 66], [45, 55], [40, 45], [28, 41], [26, 38], [20, 40], [15, 38], [12, 44], [8, 44], [3, 42], [-5, 36]],
  [[-6, 50], [2, 51], [0, 54], [-3, 58], [-6, 56]],
  [[-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 11], [40, -5], [40, -15], [35, -25], [28, -34], [18, -35], [12, -18], [9, -2], [5, 5], [-8, 5], [-15, 10]],
  [[35, 30], [43, 12], [52, 15], [58, 22], [57, 25], [50, 30], [40, 32]],
  [[40, 45], [45, 55], [40, 66], [60, 70], [80, 73], [110, 77], [140, 73], [180, 68], [170, 60], [155, 58], [140, 52], [130, 42], [122, 40], [120, 30], [110, 20], [105, 10], [100, 13], [98, 8], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30], [45, 40]],
  [[130, 31], [140, 35], [142, 40], [141, 45], [138, 38]],
  [[95, 5], [105, -6], [115, -8], [125, -9], [140, -5], [130, -2], [118, 2], [108, 2]],
  [[113, -22], [122, -17], [131, -12], [137, -12], [142, -11], [146, -19], [153, -26], [151, -34], [145, -39], [138, -35], [131, -31], [115, -34]],
];
const inPoly = (x, y, poly) => { let o = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o; } return o; };
const MAP_W = 360, MAP_H = 150, lonX = (lon) => ((lon + 170) / 360) * MAP_W, latY = (lat) => ((78 - lat) / 136) * MAP_H;
let LAND_DOTS = null;
function landDots() {
  if (LAND_DOTS) return LAND_DOTS;
  const out = [];
  for (let lat = 76; lat >= -56; lat -= 3.4) for (let lon = -168; lon <= 188; lon += 3.4) if (LAND.some((p) => inPoly(lon > 180 ? lon - 360 : lon, lat, p))) out.push(`<circle cx="${lonX(lon).toFixed(1)}" cy="${latY(lat).toFixed(1)}" r="0.85"/>`);
  return (LAND_DOTS = out.join(''));
}
const CITY = { Berlin: [13.4, 52.5], Austin: [-97.7, 30.3], Bengaluru: [77.6, 13], Denver: [-105, 39.7], London: [-0.1, 51.5], 'São Paulo': [-46.6, -23.5], Munich: [11.6, 48.1], Amsterdam: [4.9, 52.4], Seattle: [-122.3, 47.6], Chicago: [-87.6, 41.9], Toronto: [-79.4, 43.7], Miami: [-80.2, 25.8], Monterrey: [-100.3, 25.7], Boston: [-71, 42.4] };
const SRC_KIND = (s) => (/Google|Bing/.test(s) && s !== 'Google Ads' ? 'search' : /ChatGPT|Perplexity|Claude/.test(s) ? 'ai' : /Reddit|Instagram|X$|Hacker/.test(s) ? 'social' : s === 'Google Ads' ? 'paid' : s === 'Direct' ? 'direct' : 'link');
// Where each visitor is on the path to the goal, right now.
const PATHS = {
  kauzl: [['Arrived', (p) => p[3] === '/'], ['Reading', (p) => /guides|vs|docs/.test(p[3])], ['Pricing', (p) => p[3] === '/pricing' && !/Signed/.test(p[6])], ['Signed up', (p) => /Signed up/.test(p[6])]],
  docs: [['Arrived', (p) => p[3] === '/'], ['Getting started', (p) => /quickstart/.test(p[3])], ['Setting up', (p) => /mcp|api/.test(p[3])], ['Done', () => false]],
  demo: [['Browsing', (p) => p[3] === '/' || p[3] === '/sale' && !/cart|error/.test(p[6])], ['Looking at a product', (p) => /product/.test(p[3]) && !/Bought/.test(p[6])], ['In the cart', (p) => /cart|error/.test(p[6])], ['Bought', (p) => /Bought/.test(p[6])]],
};
function liveBody(scope, phone) {
  const sites = scope === 'all' ? SITES : [site(scope)];
  const people = sites.flatMap((s) => (LIVE_PEOPLE[s.id] || []).map((p) => [...p, s.id])).sort((a, b) => a[0] - b[0]);
  const now = people.filter((p) => p[0] <= 5), mins = liveMinutes(scope), mx = Math.max(1, ...mins);
  const usual = scope === 'all' ? 7 : scope === 'demo' ? 4 : 2;
  const wins = people.filter((p) => DID_TONE(p[6]) === 'up');
  // The night map.
  const cities = new Map();
  for (const p of people) { const c = cities.get(p[2]) || { n: 0, fresh: false, country: p[1] }; c.n++; c.fresh = c.fresh || p[0] <= 5; cities.set(p[2], c); }
  const pins = () => [...cities.entries()].filter(([c]) => CITY[c]).map(([c, v]) => { const [lon, lat] = CITY[c], x = lonX(lon), y = latY(lat); return `<g class="pin${v.fresh ? ' fresh' : ''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(vb[2] / MAP_W).toFixed(3)})"><title>${c}, ${v.country}: ${v.n} in the last 30 minutes</title>${v.fresh ? '<circle class="ring" r="3"/>' : ''}<circle class="core" r="${(1.6 + v.n * 0.5).toFixed(1)}"/></g>`; }).join('');
  // Zoom to where the visitors are when they sit in one region (always on a phone), so pins and names don't pile up.
  const pts = [...cities.keys()].filter((c) => CITY[c]).map((c) => [lonX(CITY[c][0]), latY(CITY[c][1])]);
  let vb = [0, 0, MAP_W, MAP_H];
  if (pts.length) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), spanX = Math.max(...xs) - Math.min(...xs);
    if (phone || spanX < MAP_W * 0.45) {
      const w = Math.min(MAP_W, Math.max(spanX + 70, phone ? 120 : 160)), h = (w * MAP_H) / MAP_W;
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      vb = [Math.max(0, Math.min(MAP_W - w, cx - w / 2)), Math.max(0, Math.min(MAP_H - h, cy - h / 2)), w, h];
    }
  }
  const scale = MAP_W / vb[2];
  // Name only the cities with someone on now, skip a name that would sit on another, and flip names near the right edge.
  const placed = [];
  const labels = [...cities.entries()].filter(([c, v]) => CITY[c] && v.fresh).sort((a, b) => b[1].n - a[1].n).map(([c, v]) => {
    const [lon, lat] = CITY[c], lx = ((lonX(lon) - vb[0]) / vb[2]) * 100, ly = ((latY(lat) - vb[1]) / vb[3]) * 100;
    if (placed.some(([px, py]) => Math.abs(px - lx) < (phone ? 26 : 12) && Math.abs(py - ly) < 9) || placed.length >= (phone ? 3 : 6)) return '';
    placed.push([lx, ly]);
    return `<span class="pinlab${lx > 72 ? ' flip' : ''}" style="left:${lx.toFixed(1)}%;top:${ly.toFixed(1)}%">${c}${v.n > 1 ? ` · ${v.n}` : ''}</span>`;
  }).join('');
  const spark = `<div class="nbars">${mins.map((v, i) => `<i style="height:${Math.max(8, (v / mx) * 100)}%" title="${30 - i} min ago: ${v}"></i>`).join('')}</div>`;
  const hero = `<div class="night">
    <div class="ntop"><div class="ncount"><span class="lpulse"></span><b>${now.length}</b><span><span>on ${scope === 'all' ? 'your sites' : sites[0].label} right now</span><small>${now.length > usual ? `Busier than a usual Wednesday morning (${usual})` : `A usual Wednesday morning (${usual})`}</small></span></div>
      <div class="nside"><div class="nstat"><b>${people.length}</b><small>last 30 min</small></div><div class="nstat"><b class="amber">${wins.length}</b><small>${scope === 'demo' ? 'orders and carts' : 'wins'}</small></div><div class="nspark">${spark}<small>each minute, last 30</small></div></div></div>
    <div class="nmap"><svg viewBox="${vb.map((v) => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet" aria-label="Map of where visitors are" style="--k:${(1 / scale).toFixed(2)}"><g class="land">${landDots()}</g>${pins()}</svg>${labels}</div></div>`;
  // Where they are on the path, right now.
  const pathFor = scope === 'all' ? null : PATHS[scope];
  const lane = pathFor ? `<section class="tsec"><div class="tsh"><h3>On the path, right now</h3><p>Each circle is a visitor from the last 30 minutes, standing where they are on the way to ${scope === 'demo' ? 'buying' : 'signing up'}</p></div><div class="path">${pathFor.map(([name, test], i) => { const here = people.filter((p) => test(p)); return `<div class="pstep${i === pathFor.length - 1 ? ' goal' : ''}"><div class="psh"><span>${name}</span><b>${here.length}</b></div><div class="ptok">${here.map((p) => `<span class="tok ${SRC_KIND(p[4])}${p[0] <= 5 ? ' fresh' : ''}" title="${p[2]}, ${p[1]} · ${nameOf(p[3])} · from ${p[4]} · ${p[0] === 0 ? 'now' : `${p[0]} min ago`}">${COUNTRY_CODE[p[1]] || '··'}</span>`).join('') || '<span class="muted small2">nobody</span>'}</div></div>`; }).join('<span class="parr" aria-hidden="true"></span>')}</div><div class="tokleg"><span class="tok search">·</span>Search<span class="tok ai">·</span>AI answers<span class="tok social">·</span>Social<span class="tok direct">·</span>Direct<span class="tok link">·</span>Other sites<span class="tok paid">·</span>Ads<span class="muted">· bright: on now</span></div></section>` : '';
  const perSite = scope === 'all' ? `<section class="tsec"><div class="tsh"><h3>By site</h3><p>Open one for its path and feed</p></div><div class="sitecards">${SITES.map((s) => { const ps = LIVE_PEOPLE[s.id] || []; return `<button type="button" class="scard" data-act="scope:${s.id}|view:live"><span class="sch"><span class="dot${s.live ? ' on' : ''}"></span><b>${s.label}</b></span><b class="scn">${s.live}</b><small>${ps[0] ? `on ${nameOf(ps[0][3])}` : 'quiet'} · ${ps.filter((p) => DID_TONE(p[6]) === 'up').length} wins</small></button>`; }).join('')}</div></section>` : '';
  // The feed.
  const feed = `<section class="tsec"><div class="tsh"><h3>Just now</h3><p>Every visitor in the last 30 minutes, newest first</p></div><div class="card nfeed">${people.map((p) => { const tone = DID_TONE(p[6]); return `<div class="fi${tone === 'up' ? ' win' : tone === 'down' ? ' lose' : ''}"><span class="tok ${SRC_KIND(p[4])}${p[0] <= 5 ? ' fresh' : ''}">${COUNTRY_CODE[p[1]] || '··'}</span><span class="fw"><span><b>${p[2]}</b> <span class="muted">${p[1]}</span>${scope === 'all' ? ` <span class="tag">${site(p[7]).label}</span>` : ''}</span><small>${nameOf(p[3])} · from ${p[4]} · ${p[5]}</small></span><span class="fo">${tone ? `<span class="pill ${tone}">${p[6]}</span>` : `<span class="muted">${p[6]}</span>`}<small>${p[0] === 0 ? 'now' : `${p[0]} min ago`}</small></span></div>`; }).join('')}</div></section>`;
  const total = people.length;
  const mini = (title, rows, f = (x) => x) => `<div class="mbox"><h5>${title}</h5>${rows.slice(0, 3).map(([k, n]) => `<div class="mrow2"><span>${f(k)}</span><span class="lmini"><i style="width:${(n / total) * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>`;
  const tops = `<div class="card mgrid">${mini('Countries', liveCount(people, 1), (c) => `<span class="cc">${COUNTRY_CODE[c] || '··'}</span>${c}`)}${mini('Pages', liveCount(people, 3), nameOf)}${mini('Sources', liveCount(people, 4))}${mini('Devices', liveCount(people.map((p) => [...p.slice(0, 5), p[5].split(' · ')[0]]), 5))}</div>`;
  return head(scope === 'all' ? 'Live now' : 'Live', scope === 'all' ? 'Every site, right now' : `${sites[0].label} · updates every few seconds`, { phone, right: '' }) + hero + perSite + lane + feed + tops;
}
function timelineBody(scope, phone) { return calendarBody(scope, phone, true); }
/* ---------- Timeline: a calendar of every metric ---------- */
const DAYMS = 86400000, TODAY = '2026-11-18', LAST = '2026-11-17';
const tOf = (d) => Date.parse(`${d}T00:00:00Z`);
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
const rnd = (x) => { const v = Math.sin(x) * 10000; return v - Math.floor(v); };
const CAL_METRICS = [['visits', 'Visits'], ['clicks', 'Search clicks'], ['ai', 'AI visits'], ['signups', 'Signups'], ['conv', 'Conversion'], ['revenue', 'Revenue']];
const LENSES = [['change', 'vs usual'], ['amount', 'Amount'], ['landing', 'Landing pages'], ['sources', 'Sources'], ['searches', 'Searches'], ['countries', 'Countries']];
// Money and rates read differently from counts.
const fmtM = (k, v, short) => (k === 'conv' ? `${(v * 100).toFixed(1)}%` : k === 'revenue' ? `$${short ? kfmt(Math.round(v)) : fmt(Math.round(v))}` : short ? kfmt(Math.round(v)) : fmt(Math.round(v)));
const QUERYSET = {
  kauzl: [['kauzl', 0], ['ga4 bigquery export', 1], ['google analytics alternative', 2], ['ga4 mcp server', 3, '2026-11-06'], ['plausible vs kauzl', 4, '2026-11-16']],
  docs: [['kauzl mcp', 0], ['kauzl api', 1], ['kauzl docs', 2]],
  demo: [['winter hoodie', 0], ['hoodie sale', 1], ['coffee mug gift', 2]],
};
QUERYSET.all = QUERYSET.kauzl;
const COUNTRIES = [['United States', 0], ['India', 1], ['Germany', 2], ['United Kingdom', 3], ['Brazil', 4]];
// "What led" lenses: each day's winner in one breakdown.
const LEADS = {
  landing: { key: 'pages', name: 'Landing pages', one: 'landing page', of: 'visits', top: 'Each day’s top landing page', items: (sc) => PAGESET[sc] },
  sources: { key: 'sources', name: 'Sources', one: 'source', of: 'visits', top: 'Each day’s top source', items: () => SOURCES },
  searches: { key: 'queries', name: 'Searches', one: 'search', of: 'clicks', top: 'Each day’s top Google + Bing search', items: (sc) => QUERYSET[sc] },
  countries: { key: 'countries', name: 'Countries', one: 'country', of: 'visits', top: 'Each day’s top country', items: () => COUNTRIES },
};
const KINDS = { deploy: ['rocket', 'Deploys'], content: ['doc', 'Page changes'], search: ['search', 'Search moves'], found: ['target', 'Kauzl found'], todo: ['check', 'To-dos'], visits: ['pulse', 'Visitors'], goal: ['sparkles', 'Goals'], link: ['link', 'Links and mentions'], ai: ['chat', 'AI answers'], cycle: ['layers', 'Content cycles'], post: ['mega', 'Posts'], release: ['tag', 'Releases'], mention: ['chat', 'Mentions'], alert: ['bell', 'Alerts'] };
const PAGESET = {
  kauzl: [['/', 0], ['/pricing', 1], ['/guides/ga4-bigquery-export', 2], ['/kauzl-vs-plausible', 3, '2026-11-15'], ['/guides/google-analytics-mcp-server', 4, '2026-11-04'], ['/guides/what-is-a-utm-code', 5, '2026-10-14'], ['/guides/track-chatgpt-traffic', 6], ['/docs', 7]],
  docs: [['/quickstart', 0], ['/mcp/setup', 1], ['/api', 2], ['/', 3]],
  demo: [['/', 0], ['/sale', 1], ['/product/hoodie', 2], ['/product/mug', 3]],
};
PAGESET.all = PAGESET.kauzl;
// Page titles read better than paths in a small cell.
const PAGE_TITLES = { '/blog/launch-notes': 'Launch notes', '/': 'Home', '/pricing': 'Pricing', '/guides/ga4-bigquery-export': 'GA4 BigQuery guide', '/kauzl-vs-plausible': 'Kauzl vs Plausible', '/guides/google-analytics-mcp-server': 'GA4 MCP guide', '/guides/what-is-a-utm-code': 'UTM code guide', '/guides/track-chatgpt-traffic': 'ChatGPT traffic guide', '/docs': 'Docs', '/quickstart': 'Quickstart', '/mcp/setup': 'MCP setup', '/api': 'API', '/sale': 'Sale', '/product/hoodie': 'Hoodie', '/product/mug': 'Mug' };
const nameOf = (p) => PAGE_TITLES[p] || p;
const SOURCES = [['Google', 0], ['Direct', 1], ['ChatGPT', 2], ['Reddit', 3], ['Bing', 4]];
const SCALE = { kauzl: 1, docs: 0.45, demo: 3.1, all: 4.55 };
const EVENTS = [
  ['kauzl', '2026-11-04', 'deploy', 'New pricing page'], ['kauzl', '2026-11-04', 'content', 'Guide: GA4 MCP server'], ['kauzl', '2026-11-07', 'release', 'v0.9 released'],
  ['kauzl', '2026-11-10', 'deploy', 'Signup button moved'], ['kauzl', '2026-11-11', 'alert', 'Signups fell 40%'], ['kauzl', '2026-11-12', 'mention', 'Mentioned on Hacker News'],
  ['kauzl', '2026-11-15', 'post', 'Posted on r/analytics'], ['kauzl', '2026-11-15', 'content', 'Page: Kauzl vs Plausible'], ['kauzl', '2026-11-17', 'deploy', 'Owl loader'],
  ['kauzl', '2026-10-08', 'deploy', 'Dark mode'], ['kauzl', '2026-10-14', 'content', 'Guide: Track ChatGPT traffic'], ['kauzl', '2026-10-21', 'post', 'Launch thread on X'], ['kauzl', '2026-10-28', 'release', 'v0.8 released'],
  ['docs', '2026-11-09', 'deploy', 'Docs search'], ['docs', '2026-11-13', 'alert', 'MCP setup page lost 2 spots'],
  ['demo', '2026-11-06', 'deploy', 'Winter sale banner'], ['demo', '2026-11-16', 'alert', 'Bing clicks up 3×'], ['demo', '2026-11-17', 'alert', 'Checkout errors doubled'],
];
for (let t = tOf('2025-12-03'), i = 0; t < tOf('2026-10-01'); t += (7 + Math.floor(rnd(i * 7.1) * 6)) * DAYMS, i++) {
  const post = rnd(i * 3.3) > 0.72;
  EVENTS.push(['kauzl', isoOf(t), post ? 'post' : i % 5 === 4 ? 'release' : 'deploy', post ? 'Post' : i % 5 === 4 ? 'Release' : 'Deploy']);
}
const DAYCACHE = {};
function day(scope, date) {
  const key = scope + date;
  if (DAYCACHE[key]) return DAYCACHE[key];
  const t = tOf(date), n = Math.round((t - tOf('2025-11-01')) / DAYMS), wd = new Date(t).getUTCDay();
  const r = (i) => rnd(n * 12.9898 + i * 78.233 + scope.length * 31.7);
  const week = [0.62, 1.05, 1.1, 1.08, 1.04, 0.95, 0.6][wd];
  const trend = 1 + (n / 365) * 0.5, sc = SCALE[scope];
  const kz = scope === 'kauzl' || scope === 'all';
  let eff = (r(1) - 0.5) * 0.18;
  if (kz && date >= '2026-11-04') eff += 0.18;
  if (kz && date === '2026-11-15') eff += 1.1;
  if (kz && date === '2026-11-16') eff += 0.35;
  const usual = { visits: 120 * week * trend * sc, clicks: 52 * week * trend * sc, ai: 4 * trend * trend * sc, signups: 6 * week * trend * sc, revenue: (scope === 'demo' ? 160 : 55) * week * trend * sc };
  const raw = {
    visits: usual.visits * (1 + eff),
    clicks: usual.clicks * (1 + (kz && date >= '2026-11-04' ? 0.2 : 0) + (r(2) - 0.5) * 0.16),
    ai: usual.ai * (1 + (date >= '2026-10-25' ? 0.6 : 0) + (r(3) - 0.5) * 0.5),
    signups: usual.signups * (1 + eff * 0.5 + (r(4) - 0.5) * 0.35) * (kz ? ({ '2026-11-11': 0.35, '2026-11-12': 0.55, '2026-11-13': 0.75 }[date] || 1) : 1),
    revenue: usual.revenue * (1 + eff * 0.4 + (r(6) - 0.5) * 0.5) * (kz ? ({ '2026-11-11': 0.4, '2026-11-12': 0.6, '2026-11-13': 0.8 }[date] || 1) : 1),
  };
  const v = {};
  for (const k in raw) v[k] = Math.max(0, Math.round(raw[k]));
  v.conv = v.signups / Math.max(1, v.visits);
  usual.conv = usual.signups / usual.visits;
  const out = { date, wd, future: date > LAST, today: date === TODAY, usual, v };
  const pages = PAGESET[scope];
  const sh = pages.map(([p, , since], i) => {
    if (since && date < since) return 0;
    const s = kz
      ? { '/': date >= '2026-11-04' ? 0.17 : 0.3, '/pricing': date >= '2026-11-04' ? 0.27 : 0.09, '/guides/ga4-bigquery-export': wd === 0 || wd === 6 ? 0.34 : 0.2, '/kauzl-vs-plausible': date === '2026-11-15' ? 0.5 : date === '2026-11-16' ? 0.3 : 0.1, '/guides/google-analytics-mcp-server': 0.07, '/guides/what-is-a-utm-code': date >= '2026-11-08' && date <= '2026-11-10' ? 0.2 : 0.05, '/guides/track-chatgpt-traffic': date >= '2026-11-01' ? 0.05 + ((n - 365) / 16) * 0.07 : 0.03, '/docs': 0.05 }[p]
      : 1 / (i + 1.6);
    return s * (0.8 + r(10 + i) * 0.45);
  });
  const pt = sh.reduce((a, b) => a + b, 0);
  out.pages = pages.map(([p, c, since], i) => ({ p, c, share: sh[i] / pt, isNew: since === date })).sort((a, b) => b.share - a.share);
  const ss = SOURCES.map(([s], i) => ({ Google: 0.5, Direct: wd === 0 ? 0.55 : 0.22, ChatGPT: 0.03 + Math.max(0, n - 300) / 65 * 0.06, Reddit: kz && date === '2026-11-15' ? 1.3 : kz && date === '2026-11-16' ? 0.4 : 0.03, Bing: 0.05 }[s]) * (0.85 + r(20 + i) * 0.3));
  const st = ss.reduce((a, b) => a + b, 0);
  out.sources = SOURCES.map(([p, c], i) => ({ p, c, share: ss[i] / st })).sort((a, b) => b.share - a.share);
  const qs = QUERYSET[scope].map(([p, , since], i) => {
    if (since && date < since) return 0;
    const q = kz ? { kauzl: date >= '2026-11-12' ? 0.45 : 0.3, 'ga4 bigquery export': 0.3, 'google analytics alternative': 0.15, 'ga4 mcp server': 0.08, 'plausible vs kauzl': 0.12 }[p] : 1 / (i + 1.4);
    return q * (0.75 + r(30 + i) * 0.5);
  });
  const qt = qs.reduce((a, b) => a + b, 0);
  out.queries = QUERYSET[scope].map(([p, c, since], i) => ({ p, c, share: qs[i] / qt, isNew: since === date })).sort((a, b) => b.share - a.share);
  const cs = COUNTRIES.map(([p], i) => ({ 'United States': kz && date === '2026-11-15' ? 0.6 : 0.36, India: wd === 0 || wd === 6 ? 0.14 : 0.24, Germany: 0.12, 'United Kingdom': 0.1, Brazil: 0.05 }[p]) * (0.8 + r(40 + i) * 0.4));
  const ct = cs.reduce((a, b) => a + b, 0);
  out.countries = COUNTRIES.map(([p, c], i) => ({ p, c, share: cs[i] / ct })).sort((a, b) => b.share - a.share);
  return (DAYCACHE[key] = out);
}
const eventsOn = (scope, date, layers) => EVENTS.filter(([s, d, k]) => d === date && (scope === 'all' || s === scope) && layers.includes(k));
function monthDays(ym) {
  const out = [];
  for (let t = tOf(`${ym}-01`); isoOf(t).slice(0, 7) === ym; t += DAYMS) out.push(isoOf(t));
  return out;
}
const YEAR_MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2025, 11 + i, 1)).toISOString().slice(0, 7));
const yearDays = () => YEAR_MONTHS.flatMap(monthDays);
const monthName = (ym, short) => new Date(tOf(`${ym}-01`)).toLocaleDateString('en-GB', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC' });
const pct = (c) => `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}%`;
const kfmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

function cellFill(d, ctx, mini) {
  if (d.future) return '';
  const m = ctx.metric;
  if (ctx.lens === 'change') {
    const c = d.v[m] / Math.max(1e-9, d.usual[m]) - 1, a = Math.min(Math.abs(c), 0.6);
    if (a < 0.05) return mini ? 'background:var(--surface-2)' : '';
    return `background:color-mix(in srgb, var(${c > 0 ? '--up' : '--down'}) ${Math.round(10 + (a / 0.6) * 50)}%, var(--surface))`;
  }
  if (ctx.lens === 'amount') return `background:color-mix(in srgb, var(--accent) ${Math.round(6 + (d.v[m] / ctx.max) * 64)}%, var(--surface))`;
  const list = d[LEADS[ctx.lens].key];
  if (ctx.focus) {
    const it = list.find((x) => x.p === ctx.focus);
    return `background:color-mix(in srgb, var(--s${(it ? it.c : 0) + 1}) ${Math.round(Math.min((it ? it.share : 0) * 130, 72))}%, var(--surface))`;
  }
  return mini ? `background:color-mix(in srgb, var(--s${list[0].c + 1}) 62%, var(--surface))` : '';
}
function scaleKey(ctx) {
  if (ctx.lens === 'change') return `<span class="scale">Below usual <i style="background:color-mix(in srgb, var(--down) 55%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--down) 25%, var(--surface))"></i><i style="background:var(--surface-2)"></i><i style="background:color-mix(in srgb, var(--up) 25%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--up) 55%, var(--surface))"></i> Above</span>`;
  if (ctx.lens === 'amount') return `<span class="scale">Fewer <i style="background:color-mix(in srgb, var(--accent) 10%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--accent) 35%, var(--surface))"></i><i style="background:color-mix(in srgb, var(--accent) 68%, var(--surface))"></i> More</span>`;
  return `<span class="scale">${ctx.focus ? `<b style="color:var(--text)">${ctx.focus}</b>: ${LEADS[ctx.lens].of === 'clicks' ? 'clicks' : 'visits'} each day, darker is a bigger share` : 'A day is named when something starts: a new page, or one rising to 2× its usual share'}</span>`;
}
function calCell(scope, date, ctx, phone, lim) {
  const d = day(scope, date), n = +date.slice(8);
  if (d.future) return `<div class="cday fut${d.today ? ' today' : ''}" role="gridcell"><span class="cd-n">${n}</span>${d.today && !phone ? '<span class="cd-val" style="font-weight:500">today</span>' : ''}</div>`;
  const ev = eventsOn(scope, date, ctx.layers);
  const evHtml = phone
    ? `<span class="dots">${ev.slice(0, 3).map((e) => `<i class="${e[2] === 'alert' ? 'al' : ''}"></i>`).join('')}</span>`
    : `<span class="cd-ev">${ev.slice(0, 3).map((e) => `<span class="${e[2] === 'alert' ? 'al' : ''}" title="${e[3]}">${ic(KINDS[e[2]][0], 12)}</span>`).join('')}</span>`;
  const L = ctx.lens, m = ctx.metric;
  let val = '', isNew = false, hot = 0;
  if (L === 'change' || L === 'amount') {
    const v = d.v[m], c = v / Math.max(1e-9, d.usual[m]) - 1;
    val = phone ? `<span class="cd-val">${fmtM(m, v, true)}</span>` : `<span class="cd-val">${fmtM(m, v)}${L === 'change' ? `<small class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</small>` : ''}</span>`;
  } else {
    const list = d[LEADS[L].key];
    if (ctx.focus) {
      // One item picked: its own number every day.
      const it = list.find((x) => x.p === ctx.focus);
      isNew = !!(it && it.isNew);
      val = `<span class="cd-val">${fmt(Math.round((it ? it.share : 0) * d.v[LEADS[L].of]))}<small class="muted">${it ? Math.round(it.share * 100) : 0}%</small></span>`;
    } else {
      // Quiet days stay plain. A day is named only when something starts: a new page,
      // or the first day an item runs at 2× its usual share or more.
      const key = LEADS[L].key, prevDay = day(scope, addD(date, -1));
      const hot = (dd, x) => { if (!x || x.share < 0.08) return 0; const b = baseShare(scope, dd, key, x.p); return b > 0.005 && x.share / b >= 2 ? x.share / b : 0; };
      const jump = list.map((x) => ({ ...x, ratio: hot(date, x) }))
        .filter((x) => x.isNew || (x.ratio && !hot(prevDay.date, prevDay[key].find((y) => y.p === x.p))))
        .sort((a, b) => (Number(!!b.isNew) - Number(!!a.isNew)) || (b.ratio - a.ratio))[0];
      if (jump) {
        const what = jump.isNew ? 'new' : `↑ ${jump.ratio >= 10 ? Math.round(jump.ratio) : jump.ratio.toFixed(1)}× usual`;
        const nm = L === 'landing' ? nameOf(jump.p) : jump.p;
        val = phone ? `<span class="pbar" style="--c:var(--s${jump.c + 1})"></span>` : `<span class="jmp" style="--c:var(--s${jump.c + 1})" title="${jump.p}: ${Math.round(jump.share * 100)}% of the day, ${what}"><b>${nm}</b><small>${what}</small></span>`;
      }
    }
  }
  const act = phone && !lim ? `cal-d:${date}|pop:day` : `cal-d:${date}`;
  return `<button type="button" class="cday${S.cal.day === date ? ' sel' : ''}" style="${cellFill(d, ctx, false)}" data-act="${act}" aria-label="${date}"><span class="cd-top"><span class="cd-n">${n}${isNew && !phone ? ' <span class="newtag">NEW</span>' : ''}${hot > 1 && !phone ? ` <span class="hotn" title="${hot} rising this day">+${hot - 1}</span>` : ''}</span>${evHtml}</span>${val}</button>`;
}
// A day's list for a "what led" lens, each with how far it is above its usual share.
function ranked(scope, d, lens) {
  const key = LEADS[lens].key;
  const list = d[key].map((x) => ({ ...x, trend: x.isNew ? x.share : x.share - baseShare(scope, d.date, key, x.p) }));
  return S.cal.rank === 'trend' ? list.sort((a, b) => b.trend - a.trend) : list;
}
// Every page (source, search, country) in one list: its line across the window, its total, and the change.
function leadMatrix(scope, days, ctx, phone) {
  const L = LEADS[ctx.lens];
  const ds = days.filter((d) => d <= LAST);
  if (!L || ds.length < 2) return '';
  const len = ds.length, before = ds.map((dd) => addD(dd, -len));
  const nOf = (dd, p) => { const d = day(scope, dd), x = d[L.key].find((y) => y.p === p); return x ? x.share * d.v[L.of] : 0; };
  const items = L.items(scope).map(([p, c, since]) => {
    const series = ds.map((dd) => nOf(dd, p)), total = series.reduce((a, b) => a + b, 0), prev = before.reduce((a, dd) => a + nOf(dd, p), 0);
    const fresh = !!since && since >= ds[0];
    const change = prev > 0 && !fresh ? total / prev - 1 : null;
    const tag = fresh ? `New on ${fmtD(since, { day: 'numeric', month: 'short' })}` : change === null ? 'New' : change > 0.3 ? 'Rising' : change < -0.2 ? 'Falling' : 'Steady';
    return { p, c, series, total, change, tag, cls: change === null || change > 0.3 ? 'up' : change < -0.2 ? 'down' : 'muted', score: change === null ? 99 : change };
  }).sort((a, b) => b.score - a.score);
  const shown = S.cal.mxAll ? items : items.slice(0, 6);
  const spark = (sr, c) => {
    const mx = Math.max(1, ...sr);
    const pts = sr.map((v, i) => `${((i / (sr.length - 1)) * 100).toFixed(1)},${(25 - (v / mx) * 21).toFixed(1)}`).join(' ');
    return `<svg class="tsp" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--s${c + 1})" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  };
  const what = L.of === 'clicks' ? 'Clicks' : 'Visits';
  const rows = shown.map((i) => `<button type="button" class="trow${ctx.focus === i.p ? ' on' : ''}" data-act="cal-f:${i.p}" title="${ctx.focus === i.p ? 'Showing on the calendar. Click again to stop.' : 'Show on the calendar'}"><span class="tn"><i style="background:var(--s${i.c + 1})"></i><span>${L.key === 'pages' ? `<b>${nameOf(i.p)}</b><small>${i.p}</small>` : i.p}</span></span>${spark(i.series, i.c)}<span class="tv">${fmt(Math.round(i.total))}</span><span class="tc ${i.cls}">${i.change === null ? '—' : pct(i.change)}</span><span class="tt ${i.cls}">${i.tag}</span></button>`).join('');
  const more = items.length > 6 ? `<button type="button" class="linkish" data-act="cal-mx">${S.cal.mxAll ? 'Show fewer' : `Show all ${items.length}`}</button>` : '';
  return `<div class="tlist"><h4 class="mxh">What’s moving <small>${L.name.toLowerCase()}, rising first · click one to show it on the calendar</small></h4><div class="trow thead"><span>${L.one[0].toUpperCase() + L.one.slice(1)}</span><span>Each day</span><span class="tv">${what}</span><span class="tc">vs the ${len} days before</span><span class="tt"></span></div>${rows}${more}</div>`;
}
function monthGrid(scope, ctx, phone, lim) {
  const ym = S.cal.month, days = monthDays(ym), lead = (new Date(tOf(days[0])).getUTCDay() + 6) % 7;
  const nav = `<div class="calnav"><div class="mo"><button type="button" class="icon-btn" data-act="cal-mo:-1" aria-label="Previous month"${ym <= YEAR_MONTHS[0] ? ' disabled' : ''}>${ic('back', 14)}</button><span>${monthName(ym)}</span><button type="button" class="icon-btn" data-act="cal-mo:1" aria-label="Next month"${ym >= YEAR_MONTHS[11] ? ' disabled' : ''}>${ic('fwd', 14)}</button></div>${scaleKey(ctx)}</div>`;
  const wd = (phone ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((w) => `<span class="wdh">${w}</span>`).join('');
  return `${lim ? nav : ''}<div class="cal" role="grid">${wd}${'<span class="cday blank"></span>'.repeat(lead)}${days.map((d) => calCell(scope, d, ctx, phone, lim)).join('')}</div>`;
}
function yearGrid(scope, ctx) {
  return `<div class="year">${YEAR_MONTHS.map((ym) => {
    const ds = monthDays(ym), lead = (new Date(tOf(ds[0])).getUTCDay() + 6) % 7;
    return `<div class="mini"><button type="button" class="ml" data-act="cal-ym:${ym}|cal-z:month">${monthName(ym, true)}</button><div class="mg">${'<span class="sq b"></span>'.repeat(lead)}${ds.map((dd) => {
      const d = day(scope, dd);
      if (d.future) return '<span class="sq fut"></span>';
      const ev = eventsOn(scope, dd, ctx.layers);
      const cls = ev.some((e) => e[2] === 'alert') ? ' al' : ev.length ? ' ev' : '';
      return `<button type="button" class="sq${cls}" style="${cellFill(d, ctx, true)}" data-act="cal-ym:${ym}|cal-d:${dd}|cal-z:month" title="${dd}${ev.length ? ` · ${ev.map((e) => e[3]).join(', ')}` : ''}" aria-label="${dd}"></button>`;
    }).join('')}</div></div>`;
  }).join('')}</div>`;
}
function calTiles(scope, days, ctx) {
  const data = days.filter((d) => d <= LAST).map((d) => day(scope, d));
  return `<div class="tiles">${CAL_METRICS.map(([k, l]) => {
    const sumV = (kk) => data.reduce((a, d) => a + d.v[kk], 0), sumU = (kk) => data.reduce((a, d) => a + d.usual[kk], 0);
    const tot = k === 'conv' ? sumV('signups') / Math.max(1, sumV('visits')) : sumV(k);
    const us = k === 'conv' ? sumU('signups') / Math.max(1, sumU('visits')) : sumU(k);
    const c = tot / Math.max(1e-9, us) - 1;
    const vals = days.length === 1 && data.length ? hours(scope, days[0]).map((x) => x.v[k]) : data.map((d) => d.v[k]), mx = Math.max(1, ...vals);
    const path = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, vals.length - 1)) * 100).toFixed(1)},${(22 - (v / mx) * 20).toFixed(1)}`).join(' ');
    return `<button type="button" class="tile${ctx.metric === k && (ctx.lens === 'change' || ctx.lens === 'amount') ? ' on' : ''}" data-act="cal-m:${k}"><small>${l}</small><b>${fmtM(k, tot, true)}<span class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</span></b><svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg></button>`;
  }).join('')}</div>`;
}
function calLegend(scope, ctx, days, lim) {
  if (lim) return '';
  const data = days.filter((d) => d <= LAST).map((d) => day(scope, d));
  let html = '';
  if (LEADS[ctx.lens] && (S.cal.zoom === 'year' || S.cal.zoom === 'day')) {
    const items = LEADS[ctx.lens].items(scope);
    const led = (p) => data.filter((d) => d[LEADS[ctx.lens].key][0].p === p).length;
    html += `<div class="legend" aria-label="Pick one to see its share every day">${items.map(([p, c]) => `<button type="button" class="lg${ctx.focus === p ? ' on' : ctx.focus ? ' off' : ''}" style="--c:var(--s${c + 1})" data-act="cal-f:${p}"><i></i>${p}<span class="muted">${led(p)} days on top</span></button>`).join('')}</div>`;
  }
  const inRange = EVENTS.filter(([s, d]) => (scope === 'all' || s === scope) && d >= days[0] && d <= days[days.length - 1]);
  html += `<div class="legend">${Object.entries(KINDS).map(([k, [i, l]]) => `<button type="button" class="lg${S.cal.layers.includes(k) ? '' : ' off'}" data-act="cal-k:${k}" aria-pressed="${S.cal.layers.includes(k)}"><span class="${k === 'alert' ? 'down' : ''}" style="display:grid">${ic(i, 13)}</span>${l}<span class="muted">${inRange.filter((e) => e[2] === k).length}</span></button>`).join('')}</div>`;
  return html;
}
const addD = (d, n) => isoOf(tOf(d) + n * DAYMS);
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const wdName = (d) => new Date(tOf(d)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
// What a day is set against: a usual same weekday (the 4 before it) or last week's same day.
const baseOf = (scope, date, k) => (S.cal.cmp === 'week' ? day(scope, addD(date, -7)).v[k] : day(scope, date).usual[k]);
function baseShare(scope, date, key, p) {
  const ks = S.cal.cmp === 'week' ? [1] : [1, 2, 3, 4];
  return ks.reduce((a, k) => a + ((day(scope, addD(date, -7 * k))[key].find((x) => x.p === p) || { share: 0 }).share), 0) / ks.length;
}
// Did it work: the 3 days after a mark against the 3 before it.
function effectOf(scope, date, k) {
  const after = [1, 2, 3].map((i) => addD(date, i));
  if (after[2] > LAST) return { early: true, ready: new Date(tOf(addD(date, 4))).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) };
  const sum = (ds) => ds.reduce((a, d) => a + day(scope, d).v[k], 0);
  return { c: sum(after) / Math.max(1, sum([1, 2, 3].map((i) => addD(date, -i)))) - 1 };
}
const MARK_SAY = { deploy: (t, h) => `You deployed “${t}” at ${h}`, content: (t, h) => `You published “${t.replace(/^(Guide|Page): /, '')}” at ${h}`, post: (t, h) => `${t} at ${h}`, release: (t, h) => `${t} at ${h}`, mention: (t) => t, search: (t) => t, found: (t) => `Kauzl found: ${t}`, todo: (t) => t };
function dayStory(scope, date) {
  const d = day(scope, date), than = S.cal.cmp === 'week' ? `last ${wdName(date)}` : `a usual ${wdName(date)}`;
  const ch = (k) => d.v[k] / Math.max(1e-9, baseOf(scope, date, k)) - 1;
  const c = ch('visits');
  const parts = [];
  let first = `Visits were ${c >= 0.9 ? `${(1 + c).toFixed(1)}× ${than}` : Math.abs(c) < 0.06 ? `about the same as ${than}` : `${Math.round(Math.abs(c) * 100)}% ${c > 0 ? 'above' : 'below'} ${than}`}`;
  if (Math.abs(c) >= 0.15) {
    const drv = d.sources.map((x) => ({ ...x, base: baseShare(scope, date, 'sources', x.p) })).map((x) => ({ ...x, gain: x.share - x.base })).sort((a, b) => (c > 0 ? b.gain - a.gain : a.gain - b.gain))[0];
    if (drv && Math.abs(drv.gain) > 0.06) first += `, ${c > 0 ? 'mostly from' : 'with fewer from'} <b>${drv.p}</b> (${Math.round(drv.share * 100)}% of visits, usually ${Math.round(drv.base * 100)}%)`;
  }
  parts.push(first);
  const evs = EVENTS.filter((e) => e[1] === date && (scope === 'all' || e[0] === scope));
  const lead = evs.find((e) => e[2] !== 'alert');
  if (lead) parts.push(MARK_SAY[lead[2]](lead[3], hh(evHour(lead))));
  const al = evs.find((e) => e[2] === 'alert');
  if (al) parts.push(`An alert fired: ${al[3]}`);
  else { const sg = ch('signups'); if (Math.abs(sg) >= 0.3) parts.push(`Signups were ${sg > 0 ? 'up' : 'down'} ${Math.round(Math.abs(sg) * 100)}%`); }
  const nw = d.pages.find((x) => x.isNew);
  if (nw) parts.push(`<b>${nameOf(nw.p)}</b>, a new page, took ${Math.round(nw.share * 100)}% of landings on its first day`);
  return parts.join('. ') + '.';
}
function dayPanel(scope, date, inline) {
  const d = day(scope, date);
  const title = new Date(tOf(date)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const prev = addD(date, -1), next = addD(date, 1);
  const go = (dd) => (S.cal.zoom === 'day' ? `cal-end:${dd}` : `cal-d:${dd}`);
  const nav = `<div class="insp-h"><span class="dnav"><button type="button" class="icon-btn" data-act="${go(prev)}" aria-label="Day before" title="Day before (←)"${prev < FIRST ? ' disabled' : ''}>${ic('back', 14)}</button><b>${title}</b><button type="button" class="icon-btn" data-act="${go(next)}" aria-label="Day after" title="Day after (→)"${next > LAST ? ' disabled' : ''}>${ic('fwd', 14)}</button></span>${inline ? '' : `<button type="button" class="icon-btn" data-act="cal-d:none|close" aria-label="Back to the whole period" title="Back to the whole period">${ic('x', 14)}</button>`}</div>`;
  if (d.future) return `<div class="insp-in">${nav}<p class="muted">No data yet.</p></div>`;
  const wdn = wdName(date);
  const cmp = `<div class="mini-seg cmp" role="group" aria-label="Compare with">${[['usual', `Usual ${wdn}`], ['week', `Last ${wdn}`]].map(([k, l]) => `<button type="button" class="${S.cal.cmp === k ? 'on' : ''}" data-act="cal-c:${k}">${l}</button>`).join('')}</div>`;
  const stats = `<div class="dnums">${CAL_METRICS.map(([k, l]) => { const b = baseOf(scope, date, k), c = d.v[k] / Math.max(1e-9, b) - 1; return `<div class="dnum"><span>${l}</span><b>${fmtM(k, d.v[k])}</b><span class="muted">${fmtM(k, b, true)}</span><span class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</span></div>`; }).join('')}</div>`;
  const evs = EVENTS.filter((e) => e[1] === date && (scope === 'all' || e[0] === scope)).sort((a, b) => evHour(a) - evHour(b));
  const hs = hours(scope, date), mx = Math.max(1, ...hs.map((x) => x.v.visits));
  const strip = S.cal.zoom === 'day' ? '' : `<button type="button" class="dstrip" data-act="${S.view === 'timeline' ? '' : 'view:timeline|'}cal-z:day|cal-end:${date}" aria-label="Open ${title} hour by hour">${hs.map((x) => { const here = evs.filter((e) => evHour(e) === x.h); return `<span class="ds-h" title="${hh(x.h)} · ${fmt(x.v.visits)} visits${here.length ? ` · ${here.map((e) => e[3]).join(', ')}` : ''}"><span class="ds-m">${here.length ? `<i class="${here.some((e) => e[2] === 'alert') ? 'al' : ''}"></i>` : ''}</span><span class="ds-b" style="height:${Math.max(4, Math.round((x.v.visits / mx) * 34))}px"></span></span>`; }).join('')}<span class="ds-l"><span>00</span><span>06</span><span>12</span><span>18</span><span>By hour →</span></span></button>`;
  const TABS = [['pages', 'Pages'], ['sources', 'Sources'], ['queries', 'Searches'], ['countries', 'Countries']];
  const cur = S.cal.dtab || (LEADS[S.cal.lens] ? LEADS[S.cal.lens].key : 'pages');
  const list = d[cur].slice(0, 5).map((x) => {
    const b = baseShare(scope, date, cur, x.p), dl = x.share - b, flat = Math.abs(dl) < 0.03;
    const name = cur === 'pages' ? `<button type="button" class="plink" data-act="${S._inPanel ? '' : `pclear|pday:${date}|`}ppage:${x.p}" title="${x.p}">${nameOf(x.p)}</button>` : x.p;
    return `<div class="srow" style="--c:var(--s${x.c + 1})"><span class="lbl"><span>${name}${x.isNew ? ' <span class="newtag">NEW</span>' : ''}</span><i style="width:${Math.round(x.share * 100)}%"></i></span><span class="num">${fmt(Math.round(d.v[cur === 'queries' ? 'clicks' : 'visits'] * x.share))}</span><span class="dl ${x.isNew ? 'up' : flat ? 'muted' : dl > 0 ? 'up' : 'down'}" title="${Math.round(x.share * 100)}% of the day, usually ${Math.round(b * 100)}%">${x.isNew ? 'first day' : flat ? 'as usual' : `${dl > 0 ? '+' : '−'}${Math.round(Math.abs(dl) * 100)} pts`}</span></div>`;
  }).join('');
  const tabs = `<div><div class="dtabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" data-act="cal-t:${k}">${l}</button>`).join('')}</div>${list}</div>`;
  const happened = `<div class="ib"><h5>What happened</h5>${evs.length ? `<ol class="dev">${evs.map((e) => {
    const k = e[2];
    let extra = '';
    if (k === 'alert') extra = '<button type="button" class="linkish" data-act="view:inbox">Open in Inbox →</button>';
    else if (e[4]) extra = `<button type="button" class="linkish" data-act="${S._inPanel ? '' : `pclear|pday:${date}|`}ppage:${e[4]}">Open the page’s story →</button>`;
    else if (k !== 'mention') {
      const m = k === 'deploy' ? 'signups' : 'visits', ef = effectOf(scope, date, m);
      extra = ef.early ? `<span class="muted">Too early to judge: in on ${ef.ready}</span>` : `<span>${m === 'signups' ? 'Signups' : 'Visits'} <b class="${ef.c >= 0 ? 'up' : 'down'}">${pct(ef.c)}</b> in the 3 days after</span>`;
    }
    return `<li><span class="t">${hh(evHour(e))}</span><span class="${k === 'alert' ? 'down' : ''}">${ic(KINDS[k][0], 14)}</span><span class="b">${scope === 'all' ? `<span class="tag">${site(e[0]).label}</span>` : ''}<b>${e[3]}</b>${extra}</span></li>`;
  }).join('')}</ol>` : '<p class="empty">Nothing marked.</p>'}<span class="chips"><button type="button" class="chip" data-act="noop">+ Note</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask about this day</button></span></div>`;
  return `<div class="insp-in">${nav}<p class="dstory">${dayStory(scope, date)}</p><div class="ib"><div class="cmprow"><h5>Against</h5>${cmp}</div>${stats}</div>${strip}${tabs}${happened}</div>`;
}
function followDay(d) {
  const z = S.cal.zoom;
  if (z === 'month') { if (YEAR_MONTHS.includes(d.slice(0, 7))) S.cal.month = d.slice(0, 7); }
  else if (z === '7d' || z === '28d') {
    const n = ROLL[z], start = addD(S.cal.end, -(n - 1));
    if (d > S.cal.end) S.cal.end = d;
    else if (d < start) S.cal.end = addD(d, n - 1) > LAST ? LAST : addD(d, n - 1);
  }
}

/* Windows: a day by the hour, a week of columns, 28 rolling days, a month, a year. */
const WINDOWS = [['day', 'Yesterday'], ['7d', '7 days'], ['28d', '28 days'], ['month', 'Month'], ['year', 'Year']];
const ROLL = { day: 1, '7d': 7, '28d': 28 };
const FIRST = '2025-12-01';
function windowDays(zoom) {
  if (zoom === 'year') return yearDays();
  if (zoom === 'month') return monthDays(S.cal.month);
  const n = ROLL[zoom];
  return Array.from({ length: n }, (_, i) => isoOf(tOf(S.cal.end) - (n - 1 - i) * DAYMS));
}
const fmtD = (d, o) => new Date(tOf(d)).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
function rollNav(days, zoom, ctx) {
  const first = days[0], last = days[days.length - 1];
  const label = zoom === 'day'
    ? `${last === LAST ? 'Yesterday · ' : ''}${fmtD(last, { weekday: 'long', day: 'numeric', month: 'long' })}`
    : `${fmtD(first, { day: 'numeric', month: 'short' })} – ${fmtD(last, { day: 'numeric', month: 'short' })}${last === LAST ? ' · to yesterday' : ''}`;
  return `<div class="calnav"><div class="mo"><button type="button" class="icon-btn" data-act="cal-sh:-1" aria-label="Earlier"${first <= FIRST ? ' disabled' : ''}>${ic('back', 14)}</button><span>${label}</span><button type="button" class="icon-btn" data-act="cal-sh:1" aria-label="Later"${last >= LAST ? ' disabled' : ''}>${ic('fwd', 14)}</button></div>${zoom === 'day' ? '' : scaleKey(ctx)}</div>`;
}
function rollGrid(scope, days, ctx, phone, lim) {
  const lead = (new Date(tOf(days[0])).getUTCDay() + 6) % 7;
  const wd = (phone ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((w) => `<span class="wdh">${w}</span>`).join('');
  return `<div class="cal" role="grid">${wd}${'<span class="cday blank"></span>'.repeat(lead)}${days.map((d) => calCell(scope, d, ctx, phone, lim)).join('')}</div>`;
}
function weekView(scope, days, ctx, phone) {
  const m = ctx.metric;
  return `<div class="week">${days.map((dd) => {
    const d = day(scope, dd), ev = eventsOn(scope, dd, ctx.layers), c = d.v[m] / Math.max(1e-9, d.usual[m]) - 1;
    const list = LEADS[ctx.lens] ? ranked(scope, d, ctx.lens) : d.pages;
    return `<button type="button" class="wcol${S.cal.day === dd ? ' sel' : ''}" data-act="cal-d:${dd}${phone ? '|pop:day' : ''}">
      <span class="wtop" style="${cellFill(d, ctx, true)}"><span class="wd">${fmtD(dd, { weekday: 'short', day: 'numeric' })}</span><b>${fmtM(m, d.v[m])}</b><small class="${c >= 0 ? 'up' : 'down'}">${pct(c)} vs usual</small></span>
      <span class="wlist">${list.slice(0, 3).map((x) => `<span class="wpg${ctx.focus === x.p ? ' on' : ''}" style="--c:var(--s${x.c + 1})"><i></i><span>${x.p}</span>${x.isNew ? '<span class="newtag">NEW</span>' : S.cal.rank === 'trend' && x.trend !== undefined ? `<small class="${x.trend >= 0 ? 'up' : 'down'}">${x.trend >= 0 ? '+' : '−'}${Math.round(Math.abs(x.trend) * 100)}</small>` : ''}</span>`).join('')}</span>
      <span class="wev">${ev.map((e) => `<span class="${e[2] === 'alert' ? 'down' : ''}">${ic(KINDS[e[2]][0], 12)} ${e[3]}</span>`).join('')}</span>
    </button>`;
  }).join('')}</div>`;
}
const PROFILE = [0.2, 0.12, 0.08, 0.06, 0.06, 0.1, 0.2, 0.4, 0.7, 0.95, 1.1, 1.2, 1.25, 1.3, 1.4, 1.45, 1.4, 1.3, 1.15, 1, 0.85, 0.7, 0.5, 0.32];
const PSUM = PROFILE.reduce((a, b) => a + b, 0);
const evHour = (e) => (e[2] === 'post' ? 15 : e[2] === 'alert' ? 8 : 10 + Math.floor(rnd(e[3].length * 1.37) * 8));
function hours(scope, date) {
  const d = day(scope, date), kz = scope === 'kauzl' || scope === 'all';
  return PROFILE.map((pr, h) => {
    const r = rnd(h * 7.7 + tOf(date) / 1e8);
    let f = 1 + (r - 0.5) * 0.4;
    const spike = kz && date === '2026-11-15' && h >= 15 && h <= 18;
    if (spike) f += 1.6;
    const v = {}, usual = {};
    for (const k in d.v) { v[k] = Math.round(d.v[k] * (pr / PSUM) * f); usual[k] = d.usual[k] * (pr / PSUM); }
    v.conv = v.signups / Math.max(1, v.visits); usual.conv = d.usual.conv;
    const queries = d.queries.map((x) => ({ ...x, share: x.share * (0.7 + rnd(h * 2.3 + x.c) * 0.6) })).sort((a, b) => b.share - a.share);
    const countries = d.countries.map((x) => ({ ...x, share: x.share * (0.8 + rnd(h * 4.1 + x.c) * 0.4) })).sort((a, b) => b.share - a.share);
    const pages = d.pages.map((x) => ({ ...x, share: x.share * (0.7 + rnd(h * 3.1 + x.c) * 0.6) * (spike && x.p === '/kauzl-vs-plausible' ? 2.5 : 1) })).sort((a, b) => b.share - a.share);
    const sources = d.sources.map((x) => ({ ...x, share: x.share * (0.7 + rnd(h * 5.3 + x.c) * 0.6) * (spike && x.p === 'Reddit' ? 3 : 1) })).sort((a, b) => b.share - a.share);
    return { h, v, usual, pages, sources, queries, countries, future: false };
  });
}
function dayView(scope, date, ctx) {
  const d = day(scope, date);
  if (d.future) return '<p class="empty">No data yet.</p>';
  const hs = hours(scope, date), m = ctx.metric, mx = Math.max(1, ...hs.map((x) => x.v[m]));
  const ev = eventsOn(scope, date, ctx.layers), hctx = { ...ctx, max: mx };
  const ml = CAL_METRICS.find(([k]) => k === m)[1].toLowerCase();
  return `<div class="hours">${hs.map((x) => {
    const here = ev.filter((e) => evHour(e) === x.h);
    const top = (LEADS[ctx.lens] ? x[LEADS[ctx.lens].key] : x.pages)[0];
    const tip = `${String(x.h).padStart(2, '0')}:00 · ${fmtM(m, x.v[m])} ${ml}${LEADS[ctx.lens] ? ` · top: ${top.p}` : ''}${here.length ? ` · ${here.map((e) => e[3]).join(', ')}` : ''}`;
    return `<div class="hr" title="${tip}"><span class="hev">${here.map((e) => `<span class="${e[2] === 'alert' ? 'down' : ''}">${ic(KINDS[e[2]][0], 11)}</span>`).join('')}</span><span class="hwrap"><span class="hbar" style="height:${Math.max(3, Math.round((x.v[m] / mx) * 100))}%;${cellFill(x, hctx, true) || 'background:var(--accent)'}"></span></span><span class="hl">${x.h % 6 === 0 ? String(x.h).padStart(2, '0') : ''}</span></div>`;
  }).join('')}</div><p class="scale">Each bar is an hour of ${ml}, colored by “Color the days by”. Marks sit above the hour they happened.</p>`;
}
// The calendar is a map with an inspector beside it: every control that changes the map sits
// in one bar on top of it, and the right-hand panel shows the whole period, or the picked day.
const SHOW_LABELS = { change: 'vs usual', amount: 'Amount', landing: 'Pages', sources: 'Sources', searches: 'Searches', countries: 'Countries' };
function periodNav(zoom, days) {
  const arrows = (a, b, offA, offB, label) => `<div class="mo"><button type="button" class="icon-btn" data-act="${a}" aria-label="Earlier"${offA ? ' disabled' : ''}>${ic('back', 14)}</button><span>${label}</span><button type="button" class="icon-btn" data-act="${b}" aria-label="Later"${offB ? ' disabled' : ''}>${ic('fwd', 14)}</button></div>`;
  if (zoom === 'year') return `<div class="mo"><span>${monthName(YEAR_MONTHS[0], true)} 2025 – ${monthName(YEAR_MONTHS[11], true)} 2026</span></div>`;
  if (zoom === 'month') return arrows('cal-mo:-1', 'cal-mo:1', S.cal.month <= YEAR_MONTHS[0], S.cal.month >= YEAR_MONTHS[11], monthName(S.cal.month));
  const first = days[0], last = days[days.length - 1];
  const label = zoom === 'day' ? `${last === LAST ? 'Yesterday, ' : ''}${fmtD(last, { weekday: 'short', day: 'numeric', month: 'short' })}` : `${fmtD(first, { day: 'numeric', month: 'short' })} – ${fmtD(last, { day: 'numeric', month: 'short' })}`;
  return arrows('cal-sh:-1', 'cal-sh:1', first <= FIRST, last >= LAST, label);
}
function marksPop(scope, days) {
  const inRange = EVENTS.filter(([s, d]) => (scope === 'all' || s === scope) && d >= days[0] && d <= days[days.length - 1]);
  return `<div class="pop marks" aria-label="Marks on the calendar">${Object.entries(KINDS).map(([k, [i, l]]) => {
    const on = S.cal.layers.includes(k);
    return `<button type="button" class="row" data-act="cal-k:${k}" aria-pressed="${on}"><span class="cbx${on ? ' on' : ''}">${on ? ic('check', 11) : ''}</span><span class="${k === 'alert' ? 'down' : ''}" style="display:grid">${ic(i, 14)}</span>${l}<span class="meta">${inRange.filter((e) => e[2] === k).length}</span></button>`;
  }).join('')}</div>`;
}
function bestWorst(scope, days, ctx, phone) {
  const m = ctx.metric, ml = CAL_METRICS.find(([k]) => k === m)[1];
  const data = days.filter((d) => d <= LAST).map((d) => day(scope, d)).map((d) => ({ d, c: d.v[m] / Math.max(1e-9, d.usual[m]) - 1 }));
  const best = [...data].sort((a, b) => b.c - a.c).slice(0, 3).filter((x) => x.c > 0);
  const worst = [...data].sort((a, b) => a.c - b.c).slice(0, 3).filter((x) => x.c < 0);
  const row = (x) => `<button type="button" class="brow" data-act="cal-d:${x.d.date}${phone ? '|pop:day' : ''}"><span>${fmtD(x.d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>${fmtM(m, x.d.v[m])}</b><span class="${x.c >= 0 ? 'up' : 'down'}">${pct(x.c)}</span></button>`;
  return `${best.length ? `<div class="ib"><h5>Best days · ${ml}</h5>${best.map(row).join('')}</div>` : ''}${worst.length ? `<div class="ib"><h5>Worst days</h5>${worst.map(row).join('')}</div>` : ''}`;
}
function shipped(scope, days, phone) {
  const evs = EVENTS.filter((e) => (scope === 'all' || e[0] === scope) && e[1] >= days[0] && e[1] <= days[days.length - 1] && S.cal.layers.includes(e[2])).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 6);
  if (!evs.length) return '';
  return `<div class="ib"><h5>What happened</h5>${evs.map((e) => {
    const k = e[2];
    let eff = '';
    if (k !== 'alert' && k !== 'mention') { const ef = effectOf(scope, e[1], k === 'deploy' ? 'signups' : 'visits'); eff = ef.early ? '<span class="muted" title="The 3 days after it aren’t in yet">too early</span>' : `<span class="${ef.c >= 0 ? 'up' : 'down'}" title="${k === 'deploy' ? 'Signups' : 'Visits'}, 3 days after vs 3 before">${pct(ef.c)}</span>`; }
    return `<button type="button" class="erow" data-act="cal-d:${e[1]}${phone ? '|pop:day' : ''}"><span class="muted">${fmtD(e[1], { day: 'numeric', month: 'short' })}</span><span class="${k === 'alert' ? 'down' : ''}" style="display:grid">${ic(KINDS[k][0], 13)}</span><span class="et">${e[3]}</span><span>${eff}</span></button>`;
  }).join('')}</div>`;
}
function windowPanel(scope, days, ctx, zoom, phone) {
  const label = zoom === 'month' ? `${monthName(S.cal.month)}${S.cal.month === LAST.slice(0, 7) ? ', so far' : ''}` : zoom === 'year' ? 'The last 12 months' : `${fmtD(days[0], { day: 'numeric', month: 'short' })} – ${fmtD(days[days.length - 1], { day: 'numeric', month: 'short' })}`;
  const body = (LEADS[ctx.lens] ? leadMatrix(scope, days, ctx, true) : bestWorst(scope, days, ctx, phone)) + shipped(scope, days, phone);
  return `<div class="insp-in"><div class="insp-h"><b>${label}</b><span class="muted small2">${phone ? 'Tap a day for detail' : 'Pick a day for detail'}</span></div>${body}</div>`;
}
// Timeline as a line: the same window, metric, marks and side panel as the calendar,
// drawn as a graph. With Pages / Sources / Searches / Countries it draws the top 5 as lines.
const niceTop = (v) => { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); return (Math.ceil((v / p) * 2) / 2) * p; };
function tlLine(scope, days, ctx, phone) {
  const all = days.filter((d) => d <= LAST);
  // Long windows sum by week, so the line shows the trend instead of the weekday zigzag.
  const weekly = all.length > 120;
  // Whole weeks only, counted back from the last day, so no week is cut short.
  const groups = weekly ? Array.from({ length: Math.floor(all.length / 7) }, (_, i) => all.slice(all.length - 7 * (i + 1), all.length - 7 * i)).reverse() : all.map((d) => [d]);
  const ds = groups.map((g) => g[0]), de = groups.map((g) => g[g.length - 1]), n = ds.length;
  if (n < 2) return '<p class="empty">Not enough days in this window yet.</p>';
  const m = ctx.metric, L = LEADS[ctx.lens];
  const gsum = (g, f) => g.reduce((s, d) => s + f(day(scope, d)), 0);
  const metricOf = (g, which) => (m === 'conv' ? gsum(g, (x) => x[which].signups) / Math.max(1e-9, gsum(g, (x) => x[which].visits)) : gsum(g, (x) => x[which][m]));
  const rows = groups.map((g) => ({ v: { [m]: metricOf(g, 'v') }, usual: { [m]: metricOf(g, 'usual') } }));
  let series, pi = 0;
  if (L) {
    const items = L.items(scope).map(([p, c]) => ({ p, c, vals: groups.map((g) => gsum(g, (r) => { const x = r[L.key].find((y) => y.p === p); return x ? x.share * r.v[L.of] : 0; })) }))
      .sort((a, b) => b.vals.reduce((s, v) => s + v, 0) - a.vals.reduce((s, v) => s + v, 0));
    let top = items.slice(0, 5);
    if (ctx.focus && !top.some((t) => t.p === ctx.focus)) top = [...top.slice(0, 4), items.find((t) => t.p === ctx.focus)].filter(Boolean);
    series = top.map((t) => ({ label: L.key === 'pages' ? nameOf(t.p) : t.p, p: t.p, color: `var(--s${t.c + 1})`, vals: t.vals, faded: !!ctx.focus && ctx.focus !== t.p }));
    pi = Math.max(0, series.findIndex((s) => s.p === ctx.focus));
  } else {
    series = [{ label: CAL_METRICS.find(([k]) => k === m)[1], color: 'var(--accent)', vals: rows.map((r) => r.v[m]), area: true }, { label: 'Usual', color: 'var(--text-3)', vals: rows.map((r) => r.usual[m]), dashed: true }];
  }
  const mx = niceTop(Math.max(...series.flatMap((s) => s.vals)));
  const W = 600, H = 190;
  const X = (i) => (i / (n - 1)) * W, Y = (v) => H - (v / mx) * H, P = (i) => `${((X(i) / W) * 100).toFixed(2)}%`;
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const yfmt = (v) => (L ? kfmt(Math.round(v)) : fmtM(m, v, true));
  const lines = series.map((s) => `${s.area ? `<path d="${path(s.vals)} L${W},${H} L0,${H} Z" fill="${s.color}" opacity=".1"/>` : ''}<path d="${path(s.vals)}" fill="none" stroke="${s.color}" stroke-width="${s.dashed ? 1.5 : s.faded ? 1.5 : 2}" ${s.dashed ? 'stroke-dasharray="4 4"' : ''} opacity="${s.faded ? 0.25 : 1}" vector-effect="non-scaling-stroke"/>`).join('');
  const grid = [0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="var(--border)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
  const ylab = [0.5, 1].map((f) => `<span class="ylab" style="top:${((Y(mx * f) / H) * 100).toFixed(1)}%">${yfmt(mx * f)}</span>`).join('');
  const evs = EVENTS.filter((e) => (scope === 'all' || e[0] === scope) && e[1] >= ds[0] && e[1] <= de[n - 1] && ctx.layers.includes(e[2]));
  const gi = (d) => groups.findIndex((g) => g.includes(d));
  const seen = new Set();
  const marks = markRow(evs.map((e) => ({ x: (gi(e[1]) / (n - 1)) * 100, icon: KINDS[e[2]][0], label: `${fmtD(e[1], { day: 'numeric', month: 'short' })}: ${e[3]}`, alert: e[2] === 'alert' })), phone);
  const xl = [...new Set([0, Math.floor((n - 1) / 2), n - 1])].map((i) => `<span style="left:${P(i)}">${fmtD(ds[i], { day: 'numeric', month: 'short' })}</span>`).join('');
  const sel = S.srange && gi(S.srange[0]) >= 0 && gi(S.srange[1]) >= 0 ? `<span class="chsel" style="left:${P(gi(S.srange[0]))};width:calc(${P(gi(S.srange[1]))} - ${P(gi(S.srange[0]))})"></span>` : '';
  const open = S.cal.day && gi(S.cal.day) >= 0 ? `<span class="chopen" style="left:${P(gi(S.cal.day))}"></span>` : '';
  const legend = L ? `<div class="legend">${series.map((s) => `<button type="button" class="lg${ctx.focus === s.p ? ' on' : ctx.focus ? ' off' : ''}" style="--c:${s.color}" data-act="cal-f:${s.p}"><i></i>${s.label}</button>`).join('')}</div>` : '';
  CH = {
    scope, ds, de, rows, mx, phone, val: (i) => series[pi].vals[i],
    tip: (i, pinned) => {
      const evd = evs.filter((e) => gi(e[1]) === i);
      const body = L
        ? series.map((s) => `<span class="tr${s.faded ? ' muted' : ''}"><span class="sw"><i style="background:${s.color}"></i>${s.label}</span><b>${fmt(Math.round(s.vals[i]))}</b></span>`).join('')
        : (() => { const v = series[0].vals[i], u = series[1].vals[i], c = v / Math.max(1e-9, u) - 1; return `<span class="tr"><span>${series[0].label}</span><b>${fmtM(m, v)}</b></span><span class="tr"><span>${weekly ? 'vs a usual week' : `vs a usual ${wdName(ds[i])}`}</span><b class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</b></span>`; })();
      return `<b>${weekly ? `Week of ${fmtD(ds[i], { day: 'numeric', month: 'short' })}` : fmtD(ds[i], { weekday: 'short', day: 'numeric', month: 'short' })}</b>${body}${evd.map((e) => `<span class="tm${e[2] === 'alert' ? ' down' : ''}">${ic(KINDS[e[2]][0], 11)} ${e[3]}</span>`).join('')}${pinned ? `<button type="button" class="linkish" data-act="${weekly ? `ch-r:${ds[i]}~${de[i]}` : `cal-d:${ds[i]}|pop:day`}">${weekly ? 'Open week →' : 'Open day →'}</button>` : `<span class="muted tip-hint">${weekly ? 'Click to open this week' : 'Click to open this day'}</span>`}`;
    },
  };
  return `<div class="ichart tl" id="ichart" tabindex="0" role="img" aria-label="${L ? `Top ${L.name.toLowerCase()}` : series[0].label} each day. Left and right arrows move between days, Enter opens one.">
    <div class="plotwrap">${ylab}<div class="plot" style="height:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}${lines}</svg>${sel}${open}<span class="chsel live" hidden></span><span class="chx" hidden></span><span class="chdot" hidden></span></div><div class="chtip" hidden></div></div>
    <div class="chmarks">${marks}</div><div class="chxl">${xl}</div></div>${legend}`;
}

function calendarBody(scope, phone, lim) {
  const C = S.cal;
  const ctx = { lens: lim ? 'change' : C.lens, metric: lim && !['visits', 'clicks'].includes(C.metric) ? 'visits' : C.metric, focus: lim ? null : C.focus, layers: lim ? Object.keys(KINDS) : C.layers };
  const zoom = lim ? 'month' : C.zoom;
  const days = windowDays(zoom);
  ctx.max = Math.max(1, ...days.filter((d) => d <= LAST).map((d) => day(scope, d).v[ctx.metric]));
  if (lim) {
    const right = `<div class="mini-seg">${[['visits', 'Sessions'], ['clicks', 'Search clicks']].map(([k, l]) => `<button type="button" class="${ctx.metric === k ? 'on' : ''}" data-act="cal-m:${k}">${l}</button>`).join('')}</div>`;
    return head('Timeline', 'Every day, and what shipped on it', { phone, right }) + monthGrid(scope, ctx, phone, true);
  }
  if (C.day && !days.includes(C.day)) C.day = null;
  // One bar, four controls: the period (a menu, with ‹ › to step), what colors the days (a menu), marks (a menu), calendar or line.
  const asLine = C.view === 'line' && zoom !== 'day';
  const lastDay = days[days.length - 1];
  const periodLabel = zoom === 'day' ? (days[0] === LAST ? 'Yesterday' : fmtD(days[0], { weekday: 'short', day: 'numeric', month: 'short' }))
    : zoom === '7d' || zoom === '28d' ? (lastDay === LAST ? `Last ${ROLL[zoom]} days` : `${fmtD(days[0], { day: 'numeric', month: 'short' })} – ${fmtD(lastDay, { day: 'numeric', month: 'short' })}`)
    : zoom === 'month' ? monthName(C.month) : 'Last 12 months';
  const item = (act, label, on) => `<button type="button" class="row${on ? ' on' : ''}" data-act="${act}">${label}${on ? `<span class="meta">${ic('check', 13)}</span>` : ''}</button>`;
  const periodMenu = `<div class="pop menu">${item(`cal-z:day|cal-end:${LAST}`, 'Yesterday', zoom === 'day')}${item(`cal-z:7d|cal-end:${LAST}`, 'Last 7 days', zoom === '7d')}${item(`cal-z:28d|cal-end:${LAST}`, 'Last 28 days', zoom === '28d')}<hr>${YEAR_MONTHS.slice(-6).reverse().map((ym) => item(`cal-z:month|cal-ym:${ym}`, monthName(ym), zoom === 'month' && C.month === ym)).join('')}<hr>${item('cal-z:year', 'Last 12 months', zoom === 'year')}</div>`;
  const step = (dir) => (zoom === 'month' ? `cal-mo:${dir}` : `cal-sh:${dir}`);
  const offPrev = zoom === 'year' || (zoom === 'month' ? C.month <= YEAR_MONTHS[0] : days[0] <= FIRST);
  const offNext = zoom === 'year' || (zoom === 'month' ? C.month >= YEAR_MONTHS[11] : lastDay >= LAST);
  const period = `<div class="mo"><button type="button" class="icon-btn" data-act="${step(-1)}" aria-label="Earlier"${offPrev ? ' disabled' : ''}>${ic('back', 14)}</button><span class="mk-wrap"><button type="button" class="pbtn" data-act="pop:period" aria-expanded="${S.pop === 'period'}" aria-haspopup="menu">${periodLabel} ${ic('chev', 13)}</button>${S.pop === 'period' ? periodMenu : ''}</span><button type="button" class="icon-btn" data-act="${step(1)}" aria-label="Later"${offNext ? ' disabled' : ''}>${ic('fwd', 14)}</button></div>`;
  const byLabel = LEADS[ctx.lens] ? `By ${LEADS[ctx.lens].one}` : ctx.lens === 'amount' ? 'Amount' : 'vs usual';
  const byMenu = `<div class="pop menu">${item('cal-l:change', 'Change vs usual', ctx.lens === 'change')}${item('cal-l:amount', 'Amount', ctx.lens === 'amount')}<hr><span class="lab">Break down by</span>${Object.entries(LEADS).map(([k, L]) => item(`cal-l:${k}`, L.name, ctx.lens === k)).join('')}</div>`;
  const by = `<span class="mk-wrap"><button type="button" class="chip${S.pop === 'by' ? ' on' : ''}" data-act="pop:by" aria-expanded="${S.pop === 'by'}" aria-haspopup="menu" title="What colors the days">${byLabel} ${ic('chev', 12)}</button>${S.pop === 'by' ? byMenu : ''}</span>`;
  const marks = `<span class="mk-wrap"><button type="button" class="chip${S.pop === 'marks' ? ' on' : ''}" data-act="pop:marks" aria-expanded="${S.pop === 'marks'}">Marks${C.layers.length < 6 ? ` ${C.layers.length}/6` : ''} ${ic('chev', 12)}</button>${S.pop === 'marks' ? marksPop(scope, days) : ''}</span>`;
  const viewSeg = zoom === 'day' ? '' : `<div class="mini-seg icons" role="group" aria-label="Draw as">${[['calendar', 'calendar', 'Calendar'], ['line', 'chart', 'Line']].map(([k, i, l]) => `<button type="button" class="${(asLine ? 'line' : 'calendar') === k ? 'on' : ''}" data-act="cal-v:${k}" title="${l}" aria-label="${l}">${ic(i, 15)}</button>`).join('')}</div>`;
  // The period and filters sit in the page header, where every other page keeps its date range.
  const ctl = `<div class="hdctl">${period}<span class="bargrp">${by}${marks}${viewSeg}</span></div>`;
  const grid = asLine ? tlLine(scope, days, ctx, phone) : zoom === 'year' ? yearGrid(scope, ctx) : zoom === 'month' ? monthGrid(scope, ctx, phone, false) : zoom === '28d' ? rollGrid(scope, days, ctx, phone, false) : zoom === '7d' ? weekView(scope, days, ctx, phone) : dayView(scope, days[0], ctx);
  const map = `<div class="map">${grid}<div class="mapkey">${asLine ? '<span class="scale">Hover to read a day · click to open it · drag across days to sum them up</span>' : scaleKey(ctx)}</div></div>`;
  const html = head('Timeline', `Every day for ${scopeName(scope)}: how it went, what happened, what needs you`, { phone, right: '' }) + needsRow(scope) + askBox(scope) + ctl + calTiles(scope, days, ctx);
  if (phone) return html + map + `<div class="insp">${zoom === 'day' ? dayPanel(scope, days[0], true) : windowPanel(scope, days, ctx, zoom, true)}</div>`;
  const panel = S.srange ? rangePanel(scope, S.srange[0], S.srange[1]) : null;
  const dd = zoom === 'day' ? days[0] : C.day;
  return html + `<div class="tl-split">${map}<aside class="insp" aria-label="${panel ? 'Selected days' : dd ? 'Day' : 'Period'}">${panel || (dd ? dayPanel(scope, dd, zoom === 'day') : windowPanel(scope, days, ctx, zoom, false))}</aside></div>`;
}

// Marks under a chart: ones that would overlap merge into one bubble with a count and a list on hover.
// items: [{ x: 0..100 (percent), icon, label, alert }]. A phone fits about 18 marks across, a desktop about 40.
function markRow(items, phone) {
  const gap = phone ? 9 : 3.2, sorted = [...items].sort((a, b) => a.x - b.x), groups = [];
  for (const it of sorted) { const g = groups[groups.length - 1]; if (g && it.x - g[g.length - 1].x < gap) g.push(it); else groups.push([it]); }
  return groups.map((g) => {
    const x = g.reduce((a, it) => a + it.x, 0) / g.length, title = g.map((it) => it.label).join(' · '), al = g.some((it) => it.alert);
    return g.length === 1 ? `<span class="chmark${al ? ' al' : ''}" style="left:${x}%" title="${title}">${ic(g[0].icon, 11)}</span>` : `<span class="chmark many${al ? ' al' : ''}" style="left:${x}%" title="${title}">${g.length}</span>`;
  }).join('');
}
/* ---------- Story chart: hover to read, click to open a day, drag to sum a stretch, or read it as a table ---------- */
const CHART_N = { today: 28, '7d': 7, '28d': 28, '90d': 90 };
const niceMax = (v) => { const p = 10 ** Math.floor(Math.log10(Math.max(1, v))); return (Math.ceil((v / p) * 2) / 2) * p; };
let CH = null; // the chart on screen, for the pointer handlers
const chartDays = () => { const n = CHART_N[S.range] || 28; return Array.from({ length: n }, (_, i) => addD(LAST, -(n - 1 - i))); };
function storyChart(scope, phone) {
  const ds = chartDays(), rows = ds.map((d) => day(scope, d));
  const mx = niceMax(Math.max(...rows.map((r) => Math.max(r.v.visits, r.usual.visits))));
  const W = 600, H = 170, n = ds.length;
  const X = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W), Y = (v) => H - (v / mx) * H;
  const P = (i) => `${((X(i) / W) * 100).toFixed(2)}%`;
  const path = (get) => rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(get(r)).toFixed(1)}`).join(' ');
  CH = { scope, ds, rows, mx, phone, val: (i) => rows[i].v.visits };
  const seg = `<div class="mini-seg" role="group" aria-label="Show as">${[['chart', 'Chart'], ['table', 'Table']].map(([k, l]) => `<button type="button" class="${S.chartMode === k ? 'on' : ''}" data-act="ch-m:${k}">${l}</button>`).join('')}</div>`;
  const top = `<div class="chhead"><h4>Visits each day <span class="muted">· dashed is a usual day</span></h4>${seg}</div>`;
  if (S.chartMode === 'table') return `<div class="card">${top}${chartTable(scope, ds, rows, phone)}</div>`;
  const evs = EVENTS.filter((e) => (scope === 'all' || e[0] === scope) && e[1] >= ds[0] && e[1] <= ds[n - 1]);
  const grid = [0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="var(--border)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
  const ylab = [0.5, 1].map((f) => `<span class="ylab" style="top:${((Y(mx * f) / H) * 100).toFixed(1)}%">${kfmt(Math.round(mx * f))}</span>`).join('');
  const sel = S.srange && ds.includes(S.srange[0]) && ds.includes(S.srange[1]) ? `<span class="chsel" style="left:${P(ds.indexOf(S.srange[0]))};width:calc(${P(ds.indexOf(S.srange[1]))} - ${P(ds.indexOf(S.srange[0]))})"></span>` : '';
  const open = S.cal.day && ds.includes(S.cal.day) ? `<span class="chopen" style="left:${P(ds.indexOf(S.cal.day))}"></span>` : '';
  const marks = markRow(evs.map((e) => ({ x: (ds.indexOf(e[1]) / Math.max(1, n - 1)) * 100, icon: KINDS[e[2]][0], label: `${fmtD(e[1], { day: 'numeric', month: 'short' })}: ${e[3]}`, alert: e[2] === 'alert' })), phone);
  const xl = [...new Set([0, Math.floor((n - 1) / 2), n - 1])].map((i) => `<span style="left:${P(i)}">${fmtD(ds[i], { day: 'numeric', month: 'short' })}</span>`).join('');
  return `<div class="card">${top}<div class="ichart" id="ichart" tabindex="0" role="img" aria-label="Visits each day from ${fmtD(ds[0], { day: 'numeric', month: 'short' })} to ${fmtD(ds[n - 1], { day: 'numeric', month: 'short' })}. Left and right arrows move between days, Enter opens one.">
    <div class="plotwrap">${ylab}<div class="plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}<path d="${path((r) => r.v.visits)} L${W},${H} L0,${H} Z" fill="var(--accent)" opacity=".1"/><path d="${path((r) => r.usual.visits)}" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/><path d="${path((r) => r.v.visits)}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>${sel}${open}<span class="chsel live" hidden></span><span class="chx" hidden></span><span class="chdot" hidden></span></div><div class="chtip" hidden></div></div>
    <div class="chmarks">${marks}</div><div class="chxl">${xl}</div></div>
    <p class="chhint">${phone ? 'Tap a day to read it · slide your finger along to scrub' : 'Hover to read a day · click to open it · drag across days to sum them up · ← → keys work too'}</p></div>`;
}
function tipHTML(i, pinned) {
  const { ds, rows, scope } = CH, r = rows[i], c = r.v.visits / Math.max(1e-9, r.usual.visits) - 1;
  const evs = EVENTS.filter((e) => e[1] === ds[i] && (scope === 'all' || e[0] === scope));
  return `<b>${fmtD(ds[i], { weekday: 'short', day: 'numeric', month: 'short' })}</b><span class="tr"><span>Visits</span><b>${fmt(r.v.visits)}</b></span><span class="tr"><span>vs a usual ${wdName(ds[i])}</span><b class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</b></span><span class="tr"><span>Signups</span><b>${r.v.signups}</b></span>${evs.map((e) => `<span class="tm${e[2] === 'alert' ? ' down' : ''}">${ic(KINDS[e[2]][0], 11)} ${e[3]}</span>`).join('')}${pinned ? `<button type="button" class="linkish" data-act="cal-d:${ds[i]}|pop:day">Open day →</button>` : '<span class="muted tip-hint">Click to open this day</span>'}`;
}
function wireChart() {
  const el = document.getElementById('ichart');
  if (!el || !CH) return;
  const plot = el.querySelector('.plot'), line = el.querySelector('.chx'), dot = el.querySelector('.chdot'), tip = el.querySelector('.chtip'), shade = el.querySelector('.chsel.live');
  const n = CH.ds.length, at = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  let cur = -1, start = -1, down = false, kind = 'mouse';
  const idx = (ev) => { const r = plot.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) / r.width) * (n - 1)))); };
  const show = (i, pinned) => {
    cur = i;
    line.hidden = dot.hidden = tip.hidden = false;
    line.style.left = dot.style.left = `${at(i)}%`;
    dot.style.top = `${(1 - CH.val(i) / CH.mx) * 100}%`;
    tip.innerHTML = (CH.tip || tipHTML)(i, pinned);
    tip.classList.toggle('pinned', !!pinned);
    tip.style.left = at(i) > 55 ? `calc(${at(i)}% - 186px)` : `calc(${at(i)}% + 14px)`;
  };
  const hide = () => { line.hidden = dot.hidden = tip.hidden = true; cur = -1; };
  const paint = (a, b) => { const [l, r] = a < b ? [a, b] : [b, a]; shade.hidden = l === r; shade.style.left = `${at(l)}%`; shade.style.width = `${at(r) - at(l)}%`; };
  plot.addEventListener('pointerdown', (ev) => { kind = ev.pointerType; down = true; start = idx(ev); plot.setPointerCapture?.(ev.pointerId); show(start, kind === 'touch'); });
  plot.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'touch' && !down) return; const i = idx(ev); if (down && ev.pointerType !== 'touch' && !CH.hoverOnly) paint(start, i); show(i, ev.pointerType === 'touch'); });
  plot.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'touch' && !down) hide(); });
  plot.addEventListener('pointerup', (ev) => {
    if (!down) return;
    down = false;
    if (CH.hoverOnly) { shade.hidden = true; return; }
    const end = idx(ev);
    if (kind === 'touch') return show(end, true);
    const last = CH.de || CH.ds;
    if (end !== start) { const [a, b] = start < end ? [start, end] : [end, start]; run(`ch-r:${CH.ds[a]}~${last[b]}`); } else if (CH.de && CH.de[end] !== CH.ds[end]) run(`ch-r:${CH.ds[end]}~${CH.de[end]}`); else run(`cal-d:${CH.ds[end]}`);
  });
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); show(Math.max(0, Math.min(n - 1, cur < 0 ? n - 1 : cur + (ev.key === 'ArrowLeft' ? -1 : 1))), false); }
    else if (ev.key === 'Enter' && cur >= 0) { ev.preventDefault(); run(`cal-d:${CH.ds[cur]}${CH.phone ? '|pop:day' : ''}`); }
    else if (ev.key === 'Escape') hide();
  });
  el.addEventListener('blur', hide);
}
function chartTable(scope, ds, rows, phone) {
  const cols = [['date', 'Day'], ['visits', 'Visits'], ['chg', 'vs usual'], ['signups', 'Signups'], ['revenue', 'Revenue'], ['marks', 'What happened']];
  const data = rows.map((r, i) => ({ date: ds[i], visits: r.v.visits, chg: r.v.visits / Math.max(1e-9, r.usual.visits) - 1, signups: r.v.signups, revenue: r.v.revenue, marks: EVENTS.filter((e) => e[1] === ds[i] && (scope === 'all' || e[0] === scope)).map((e) => e[3]).join(', ') }));
  const [sk, sd] = S.tsort;
  data.sort((a, b) => (a[sk] > b[sk] ? 1 : a[sk] < b[sk] ? -1 : 0) * (sd === 'asc' ? 1 : -1));
  const th = cols.map(([k, l]) => `<th${k !== 'date' && k !== 'marks' ? ' class="num"' : ''}><button type="button" class="thbtn" data-act="ch-s:${k}">${l}${sk === k ? (sd === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>`).join('');
  const tr = data.map((d) => `<tr data-act="cal-d:${d.date}${phone ? '|pop:day' : ''}"><td>${fmtD(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td class="num">${fmt(d.visits)}</td><td class="num ${d.chg >= 0 ? 'up' : 'down'}">${pct(d.chg)}</td><td class="num">${d.signups}</td><td class="num">$${fmt(d.revenue)}</td><td class="mk">${d.marks || '<span class="muted">—</span>'}</td></tr>`).join('');
  return `<div class="tscroll"><table class="ctable"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div><div class="chhead"><span class="chhint">Click a row to open that day. Click a heading to sort.</span><button type="button" class="chip" data-act="ch-copy">${S.copied ? 'Copied' : 'Copy as CSV'}</button></div>`;
}
function rangePanel(scope, a, b) {
  const ds = [];
  for (let d = a; d <= b; d = addD(d, 1)) ds.push(d);
  const n = ds.length, before = ds.map((d) => addD(d, -n));
  const sum = (list, k) => list.reduce((s, d) => s + day(scope, d).v[k], 0);
  const nums = CAL_METRICS.map(([k, l]) => {
    const v = k === 'conv' ? sum(ds, 'signups') / Math.max(1, sum(ds, 'visits')) : sum(ds, k);
    const p = k === 'conv' ? sum(before, 'signups') / Math.max(1, sum(before, 'visits')) : sum(before, k);
    const c = v / Math.max(1e-9, p) - 1;
    return `<div class="dnum"><span>${l}</span><b>${fmtM(k, v)}</b><span class="muted">${fmtM(k, p, true)}</span><span class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</span></div>`;
  }).join('');
  const diff = (key, label, name) => {
    const tot = (list, p) => list.reduce((s, d) => { const dd = day(scope, d), x = dd[key].find((y) => y.p === p); return s + (x ? x.share * dd.v.visits : 0); }, 0);
    const items = (key === 'pages' ? PAGESET[scope] : SOURCES).map(([p]) => { const now = tot(ds, p), was = tot(before, p); return { p, now, was, d: now - was }; }).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
    return `<div class="ib"><h5>${label}</h5>${items.map((x) => `<div class="dnum"><span>${name(x.p)}</span><b>${fmt(Math.round(x.now))}</b><span class="muted">${fmt(Math.round(x.was))}</span><span class="${x.d >= 0 ? 'up' : 'down'}">${x.d >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(x.d)))}</span></div>`).join('')}</div>`;
  };
  const evs = EVENTS.filter((e) => (scope === 'all' || e[0] === scope) && e[1] >= a && e[1] <= b);
  return `<div class="insp-in"><div class="insp-h"><b>${fmtD(a, { day: 'numeric', month: 'short' })} – ${fmtD(b, { day: 'numeric', month: 'short' })} · ${n} days</b><button type="button" class="icon-btn" data-act="ch-x" aria-label="Close" title="Close">${ic('x', 14)}</button></div>
    <div class="ib"><h5>Against the ${n} days before</h5>${nums}</div>
    ${diff('sources', 'Sources that changed most', (p) => p)}${diff('pages', 'Pages that changed most', nameOf)}
    ${evs.length ? `<div class="ib"><h5>What happened</h5>${evs.map((e) => `<button type="button" class="erow" data-act="cal-d:${e[1]}"><span class="muted">${fmtD(e[1], { day: 'numeric', month: 'short' })}</span><span class="${e[2] === 'alert' ? 'down' : ''}" style="display:grid">${ic(KINDS[e[2]][0], 13)}</span><span class="et">${e[3]}</span><span></span></button>`).join('')}</div>` : ''}
    <span class="chips">${S.view === 'timeline' ? '' : `<button type="button" class="chip" data-act="view:timeline|cal-z:28d|cal-end:${b}">Open in Timeline →</button>`}<button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask about these days</button></span></div>`;
}
/* ---------- One panel for everything you click: a day, a page, a to-do. It opens over where you are,
   keeps a back trail, and never moves you. Only the sidebar changes the place; "Open as a full page"
   is the one deliberate jump. Phones show the same panel as a sheet. ---------- */
const PANEL_KINDS = {
  day: { label: (v) => fmtD(v, { weekday: 'short', day: 'numeric', month: 'short' }), full: 'Open in the Timeline' },
  page: { label: (v) => nameOf(v), full: 'Open the page' },
  todo: { label: (v) => { const m = INBOX.find((x) => x.id === v); return m ? 'To-do' : 'To-do'; }, full: 'Open in the Inbox' },
};
const stackTop = () => S.stack[S.stack.length - 1];
function panelBody(it, phone) {
  S._inPanel = true;
  let html = '';
  if (it.k === 'day') html = dayPanel(S.scope === 'all' ? 'kauzl' : S.scope, it.v, false).replace(/data-act="cal-d:([0-9-]+)"/g, 'data-act="pswap:$1"');
  else if (it.k === 'page') html = pageStory(S.scope, phone, it.v, true);
  else if (it.k === 'todo') html = todoPanel(it.v);
  S._inPanel = false;
  // The panel draws its own header; drop the body's own close row.
  return html.replace(/<button type="button" class="icon-btn" data-act="[^"]*(?:none|close)[^"]*"[^>]*>[\s\S]*?<\/button>/g, '');
}
function panel(phone) {
  const it = stackTop(), K = PANEL_KINDS[it.k];
  const from = Math.max(0, S.stack.length - 2);
  const trail = (from ? `<button type="button" class="linkish" data-act="pto:${from - 1}" title="${S.stack.slice(0, from).map((x) => PANEL_KINDS[x.k].label(x.v)).join(' › ')}">…</button><span class="muted">›</span>` : '') + S.stack.slice(from).map((x, j) => { const i = from + j; return (i === S.stack.length - 1 ? `<b>${PANEL_KINDS[x.k].label(x.v)}</b>` : `<button type="button" class="linkish" data-act="pto:${i}">${PANEL_KINDS[x.k].label(x.v)}</button><span class="muted">›</span>`); }).join('');
  return `<div class="pnl"><div class="pnl-h">
      ${S.stack.length > 1 ? `<button type="button" class="icon-btn" data-act="pback" aria-label="Back" title="Back">${ic('back', 14)}</button>` : ''}
      <span class="pnl-trail">${trail}</span>
      <button type="button" class="linkish pnl-open" data-act="pfull" title="${K.full}">Open ↗</button>
      <button type="button" class="icon-btn" data-act="pclear" aria-label="Close" title="Close">${ic('x', 14)}</button>
    </div><div class="pnl-b insp-in">${panelBody(it, phone)}</div></div>`;
}
// The panel that slides in beside a Story: the clicked day, or the dragged stretch.
function drawer() {
  if (S.stack.length) return `<aside class="drawer${stackTop().k === 'page' ? ' wide' : ''}" aria-label="Details">${panel(false)}</aside>`;
  if (S.view === 'search' && S.q && S.scope !== 'all') return `<aside class="drawer" aria-label="Search detail">${queryPanel(S.q)}</aside>`;
  if (S.view === 'traffic' && S.src && S.scope !== 'all') return `<aside class="drawer" aria-label="${S.src}">${sourcePanel(S.src)}</aside>`;
  if (S.view === 'pages' && S.page && S.bot) return `<aside class="drawer" aria-label="How the engines read it">${botPanel(S.page)}</aside>`;
  if (S.view === 'pages' && S.tab === 'health' && S.ix && !S.page) return `<aside class="drawer" aria-label="Indexing">${ixPanel(S.ix)}</aside>`;
  if (S.view === 'inbox' && S.todo) return `<aside class="drawer" aria-label="To-do">${todoPanel(S.todo)}</aside>`;
  if (S.view === 'journeys' && S.jleak != null && !S.jedit && S.scope !== 'all') return `<aside class="drawer" aria-label="Where people stopped">${leakPanel(S.scope, S.jleak)}</aside>`;
  if (S.view !== 'story' || S.scope === 'all') return '';
  if (S.srange) return `<aside class="drawer" aria-label="Selected days">${rangePanel(S.scope, S.srange[0], S.srange[1])}</aside>`;
  if (S.cal.day) return `<aside class="drawer" aria-label="Selected day">${dayPanel(S.scope, S.cal.day, false)}</aside>`;
  return '';
}

/* ---------- Journeys: one goal, how people get there, and where they stop ---------- */
// Steps are [kind, value, label, count]. A step is set by pasting a page link (it keeps the path) or naming an event.
const JGOALS = {
  signup: { l: 'Sign up', done: 'Signed up', steps: [['any', '', 'Landed on the site', 4210], ['page', '/pricing', 'Saw pricing', 1180], ['page', '/signup', 'Opened sign-up', 412], ['event', 'sign_up', 'Signed up', 141]] },
  install: { l: 'Install the extension', done: 'Installed', steps: [['any', '', 'Landed on the site', 4210], ['event', 'store_click', 'Clicked “Add to Chrome”', 320], ['event', 'extension_installed', 'Installed', 58]] },
};
// Where the people who stopped went instead, per step gap of the default steps.
const JLEAKS = {
  signup: [
    [['Left after one page', 58], ['Read another guide', 21], ['Went to the docs', 9], ['Went to the home page', 7], ['Somewhere else', 5]],
    [['Left from the pricing page', 61], ['Went to Kauzl vs Plausible', 14], ['Went to the docs', 12], ['Back to the home page', 8], ['Somewhere else', 5]],
    [['Left the sign-up form', 72], ['Back to pricing', 18], ['Somewhere else', 10]],
  ],
  install: [
    [['Left after one page', 63], ['Read another guide', 24], ['Somewhere else', 13]],
    [['Left the Chrome Web Store', 79], ['Came back to the site', 21]],
  ],
};
const JWHO = {
  device: [['Phone', 0.81], ['Desktop', 0.58], ['Tablet', 0.66]],
  source: [['Reddit', 0.9], ['Direct', 0.66], ['Google', 0.62], ['ChatGPT', 0.48]],
  browser: [['Safari on iPhone', 0.86], ['Chrome on Android', 0.74], ['Edge', 0.62], ['Chrome', 0.58], ['Firefox', 0.55]],
};
const JSEG = {
  source: [['Google', 2140, 0.039], ['Direct', 980, 0.028], ['ChatGPT', 310, 0.061], ['Reddit', 190, 0.011], ['Bing', 120, 0.042]],
  device: [['Desktop', 2620, 0.044], ['Phone', 1480, 0.014], ['Tablet', 110, 0.027]],
  browser: [['Chrome', 2310, 0.041], ['Safari on iPhone', 720, 0.009], ['Safari on Mac', 410, 0.038], ['Chrome on Android', 380, 0.016], ['Firefox', 260, 0.044], ['Edge', 240, 0.035], ['Arc', 95, 0.052]],
  country: [['United States', 1520, 0.041], ['India', 1010, 0.019], ['Germany', 505, 0.038], ['United Kingdom', 421, 0.036], ['Brazil', 210, 0.024]],
};
const JROUTES = [
  { path: ['Google', 'GA4 BigQuery guide', 'Pricing'], visits: 612, conv: 38 },
  { path: ['Google', 'Home', 'Pricing'], visits: 500, conv: 24 },
  { path: ['ChatGPT', 'ChatGPT traffic guide', 'Pricing'], visits: 202, conv: 19 },
  { path: ['Direct', 'Pricing'], visits: 240, conv: 17 },
  { path: ['Bing', 'GA4 MCP guide', 'Pricing'], visits: 96, conv: 6 },
  { path: ['Reddit', 'Kauzl vs Plausible'], visits: 520, conv: 2 },
  { path: ['Google', 'UTM code guide'], visits: 410, conv: 1 },
  { path: ['Direct', 'Home'], visits: 380, conv: 3 },
];
const JSUGGEST = [['page', '/pricing', 61], ['page', '/docs/quickstart', 22], ['page', '/kauzl-vs-plausible', 9], ['event', 'pricing_toggle', 31]];
const pc = (x) => `${Math.round(x * 100)}%`;
function jSteps() {
  const list = S.jsteps[S.jgoal] || JGOALS[S.jgoal].steps;
  const out = [];
  list.forEach((s, i) => {
    const n = s[3] != null ? s[3] : Math.round(out[i - 1][3] * (0.25 + rnd(i * 3.7 + s[1].length) * 0.35));
    out.push([s[0], s[1], s[2], n]);
  });
  return out;
}
const isDefault = () => !S.jsteps[S.jgoal];
const kindText = (s) => (s[0] === 'any' ? 'any page' : s[0] === 'page' ? `page ${s[1]}` : `event ${s[1]}`);
function journeysBody(scope, phone) {
  if (site(scope).wh === false) return head('Journeys', 'How people get to your goal', { phone, right: '' }) + '<p class="empty">Journeys read each visit from the BigQuery export. Connect it on the site’s settings to see them.</p>';
  if (S.jedit) return journeyEditor(phone);
  const g = JGOALS[S.jgoal], st = jSteps(), start = st[0][3], end = st[st.length - 1][3];
  const item = (act, label, on) => `<button type="button" class="row${on ? ' on' : ''}" data-act="${act}">${label}${on ? `<span class="meta">${ic('check', 13)}</span>` : ''}</button>`;
  const goalBtn = `<span class="mk-wrap"><button type="button" class="chip${S.pop === 'goal' ? ' on' : ''}" data-act="pop:goal" aria-haspopup="menu">Goal: ${g.l} ${ic('chev', 12)}</button>${S.pop === 'goal' ? `<div class="pop menu">${Object.entries(JGOALS).map(([k, x]) => item(`j-goal:${k}`, x.l, S.jgoal === k)).join('')}<hr>${item('noop', '+ New goal', false)}</div>` : ''}</span>`;
  const right = `<div class="hdctl">${goalBtn}<button type="button" class="chip" data-act="j-edit:1">Edit steps</button>${phone ? '' : rangeCtl(false)}</div>`;
  // The answer first: how many get there, and the one place most are lost.
  const gaps = st.slice(1).map((s, i) => ({ i, lost: st[i][3] - s[3], rate: 1 - s[3] / st[i][3] }));
  const worst = gaps.reduce((a, b) => (b.lost > a.lost ? b : a));
  const lastGap = gaps[gaps.length - 1];
  let answer = `<b>1 in ${Math.round(start / Math.max(1, end))}</b> visitors ${g.done === 'Signed up' ? 'sign up' : 'install'} (${(end / start * 100).toFixed(1)}%). You lose the most before “${st[worst.i + 1][2]}”: <b>${pc(worst.rate)}</b> never get there.`;
  if (S.jgoal === 'signup' && isDefault()) answer += ` Of those who open the sign-up page, <b>2 in 3</b> leave without finishing, mostly on phones since the <b>10 Nov</b> deploy.`;
  else if (lastGap.i !== worst.i) answer += ` At the last step, ${pc(lastGap.rate)} stop.`;
  const stairs = st.map((s, i) => {
    const row = `<div class="jstep"><span class="jname"><b>${s[2]}</b><span class="jkind">${kindText(s)}</span></span><span class="jbar"><i style="width:${Math.max(0.6, (s[3] / start) * 100).toFixed(1)}%"></i></span><span class="jnum"><b>${fmt(s[3])}</b><small>${i ? `${pc(s[3] / start)} of all · ${pc(s[3] / st[i - 1][3])} of the step before` : 'everyone'}</small></span></div>`;
    if (i === st.length - 1) return row;
    const lost = s[3] - st[i + 1][3], on = S.jleak === i;
    return row + `<button type="button" class="jleak${on ? ' on' : ''}" data-act="j-leak:${on ? 'none' : i}${phone ? '|pop:leak' : ''}"><span></span><span class="jlt"><b>${fmt(lost)} stopped here</b> (${pc(lost / s[3])}) <span class="jlk">${on ? 'showing where they went' : 'see where they went →'}</span></span></button>`;
  }).join('');
  const segRows = JSEG[S.jby].map(([name, visits, rate]) => {
    const avg = end / start, ratio = rate / avg;
    const steps = st.map((s, i) => (i === 0 ? 1 : Math.pow(rate / avg, i / (st.length - 1)) * (s[3] / start)));
    return `<div class="jseg"><span>${name}</span><span class="mini-f" tabindex="0" aria-label="${name}: ${st.map((x, i) => `${x[2]} ${fmt(Math.round(visits * steps[i]))}`).join(', ')}">${steps.map((v) => `<i style="height:${Math.max(6, Math.min(100, v * 100))}%"></i>`).join('')}<span class="mftip" aria-hidden="true"><b>${name}</b>${st.map((x, i) => `<span><span>${x[2]}</span><b>${fmt(Math.round(visits * steps[i]))}</b><small>${i ? pc(steps[i]) : ''}</small></span>`).join('')}</span></span><span class="num">${fmt(visits)}</span><b class="num">${(rate * 100).toFixed(1)}%</b><span class="num ${ratio >= 1.1 ? 'up' : ratio <= 0.9 ? 'down' : 'muted'}">${ratio >= 1.1 ? 'better' : ratio <= 0.9 ? 'worse' : 'average'}</span></div>`;
  }).join('');
  const compare = `<div class="card"><div class="chhead"><h4>Who gets there <span class="muted">· ${(end / start * 100).toFixed(1)}% on average</span></h4><div class="mini-seg" role="group" aria-label="Compare by">${[['source', 'Source'], ['device', 'Device'], ['browser', 'Browser'], ['country', 'Country']].map(([k, l]) => `<button type="button" class="${S.jby === k ? 'on' : ''}" data-act="j-by:${k}">${l}</button>`).join('')}</div></div><div class="jseg jhead"><span></span><span>Each step</span><span class="num">Visits</span><span class="num">Get there</span><span></span></div>${segRows}</div>`;
  const routes = [...JROUTES].map((r) => ({ ...r, rate: r.conv / r.visits })).sort((a, b) => (S.jroutes === 'best' ? b.conv - a.conv : (b.visits - b.conv * 20) - (a.visits - a.conv * 20))).slice(0, 5);
  const routeRows = routes.map((r) => `<div class="route"><span class="rpath">${r.path.map((p, i) => `<span class="rc">${p}</span>${i < r.path.length - 1 ? '<span class="sep">›</span>' : ''}`).join('')}<span class="sep">›</span><span class="rc ${r.rate >= 0.02 ? 'ok' : 'no'}">${r.rate >= 0.02 ? g.done : 'mostly left'}</span></span><span class="num">${fmt(r.visits)}</span><span class="num">${r.conv}</span><b class="num ${r.rate >= end / start ? 'up' : 'down'}">${(r.rate * 100).toFixed(1)}%</b></div>`).join('');
  const routeCard = `<div class="card"><div class="chhead"><h4>Routes <span class="muted">· where they came from › where they landed › where they went</span></h4><div class="mini-seg" role="group" aria-label="Routes">${[['best', 'Bring the most'], ['leaky', 'Lose the most']].map(([k, l]) => `<button type="button" class="${S.jroutes === k ? 'on' : ''}" data-act="j-routes:${k}">${l}</button>`).join('')}</div></div><div class="route jhead"><span></span><span class="num">Visits</span><span class="num">${g.done}</span><span class="num">Rate</span></div>${routeRows}</div>`;
  return head('Journeys', 'How people get to your goal, and where they stop', { phone, right }) +
    `<p class="dstory jans">${answer}</p><div class="card"><div class="jstairs">${stairs}</div>${isDefault() ? `<p class="jsrc">${ymlTag('funnels', phone)}<span class="muted">Steps for “${g.l}” come from the site file. Editing them here opens a pull request.</span></p>` : ''}</div>${compare}${routeCard}<p class="rawlink">Also: <button type="button" class="linkish" data-act="noop">Retention</button> · Raw data: <button type="button" class="linkish" data-act="raw:events">Events</button> · <button type="button" class="linkish" data-act="raw:sql">SQL</button></p>`;
}
function leakPanel(scope, i) {
  const st = jSteps(), a = st[i], b = st[i + 1];
  if (!a || !b) return '';
  const lost = a[3] - b[3];
  const where = (isDefault() && JLEAKS[S.jgoal][i]) || [['Left the site', 60], ['Went to another page', 30], ['Came back later', 10]];
  const bars = where.map(([l, p]) => `<div class="share" style="--c:var(--text-3)"><span class="lbl"><span>${l}</span><i style="width:${p}%"></i></span><span class="muted">${p}%</span></div>`).join('');
  const who = (k, title) => `<div class="ib"><h5>${title}</h5>${JWHO[k].map(([n, r]) => `<div class="dnum"><span>${n}</span><b class="${r > lost / a[3] + 0.05 ? 'down' : 'muted'}">${pc(r)} stop</b><span></span><span></span></div>`).join('')}</div>`;
  return `<div class="insp-in"><div class="insp-h"><b>Between “${a[2]}” and “${b[2]}”</b><button type="button" class="icon-btn" data-act="j-leak:none|close" aria-label="Close" title="Close">${ic('x', 14)}</button></div>
    <p class="dstory"><b>${fmt(lost)}</b> people (${pc(lost / a[3])}) didn’t go on.</p>
    <div class="ib"><h5>Where they went instead</h5>${bars}</div>${who('device', 'Who stops most · device')}${who('browser', 'By browser')}${who('source', 'By source')}
    <span class="chips"><button type="button" class="chip" data-act="noop">+ To-do for this step</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask why</button><button type="button" class="chip" data-act="raw:events">See these visits</button></span></div>`;
}
// Steps open as their own view (not under the funnel). Paste a link and it becomes a page step.
function journeyEditor(phone) {
  const g = JGOALS[S.jgoal], st = jSteps();
  const rows = st.map((s, i) => `<div class="estep"><span class="enum">${i + 1}</span><span class="ekind">${s[0] === 'any' ? 'Any visit' : s[0] === 'page' ? 'Page' : 'Event'}</span><span class="eval"><b>${s[2]}</b><span class="jkind">${s[0] === 'any' ? 'everyone who lands' : s[1]}</span></span>${i ? `<button type="button" class="icon-btn" data-act="j-rm:${i}" aria-label="Remove step">${ic('x', 13)}</button>` : '<span></span>'}</div>`).join('');
  const sugg = JSUGGEST.filter(([k, v]) => !st.some((s) => s[1] === v)).map(([k, v, p], i) => `<button type="button" class="chip" data-act="j-sug:${JSUGGEST.findIndex((x) => x[1] === v)}">${k === 'page' ? v : `event ${v}`} <span class="muted">${p}%</span></button>`).join('');
  return `<button type="button" class="linkish" data-act="j-edit:0">← Journeys</button>` + head(`Steps to “${g.l}”`, 'In order. People count at a step once they reach it, in the same visit.', { phone, right: '' }) +
    `<div class="card"><div class="esteps">${rows}</div>
      <label class="small2 muted" for="jpaste">Add a step</label>
      <div class="jadd"><input id="jpaste" type="text" autocomplete="off" placeholder="Paste a page link, like https://kauzl.com/pricing, or type an event, like sign_up"><button type="button" class="jbtn" data-act="j-add">Add</button></div>
      <p class="muted small2">A link becomes a page step (just its path). Use * for a group of pages, like /guides/*. Anything else is an event name.</p></div>
    ${sugg ? `<div class="ib"><h5>Often visited before ${g.done.toLowerCase()}</h5><span class="chips">${sugg}</span></div>` : ''}
    <span class="chips"><button type="button" class="jbtn primary" data-act="j-edit:0">Save steps</button>${S.jsteps[S.jgoal] ? '<button type="button" class="chip" data-act="j-reset">Back to suggested steps</button>' : ''}</span>
    <p class="muted small2">Saved in the site’s .sitelens.yml, so Claude and the MCP use the same steps.</p>`;
}

/* ---------- A page's changes: commits, title edits, cycle verdicts, and what happened after each ---------- */
// [date, kind, what, detail, effect, tone]. Commits are matched to the page by its file (content/** in .sitelens.yml).
const PAGE_HIST = {
  '/guides/ga4-bigquery-export': {
    cycle: ['4 Nov', '2 Dec', 'Improve', 14, 28],
    curve: (n, d) => 6 + n * 0.04 + (d >= '2026-10-28' ? 4 : 0) + (d >= '2026-11-12' ? 2 : 0),
    changes: [
      ['2026-11-12', 'commit', 'Added a “GA4 raw data” section', 'content/guides/ga4-bigquery-export.md · +340 words, 1 new heading', 'Early sign: “ga4 raw data” #14 → #11 in 5 days. Judge it on 3 Dec.', 'early'],
      ['2026-11-04', 'cycle', 'Content cycle: Improve', 'Strong on its main search, missing nearby ones. To-do made: “Work ga4 raw data into the page”.', 'To-do done 12 Nov.', 'muted'],
      ['2026-10-28', 'title', 'New title', '“GA4 to BigQuery: export guide” → “How to export GA4 to BigQuery (free, step by step)”', 'Click rate 2.1% → 3.4% at the same position. Clicks +41% in the 3 weeks after.', 'up'],
      ['2026-10-02', 'commit', 'Fixed broken screenshot links', 'content/guides/ga4-bigquery-export.md · images only', 'No change in search, as expected.', 'muted'],
      ['2026-09-07', 'cycle', 'Content cycle: Grow', 'Rising on its main search. Kept as is.', '', 'muted'],
    ],
  },
  '/guides/what-is-a-utm-code': {
    cycle: ['4 Nov', '2 Dec', 'Improve', 14, 28],
    curve: (n, d) => 7 + (d >= '2026-09-30' ? -2.6 : 0) - Math.max(0, n - 40) * 0.02,
    changes: [
      ['2026-11-04', 'cycle', 'Content cycle: Improve', 'Falling on “what is a utm code” since the intro was cut.', 'Nothing done yet.', 'down'],
      ['2026-09-30', 'commit', 'Shortened the intro', 'content/guides/what-is-a-utm-code.md · −420 words, removed the example table', '“what is a utm code” #4 → #10 over 4 weeks. Clicks −38%.', 'down'],
      ['2026-08-28', 'commit', 'Added a UTM builder link', 'content/guides/what-is-a-utm-code.md · +1 link', 'No clear change.', 'muted'],
    ],
  },
  '/pricing': {
    cycle: ['4 Nov', '2 Dec', 'Grow', 14, 28],
    curve: (n, d) => 0.8 + (d >= '2026-11-04' ? 1.4 : 0) + n * 0.004,
    changes: [
      ['2026-11-10', 'commit', 'Moved the sign-up button', 'app/pricing/page.tsx · button below the plan table', 'Sign-ups from this page −23% in the 3 days after, mostly on phones.', 'down'],
      ['2026-11-04', 'commit', 'New pricing page', 'app/pricing/page.tsx · rewritten', 'Visits from search +2.9×, sign-ups +14% in the 3 weeks after.', 'up'],
    ],
  },
};
const HIST_ICON = { commit: 'commit', title: 'doc', cycle: 'layers', todo: 'check' };
function pageChart(path) {
  const h = PAGE_HIST[path] || { curve: (n) => (pageSummary(path).clicks / 30) * (0.85 + n * 0.003), changes: [] };
  const ds = Array.from({ length: 91 }, (_, i) => addD(LAST, -(90 - i)));
  const vals = ds.map((d, i) => Math.max(0, h.curve(i, d) * [0.7, 1.08, 1.12, 1.1, 1.05, 0.95, 0.7][new Date(tOf(d)).getUTCDay()] * (0.9 + rnd(i * 5.3 + path.length) * 0.2)));
  const mx = niceTop(Math.max(...vals)), W = 600, H = 120, n = ds.length;
  const X = (i) => (i / (n - 1)) * W, Y = (v) => H - (v / mx) * H, P = (i) => `${((X(i) / W) * 100).toFixed(2)}%`;
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const marks = h.changes.filter((c) => ds.includes(c[0])).map((c) => `<span class="chmark" style="left:${P(ds.indexOf(c[0]))}" title="${fmtD(c[0], { day: 'numeric', month: 'short' })}: ${c[2]}">${ic(HIST_ICON[c[1]], 11)}</span><span class="hline" style="left:${P(ds.indexOf(c[0]))}"></span>`).join('');
  CH = {
    scope: S.scope, ds, rows: [], mx, phone: false, hoverOnly: true, val: (i) => vals[i],
    tip: (i) => { const c = h.changes.filter((x) => x[0] === ds[i]); return `<b>${fmtD(ds[i], { weekday: 'short', day: 'numeric', month: 'short' })}</b><span class="tr"><span>Search clicks</span><b>${Math.round(vals[i])}</b></span>${c.map((x) => `<span class="tm">${ic(HIST_ICON[x[1]], 11)} ${x[2]}</span>`).join('')}`; },
  };
  return `<div class="ichart" id="ichart" tabindex="0" role="img" aria-label="Search clicks each day for the last 90 days, with the page’s changes marked."><div class="plotwrap"><span class="ylab" style="top:0%">${Math.round(mx)}</span><div class="plot" style="height:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L${W},${H} L0,${H} Z" fill="var(--accent)" opacity=".1"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>${marks.replace(/class="chmark"[^>]*>.*?<\/span>/g, '')}<span class="chsel live" hidden></span><span class="chx" hidden></span><span class="chdot" hidden></span></div><div class="chtip" hidden></div></div><div class="chmarks">${markRow(h.changes.filter((c) => ds.includes(c[0])).map((c) => ({ x: (ds.indexOf(c[0]) / (n - 1)) * 100, icon: HIST_ICON[c[1]], label: `${fmtD(c[0], { day: 'numeric', month: 'short' })}: ${c[2]}` })), S.device === 'phone')}</div><div class="chxl"><span style="left:0%">${fmtD(ds[0], { day: 'numeric', month: 'short' })}</span><span style="left:100%">${fmtD(ds[n - 1], { day: 'numeric', month: 'short' })}</span></div></div>`;
}
function pageChanges(path, noChart) {
  const h = PAGE_HIST[path];
  if (!h) return `<div class="card"><h4>Changes</h4><p class="muted small2">No changes tracked for this page yet. Commits are matched to a page through its file: add its folder (like content/**) to the site’s .sitelens.yml.</p></div>`;
  const tone = { up: 'up', down: 'down', early: '', muted: 'muted' };
  const list = h.changes.map((c) => `<li><span class="t">${fmtD(c[0], { day: 'numeric', month: 'short' })}</span><span class="hk">${ic(HIST_ICON[c[1]], 14)}</span><span class="b"><b>${c[2]}</b><span class="muted">${c[3]}</span>${c[4] ? `<span class="${tone[c[5]]} hfx">${c[4]}</span>` : ''}</span></li>`).join('');
  return `<div class="card"><div class="chhead"><h4>Changes <span class="muted">· and what happened after each</span></h4><span class="muted small2">${noChart ? '' : 'Search clicks, last 90 days'}</span></div>${noChart ? '' : pageChart(path)}<ol class="dev hist">${list}</ol></div>`;
}

/* ---------- Content cycles: one decision per page per cycle (Grow, Improve, Cut, or too new to judge) ---------- */
// Each page keeps its own cycle card; the Content cycles tab is the board of every page's decision.
const CYCLE_NOW = { from: '4 Nov', to: '2 Dec', day: 14, of: 28 };
const CYCLES = {
  '/guides/ga4-bigquery-export': { v: 'Improve', why: 'Top 3 for its main search, but missing the searches next to it.', checks: [['Google', '#2 for its main search', 'up'], ['Bing', '#2', 'up'], ['AI answers', 'Cited by ChatGPT and Perplexity', 'up']], act: ['Work “ga4 raw data” into the page', 'Done 12 Nov · judged again 2 Dec', 'done'], hist: [['Aug', 'Grow'], ['Sep', 'Grow'], ['Oct', 'Grow'], ['Nov', 'Improve']] },
  '/guides/what-is-a-utm-code': { v: 'Improve', why: 'Slipped from #4 to #10 since the intro was cut on 30 Sep.', checks: [['Google', '#10, was #4', 'down'], ['Bing', '#6', ''], ['AI answers', 'Not cited', 'muted']], act: ['Put the example table back and update the date', 'Not started', 'open'], hist: [['Aug', 'Grow'], ['Sep', 'Grow'], ['Oct', 'Improve'], ['Nov', 'Improve']] },
  '/guides/track-chatgpt-traffic': { v: 'Grow', why: 'Rising on Google and Bing, and Perplexity cites it.', checks: [['Google', '#5, up from #9', 'up'], ['Bing', '#3', 'up'], ['AI answers', 'Cited by Perplexity', 'up']], act: ['Add a ChatGPT referral example', 'Optional', 'open'], hist: [['Sep', 'Improve'], ['Oct', 'Grow'], ['Nov', 'Grow']] },
  '/pricing': { v: 'Grow', why: 'Search visits up 2.9× since the new page on 4 Nov.', checks: [['Google', '#1 for “kauzl pricing”', 'up'], ['Bing', '#9 for “analytics for small sites”', ''], ['AI answers', 'Not asked about', 'muted']], act: ['Fix the sign-up button on phones', 'To-do open', 'open'], hist: [['Oct', 'Improve'], ['Nov', 'Grow']] },
  '/guides/google-analytics-mcp-server': { v: 'Too new', why: 'Live for 14 days. First judged on 2 Dec.', checks: [['Google', '#5 to #9, rising', ''], ['Bing', '#5', ''], ['AI answers', 'Not cited yet', 'muted']], act: ['Nothing to do yet', 'Wait for 2 Dec', 'wait'], hist: [['Nov', 'Too new']] },
  '/kauzl-vs-plausible': { v: 'Too new', why: 'Live for 3 days, already 28% of landings on its first day.', checks: [['Google', '#4 for “plausible vs kauzl”', ''], ['Bing', '#3', ''], ['AI answers', 'Not cited yet', 'muted']], act: ['Nothing to do yet', 'Wait for 2 Dec', 'wait'], hist: [['Nov', 'Too new']] },
  '/blog/launch-notes': { v: 'Cut', why: '30 visits in 90 days. No search brings it up and nothing links to it.', checks: [['Google', '#6 for “kauzl launch” (30 a month)', 'muted'], ['Bing', 'Not showing up', 'muted'], ['AI answers', 'Not cited', 'muted']], act: ['Merge into the changelog and redirect', 'Suggested', 'open'], hist: [['Sep', 'Improve'], ['Oct', 'Improve'], ['Nov', 'Cut']] },
};
const VCLS = { Grow: 'up', Improve: 'warn', Cut: 'down', 'Too new': 'muted' };
const ACT_WORD = { done: 'up', open: '', wait: 'muted' };
const histDots = (h) => `<span class="cdots" aria-label="Past cycles">${h.map(([m, v]) => `<span class="cdot ${VCLS[v]}" title="${m}: ${v}"><i></i>${m}</span>`).join('')}</span>`;
function cycleCard(path) {
  const c = CYCLES[path];
  if (!c) return '';
  return `<div class="card ccycle"><div class="cchead"><span class="cvb"><small>Content cycle · ${CYCLE_NOW.from} – ${CYCLE_NOW.to}</small><b class="${VCLS[c.v]}">${c.v}</b></span><span class="cprog"><span class="prog"><i style="width:${Math.round((CYCLE_NOW.day / CYCLE_NOW.of) * 100)}%"></i></span><small>day ${CYCLE_NOW.day} of ${CYCLE_NOW.of}</small></span></div>
    <p>${c.why}</p>
    <div class="cchecks">${c.checks.map(([k, t, cls]) => `<span><small>${k}</small><span class="${cls}">${t}</span></span>`).join('')}</div>
    <div class="cact"><span><b>This cycle:</b> ${c.act[0]}</span><span class="${ACT_WORD[c.act[2]]}">${c.act[1]}</span>${c.act[2] === 'open' ? '<button type="button" class="chip" data-act="noop">+ To-do</button>' : ''}</div>
    <div class="cfoot">${histDots(c.hist)}<button type="button" class="linkish" data-act="pg:none|tab:cycles">Every page this cycle →</button></div></div>`;
}
function cyclesBoard() {
  const cols = ['Grow', 'Improve', 'Cut', 'Too new'];
  const pages = Object.keys(CYCLES);
  const head = `<div class="cbhead"><span><b>Cycle ${CYCLE_NOW.from} – ${CYCLE_NOW.to}</b> · day ${CYCLE_NOW.day} of ${CYCLE_NOW.of} · ${pages.length} pages judged on Google, Bing and AI answers</span><span class="cprog"><span class="prog"><i style="width:${Math.round((CYCLE_NOW.day / CYCLE_NOW.of) * 100)}%"></i></span></span></div>`;
  const col = (v) => {
    const ps = pages.filter((p) => CYCLES[p].v === v);
    return `<div class="ccol"><h5><span class="${VCLS[v]}">${v}</span> · ${ps.length}</h5>${ps.map((p) => { const c = CYCLES[p]; return `<button type="button" class="ccard" data-act="pg:${p}"><b>${nameOf(p)}</b><span class="cwhy">${c.why}</span><span class="cnext"><span>${c.act[0]}</span><small class="${ACT_WORD[c.act[2]]}">${c.act[1]}</small></span>${histDots(c.hist)}</button>`; }).join('') || '<p class="empty small2">None this cycle.</p>'}</div>`;
  };
  return `${head}<div class="cboard">${cols.map(col).join('')}</div><p class="muted small2">Each page is judged once a cycle: Grow (it’s working, add to it), Improve (fix one thing), Cut (merge or redirect it), or Too new. The same card sits on each page, with its history.</p>`;
}

/* ---------- Traffic: where visits come from, and whether they're worth it ---------- */
// [name, visits, change vs before (null = new), sign-ups, revenue, cost]. Grouped by kind of source.
const TR_GROUPS = [
  ['Search', [['Google', 2140, 0.24, 82, 640], ['Bing', 120, 0.08, 5, 40], ['DuckDuckGo', 40, 0, 1, 0]]],
  ['AI answers', [['ChatGPT', 310, 0.6, 19, 160], ['Perplexity', 64, 1.4, 5, 45], ['Claude', 22, null, 2, 12]]],
  ['Communities', [['Reddit', 420, 1.2, 4, 20], ['Hacker News', 220, null, 2, 10], ['X', 180, -0.4, 1, 0]]],
  ['Direct', [['Direct', 980, 0.02, 27, 210]]],
  ['Other sites', [['github.com', 160, 0.1, 9, 70], ['producthunt.com', 74, -0.4, 0, 0]]],
  ['Email', [['Newsletter', 186, 0.12, 11, 90]]],
  ['Paid', [['Google Ads', 260, null, 6, 48, 310]]],
];
const TR_LAND = { Google: ['GA4 BigQuery guide', 'Home', 'UTM code guide'], ChatGPT: ['ChatGPT traffic guide', 'Pricing', 'Home'], Reddit: ['Kauzl vs Plausible', 'Home'], 'Google Ads': ['Pricing', 'Home'] };
// Things you put out (posts, newsletters, tagged links, ad campaigns) and what others said about you.
const OUT = [
  ['2026-11-15', 'post', 'Posted on r/analytics', '“I built a calm alternative to GA4”', 1140, 9, '8× a usual post, but few sign up', ''],
  ['2026-11-12', 'mail', 'November newsletter', 'Tagged link: newsletter / nov', 186, 11, 'Best sign-up rate this month: 5.9%', 'up'],
  ['2026-11-04', 'ad', 'Google Ads: “GA4 alternative”', '$310 spent', 260, 6, '$52 per sign-up', 'down'],
  ['2026-11-01', 'link', 'Product Hunt launch link', 'Tagged link: producthunt / launch', 74, 0, 'No sign-ups', 'down'],
  ['2026-10-21', 'post', 'Launch thread on X', '12 replies', 180, 1, 'About a usual post', ''],
];
const MENTIONS = [['2026-11-12', 'Hacker News', 'A comment recommending Kauzl in “Ask HN: GA4 alternatives?”', 220], ['2026-11-09', 'Indie Hackers newsletter', 'Listed under “tools we liked”', 60], ['2026-11-03', 'GitHub', 'Added to awesome-analytics', 40]];
const OUT_ICON = { post: 'mega', mail: 'mail', ad: 'tag', link: 'link' };
const trAll = () => TR_GROUPS.flatMap(([g, rows]) => rows.map((r) => ({ g, n: r[0], v: r[1], c: r[2], s: r[3], rev: r[4], cost: r[5] })));
function trQuality(x, avg) {
  const rate = x.s / x.v;
  if (x.cost) return [`$${Math.round(x.cost / Math.max(1, x.s))} per sign-up`, 'down'];
  if (rate >= avg * 1.3) return ['Signs up', 'up'];
  if (rate <= avg * 0.5) return ['Mostly browsing', 'muted'];
  return ['Average', ''];
}
function trSpark(name, total) {
  const ds = Array.from({ length: 28 }, (_, i) => addD(LAST, -(27 - i)));
  const known = SOURCES.some(([p]) => p === name);
  const vals = ds.map((d, i) => { const dd = day('kauzl', d); if (known) { const x = dd.sources.find((y) => y.p === name); return x ? x.share * dd.v.visits : 0; } return (total / 28) * (0.6 + rnd(i * 2.9 + name.length) * 0.8); });
  const mx = Math.max(1, ...vals);
  return `<svg class="tsp" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v, i) => `${((i / 27) * 100).toFixed(1)},${(22 - (v / mx) * 19).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
function trafficBody(scope, phone) {
  const all = trAll(), total = all.reduce((a, x) => a + x.v, 0), signups = all.reduce((a, x) => a + x.s, 0), avg = signups / total;
  const answer = `<b>${fmt(total)}</b> visits. Search brought ${pc(all.filter((x) => x.g === 'Search').reduce((a, x) => a + x.v, 0) / total)}, with Google up 24%. <b>AI answers</b> are the fastest-growing source (ChatGPT +60%, Perplexity 2.4×), and those visitors sign up about twice as often as average. Reddit brought 420 visits around the 15 Nov post, but only <b>1 in 100</b> signed up. Google Ads cost <b>$52 per sign-up</b>.`;
  // One row per kind of source; click a kind to see its sources, click a source for the full detail.
  const groups = TR_GROUPS.map(([g]) => {
    const rows = all.filter((x) => x.g === g), gv = rows.reduce((a, x) => a + x.v, 0), gs = rows.reduce((a, x) => a + x.s, 0), gcost = rows.reduce((a, x) => a + (x.cost || 0), 0);
    const known = rows.filter((x) => x.c != null), before = known.reduce((a, x) => a + x.v / (1 + x.c), 0), gc = known.length && before ? known.reduce((a, x) => a + x.v, 0) / before - 1 : null;
    const [q, qc] = trQuality({ v: gv, s: gs, cost: gcost }, avg);
    const open = S.tg === g, names = rows.length > 1 ? `${rows.slice(0, 2).map((x) => x.n).join(', ')}${rows.length > 2 ? ` +${rows.length - 2}` : ''}` : '';
    const head = `<button type="button" class="tgrow${open ? ' open' : ''}" data-act="tg:${open ? 'none' : g}" aria-expanded="${open}"><span class="tgn">${ic('fwd', 12)}<b>${g}</b><small>${names}</small></span><span class="num">${fmt(gv)}</span><span class="num ${gc == null ? 'muted' : gc >= 0.05 ? 'up' : gc <= -0.05 ? 'down' : 'muted'}">${gc == null ? 'new' : pct(gc)}</span><span class="${qc} tq">${q}</span></button>`;
    if (!open) return head;
    return head + `<div class="tgsub">${rows.map((x) => {
      const [sq, sqc] = trQuality(x, avg);
      return `<button type="button" class="trow2${S.src === x.n ? ' on' : ''}" data-act="src:${S.src === x.n ? 'none' : x.n}${phone ? '|pop:src' : ''}"><span class="tn2">${x.n}</span><span class="num">${fmt(x.v)}</span><span class="num ${x.c == null ? 'up' : x.c >= 0.05 ? 'up' : x.c <= -0.05 ? 'down' : 'muted'}">${x.c == null ? 'new' : pct(x.c)}</span><span class="${sqc} tq">${sq}</span></button>`;
    }).join('')}</div>`;
  }).join('');
  const kinds = TR_GROUPS.map(([g]) => [g, all.filter((x) => x.g === g).reduce((a, x) => a + x.v, 0), all.filter((x) => x.g === g).reduce((a, x) => a + x.s, 0)]);
  const mix = `<section class="tsec"><div class="tsh"><h3>The mix</h3><p>Where visits come from, and which kinds sign up</p></div><div class="card"><div class="mixbar">${kinds.map(([g, v, sgn], i) => `<span class="mixseg k${i}" style="flex:${v}" title="${g}: ${fmt(v)} visits, ${((sgn / v) * 100).toFixed(1)}% sign up"><b>${g}</b><small>${pc(v / total)}</small></span>`).join('')}</div><div class="mixrate">${kinds.map(([g, v, sgn], i) => `<span style="flex:${v}" class="${sgn / v >= avg * 1.3 ? 'up' : sgn / v <= avg * 0.5 ? 'down' : 'muted'}">${v / total >= 0.07 ? `${((sgn / v) * 100).toFixed(1)}%` : ''}</span>`).join('')}</div><div class="mixleg">${kinds.map(([g, v, sgn], i) => `<span class="mlrow"><i class="mixseg k${i}"></i><b>${g}</b><span class="muted">${pc(v / total)}</span><span class="${sgn / v >= avg * 1.3 ? 'up' : sgn / v <= avg * 0.5 ? 'down' : 'muted'}">${((sgn / v) * 100).toFixed(1)}% sign up</span></span>`).join('')}</div><p class="muted small2 mixnote">Second row: the share of each kind’s visitors who sign up. Average ${(avg * 100).toFixed(1)}%.</p><p class="muted small2 mixnote-p">Average sign-up rate ${(avg * 100).toFixed(1)}%.</p></div></section>`;
  const sources = mix + `<section class="tsec"><div class="tsh"><h3>By source</h3><p>Open a kind to see its sources, and a source for its detail</p></div><div class="card tcard"><div class="trow2 thead2"><span>Kind</span><span class="num">Visits</span><span class="num">Change</span><span>Worth it?</span></div>${groups}</div></section>`;
  const outRows = (S.outAll ? OUT : OUT.slice(0, 3)).map((o) => `<div class="orow"><span class="muted">${fmtD(o[0], { day: 'numeric', month: 'short' })}</span><span class="hk">${ic(OUT_ICON[o[1]], 14)}</span><span class="b"><b>${o[2]}</b><small class="muted">${o[3]}</small></span><span class="num">${fmt(o[4])}<small>visits</small></span><span class="num">${o[5]}<small>sign-ups</small></span><span class="${o[7]} ov">${o[6]}</span></div>`).join('');
  const out = `<section class="tsec"><div class="tsh"><h3>What you put out</h3><p>Posts, newsletters, links and ads, with what they brought in the 3 days after</p></div><div class="card">${outRows}<div class="cardfoot">${OUT.length > 3 ? `<button type="button" class="linkish" data-act="out">${S.outAll ? 'Show fewer' : `Show all ${OUT.length}`}</button>` : '<span></span>'}<button type="button" class="chip" data-act="noop">+ Add a post</button></div></div></section>`;
  const ment = `<section class="tsec"><div class="tsh"><h3>Who talked about you</h3><p>Mentions elsewhere, and the visits each one sent</p></div><div class="card">${MENTIONS.map((m) => `<div class="orow mrow"><span class="muted">${fmtD(m[0], { day: 'numeric', month: 'short' })}</span><span class="hk">${ic('chat', 14)}</span><span class="b"><b>${m[1]}</b><small class="muted">${m[2]}</small></span><span class="num">${fmt(m[3])}<small>visits</small></span></div>`).join('')}</div></section>`;
  return head('Traffic', `Where visits come from, and whether they’re worth it · ${site(scope).label}`, { phone }) + `<p class="dstory jans">${answer}</p>${sources}${out}${ment}`;
}
function sourcePanel(name) {
  const x = trAll().find((y) => y.n === name);
  if (!x) return '';
  const all = trAll(), avg = all.reduce((a, y) => a + y.s, 0) / all.reduce((a, y) => a + y.v, 0);
  const [q, qc] = trQuality(x, avg);
  const nums = [['Visits', fmt(x.v), x.c == null ? 'new' : pct(x.c)], ['Sign-ups', String(x.s), `${((x.s / x.v) * 100).toFixed(1)}%`], x.cost ? ['Spent', `$${fmt(x.cost)}`, `$${Math.round(x.cost / Math.max(1, x.s))} per sign-up`] : ['Revenue', `$${fmt(x.rev)}`, `$${(x.rev / x.v).toFixed(2)} a visit`]];
  const land = TR_LAND[name] || ['Home', 'Pricing'];
  const drove = OUT.filter((o) => o[2].toLowerCase().includes(name.toLowerCase().split(' ')[0]) || (name === 'Newsletter' && o[1] === 'mail') || (name === 'Google Ads' && o[1] === 'ad')).concat(MENTIONS.filter((m) => m[1] === name).map((m) => [m[0], 'mention', m[2], '', m[3]]));
  return `<div class="insp-in"><div class="insp-h"><b>${name} <span class="muted">· ${x.g}</span></b><button type="button" class="icon-btn" data-act="src:none|close" aria-label="Close">${ic('x', 14)}</button></div>
    <p class="dstory"><b class="${qc}">${q}.</b> ${fmt(x.v)} visits in 28 days, and ${x.s} sign-ups: ${((x.s / x.v) * 100).toFixed(1)}% against ${(avg * 100).toFixed(1)}% on average.</p>
    <div class="ib">${nums.map(([l, v, d]) => `<div class="dnum"><span>${l}</span><b>${v}</b><span></span><span class="muted">${d}</span></div>`).join('')}</div>
    <div class="ib"><h5>Each day</h5>${trSpark(name, x.v).replace('class="tsp"', 'class="tsp big"')}</div>
    <div class="ib"><h5>Where they land</h5>${land.map((p, i) => `<div class="dnum"><span>${p}</span><b>${fmt(Math.round(x.v * [0.46, 0.28, 0.14][i]))}</b><span></span><span></span></div>`).join('')}</div>
    ${drove.length ? `<div class="ib"><h5>What brought them</h5>${drove.map((o) => `<div class="erow" style="cursor:default"><span class="muted">${fmtD(o[0], { day: 'numeric', month: 'short' })}</span><span style="display:grid">${ic(o[1] === 'mention' ? 'chat' : OUT_ICON[o[1]], 13)}</span><span class="et">${o[2]}</span><span class="muted">${fmt(o[4])}</span></div>`).join('')}</div>` : ''}
    <span class="chips"><button type="button" class="chip" data-act="noop">+ To-do</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask about ${name}</button></span></div>`;
}

/* ---------- Goals: every number you're trying to move, whatever it comes from ---------- */
// A metric is one number a day from one source. Sources differ; the card looks the same.
const MSOURCES = [
  ['github', 'GitHub', 'Stars, forks, issues or release downloads for a repo', 'Connected'],
  ['cws', 'Chrome Web Store', 'Users and installs for an extension', 'Connected'],
  ['ga4', 'A GA4 event', 'Count any event you already send, like sign_up', 'Connected'],
  ['firebase', 'Firebase', 'Active users of an app', 'Connected'],
  ['d1', 'Your database', 'A SQL query on Cloudflare D1 that returns day and value', 'Connected'],
  ['http', 'Any URL', 'An endpoint that returns JSON; pick the number in it', 'New'],
  ['flow', 'Build it in steps', 'Call any API, then filter, group by day and count or add up, like a stream. No code', 'New'],
  ['push', 'Send it to Kauzl', 'A link your script, cron job, Zapier or GitHub Action posts a number to', 'New'],
  ['manual', 'Type it in', 'For numbers that live nowhere else, updated by hand', 'New'],
];
const MS_ICON = { github: 'commit', cws: 'tag', ga4: 'chart', firebase: 'pulse', d1: 'layers', http: 'link', flow: 'route', push: 'arrows', manual: 'doc' };
const METRICS0 = [
  { name: 'Sign-ups', src: 'ga4', from: 'event sign_up', v: 141, unit: '', chg: 0.14, target: 200, by: '30 Nov', on: ['story', 'timeline', 'alert'], up: true },
  { name: 'GitHub stars', yml: true, src: 'github', from: 'kauzl/kauzl · stars', v: 1284, unit: '', chg: 0.027, target: 1500, by: '31 Dec', on: ['story', 'timeline'], up: true },
  { name: 'Extension users', src: 'cws', from: 'Kauzl for Chrome · weekly users', v: 412, unit: '', chg: 0.12, target: null, on: ['timeline'], up: true },
  { name: 'MRR', src: 'd1', from: 'D1 · billing · SELECT day, sum(amount)…', v: 1240, unit: '$', chg: 0.08, target: 2000, by: '31 Mar', on: ['story', 'alert'], up: true },
  { name: 'App users', src: 'firebase', from: 'kauzl-mobile · daily active', v: 410, unit: '', chg: -0.03, target: null, on: [], up: true },
  { name: 'Paying customers', src: 'flow', from: 'Lemon Squeezy → filter → groupBy day → count → running total', v: 37, unit: '', chg: 0.09, target: 50, by: '31 Jan', on: ['story'], up: true },
  { name: 'Waitlist', yml: true, src: 'http', from: 'api.kauzl.com/stats → data.waitlist', v: 312, unit: '', chg: 0.21, target: 500, by: '15 Dec', on: ['timeline'], up: true },
];
const mval = (m) => `${m.unit === '$' ? '$' : ''}${fmt(m.v)}`;
function goalsBody(scope, phone) {
  if (S.madd) return metricEditor(phone);
  const ms = S.metrics || (S.metrics = METRICS0.slice());
  const spark = (m, i) => { const vals = Array.from({ length: 28 }, (_, k) => m.v * (1 - m.chg * (1 - k / 27)) * (0.94 + rnd(k * 3.3 + i) * 0.12)); const mx = Math.max(...vals), mn = Math.min(...vals); return `<svg class="tsp" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v, k) => `${((k / 27) * 100).toFixed(1)},${(23 - ((v - mn) / Math.max(1e-9, mx - mn)) * 19).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`; };
  const card = (m, i) => {
    const pctT = m.target ? Math.min(100, Math.round((m.v / m.target) * 100)) : null;
    const state = !m.target ? '' : m.chg > 0.1 ? ['On track', 'up'] : m.chg >= 0 ? ['Slow', 'warn'] : ['Behind', 'down'];
    return `<div class="mcard"><div class="mch"><span class="msrc">${ic(MS_ICON[m.src], 12)}${MSOURCES.find((x) => x[0] === m.src)[1]}</span>${m.yml ? ymlTag('metrics', phone) : m.on.includes('story') ? '<span class="mpin">On the Story</span>' : ''}</div>
      <span class="mname">${m.name}</span><span class="mval"><b>${mval(m)}</b><span class="${m.chg >= 0 ? 'up' : 'down'}">${pct(m.chg)}</span></span>${spark(m, i)}
      ${m.target ? `<span class="mt"><span class="prog"><i style="width:${pctT}%"></i></span><small>${pctT}% of ${m.unit === '$' ? '$' : ''}${fmt(m.target)} by ${m.by} · <span class="${state[1]}">${state[0]}</span></small></span>` : `<button type="button" class="linkish mset" data-act="noop">+ Set a target</button>`}
      <small class="mfrom" title="${m.from}">${m.from}</small></div>`;
  };
  const pageGoals = [['Pricing', 'Turn visitors into users', '4.1% of 6%', 68, '/pricing'], ['GA4 BigQuery guide', 'Help people who arrive', '62% of 70%', 88, '/guides/ga4-bigquery-export'], ['GA4 MCP guide', 'Bring visitors from search', '120 of 250 clicks', 48, '/guides/google-analytics-mcp-server'], ['Kauzl vs Plausible', 'Bring visitors from search', '#16, aiming for top 5', 30, '/kauzl-vs-plausible']];
  return head('Goals', `The numbers you’re trying to move · ${site(scope).label}`, { phone, right: phone ? '' : `<button type="button" class="jbtn primary" data-act="madd:1">+ Add a metric</button>` }) +
    `<section class="tsec"><div class="tsh"><h3>Your numbers</h3><p>From GA4, GitHub, the Chrome Web Store, your database, any URL, or typed in. Each one can have a target and show on the Story and Timeline.</p></div><div class="mgrid2">${ms.map(card).join('')}<button type="button" class="mcard madd" data-act="madd:1">${ic('plus', 18)}<b>Add a metric</b><small>GitHub, a store, your database, any URL…</small></button></div></section>
    <section class="tsec"><div class="tsh"><h3>Page goals</h3><p>What each page is for, set on the page itself</p></div><div class="card">${pageGoals.map(([n, g, now, w, p]) => `<button type="button" class="pgrow2" data-act="view:pages|pg:${p}"><span class="lbl"><b>${n}</b><small>${g} · ${now}</small></span><span class="prog"><i style="width:${w}%"></i></span></button>`).join('')}</div></section>
    <section class="tsec"><div class="tsh"><h3>Where people drop off</h3><p>The steps to sign-up live in Journeys</p></div><button type="button" class="linkish" data-act="view:journeys" style="align-self:start">Open Journeys →</button></section>`;
}
function metricEditor(phone) {
  const src = S.msrc, back = `<button type="button" class="linkish" data-act="${src ? 'msrc:none' : 'madd:0'}">← ${src ? 'Pick another source' : 'Goals'}</button>`;
  if (!src) return back + head('Add a metric', 'Where does the number live?', { phone, right: '' }) + `<div class="srcgrid">${MSOURCES.map(([k, n, d, st]) => `<button type="button" class="srccard" data-act="msrc:${k}"><span class="srci">${ic(MS_ICON[k], 18)}</span><b>${n}</b><small>${d}</small>${st === 'New' ? '<span class="srcnew">New</span>' : ''}</button>`).join('')}</div><p class="muted small2">Can’t find yours? If it has an API, “Build it in steps” reaches it without code. If it only lives in your own systems, “Send it to Kauzl” takes a number from anything that can make a web request. Or ask Claude: it writes the metric into the site’s .sitelens.yml.</p>`;
  if (src === 'flow') return back + head('Add a metric · Build it in steps', 'Each step works on what the one before it gave back. You see the result as you go.', { phone, right: '' }) + flowEditor(phone);
  if (src === 'push') return back + head('Add a metric · Send it to Kauzl', 'For setups no connector reaches: your own script posts the number here', { phone, right: '' }) + pushEditor(phone);
  const F = S.mform;
  const field = (id, label, value, hint = '') => `<label class="mf" for="${id}"><span>${label}</span><input id="${id}" value="${value}" autocomplete="off">${hint ? `<small>${hint}</small>` : ''}</label>`;
  const sel = (id, label, opts) => `<label class="mf" for="${id}"><span>${label}</span><select id="${id}">${opts.map((o) => `<option>${o}</option>`).join('')}</select></label>`;
  const how = {
    github: [field('mf-repo', 'Repository', 'kauzl/kauzl', 'owner/name, or paste the GitHub link'), sel('mf-what', 'What to count', ['Stars', 'Forks', 'Open issues', 'Release downloads'])],
    cws: [field('mf-ext', 'Extension', 'Kauzl for Chrome', 'Its name, ID, or the store link'), sel('mf-what', 'What to count', ['Weekly users', 'Installs', 'Rating'])],
    ga4: [sel('mf-ev', 'Event', ['sign_up', 'purchase', 'store_click', 'first_report']), sel('mf-what', 'Count', ['Times it happened', 'People who did it', 'Value (sum)'])],
    firebase: [sel('mf-app', 'App', ['kauzl-mobile']), sel('mf-what', 'What to count', ['Daily active users', 'New users', 'Crash-free users'])],
    d1: [field('mf-db', 'Database', 'billing', 'Cloudflare D1, with the token from Account'), `<label class="mf" for="mf-sql"><span>Query</span><textarea id="mf-sql" rows="3">SELECT date(created_at) AS day, sum(amount) AS value\nFROM payments WHERE created_at >= {{start}} GROUP BY 1</textarea><small>Return day and value. {{start}} and {{end}} are filled in.</small></label>`],
    http: [field('mf-url', 'URL', 'https://api.kauzl.com/stats', 'Kauzl calls it once an hour. Headers and a key can go in Account, never in the page.'), field('mf-path', 'The number in the reply', 'data.waitlist', 'Click a number in the preview to pick it')],
    manual: [field('mf-v', 'Today’s value', '860'), sel('mf-what', 'Remind me', ['Every Monday', 'Every day', 'Never'])],
  }[src];
  const preview = { github: ['1,284 stars', '+34 this month'], cws: ['412 weekly users', '+12% this month'], ga4: ['141 sign-ups', 'last 28 days'], firebase: ['410 daily users', '−3% this month'], d1: ['$1,240', '28 days, 14 rows back'], http: ['312', '{ "data": { "waitlist": 312, "invites": 40 } }'], manual: ['860', 'from you, today'] }[src];
  const name = { github: 'GitHub stars', cws: 'Extension users', ga4: 'Sign-ups', firebase: 'App users', d1: 'MRR', http: 'Waitlist', manual: 'Newsletter subscribers' }[src];
  const yml = `metrics:\n  - name: ${name}\n    source: ${src}${src === 'github' ? '\n    repo: kauzl/kauzl\n    count: stars' : src === 'http' ? '\n    url: https://api.kauzl.com/stats\n    path: data.waitlist' : ''}\n    target: { value: ${src === 'github' ? 1500 : 500}, by: 2026-12-31 }\n    show: [story, timeline]`;
  return back + head(`Add a metric · ${MSOURCES.find((x) => x[0] === src)[1]}`, 'Point at the number, check it, then say where it shows', { phone, right: '' }) +
    `<div class="card mform"><h5>1 · Where it comes from</h5>${how.join('')}
      <div class="mprev"><span class="muted small2">Kauzl reads now:</span><b>${preview[0]}</b><small class="muted">${preview[1]}</small></div></div>
    <div class="card mform"><h5>2 · What it is</h5>${field('mf-name', 'Name', name)}${sel('mf-good', 'Good when it', ['Goes up', 'Goes down'])}
      <div class="mrow3">${field('mf-target', 'Target (optional)', src === 'github' ? '1,500' : '')}${field('mf-by', 'By', '31 Dec')}</div></div>
    <div class="card mform"><h5>3 · Where it shows</h5>${[['timeline', 'A tile on the Timeline, to color days by it'], ['alert', 'An alert in the Inbox when it drops for 3 days']].map(([k, l]) => `<label class="mchk"><input type="checkbox" ${k !== 'alert' ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <span class="chips"><button type="button" class="jbtn primary" data-act="msave:${src}">Save metric</button><button type="button" class="chip" data-act="madd:0">Cancel</button></span>
    <details class="myml"><summary>Saved in the site’s .sitelens.yml as</summary><pre>${yml}</pre></details>`;
}

// No-code steps, like a Java stream: a source, then filter / map / groupBy / reduce,
// ending in one number per day, which is the line every screen draws.
// [plain label, stream op shown in mono, hint]
const FKIND = {
  get: ['Get a URL', 'source', 'Calls an API. Keys come from Account, never typed here.'],
  more: ['Get every page', 'allPages', 'Follows “next” links until there are none'],
  pick: ['Take the list', 'flatMap', 'Which part of the reply holds the items'],
  keep: ['Keep only', 'filter', 'Drop the items you don’t want'],
  map: ['Keep these fields', 'map', 'Shape each item into what you need'],
  math: ['Do math on a field', 'map', 'Cents into dollars, bytes into MB'],
  distinct: ['Remove duplicates', 'distinct', 'One item per value of a field'],
  group: ['Group by day', 'groupBy', 'Which date each item belongs to'],
  reduce: ['Turn each day into a number', 'reduce', 'What one day’s number is'],
  running: ['Running total', 'scan', 'Add each day to the ones before it'],
  avg7: ['Smooth it', 'window', 'A 7-day average, so one odd day doesn’t jump'],
};
const FLOW0 = [
  ['get', 'https://api.lemonsqueezy.com/v1/subscriptions', 'Lemon Squeezy key'],
  ['more', 'links.next'],
  ['pick', 'data'],
  ['keep', 'attributes.status', 'is', 'active'],
  ['map', 'attributes.created_at', 'attributes.total ÷ 100'],
  ['group', 'created_at', 'Day'],
  ['reduce', 'Count'],
  ['running'],
];
// What each kind hands on: [shape, peek rows]
const FOUT = {
  get: ['a reply · 50 items on page 1', ['{ "data": [ …50 ], "links": { "next": "…page[number]=2" } }']],
  more: ['3 replies · 112 items', ['page 1 · 50', 'page 2 · 50', 'page 3 · 12']],
  pick: ['112 items', ['{ id: 1201, status: "active", total: 900, created_at: "2026-10-02" }', '{ id: 1202, status: "cancelled", total: 900, created_at: "2026-10-03" }']],
  keep: ['37 items', ['{ id: 1201, status: "active", total: 900, created_at: "2026-10-02" }', '{ id: 1207, status: "active", total: 1900, created_at: "2026-10-05" }']],
  map: ['37 items · { created_at, total }', ['{ created_at: 2026-10-02, total: 9.00 }', '{ created_at: 2026-10-05, total: 19.00 }']],
  math: ['37 items · total in dollars', ['{ created_at: 2026-10-02, total: 9.00 }']],
  distinct: ['35 items', ['one per customer_id']],
  group: ['21 days that have items', ['2026-10-02 → 3 items', '2026-10-05 → 1 item']],
  reduce: ['a number per day', ['2026-10-02 → 3', '2026-10-05 → 1']],
  running: ['a number per day · adds up', ['2026-10-02 → 3', '2026-10-05 → 4', '… 2026-11-18 → 37']],
  avg7: ['a number per day · smoothed', ['2026-11-18 → 1.6']],
};
function flowStep(st, i, n) {
  const [k] = st, inp = (v, w = '') => `<input class="fin${w}" value="${v}" autocomplete="off" aria-label="${FKIND[k][0]}">`;
  const opt = (a) => `<select class="fin">${a.map((o) => `<option>${o}</option>`).join('')}</select>`;
  const body = {
    get: () => `<span class="frow">${inp(st[1], ' wide')}</span><span class="frow"><span class="muted small2">Key</span>${opt([st[2], 'None', '+ Add a key in Account'])}<span class="muted small2">Every hour</span></span>`,
    more: () => `<span class="frow"><span class="muted small2">Next link at</span>${inp(st[1])}</span>`,
    pick: () => `<span class="frow">${inp(st[1])}</span>`,
    keep: () => `<span class="frow"><span class="muted small2">where</span>${inp(st[1])}${opt([st[2], 'is not', 'contains', 'more than', 'is empty'])}${inp(st[3])}</span>`,
    map: () => `<span class="frow">${inp(st[1])}${inp(st[2])}<button type="button" class="chip" data-act="noop">+ field</button></span>`,
    math: () => `<span class="frow">${inp(st[1] || 'total')}${opt(['÷', '×', '+', '−'])}${inp(st[2] || '100', ' sm')}</span>`,
    distinct: () => `<span class="frow"><span class="muted small2">by</span>${inp(st[1] || 'customer_id')}</span>`,
    group: () => `<span class="frow"><span class="muted small2">date in</span>${inp(st[1])}<span class="muted small2">per</span>${opt([st[2], 'Week', 'Month'])}</span>`,
    reduce: () => `<span class="frow">${opt([st[1], 'Sum of a field', 'Average of a field', 'Biggest', 'Count different values', 'Last value'])}</span>`,
    running: () => '',
    avg7: () => `<span class="frow"><span class="muted small2">over</span>${opt(['7 days', '28 days'])}</span>`,
  }[k]();
  const [shape, rows] = FOUT[k], open = S.fpeek === i;
  return `<li class="fstep"><span class="fnum">${i + 1}</span><div class="fbody"><span class="fh"><b>${FKIND[k][0]}</b><code class="fop">.${FKIND[k][1]}()</code><button type="button" class="icon-btn fdel" data-act="fdel:${i}" aria-label="Remove step">${ic('x', 13)}</button></span><small class="muted">${FKIND[k][2]}</small>${body}
    <button type="button" class="fout" data-act="fpeek:${i}" aria-expanded="${open}">→ <b>${shape}</b> <span class="fpk">${open ? 'hide' : 'peek'}</span></button>${open ? `<pre class="fpeek">${rows.join('\n')}</pre>` : ''}</div></li>`;
}
// The cleaned result: a running total of paying customers, one point a day.
function flowChart() {
  const N = 48, pts = []; let v = 0;
  for (let d = 0; d < N; d++) { if (rnd(d * 7.1 + 3) < 0.42 + d / 160) v += 1 + (rnd(d * 2.3) < 0.25 ? 1 : 0); pts.push(v); }
  const sc = 37 / pts[N - 1], ys = pts.map((p) => p * sc);
  const line = ys.map((y, d) => `${((d / (N - 1)) * 300).toFixed(1)},${(84 - (y / 37) * 74).toFixed(1)}`).join(' ');
  return `<div class="fres"><span class="fres-h"><span><span class="muted small2">The line it makes</span><b>37</b><small class="up">+9% this month</small></span><span class="fok">${ic('check', 13)} One number per day · 48 days filled from the dates</span></span>
    <svg viewBox="0 0 300 90" preserveAspectRatio="none" class="fsvg" aria-label="Paying customers, last 48 days"><polygon points="0,90 ${line} 300,90" fill="var(--accent-soft)"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <span class="fax"><small>2 Oct</small><small>18 Nov</small></span></div>`;
}
function flowEditor(phone) {
  const steps = S.flow || (S.flow = FLOW0.map((x) => x.slice()));
  const adds = ['keep', 'map', 'math', 'distinct', 'group', 'reduce', 'running', 'avg7', 'more'];
  const endsDaily = steps.some((x) => x[0] === 'group') && steps.some((x) => x[0] === 'reduce');
  const code = `get("${(steps.find((x) => x[0] === 'get') || [, 'https://…'])[1]}", key: lemon_squeezy)\n` + steps.filter((x) => x[0] !== 'get').map((x) => {
    const k = x[0];
    return '  .' + ({ more: `allPages("${x[1]}")`, pick: `flatMap(r -> r.${x[1] || 'data'})`, keep: `filter(s -> s.${x[1] || 'field'} == "${x[3] || '…'}")`, map: `map(s -> { created_at: s.attributes.created_at, total: s.attributes.total / 100 })`, math: `map(s -> s.total / 100)`, distinct: `distinctBy(s -> s.customer_id)`, group: `groupBy(s -> day(s.${x[1] || 'created_at'}))`, reduce: `count()`, running: `runningTotal()`, avg7: `rollingAverage(7)` }[k]);
  }).join('\n');
  return `<div class="card mform"><h5>1 · From raw data to a line</h5>
      <div class="fstarts"><span class="muted small2">Start from</span>${['Lemon Squeezy subscriptions', 'Stripe customers', 'npm downloads', 'Discord members', 'A Google Sheet', 'Blank'].map((t, i) => `<button type="button" class="chip${i === 0 ? ' on' : ''}" data-act="noop">${t}</button>`).join('')}</div>
      <ol class="flow">${steps.map((st, i) => flowStep(st, i, steps.length)).join('')}</ol>
      <div class="fadd"><span class="muted small2">Add a step</span>${adds.map((k) => `<button type="button" class="chip" data-act="fadd:${k}">+ ${FKIND[k][0]}</button>`).join('')}</div>
      ${endsDaily ? flowChart() : `<div class="fres warn"><b>37</b><span class="muted small2">One number for today only. Add “Group by day” and “Turn each day into a number” to fill in past days from the dates.</span></div>`}
      <details class="fraw"><summary>Same steps as code</summary><pre>${code}</pre></details>
    </div>
    <div class="card mform"><h5>2 · What it is</h5><label class="mf" for="mf-name"><span>Name</span><input id="mf-name" value="Paying customers" autocomplete="off"></label>
      <div class="mrow3"><label class="mf" for="mf-target"><span>Target (optional)</span><input id="mf-target" value="50" autocomplete="off"></label><label class="mf" for="mf-by"><span>By</span><input id="mf-by" value="31 Jan" autocomplete="off"></label></div></div>
    <div class="card mform"><h5>3 · If it breaks</h5><label class="mchk"><input type="checkbox" checked> Tell me in the Inbox if it fails twice in a row</label><label class="mchk"><input type="checkbox" checked> Keep the last good numbers until it works again</label></div>
    <span class="chips"><button type="button" class="jbtn primary" data-act="msave:flow">Save metric</button><button type="button" class="chip" data-act="noop">${ic('chat', 13)} Ask Claude to build the steps</button><button type="button" class="chip" data-act="madd:0">Cancel</button></span>
    <details class="myml"><summary>Saved in the site’s .sitelens.yml as</summary><pre>metrics:
  - name: Paying customers
    source: steps
    steps:
      - get: https://api.lemonsqueezy.com/v1/subscriptions
        key: lemon_squeezy          # stored in Account
      - all_pages: links.next
      - take: data
      - filter: { field: attributes.status, is: active }
      - map: { created_at: attributes.created_at, total: attributes.total / 100 }
      - group_by: { day: created_at }
      - reduce: count
      - running_total
    target: { value: 50, by: 2027-01-31 }</pre></details>`;
}
function pushEditor(phone) {
  const t = S.pushT || 'curl', got = S.pushGot;
  const url = 'https://kauzl.com/in/m_7Hq2';
  const code = {
    curl: `curl -X POST ${url} \\
  -H "Authorization: Bearer $KAUZL_KEY" \\
  -d '{"value": 860}'`,
    action: `# .github/workflows/kauzl.yml
on: { schedule: [{ cron: "0 * * * *" }] }
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - run: |
          N=$(./count-subscribers.sh)
          curl -X POST ${url} \\
            -H "Authorization: Bearer \${{ secrets.KAUZL_KEY }}" \\
            -d "{\\"value\\": $N}"`,
    zap: `Zapier, Make or n8n: add a “Webhook / HTTP request” step
  Method   POST
  URL      ${url}
  Header   Authorization: Bearer <your key>
  Body     { "value": <the number from an earlier step> }`,
    js: `// anywhere in your backend, after a sign-up or once a day
await fetch("${url}", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.KAUZL_KEY}\` },
  body: JSON.stringify({ value: subscribers, day: "2026-11-18" }),
});`,
  }[t];
  return `<div class="card mform"><h5>1 · Your link</h5>
      <span class="pushurl"><code>${url}</code><button type="button" class="chip" data-act="noop">Copy</button></span>
      <span class="pushurl"><code>Key  kz_live_••••••••3f9a</code><button type="button" class="chip" data-act="noop">Show</button></span>
      <small class="muted">Send a number whenever you have one. Send <code>day</code> too to fill in past days. Sending the same day again replaces it.</small></div>
    <div class="card mform"><h5>2 · Send from</h5>
      <div class="seg" role="group" aria-label="Send from">${[['curl', 'Terminal'], ['action', 'GitHub Action'], ['zap', 'Zapier / Make / n8n'], ['js', 'Your code']].map(([k, l]) => `<button type="button" aria-pressed="${t === k}" data-act="pusht:${k}">${l}</button>`).join('')}</div>
      <pre class="pushcode">${code}</pre>
      <span class="pushwait ${got ? 'got' : ''}">${got ? `${ic('check', 14)} Got <b>860</b> just now. It’s on the card.` : `<span class="pdot"></span> Waiting for the first number…`}<button type="button" class="chip" data-act="pushgot">${got ? 'Send again' : 'Send a test'}</button></span></div>
    <div class="card mform"><h5>3 · What it is</h5><label class="mf" for="mf-name"><span>Name</span><input id="mf-name" value="Newsletter subscribers" autocomplete="off"></label>
      <div class="mrow3"><label class="mf" for="mf-target"><span>Target (optional)</span><input id="mf-target" value="1,000" autocomplete="off"></label><label class="mf" for="mf-by"><span>By</span><input id="mf-by" value="31 Mar" autocomplete="off"></label></div>
      <label class="mchk"><input type="checkbox" checked> Tell me if nothing arrives for 2 days</label></div>
    <span class="chips"><button type="button" class="jbtn primary" data-act="msave:push">Save metric</button><button type="button" class="chip" data-act="madd:0">Cancel</button></span>`;
}

/* ---------- Pages and their searches, as one story per page ---------- */
// Each search: [query, searches a month (Bing volume), Google position, Bing position, clicks a month].
// No position means the page doesn't show up for it yet.
const PAGE_Q = {
  '/guides/ga4-bigquery-export': { trend: 'steady', q: [['ga4 bigquery export', 2400, 2.1, 1.8, 212], ['export ga4 to bigquery', 880, 3.4, 2.9, 64], ['ga4 raw data', 1300, 14.2, 11.0, 4], ['bigquery ga4 schema', 590, 8.7, 6.1, 11], ['ga4 bigquery cost', 720, null, null, 0]], ai: 'ChatGPT and Perplexity cite it for “how to export GA4 to BigQuery”.' },
  '/pricing': { trend: 'rising', q: [['kauzl pricing', 90, 1.0, 1.0, 40], ['analytics for small sites', 1600, 11.8, 9.0, 12], ['cheap google analytics alternative', 720, null, 18.3, 1]], ai: '' },
  '/guides/google-analytics-mcp-server': { trend: 'new', q: [['ga4 mcp server', 880, 7.4, 5.2, 38], ['google analytics mcp', 1900, 9.1, 24.0, 21], ['claude google analytics', 1000, null, null, 0]], ai: 'Not cited by AI tools yet.' },
  '/kauzl-vs-plausible': { trend: 'new', q: [['plausible vs kauzl', 140, 4.0, null, 9], ['plausible alternative', 2900, 22.0, null, 2], ['plausible vs google analytics', 1300, null, null, 0]], ai: 'Gemini doesn’t mention Kauzl for “Plausible alternative” yet.' },
  '/guides/what-is-a-utm-code': { trend: 'falling', was: 4.2, q: [['what is a utm code', 6600, 9.8, 6.0, 41], ['utm parameters', 4400, 18.5, 12.0, 8], ['utm builder', 9900, null, null, 0]], ai: '' },
  '/guides/track-chatgpt-traffic': { trend: 'rising', q: [['track chatgpt traffic google analytics', 1000, 5.1, 3.2, 44], ['chatgpt referral traffic', 720, 8.4, null, 11], ['ai traffic in ga4', 590, 12.6, 9.9, 4]], ai: 'Perplexity cites it for “ChatGPT traffic in GA4”.' },
  '/': { trend: 'steady', q: [['kauzl', 320, 1.0, 1.0, 180], ['kauzl analytics', 50, 1.0, 1.0, 22]], ai: '' },
  '/blog/launch-notes': { trend: 'steady', state: 'Quiet', q: [['kauzl launch', 30, 6.0, null, 2], ['kauzl changelog', 20, null, null, 0]], ai: '' },
};
// Searches nobody's page covers yet.
const NO_PAGE = [['google analytics dashboard template', 2400], ['ga4 alerts', 880], ['search console vs ga4', 1900]];
// A plain click-rate curve by position, to size what moving up is worth (an estimate, not a forecast).
const ctrAt = (p) => (p == null ? 0 : p <= 1.5 ? 0.28 : p <= 2.5 ? 0.15 : p <= 3.5 ? 0.11 : p <= 5.5 ? 0.07 : p <= 10.5 ? 0.03 : p <= 20.5 ? 0.01 : 0.002);
// Position for the engine picked on Search (Both shows the better of the two).
const bestPos = (r) => (S.eng === 'google' ? r[2] : S.eng === 'bing' ? r[3] : r[2] == null ? r[3] : r[3] == null ? r[2] : Math.min(r[2], r[3]));
// Clicks for the engine picked (Google brings most search clicks; Bing about 1 in 7).
const clk = (r) => (S.eng === 'google' ? Math.round(r[4] * 0.86) : S.eng === 'bing' ? Math.round(r[4] * 0.14) : r[4]);
// Google and Bing disagree: one ranks it and the other doesn't, or they're 5+ places apart.
function engDiff(r) {
  const g = r[2], b = r[3];
  if (g == null && b == null) return null;
  if (b == null) return { bad: 'Bing', say: 'Not on Bing at all', why: 'Bing may not have indexed the page yet.' };
  if (g == null) return { bad: 'Google', say: 'Only on Bing', why: 'Google doesn’t rank it yet; it may need links or time.' };
  if (Math.abs(g - b) < 5) return null;
  return b > g ? { bad: 'Bing', say: `Bing #${b.toFixed(0)}, Google #${g.toFixed(0)}`, why: 'Bing ranks it much lower than Google.' } : { bad: 'Google', say: `Google #${g.toFixed(0)}, Bing #${b.toFixed(0)}`, why: 'Google ranks it much lower than Bing.' };
}
function qState(r) {
  const p = bestPos(r), gain = Math.round(r[1] * Math.max(0, ctrAt(3) - ctrAt(p)));
  if (p == null) return { k: 'none', word: 'Not showing up', gain: Math.round(r[1] * ctrAt(3)), cls: 'muted' };
  if (p <= 3.5) return { k: 'top', word: 'Top 3', gain: 0, cls: 'up' };
  if (p <= 10.5) return { k: 'p1', word: 'Page 1', gain, cls: '' };
  return { k: 'p2', word: p <= 20.5 ? 'Page 2' : 'Further back', gain, cls: 'down' };
}
function pageSummary(path) {
  const d = PAGE_Q[path];
  const rows = d.q.map((r) => ({ r, s: qState(r) }));
  const clicks = d.q.reduce((n, r) => n + r[4], 0);
  const best = [...rows].sort((a, b) => b.r[4] - a.r[4])[0];
  const chance = [...rows].filter((x) => x.s.gain > 0).sort((a, b) => b.s.gain - a.s.gain)[0];
  const ranked = rows.filter((x) => x.s.k !== 'none').length;
  const verdict = d.state ? d.state : d.trend === 'falling' ? 'Fading' : d.trend === 'new' ? 'New' : clicks >= 150 ? 'Working' : chance && chance.s.gain >= 40 ? 'Close' : 'Working';
  return { d, rows, clicks, best, chance, ranked, verdict };
}
const VERDICT_CLS = { Working: 'up', Close: '', New: 'up', Fading: 'down', Quiet: 'muted' };
function pagesList(phone) {
  // One line per page: its name, one status word, search visits, and what top 3 would add. Everything else is on the page.
  const all = Object.keys(PAGE_Q).map((p) => { const x = pageSummary(p); return { p, ...x, status: CYCLES[p] ? CYCLES[p].v : x.verdict }; });
  const words = ['Grow', 'Improve', 'Cut', 'Too new', 'Working'].filter((w) => all.some((x) => x.status === w));
  const f = words.includes(S.pfilter) ? S.pfilter : 'all';
  const list = all.filter((x) => f === 'all' || x.status === f).sort((a, b) => (S.psort === 'chance' ? (b.chance?.s.gain || 0) - (a.chance?.s.gain || 0) : b.clicks - a.clicks));
  const cls = (w) => VCLS[w] || VERDICT_CLS[w] || '';
  const chips = `<div class="chhead"><span class="chips">${[['all', `All ${all.length}`], ...words.map((w) => [w, `${w} ${all.filter((x) => x.status === w).length}`])].map(([k, l]) => `<button type="button" class="chip${f === k ? ' on' : ''}" data-act="pf:${k}">${l}</button>`).join('')}</span><div class="mini-seg" role="group" aria-label="Sort">${[['visits', 'Most visits'], ['chance', 'Biggest chance']].map(([k, l]) => `<button type="button" class="${S.psort === k ? 'on' : ''}" data-act="ps:${k}">${l}</button>`).join('')}</div></div>`;
  const rows = list.map((x) => `<button type="button" class="prow1" data-act="pg:${x.p}" title="${x.p}"><b>${nameOf(x.p)}</b><span class="${cls(x.status)}">${x.status}</span><span class="num">${fmt(x.clicks)}</span><span class="num ${x.chance && x.chance.s.gain >= 20 ? 'up' : 'muted'}">${x.chance && x.chance.s.gain >= 20 ? `+${fmt(x.chance.s.gain)}` : '—'}</span></button>`).join('');
  return `${chips}<div class="card plist"><div class="prow1 phead"><span>Page</span><span>This month</span><span class="num">Search visits</span><span class="num">In the top 3</span></div>${rows}</div><p class="muted small2">Open a page for its searches, changes and what to do. “In the top 3” is the extra visits a month if its best chance got there.</p>`;
}
/* ---------- How the engines read a page: fetched like Googlebot, with and without JavaScript, kept per version ---------- */
// Outline of the page as fetched: [tag, text, needsJs]. needsJs = only there after JavaScript runs.
const BOT_OUTLINE = [
  ['h1', 'GA4 BigQuery Export: get your raw event data', false],
  ['p', 'Google Analytics 4 can send every event to BigQuery for free. Here is how to turn it on, what lands in the tables and how to query it.', false],
  ['h2', 'Turn on the export', false],
  ['p', 'In GA4 Admin, open BigQuery links, pick a project…', false],
  ['h2', 'What lands in the events_ tables', true],
  ['p', 'One row per event, with nested event_params…', true],
  ['h2', 'GA4 raw data: query it directly', true],
  ['p', 'SELECT event_name, COUNT(*) FROM `project.analytics_123.events_*`…', true],
  ['h2', 'Questions people ask', true],
  ['p', '6 questions and answers (FAQ)', true],
];
const BOT_CHECKS = [['Title', 'GA4 BigQuery Export: get your raw event data', 'ok'], ['Description', '148 characters', 'ok'], ['Main heading', 'One H1', 'ok'], ['Canonical', 'Says …/ga4-bigquery-export; Google picked …/ga4-bigquery-export/', 'warn'], ['Robots', 'index, follow', 'ok'], ['Structured data', 'Article, FAQPage (FAQ only after JavaScript)', 'warn'], ['Links', '42 inside the site, 6 out', 'ok'], ['Blocked files', 'None: robots.txt lets bots load the CSS and JavaScript', 'ok']];
const BOT_VERSIONS = [['12 Nov', 'Added a “GA4 raw data” section', '+340 words · 1 new heading'], ['4 Nov', 'Rewrote the intro', '−60 words'], ['28 Oct', 'New title', 'Title only'], ['3 Oct', 'First fetched', '1,560 words']];
const BOT_AS = [['google', 'Googlebot (phone)'], ['bing', 'Bingbot'], ['gpt', 'GPTBot']];
function botCard(path, phone) {
  const pop = phone ? '|pop:bot' : '';
  if (path !== '/guides/ga4-bigquery-export') return `<div class="card botc"><div class="chhead"><h4>How Google and Bing read it</h4><span class="muted small2">Kauzl fetches it like Googlebot every night</span></div>
    <div class="bseen"><span><span class="ixp ok">Google</span> read the latest version on 16 Nov</span><span><span class="ixp ok">Bing</span> read it today</span></div>
    <p class="bnote">All of the text is there without JavaScript, so every crawler gets the whole page.</p>
    <div class="bact"><button type="button" class="chip" data-act="bot:view${pop}">See it as Googlebot</button><button type="button" class="chip" data-act="bot:diff${pop}">Versions</button></div></div>`;
  const raw = 210, full = 1840, mx = full;
  const bar = (label, n, cls) => `<div class="bjs"><span>${label}</span><span class="bjt"><i class="${cls}" style="width:${((n / mx) * 100).toFixed(1)}%"></i></span><b>${fmt(n)} words</b></div>`;
  const okN = BOT_CHECKS.filter((c) => c[2] === 'ok').length;
  return `<div class="card botc"><div class="chhead"><h4>How Google and Bing read it</h4><span class="muted small2">Kauzl fetches it like Googlebot every night</span></div>
    <div class="bseen"><span><span class="ixp ok">Google</span> read it on <b>14 Nov</b> and has the latest</span><span><span class="ixp warn">Bing</span> read it on <b>9 Nov</b>, before your 12 Nov change</span></div>
    ${bar('Without JavaScript', raw, 'raw')}${bar('After JavaScript', full, 'full')}
    <p class="bnote">Most of the guide only appears after JavaScript runs, including the FAQ. Google renders it, usually within a few days. Bing renders less often, and AI crawlers like GPTBot never do: they get only the first 210 words.</p>
    <div class="bact"><button type="button" class="chip" data-act="bot:view${pop}">See it as Googlebot</button><button type="button" class="chip" data-act="bot:diff${pop}">What changed on 12 Nov</button><span class="muted small2">${okN} of ${BOT_CHECKS.length} checks fine</span></div></div>`;
}
function botPanel(path) {
  const close = `<button type="button" class="icon-btn" data-act="bot:none|close" aria-label="Close">${ic('x', 14)}</button>`;
  if (S.bot === 'diff') {
    const sel = S.botV || 0, v = BOT_VERSIONS[sel], prev = BOT_VERSIONS[sel + 1];
    const lines = sel === 0 ? [['+', 'h2', 'GA4 raw data: query it directly'], ['+', 'p', 'SELECT event_name, COUNT(*) FROM `project.analytics_123.events_*`…'], ['+', 'p', 'Each row is one event; params are nested, so unnest them first.'], ['−', 'p', 'Note: the export can take up to 24 hours to start.'], ['=', 'p', '4 other sections unchanged']]
      : sel === 1 ? [['−', 'p', 'BigQuery is Google’s data warehouse, and GA4 can…'], ['+', 'p', 'Google Analytics 4 can send every event to BigQuery for free.']]
      : sel === 2 ? [['−', 'title', 'GA4 to BigQuery: a guide'], ['+', 'title', 'GA4 BigQuery Export: get your raw event data']] : [['+', 'p', 'The first version Kauzl saw']];
    return `<div class="insp-in"><div class="insp-h"><b>What changed in the page</b>${close}</div>
      <p class="dstory">Each night Kauzl keeps the text, headings and tags it read. A new version is saved only when something changed, and lands on the <b>Timeline</b> as a mark.</p>
      <ol class="bver">${BOT_VERSIONS.map(([d, t, n], i) => `<li><button type="button" class="${i === sel ? 'on' : ''}" data-act="botv:${i}"><span class="muted">${d}</span><span><b>${t}</b><small>${n}</small></span></button></li>`).join('')}</ol>
      <div class="ib"><h5>${v[0]}${prev ? ` vs ${prev[0]}` : ''}</h5><div class="bdiff">${lines.map(([op, tag, t]) => `<div class="bdl ${op === '+' ? 'add' : op === '−' ? 'del' : 'same'}"><span class="bop">${op === '=' ? '' : op}</span><span class="btag">${tag}</span><span>${t}</span></div>`).join('')}</div></div>
      <span class="chips"><button type="button" class="chip" data-act="noop">Open the commit</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Did it work?</button></span></div>`;
  }
  const raw = S.botRaw, as = S.botAs || 'google';
  const out = BOT_OUTLINE.filter((x) => !raw || !x[2]);
  const hidden = BOT_OUTLINE.filter((x) => x[2]).length;
  return `<div class="insp-in"><div class="insp-h"><b>As ${BOT_AS.find((b) => b[0] === as)[1]} reads it</b>${close}</div>
    <div class="bsw"><select class="fin" aria-label="Fetch as" data-botas="1">${BOT_AS.map(([k, l]) => `<option${k === as ? ' selected' : ''}>${l}</option>`).join('')}</select><div class="seg" role="group" aria-label="JavaScript"><button type="button" aria-pressed="${!raw}" data-act="botraw:0">After JavaScript</button><button type="button" aria-pressed="${!!raw}" data-act="botraw:1">Without</button></div></div>
    <small class="muted">${as === 'gpt' ? 'GPTBot doesn’t run JavaScript, so this is all it gets. ' : ''}Fetched today 03:12 · 200 OK · 1.2 s · 38 files loaded</small>
    <div class="bout">${out.map(([t, x, js]) => `<div class="bo ${t}${js ? ' js' : ''}"><span class="btag">${t}</span><span>${x}</span></div>`).join('')}${raw ? `<div class="bo gone"><span class="btag">…</span><span>${hidden} more blocks appear only after JavaScript</span></div>` : ''}</div>
    <div class="ib"><h5>Checks</h5>${BOT_CHECKS.map(([a, b, st]) => `<div class="bchk"><span class="${st === 'ok' ? 'up' : 'warn-t'}">${ic(st === 'ok' ? 'check' : 'bell', 13)}</span><span><b>${a}</b><small>${b}</small></span></div>`).join('')}</div></div>`;
}
/* ---------- A page's story, as one timeline: what you changed, what the engines did, what Kauzl found, then Now ---------- */
// Each moment: [date, who, what, detail, evidence, tone]. Click a moment to open its evidence under it.
// The last step is Now: the one thing to do. Other ideas fold under it. In the app this list is assembled
// from commits, title changes, search positions, index checks, content checks, cycles and to-dos.
const WHO = { visitors: ['Visitors', 'V', 'you'], you: ['You', 'A', 'you'], kauzl: ['Kauzl', 'K', 'kauzl'], google: ['Google', 'G', 'g'], bing: ['Bing', 'B', 'g'], cc: ['Claude Code', 'C', 'cc'], cursor: ['Cursor', 'Cu', 'cursor'] };
const TL = {
  '/guides/what-is-a-utm-code': {
    m: [['2026-08-28', 'you', 'Added a UTM builder link', 'No change in search.', 'changes', 'muted'],
      ['2026-09-30', 'you', 'Shortened the intro', 'Took out the first paragraph and the example table.', 'changes', ''],
      ['2026-10-28', 'google', 'Dropped it from #4 to #10', '“what is a utm code”, over four weeks. Clicks −38%. Bing kept it at #6.', 'searches', 'down'],
      ],
    now: ['Put the definition and the example table back at the top', 'Undoes the 30 Sep cut. Back at #4 is about 260 more visits a month.', 't4', '+260'],
    plan: { where: 'The opening · what-is-a-utm-code.md', was: 'Opens with the history of UTM codes; the definition is in the third paragraph.', to: 'A UTM code is a tag on a link that tells your analytics where a visit came from. Then the example table.', because: ['Shortened the intro', 'Dropped it from', 'Content check'], cells: [['If it works', '+260', 'visits a month, back at #4', 'up'], ['The work', 'Intro + 1 table', 'put back, not rewritten', ''], ['Checked', '2 weeks', 'after Google reads it', '']] },
    more: [['Name a section “UTM parameters”', '+440'], ['Link to a UTM builder, or write one', '+1,089']],
  },
  '/guides/ga4-bigquery-export': {
    m: [['2026-10-28', 'you', 'New title', '“How to export GA4 to BigQuery (free, step by step)”, replacing “GA4 to BigQuery: export guide”.', 'changes', ''],
      ['2026-11-12', 'you', 'Added a “GA4 raw data” section', '“ga4 raw data” #14 → #11 in five days.', 'searches', 'up'],
      ['2026-11-17', 'google', 'Picked a different address for it', 'Google shows the version with a trailing slash, so the page’s visits are split in two.', 'tool:index', 'warn']],
    now: ['Redirect the slash address and fix the 14 links that use it', 'Puts all of the page’s visits and rank back on one address.', null, ''],
    plan: { where: 'Its address', was: 'Two addresses: /guides/ga4-bigquery-export and …/ga4-bigquery-export/ — Google shows the second.', to: 'One address. The slash version redirects (301) to it, and the 14 links point straight at it.', because: ['Picked a different address'], cells: [['If it works', 'One address', 'visits and rank no longer split', 'up'], ['The work', '1 redirect, 14 links', 'one commit', ''], ['Checked', 'Next index check', 'tonight after it goes live', '']] },
    more: [['Render the guide on the server, so AI crawlers get more than 210 words', ''], ['Shrink the 1.4 MB screenshot at the top (3.6 s on phones)', '']],
  },
  '/guides/google-analytics-mcp-server': {
    m: [['2026-11-04', 'you', 'Published', '', 'changes', ''],
      ['2026-11-07', 'google', 'Showed it at #9 for “google analytics mcp”', 'Now #7 for “ga4 mcp server”, and climbing.', 'searches', 'up'],
      ],
    now: ['Say which assistants it works with, Claude first', 'In the lead and one heading. Nothing of yours shows up for that search yet.', null, '+110'],
    plan: { where: 'The lead · google-analytics-mcp-server.md', was: 'A Model Context Protocol server for Google Analytics 4.', to: 'Ask Claude, Cursor or ChatGPT about your GA4 data. Plus a heading: “Use it with Claude Desktop”.', because: ['Content check', 'Showed it at #9'], cells: [['If it works', '+110', 'search visits a month', 'up'], ['The work', 'Lead + 1 heading', 'two sentences', ''], ['Checked', '2 weeks', 'after Google reads it', '']] },
    more: [['Load the three videos after the text (4.4 s on phones)', ''], ['Show an “updated” date', '']],
  },
  '/pricing': {
    m: [['2026-11-04', 'you', 'New pricing page', 'Search visits up 2.9× since.', 'changes', 'up'],
      ['2026-11-14', 'kauzl', 'Nightly search check: a weak title', '“analytics for small sites”: #9 with half the clicks that spot usually gets. The search words come last and are cut off on phones.', 'searches', 'warn']],
    now: ['Approve the new title', 'Expect about 18 more visits a week once Google recrawls.', 't1', '+78'],
    plan: { where: 'The title · /pricing', was: 'Kauzl pricing: plans and prices', to: 'Simple analytics for small sites · Kauzl pricing', because: ['a weak title', 'Proposed a new title'], cells: [['If it works', '+78', 'visits a month', 'up'], ['The work', 'Approve', 'Claude Code already wrote it', ''], ['Checked', '2 weeks', 'after Google reads it', '']] },
    more: [['Fix the sign-up button on phones', ''], ['Cut “simply”, “just” and “easily” (7 times)', '']],
  },
  '/kauzl-vs-plausible': {
    m: [['2026-11-15', 'you', 'Published', '28% of landings on its first day came to it.', 'changes', 'up'],
      ['2026-11-16', 'google', 'Read it and chose not to show it yet', 'Bing hasn’t read it at all. Nothing on the site links to it.', 'tool:index', 'down']],
    now: ['Link to it from Home and Pricing, then ask both engines to look again', 'A page nothing links to is often left out.', null, ''],
    plan: { where: 'Links to /kauzl-vs-plausible', was: 'No page on the site links here.', to: 'A link from Home and from Pricing, then ask Google and Bing to read it again.', because: ['chose not to show it', 'New source'], cells: [['If it works', 'Shown', 'by Google and Bing', 'up'], ['The work', '2 links', 'and two clicks to ask', ''], ['Checked', 'Next index check', 'the night after', '']] },
    more: [['Say in the first line that we make Kauzl', ''], ['Add a side-by-side table (2,900 searches a month at #22)', '']],
  },
};
// Which Timeline kind a moment is: your edits are page changes, Google and Bing are search moves,
// Kauzl's checks are "found", and agents' work is a to-do. The same marks show on the site Timeline.
const momentKind = (w) => (w === 'you' ? 'content' : w === 'google' || w === 'bing' ? 'search' : w === 'kauzl' ? 'found' : 'todo');
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const isoAt = (at) => (/^Today/.test(at) ? LAST : /^Yesterday/.test(at) ? addD(LAST, -1) : (([d, m]) => `2026-${MON[m]}-${String(d).padStart(2, '0')}`)(at.split(' ')));
// A page's to-dos, as moments: made, proposed or changed by an agent, seen live by Kauzl.
function todoMoments(path) {
  return Object.entries(TODOS).filter(([, T]) => T.page === path).flatMap(([id, T]) => T.entries.map((e) => {
    const title = (INBOX.find((m) => m.id === id) || {}).t || 'A to-do';
    if (e.by === 'you') return [isoAt(e.at), 'you', 'Made a to-do', title, `todo:${id}`, '', 'todo'];
    if (e.auto) return [isoAt(e.at), 'kauzl', 'Saw the change go live', e.auto.split('. ').slice(1).join('. '), `todo:${id}`, '', 'todo'];
    if (e.changed) return [isoAt(e.at), e.by, T.stage === 'proposed' ? (e.changed.kind === 'title' ? 'Proposed a new title' : 'Proposed a change') : `Changed it: ${e.changed.new}`, e.changed.kind === 'title' && T.stage === 'proposed' ? `“${e.changed.new}”` : `PR ${e.changed.pr}`, `todo:${id}`, '', 'todo'];
    return null;
  }).filter(Boolean));
}
// Pages without a written timeline get one from their changes, cycle and checks.
function tlBase(path, x) {
  if (TL[path]) return TL[path];
  const h = PAGE_HIST[path], cyc = CYCLES[path], r = READS[path], ix = ixFor(path);
  const m = [
    ...(h ? h.changes.filter((c) => c[1] !== 'cycle').map((c) => [c[0], 'you', c[2], c[4] ? c[4].replace(/ Judge it on [^.]+\./, '') : '', 'changes', c[5] === 'muted' ? 'muted' : c[5] === 'down' ? 'down' : c[5] === 'up' ? 'up' : '']) : []),
  ];
  if (!m.length) m.push([LAST, 'kauzl', cyc ? `Content cycle: ${cyc.v}` : `Mostly found for “${x.best.r[0]}”`, cyc ? cyc.why : `${fmt(x.clicks)} search visits a month.`, cyc ? 'cycle' : 'searches', cyc && cyc.v === 'Grow' ? 'up' : '']);
  const now = cyc && cyc.act[2] === 'open' ? [cyc.act[0], 'This cycle’s one thing to do.', null, '']
    : x.chance && x.chance.s.gain >= 20 ? [`Work “${x.chance.r[0]}” into the page`, `${fmt(x.chance.r[1])} people search it a month.`, null, `+${fmt(x.chance.s.gain)}`]
    : ['Nothing to do right now', 'It’s doing its job. Kauzl keeps watching.', null, ''];
  return { m, now, more: [] };
}
function tlFor(path, x) {
  const b = tlBase(path, x);
  const m = [...b.m, ...runMoments(path), ...todoMoments(path), ...visitMoments(path), ...spikeMoments(path), ...extraMoments(path)].sort((p, q) => p[0].localeCompare(q[0]));
  // A check that only repeats what an earlier event on the same track already said is not news:
  // say "no change since", and let it fold with the quiet ones.
  m.forEach((mm, i) => {
    if (!mm[4].startsWith('tool:')) return;
    const key = (mm[2].match(/\d[\d.,]*\s?(?:s|%|problems?|words)?/) || [mm[2].split(': ')[1]])[0], tr = trackOf(mm[4], mm[1]);
    const prev = m.slice(0, i).reverse().find((q) => q[4] !== mm[4] && trackOf(q[4], q[1]) === tr && `${q[2]} ${q[3]}`.includes(key));
    if (prev) m[i] = [mm[0], mm[1], `${mm[2].split(': ')[0]}: no change`, `Still ${key.trim()}, as on ${fmtD(prev[0], { day: 'numeric', month: 'short' })}`, mm[4], 'muted', mm[6]];
  });
  return { ...b, m };
}
// Every written page moment is also a mark on the site Timeline (EVENTS), so both tell the same story.
// Runs once, after READS and the to-dos exist (see the call under contentSection).
function syncPageEvents() {
for (const [p, t] of Object.entries(TL)) {
  for (const [dd, w, what] of t.m) {
    const k = momentKind(w);
    const dup = EVENTS.some((e) => e[0] === 'kauzl' && e[1] === dd && (what === 'Published' ? e[2] === 'content' : e[3].toLowerCase().includes(what.toLowerCase())));
    if (!dup) EVENTS.push(['kauzl', dd, k, `${nameOf(p)}: ${what === 'Found why' || what === 'Found a gap' ? (READS[p] ? READS[p][0][1] : what) : what}`, p]);
  }
}
for (const [, e] of Object.entries(EVX)) EVENTS.push(['kauzl', e[1], e[6] === 'goal' || e[6] === 'link' || e[6] === 'ai' || e[6] === 'cycle' ? 'found' : e[6], `${nameOf(e[0])}: ${e[3]}`, e[0]]);
for (const [dd, p, t, by, fresh] of RUNS) if (by !== 'kauzl' || fresh) EVENTS.push(['kauzl', dd, 'found', `${nameOf(p)}: ${toolName(t).toLowerCase()} · ${toolSummary(t, p)}`, p]);
for (const [id, T] of Object.entries(TODOS)) {
  const m = INBOX.find((x) => x.id === id);
  if (m && m.site === 'kauzl') for (const e of T.entries) if (e.by !== 'you') EVENTS.push(['kauzl', isoAt(e.at), 'todo', `${AGENTS[e.by][0]}: ${m.t}`, T.page]);
}
for (const e of EVENTS) if (!e[4]) { const p = Object.keys(TL).find((q) => e[3].includes(nameOf(q)) || (q === '/pricing' && /pricing page/i.test(e[3]))); if (p) e.push(p); }
}
function evBody(path, phone, x, k) {
  const d = x.d, sp = SPEED.find((s) => s[0] === path), ix = ixFor(path);
  const pos = (v) => (v == null ? '<span class="muted">—</span>' : `#${v.toFixed(0)}`);
  if (k.startsWith('todo:')) return `<div class="card">${todoPanel(k.slice(5))}</div>`;
  if (k.startsWith('tool:')) return toolResult(k.slice(5), path, phone);
  if (k.startsWith('visits:')) return visitsBody(path, k.slice(7));
  if (k === 'searches') return `<div class="card"><div class="qrow qhead"><span>Search</span><span class="num">A month</span><span class="num">Google</span><span class="num">Bing</span><span class="num">Clicks</span><span>Where it stands</span></div>${[...x.rows].sort((a, b) => (b.s.gain || 0) - (a.s.gain || 0) || b.r[4] - a.r[4]).map(({ r: q, s }) => `<div class="qrow"><span class="qn">“${q[0]}”</span><span class="num">${fmt(q[1])}</span><span class="num">${pos(q[2])}</span><span class="num">${pos(q[3])}</span><span class="num">${fmt(q[4])}</span><span class="qs"><span class="${s.cls}">${s.word}</span>${s.gain ? `<small>+${fmt(s.gain)} a month in the top 3</small>` : ''}</span></div>`).join('')}</div>`;
  if (k === 'changes') return pageChanges(path, false);
  if (k === 'bots') return (ix && !ix.onPurpose ? ixNote(path, phone) : '') + botCard(path, phone);
  if (k === 'reads') return readsCard(path, phone);
  if (k === 'speed') return `<div class="card"><h4>Speed</h4>${sp ? `<p class="m0">${sp[2].toFixed(1)} s on phones, ${sp[3].toFixed(1)} s on computers. Fast is under 2.5 s.${sp[4] ? ` ${sp[4]}.` : ''}</p>` : '<p class="muted m0">Not measured for this page yet.</p>'}</div>`;
  if (k === 'ai') return `<div class="card"><h4>AI answers</h4><p class="m0">${d.ai || 'No AI answer cites it for the questions Kauzl asks.'}</p></div>`;
  if (k === 'cycle') return cycleCard(path);
  return '';
}
/* ---------- Tools: run a check on any page. A page never shows tools; it shows the runs, as moments. ---------- */
// [key, name, what it does, icon]. Results are the same views the tools always drew; only where they live changed.
const TOOLS = [
  ['content', 'Content check', 'How the page reads to people and AI answers: the answer first, the words people search, long sentences.', 'doc'],
  ['bot', 'As Googlebot and GPTBot', 'Fetch the page the way crawlers do, with and without JavaScript, and see what they get.', 'search'],
  ['index', 'Index status', 'Ask Google and Bing whether they show the page, and if not, why.', 'layers'],
  ['speed', 'Speed', 'How long real visitors wait for the page on phones and computers.', 'pulse'],
  ['ai', 'AI answers', 'Ask ChatGPT, Perplexity and Gemini your questions and see whether they cite the page.', 'chat'],
];
const toolName = (k) => TOOLS.find((t) => t[0] === k)[1];
const RAN = { content: ['a content check', 'content check'], bot: ['the Googlebot and GPTBot fetch', 'Googlebot fetch'], index: ['an index check', 'index check'], speed: ['a speed test', 'speed test'], ai: ['the AI answers check', 'AI answers check'] };
function toolSummary(k, path) {
  const r = READS[path], ix = ixFor(path), sp = SPEED.find((s) => s[0] === path), d = PAGE_Q[path] || {};
  if (k === 'content') return r ? `${r.length} ${r.length > 1 ? 'problems' : 'problem'} · worst: ${r[0][1].replace(/^./, (c) => c.toLowerCase())}` : 'Nothing to fix in the words';
  if (k === 'bot') return path === '/guides/ga4-bigquery-export' ? 'Only 210 of 1,840 words are there without JavaScript' : 'All of the text is there without JavaScript';
  if (k === 'index') return ix && !ix.onPurpose ? `${IXP[ix.k][0]}` : 'Google and Bing both show it';
  if (k === 'speed') return sp ? `${sp[2].toFixed(1)} s on phones${sp[2] > 2.5 ? ` · ${sp[4] || 'slow'}` : ' · fast'}` : 'Not measured yet';
  if (k === 'ai') return d.ai || 'No AI answer cites it yet';
  return '';
}
function toolResult(k, path, phone) {
  const x = pageSummary(path), ix = ixFor(path);
  if (k === 'content') return readsCard(path, phone);
  if (k === 'bot') return botCard(path, phone);
  if (k === 'index') return ix && !ix.onPurpose ? `<div class="card">${ixPanel(path).replace(/<button type="button" class="icon-btn" data-act="ix:none\|close"[^>]*>[\s\S]*?<\/button>/, '')}</div>` : '<div class="card"><h4>Index status</h4><p class="m0">Google and Bing both show the page. Last checked tonight.</p></div>';
  return evBody(path, phone, x, k);
}
// Runs: yours, an agent's, or Kauzl's nightly ones. Nightly runs reach a timeline only when they find something new.
// [date, page, tool, by, new?]
const RUNS = [
  ['2026-11-17', '/guides/what-is-a-utm-code', 'content', 'kauzl', true],
  ['2026-11-14', '/guides/ga4-bigquery-export', 'bot', 'you', false],
  ['2026-11-12', '/guides/google-analytics-mcp-server', 'speed', 'you', false],
  ['2026-11-17', '/guides/google-analytics-mcp-server', 'content', 'kauzl', true],
  ['2026-11-15', '/pricing', 'ai', 'you', false],
  ['2026-11-16', '/guides/what-is-a-utm-code', 'speed', 'kauzl', false],
];
const allRuns = () => [...RUNS, ...S.runs.map((r) => [r.d, r.p, r.t, 'you', false, true])];
function runMoments(path) {
  return allRuns().filter((r) => r[1] === path && (r[3] !== 'kauzl' || r[4])).map(([dd, , t, by, , fresh]) =>
    { const [hd, ...rest] = toolSummary(t, path).split(' · '), nm = RAN[t][1].replace(/^./, (c) => c.toUpperCase());
      // The title is the result; who ran it is the sender, and how is in the line under it.
      return [dd, by, `${nm}: ${hd.replace(/^worst: /, '').replace(/^(Only|All|Nothing|No|Not) /, (w) => w.toLowerCase())}`, [...rest, by === 'kauzl' ? 'found in the nightly run' : fresh ? 'you ran it just now' : 'you ran it'].join(' · '), `tool:${t}`, toolTone(t, path) || 'muted', 'found']; });
}
// Visitors, a day at a time: one line per day that has something in it, opening into each session.
// Session: [time, source, how they arrived, what they did, outcome, tone]
const VISITS = {
  '/guides/what-is-a-utm-code': [['2026-11-17', 12, '1 signed up · 3 from ChatGPT', [
    ['10:42', 'Google', '“utm parameters”', 'Read 80%, skipped the history', 'Left', ''],
    ['11:15', 'ChatGPT', 'a cited answer', 'Read to the end → Pricing', 'Signed up', 'up'],
    ['13:03', 'Google', '“what is a utm code”', 'Read 20%: the definition was too far down', 'Left in 14 s', 'down'],
    ['16:40', 'ChatGPT', 'a cited answer', 'Copied the example link', 'Left', '']]],
    ['2026-11-11', 9, 'none signed up · 6 left in under 15 s', [['09:12', 'Google', '“what is a utm code”', 'Read 15%', 'Left in 9 s', 'down'], ['15:30', 'Bing', '“utm code meaning”', 'Read 40%', 'Left', '']]]],
  '/pricing': [['2026-11-17', 18, '2 signed up · 1 from Reddit', [
    ['08:55', 'Google', '“kauzl pricing”', 'Switched to yearly', 'Signed up', 'up'],
    ['12:20', 'Reddit', 'r/analytics thread', 'Read the plans', 'Left', ''],
    ['14:05', 'Direct', '', 'Tapped Sign up twice on a phone: the button moved', 'Left', 'down'],
    ['19:48', 'Google', '“analytics for small sites”', 'Compared plans', 'Signed up', 'up']]]],
  '/guides/ga4-bigquery-export': [['2026-11-17', 61, '1 signed up · 4 from ChatGPT', [
    ['07:30', 'Google', '“ga4 bigquery export”', 'Copied the SQL', 'Left', ''],
    ['10:02', 'ChatGPT', 'a cited answer', 'Read to the end → Home', 'Signed up', 'up'],
    ['17:44', 'Google', '“ga4 raw data”', 'Read the new section', 'Left', '']]]],
  '/guides/google-analytics-mcp-server': [['2026-11-17', 21, 'none signed up · 1 from Hacker News', [
    ['11:11', 'Hacker News', 'a comment', 'Waited for the videos, then left', 'Left in 6 s', 'down'],
    ['15:20', 'Google', '“ga4 mcp server”', 'Copied the setup command', 'Left', '']]]],
  '/kauzl-vs-plausible': [['2026-11-17', 9, '28% of first visits to the site', [
    ['09:40', 'Direct', '', 'Read the comparison → Pricing', 'Left', ''],
    ['13:15', 'Reddit', 'r/analytics', 'Read 60%', 'Left', '']]]],
};
function visitMoments(path) {
  return (VISITS[path] || []).map(([dd, n, say]) => [dd, 'visitors', `${n} visitors`, say, `visits:${dd}`, /signed up/.test(say) && !/^none/.test(say) ? 'up' : /left in under/.test(say) ? 'down' : '', 'visits']);
}
function visitsBody(path, dd) {
  const day0 = (VISITS[path] || []).find((v) => v[0] === dd);
  if (!day0) return '';
  return `<div class="card sessl">${day0[3].map(([t, src, how, did, out, tone]) => `<div class="sess"><span class="muted">${t}</span><span class="sessb"><span><b>${src}</b>${how ? ` <span class="muted">· ${how}</span>` : ''}</span><span>${did} <span class="${tone}">→ ${out}</span></span></span></div>`).join('')}<p class="muted small2 m0">${day0[1] - day0[3].length} more visits that day were short and alike.</p></div>`;
}
// How each check stands on a page right now: the same tone the page's tracker uses.
function toolTone(k, path) {
  if (k === 'bot') return path === '/guides/ga4-bigquery-export' ? 'down' : 'up';
  const t = trackReading({ content: 'content', index: 'index', speed: 'speed', ai: 'ai' }[k], path)[2];
  return t === 'muted' ? '' : t;
}
function toolsBody(scope, phone) {
  const pages = Object.keys(PAGE_Q).filter((p) => p !== '/');
  const p = S.tpage, res = S.tres;
  const day = (dd) => (dd === LAST ? 'Today' : fmtD(dd, { day: 'numeric', month: 'short' }));
  const lastRun = (k) => allRuns().filter((x) => x[1] === p && x[2] === k).sort((a, b) => b[0].localeCompare(a[0]))[0];
  const dot = (t) => `<i class="cdot2 ${t === 'down' ? 'down' : t === 'up' ? 'up' : t ? 'warn' : ''}"></i>`;
  const av = (w) => `<span class="tlav a-${WHO[w][2]}">${WHO[w][1]}</span>`;
  // The checks: one list, one row each. The reading is how the page stands now; Run posts a new event.
  const rows = TOOLS.map(([k, n, d, i]) => {
    const r = lastRun(k), when = r ? `${day(r[0])} · ${r[3] === 'kauzl' ? 'nightly' : 'you'}` : 'From tonight’s data · not run by hand';
    return `<div class="dgr${res === k ? ' on' : ''}"><span class="aci">${ic(i, 14)}</span><span class="dgn"><b>${n}</b><small>${d}</small></span><span class="dgv">${dot(toolTone(k, p))}<span>${toolSummary(k, p)}</span><small>${when}</small></span><button type="button" class="chip dgrun" data-act="trun:${k}">${ic('play', 11)}Run</button></div>`;
  }).join('');
  // A run's result is an event, drawn exactly as it will sit on the page's timeline.
  const result = res ? (() => {
    const ev = `tool:${res}`, e = entryFor(p, ev, LAST), [att] = attachmentOf(p, ev, LAST);
    return `<div class="ev ev-o dgres"><div class="ev-hd">${av('you')}<span class="mm-who"><b>You</b><small>to ${nameOf(p)} · just now</small></span></div>
      <b class="mm-s">${dot(toolTone(res, p))}You ran ${RAN[res][0]}</b><p>${toolSummary(res, p)}.</p>
      ${attachmentView(e, `${att}`, LAST, p, ev)}
      <div class="ent-a"><button type="button" class="jbtn primary" data-act="ppage:${p}">See it on the page’s timeline</button>${e.actions.filter(([l]) => l !== 'Run again').map(([l, a]) => `<button type="button" class="chip" data-act="${a}">${l}</button>`).join('')}<button type="button" class="chip" data-act="tres:none">Close</button></div></div>`;
  })() : '';
  // Recent runs, as the same timeline a page uses.
  const recent = allRuns().filter((r) => r[3] !== 'kauzl' || r[4]).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const tl = `<ol class="tl dgtl">${recent.map(([dd, q, k, by]) => `<li class="tlm"><span class="tld">${day(dd)}</span><span class="tlic k-found">${ic(TOOLS.find((t) => t[0] === k)[3], 12)}</span><button type="button" class="ev ev-c" data-act="ppage:${q}"><span class="ev-l">${av(by === 'kauzl' ? 'kauzl' : 'you')}<b>${nameOf(q)}</b></span><span class="ev-s">${dot(toolTone(k, q))}<b>${by === 'kauzl' ? `Nightly ${RAN[k][1]}` : `You ran ${RAN[k][0]}`}</b><span class="muted"> — ${toolSummary(k, q)}</span></span></button></li>`).join('')}</ol>`;
  return head('Diagnose', 'Run a check on a page. Each run is posted on that page’s timeline.', { phone, right: '' }) +
    `<div class="dgpick"><span class="muted small2">Page</span><div class="seg dgseg">${pages.map((q) => `<button type="button" class="${q === p ? 'on' : ''}" data-act="tpage:${q}|tres:none">${nameOf(q)}</button>`).join('')}</div><button type="button" class="linkish small2" data-act="ppage:${p}">Open its timeline</button></div>
    ${result}
    <div class="card dgl">${rows}</div>
    <section class="tsec"><div class="tsh"><h3>Recent runs</h3><p>Yours, and nightly runs that found something new</p></div>${tl}</section>`;
}
/* ---------- A page is a tracker. Six tracks, one timeline, and every entry in one shape:
   readings (label, value, against before), findings (dot, line, note), actions. Whatever made the
   entry (an edit, Google, a tool run, visitors, an agent) it opens the same way. ---------- */
const TRACKS = [['goals', 'Goal'], ['search', 'Search'], ['content', 'Content'], ['speed', 'Speed'], ['index', 'Index'], ['ai', 'AI answers'], ['visitors', 'Visitors'], ['work', 'Your work']];
// Which track a moment belongs to.
function trackOf(ev, w) {
  if (ev.startsWith('x:')) return EVX[ev.slice(2)][5];
  if (ev.startsWith('tool:')) return { content: 'content', bot: 'index', index: 'index', speed: 'speed', ai: 'ai' }[ev.slice(5)];
  if (ev.startsWith('visits:') || ev.startsWith('spike:')) return 'visitors';
  if (ev.startsWith('todo:') || ev === 'changes') return 'work';
  if (ev === 'searches') return 'search';
  return w === 'google' || w === 'bing' ? 'search' : 'work';
}
// The tracker's header: each track's reading now, in the same cell.
function trackReading(k, path) {
  const x = pageSummary(path), r = READS[path], sp = SPEED.find((s) => s[0] === path), ix = ixFor(path), v = (VISITS[path] || [])[0], b = x.best;
  if (k === 'goals') { const g = PAGE_GOALS[path]; return g ? [`${g[2]}%`, g[1], g[2] >= 80 ? 'up' : g[2] < 50 ? 'down' : 'warn'] : ['No goal', 'set one on the page', 'muted']; }
  if (k === 'search') { const p = bestPos(b.r), fell = (TL[path] ? TL[path].m : []).some((mm) => (mm[1] === 'google' || mm[1] === 'bing') && mm[5] === 'down'); return [p ? `#${p.toFixed(0)}` : '—', `“${b.r[0]}”`, fell ? 'down' : p && p <= 3.5 ? 'up' : '']; }
  if (k === 'content') return r ? [`${r.length} ${r.length > 1 ? 'problems' : 'problem'}`, r[0][1], r[0][0] === 'high' ? 'down' : 'warn'] : ['Fine', 'nothing to fix', 'up'];
  if (k === 'speed') return sp ? [`${sp[2].toFixed(1)} s`, 'on phones', sp[2] > 4 ? 'down' : sp[2] > 2.5 ? 'warn' : 'up'] : ['—', 'not measured', ''];
  if (k === 'index') return ix && !ix.onPurpose ? [ix.g[1], `Bing: ${ix.b[1].toLowerCase()}`, ix.g[0] === 'bad' ? 'down' : 'warn'] : ['Shown', 'Google and Bing', 'up'];
  if (k === 'ai') return x.d.ai && !/not|doesn/i.test(x.d.ai) ? ['Cited', x.d.ai.split(' cite')[0], 'up'] : ['Not cited', 'by AI answers', 'muted'];
  if (k === 'visitors') return v ? [`${v[1]} today`, v[2].split(' · ')[0], /signed up/.test(v[2]) && !/^none/.test(v[2]) ? 'up' : ''] : [`${fmt(x.clicks)}`, 'search visits a month', ''];
  const T = Object.values(TODOS).find((t) => t.page === path);
  return T ? [STAGE_PILL[T.stage][0], 'a to-do', STAGE_PILL[T.stage][1]] : ['Nothing open', 'no to-do', 'muted'];
}
function trackerHead(path) {
  const on = S.ptrack;
  return `<div class="trk">${TRACKS.map(([k, l]) => { const [v, sub, tone] = trackReading(k, path); return `<button type="button" class="trkc${on === k ? ' on' : ''}" data-act="ptrack:${k}" aria-pressed="${on === k}"><small>${l}</small><b class="${tone}">${v}</b><span>${sub}</span></button>`; }).join('')}</div>`;
}
// Build one entry: { readings: [[label, value, against, tone]], findings: [[sev, text, note]], actions: [[label, act, primary]] }.
function entryFor(path, ev, dd) {
  if (ev.startsWith('x:')) { const e = EVX[ev.slice(2)]; return { readings: e[10], findings: e[11], actions: e[7] === 'down' || e[7] === 'warn' ? [['+ To-do', 'noop', true], ['Hand to Claude Code', 'noop']] : [['See this day on the Timeline', `pday:${dd}`]] }; }
  const x = pageSummary(path), d = x.d, sp = SPEED.find((s) => s[0] === path), ix = ixFor(path), r = READS[path];
  const toTodo = [['+ To-do', 'noop', true], ['Hand to Claude Code', 'noop']];
  const runAgain = (t) => ['Run again', `view:tools|tpage:${path}|trun:${t}`];
  if (ev === 'changes') {
    const c = (PAGE_HIST[path] ? PAGE_HIST[path].changes : []).find((cc) => cc[0] === dd);
    return { readings: c && /→/.test(c[4]) ? [['After the change', c[4].split('.')[0], 'in search', c[5] === 'down' ? 'down' : c[5] === 'up' ? 'up' : '']] : [], findings: c ? [['', c[3], c[1] === 'commit' ? 'from the commit' : 'title change'], ...(c[4] ? [[c[5] === 'down' ? 'high' : c[5] === 'up' ? 'ok' : '', c[4].replace(/ Judge it on [^.]+\./, ''), 'what happened after']] : [])] : [], actions: [['Open the commit', 'noop'], ['See this day on the Timeline', `pday:${dd}`]] };
  }
  if (ev === 'searches') {
    const rows = [...x.rows].sort((a, b) => b.r[1] - a.r[1]).slice(0, 4);
    const top = x.best.r;
    return { readings: [['Google', top[2] ? `#${top[2].toFixed(0)}` : '—', `“${top[0]}”`, ''], ['Bing', top[3] ? `#${top[3].toFixed(0)}` : '—', '', ''], ['Search visits', fmt(x.clicks), 'a month', '']],
      findings: rows.map(({ r: q, s }) => [s.k === 'top' ? 'ok' : s.k === 'none' ? 'mid' : s.gain ? 'low' : '', `“${q[0]}” · ${q[2] ? `#${q[2].toFixed(0)}` : 'not showing up'}`, s.gain ? `+${fmt(s.gain)} a month in the top 3` : `${fmt(q[1])} searches a month`]),
      actions: [['Open in Search', `view:search|q:${encodeURIComponent(top[0])}`]] };
  }
  if (ev.startsWith('tool:')) {
    const t = ev.slice(5);
    if (t === 'content') return { readings: [['Problems', r ? `${r.length}` : '0', '', r ? 'warn' : 'up'], ['Worst', r ? { high: 'High', mid: 'Medium', low: 'Low' }[r[0][0]] : '—', '', r && r[0][0] === 'high' ? 'down' : ''], ['At stake', READS_AT[path] ? fmt(READS_AT[path]) : '—', 'searches a month', '']],
      findings: (r || []).map(([sev, tt, , stake, , why]) => [sev, tt, `${stake} · ${why.split('. ')[0].replace(/\.$/, '')}`]), actions: [...toTodo, runAgain('content')] };
    if (t === 'bot') { const js = path === '/guides/ga4-bigquery-export'; return { readings: [['Without JavaScript', js ? '210 words' : 'All text', '', js ? 'down' : 'up'], ['After JavaScript', js ? '1,840 words' : 'Same', '', ''], ['Checks', `${BOT_CHECKS.filter((c) => c[2] === 'ok').length} of ${BOT_CHECKS.length} fine`, '', '']],
      findings: [...(js ? [['high', 'GPTBot and most AI crawlers get only the first 210 words', 'they don’t run JavaScript']] : []), ...BOT_CHECKS.filter((c) => c[2] !== 'ok').map(([a, b]) => ['mid', a, b])], actions: [...toTodo, ['See it as Googlebot', `bot:view`], runAgain('bot')] }; }
    if (t === 'index') return ix && !ix.onPurpose ? { readings: [['Google', ix.g[1], '', ix.g[0] === 'bad' ? 'down' : 'warn'], ['Bing', ix.b[1], '', ix.b[0] === 'ok' ? 'up' : 'warn'], ['Visits at stake', fmt(ix.visits), 'a month', '']],
      findings: [['high', IXP[ix.k][0], IXP[ix.k][1]], ['', ix.why, 'why'], ['ok', ix.fix, 'the fix']], actions: [...toTodo, ['Ask the engines to look again', 'noop'], runAgain('index')] }
      : { readings: [['Google', 'Shown', '', 'up'], ['Bing', 'Shown', '', 'up']], findings: [], actions: [runAgain('index')] };
    if (t === 'speed') return { readings: sp ? [['Phones', `${sp[2].toFixed(1)} s`, 'fast is under 2.5 s', sp[2] > 4 ? 'down' : sp[2] > 2.5 ? 'warn' : 'up'], ['Computers', `${sp[3].toFixed(1)} s`, '', ''], ['Visits', fmt(sp[1]), 'a month', '']] : [],
      findings: sp && sp[4] ? [[sp[2] > 2.5 ? 'mid' : 'low', sp[4], 'most of the wait']] : [], actions: sp && sp[2] > 2.5 ? [...toTodo, runAgain('speed')] : [runAgain('speed')] };
    if (t === 'ai') { const cited = d.ai && !/not|doesn/i.test(d.ai); return { readings: [['Questions asked', '2', 'from .sitelens.yml', ''], ['Cited', cited ? 'Yes' : 'No', '', cited ? 'up' : 'muted'], ['Engines', '3', 'ChatGPT, Perplexity, Gemini', '']], findings: [[cited ? 'ok' : 'low', d.ai || 'No AI answer cites the page yet', 'the latest answers']], actions: [runAgain('ai')] }; }
  }
  if (ev.startsWith('spike:')) {
    const [sd, n, u, why, src] = SPIKES[path].find((q) => q[0] === ev.slice(6));
    return { readings: [['Visits that day', `${n}`, '', 'up'], ['Usually', `${u}`, `on a ${wdName(sd)}`, ''], ['Change', `+${Math.round((n / u - 1) * 100)}%`, '', 'up']],
      findings: [['ok', why, 'why'], ...src.map(([sname, c]) => ['', `${sname} · ${c} visits`, `${Math.round((c / n) * 100)}% of the day`])], actions: [['See this day on the Timeline', `pday:${sd}`]] };
  }
  if (ev.startsWith('visits:')) {
    const v = (VISITS[path] || []).find((q) => q[0] === ev.slice(7));
    const num = (re, fb) => { const m = v[2].match(re); return m ? Number(m[1]) : fb; };
    const signed = /^none/.test(v[2]) ? 0 : num(/(\d+) signed up/, v[3].filter((s) => /Signed up/.test(s[4])).length), ai = num(/(\d+) from (?:ChatGPT|AI)/, v[3].filter((s) => /ChatGPT|Perplexity/.test(s[1])).length);
    return { readings: [['Visitors', `${v[1]}`, '', ''], ['Signed up', `${signed}`, '', signed ? 'up' : 'muted'], ['From AI answers', `${ai}`, '', '']],
      findings: v[3].map(([t, src, how, did, out, tone]) => [tone === 'up' ? 'ok' : tone === 'down' ? 'mid' : '', `${t} · ${src}${how ? ` (${how})` : ''} · ${did}`, out]), actions: [['See this day on the Timeline', `pday:${v[0]}`]] };
  }
  if (ev.startsWith('todo:')) {
    const id = ev.slice(5), T = TODOS[id], rep = [...T.entries].reverse().find((e) => e.changed);
    return { readings: [['Stage', STAGE_PILL[T.stage][0], '', STAGE_PILL[T.stage][1]], ['Expect', rep ? rep.expected.split('. ')[0].split(' within')[0] : '—', '', ''], ['Check on', rep ? rep.check : '—', '', '']],
      findings: [...(rep && rep.changed.old ? [['', `Now: ${rep.changed.old}`, 'before']] : []), ...(rep ? [['ok', `New: ${rep.changed.new}`, rep.changed.where]] : [['', T.why, 'why']])],
      actions: T.stage === 'proposed' ? [['Approve and open the PR', 'noop', true], ['Try another', 'noop']] : T.stage === 'open' ? [['Hand to Claude Code', 'noop', true], ['Other agent', 'noop']] : [['Open in the Inbox', `ptodo:${id}`]] };
  }
  return { readings: [], findings: [], actions: [] };
}
const SEV_DOT = { high: 'down', mid: 'warn', low: 'muted', ok: 'up', '': '' };
function entryHtml(e) {
  const rd = e.readings.length ? `<div class="ent-r">${e.readings.map(([l, v, a, tone]) => `<span><small>${l}</small><b class="${tone || ''}">${v}</b>${a ? `<em>${a}</em>` : ''}</span>`).join('')}</div>` : '';
  const fd = e.findings.length ? `<ul class="ent-f">${e.findings.slice(0, 4).map(([sev, t, n]) => `<li><i class="cdot2 ${SEV_DOT[sev] || ''}"></i><span>${t}${n ? `<small>${n}</small>` : ''}</span></li>`).join('')}${e.findings.length > 4 ? `<li class="muted small2">${e.findings.length - 4} more</li>` : ''}</ul>` : '';
  const ac = e.actions.length ? `<div class="ent-a">${e.actions.map(([l, a, p]) => `<button type="button" class="${p ? 'jbtn primary' : 'chip'}" data-act="${a}">${l}</button>`).join('')}</div>` : '';
  return `<div class="ent">${rd}${fd}${ac}</div>`;
}
// Spikes Kauzl spotted in a page's own visits: [date, how much, usual, why, sources].
const SPIKES = {
  '/guides/what-is-a-utm-code': [['2026-11-15', 41, 13, 'A post on r/analytics linked to it', [['Reddit', 24], ['Google', 9], ['ChatGPT', 5], ['Direct', 3]]]],
  '/pricing': [['2026-11-15', 96, 31, 'The r/analytics post sent readers on to Pricing', [['Reddit', 52], ['Google', 22], ['Direct', 14], ['ChatGPT', 8]]]],
  '/guides/ga4-bigquery-export': [['2026-10-29', 140, 88, 'The new title from 28 Oct started getting clicks', [['Google', 104], ['ChatGPT', 18], ['Bing', 12], ['Direct', 6]]]],
};
function spikeMoments(path) {
  return (SPIKES[path] || []).map(([dd, n, u, why]) => [dd, 'kauzl', `Visits spiked to ${(n / u).toFixed(1)}× usual`, `${n} visits, usually ${u}. ${why}.`, `spike:${dd}`, 'up', 'visits']);
}
// A page's daily numbers, so every attachment can show the days around its event.
function pageSeries(path, d, metric) {
  const h = PAGE_HIST[path], n = Math.round((tOf(d) - tOf(addD(LAST, -90))) / DAYMS);
  const base = h ? h.curve(n, d) : pageSummary(path).clicks / 30;
  const wk = [0.7, 1.08, 1.12, 1.1, 1.05, 0.95, 0.7][new Date(tOf(d)).getUTCDay()];
  const sp = (SPIKES[path] || []).find((s) => s[0] === d);
  const v = base * wk * (0.9 + rnd(n * 5.3 + path.length) * 0.2) * (metric === 'visits' ? 2.4 : 1);
  return sp && metric === 'visits' ? sp[1] : sp ? v * 2.2 : v;
}
function proofChart(path, ev, dd) {
  const metric = ev.startsWith('x:') ? EVX[ev.slice(2)][9] : ev.startsWith('visits:') || ev.startsWith('spike:') ? 'visits' : 'clicks';
  const end = dd >= addD(LAST, -10) ? LAST : addD(dd, 10), days = [];
  for (let d = addD(end, -27); d <= end; d = addD(d, 1)) days.push(d);
  const vals = days.map((d) => (ev === `visits:${d}` ? ((VISITS[path] || []).find((q) => q[0] === d) || [0, 0])[1] : pageSeries(path, d, metric))), mx = Math.max(...vals) * 1.15, W = 300, H = 56;
  const X = (i) => (i / (days.length - 1)) * W, Y = (v) => H - (v / mx) * H;
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const ei = days.indexOf(dd), ex = ei >= 0 ? X(ei) : null;
  const lab = (d) => fmtD(d, { day: 'numeric', month: 'short' });
  return `<div class="pf"><div class="pf-h"><small>${metric === 'visits' ? 'Visits' : 'Search clicks'} a day, 4 weeks</small>${ei >= 0 ? `<small><b>${Math.round(vals[ei])}</b> on ${lab(dd)}</small>` : ''}</div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="pf-s" role="img" aria-label="${metric} around ${lab(dd)}"><path d="${line} L${W},${H} L0,${H} Z" fill="var(--accent-soft)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${ex != null ? `<line x1="${ex}" x2="${ex}" y1="0" y2="${H}" stroke="var(--text-3)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}</svg>
    <div class="pf-x">${(() => { const f = ex != null ? ei / (days.length - 1) : -1, nearS = f >= 0 && f < 0.15, nearE = f > 0.85; return `${nearS ? '<small></small>' : `<small>${lab(days[0])}</small>`}${f >= 0 ? `<small style="left:${(f * 100).toFixed(1)}%;transform:translateX(${nearE ? '-100%' : nearS ? '0' : '-50%'})">${lab(dd)}</small>` : ''}${nearE ? '<small></small>' : `<small>${lab(end)}</small>`}`; })()}</div></div>`;
}
// Every other kind of page event, as data. Each carries its own proof, so it opens like any other event.
// Rules for what may be posted: goals reached or behind, milestones, page changes, to-do stages,
// search moves of 3+ places held 3 days, new searches with 100+ impressions, click-rate changes of 30%+,
// index changes and recrawls, visit spikes (2× or ½× usual, 20+ visits), first-time sources (10+ visits),
// AI answers starting or stopping to cite, new problems or fixes, speed crossing 2.5 s or 4 s, mentions
// and links, cycle verdicts, and checks you ran. Never ordinary days or nightly runs that found nothing.
const PAGE_GOALS = { '/pricing': ['Turn visitors into users', '4.1% of 6%', 68], '/guides/ga4-bigquery-export': ['Help people who arrive', '62% of 70% read to the end', 88], '/guides/google-analytics-mcp-server': ['Bring visitors from search', '120 of 250 clicks a month', 48], '/kauzl-vs-plausible': ['Bring visitors from search', '#16, aiming for top 5', 30] };
const EVX = {
  // UTM guide
  'utm-crawl': ['/guides/what-is-a-utm-code', '2026-10-05', 'google', 'Read the shortened intro', 'Google recrawled the page 5 days after the 30 Sep change.', 'index', 'search', '', ['Recrawl', 'Crawled 5 Oct · change made 30 Sep'], 'clicks',
    [['Changed', '30 Sep', ''], ['Google read it', '5 Oct', '5 days later'], ['Bing read it', '2 Oct', '']], [['', 'From here on, search sees the version without the example table', 'what changed for Google']]],
  'utm-ctr': ['/guides/what-is-a-utm-code', '2026-11-09', 'kauzl', 'Click rate fell to 1.4% at #9', 'Usually 3% at that position. The snippet no longer shows the definition.', 'search', 'search', 'down', ['Click rate', '1.4% at #9 · usual 3%'], 'clicks',
    [['Click rate', '1.4%', 'was 3.1% at #4', 'down'], ['Position', '#9', '“what is a utm code”', ''], ['Usual at #9', '3%', '', '']], [['mid', 'Google shows the history paragraph as the snippet', 'it quotes the opening'], ['', 'The title still promises a definition', '']]],
  'utm-link': ['/guides/what-is-a-utm-code', '2026-11-15', 'kauzl', 'Linked from r/analytics', '“Stop guessing your traffic sources” linked to the guide. 24 visits came from it that day.', 'visitors', 'link', 'up', ['The post', 'r/analytics · 24 visits'], 'visits',
    [['Visits from the post', '24', 'that day', 'up'], ['Upvotes', '212', '', ''], ['Comments', '38', '', '']], [['ok', '“Stop guessing your traffic sources”', 'r/analytics · 15 Nov'], ['', '3 of them went on to Pricing', 'what they did next']]],
  'utm-cycle': ['/guides/what-is-a-utm-code', '2026-11-04', 'kauzl', 'Content cycle: Grow → Improve', 'Three weeks of fewer visits moved it out of Grow. It needs a rewrite, not new links.', 'content', 'cycle', 'warn', ['The cycle', 'Improve · 4 Nov – 2 Dec'], 'clicks',
    [['This cycle', 'Improve', 'last cycle: Grow', 'warn'], ['Google', '#10', 'was #4', 'down'], ['AI answers', 'Not cited', '', 'muted']], [['mid', 'Put the example table back and update the date', 'this cycle’s one thing to do']]],
  // Pricing
  'pr-milestone': ['/pricing', '2026-11-08', 'kauzl', '100th sign-up that started on Pricing', 'The page has brought in 100 sign-ups since the new design on 4 Nov.', 'goals', 'goal', 'up', ['Sign-ups from Pricing', '100 since 4 Nov'], 'visits',
    [['Sign-ups', '100', 'since 4 Nov', 'up'], ['Rate', '4.4%', 'of visits', ''], ['Days', '4', '', '']], [['ok', 'The 100th came from Google, “kauzl pricing”', 'on a phone']]],
  'pr-button': ['/pricing', '2026-11-10', 'you', 'Moved the sign-up button', 'The button moved below the plan switch on phones.', 'work', 'content', '', ['The change', 'site/src/pages/pricing.astro'], 'visits',
    [['Sign-up rate after', '4.1%', 'was 4.6%', 'down'], ['On phones', '2.8%', 'was 4.2%', 'down'], ['On computers', '5.2%', 'unchanged', '']], [['mid', 'Phone visitors tap where the button used to be', 'from the sessions'], ['', 'Commit 7c2e91 · “Move CTA under plans”', 'site/src/pages/pricing.astro']]],
  'pr-goal': ['/pricing', '2026-11-12', 'kauzl', 'Goal fell behind: 4.1% sign up', 'Aiming for 6%. It slipped after the 10 Nov change, mostly on phones.', 'goals', 'goal', 'down', ['The goal', 'Turn visitors into users · 4.1% of 6%'], 'visits',
    [['Now', '4.1%', 'of visitors sign up', 'down'], ['Goal', '6%', 'by 30 Nov', ''], ['Pace', 'Behind', 'since 10 Nov', 'down']], [['mid', 'The drop is on phones only', 'computers are on pace'], ['', 'Same day as “Moved the sign-up button”', '10 Nov']]],
  'pr-speed': ['/pricing', '2026-11-16', 'kauzl', 'Got slower on phones: 2.6 s', 'Crossed 2.5 s, the line for fast. The plan switch shifts the page as it loads.', 'speed', 'found', 'warn', ['Speed', '2.6 s on phones · was 2.2 s'], null,
    [['Phones', '2.6 s', 'was 2.2 s', 'warn'], ['Computers', '1.4 s', '', ''], ['Fast is under', '2.5 s', '', '']], [['mid', 'The plan switch shifts the page as it loads', 'most of the wait']]],
  // GA4 BigQuery guide
  'ga-ai': ['/guides/ga4-bigquery-export', '2026-11-03', 'kauzl', 'Perplexity started citing it', 'For “how to export GA4 to BigQuery”. ChatGPT already did.', 'ai', 'ai', 'up', ['The answer', 'Perplexity · “how to export GA4 to BigQuery”'], 'visits',
    [['Cited by', '2 engines', 'ChatGPT, Perplexity', 'up'], ['Questions', '1 of 2', 'from .sitelens.yml', ''], ['AI visits', '+40%', 'the week after', 'up']], [['ok', '“…the GA4 BigQuery export guide on kauzl.com walks through the setup…”', 'Perplexity, 3 Nov']]],
  'ga-ctr': ['/guides/ga4-bigquery-export', '2026-11-05', 'kauzl', 'Click rate up: 2.1% → 3.4% at #2', 'Same position, more clicks, since the new title on 28 Oct.', 'search', 'search', 'up', ['Click rate', '3.4% at #2 · was 2.1%'], 'clicks',
    [['Click rate', '3.4%', 'was 2.1%', 'up'], ['Position', '#2', 'unchanged', ''], ['Clicks', '+41%', '3 weeks after', 'up']], [['ok', 'The new title names the search: “How to export GA4 to BigQuery”', '28 Oct']]],
  'ga-fixed': ['/guides/ga4-bigquery-export', '2026-11-13', 'kauzl', 'Problem fixed: “raw data” is now in a heading', 'The nightly content check no longer finds it.', 'content', 'found', 'up', ['Content check', '1 problem fixed · 1 left'], 'clicks',
    [['Fixed', '1', '', 'up'], ['Left', '1', 'FAQ answers start with “It”', ''], ['Fixed by', 'You', '12 Nov', '']], [['ok', 'Never said “raw data” in a heading', 'fixed 12 Nov']]],
  'ga-newq': ['/guides/ga4-bigquery-export', '2026-11-14', 'google', 'New search: “ga4 raw data”', 'Shows at #11 for a search with 1,300 a month, two days after the new section.', 'search', 'search', 'up', ['The search', '“ga4 raw data” · #11 · 1,300 a month'], 'clicks',
    [['Position', '#11', 'was not showing', 'up'], ['Searches', '1,300', 'a month', ''], ['In the top 3', '+180', 'a month', 'up']], [['ok', 'Came from the “GA4 raw data” section', '12 Nov']]],
  'ga-goal': ['/guides/ga4-bigquery-export', '2026-11-15', 'kauzl', 'Goal back on track: 62% read to the end', 'Aiming for 70%. The new section kept readers going.', 'goals', 'goal', 'up', ['The goal', 'Help people who arrive · 62% of 70%'], 'visits',
    [['Now', '62%', 'read to the end', 'up'], ['Goal', '70%', 'by 31 Dec', ''], ['Pace', 'On track', 'since 15 Nov', 'up']], [['ok', 'Readers who reach “GA4 raw data” finish the guide', 'from scroll depth']]],
  // GA4 MCP guide
  'mcp-speed': ['/guides/google-analytics-mcp-server', '2026-11-10', 'kauzl', 'Slow on phones: 4.4 s', 'Crossed 4 s. Three videos load before the text.', 'speed', 'found', 'down', ['Speed', '4.4 s on phones'], null,
    [['Phones', '4.4 s', 'slow is over 4 s', 'down'], ['Computers', '2.3 s', '', ''], ['Left before it loaded', '31%', 'of phone visits', 'down']], [['high', 'Three videos load before the text', 'most of the wait']]],
  'mcp-link': ['/guides/google-analytics-mcp-server', '2026-11-12', 'kauzl', 'Linked from Hacker News', 'A comment in “Ask HN: analytics for side projects” linked here.', 'visitors', 'link', 'up', ['The comment', 'Hacker News · 58 visits'], 'visits',
    [['Visits', '58', 'from the comment', 'up'], ['Read to the end', '22%', '', ''], ['Signed up', '1', '', 'up']], [['ok', '“Ask HN: analytics for side projects”', 'news.ycombinator.com · 12 Nov']]],
  'mcp-half': ['/guides/google-analytics-mcp-server', '2026-11-16', 'kauzl', 'Halfway to its goal', '120 of 250 search clicks a month, 12 days after publishing.', 'goals', 'goal', '', ['The goal', 'Bring visitors from search · 120 of 250'], 'clicks',
    [['Now', '120', 'clicks a month', ''], ['Goal', '250', 'by 31 Dec', ''], ['Pace', 'On track', '', 'up']], [['', 'Most from “ga4 mcp server” (#7)', '']]],
  // Kauzl vs Plausible
  'vs-source': ['/kauzl-vs-plausible', '2026-11-16', 'kauzl', 'New source: Bing', 'First visits from Bing, though Bing hasn’t indexed the page yet: they came through Bing Copilot.', 'visitors', 'link', 'up', ['The source', 'Bing Copilot · 12 visits'], 'visits',
    [['Visits', '12', 'first ever', 'up'], ['From', 'Copilot', 'in Bing', ''], ['Went to Pricing', '3', '', 'up']], [['ok', 'Copilot cites the page for “plausible vs kauzl”', '16 Nov']]],
};
function extraMoments(path) {
  return Object.entries(EVX).filter(([, e]) => e[0] === path).map(([id, e]) => [e[1], e[2], e[3], e[4], `x:${id}`, e[7], e[6]]);
}
// What actually changed in the page, as a diff: `${path}|${date}` → { where, src, lines: [[op, text]] }.
// op: '-' removed, '+' added, ' ' kept for context, '…' skipped lines. In the app this comes from the commit
// (GitHub, files matched by content/** in .sitelens.yml) or from the title Google last read.
const DIFFS = {
  '/guides/what-is-a-utm-code|2026-09-30': { where: 'content/guides/what-is-a-utm-code.md', src: 'commit 4e1a9c2', lines: [
    [' ', '# What is a UTM code?'],
    ['-', 'A UTM code is a tag on a link that tells your analytics where a visit came from.'],
    ['-', '| Tag | Example | What it says |'],
    ['-', '| utm_source | newsletter | who sent the visit |'],
    ['…', '4 more table rows removed'],
    [' ', 'UTM codes began at Urchin, a web analytics company Google bought in 2005…']] },
  '/guides/what-is-a-utm-code|2026-08-28': { where: 'content/guides/what-is-a-utm-code.md', src: 'commit 91b03fe', lines: [
    [' ', '## How to make one'],
    ['+', 'Or skip the typing: [build a UTM link](/tools/utm-builder).']] },
  '/guides/ga4-bigquery-export|2026-10-28': { prose: true, where: 'The title', src: 'as Google read it on 30 Oct', lines: [
    ['-', 'GA4 to BigQuery: export guide'],
    ['+', 'How to export GA4 to BigQuery (free, step by step)']] },
  '/guides/ga4-bigquery-export|2026-11-12': { where: 'content/guides/ga4-bigquery-export.md', src: 'commit c7d2e10', lines: [
    [' ', '## Schedule the export'],
    ['+', '## GA4 raw data: what lands in BigQuery'],
    ['+', 'Every event arrives as one row, with its parameters nested inside it…'],
    ['…', '+340 words in all']] },
  '/guides/google-analytics-mcp-server|2026-11-04': { where: 'content/guides/google-analytics-mcp-server.md', src: 'new file', lines: [
    ['+', '# A GA4 MCP server'],
    ['+', 'A Model Context Protocol server for Google Analytics 4.'],
    ['…', '1,240 words, 6 headings, 3 videos']] },
  '/pricing|2026-11-04': { where: 'app/pricing/page.tsx', src: 'commit 0a8f4d1', lines: [
    ['-', '<h1>Plans for every team</h1>'],
    ['+', '<h1>Simple analytics, one price</h1>'],
    ['+', '<PlanTable plans={plans} />'],
    ['…', 'page rewritten · 212 lines']] },
  '/pricing|2026-11-10': { where: 'app/pricing/page.tsx', src: 'commit 5be27a3', lines: [
    ['-', '<SignUpButton />'],
    [' ', '<PlanSwitch />'],
    [' ', '<PlanTable plans={plans} />'],
    ['+', '<SignUpButton />']] },
};
// Only "page changed" events carry a diff: commits, title changes, and work events.
const diffFor = (path, ev, dd) => (ev === 'changes' || (ev.startsWith('x:') && EVX[ev.slice(2)][5] === 'work') ? DIFFS[`${path}|${dd}`] : null);
const escH = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const diffCount = (d) => [d.lines.filter((l) => l[0] === '+').length, d.lines.filter((l) => l[0] === '-').length];
// One diff block for the whole flow: the proposal (Now), the change (page changed event), the same look.
function diffView(d, label) {
  const [a, r] = diffCount(d);
  return `<div class="dif${d.prose ? ' dif-p' : ''}"><div class="dif-h">${ic('doc', 12)}<b>${d.where}</b><span>${label || d.src}</span><em><i class="up">+${a}</i> <i class="down">−${r}</i></em></div>${d.lines.map(([op, t]) => `<div class="dl ${op === '+' ? 'dl-a' : op === '-' ? 'dl-d' : op === '…' ? 'dl-s' : ''}"><i>${op === '…' ? '⋯' : op === ' ' ? '' : op === '-' ? '−' : '+'}</i><code>${escH(t)}</code></div>`).join('')}</div>`;
}
// The evidence a message carries, named like an attachment: [title, what's in it].
function attachmentOf(path, ev, dd) {
  if (ev.startsWith('x:')) return EVX[ev.slice(2)][8];
  if (ev === 'changes') { const c = (PAGE_HIST[path] ? PAGE_HIST[path].changes : []).find((cc) => cc[0] === dd); return ['The change', c ? c[3].split(' · ')[0] : 'What changed in the page']; }
  if (ev.startsWith('spike:')) { const sp = SPIKES[path].find((q) => q[0] === ev.slice(6)); return ['Visits that day', `${sp[1]} visits, usually ${sp[2]} · by source`]; }
  if (ev === 'searches') return ['Search positions', `${pageSummary(path).d.q.length} searches · Google and Bing`];
  if (ev.startsWith('tool:')) return [`${toolName(ev.slice(5))} result`, toolSummary(ev.slice(5), path)];
  if (ev.startsWith('visits:')) { const v = (VISITS[path] || []).find((q) => q[0] === ev.slice(7)); return ['Sessions', `${v[3].length} of ${v[1]} visits, one line each`]; }
  if (ev.startsWith('todo:')) { const T = TODOS[ev.slice(5)]; return ['The to-do', `${STAGE_PILL[T.stage][0]} · ${T.entries.length} ${T.entries.length > 1 ? 'updates' : 'update'}`]; }
  return ['Details', ''];
}
// Does this evidence carry the 4-week chart? Not for to-dos, speed, or events that name no metric.
const hasChart = (path, ev) => !!path && !ev.startsWith('todo:') && ev !== 'tool:speed' && !(ev.startsWith('x:') && !EVX[ev.slice(2)][9]);
// The closed attachment: a thumbnail of what's inside and a list of its parts, never a repeat of the message.
function attChip(path, ev, dd, e, title, act) {
  let thumb;
  const df = diffFor(path, ev, dd);
  if (df) { const [a, r] = diffCount(df); thumb = `<span class="dfn"><i class="up">+${a}</i><i class="down">−${r}</i></span>`; }
  else if (hasChart(path, ev)) {
    const metric = ev.startsWith('x:') ? EVX[ev.slice(2)][9] : ev.startsWith('visits:') || ev.startsWith('spike:') ? 'visits' : 'clicks';
    const end = dd >= addD(LAST, -10) ? LAST : addD(dd, 10), days = [];
    for (let d = addD(end, -27); d <= end; d = addD(d, 1)) days.push(d);
    const v = days.map((d) => (ev === `visits:${d}` ? ((VISITS[path] || []).find((q) => q[0] === d) || [0, 0])[1] : pageSeries(path, d, metric))), mx = Math.max(...v) * 1.15, W = 56, H = 30;
    const X = (i) => (i / (days.length - 1)) * W, Y = (y) => H - 2 - (y / mx) * (H - 4), ei = days.indexOf(dd);
    thumb = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${v.map((y, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.4"/>${ei >= 0 ? `<line x1="${X(ei)}" x2="${X(ei)}" y1="0" y2="${H}" stroke="var(--text-3)" stroke-dasharray="2 2"/><circle cx="${X(ei)}" cy="${Y(v[ei])}" r="2.4" fill="var(--text)"/>` : ''}</svg>`;
  } else if (e.readings.length) {
    const [, val, , tone] = e.readings[0];
    thumb = `<b class="att-num ${tone || ''}">${val}</b>`;
  } else thumb = ic('doc', 16);
  const parts = [df ? 'diff' : '', hasChart(path, ev) ? (df ? 'what happened after' : '4-week chart') : '', e.readings.length ? `${e.readings.length} ${e.readings.length > 1 ? 'numbers' : 'number'}` : '', e.findings.length ? `${e.findings.length} ${e.findings.length > 1 ? 'findings' : 'finding'}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="att" data-act="${act}" aria-expanded="false"><span class="att-th">${thumb}</span><span><b>${title}</b><small>${parts || 'details'}</small></span>${ic('fwd', 14)}</button>`;
}
// The attachment viewer: one shape for every kind of evidence.
function attachmentView(e, title, dd, path, ev) {
  const rd = e.readings.length ? `<div class="att-r">${e.readings.map(([l, v, a, tone]) => `<div><small>${l}</small><b class="${tone || ''}">${v}</b>${a ? `<span>${a}</span>` : ''}</div>`).join('')}</div>` : '';
  const fd = e.findings.length ? `<ul class="ent-f">${e.findings.slice(0, 5).map(([sev, t, n]) => `<li><i class="cdot2 ${SEV_DOT[sev] || ''}"></i><span>${t}${n ? `<small>${n}</small>` : ''}</span></li>`).join('')}</ul>` : '';
  return `<div class="att-v"><div class="att-vh">${ic('doc', 13)}<b>${title}</b><span class="muted">${dd === LAST ? 'today' : fmtD(dd, { day: 'numeric', month: 'short' })}</span></div>${diffFor(path, ev, dd) ? diffView(diffFor(path, ev, dd)) : ''}${hasChart(path, ev) ? proofChart(path, ev, dd) : ''}${rd}${fd}</div>`;
}
function pageStory(scope, phone, pathArg, inPanel) {
  const path = pathArg || S.page, x = pageSummary(path), cyc = CYCLES[path];
  const status = cyc ? cyc.v : x.verdict;
  const t = tlFor(path, x), day = (dd) => (dd === LAST ? 'Today' : fmtD(dd, { day: 'numeric', month: 'short' }));
  const want = S.pev && S.pev.startsWith('ev-') ? t.m.findIndex((mm) => mm[4] === S.pev.slice(3) || mm[4] === `tool:${S.pev.slice(3)}`) : -1;
  const shown = t.m.map((mm, i) => [mm, i]).filter(([[, w, , , ev]]) => !S.ptrack || trackOf(ev, w) === S.ptrack);
  const lastI = shown.length ? shown[shown.length - 1][1] : -1;
  const av = (w) => `<span class="tlav a-${WHO[w] ? WHO[w][2] : 'cc'}">${WHO[w] ? WHO[w][1] : AGENTS[w] ? AGENTS[w][1] : '?'}</span>`;
  const name = (w) => (WHO[w] ? WHO[w][0] : AGENTS[w] ? AGENTS[w][0] : w);
  // Each event: a dated point on the timeline, drawn as a message. Open it for its attachment, the proof.
  const items = shown.map(([[dd, w, what, det, ev, tone, kind], i]) => {
    const open = S.pev ? S.pev === `m${i}` || want === i : i === lastI;
    const k = kind || momentKind(w), tcls = tone ? ` t-${tone}` : '';
    const dot = tone && tone !== 'muted' ? `<i class="cdot2 ${tone === 'down' ? 'down' : tone === 'up' ? 'up' : 'warn'}"></i>` : '';
    const card = !open
      ? `<button type="button" class="ev ev-c" data-act="pev:m${i}"><span class="ev-l">${av(w)}<b>${name(w)}</b></span><span class="ev-s">${dot}<b>${what}</b>${det ? `<span class="muted"> — ${det}</span>` : ''}</span></button>`
      : (() => {
        const e = entryFor(path, ev, dd), [att] = attachmentOf(path, ev, dd), attOpen = S.patt === `m${i}`;
        return `<div class="ev ev-o"><button type="button" class="ev-hd" data-act="pev:${i === lastI && !S.pev ? 'none' : `m${i}`}">${av(w)}<span class="mm-who"><b>${name(w)}</b><small>to ${nameOf(path)}</small></span></button>
          <b class="mm-s">${dot}${what}</b>${det ? `<p>${det}</p>` : ''}
          ${attOpen ? attachmentView(e, att, dd, path, ev).replace('<div class="att-vh">', `<div class="att-vh" role="button" tabindex="0" data-act="patt:m${i}" title="Close">`).replace(/(<span class="muted">[^<]*<\/span>)<\/div>/, `$1<span class="muted small2">Close</span></div>`) : attChip(path, ev, dd, e, att, `patt:m${i}`)}
          ${e.actions.length ? `<div class="ent-a">${e.actions.map(([l, a, p]) => `<button type="button" class="${p ? 'jbtn primary' : 'chip'}" data-act="${a}">${l}</button>`).join('')}</div>` : ''}</div>`;
      })();
    return [`<li class="tlm${tcls}"><span class="tld">${day(dd)}</span><span class="tlic k-${k}" title="${KINDS[k][1]}">${ic(KINDS[k][0], 12)}</span>${card}</li>`, tone === 'muted' && !open];
  }).reduce((out, [html, quiet], j, all) => {
    // Quiet events (no clear change) fold into one line between the ones that matter.
    if (!quiet || S.pquiet) return out + html;
    const prevQuiet = j > 0 && all[j - 1][1];
    if (prevQuiet) return out;
    let n = 0; while (all[j + n] && all[j + n][1]) n++;
    return out + `<li class="tlm tlq"><span class="tld"></span><span class="tlic k-quiet">·</span><button type="button" class="linkish tlqb" data-act="pquiet">${n} quieter ${n > 1 ? 'events' : 'event'}</button></li>`;
  }, '');
  // Now: the last point. One proposal from Kauzl: the change (before → after), the events it rests on,
  // what it should bring, and one row of actions. The stages appear once it is a to-do.
  const [nt, nw, todo, gain] = t.now, T = todo && TODOS[todo], plan = (TL[path] || {}).plan;
  const at = T ? TSTAGES.findIndex(([k]) => k === T.stage) : -1;
  const stages = T ? `<ol class="tstages">${TSTAGES.map(([k, l], i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}">${l}</li>`).join('')}</ol>` : '';
  const because = plan ? plan.because.map((b) => { const i = t.m.findIndex((mm) => mm[2].includes(b)); return i < 0 ? '' : `<button type="button" class="nwhy" data-act="pev:m${i}"><span class="muted">${day(t.m[i][0])}</span> ${t.m[i][2]}</button>`; }).filter(Boolean).join('') : '';
  const draft = plan ? diffView({ prose: true, where: plan.where || 'The page', lines: [['-', plan.was], ['+', plan.to]] }, T && T.stage === 'proposed' ? 'proposed · needs your OK' : 'Kauzl suggests') : '';
  const cells = plan ? `<div class="att-r">${plan.cells.map(([l, v, a, tone]) => `<div><small>${l}</small><b class="${tone || ''}">${v}</b><span>${a}</span></div>`).join('')}</div>` : '';
  const act = T ? `<button type="button" class="jbtn primary" data-act="ptodo:${todo}">${T.stage === 'proposed' ? 'Review the proposal' : T.stage === 'open' ? 'Hand to Claude Code' : 'Open in the Inbox'}</button><span class="muted small2">In the Inbox since ${T.entries[0].at.replace(/^(Today|Yesterday)/, (w) => w.toLowerCase())}</span>`
    : nt.startsWith('Nothing') ? '' : `<button type="button" class="jbtn primary" data-act="noop">Add to the Inbox</button><button type="button" class="chip" data-act="noop">Hand to Claude Code</button>`;
  const more = t.more.length ? `<button type="button" class="linkish small2 nmore" data-act="pmore" aria-expanded="${!!S.pmore}">${S.pmore ? 'Hide other ideas' : `${t.more.length} other ${t.more.length > 1 ? 'ideas' : 'idea'}`}</button>` : '';
  const moreList = S.pmore && t.more.length ? `<div class="tlmore"><ul>${t.more.map(([m, g]) => `<li><span>${m}</span>${g ? `<b class="up">${g}</b>` : ''}<button type="button" class="chip" data-act="noop">Add to the Inbox</button></li>`).join('')}</ul></div>` : '';
  const nstat = T ? STAGE_PILL[T.stage][0].toLowerCase() : nt.startsWith('Nothing') ? 'Nothing to do' : 'draft · not in the Inbox yet';
  const now = `<li class="tlm tlnow"><span class="tld">Now</span><span class="tlic k-now"></span><div class="ev ev-o ev-now"><div class="ev-hd">${av('kauzl')}<span class="mm-who"><b>Kauzl</b><small>next step · ${nstat}</small></span></div>
    <b class="mm-s">${nt}</b>${plan ? '' : `<p>${nw}</p>`}
    ${draft}${because ? `<div class="nbec"><small>Because</small>${because}</div>` : ''}${cells}${stages}
    ${act || more ? `<div class="ent-a">${act}${more}</div>` : ''}${moreList}</div></li>`;
  return `${inPanel ? '' : '<button type="button" class="linkish" data-act="pg:none">← All pages</button>'}
    <div class="head"><div><h3>${nameOf(path)} <span class="pstat ${VCLS[status] || VERDICT_CLS[status] || ''}">${status}</span></h3><div class="sub2">${path} · ${fmt(x.clicks)} search visits a month</div></div>${inPanel ? '' : `<div class="head-r"><button type="button" class="chip" data-act="view:tools|tpage:${path}">${ic('terminal', 12)} Diagnose this page</button></div>`}</div>
    ${trackerHead(path)}${S.ptrack ? `<p class="muted small2 m0">Only ${TRACKS.find((q) => q[0] === S.ptrack)[1].toLowerCase()} · <button type="button" class="linkish" data-act="ptrack:${S.ptrack}">Show everything</button></p>` : ''}
    <ol class="tl">${items}${S.ptrack ? '' : now}</ol>`;
}
// Search, the other way round: every search, with the page that answers it.
function searchList() {
  const rows = Object.entries(PAGE_Q).flatMap(([p, d]) => d.q.map((r) => ({ p, r, s: qState(r) }))).filter((x) => x.s.k !== 'none').sort((a, b) => b.r[4] - a.r[4]).slice(0, 8);
  return `<div class="card"><div class="qrow qhead"><span>Search</span><span class="num">A month</span><span class="num">Google</span><span class="num">Bing</span><span class="num">Clicks</span><span>Page</span></div>${rows.map(({ p, r }) => `<div class="qrow"><span class="qn">“${r[0]}”</span><span class="num">${fmt(r[1])}</span><span class="num">${r[2] == null ? '—' : `#${r[2].toFixed(0)}`}</span><span class="num">${r[3] == null ? '—' : `#${r[3].toFixed(0)}`}</span><span class="num">${fmt(r[4])}</span><button type="button" class="plink" data-act="view:pages|pg:${p}">${nameOf(p)}</button></div>`).join('')}</div><p class="muted small2">Each search names the page that shows up for it. Open a page to see all its searches in one place.</p>`;
}
function demandList() {
  return `<div class="card"><h4>Searches with no page yet</h4>${NO_PAGE.map(([q, n]) => `<div class="todo-s"><span>“${q}” <span class="muted">· ${fmt(n)} searches a month</span></span><button type="button" class="chip" data-act="noop">+ To-do: write it</button></div>`).join('')}</div><p class="muted small2">Searches a page already shows up for live on that page’s view, under Pages.</p>`;
}

/* ---------- Search: the short answer, then searches grouped by what to do about them ---------- */
const allQ = () => Object.entries(PAGE_Q).flatMap(([p, d]) => d.q.map((r) => ({ p, r, s: qState(r) })));
// Search's picture: a ladder. One row per search, a track from Top 3 to Not showing up,
// a dot where it ranks now and an arrow from where it was 4 weeks ago.
function searchMap(phone) {
  const xOf = (pos) => (pos == null ? 91 : pos <= 3 ? 2 + ((pos - 1) / 2) * 14 : pos <= 10 ? 20 + ((pos - 4) / 6) * 28 : pos <= 20 ? 52 + ((pos - 11) / 9) * 26 : 80 + Math.min(pos - 21, 4));
  const was = (p, pos) => { const t = PAGE_Q[p].trend; return pos == null || t === 'new' ? null : t === 'falling' ? Math.max(1, pos - 5) : t === 'rising' ? pos + 3 : null; };
  const items = allQ().map((x) => ({ ...x, pos: bestPos(x.r) })).sort((a, b) => b.r[1] - a.r[1]);
  const shown = S.ladAll ? items : items.slice(0, 8);
  const zones = `<span class="lz" style="left:0;width:18%"></span><span class="lz alt" style="left:18%;width:32%"></span><span class="lz" style="left:50%;width:28%"></span><span class="lz alt end" style="left:78%;width:22%"></span>`;
  const head = `<div class="lrow lhead"><span></span><span class="ltrack-h"><span style="left:1%">Top 3</span><span style="left:19%">Page 1</span><span style="left:51%">Page 2</span><span style="left:79%">Not showing</span></span><span class="num">A month</span></div>`;
  const rows = shown.map((x) => {
    const now = xOf(x.pos), old = x.p ? was(x.p, x.pos) : null, then = old == null ? null : xOf(old), ed = S.eng === 'both' ? engDiff(x.r) : null;
    const better = then != null && then > now, arrow = then != null && Math.abs(then - now) > 1
      ? `<span class="larr ${better ? 'up' : 'down'}" style="left:${Math.min(then, now)}%;width:${Math.abs(then - now)}%"><i class="${better ? 'l' : 'r'}"></i></span>` : '';
    const move = then == null ? (PAGE_Q[x.p].trend === 'new' ? 'new page' : '') : better ? `up from #${old.toFixed(0)}` : `down from #${old.toFixed(0)}`;
    return `<button type="button" class="lrow${S.q === x.r[0] ? ' on' : ''}" data-act="q:${encodeURIComponent(x.r[0])}${phone ? '|pop:q' : ''}">
      <span class="lname"><b>“${x.r[0]}”</b><small>${nameOf(x.p)}${x.pos != null ? ` · #${x.pos.toFixed(0)}` : ''}${move ? ` · <span class="${better ? 'up' : then != null ? 'down' : ''}">${move}</span>` : ''}${ed ? ` · <span class="down">${ed.bad === 'Bing' ? (x.r[3] == null ? 'but not on Bing' : `but Bing #${x.r[3].toFixed(0)}`) : (x.r[2] == null ? 'but not on Google' : `but Google #${x.r[2].toFixed(0)}`)}</span>` : ''}</small></span>
      <span class="ltrack" title="${x.pos == null ? 'Not in the first pages of results yet' : `#${x.pos.toFixed(0)} now${old != null ? `, #${old.toFixed(0)} four weeks ago` : ''}`}${ed ? ` · Google ${x.r[2] == null ? 'not showing' : '#' + x.r[2].toFixed(0)}, Bing ${x.r[3] == null ? 'not showing' : '#' + x.r[3].toFixed(0)}` : ''}">${zones}${arrow}<span class="ldot${x.pos == null ? ' gap' : ''}${ed ? ' dis' : ''}" style="left:${now}%"></span></span>
      <span class="num">${fmt(x.r[1])}</span></button>`;
  }).join('');
  return `<div class="card lcard"><div class="chhead"><h4>Where each search ranks <span class="muted">· further left is better · arrows show the move over the last 4 weeks</span></h4></div>${head}${rows}
    <div class="lfoot"><span class="smleg"><span class="lgi"><i style="background:var(--accent)"></i>Now</span><span class="lgi"><i class="ar up"></i>Moved up</span><span class="lgi"><i class="ar down"></i>Slipped</span>${S.eng === 'both' ? '<span class="lgi"><i class="ring"></i>Google and Bing disagree</span>' : ''}</span>${items.length > 8 ? `<button type="button" class="linkish" data-act="lad">${S.ladAll ? 'Show fewer' : `Show all ${items.length}`}</button>` : ''}</div></div>`;
}
function nextMoves(close, phone) {
  return `<div class="moves">${close.slice(0, 3).map((x) => `<button type="button" class="move" data-act="q:${encodeURIComponent(x.r[0])}${phone ? '|pop:q' : ''}"><small>${nameOf(x.p)} · #${bestPos(x.r).toFixed(0)} now</small><b>“${x.r[0]}”</b><span class="mg"><span class="up">+${fmt(x.s.gain)}</span><small>visits a month in the top 3</small></span></button>`).join('')}</div>`;
}
function gapChips(none, phone) {
  const mx = Math.max(...none.map((x) => x.n));
  return `<div class="gaps">${none.map((x) => `<button type="button" class="gapc" style="font-size:${(12 + (x.n / mx) * 7).toFixed(1)}px" data-act="q:${encodeURIComponent(x.q)}${phone ? '|pop:q' : ''}">“${x.q}” <span class="muted">${fmt(x.n)}</span></button>`).join('')}</div>`;
}
function searchBody(scope, phone) {
  const qs = allQ(), clicks = qs.reduce((a, x) => a + clk(x.r), 0);
  const close = qs.filter((x) => x.s.k === 'p1' || x.s.k === 'p2').sort((a, b) => b.s.gain - a.s.gain);
  const top = qs.filter((x) => x.s.k === 'top').sort((a, b) => b.r[4] - a.r[4]);
  const none = qs.filter((x) => x.s.k === 'none').map((x) => ({ q: x.r[0], n: x.r[1], p: x.p })).concat(NO_PAGE.map(([q, n]) => ({ q, n, p: null }))).sort((a, b) => b.n - a.n);
  const gain = close.reduce((a, x) => a + x.s.gain, 0), best = top[0];
  const answer = `<b>${fmt(clicks)}</b> search clicks a month from ${S.eng === 'google' ? 'Google' : S.eng === 'bing' ? 'Bing' : 'Google and Bing'}, most from “${best.r[0]}” (#${bestPos(best.r).toFixed(0)}). <b>${close.length}</b> searches are close: reaching the top 3 for them would bring about <b>${fmt(gain)}</b> more visits a month. The biggest gap is “${none[0].q}” (${fmt(none[0].n)} searches a month), which no page answers.`;
  const sel = (q) => (S.q === q ? ' on' : '');
  const act = (q) => `q:${S.q === q ? 'none' : encodeURIComponent(q)}${phone ? '|pop:q' : ''}`;
  const more = (key, n, len) => (len > n ? `<button type="button" class="linkish" data-act="qs:${key}">${S.qAll === key ? 'Show fewer' : `Show all ${len}`}</button>` : '');
  const cut = (key, list) => (S.qAll === key ? list : list.slice(0, 5));
  const posChip = (r) => `<span class="pchip2">#${bestPos(r).toFixed(0)}</span>`;
  const sec = (title, sub, rows, foot) => `<div class="card"><div class="chhead"><h4>${title} <span class="muted">· ${sub}</span></h4></div>${rows}${foot}</div>`;
  const closeRows = cut('close', close).map((x) => `<button type="button" class="srow2${sel(x.r[0])}" data-act="${act(x.r[0])}"><span class="qn">“${x.r[0]}”</span>${posChip(x.r)}<span class="sp">${nameOf(x.p)}</span><b class="num up">+${fmt(x.s.gain)}</b></button>`).join('');
  const topRows = cut('top', top).map((x) => `<button type="button" class="srow2${sel(x.r[0])}" data-act="${act(x.r[0])}"><span class="qn">“${x.r[0]}”</span>${posChip(x.r)}<span class="sp">${nameOf(x.p)}</span><b class="num">${fmt(x.r[4])}</b></button>`).join('');
  const noneRows = cut('none', none).map((x) => `<button type="button" class="srow2${sel(x.q)}" data-act="${act(x.q)}"><span class="qn">“${x.q}”</span><span class="pchip2 off">—</span><span class="sp muted">${x.p ? `${nameOf(x.p)} doesn’t show up` : 'No page'}</span><b class="num">${fmt(x.n)}</b></button>`).join('');
  const engSeg = `<div class="mini-seg" role="group" aria-label="Search engine">${[['both', 'Both'], ['google', 'Google'], ['bing', 'Bing']].map(([k, l]) => `<button type="button" class="${S.eng === k ? 'on' : ''}" data-act="eng:${k}">${l}</button>`).join('')}</div>`;
  const dis = S.eng === 'both' ? qs.map((x) => ({ ...x, e: engDiff(x.r) })).filter((x) => x.e).sort((a, b) => b.r[1] - a.r[1]) : [];
  const disBlock = dis.length ? `<div class="sblock"><h3>Google and Bing disagree <span class="muted">· a page doing well on one engine and badly on the other</span></h3><div class="card">${dis.map((x) => `<button type="button" class="drow2" data-act="${act(x.r[0])}"><span class="qn">“${x.r[0]}”</span><span class="eng ${x.r[2] == null ? 'off' : ''}">Google ${x.r[2] == null ? '—' : `#${x.r[2].toFixed(0)}`}</span><span class="eng ${x.r[3] == null ? 'off' : ''}">Bing ${x.r[3] == null ? '—' : `#${x.r[3].toFixed(0)}`}</span><b class="down">${x.e.bad === 'Bing' ? (x.r[3] == null ? 'Missing on Bing' : 'Failing on Bing') : (x.r[2] == null ? 'Missing on Google' : 'Failing on Google')}</b><span class="sp">${nameOf(x.p)}</span></button>`).join('')}<p class="muted small2">Bing matters more than its clicks: ChatGPT search and Copilot lean on Bing’s index.</p></div></div>` : '';
  return head('Search', `${S.eng === 'google' ? 'Google only' : S.eng === 'bing' ? 'Bing only' : 'Google and Bing together'}, plus AI answers · ${site(scope).label}`, { phone, right: phone ? engSeg : `${engSeg}${rangeCtl(false)}` }) + `<p class="dstory jans">${answer}${dis.length ? ` <b>${dis.length}</b> searches do well on one engine and badly on the other.` : ''}</p>
    ${searchMap(phone)}
    ${disBlock}
    <div class="sblock"><h3>Next moves <span class="muted">· the three searches closest to paying off</span></h3>${nextMoves(close, phone)}</div>
    <div class="sblock"><h3>Gaps <span class="muted">· searches nothing on your site answers, sized by how often people search them</span></h3>${gapChips(none, phone)}</div>
    ${S.qtable ? `${sec('Close to the top 3', 'extra visits a month if they get there', closeRows, more('close', 5, close.length))}${sec('In the top 3', 'search clicks a month', topRows, more('top', 5, top.length))}${sec('Nothing ranks for these', 'searches a month', noneRows, more('none', 5, none.length))}` : ''}
    <button type="button" class="linkish" data-act="qt">${S.qtable ? 'Hide the lists' : 'See every search as a list'}</button>
    <div class="sfoot"><div class="card"><h4>AI answers</h4><p>Kauzl is cited in <b>3 of 8</b> questions you track. ChatGPT and Perplexity cite the GA4 BigQuery guide; Gemini doesn’t mention you yet.</p><button type="button" class="linkish" data-act="tab:ai">See the questions →</button></div><div class="card"><h4>Indexing</h4><p>All pages are on Google. <b>Bing hasn’t crawled</b> Kauzl vs Plausible yet.</p><button type="button" class="linkish" data-act="noop">Submit it to Bing →</button></div></div>
    <p class="muted small2">Click a search for the full detail. Extra visits are an estimate from a usual click-rate curve.</p>`;
}
function queryPanel(q) {
  const x = allQ().find((y) => y.r[0] === q), np = NO_PAGE.find(([nq]) => nq === q);
  if (!x && !np) return '';
  const close = `<button type="button" class="icon-btn" data-act="q:none|close" aria-label="Close">${ic('x', 14)}</button>`;
  if (!x) return `<div class="insp-in"><div class="insp-h"><b>“${q}”</b>${close}</div><p class="dstory"><b>${fmt(np[1])}</b> searches a month, and no page on your site answers it.</p><span class="chips"><button type="button" class="chip" data-act="noop">+ To-do: write a page</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask what to write</button></span></div>`;
  const r = x.r, s = x.s, imp = Math.round(r[1] * 0.9), ctr = r[4] / Math.max(1, imp), ed = engDiff(r);
  const say = s.k === 'none' ? `<b>${fmt(r[1])}</b> searches a month. ${nameOf(x.p)} is the closest page, but it doesn’t show up for it.` : `<b>${fmt(r[1])}</b> searches a month. ${nameOf(x.p)} shows up at <b>#${r[2] == null ? '—' : r[2].toFixed(0)}</b> on Google and <b>#${r[3] == null ? '—' : r[3].toFixed(0)}</b> on Bing, and gets ${fmt(r[4])} clicks a month.${s.gain ? ` In the top 3 it would get about <b>${fmt(s.gain)}</b> more.` : ''}`;
  const trend = Array.from({ length: 12 }, (_, i) => (bestPos(r) || 30) + (11 - i) * 0.25 * (rnd(i + r[1]) - 0.3));
  const mx = Math.max(...trend), mn = Math.min(...trend);
  const spark = `<svg class="tsp big" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="${trend.map((v, i) => `${((i / 11) * 100).toFixed(1)},${(4 + ((v - mn) / Math.max(0.1, mx - mn)) * 32).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
  const rows = [['Searches a month', fmt(r[1]), 'Bing volume'], ['Google position', r[2] == null ? '—' : `#${r[2].toFixed(1)}`, ''], ['Bing position', r[3] == null ? '—' : `#${r[3].toFixed(1)}`, ''], ['Shown in results', fmt(imp), 'a month'], ['Clicks', fmt(r[4]), `${(ctr * 100).toFixed(1)}% of views`], ['Where it stands', s.word, s.gain ? `+${fmt(s.gain)} in the top 3` : '']];
  return `<div class="insp-in"><div class="insp-h"><b>“${q}”</b>${close}</div><p class="dstory">${say}</p>${ed ? `<div class="engwarn"><b>${ed.bad === 'Bing' ? 'Failing on Bing' : 'Failing on Google'}</b><span>${ed.say}. ${ed.why}${ed.bad === 'Bing' ? ' ChatGPT search and Copilot lean on Bing, so this also costs AI answers.' : ''}</span>${ed.bad === 'Bing' ? '<span class="chips"><button type="button" class="chip" data-act="noop">Check it in Bing Webmaster</button><button type="button" class="chip" data-act="noop">Submit to Bing</button></span>' : ''}</div>` : ''}
    <div class="ib">${rows.map(([l, v, d]) => `<div class="dnum"><span>${l}</span><b>${v}</b><span></span><span class="muted">${d}</span></div>`).join('')}</div>
    <div class="ib"><h5>Position, last 12 weeks <span class="muted">· higher is better</span></h5>${spark}</div>
    <div class="ib"><h5>The page</h5><button type="button" class="erow" data-act="view:pages|pg:${x.p}"><span></span><span style="display:grid">${ic('doc', 13)}</span><span class="et">${nameOf(x.p)}</span><span class="muted">Open →</span></button></div>
    <span class="chips"><button type="button" class="chip" data-act="noop">+ To-do</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask how to move up</button></span></div>`;
}

/* ---------- Proposed: sections named by question ---------- */
const SECTIONS = {
  pages: { l: 'Pages', q: 'Which content works', tabs: [['pages', 'All pages'], ['cycles', 'Content cycles'], ['health', 'Health']] },
  search: { l: 'Search', q: 'How Google, Bing and AI tools show you', tabs: [['queries', 'Searches'], ['demand', 'No page yet'], ['ai', 'AI answers'], ['indexing', 'Indexing']] },
  traffic: { l: 'Traffic', q: 'Where people come from', tabs: [['sources', 'Sources'], ['campaigns', 'Campaigns'], ['posts', 'Posts & mentions'], ['ads', 'Google Ads']] },
  journeys: { l: 'Journeys', q: 'What people do once they’re here', tabs: [['paths', 'Paths'], ['funnels', 'Funnels'], ['retention', 'Retention']] },
  goals: { l: 'Goals', q: 'Is it working', tabs: [['results', 'Results'], ['pagegoals', 'Page goals'], ['product', 'Product']] },
};
const RAW = [['events', 'Events', 'Every tracked event, as counted'], ['sql', 'SQL', 'Query the BigQuery export directly']];
const ASKS = [
  ['Why did signups drop on Tuesday?', 'Signups fell from 31 to 18 on Tue 11 Nov. Visits were normal, but the step from /pricing to /signup fell from 22% to 9% after the 10 Nov deploy moved the signup button. Mobile Safari accounts for most of the drop.'],
  ['Which page should I improve next?', '/guides/google-analytics-mcp-server: about 1,900 Google impressions a week at position 7, with a 1.1% click rate. A title that names “Claude” and “GA4” could roughly double its clicks.'],
  ['Is ChatGPT traffic worth it?', '310 visits in 28 days, up 60%. They view 2.4 pages each against 1.6 from Google, and 4 of them signed up.'],
];
const hasWh = (scope) => scope === 'all' || site(scope).wh !== false;
const shownViews = () => VIEWS.filter(([k]) => k !== 'journeys' || hasWh(S.scope));

// What's waiting on you, as one row on the Timeline: to-dos, alerts, goals behind. Each opens in the panel.
function needsRow(scope) {
  const ms = inboxFor(scope), items = [];
  for (const m of ms) {
    const T = m.id && TODOS[m.id];
    if (T && T.stage === 'proposed') items.push([`Review: ${m.t}`, `pclear|ptodo:${m.id}`, 'warn']);
    else if (T && T.stage === 'open') items.push([m.t, `pclear|ptodo:${m.id}`, '']);
    else if (m.k === 'alert') items.push([m.t, m.go || 'view:inbox', 'down']);
  }
  const behind = goalsFor(scope).filter((g) => g.st === 'behind');
  if (behind.length) items.push([`${behind.length} ${behind.length > 1 ? 'goals' : 'goal'} behind`, 'view:inbox|inboxF:goal', 'down']);
  if (!items.length) return '';
  return `<div class="needs-row"><b>Needs you · ${items.length}</b><span class="needs-list">${items.slice(0, 4).map(([t, a, tone]) => `<button type="button" class="chip" data-act="${a}">${tone ? `<i class="cdot2 ${tone}"></i>` : ''}${t}</button>`).join('')}</span>${items.length > 4 ? `<button type="button" class="linkish" data-act="view:inbox">${items.length - 4} more in the Inbox →</button>` : `<button type="button" class="linkish" data-act="view:inbox">Inbox →</button>`}</div>`;
}
function askBox(scope) {
  const a = S.ask != null ? ASKS[S.ask] : null;
  return `<div class="card ask-card"><div class="askin">${ic('chat', 16)}<span class="${a ? '' : 'muted'}">${a ? a[0] : `Ask anything about ${scopeName(scope)}…`}</span>${a ? `<button type="button" class="linkish" data-act="ask:-1" style="margin-left:auto">Clear</button>` : ''}</div>${a ? `<p class="answer">${a[1]}</p><span class="muted" style="font-size:12px">Example answer. Claude reads the same numbers the MCP server gives it.</span>` : `<div class="chips">${ASKS.map(([q], i) => `<button type="button" class="chip" data-act="ask:${i}">${q}</button>`).join('')}</div>`}</div>`;
}
function pickSite(title, sub, phone, view) {
  const list = SITES.filter((s) => view !== 'journeys' || s.wh !== false);
  return head(title, sub, { phone, right: '' }) + `<div class="pick">${list.map((s) => `<button type="button" class="sitecard" data-act="scope:${s.id}|view:${view}"><span class="nm">${s.label}</span><span class="ln">${s.host}</span></button>`).join('')}</div>`;
}
const row = (cells, cls = '') => `<div class="r ${cls}">${cells.map((c) => (typeof c === 'string' ? `<span>${c}</span>` : `<span class="${c[1]}">${c[0]}</span>`)).join('')}</div>`;
/* ---------- Pages · Health: can search show each page, how fast it is, dead ends ---------- */
// What Google's URL inspection and Bing's URL info say per page. [state, words]; state: ok | warn | bad | off.
const IXP = {
  canon: ['Google picked a different address', 'Google shows another version of this page, so its visits and rank are split'],
  crawled: ['Crawled, not indexed', 'Google read the page and chose not to show it yet'],
  notyet: ['Not crawled yet', 'The engine hasn’t read the page'],
  redirect: ['Listed, but it redirects', 'The sitemap points at an address that sends people elsewhere'],
  noindex: ['Told not to show it', 'The page has a noindex tag'],
};
const IX = [
  { p: '/guides/ga4-bigquery-export', k: 'canon', g: ['warn', 'Different address'], b: ['ok', 'Shown'], found: 'today', visits: 2120,
    say: { g: 'Duplicate, Google chose different canonical than user', b: 'Indexed · crawled 15 Nov' },
    yours: 'kauzl.com/guides/ga4-bigquery-export', theirs: 'kauzl.com/guides/ga4-bigquery-export/',
    why: 'The sitemap lists it without the slash, but 14 links inside the site use the slash.', fix: 'Redirect the slash version to the one without it, and fix the 14 links.' },
  { p: '/kauzl-vs-plausible', k: 'crawled', g: ['bad', 'Not shown'], b: ['warn', 'Not crawled'], found: '3 days ago', visits: 310,
    say: { g: 'Crawled - currently not indexed · crawled 12 Nov', b: 'URL not found in index' },
    why: 'The page is 4 days old and no other page links to it yet.', fix: 'Link to it from Home and Pricing, then ask both engines to look again.' },
  { p: '/guides/google-analytics-mcp-server', k: 'notyet', g: ['ok', 'Shown'], b: ['warn', 'Not crawled'], found: '5 days ago', visits: 640,
    say: { g: 'Submitted and indexed', b: 'Discovered, not crawled' },
    why: 'Bing found it in the sitemap but hasn’t read it.', fix: 'Send it to Bing with IndexNow. It usually shows within 2 days.' },
  { p: '/docs/setup-v1', k: 'redirect', g: ['warn', 'Redirects'], b: ['warn', 'Redirects'], found: '2 weeks ago', visits: 12,
    say: { g: 'Page with redirect', b: 'Redirected URL in sitemap' },
    why: 'It moved to /mcp/setup, but the sitemap still lists the old address.', fix: 'Take it out of the sitemap.' },
  { p: '/blog/launch-notes', k: 'noindex', g: ['off', 'Hidden'], b: ['off', 'Hidden'], found: '1 Nov', visits: 30, onPurpose: true,
    say: { g: 'Excluded by ‘noindex’ tag', b: 'Blocked by noindex' },
    why: 'You added noindex on 1 Nov when you decided to cut it.', fix: 'Nothing, if that’s still the plan.' },
];
const IX_OK = 4; // pages both engines show without trouble
const ixFor = (p) => IX.find((x) => x.p === p);
const ixPill = ([st, w]) => `<span class="ixp ${st}">${w}</span>`;
function indexSection(phone) {
  const total = IX.length + IX_OK;
  const count = (e) => ({ ok: IX_OK + IX.filter((x) => x[e][0] === 'ok').length, warn: IX.filter((x) => x[e][0] === 'warn').length, bad: IX.filter((x) => x[e][0] === 'bad').length, off: IX.filter((x) => x[e][0] === 'off').length });
  const bar = (label, e) => { const c = count(e); return `<div class="ixbar"><span class="ixbl"><b>${label}</b><span class="muted">${c.ok} of ${total} pages shown</span></span><span class="ixtrack"><i class="ok" style="flex:${c.ok}"></i><i class="warn" style="flex:${c.warn}"></i><i class="bad" style="flex:${c.bad}"></i><i class="off" style="flex:${c.off}"></i></span></div>`; };
  const rows = IX.filter((x) => !x.onPurpose).map((x) => `<button type="button" class="ixrow${S.ix === x.p ? ' on' : ''}" data-act="ix:${x.p}${phone ? '|pop:ix' : ''}"><span class="lname"><b>${nameOf(x.p)}</b><small>${IXP[x.k][0]} · ${fmt(x.visits)} visits a month</small></span><span class="ixe"><small>Google</small>${ixPill(x.g)}</span><span class="ixe"><small>Bing</small>${ixPill(x.b)}</span>${ic('fwd', 13)}</button>`).join('');
  const hidden = IX.filter((x) => x.onPurpose);
  return `<section class="tsec"><div class="tsh"><h3>Can search show it?</h3><p>From Google’s and Bing’s own checks of each page, run every night</p></div>
    <div class="card ixsum">${bar('Google', 'g')}${bar('Bing', 'b')}<span class="smleg"><span class="lgi"><i style="background:var(--up)"></i>Shown</span><span class="lgi"><i style="background:var(--warn-ink)"></i>Needs a fix</span><span class="lgi"><i style="background:var(--down)"></i>Not shown</span><span class="lgi"><i style="background:var(--border-strong)"></i>Hidden on purpose</span></span></div>
    <div class="card ixlist">${rows}</div>
    ${hidden.length ? `<p class="muted small2">${hidden.map((x) => nameOf(x.p)).join(', ')} ${hidden.length > 1 ? 'are' : 'is'} hidden on purpose (noindex). <button type="button" class="linkish" data-act="ix:${hidden[0].p}${phone ? '|pop:ix' : ''}">See why</button></p>` : ''}</section>`;
}
function ixPanel(p) {
  const x = ixFor(p);
  if (!x) return '';
  const eng = (n, e, say) => `<div class="ixeng"><span class="ixeh"><b>${n}</b>${ixPill(e)}</span><code>${say}</code></div>`;
  return `<div class="insp-in"><div class="insp-h"><b>${nameOf(p)}</b><button type="button" class="icon-btn" data-act="ix:none|close" aria-label="Close">${ic('x', 14)}</button></div>
    <p class="dstory"><b>${IXP[x.k][0]}.</b> ${IXP[x.k][1]}.</p>
    ${x.yours ? `<div class="ixaddr"><span class="tl">You say</span><code>${x.yours}</code><span class="tl">Google uses</span><code class="diff">${x.theirs}</code></div>` : ''}
    <div class="ib"><h5>What each engine says</h5>${eng('Google', x.g, x.say.g)}${eng('Bing', x.b, x.say.b)}</div>
    <div class="ib"><h5>Why</h5><p class="small2" style="margin:0">${x.why}</p></div>
    <div class="ib"><h5>Fix</h5><p class="small2" style="margin:0">${x.fix}</p></div>
    <span class="chips">${x.onPurpose ? `<button type="button" class="chip" data-act="noop">Show it again</button>` : `<button type="button" class="jbtn primary" data-act="noop">+ To-do</button>${x.k === 'notyet' || x.k === 'crawled' ? '<button type="button" class="chip" data-act="noop">Ask the engines to look again</button>' : ''}`}<button type="button" class="chip" data-act="noop">Check again now</button></span>
    <small class="muted">Found ${x.found}. A to-do can go to Claude Code, which reads this same check through the Kauzl MCP.</small></div>`;
}
// One line on a page's own view when search can't show it properly.
function ixNote(p, phone) {
  const x = ixFor(p);
  if (!x || x.onPurpose) return '';
  const who = x.g[0] !== 'ok' && x.b[0] !== 'ok' ? 'Google and Bing' : x.g[0] !== 'ok' ? 'Google' : 'Bing';
  return `<button type="button" class="ixnote" data-act="ix:${p}${phone ? '|pop:ix' : '|view:pages|tab:health|pg:none'}">${ic('search', 14)}<span><b>${x.k === 'canon' ? IXP.canon[0] : `${who}: ${IXP[x.k][0].toLowerCase()}`}.</b> ${x.why}</span><span class="go">Fix →</span></button>`;
}

/* ---------- Site setup: the .sitelens.yml the site's repo holds, and where each part shows ---------- */
// Each block: [key, label, where it shows (label, act), lines]. A line can carry a warning.
const YML = [
  ['head', null, null, ['version: 1', 'site: kauzl.com', 'kind: saas']],
  ['goals', 'Goals', ['Goals and the Story', 'view:goals'], ['goals:', '  # SignupForm.tsx: gtag(\'event\', \'sign_up\') after the account exists', '  - { event: sign_up, label: Sign-ups, value: 20, alert: true }', '  - { event: extension_installed, label: Installed the extension, alert: true }', ['  - { event: store_click, label: Clicked “Add to Chrome”, role: step }', 'Not sent in 28 days. Renamed in the code?'], '  - { page: /pricing, label: Saw pricing, role: step }']],
  ['funnels', 'Journeys', ['Journeys', 'view:journeys'], ['funnels:', '  - name: Sign up', '    steps: [page:/pricing, page:/signup, event:sign_up]', '  - name: Install the extension', '    steps: [event:store_click, event:extension_installed]']],
  ['alerts', 'Alerts', ['The Inbox', 'view:inbox'], ['alerts:', '  traffic: { pct: 40 }']],
  ['search', 'Search topics and AI questions', ['Search', 'view:search'], ['search:', '  brand: [kauzl]', '  competitors: [plausible, fathom]', '  topics:', '    - name: GA4 BigQuery', '      page: /guides/ga4-bigquery-export', '      targets: [ga4 bigquery export, ga4 raw data]', '    - name: GA4 MCP', '      page: /guides/google-analytics-mcp-server', '      targets: [google analytics mcp]', '  ask_ai:', '    - Is there a local dashboard for GA4 and Search Console?', '    - What’s a simple alternative to GA4?']],
  ['content', 'Content checks', ['Pages · How it reads', 'view:pages|pg:/guides/what-is-a-utm-code'], ['content:', '  rules:', '    passive: off   # the docs are written this way on purpose', '    title: { max: 65 }', '  skip: [/changelog/*, /legal/*]']],
  ['metrics', 'Your numbers', ['Goals · Your numbers', 'view:goals'], ['metrics:', '  - name: GitHub stars', '    source: github', '    repo: kauzl/kauzl', '    count: stars', '  - name: Waitlist', '    source: http', '    url: https://api.kauzl.com/stats', '    path: data.waitlist']],
];
const YML_SUM = { goals: '2 goals, 2 steps · 1 warning', funnels: '2 journeys', alerts: 'Traffic swings over 40%', search: '2 topics · 2 AI questions', content: '1 rule off, 1 limit changed, 2 paths skipped', metrics: 'GitHub stars, Waitlist' };

/* ---------- Content checks: how a page reads to people and AI answers, ranked by what's at stake ---------- */
// Per page, worst first: [severity, problem, kind · rule, at stake, the passage, why, fix]. Rules run on the
// page's source and its live HTML; the order comes from the page's own searches and AI answer checks.
const READS = {
  '/guides/what-is-a-utm-code': [
    ['high', 'The definition comes in the third paragraph', 'AI answers · answer first', '6,600 searches a month · was #4',
      '<mark>“Marketers have argued about attribution for years. Before we get to the answer, a little history…”</mark>',
      'Google’s snippet and AI answers quote the opening. Two paragraphs of history sit before the answer.', 'Open with one sentence that says what a UTM code is, then the history.'],
    ['mid', 'Never says “UTM parameters” in a heading', 'Search words · query terms', '4,400 searches a month · #18',
      'Headings: “What is a UTM code?” · “How to build one” · “Common mistakes”',
      'People search “utm parameters” more than any wording the page uses.', 'Name a section “The five UTM parameters”.'],
    ['low', 'A 44-word sentence', 'Readability · long sentence', 'Most-read section',
      '<mark>“Because analytics tools read the source, medium and campaign from the link itself, and because they treat capital letters as different values, a link tagged Email in one place and email in another will show up as two separate sources in your reports.”</mark>',
      'Over 25 words is hard to follow on a phone, where 68% of this guide’s visits are.', 'Split it after “link itself”.'],
  ],
  '/guides/google-analytics-mcp-server': [
    ['high', 'Never says “Claude”', 'Search words · query terms', '1,000 searches a month · not showing up',
      'Title, description and headings mention “MCP”, “GA4” and “AI assistant”, never “Claude”.',
      '“claude google analytics” is searched 1,000 times a month and nothing on the site shows up for it.', 'Say which assistants it works with, Claude first, in the lead and one heading.'],
    ['mid', 'No visible “updated” date', 'AI answers · dates', 'Not cited by AI tools yet',
      'Published 3 Nov · <mark>no updated date</mark> · dateModified missing',
      'The guide changed on 14 Nov, but nothing tells readers or AI tools it is current.', 'Show “Updated 14 Nov 2026” under the title and set dateModified.'],
  ],
  '/kauzl-vs-plausible': [
    ['high', 'Doesn’t say who wrote it', 'AI answers · disclosure', 'Gemini skips it for “Plausible alternative”',
      '<mark>“Kauzl and Plausible both promise simple, private analytics…”</mark>',
      'A comparison by one of the two products reads as an ad unless it says so; AI tools trust disclosed comparisons more.', 'Say in the first line that we make Kauzl.'],
    ['mid', 'Thin for its search: 420 words', 'Content · thin', '2,900 searches a month · #22',
      '420 words · 2 sections · no table',
      'Pages that rank for “plausible alternative” cover pricing, privacy and setup.', 'Add a short side-by-side table and a section on moving from Plausible.'],
  ],
  '/pricing': [
    ['mid', '“Simply”, “just” and “easily” 7 times', 'Wording · hedges', 'Whole page',
      'It’s <mark>simply</mark> a matter of connecting GA4. You <mark>just</mark> pick a plan…',
      'Filler words make plans harder to compare and less quotable.', 'Cut them; the sentences say the same without.'],
  ],
  '/guides/ga4-bigquery-export': [
    ['low', '4 FAQ answers start with “It”', 'AI answers · answers stand alone', '6 questions people search',
      'Q: How long does the export take? A: <mark>It</mark> can take up to 24 hours…',
      'An answer quoted on its own needs its subject.', 'Start with “The GA4 export…”.'],
  ],
};
const READS_AT = { '/guides/what-is-a-utm-code': 11000, '/guides/google-analytics-mcp-server': 2900, '/kauzl-vs-plausible': 4200, '/pricing': 1700, '/guides/ga4-bigquery-export': 640 };
function readsCard(path, phone) {
  const list = READS[path];
  if (!list) return `<div class="card"><div class="chhead"><h4>How it reads</h4><span class="muted small2">Checked today</span></div><p class="muted small2" style="margin:0">Nothing to fix in the words. The checks follow the rules in ${ymlTag('content', phone)}.</p></div>`;
  const rows = list.map(([sev, t, rule, stake, quote, why, fix], i) => {
    const on = S.cp === i;
    return `<button type="button" class="crow${on ? ' on' : ''}" data-act="cp:${i}" aria-expanded="${on}"><i class="cdot ${sev}"></i><span class="lname"><b>${t}</b><small>${rule}</small></span><span class="cst">${stake}</span></button>${on ? `<div class="cdet"><div class="cq">${quote}</div><p class="small2"><b>Why</b> ${why}</p><p class="small2"><b>Fix</b> ${fix}</p><span class="chips"><button type="button" class="jbtn primary" data-act="noop">+ To-do</button><button type="button" class="chip" data-act="noop">Copy prompt for Claude Code</button><button type="button" class="chip" data-act="noop">Not a problem here</button></span></div>` : ''}`;
  }).join('');
  return `<div class="card"><div class="chhead"><h4>How it reads</h4><span class="muted small2">${list.length} ${list.length > 1 ? 'problems' : 'problem'} in the words · worst first</span></div><div class="clist">${rows}</div><p class="muted small2" style="margin:0">Ranked by the searches and AI answers each one touches. Rules and limits come from ${ymlTag('content', phone)}.</p></div>`;
}
function contentSection(phone) {
  const rows = Object.entries(READS).map(([p, l]) => ({ p, l, at: READS_AT[p] })).sort((a, b) => b.at - a.at);
  const n = rows.reduce((s, r) => s + r.l.length, 0);
  const pill = (sev) => (sev === 'high' ? 'bad' : sev === 'mid' ? 'warn' : 'off');
  return `<section class="tsec"><div class="tsh"><h3>Is the writing ready?</h3><p>${n} problems on ${rows.length} pages, from Kauzl’s content rules. Most searches at stake first.</p></div>
    <div class="card ixlist">${rows.map((r) => `<button type="button" class="ixrow" data-act="view:pages|pg:${r.p}|pev:ev-content"><span class="lname"><b>${nameOf(r.p)}</b><small>${r.l[0][1]}</small></span><span class="ixe"><small>Problems</small><span class="ixp ${pill(r.l[0][0])}">${r.l.length}</span></span><span class="ixe"><small>At stake</small><span class="small2">${fmt(r.at)} a month</span></span>${ic('fwd', 13)}</button>`).join('')}</div></section>`;
}
// A small tag on anything the file defines; it opens Setup with that block lit.
const ymlTag = (key, phone) => `<button type="button" class="ymltag" data-act="view:setup|yf:${key}" title="Set in the site’s .sitelens.yml">${ic('doc', 11)}.sitelens.yml</button>`;
// Each site's file as Account shows it: [state, line].
const SITE_FILE = {
  kauzl: ['warn', 'kauzl/kauzl/.sitelens.yml · read 2 hours ago · 1 warning'],
  docs: ['ok', 'kauzl/docs/.sitelens.yml · read 2 hours ago'],
  demo: ['off', 'No file yet · using goals Kauzl guessed from its events'],
};
function setupBody(scope, phone) {
  const id = S.setupSite || (scope === 'all' ? 'kauzl' : scope), sx = site(id);
  const back = `<button type="button" class="linkish" data-act="view:account">← Account</button>`;
  if (id !== 'kauzl') {
    const [st, line] = SITE_FILE[id];
    return back + head(`${sx.label} setup`, 'What Kauzl measures for this site', { phone, right: '' }) + (st === 'off'
      ? `<div class="ysrc"><span class="aci">${ic('doc', 15)}</span><span class="lname"><b>No .sitelens.yml yet</b><small>Kauzl is guessing goals from the events the site sends. A file in the repo makes them exact and lets them change with the code.</small></span><span class="chips"><button type="button" class="jbtn primary" data-act="noop">Set it up with Claude</button></span></div>`
      : `<div class="ysrc"><span class="aci ok">${ic('check', 15)}</span><span class="lname"><b>Read from <code>${line.split(' · ')[0]}</code></b><small>${line.split(' · ').slice(1).join(' · ')}</small></span><span class="chips"><button type="button" class="chip" data-act="noop">Reload</button><button type="button" class="chip" data-act="noop">Open on GitHub</button></span></div>`);
  }
  let n = 0;
  const code = YML.map(([k, , , lines]) => {
    const on = S.yf === k;
    return `<div class="yblk${on ? ' on' : ''}" id="y-${k}">${lines.map((l) => { n++; const [t, w] = Array.isArray(l) ? l : [l]; const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(#.*)$/, '<span class="ycm">$1</span>').replace(/^(\s*-?\s*)([a-z_]+):/, '$1<span class="yk">$2</span>:'); return `<span class="yl${w ? ' warn' : ''}"><i>${n}</i><code>${esc}</code>${w ? `<em>${ic('bell', 11)} ${w}</em>` : ''}</span>`; }).join('')}</div>`;
  }).join('');
  const map = YML.filter((b) => b[1]).map(([k, l, [where, act]]) => `<div class="ymap${S.yf === k ? ' on' : ''}"><button type="button" class="ymk" data-act="yf:${k}"><code>${k}:</code><small>${YML_SUM[k]}</small></button><span class="yarr">→</span><button type="button" class="linkish ywhere" data-act="${act}">${where}</button></div>`).join('');
  return back + head(`${sx.label} setup`, 'What Kauzl measures for this site', { phone, right: '' }) +
    `<div class="ysrc"><span class="aci ok">${ic('check', 15)}</span><span class="lname"><b>Read from <code>kauzl/kauzl/.sitelens.yml</code></b><small>main @ a41c2e · 2 hours ago · checked every 10 minutes · 1 warning</small></span><span class="chips"><button type="button" class="chip" data-act="noop">Reload</button><button type="button" class="chip" data-act="noop">Open on GitHub</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Ask Claude to change it</button></span></div>
    <section class="tsec"><div class="tsh"><h3>What the file sets</h3><p>Each part of the file, and where you see it in Kauzl. Things set here show a <span class="ymltag static">${ic('doc', 11)}.sitelens.yml</span> tag.</p></div><div class="card ymapc">${map}</div></section>
    <section class="tsec"><div class="tsh"><h3>The file</h3><p>Change it in the repo, with Claude, or by editing a goal or journey here: Kauzl opens a pull request for you.</p></div><div class="card ycode">${code}</div></section>
    <section class="tsec"><div class="tsh"><h3>Set in Kauzl, not the file</h3><p>Keys and sign-ins never go in the repo</p></div><div class="card acl">${[['search', 'Google Analytics property', 'kauzl.com · 41203…'], ['search', 'Search Console and Bing', 'sc-domain:kauzl.com'], ['commit', 'Repos', 'kauzl/kauzl, kauzl/extension'], ['lock', 'Shared with', '1 person'], ['x', 'Visits left out', 'Your own IP, uptime checks']].map(([i, a, b]) => `<div class="acrow"><span class="aci">${ic(i, 14)}</span><span class="lname"><b>${a}</b><small>${b}</small></span><button type="button" class="icon-btn" data-act="noop" aria-label="Edit ${a}">${ic('more', 15)}</button></div>`).join('')}</div></section>`;
}

/* ---------- Account: the sign-ins and keys behind every site ---------- */
const CONN = [
  { k: 'google', n: 'Google', d: 'Analytics and Search Console', st: 'bad', s: 'Signed out on 17 Nov. Visits and searches stopped updating.', act: 'Sign in again', used: '3 sites' },
  { k: 'bing', n: 'Bing Webmaster', d: 'Bing searches and indexing', st: 'ok', s: 'Updated 2 hours ago', used: '2 sites' },
  { k: 'github', n: 'GitHub', d: 'Commits, releases, stars', st: 'ok', s: '4 repos · updated 10 min ago', used: '3 sites' },
  { k: 'vercel', n: 'Vercel', d: 'Deploys and their logs', st: 'ok', s: 'Updated 1 hour ago', used: '1 site' },
  { k: 'cws', n: 'Chrome Web Store', d: 'Extension users', st: 'ok', s: 'Updated today', used: '1 site' },
  { k: 'firebase', n: 'Firebase', d: 'App users and errors', st: 'off', s: 'Not connected', act: 'Connect' },
];
// Your own sources: everything added through Goals → Add a metric that isn't a built-in connection.
const CUSTOM = [
  { n: 'Lemon Squeezy subscriptions', kind: 'flow', how: 'Steps · 8 steps · every hour', st: 'ok', last: 'ran 12 min ago', feeds: 'Paying customers' },
  { n: 'Billing database', kind: 'd1', how: 'Cloudflare D1 · SQL', st: 'ok', last: 'ran 1 hour ago', feeds: 'MRR' },
  { n: 'api.kauzl.com/stats', kind: 'http', how: 'Any URL · data.waitlist', st: 'ok', last: 'ran 40 min ago', feeds: 'Waitlist' },
  { n: 'Newsletter push link', kind: 'push', how: 'Push link · from a GitHub Action', st: 'ok', last: 'got a number 2 hours ago', feeds: 'Newsletter subscribers' },
  { n: 'Discord members', kind: 'flow', how: 'Steps · 3 steps', st: 'bad', last: 'failed twice: Discord said 401, the key was revoked', feeds: 'Community size', act: 'Fix the key' },
];
const KEYS = [['Cloudflare', 'MRR metric', '•••• 9f2c'], ['Lemon Squeezy', 'Paying customers', '•••• 41aa'], ['Anthropic', 'Ask Claude in the app', '•••• 7d10']];
const TOKENS = [['Claude Code', 'MacBook', '2 min ago'], ['Cursor', 'MacBook', 'yesterday'], ['Claude Desktop', 'MacBook', '6 days ago']];
const CONN_ICON = { google: 'search', bing: 'search', github: 'commit', vercel: 'rocket', cws: 'tag', firebase: 'pulse' };
function accountBody(phone) {
  const bad = CONN.filter((c) => c.st === 'bad');
  const conn = CONN.map((c) => `<div class="acrow"><span class="aci ${c.st}">${ic(CONN_ICON[c.k], 15)}</span><span class="lname"><b>${c.n} <span class="muted acd">${c.d}</span></b><small class="${c.st === 'bad' ? 'down' : ''}">${c.st === 'ok' ? `<span class="dot on"></span> ` : ''}${c.s}${c.used ? ` · ${c.used}` : ''}</small></span>${c.act ? `<button type="button" class="${c.st === 'bad' ? 'jbtn primary' : 'chip'}" data-act="noop">${c.act}</button>` : `<button type="button" class="icon-btn" data-act="noop" aria-label="${c.n} settings">${ic('more', 15)}</button>`}</div>`).join('');
  const custom = CUSTOM.map((c) => `<div class="acrow"><span class="aci ${c.st}">${ic(MS_ICON[c.kind], 15)}</span><span class="lname"><b>${c.n}</b><small class="${c.st === 'bad' ? 'down' : ''}">${c.st === 'ok' ? '<span class="dot on"></span>' : ''}${c.how} · ${c.last}</small><small>Feeds <button type="button" class="linkish acfeed" data-act="view:goals">${c.feeds}</button></small></span>${c.act ? `<button type="button" class="jbtn primary" data-act="noop">${c.act}</button>` : `<button type="button" class="icon-btn" data-act="noop" aria-label="${c.n} settings">${ic('more', 15)}</button>`}</div>`).join('');
  const keys = KEYS.map(([n, u, v]) => `<div class="acrow"><span class="aci">${ic('lock', 14)}</span><span class="lname"><b>${n}</b><small>Used by ${u}</small></span><code class="ackey">${v}</code></div>`).join('');
  const toks = TOKENS.map(([n, d, t]) => `<div class="acrow"><span class="aci">${ic('terminal', 14)}</span><span class="lname"><b>${n}</b><small>${d} · last used ${t}</small></span><button type="button" class="linkish" data-act="noop">Revoke</button></div>`).join('');
  return head('Account', 'Your sites, sign-ins and keys', { phone, right: '' }) +
    `<div class="acme"><span class="avatar big">A</span><span class="lname"><b>Signed in with Google</b><small>3 sites · 1 shared with you</small></span><button type="button" class="chip" data-act="noop">${ic('out', 13)} Sign out</button></div>
    ${bad.length ? `<div class="acwarn">${ic('bell', 15)}<span><b>${bad[0].n} needs you.</b> ${bad[0].s}</span><button type="button" class="jbtn primary" data-act="noop">${bad[0].act}</button></div>` : ''}
    <section class="tsec"><div class="tsh"><h3>Sites</h3><p>Each site’s goals, journeys, alerts and search topics come from a <code class="ic">.sitelens.yml</code> in its repo</p></div><div class="card acl">${SITES.map((x) => { const [st, line] = SITE_FILE[x.id]; return `<button type="button" class="acrow acbtn" data-act="view:setup|setup:${x.id}"><span class="aci ${st === 'warn' ? 'warnc' : st}">${ic(st === 'off' ? 'doc' : st === 'warn' ? 'bell' : 'check', 14)}</span><span class="lname"><b>${x.label}</b><small class="${st === 'warn' ? 'warnt' : ''}">${line}</small></span>${st === 'off' ? '<span class="chip">Set it up</span>' : ic('fwd', 14)}</button>`; }).join('')}<div class="acrow acadd"><button type="button" class="chip" data-act="noop">${ic('plus', 13)} Add a site</button></div></div></section>
    <section class="tsec"><div class="tsh"><h3>Connections</h3><p>Where your numbers come from. Each site picks which of these it uses.</p></div><div class="card acl">${conn}</div></section>
    <section class="tsec"><div class="tsh"><h3>Your own sources</h3><p>APIs, databases and push links you set up yourself. Each one feeds a number in Goals.</p></div><div class="card acl">${custom}<div class="acrow acadd"><button type="button" class="chip" data-act="view:goals|madd:1">${ic('plus', 13)} Add a source</button><span class="muted small2">Any API in steps, a database, a URL, or a push link for anything else</span></div></div></section>
    <section class="tsec"><div class="tsh"><h3>Claude and other agents</h3><p>Agents that read Kauzl and post back to your to-dos</p></div><div class="card acl">${toks}<div class="acrow acadd"><button type="button" class="chip" data-act="noop">${ic('plus', 13)} Connect an agent</button><span class="muted small2">One command for Claude Code, Cursor or Claude Desktop</span></div></div></section>
    <section class="tsec"><div class="tsh"><h3>Keys</h3><p>Stored here, never in a page or a .sitelens.yml</p></div><div class="card acl">${keys}<div class="acrow acadd"><button type="button" class="chip" data-act="noop">${ic('plus', 13)} Add a key</button></div></div></section>
    <section class="tsec"><div class="tsh"><h3>Look</h3></div><div class="seg" role="group" aria-label="Theme"><button type="button" aria-pressed="true">Match the device</button><button type="button" aria-pressed="false">Light</button><button type="button" aria-pressed="false">Dark</button></div></section>
    <p class="muted small2">A site’s own settings (goals, sharing, visits to leave out) live in that site, under its name in the switcher.</p>`;
}

/* ---------- Pages · Speed & errors: how long real visitors wait, and the dead ends they hit ---------- */
// [path, visits a month, phone LCP s, desktop LCP s, what slows it]. LCP at the 75th percentile, from Chrome's field data.
const SPEED = [
  ['/guides/ga4-bigquery-export', 2120, 3.6, 1.8, 'A 1.4 MB screenshot at the top'],
  ['/', 1480, 2.2, 1.1, ''],
  ['/pricing', 980, 2.6, 1.4, 'The plan switch shifts the page as it loads'],
  ['/guides/google-analytics-mcp-server', 640, 4.4, 2.3, 'Three videos load before the text'],
  ['/guides/what-is-a-utm-code', 520, 2.0, 1.2, ''],
  ['/kauzl-vs-plausible', 310, 1.9, 1.0, ''],
];
const DEAD = [['/old-changelog', 41, 'a link in the r/analytics post', 'Changelog'], ['/docs/setup-v1', 12, 'Google, still indexed', 'MCP setup']];
function speedBody(phone) {
  const band = (t) => (t <= 2.5 ? ['Fast', 'up'] : t <= 4 ? ['Slowish', 'warn'] : ['Slow', 'down']);
  const X = (t) => Math.min(98, (t / 5) * 100);
  const cost = (r) => r[1] * Math.max(0, r[2] - 2.5);
  const rows = SPEED.slice().sort((a, b) => cost(b) - cost(a) || b[1] - a[1]);
  const slow = rows.filter((r) => r[2] > 2.5), worst = rows[0];
  const vitals = [['Loads', '2.9 s', 'on phones · fast is under 2.5 s', 'warn', 'Slowish'], ['Responds to taps', '160 ms', 'fast is under 200 ms', 'up', 'Fast'], ['Stays still', '0.18', 'how much it jumps while loading · fine is under 0.1', 'warn', 'Jumpy']];
  const tiles = `<div class="spv">${vitals.map(([l, v, d, c, w]) => `<div class="spt"><span class="muted small2">${l}</span><b>${v}</b><span class="tpill ${c}">${w}</span><small>${d}</small></div>`).join('')}</div>`;
  const head = `<div class="sprow sphead"><span></span><span class="sptr-h"><span style="left:0">0 s</span><span style="left:${X(2.5)}%">2.5 s</span><span style="left:${X(4)}%">4 s</span></span><span class="num">A month</span></div>`;
  const list = rows.map((r) => {
    const [p, v, ph, dt, why] = r, [w, c] = band(ph);
    return `<button type="button" class="sprow" data-act="view:pages|pg:${p}"><span class="lname"><b>${nameOf(p)}</b><small>${ph.toFixed(1)} s on phones · ${dt.toFixed(1)} s on computers${why && ph > 2.5 ? ` · <span class="${c}">${why}</span>` : ''}</small></span>
      <span class="sptr"><span class="spz" style="left:0;width:${X(2.5)}%"></span><span class="spz mid" style="left:${X(2.5)}%;width:${X(4) - X(2.5)}%"></span><span class="spz bad" style="left:${X(4)}%;right:0"></span>
        <span class="spl" style="left:${X(dt)}%;width:${X(ph) - X(dt)}%"></span><span class="spd pc" style="left:${X(dt)}%" title="Computers ${dt} s"></span><span class="spd ph ${c}" style="left:${X(ph)}%" title="Phones ${ph} s"></span></span>
      <span class="num">${fmt(v)}</span></button>`;
  }).join('');
  const ixBad = IX.filter((x) => !x.onPurpose), canon = ixFor('/guides/ga4-bigquery-export');
  const lede = `<p class="lede"><b>${ixBad.length} pages</b> can’t show up properly in search, and the one that matters most is <b>${nameOf(canon.p)}</b>: Google picked a different address for it. On phones, <b>${slow.length} pages</b> are slow.</p>`;
  const dead = DEAD.map(([p, n, from, to]) => `<div class="sdead"><span class="lname"><b>${p}</b><small>${n} visits this month hit a missing page · from ${from}</small></span><button type="button" class="chip" data-act="noop">Send them to ${to}</button></div>`).join('');
  return `${lede}${indexSection(phone)}${contentSection(phone)}
    <section class="tsec"><div class="tsh"><h3>Speed on phones and computers</h3><p>${nameOf(worst[0])} takes ${worst[2]} s on phones. ${worst[4]} is most of it.</p></div><span class="chips"><button type="button" class="chip" data-act="noop">+ To-do: shrink that screenshot</button><button type="button" class="chip" data-act="pop:cmd">${ic('chat', 12)} Why is it slow?</button></span></section>
    <section class="tsec"><div class="tsh"><h3>Across the site</h3><p>What 3 in 4 real visitors get, from Chrome’s own measurements</p></div>${tiles}</section>
    <section class="tsec"><div class="tsh"><h3>Each page</h3><p>Filled dot: phones · hollow: computers · busiest slow pages first</p></div><div class="card spcard">${head}${list}</div></section>
    <section class="tsec"><div class="tsh"><h3>Dead ends</h3><p>Missing pages people actually reached</p></div><div class="card">${dead}</div></section>`;
}
function tabBody(view, tab) {
  if (view === 'pages' && tab === 'cycles') return cyclesBoard();
  if (view === 'pages' && tab === 'pages') return pagesList();
  if (view === 'search' && (tab === 'queries' || !tab)) return searchList();
  if (view === 'search' && tab === 'demand') return demandList();
  const note = (t) => `<span class="muted" style="font-size:12px">${t}</span>`;
  if (view === 'search') {
    if (tab === 'ai') return tabBody0('pages', 'ai');
    if (tab === 'demand') return `<div class="card"><h4>What people search for</h4><div class="rows">${row([['Search', 'muted'], ['A month', 'muted'], ['You', 'muted']])}${row(['google analytics alternative', '9,900', '#14'])}${row(['ga4 bigquery export', '2,400', '#2'])}${row(['plausible vs', '1,300', ['—', 'muted']])}${row(['ga4 mcp server', '880', '#7'])}</div>${note('Volumes from Bing, grouped by the site’s search topics.')}</div>`;
    if (tab === 'indexing') return `<div class="card"><div class="rows">${row([['Page', 'muted'], ['Google', 'muted'], ['Bing', 'muted']])}${row(['/kauzl-vs-plausible', ['Indexed', 'up'], ['Not crawled', 'down']])}${row(['/guides/google-analytics-mcp-server', ['Indexed', 'up'], ['Crawled 2d ago', 'muted']])}${row(['/pricing', ['Indexed', 'up'], ['Indexed', 'up']])}</div><button type="button" class="linkish">Submit new pages to Bing →</button></div>`;
    return `<div class="chips"><button type="button" class="chip on">Google + Bing</button><button type="button" class="chip">Google</button><button type="button" class="chip">Bing</button></div><div class="card"><div class="rows">${row([['Search', 'muted'], ['Google', 'muted'], ['Bing', 'muted'], ['Pos.', 'muted']], 'r4')}${row(['ga4 bigquery export', '212', '31', '2.1'], 'r4')}${row(['kauzl', '140', '22', '1.0'], 'r4')}${row(['ga4 mcp server', '38', '9', '7.4'], 'r4')}${row(['analytics for small sites', '12', '6', '11.8'], 'r4')}</div>${note('Closest wins first: searches where a small move up brings the most clicks.')}</div>`;
  }
  if (view === 'pages' && tab === 'health') return speedBody(S.device === 'phone');
  if (view === 'traffic' && tab === 'posts') return `<div class="card"><div class="rows">${row([['Post or mention', 'muted'], ['Visits', 'muted'], ['Signups', 'muted']])}${row(['r/analytics: “I built…”', '1,140', '9'])}${row(['Hacker News comment', '220', '2'])}${row(['Launch thread on X', '180', '1'])}</div>${note('Each one is also a mark on the Timeline.')}</div>`;
  if (view === 'goals') {
    if (tab === 'pagegoals') return `<div class="card"><div class="pg">${[['/pricing', 'Turn visitors into users', '4.1% sign up', '6%', 68], ['/guides/ga4-bigquery-export', 'Help people who arrive', '62% read to the end', '70%', 88], ['/guides/google-analytics-mcp-server', 'Bring visitors from search', '120 clicks a month', '250', 48], ['/kauzl-vs-plausible', 'Bring visitors from search', 'position 11', 'top 5', 30]].map(([pg, g, now, tgt, w]) => `<div class="pgrow"><span class="lbl"><b>${pg}</b><small>${g} · now ${now}, aiming for ${tgt}</small></span><span class="prog"><i style="width:${w}%"></i></span></div>`).join('')}</div>${note('Each goal is set on the page’s own view (Pages → a page). This lists them all, closest to done first.')}</div>`;
    if (tab === 'product') return `<div class="card"><div class="rows">${row(['GitHub stars', '+34', ['↑ 2×', 'up']])}${row(['Chrome extension installs', '58', ['↑ 12%', 'up']])}${row(['App users (Firebase)', '410', ['↓ 3%', 'down']])}${row(['MRR (custom metric)', '$1,240', ['↑ 8%', 'up']])}</div>${note('From the integrations connected to this site’s product.')}</div>`;
    return `<div class="card"><div class="rows">${row([['Goal', 'muted'], ['28 days', 'muted'], ['vs before', 'muted']])}${row(['Sign-ups', '212', ['↑ 14%', 'up']])}${row(['Activated', '96', ['↑ 5%', 'up']])}${row(['Extension installs', '58', ['↑ 12%', 'up']])}</div><button type="button" class="linkish" data-act="view:journeys|tab:funnels">Where people drop out: Funnels →</button></div>`;
  }
  return tabBody0(view, tab);
}
function tabBody0(view, tab) {
  if (view === 'pages') {
    if (tab === 'cycles') return `<div class="card"><h4>This cycle · 4 Nov – 2 Dec</h4><div class="rows">${row(['GA4 BigQuery export', 'Grow', ['↑', 'up']])}${row(['What is a UTM code', 'Improve', ['→', 'muted']])}${row(['Old changelog page', 'Cut', ['↓', 'down']])}</div></div>`;
    if (tab === 'ai') return `<div class="card"><h4>Questions people ask AI tools</h4><div class="rows">${row(['Best GA4 alternative for small sites', 'ChatGPT', ['Cited', 'up']])}${row(['How to export GA4 to BigQuery', 'Perplexity', ['Cited', 'up']])}${row(['Plausible vs Kauzl', 'Gemini', ['Not yet', 'muted']])}</div></div>`;
    return `<div class="card"><div class="rows">${row([['Page', 'muted'], ['Visits', 'muted'], ['Google', 'muted'], ['AI', 'muted']], 'r4')}${[['/pricing', '612', '#4', 1], ['/guides/ga4-bigquery-export', '488', '#2', 1], ['/guides/google-analytics-mcp-server', '301', '#7', 0], ['/kauzl-vs-plausible', '144', '#11', 1]].map(([p, v, g, a]) => row([p, v, g, a ? ['Cited', 'up'] : ['—', 'muted']], 'r4')).join('')}</div><span class="muted" style="font-size:12px">Each page opens its own view: searches, AI answers and what to change.</span></div>`;
  }
  if (view === 'traffic') {
    if (tab === 'campaigns') return `<div class="card"><h4>Tagged links</h4><div class="rows">${row(['launch-week / reddit', '420', ['↑ 3×', 'up']])}${row(['newsletter / nov', '186', ['↑ 12%', 'up']])}${row(['producthunt / launch', '74', ['↓ 40%', 'down']])}</div></div>`;
    if (tab === 'ads') return `<div class="card"><p class="muted">Google Ads isn’t linked to this GA4 property, so there’s nothing to show yet.</p><button type="button" class="linkish">How to link it →</button></div>`;
    return `<div class="card"><div class="rows">${row(['Google', '2,140', ['↑ 24%', 'up']])}${row(['Direct', '980', ['—', 'muted']])}${row(['ChatGPT', '310', ['↑ 60%', 'up']])}${row(['Reddit', '190', ['↓ 12%', 'down']])}${row(['Bing', '120', ['↑ 8%', 'up']])}</div></div>`;
  }
  if (tab === 'funnels' || tab === 'paths') {
    const vals = tab === 'funnels' ? [['Landed', 100], ['/pricing', 62], ['Signed up', 18], ['Activated', 9]] : [['/ → /pricing', 34], ['/guides/* → /', 21], ['/pricing → /signup', 18], ['/ → left', 41]];
    return `<div class="card"><h4>${tab === 'funnels' ? 'Signup funnel' : 'Most common paths'}</h4><div class="bars">${vals.map(([l, v]) => `<div class="bar"><span>${l}</span><i style="width:${v}%"></i><span>${v}%</span></div>`).join('')}</div></div>`;
  }
  return `<div class="card"><h4>Came back in week…</h4><div class="rows">${row(['Week 1', '24%', ''])}${row(['Week 2', '15%', ''])}${row(['Week 4', '9%', ''])}</div></div>`;
}
function sectionBody(view, scope, phone) {
  const sec = SECTIONS[view];
  if (scope === 'all') return pickSite(sec.l, `${sec.q}. Pick a site:`, phone, view);
  const tab = sec.tabs.some(([k]) => k === S.tab) ? S.tab : sec.tabs[0][0];
  const raw = view === 'journeys' ? `<p class="rawlink">Raw data: <button type="button" class="linkish" data-act="raw:events">Events</button> · <button type="button" class="linkish" data-act="raw:sql">SQL</button></p>` : '';
  return head(sec.l, `${sec.q} · ${site(scope).label}`, view === 'goals' && !phone ? { phone, right: rangeCtl(false) + '<button type="button" class="chip" data-act="noop">Edit goals</button>' } : { phone }) +
    `<div class="tabsrow" role="tablist">${sec.tabs.map(([k, l]) => `<button type="button" class="${k === tab ? 'on' : ''}" data-act="tab:${k}">${l}</button>`).join('')}</div>` + tabBody(view, tab) + raw;
}
function rawBody(scope, phone) {
  const r = RAW.find(([k]) => k === S.raw) || RAW[0];
  const body = r[0] === 'sql'
    ? `<div class="card"><pre class="sql">SELECT event_name, COUNT(*) AS n
FROM events
WHERE date >= '2026-10-21'
GROUP BY 1 ORDER BY n DESC</pre></div><p class="muted" style="font-size:13px">Most questions are quicker in plain words: <button type="button" class="linkish" data-act="view:timeline|ask:0">Ask Claude</button></p>`
    : `<div class="card"><div class="rows">${row(['page_view', '18,204', ''])}${row(['sign_up', '212', ''])}${row(['checkout_start', '96', ''])}</div></div>`;
  return head(r[1], r[2], { phone, crumb: ['Journeys', 'view:journeys', 'Raw data'] }) + body;
}

function goAfter(kind, arg) {
  return kind === 'site' ? `scope:${arg}|view:timeline` : kind === 'inbox' ? 'view:inbox' : kind === 'report' ? 'view:traffic|tab:campaigns' : '';
}
function afterBody(phone) {
  const v = S.view, sc = S.scope;
  if (v === 'account') return accountBody(phone);
  if (v === 'setup') return setupBody(sc, phone);
  if (v === 'story') return calendarBody(sc, phone, false);
  if (v === 'inbox') return inboxBody(sc, phone);
  if (v === 'live') return liveBody(sc, phone, goAfter);
  if (v === 'timeline') return calendarBody(sc, phone, false);
  if (v === 'tools') return toolsBody(sc, phone);
  if (v === 'raw') return sc === 'all' ? pickSite('Raw data', 'Pick a site:', phone, 'journeys') : rawBody(sc, phone);
  if (v === 'journeys' && sc !== 'all') return journeysBody(sc, phone);
  if (v === 'traffic' && sc !== 'all') return trafficBody(sc, phone);
  if (v === 'goals' && sc !== 'all') return goalsBody(sc, phone);
  if (v === 'search' && sc !== 'all' && S.tab !== 'ai') return searchBody(sc, phone);
  if (v === 'pages' && sc !== 'all' && S.page && PAGE_Q[S.page]) return pageStory(sc, phone);
  return sectionBody(v, sc, phone);
}
function scopeBtn(phone) {
  const small = S.scope === 'all' ? `${SITES.length} sites` : site(S.scope).host;
  return `<button type="button" class="scope" data-act="pop:scopes" aria-expanded="${S.pop === 'scopes'}">${LOGO(phone ? 24 : 28)}<span class="who"><b>${scopeName(S.scope)}</b><small>${small}</small></span>${ic('updown', 15)}</button>`;
}
function liveLink() {
  const n = liveFor(S.scope);
  return `<button type="button" class="livelink${S.view === 'live' ? ' on' : ''}" data-act="view:live"><span class="dot${n ? ' on' : ''}"></span><span><b>${n}</b> on now</span><span class="go">See who →</span></button>`;
}
function scopeRows() {
  return `<button type="button" class="row${S.scope === 'all' ? ' on' : ''}" data-act="scope:all">${ic('grid')}<b>All sites</b><span class="meta"><span>${liveFor('all')} now</span></span></button><hr>` +
    SITES.map((s) => `<div class="row${S.scope === s.id ? ' on' : ''}" data-act="scope:${s.id}" role="button" tabindex="0"><span class="dot${s.live ? ' on' : ''}"></span>${s.label}<span class="meta"><span>${s.live} now</span>${inboxCount(s.id) ? `<span>· ${inboxCount(s.id)} waiting</span>` : ''}<span class="gear" title="Site settings" aria-label="${s.label} settings">${ic('gear', 14)}</span></span></div>`).join('') +
    `<hr><button type="button" class="row" data-act="noop">${ic('plus')}Add a site</button>`;
}
function navAfter() {
  const n = inboxCount(S.scope);
  return shownViews().map(([k, l, i]) => {
    const on = S.view === k || (k === 'journeys' && S.view === 'raw');
    const count = k === 'inbox' && n ? `<span class="count">${n}</span>` : '';
    return `${k === 'pages' ? '<span class="navlab">Reports</span>' : ''}<button type="button" class="item${on ? ' on' : ''}" data-act="view:${k}">${ic(i)}<span>${k === 'story' && S.scope === 'all' ? 'Sites' : l}</span>${count}</button>`;
  }).join('');
}
function userPop() {
  return `<div class="pop user"><button type="button" class="row" data-act="noop">${ic('plug')}Integrations</button><button type="button" class="row" data-act="noop">${ic('terminal')}MCP</button><button type="button" class="row" data-act="noop">${ic('moon')}Theme</button><hr><button type="button" class="row" data-act="noop">${ic('out')}Sign out</button></div>`;
}
// Phone "More": Live up top, then a tile per view with one live fact each, then the rest as rows.
const MORE_VIEWS = [['traffic', 'arrows', 'Traffic', 'Google 44% · AI answers rising'], ['journeys', 'route', 'Journeys', '1 in 30 sign up'], ['goals', 'target', 'Goals', ''], ['tools', 'terminal', 'Diagnose', 'Check any page']];
function morePop() {
  const n = liveFor(S.scope), behind = S.scope === 'all' ? 0 : goalsFor(S.scope).filter((g) => g.st === 'behind').length;
  const views = MORE_VIEWS.filter(([k]) => k !== 'journeys' || hasWh(S.scope));
  const tile = ([k, i, l, fact]) => `<button type="button" class="mtile${S.view === k ? ' on' : ''}" data-act="view:${k}"><span class="mti">${ic(i, 18)}</span><b>${l}</b><small>${k === 'goals' ? (behind ? `<span class="down">${behind} behind</span>` : 'All on track') : fact}</small>${k === 'goals' && behind ? `<span class="badge">${behind}</span>` : ''}</button>`;
  const row = (act, i, l, m = '') => `<button type="button" class="row" data-act="${act}">${ic(i)}${l}${m ? `<span class="meta">${m}</span>` : ''}</button>`;
  return `<div class="morep"><span class="mhead">${scopeName(S.scope)}</span>
    <button type="button" class="mlive${S.view === 'live' ? ' on' : ''}" data-act="view:live"><span class="dot${n ? ' on' : ''}"></span><span><b>${n} on now</b><small>${S.scope === 'demo' ? 'Chicago, Toronto, Miami' : 'Berlin, Austin, Bengaluru'}</small></span><span class="go">See who →</span></button>
    <div class="mtiles">${views.map(tile).join('')}</div>
    <div class="mrows">${hasWh(S.scope) ? row('raw:events', 'layers', 'Raw data', 'Events, SQL') : ''}${row('view:account', 'gear', 'Account', 'Sites, sign-ins, keys')}</div></div>`;
}
function cmdBox() {
  return `<div class="scrim" data-act="close"></div><div class="cmd" role="dialog" aria-label="Jump to"><input id="cmd-q" placeholder="Jump to a site, page or report, or ask a question…" autocomplete="off"><div class="res" id="cmd-res"></div></div>`;
}
function cmdResults(q) {
  const cur = S.scope === 'all' ? 'kauzl' : S.scope;
  const cl = site(cur).label;
  const list = [
    ...ASKS.map(([t], i) => ({ t, m: 'Ask Claude', a: `scope:${cur}|view:timeline|ask:${i}`, i: 'chat' })),
    ...SITES.map((s) => ({ t: s.label, m: 'Site', a: `scope:${s.id}|view:timeline`, i: 'grid' })),
    { t: 'All sites', m: 'Scope', a: 'scope:all|view:timeline', i: 'grid' },
    ...shownViews().map(([k, l, i]) => ({ t: l, m: scopeName(S.scope), a: `view:${k}`, i })),
    { t: 'Live', m: scopeName(S.scope), a: 'view:live', i: 'pulse' },
    ...Object.entries(SECTIONS).filter(([k]) => k !== 'journeys' || hasWh(cur)).flatMap(([k, sec]) => sec.tabs.map(([tk, tl]) => ({ t: tl, m: `${sec.l} · ${cl}`, a: `scope:${cur}|view:${k}|tab:${tk}`, i: 'layers' }))),
    ...(hasWh(cur) ? RAW.map(([k, l]) => ({ t: l, m: `Raw data · ${cl}`, a: `scope:${cur}|raw:${k}`, i: 'terminal' })) : []),
    { t: '/pricing', m: 'Page · kauzl.com', a: 'scope:kauzl|view:pages', i: 'doc' },
    { t: 'GA4 BigQuery export guide', m: 'Page · kauzl.com', a: 'scope:kauzl|view:pages', i: 'doc' },
  ];
  const ql = q.trim().toLowerCase();
  const hits = ql ? list.filter((x) => x.t.toLowerCase().includes(ql) || x.m.toLowerCase().includes(ql)) : list.slice(0, 9);
  return hits.slice(0, 9).map((x) => `<button type="button" class="row" data-act="${x.a}">${ic(x.i, 15)}${x.t}<small>${x.m}</small></button>`).join('') || '<p class="empty" style="padding:8px">No match.</p>';
}

function afterDesktop() {
  const dr = drawer();
  return `<div class="app d${dr ? (S.stack.length && stackTop().k === 'page' ? ' has-wide' : ' has-drawer') : ''}">
    <aside class="sb">
      ${scopeBtn(false)}
      ${S.pop === 'scopes' ? `<div class="pop scopes">${scopeRows()}</div>` : ''}
      ${liveLink()}
      <button type="button" class="jump" data-act="pop:cmd">${ic('search', 14)}Jump to or ask…<kbd>⌘K</kbd></button>
      <nav class="nav" aria-label="Views">${navAfter()}</nav>
      <div class="sb-foot">
        ${S.pop === 'user' ? userPop() : ''}
        <button type="button" class="me${S.view === 'account' || S.view === 'setup' ? ' on' : ''}" data-act="view:account"><span class="avatar">A</span><span class="who"><b>Account</b><small><span class="dot on"></span>Google connected</small></span></button>
      </div>
    </aside>
    <div class="main">${afterBody(false)}</div>
    ${dr}
    ${S.pop === 'cmd' ? cmdBox() : ''}
  </div>`;
}
const PHONE_TABS = [['timeline', 'Timeline', 'calendar'], ['inbox', 'Inbox', 'inbox'], ['pages', 'Pages', 'doc'], ['search', 'Search', 'search'], ['more', 'More', 'more']];
function afterPhone() {
  const n = inboxCount(S.scope);
  const inMore = ['traffic', 'journeys', 'goals', 'live', 'raw', 'account', 'setup'].includes(S.view) || S.pop === 'more';
  const sheet = (inner) => `<div class="scrim" data-act="close"></div><div class="sheet pop" style="position:absolute"><span class="grab"></span>${inner}</div>`;
  return `<div class="app p">
    <header class="pt">
      ${scopeBtn(true)}
      <select id="ph-range" aria-label="Period">${RANGES.map(([k, l]) => `<option value="${k}"${S.range === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="icon-btn" data-act="pop:cmd" aria-label="Jump to or ask">${ic('search', 15)}</button>
      <button type="button" class="avatar" style="border:0;cursor:pointer" data-act="view:account" aria-label="Account">A</button>
    </header>
    <div class="main">${afterBody(true)}</div>
    <nav class="tabbar" aria-label="Views">${PHONE_TABS.map(([k, l, i]) => `<button type="button" class="${S.view === k || (k === 'more' && inMore) ? 'on' : ''}" data-act="${k === 'more' ? 'pop:more' : `view:${k}`}" ${k === 'more' ? `aria-expanded="${S.pop === 'more'}"` : ''}>${k === 'more' && inMore && S.pop !== 'more' ? ic(({ timeline: 'calendar', traffic: 'arrows', journeys: 'route', goals: 'target', live: 'pulse', raw: 'layers', account: 'gear', setup: 'gear' })[S.view]) : ic(i)}${k === 'inbox' && n ? `<span class="badge">${n}</span>` : ''}<span>${k === 'story' && S.scope === 'all' ? 'Sites' : k === 'more' && inMore && S.pop !== 'more' ? ({ timeline: 'Timeline', traffic: 'Traffic', journeys: 'Journeys', goals: 'Goals', live: 'Live', raw: 'Raw data', account: 'Account', setup: 'Setup' })[S.view] : l}</span></button>`).join('')}</nav>
    ${S.pop === 'scopes' ? sheet(scopeRows()) : ''}
    ${S.pop === 'more' ? sheet(morePop()) : ''}
    ${S.pop === 'day' ? sheet(dayPanel(S.scope, S.cal.day)) : ''}
    ${S.pop === 'leak' && S.jleak != null ? sheet(leakPanel(S.scope, S.jleak)) : ''}
    ${S.pop === 'src' && S.src ? sheet(sourcePanel(S.src)) : ''}
    ${S.pop === 'todo' && S.todo ? sheet(todoPanel(S.todo)) : ''}
    ${S.pop === 'ix' && S.ix ? sheet(ixPanel(S.ix)) : ''}
    ${S.pop === 'bot' && S.bot && S.page ? sheet(botPanel(S.page)) : ''}
    ${S.pop === 'q' && S.q ? sheet(queryPanel(S.q)) : ''}
    ${S.pop === 'user' ? sheet(userPop().replace('<div class="pop user">', '<div style="display:grid;gap:1px">')) : ''}
    ${S.stack.length ? `<div class="scrim" data-act="pclear"></div><div class="sheet pop" style="position:absolute"><span class="grab"></span>${panel(true)}</div>` : ''}
    ${S.pop === 'cmd' ? cmdBox() : ''}
  </div>`;
}

/* ---------- Today ---------- */
const B_ITEMS_GLOBAL = [['sites', 'Sites', 'grid'], ['todosAll', 'All to-dos', 'check'], ['alertsAll', 'All alerts', 'bell'], ['liveAll', 'Live now', 'pulse'], ['add', 'Add a site', 'plus']];
const B_ITEMS_SITE = [['story', 'Story', 'sparkles'], ['live', 'Live', 'pulse'], ['todos', 'To-dos', 'check'], ['alerts', 'Alerts', 'bell'], ['timeline', 'Timeline', 'calendar'], ['explore', 'Explore', 'layers']];
function beforeCount(k) {
  const sc = S.bSite;
  const c = { sites: SITES.length, todosAll: INBOX.filter((m) => m.k === 'todo').length, alertsAll: INBOX.filter((m) => m.k === 'alert').length, liveAll: liveFor('all'), live: site(sc).live, todos: inboxFor(sc).filter((m) => m.k === 'todo').length, alerts: inboxFor(sc).filter((m) => m.k === 'alert').length }[k];
  return c ? `<span class="count">${k.startsWith('live') ? `<span class="dot on"></span>` : ''}${c}</span>` : '';
}
function beforeNav() {
  const it = ([k, l, i]) => `<button type="button" class="item${S.b === k ? ' on' : ''}" data-act="b:${k}">${ic(i)}<span>${l}</span>${beforeCount(k)}</button>`;
  return `<nav class="nav">${B_ITEMS_GLOBAL.map(it).join('')}</nav>
    <span class="label">Site</span>
    <select class="fake-select" id="b-site" aria-label="Site">${SITES.map((s) => `<option value="${s.id}"${S.bSite === s.id ? ' selected' : ''}>${s.label}${s.id === 'demo' ? ' (sample)' : ''}</option>`).join('')}</select>
    <nav class="nav">${B_ITEMS_SITE.map(it).join('')}</nav>
    <div class="sb-foot">
      <button type="button" class="item${S.b === 'mcp' ? ' on' : ''}" data-act="b:mcp">${ic('terminal')}<span>MCP</span></button>
      <button type="button" class="item${S.b === 'account' ? ' on' : ''}" data-act="b:account">${ic('lock')}<span>Account</span></button>
      <div class="foot-row"><span style="display:flex;gap:6px;align-items:center"><span class="dot on"></span>Google connected</span>${ic('moon', 15)}</div>
      <button type="button" class="signout">Sign out</button>
    </div>`;
}
function beforeBody(phone) {
  const sc = S.bSite, b = S.b, go = () => 'noop';
  const saved = { inboxF: S.inboxF, range: S.range };
  let html;
  if (b === 'sites') html = storyBody('all', phone, (k, a) => k === 'site' ? `b-site:${a}` : 'noop');
  else if (b === 'todosAll' || b === 'alertsAll' || b === 'todos' || b === 'alerts') {
    S.inboxF = b.startsWith('todo') ? 'todo' : 'alert';
    const all = b.endsWith('All');
    const items = inboxFor(all ? 'all' : sc).filter((m) => m.k === S.inboxF);
    html = head(all ? (S.inboxF === 'todo' ? 'To-dos' : 'All alerts') : (S.inboxF === 'todo' ? 'To-dos' : 'Alerts'), all ? 'Every site' : site(sc).label, { phone, right: '' }) +
      `<div class="inbox">${items.map((m) => `<div class="msg"><span class="k ${m.k}">${ic(m.k === 'alert' ? 'bell' : 'check', 14)}</span><span>${all ? `<span class="tag">${site(m.site).label}</span>` : ''}${m.t}</span><small>${m.s}</small></div>`).join('') || '<p class="empty">Nothing here.</p>'}</div>`;
  } else if (b === 'liveAll') html = liveBodyToday('all', phone, go);
  else if (b === 'live') html = liveBodyToday(sc, phone, go);
  else if (b === 'story') html = storyBody(sc, phone, go).replace('<button type="button" class="icon-btn" aria-label="Site settings" title="Site settings">' + ic('gear', 15) + '</button>', '');
  else if (b === 'timeline') html = timelineBody(sc, phone);
  else if (b === 'explore') {
    html = head('Explore', `Every full report for ${site(sc).label}. The Story links here for detail.`, { phone, right: phone ? '' : `<div class="mini-seg"><button class="on">90d</button></div>` }) +
      `<div class="tabsrow">${OLD_TABS.map((t) => `<button type="button" class="${S.bTab === t ? 'on' : ''}" data-act="btab:${t}">${t}</button>`).join('')}</div>
       <div class="card"><h4>${S.bTab}</h4><p class="muted">Pages opens at 90 days because it keeps its own period; the Story you came from was on 28.</p></div>`;
  } else if (b === 'account' || b === 'add') {
    html = head('Account', 'Sign-ins and keys, once for all your sites', { phone, right: '' }) + `<div class="tabsrow"><button>Integrations</button><button>MCP</button><button class="on">Sites &amp; products</button></div>
      <div class="card"><div class="rows">${SITES.map((s) => `<div class="r"><span>${s.label}</span><span></span><span class="linkish">Edit</span></div>`).join('')}</div><p class="muted">A site's goals, sharing and left-out visits are edited here, three clicks from the site.</p></div>`;
  } else html = head('MCP', 'Connect Claude to Kauzl', { phone, right: '' }) + '<div class="card"><p class="muted">Setup steps…</p></div>';
  S.inboxF = saved.inboxF;
  return html;
}
function beforeDesktop() {
  return `<div class="app d">
    <aside class="sb">
      <div class="brand">${LOGO(26)}Kauzl<span class="count" style="margin-left:auto;font-size:11.5px;color:var(--text-3);display:flex;gap:5px;align-items:center;font-weight:500"><span class="dot on"></span>${site(S.bSite).live} now</span></div>
      ${beforeNav()}
    </aside>
    <div class="main">${beforeBody(false)}</div>
  </div>`;
}
function beforePhone() {
  return `<div class="app p">
    <header class="pt" style="justify-content:space-between">
      <div class="brand">${LOGO(24)}Kauzl</div>
      <span style="display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--text-2)"><span class="dot on"></span>${site(S.bSite).live} now</span>
      <button type="button" class="icon-btn" style="width:38px;height:38px" data-act="bmenu" aria-label="${S.bMenu ? 'Close menu' : 'Open menu'}">${ic(S.bMenu ? 'x' : 'menu', 18)}</button>
    </header>
    <div class="main" style="position:relative">${beforeBody(true)}</div>
    ${S.bMenu ? `<div class="bmenu">${beforeNav()}</div>` : ''}
  </div>`;
}


/* ---------- One day, every way (the gallery under the prototype) ---------- */
const GAL_DAYS = [['2026-11-04', 'pricing page shipped'], ['2026-11-11', 'signups alert'], ['2026-11-15', 'Reddit post']];
const LEAD_FOCUS = { landing: '/pricing', sources: 'Reddit', searches: 'kauzl', countries: 'India' };
const galCell = (date, ctx, phone) => calCell('kauzl', date, ctx, phone, true)
  .replace('<button type="button" class="cday sel"', '<div class="cday"').replace('<button type="button" class="cday"', '<div class="cday"')
  .replace(/ data-act="[^"]*"/, '').replace(/<\/button>$/, '</div>');
function galleryHTML() {
  const date = S.g, all = Object.keys(KINDS), d = day('kauzl', date);
  const nov = monthDays('2026-11').filter((x) => x <= LAST);
  const mx = (m) => Math.max(...nov.map((x) => day('kauzl', x).v[m]));
  const pick = `<div class="chips">${GAL_DAYS.map(([dd, l]) => `<button type="button" class="chip${S.g === dd ? ' on' : ''}" data-act="g-d:${dd}">${new Date(tOf(dd)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${l}</button>`).join('')}</div>`;
  const howMuch = CAL_METRICS.map(([m, l]) => {
    const c1 = { lens: 'change', metric: m, focus: null, layers: all, max: mx(m) }, c2 = { ...c1, lens: 'amount' };
    const c = d.v[m] / Math.max(1e-9, d.usual[m]) - 1;
    return `<div class="grow"><div class="gl"><b>${l}</b><small>${fmtM(m, d.v[m])} against a usual ${fmtM(m, d.usual[m])} (<span class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</span>)${m === 'revenue' ? '. From GA4 purchases or Stripe.' : m === 'conv' ? '. Signups per visit: a busy day isn’t always a good one.' : ''}</small></div><div class="gc">${galCell(date, c1, false)}<span>vs usual</span></div><div class="gc">${galCell(date, c2, false)}<span>Amount</span></div><div class="gc galp">${galCell(date, c1, true)}<span>Phone</span></div></div>`;
  }).join('');
  const whatLed = Object.entries(LEADS).map(([lens, L]) => {
    const c1 = { lens, metric: 'visits', focus: null, layers: all, max: 1 }, c2 = { ...c1, focus: LEAD_FOCUS[lens] };
    const top = d[L.key][0];
    return `<div class="grow"><div class="gl"><b>${L.name}</b><small>Top: ${top.p}, ${Math.round(top.share * 100)}% of ${L.of === 'clicks' ? 'search clicks' : 'visits'}. Picking one shows its own number every day.</small></div><div class="gc">${galCell(date, c1, false)}<span>Named when it jumps</span></div><div class="gc">${galCell(date, c2, false)}<span>Picked: ${LEAD_FOCUS[lens]}</span></div><div class="gc galp">${galCell(date, c1, true)}<span>Phone</span></div></div>`;
  }).join('');
  return `${pick}<h3 class="gh">How much <small>follows the metric tiles</small></h3><div class="gtab">${howMuch}</div><h3 class="gh">What led <small>the day’s winner</small></h3><div class="gtab">${whatLed}</div>`;
}

/* ---------- Render + events ---------- */
const stage = document.getElementById('stage');
const hint = document.getElementById('hint');
function render() {
  document.querySelectorAll('[data-act^="mode:"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.act === `mode:${S.mode}`));
  document.querySelectorAll('[data-act^="device:"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.act === `device:${S.device}`));
  stage.className = `stage${S.device === 'phone' ? ' phone' : ''}`;
  stage.innerHTML = S.mode === 'after' ? (S.device === 'phone' ? afterPhone() : afterDesktop()) : (S.device === 'phone' ? beforePhone() : beforeDesktop());
  hint.textContent = S.device === 'phone' ? 'Tap anything: the tabs, a day, the site chip.' : 'Click anything: the sidebar, a day on the Timeline, a search, a source. Sample data.';
  const gal = document.getElementById('gallery');
  if (gal) gal.innerHTML = galleryHTML();
  const q = document.getElementById('cmd-q');
  if (q) { const res = document.getElementById('cmd-res'); res.innerHTML = cmdResults(''); q.focus({ preventScroll: true }); q.addEventListener('input', () => { res.innerHTML = cmdResults(q.value); }); q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = res.querySelector('[data-act]'); if (f) run(f.dataset.act); } }); }
  wireChart();
  const jp = document.getElementById('jpaste');
  if (jp) jp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run('j-add'); } });
  const pr = document.getElementById('ph-range');
  if (pr) pr.addEventListener('change', () => { S.range = pr.value; render(); });
  const bs = document.getElementById('b-site');
  if (bs) bs.addEventListener('change', () => { S.bSite = bs.value; if (['sites', 'todosAll', 'alertsAll', 'liveAll', 'add', 'account', 'mcp'].includes(S.b)) S.b = 'story'; S.bMenu = false; render(); });
}
function run(acts) {
  let close = true;
  for (const a of acts.split('|')) {
    const [k, v] = a.split(':');
    if (k === 'mode') { S.mode = v; S.pop = null; S.bMenu = false; }
    else if (k === 'device') { S.device = v; S.pop = null; S.bMenu = false; try { localStorage.setItem('kz-nav-device', v); } catch (e) {} }
    else if (k === 'scope') { S.scope = v; S.ask = null; S.cal.focus = null; if (!hasWh(v) && (S.view === 'journeys' || S.view === 'raw')) S.view = 'timeline'; }
    else if (k === 'pday' || k === 'ppage' || k === 'ptodo') {
      const it = { k: k.slice(1), v };
      const top = S.stack[S.stack.length - 1];
      if (top && top.k === it.k && top.v === it.v) {} else S.stack.push(it);
      S.pev = null; S.pmore = false; S.pall = false; S.ptrack = null;
    }
    else if (k === 'pswap') { if (S.stack.length) S.stack[S.stack.length - 1] = { k: 'day', v }; }
    else if (k === 'pback') { S.stack.pop(); S.pev = null; }
    else if (k === 'pto') { S.stack.length = Number(v) + 1; S.pev = null; }
    else if (k === 'ptrack') { S.ptrack = S.ptrack === v ? null : v; S.pev = null; }
    else if (k === 'tpage') { S.tpage = v; S.tres = null; }
    else if (k === 'tres') S.tres = null;
    else if (k === 'trun') { S.runs.push({ d: LAST, p: S.tpage, t: v }); S.tres = v; }
    else if (k === 'pclear') { S.stack = []; S.pop = null; }
    else if (k === 'pfull') {
      const it = S.stack[S.stack.length - 1];
      if (it.k === 'page') { S.view = 'pages'; S.tab = 'pages'; S.page = it.v; S.stack = []; }
      else if (it.k === 'day') { S.view = 'timeline'; S.tab = null; S.page = null; S.cal.month = it.v.slice(0, 7); S.cal.day = it.v; S.cal.zoom = 'month'; S.stack = []; }
      else if (it.k === 'todo') { S.view = 'inbox'; S.tab = null; S.page = null; S.stack = [it]; }
    }
    else if (k === 'view') { S.stack = []; S.view = v; S.tab = null; S.ask = null; S.inboxF = 'all'; S.srange = null; S.cal.day = null; S.jleak = null; S.jedit = false; S.page = null; S.src = null; S.q = null; S.madd = false; S.msrc = null; S.todo = null; S.yf = null; }
    else if (k === 'tab') S.tab = v;
    else if (k === 'raw') { S.view = 'raw'; S.raw = v; }
    else if (k === 'ask') S.ask = +v < 0 ? null : +v;
    else if (k === 'cal-m') { S.cal.metric = v; if (S.cal.lens !== 'amount') S.cal.lens = 'change'; S.cal.focus = null; }
    else if (k === 'cal-l') { S.cal.lens = v; S.cal.focus = null; S.cal.dtab = null; }
    else if (k === 'cal-t') S.cal.dtab = v;
    else if (k === 'cal-z') { S.cal.zoom = v; S.srange = null; }
    else if (k === 'cal-v') { S.cal.view = v; S.srange = null; }
    else if (k === 'cal-ym') S.cal.month = v;
    else if (k === 'cal-mo') { const i = YEAR_MONTHS.indexOf(S.cal.month) + Number(v); if (i >= 0 && i < 12) S.cal.month = YEAR_MONTHS[i]; }
    else if (k === 'cal-d') { S.cal.day = v === 'none' ? null : v; S.srange = null; if (S.cal.day) followDay(S.cal.day); }
    else if (k === 'ch-m') S.chartMode = v;
    else if (k === 'pg') { S.page = v === 'none' ? null : v; S.pdet = false; S.bot = null; S.cp = null; S.pev = null; S.pmore = false; S.pall = false; S.ptrack = null; }
    else if (k === 'pev') { S.pev = S.pev === v ? 'none' : v; S.patt = null; }
    else if (k === 'patt') S.patt = S.patt === v ? null : v;
    else if (k === 'pmore') S.pmore = !S.pmore;
    else if (k === 'pquiet') S.pquiet = !S.pquiet;
    else if (k === 'pall') { S.pall = !S.pall; if (!S.pall) S.pev = null; }
    else if (k === 'pdet') S.pdet = !S.pdet;
    else if (k === 'cp') S.cp = S.cp === Number(v) ? null : Number(v);
    else if (k === 'src') S.src = v === 'none' ? null : v;
    else if (k === 'todo') { S.todo = v === 'none' ? null : v; S.thist = false; }
    else if (k === 'thist') S.thist = !S.thist;
    else if (k === 'ix') S.ix = v === 'none' ? null : v;
    else if (k === 'yf') { S.yf = v; S.setupSite = S.scope === 'all' ? 'kauzl' : S.scope; }
    else if (k === 'setup') S.setupSite = v;
    else if (k === 'bot') { S.bot = v === 'none' ? null : v; S.botV = 0; }
    else if (k === 'botv') S.botV = Number(v);
    else if (k === 'botraw') S.botRaw = v === '1';
    else if (k === 'botas') { S.botAs = v; S.botRaw = v === 'gpt'; }
    else if (k === 'tg') S.tg = v === 'none' ? null : v;
    else if (k === 'madd') { S.madd = v === '1'; S.msrc = null; }
    else if (k === 'msrc') { S.msrc = v === 'none' ? null : v; S.pushGot = false; }
    else if (k === 'fadd') { const f = S.flow || (S.flow = FLOW0.map((x) => x.slice())); const dflt = { keep: ['keep', 'attributes.plan', 'is', 'pro'], map: ['map', 'attributes.created_at', 'attributes.total'], math: ['math', 'total', '100'], distinct: ['distinct', 'customer_id'], group: ['group', 'created_at', 'Day'], reduce: ['reduce', 'Count'], running: ['running'], avg7: ['avg7'], more: ['more', 'links.next'] }[v] || [v]; f.push(dflt.slice()); S.fpeek = null; }
    else if (k === 'fdel') { const f = S.flow || (S.flow = FLOW0.map((x) => x.slice())); f.splice(Number(v), 1); S.fpeek = null; }
    else if (k === 'fpeek') S.fpeek = S.fpeek === Number(v) ? null : Number(v);
    else if (k === 'pusht') S.pushT = v;
    else if (k === 'pushgot') S.pushGot = true;
    else if (k === 'msave') {
      const nm = document.getElementById('mf-name')?.value || 'New metric', tg = (document.getElementById('mf-target')?.value || '').replace(/[^0-9.]/g, '');
      const base = { github: 1284, cws: 412, ga4: 141, firebase: 410, d1: 1240, http: 312, flow: 37, push: 860, manual: 860 }[v];
      S.metrics = [...(S.metrics || METRICS0).filter((m) => m.name !== nm), { name: nm, src: v, from: 'just added', v: base, unit: v === 'd1' ? '$' : '', chg: 0, target: tg ? Number(tg) : null, by: document.getElementById('mf-by')?.value || '', on: ['story', 'timeline'], up: true }];
      S.madd = false; S.msrc = null; S.flow = null; S.fpeek = null; S.pushGot = false;
    }
    else if (k === 'q') S.q = v === 'none' ? null : decodeURIComponent(v);
    else if (k === 'qs') S.qAll = S.qAll === v ? null : v;
    else if (k === 'out') S.outAll = !S.outAll;
    else if (k === 'qt') S.qtable = !S.qtable;
    else if (k === 'eng') S.eng = v;
    else if (k === 'lad') S.ladAll = !S.ladAll;
    else if (k === 'pf') S.pfilter = v;
    else if (k === 'ps') S.psort = v;
    else if (k === 'j-goal') { S.jgoal = v; S.jleak = null; }
    else if (k === 'j-leak') S.jleak = v === 'none' ? null : Number(v);
    else if (k === 'j-edit') { S.jedit = v === '1'; S.jleak = null; }
    else if (k === 'j-by') S.jby = v;
    else if (k === 'j-routes') S.jroutes = v;
    else if (k === 'j-reset') delete S.jsteps[S.jgoal];
    else if (k === 'j-rm') { const l = jSteps(); l.splice(Number(v), 1); S.jsteps[S.jgoal] = l.map((x, i) => (i ? [x[0], x[1], x[2]] : x)); }
    else if (k === 'j-sug' || k === 'j-add') {
      let step = null;
      if (k === 'j-sug') { const [kind, val] = JSUGGEST[Number(v)]; step = [kind, val, kind === 'page' ? `Visited ${val}` : `Did ${val}`]; }
      else {
        const raw = (document.getElementById('jpaste')?.value || '').trim();
        if (raw) {
          if (/^https?:\/\//i.test(raw) || raw.startsWith('/') || /^[\w-]+(\.[\w-]+)+\//.test(raw)) {
            let path = raw;
            try { path = new URL(/^https?:/i.test(raw) ? raw : raw.startsWith('/') ? `https://x${raw}` : `https://${raw}`).pathname; } catch (e) {}
            step = ['page', path, `Visited ${path}`];
          } else step = ['event', raw.replace(/\s+/g, '_'), `Did ${raw}`];
        }
      }
      if (step) { const l = jSteps().map((x, i) => (i ? [x[0], x[1], x[2]] : x)); l.push(step); S.jsteps[S.jgoal] = l; }
    }
    else if (k === 'ch-r') { S.srange = v.split('~'); S.cal.day = null; }
    else if (k === 'ch-x') S.srange = null;
    else if (k === 'ch-s') S.tsort = [v, S.tsort[0] === v && S.tsort[1] === 'desc' ? 'asc' : 'desc'];
    else if (k === 'ch-copy' && CH) {
      const csv = ['day,visits,usual,signups,revenue'].concat(CH.ds.map((d, i) => [d, CH.rows[i].v.visits, Math.round(CH.rows[i].usual.visits), CH.rows[i].v.signups, CH.rows[i].v.revenue].join(','))).join('\n');
      try { navigator.clipboard.writeText(csv).catch(() => {}); } catch (e) {}
      S.copied = true;
      setTimeout(() => { S.copied = false; render(); }, 1600);
    }
    else if (k === 'cal-c') S.cal.cmp = v;
    else if (k === 'g-d') S.g = v;
    else if (k === 'cal-r') S.cal.rank = v;
    else if (k === 'cal-mx') S.cal.mxAll = !S.cal.mxAll;
    else if (k === 'cal-end') { S.cal.end = v; S.cal.day = v; }
    else if (k === 'cal-sh') {
      if (S.cal.zoom === 'month') { const i = YEAR_MONTHS.indexOf(S.cal.month) + Number(v); if (i >= 0 && i < 12) S.cal.month = YEAR_MONTHS[i]; }
      else { const n = ROLL[S.cal.zoom] || 1; let t = tOf(S.cal.end) + Number(v) * n * DAYMS; t = Math.min(tOf(LAST), Math.max(tOf(FIRST) + (n - 1) * DAYMS, t)); S.cal.end = isoOf(t); }
    }
    else if (k === 'cal-k') S.cal.layers = S.cal.layers.includes(v) ? S.cal.layers.filter((x) => x !== v) : [...S.cal.layers, v];
    else if (k === 'cal-f') S.cal.focus = S.cal.focus === v ? null : v;
    else if (k === 'range') S.range = v;
    else if (k === 'inboxF') S.inboxF = v;
    else if (k === 'pop') { S.pop = S.pop === v ? null : v; close = false; }
    else if (k === 'close') S.pop = null;
    else if (k === 'b') { S.b = v; S.bMenu = false; }
    else if (k === 'b-site') { S.bSite = v; S.b = 'story'; }
    else if (k === 'btab') S.bTab = v;
    else if (k === 'bmenu') S.bMenu = !S.bMenu;
    else if (k === 'noop') { S.pop = null; }
  }
  if (close && !acts.startsWith('pop:') && !acts.startsWith('inboxF') && !acts.startsWith('range') && !acts.startsWith('cal-k')) S.pop = null;
  render();
}
document.addEventListener('click', (e) => {
  const gear = e.target.closest('.gear');
  if (gear) { e.stopPropagation(); S.pop = null; render(); hint.textContent = 'The gear opens that site’s settings directly: one click instead of Account → Sites & products → Edit.'; return; }
  const el = e.target.closest('[data-act]');
  if (el) { run(el.dataset.act); return; }
  if (S.pop && stage.contains(e.target) && !e.target.closest('.pop, .cmd')) { S.pop = null; render(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && S.mode === 'after') { e.preventDefault(); S.pop = 'cmd'; render(); }
  else if (e.key === 'Escape' && (S.pop || S.bMenu)) { S.pop = null; S.bMenu = false; render(); }
  else if (e.key === 'Enter' && e.target.matches?.('[role="button"][data-act]')) run(e.target.dataset.act);
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S.mode === 'after' && S.view === 'timeline' && !S.pop && !e.target.matches?.('input, select, textarea')) {
    const cur = S.cal.zoom === 'day' ? S.cal.end : S.cal.day;
    if (!cur || S.cal.zoom === 'year') return;
    const nd = addD(cur, e.key === 'ArrowLeft' ? -1 : 1);
    if (nd < FIRST || nd > LAST) return;
    e.preventDefault();
    run(S.cal.zoom === 'day' ? `cal-end:${nd}` : `cal-d:${nd}`);
  }
});
syncPageEvents();
// --- tour start (scripts/build-tour.mjs) ---
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el && el.dataset && el.dataset.botas) run('botas:' + ['google', 'bing', 'gpt'][el.selectedIndex]);
});
{
  const p = new URLSearchParams(location.search);
  const TO = { story: 'view:timeline', timeline: 'view:timeline', inbox: 'view:inbox', todos: 'view:inbox', alerts: 'view:inbox',
    pages: 'view:pages', cycles: 'view:pages|tab:cycles', health: 'view:pages|tab:health', search: 'view:search', ai: 'view:search|tab:ai',
    traffic: 'view:traffic', campaigns: 'view:traffic', journeys: 'view:journeys', funnels: 'view:journeys', goals: 'view:goals', outcomes: 'view:goals', live: 'view:live' };
  if (p.get('device') === 'phone' || p.get('device') === 'desktop') S.device = p.get('device');
  else if (window.innerWidth < 760) S.device = 'phone';
  if (p.get('embed') === '1') document.body.classList.add('embed');
  const to = TO[p.get('to')];
  if (to) run(to); else render();
}
