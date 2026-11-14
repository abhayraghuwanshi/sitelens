// The public home page of hosted Kauzl: what it is, and Open Kauzl.
// Served at / to visitors without a session (signed-in people get the app
// there) and at /home for everyone. HTML and CSS with no inline script; the
// owl's eye-tracking comes from the free tools' site.js when those are served
// (same origin), and the page works without it. Styled like the free tools
// (tools/assets/site.css): ink, amber, the owl, grey before / amber after.

// Same drawing and class names as tools/assets/lib/owl.js, so the tools'
// site.js can move its eyes. Kept here because the server image ships without tools/.
const BODY = 'M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z';
export function owl(size = 64, { variant = 'ink', className = '' } = {}) {
  const body = variant === 'paper' ? '#F6F7F9' : '#121522';
  const white = variant === 'paper' ? '#121522' : '#FFFFFF';
  return `<svg class="owl ${className}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><path d="${BODY}" fill="${body}"/><g class="eyes"><circle cx="22.5" cy="34" r="9.5" fill="${white}"/><circle cx="41.5" cy="34" r="9.5" fill="${white}"/><g class="pupils"><circle class="before" cx="22.5" cy="34" r="4.2" fill="none" stroke="#F5A524" stroke-width="2.6"/><circle cx="41.5" cy="34" r="5" fill="#F5A524"/></g></g><path d="M32 44 L28.8 47.6 L32 52 L35.2 47.6 Z" fill="#F5A524"/></svg>`;
}

export const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="#121522"/><path d="M14 30 L15 9 L27 18 L37 18 L49 9 L50 30 L50 41 Q50 56 32 56 Q14 56 14 41 Z" fill="#F6F7F9"/><circle cx="25" cy="35" r="7" fill="#F5A524"/><circle cx="39" cy="35" r="7" fill="#F5A524"/></svg>')}`;

export const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap';

const icon = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  story: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h6"/><path d="M8 11h6"/>',
  timeline: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/><circle cx="12" cy="15" r="1.5"/>',
  campaigns: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ai: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 12h.01"/><path d="M12 12h.01"/><path d="M15 12h.01"/>',
  todos: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
  claude: '<path d="M4 17l6-5-6-5"/><path d="M12 19h8"/>',
  'did-it-work': '<path d="M4 19h16"/><path d="M7 15v-3"/><path d="M11 15V9"/><path d="M15 15V6"/><path d="M19 15V4"/>',
  'ai-robots-txt-generator': '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
};
const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// What's inside: each feature as a small picture of its real screen, linked
// to that part of the demo (/demo?to=<view>, server/hosted.mjs).
const BENTO = [
  { key: 'story', size: 'wide', title: 'The Story', to: 'story',
    text: 'Open a site and read what happened, in sentences: what moved, why, and what shipped around then. No reports to build.',
    visual: `<div class="v-story">
      <p class="v-lead">Sign-ups rose <b class="good">18%</b> after the pricing change.</p>
      <svg viewBox="0 0 300 80" class="v-chart" aria-hidden="true">
        <polyline class="prev" points="0,58 30,56 60,59 90,55 120,57 150,54 180,56 210,53 240,55 270,52 300,54"/>
        <polyline class="now" points="0,62 30,57 60,60 90,58 120,55 150,40 180,36 210,30 240,33 270,26 300,22"/>
        <line class="flag" x1="150" y1="6" x2="150" y2="76"/><circle class="dot" cx="150" cy="40" r="4"/>
        <text x="156" y="13">Pricing page v2</text>
      </svg>
      <div class="v-chips"><span>/pricing <b class="good">+41%</b></span><span>Reddit <b class="good">+225%</b></span><span>Google <b class="good">+12%</b></span></div>
    </div>` },
  { key: 'ai', title: 'AI answers', to: 'ai',
    text: 'Ask ChatGPT, Claude, Gemini and Perplexity what your customers ask. See if they name you, cite you, or send visitors.',
    visual: `<div class="v-ai">
      <p class="v-q">What’s a good privacy-friendly analytics tool?</p>
      <ol class="v-a"><li>Plausible</li><li class="you">Your site <span class="pill">named · cited</span></li><li>Fathom</li></ol>
      <p class="v-foot">Named by <b>3 of 4</b> assistants this week</p>
    </div>` },
  { key: 'timeline', title: 'Timeline', to: 'timeline',
    text: 'Every day on one calendar, with your releases, deploys, posts and mentions on it. A spike explains itself.',
    visual: `<div class="v-week" aria-hidden="true">
      ${[['Mon', 34, ''], ['Tue', 38, 'deploy'], ['Wed', 41, ''], ['Thu', 88, 'reddit'], ['Fri', 63, ''], ['Sat', 30, ''], ['Sun', 28, '']].map(([d, h, m]) => `<div class="day${m ? ` has ${m}` : ''}"><span class="mark">${m === 'deploy' ? 'v2.3' : m === 'reddit' ? 'Post' : ''}</span><i style="height:${h}%"></i><span class="d">${d}</span></div>`).join('')}
    </div>` },
  { key: 'campaigns', title: 'Campaigns', to: 'campaigns',
    text: 'Every tagged link and Google Ads spend, measured against what matters: sign-ups, installs, sales.',
    visual: `<table class="v-camp" aria-hidden="true"><tbody>
      ${[['reddit / social', 31, 100], ['newsletter / email', 24, 77], ['google / cpc', 6, 19]].map(([n, v, w]) => `<tr><td>${n}</td><td class="bar"><i style="width:${w}%"></i></td><td class="num">${v}</td></tr>`).join('')}
    </tbody></table><p class="v-foot">Sign-ups by campaign, last 28 days</p>` },
  { key: 'todos', title: 'To-dos that report back', to: 'todos',
    text: 'Turn a finding into a change. Tick it off when it ships, and Kauzl checks whether it helped.',
    visual: `<div class="v-todo">
      <p class="v-task"><span class="tick" aria-hidden="true">✓</span> Rewrite the pricing headline <span class="muted">shipped Nov 3</span></p>
      <div class="v-ba"><span>Before</span><span class="t"><i style="width:70%"></i></span><b>12/day</b><span>After</span><span class="t a"><i style="width:88%"></i></span><b>15/day</b></div>
      <p class="v-foot"><b class="good">+25%</b> · probably real, 3 weeks of data</p>
    </div>` },
  { key: 'claude', size: 'full', title: 'Inside Claude', to: null,
    text: 'An MCP server for Claude Code and Claude. Your agent reads the numbers, works through your to-dos and writes up what it changed.',
    visual: `<pre class="v-term" aria-label="Example conversation with Claude using Kauzl"><span class="you">you ›</span> why did sign-ups dip last week?
<span class="tool">● kauzl.daily_metrics</span>(site: "acme", range: "28d")
<span class="tool">● kauzl.day_story</span>(date: "2026-11-04")
<span class="ai">claude ›</span> Sign-ups fell 22% on Nov 4, the day the
         checkout deploy shipped. Mobile Safari
         conversions went to zero. I added a
         to-do to roll it back.</pre>` },
];

const SOURCES = ['Google Analytics', 'Search Console', 'Bing', 'BigQuery', 'GitHub', 'Chrome Web Store', 'Reddit', 'Hacker News'];

const GUIDES = [
  ['track-chatgpt-traffic-google-analytics', 'Track ChatGPT and AI traffic in GA4', 'Where AI visits hide in Google Analytics, and a regex to group them.'],
  ['did-a-website-change-work', 'How to tell if a website change worked', 'A fair before/after method for redesigns, launches and pricing changes.'],
  ['search-console-vs-google-analytics', 'Search Console vs Google Analytics', 'Eight reasons clicks and sessions never match.'],
];

const FREE_TOOLS = [
  ['did-it-work', 'Did it work?', 'Paste daily numbers from before and after a change. Find out if the jump is real.'],
  ['utm-builder', 'UTM Builder', 'Tag campaign links for GA4, in bulk, with naming checks.'],
  ['ai-robots-txt-generator', 'AI robots.txt', 'Block AI training crawlers but stay visible in AI search.'],
];

const CSS = `
:root { color-scheme: light; --ink: #121522; --ink-2: #1C2135; --ink-line: #2A3048; --ink-text: #C9CDD8; --amber: #F5A524; --before: #9AA1B2;
  --bg: #F6F7F9; --surface: #FFFFFF; --sunk: #EEF0F4; --text: #121522; --text-2: #3A3F50; --muted: #5B6172; --line: #E3E6EC; --link: #A35F00;
  --good: #1F7A3D; --good-soft: #E4F4E9; --amber-soft: #FDF1DC;
  --head: "Bricolage Grotesque", "Inter", system-ui, sans-serif; --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --bg: #0C0E17; --surface: #161A28; --sunk: #10131D; --text: #F6F7F9; --text-2: #C9CDD8; --muted: #9AA1B2; --line: #262B3D; --link: #F5B84A; --good: #5FD08A; --good-soft: #13291C; --amber-soft: #2E2410; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--link); }
h1, h2, h3 { font-family: var(--head); letter-spacing: -0.02em; line-height: 1.1; }
.wrap { max-width: 1120px; margin: 0 auto; padding-inline: 24px; }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }

svg.owl { display: block; flex: none; overflow: visible; }
svg.owl .pupils { transition: transform .18s ease-out; }
svg.owl .eyes { transform-box: fill-box; transform-origin: center; animation: blink 7s infinite; }
@keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(.08); } 97% { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { svg.owl .eyes { animation: none; } }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: 11px; font: 600 15px var(--font); text-decoration: none; border: 1px solid transparent; white-space: nowrap; transition: filter .15s, border-color .15s; }
.btn.amber { background: var(--amber); color: var(--ink); }
.btn.amber:hover { filter: brightness(1.06); }
.btn.ghost { border-color: var(--ink-line); color: #F6F7F9; }
.btn.ghost:hover { border-color: var(--ink-text); }
.btn.small { min-height: 36px; padding: 7px 14px; font-size: 14px; }

/* header */
.top { background: var(--ink); color: #F6F7F9; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--ink-line); }
.top .wrap { display: flex; align-items: center; gap: 24px; height: 64px; }
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
.word { font: 800 26px/1 var(--head); letter-spacing: -0.045em; }
nav.links { display: flex; gap: 22px; margin-left: auto; font-size: 15px; }
nav.links a { color: var(--ink-text); text-decoration: none; }
nav.links a:hover { color: #fff; }

/* hero */
.hero { background: var(--ink); color: #F6F7F9; position: relative; overflow: hidden; padding: 64px 0 88px; }
.hero::before, .final::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgb(255 255 255 / .07) 1px, transparent 1.2px); background-size: 22px 22px; pointer-events: none; }
.hero::before { mask-image: linear-gradient(90deg, transparent, #000 60%); }
.hero-in { position: relative; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 56px; align-items: center; }
.eyebrow { margin: 0 0 18px; font: 600 13px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--amber); }
.hero h1 { font-size: clamp(42px, 6.6vw, 76px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.02; margin: 0 0 20px; }
.hero h1 em { font-style: normal; color: var(--amber); }
.lead { font-size: 19px; color: var(--ink-text); margin: 0 0 30px; max-width: 32em; }
.ctas { display: flex; flex-wrap: wrap; gap: 12px; }
.perks { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 22px 0 0; font-size: 14px; color: var(--ink-text); }
.perks li { display: inline-flex; align-items: center; gap: 6px; } .perks svg { color: var(--amber); }

/* the Story card, with the owl perched on top */
.story-wrap { position: relative; padding-top: 58px; }
.story-wrap > svg.owl { position: absolute; top: 0; right: 36px; z-index: 2; filter: drop-shadow(0 10px 18px rgb(0 0 0 / .35)); }
.story { position: relative; margin: 0; background: var(--surface); color: var(--text); border-radius: 20px; padding: 24px; box-shadow: 0 30px 70px rgb(0 0 0 / .4); }
.story-top { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--muted); }
.story-top .sample { font-weight: 600; color: var(--link); background: var(--amber-soft); padding: 1px 8px; border-radius: 99px; }
.story h2 { font-size: 22px; line-height: 1.25; margin: 10px 0 12px; letter-spacing: -0.02em; }
.up { color: var(--good); font-weight: 700; }
.story svg.chart { width: 100%; height: auto; display: block; margin: 4px 0 6px; }
.chart .prev { stroke: var(--before); } .chart .now { stroke: var(--amber); } .chart .mark { stroke: var(--muted); } .chart .dot { fill: var(--amber); }
.chart text { fill: var(--muted); font: 600 9px var(--font); }
.legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted); margin-bottom: 14px; }
.legend span::before { content: ""; display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 6px; vertical-align: middle; background: var(--before); }
.legend span:last-child::before { background: var(--amber); }
.moved { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: var(--text-2); }
.moved li { display: flex; gap: 10px; align-items: baseline; }
.moved b { color: var(--text); font-weight: 600; }
.story-link { display: inline-block; margin-top: 16px; font-size: 14px; font-weight: 600; color: var(--link); text-decoration: none; }
.story-link:hover { text-decoration: underline; }
.tag { flex: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 6px; background: var(--ink); color: var(--amber); }

/* sections */
section { padding: 72px 0 0; }
.kicker { margin: 0 0 8px; font: 600 13px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--link); }
h2.title { font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.035em; margin: 0 0 10px; }
p.sub { color: var(--text-2); margin: 0 0 32px; max-width: 40em; font-size: 17px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 1px 2px rgb(18 21 34 / .04); }
.card h3 { margin: 16px 0 8px; font-size: 19px; }
.card p { margin: 0; color: var(--text-2); font-size: 15px; }
.ic { width: 44px; height: 44px; border-radius: 12px; background: var(--ink); color: var(--amber); display: grid; place-items: center; }
/* What's inside: a bento of small product pictures */
.bento { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.b-card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 22px; transition: border-color .15s, transform .15s, box-shadow .15s; min-width: 0; }
.b-card:hover { border-color: var(--amber); transform: translateY(-2px); box-shadow: 0 16px 36px rgb(18 21 34 / .1); }
.b-card.wide { grid-column: span 2; }
.b-card.full { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 8px 28px; align-items: center; background: var(--ink); color: #F6F7F9; border-color: var(--ink-line); }
.b-card.full .b-text { color: var(--ink-text); } .b-card.full .b-vis { grid-row: 1 / span 3; grid-column: 2; margin: 0; background: #0B0D16; border: 1px solid var(--ink-line); }
.b-card.full .b-link { color: var(--amber); }
.b-head { display: flex; align-items: center; gap: 12px; }
.b-head h3 { margin: 0; font-size: 19px; }
.b-text { margin: 10px 0 14px; font-size: 15px; color: var(--text-2); }
.b-vis { flex: 1; background: var(--sunk); border-radius: 14px; padding: 16px; margin-bottom: 14px; font-size: 13px; min-width: 0; }
.b-link { font-size: 14px; font-weight: 600; color: var(--link); text-decoration: none; }
.b-link:hover { text-decoration: underline; }
.good { color: var(--good); }
.v-foot { margin: 10px 0 0; color: var(--muted); font-size: 12.5px; }
.v-lead { margin: 0 0 6px; font: 700 17px/1.3 var(--head); letter-spacing: -0.01em; }
.v-chart { width: 100%; height: auto; display: block; }
.v-chart polyline { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.v-chart .prev { stroke: var(--before); stroke-dasharray: 4 4; stroke-width: 2; } .v-chart .now { stroke: var(--amber); }
.v-chart .flag { stroke: var(--muted); stroke-dasharray: 3 3; } .v-chart .dot { fill: var(--amber); }
.v-chart text { fill: var(--muted); font: 600 7px var(--font); }
.v-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.v-chips span { background: var(--surface); border: 1px solid var(--line); border-radius: 99px; padding: 3px 10px; }
.v-q { margin: 0 0 10px; background: var(--ink); color: #F6F7F9; border-radius: 12px 12px 4px 12px; padding: 8px 12px; margin-left: 18%; }
.v-a { margin: 0; padding: 10px 12px 10px 30px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px 12px 12px 4px; margin-right: 10%; }
.v-a li { padding: 2px 0; } .v-a li.you { font-weight: 700; }
.pill { font-size: 11px; font-weight: 700; color: var(--good); background: var(--good-soft); padding: 1px 7px; border-radius: 99px; margin-left: 4px; }
.v-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; height: 132px; align-items: end; }
.v-week .day { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
.v-week i { display: block; width: 100%; border-radius: 6px 6px 3px 3px; background: var(--before); }
.v-week .has i { background: var(--amber); }
.v-week .mark { font-size: 10px; font-weight: 700; color: var(--link); min-height: 14px; }
.v-week .d { font-size: 11px; color: var(--muted); }
.v-camp { width: 100%; border-collapse: collapse; }
.v-camp td { padding: 6px 0; } .v-camp td:first-child { white-space: nowrap; padding-right: 10px; color: var(--text-2); }
.v-camp .bar { width: 50%; } .v-camp .bar i { display: block; height: 10px; border-radius: 4px; background: var(--amber); }
.v-camp .num { text-align: right; font-weight: 700; padding-left: 8px; font-variant-numeric: tabular-nums; }
.v-task { margin: 0 0 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-weight: 600; }
.v-task .tick { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; background: var(--amber); color: var(--ink); font-size: 12px; }
.v-task .muted { font-weight: 400; color: var(--muted); font-size: 12px; }
.v-ba { display: grid; grid-template-columns: auto 1fr auto; gap: 8px 10px; align-items: center; }
.v-ba .t { height: 12px; border-radius: 4px; background: var(--surface); overflow: hidden; } .v-ba .t i { display: block; height: 100%; background: var(--before); border-radius: 4px; }
.v-ba .t.a i { background: var(--amber); }
.v-term { margin: 0; font: 13px/1.7 ui-monospace, "SF Mono", Menlo, monospace; color: #D8DBE5; white-space: pre; overflow-x: auto; }
.v-term .you { color: var(--amber); font-weight: 700; } .v-term .tool { color: #8FB3FF; } .v-term .ai { color: #7EE2A8; font-weight: 700; }

.steps { counter-reset: s; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; position: relative; }
.steps .card::before { counter-increment: s; content: counter(s); display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--amber); color: var(--ink); font: 800 17px var(--head); }
.steps .card h3 { margin-top: 14px; }

/* why an owl */
.owl-why { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 40px; align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 36px 40px; }
.owl-why h2 { font-size: clamp(26px, 3.2vw, 34px); font-weight: 800; margin: 0 0 10px; letter-spacing: -0.03em; }
.owl-why p { margin: 0 0 10px; color: var(--text-2); max-width: 38em; }
.owl-why .say { font-size: 14px; color: var(--muted); margin: 0; }
.eyes-key { display: flex; gap: 22px; margin: 16px 0 4px; font-size: 14px; color: var(--text-2); }
.eyes-key span { display: inline-flex; align-items: center; gap: 8px; }
.eyes-key i { width: 14px; height: 14px; border-radius: 50%; border: 3px solid var(--amber); }
.eyes-key span + span i { background: var(--amber); }

.sources { display: flex; flex-wrap: wrap; gap: 10px; }
.sources span { padding: 8px 15px; border-radius: 99px; border: 1px solid var(--line); background: var(--surface); font-size: 14px; font-weight: 500; color: var(--text-2); }

.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.tile { display: flex; flex-direction: column; text-decoration: none; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px; transition: border-color .15s, transform .15s, box-shadow .15s; }
.tile:hover { border-color: var(--amber); transform: translateY(-2px); box-shadow: 0 14px 30px rgb(18 21 34 / .1); }
.tile h3 { margin: 14px 0 6px; font-size: 18px; }
.tile p { margin: 0 0 14px; font-size: 14px; color: var(--text-2); flex: 1; }
.tile .go { font-size: 14px; font-weight: 600; color: var(--link); }
.more { margin: 16px 0 0; font-size: 15px; }
.sub-h { margin: 40px 0 16px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.tile .kick { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--link); }

.final { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 36px; align-items: center; background: var(--ink); color: #F6F7F9; border-radius: 28px; padding: 44px; }
.final > * { position: relative; }
.final h2 { font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.035em; margin: 16px 0 10px; }
.final p { color: var(--ink-text); margin: 0 0 24px; max-width: 30em; }
.bars-card { background: var(--ink-2); border: 1px solid var(--ink-line); border-radius: 18px; padding: 20px; font-size: 13px; color: var(--ink-text); }
.bars { display: flex; align-items: flex-end; gap: 14px; height: 150px; margin-top: 12px; }
.bars i { flex: 1; border-radius: 8px; } .bars .b { height: 52%; background: var(--before); } .bars .a { height: 90%; background: var(--amber); }
.keys { display: flex; gap: 14px; margin-top: 8px; } .keys span { flex: 1; text-align: center; }

footer { margin-top: 72px; padding: 36px 0 48px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer .wrap { display: flex; justify-content: space-between; align-items: center; gap: 16px 32px; flex-wrap: wrap; }
.foot-brand { display: flex; gap: 12px; align-items: center; }
.foot-brand p { margin: 0; } .foot-brand .word { font-size: 22px; color: var(--text); }
footer nav { display: flex; gap: 18px; flex-wrap: wrap; } footer nav a { color: var(--muted); text-decoration: none; } footer nav a:hover { color: var(--text); }
@media (prefers-color-scheme: dark) {
  .final, .ic, .tag { border: 1px solid var(--ink-line); }
  /* Ink owls would vanish on dark cards: draw them light. */
  .foot-brand svg.owl path:first-child, .owl-why svg.owl path:first-child { fill: #F6F7F9; }
  .foot-brand svg.owl .eyes > circle, .owl-why svg.owl .eyes > circle { fill: var(--ink); }
}

@media (max-width: 900px) {
  .hero-in, .final { grid-template-columns: minmax(0, 1fr); }
  .hero { padding: 44px 0 100px; }
  .grid, .steps, .tiles, .bento { grid-template-columns: minmax(0, 1fr); }
  .b-card.wide, .b-card.full { grid-column: auto; }
  .b-card.full { grid-template-columns: minmax(0, 1fr); } .b-card.full .b-vis { grid-row: auto; grid-column: auto; }
  .owl-why { grid-template-columns: minmax(0, 1fr); padding: 28px; gap: 20px; }
  nav.links { display: none; }
  .top .wrap { justify-content: space-between; }
}
@media (max-width: 480px) { .wrap { padding-inline: 16px; } .final { padding: 28px; } section { padding-top: 56px; } }
`;

// tools: the free tools are served at /tools/ (TOOLS_ORIGIN is set), so link
// them and borrow their site.js for the owl's moving eyes.
export function homePage({ signedIn = false, tools = false, ga = '' } = {}) {
  const enter = signedIn ? '/' : '/login';
  const toolsLink = (html) => (tools ? html : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kauzl · You shipped it. Did it work?</title>
<meta name="description" content="Did what you shipped work? Kauzl puts releases, posts and campaigns on the same timeline as traffic, search and AI answers.">
<link rel="canonical" href="https://kauzl.com/">
<meta property="og:title" content="Kauzl · You shipped it. Did it work?"><meta property="og:description" content="Kauzl lines up every change you ship with what happened next: traffic, search, mentions and AI answers."><meta property="og:type" content="website">
<meta name="theme-color" content="#121522">
<!-- Site ownership: Google Search Console and Bing Webmaster Tools -->
<meta name="google-site-verification" content="qnLsBOH7W_9FmBJnJ5bKtOJWl1kb0Xk0DHUlPoOr2cs">
<meta name="msvalidate.01" content="C64479D40ED0CEA5FE903AFE5EBF9C42">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style></head>
<body data-page="home:">
<header class="top"><div class="wrap">
  <a class="brand" href="/home" aria-label="Kauzl home">${owl(30, { variant: 'paper' })}<span class="word">kauzl</span></a>
  <nav class="links" aria-label="Sections"><a href="/demo">Demo</a><a href="#features">Features</a><a href="#how">How it works</a>${toolsLink('<a href="/tools/">Free tools</a><a href="/guides/">Guides</a>')}</nav>
  <a class="btn amber small" href="${enter}">Open Kauzl</a>
</div></header>

<main>
  <div class="hero"><div class="wrap hero-in">
    <div>
      <p class="eyebrow">Analytics for people who ship</p>
      <h1>You shipped it.<br><em>Did it work?</em></h1>
      <p class="lead">Kauzl puts your releases, posts and campaigns on the same timeline as your traffic, search and AI answers. It tells you what moved, why, and what to do next.</p>
      <div class="ctas">
        <a class="btn amber" href="/demo">See the live demo</a>
        <a class="btn ghost" href="${enter}">Open Kauzl</a>
      </div>
      <ul class="perks"><li>${CHECK}Demo needs no sign-up</li><li>${CHECK}${signedIn ? 'You’re signed in' : 'Early access, invite only'}</li><li>${CHECK}No tracking script</li><li>${CHECK}Read-only Google access</li></ul>
    </div>

    <div class="story-wrap">
      ${owl(78, { variant: 'paper' })}
      <figure class="story" aria-label="Example: a site’s Story">
        <div class="story-top"><span>What happened · last 28 days</span><span class="sample">Sample</span></div>
        <h2>Visits were up <span class="up">32%</span> on the previous 28 days: 548, against 415.</h2>
        <svg class="chart" viewBox="0 0 320 96" role="img" aria-label="Visits per day this period against the previous one, with a spike the day after a Reddit post">
          <polyline class="prev" fill="none" stroke-width="2" stroke-dasharray="4 4" points="0,70 40,68 80,71 120,66 160,69 200,67 240,65 280,63 320,60" />
          <polyline class="now" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="0,74 20,68 40,72 60,64 80,66 100,58 120,62 140,24 160,52 180,58 200,50 220,54 240,46 280,42 300,48 320,38" />
          <line class="mark" x1="140" y1="12" x2="140" y2="92" stroke-dasharray="3 3" />
          <circle class="dot" cx="140" cy="24" r="5" />
          <text x="146" y="14">Launch post</text>
        </svg>
        <div class="legend"><span>Previous 28 days</span><span>Last 28 days</span></div>
        <ul class="moved">
          <li><span class="tag">Post</span><span><b>Reddit</b> sent 18 more visits <span class="up">↑ 225%</span>, the day after your launch post.</span></li>
          <li><span class="tag">Search</span><span><b>Google</b> sent 62 more visits <span class="up">↑ 41%</span>.</span></li>
          <li><span class="tag">AI</span><span><b>ChatGPT</b> now names you for “Raycast alternative for Windows”.</span></li>
        </ul>
        <a class="story-link" href="/demo">Open the full Story in the demo →</a>
      </figure>
    </div>
  </div></div>

  <section id="features"><div class="wrap">
    <p class="kicker">What’s inside</p><h2 class="title">Answers, not dashboards</h2>
    <p class="sub">Most analytics tools count visits. Kauzl connects them to what you did, so you can tell which work paid off.</p>
    <div class="bento">
      ${BENTO.map((b) => `<article class="b-card${b.size ? ` ${b.size}` : ''}">
        <div class="b-head"><span class="ic">${icon(ICONS[b.key])}</span><h3>${b.title}</h3></div>
        <p class="b-text">${b.text}</p>
        <div class="b-vis">${b.visual}</div>
        ${b.to ? `<a class="b-link" href="/demo?to=${b.to}">See it in the demo →</a>` : '<a class="b-link" href="/demo">Try the demo, then connect Claude →</a>'}
      </article>`).join('\n      ')}
    </div>
  </div></section>

  <section id="how"><div class="wrap">
    <p class="kicker">How it works</p><h2 class="title">Set up in a few minutes</h2>
    <p class="sub">No new tracking script. Kauzl reads the tools you already use.</p>
    <div class="steps">
      <div class="card"><h3>Sign in with Google</h3><p>Pick your Analytics property and Search Console site. Read-only access.</p></div>
      <div class="card"><h3>Add what you ship</h3><p>Link the GitHub repo, store listing and accounts you post from, so releases and posts land on the Timeline.</p></div>
      <div class="card"><h3>Read the Story</h3><p>See what moved and why, set goals and alerts, and turn findings into to-dos that report back.</p></div>
    </div>
  </div></section>

  <section><div class="wrap">
    <div class="owl-why">
      ${owl(150)}
      <div>
        <p class="kicker">Why an owl</p>
        <h2>A small owl that watches what you ship</h2>
        <p><em>Kauz</em> is German for a small owl, and Kauzl sounds like “causal”: did your change cause this? Look at its eyes. The left one is empty, the right one is filled.</p>
        <div class="eyes-key"><span><i></i>Before you shipped</span><span><i></i>After</span></div>
        <p class="say">Said KAW-zuhl.</p>
      </div>
    </div>
  </div></section>

  <section id="sources"><div class="wrap">
    <p class="kicker">Works with</p><h2 class="title">Your tools, one timeline</h2>
    <p class="sub">Your numbers stay in the tools you own. Kauzl brings them together.</p>
    <div class="sources">${SOURCES.map((s) => `<span>${s}</span>`).join('')}</div>
  </div></section>

${tools ? `  <section id="tools"><div class="wrap">
    <p class="kicker">Free tools and guides</p><h2 class="title">Start without signing up</h2>
    <p class="sub">Small tools that run in your browser. Nothing you type leaves the page.</p>
    <div class="tiles">
      ${FREE_TOOLS.map(([slug, name, blurb]) => `<a class="tile" href="/tools/${slug}/"><span class="ic">${icon(ICONS[slug] || ICONS.campaigns)}</span><h3>${name}</h3><p>${blurb}</p><span class="go">Open →</span></a>`).join('\n      ')}
    </div>
    <p class="more"><a href="/tools/">All 10 free tools →</a></p>
    <h3 class="sub-h">Guides</h3>
    <div class="tiles">
      ${GUIDES.map(([slug, name, blurb]) => `<a class="tile" href="/guides/${slug}/"><span class="kick">Guide</span><h3>${name}</h3><p>${blurb}</p><span class="go">Read →</span></a>`).join('\n      ')}
    </div>
    <p class="more"><a href="/guides/">All guides →</a></p>
  </div></section>
` : ''}
  <section><div class="wrap">
    <div class="final">
      <div>${owl(56, { variant: 'paper' })}
        <h2>See your site’s Story</h2>
        <p>Connect a site and find out what last month’s releases, posts and articles actually did.</p>
        <div class="ctas"><a class="btn amber" href="${enter}">Open Kauzl</a><a class="btn ghost" href="/demo">See the demo first</a></div>
      </div>
      <div class="bars-card" aria-hidden="true">Your last launch<div class="bars"><i class="b"></i><i class="a"></i></div><div class="keys"><span>Before</span><span>After</span></div></div>
    </div>
  </div></section>
</main>

<footer><div class="wrap">
  <div class="foot-brand">${owl(40)}<div><p class="word">kauzl</p><p>The owl that watches what you ship.</p></div></div>
  <nav aria-label="Footer">${toolsLink('<a href="/tools/">Free tools</a><a href="/guides/">Guides</a>')}<a href="#features">Features</a><a href="${enter}">Open Kauzl</a></nav>
</div></footer>
${tools ? '<script type="module" src="/tools/assets/site.js"></script>' : ''}
${tools && /^(GTM|G)-[A-Z0-9]+$/.test(ga) ? `<script defer src="/tools/assets/ga.js" data-ga="${ga}"></script>` : ''}
</body></html>`;
}
