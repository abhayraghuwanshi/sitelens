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

import { SCENARIOS, scene, chartSvg } from './home-play.js';

// The hero's first scenario, drawn finished into the HTML; /home-play.js makes it playable.
const FIRST = scene(SCENARIOS[0]);

const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// What's inside: the questions people ask after they ship, each answered the
// way Kauzl answers it (a verdict and a sentence), with a small picture of the
// real screen as the proof, linked to that part of the demo
// (/demo?to=<view>, server/hosted.mjs). Sample numbers.
const QA = [
  { key: 'cycles', feature: 'Content cycles', to: 'cycles',
    q: 'Which articles are worth writing more of?',
    verdict: ['Cycle 3 measured', 'amber'],
    a: '<b>Grow</b> the GA4 guide: Google, Bing and ChatGPT all picked it up, and 14 readers signed up. <b>Cut</b> the myths post: six weeks, nothing found it.',
    visual: `<table class="v-cyc" aria-hidden="true"><thead><tr><th>Article</th><th>Google</th><th>Bing</th><th>AI</th><th>Acted</th><th></th></tr></thead><tbody>
      ${[['Track AI traffic in GA4', 'on', 'on', 'on', 14, 'Grow', 'good'], ['UTM naming guide', 'on', 'on', '', 6, 'Keep', 'good'], ['Search Console vs GA', 'on', '', '', 1, 'Improve', 'amber'], ['10 analytics myths', '', '', '', 0, 'Cut', 'bad']].map(([t, g, b, ai, n, v, tone]) => `<tr><td>${t}</td><td><i class="${g}"></i></td><td><i class="${b}"></i></td><td><i class="${ai}"></i></td><td class="num">${n}</td><td><span class="vp ${tone}">${v}</span></td></tr>`).join('')}
    </tbody></table><p class="v-foot">Every 14 days: who picked each article up, and did its readers act</p>` },
  { key: 'reddit', feature: 'Reddit cycles', to: 'cycles',
    q: 'Which subreddits are worth posting in?',
    verdict: ['Keep 1 · Drop 1', 'amber'],
    a: 'Keep posting in <b>r/SideProject</b>: 2 posts, 140 visits, 6 sign-ups. Drop r/webdev: the mods removed both.',
    visual: `<table class="v-cyc v-sub" aria-hidden="true"><thead><tr><th>Subreddit</th><th>Upvotes</th><th>Visits</th><th>Sign-ups</th><th></th></tr></thead><tbody>
      ${[['r/SideProject', 212, 140, 6, 'Keep', 'good'], ['r/analytics', 38, 41, 1, 'Try again', 'amber'], ['r/webdev', '–', 0, 0, 'Drop', 'bad']].map(([sub, up, v, n, c, tone]) => `<tr><td>${sub}</td><td class="num">${up}</td><td class="num">${v}</td><td class="num">${n}</td><td><span class="vp ${tone}">${c}</span></td></tr>`).join('')}
    </tbody></table><p class="v-foot">Claude drafts the posts, you post them, each link is tagged and measured</p>` },
  { key: 'timeline', feature: 'Timeline', to: 'timeline',
    q: 'Why was Thursday so busy?',
    verdict: ['Explained', 'amber'],
    a: 'Your Reddit post. It sent <b>54 of Thursday’s 88</b> visits. The v2.3 release on Tuesday changed nothing.',
    visual: `<div class="v-week" aria-hidden="true">
      ${[['Mon', 34, ''], ['Tue', 38, 'deploy'], ['Wed', 41, ''], ['Thu', 88, 'reddit'], ['Fri', 63, ''], ['Sat', 30, ''], ['Sun', 28, '']].map(([d, h, m]) => `<div class="day${m ? ` has ${m}` : ''}"><span class="mark">${m === 'deploy' ? 'v2.3' : m === 'reddit' ? 'Post' : ''}</span><i style="height:${h}%"></i><span class="d">${d}</span></div>`).join('')}
    </div>` },
  { key: 'campaigns', feature: 'Campaigns', to: 'campaigns',
    q: 'Which link actually brought sign-ups?',
    verdict: ['Reddit', 'amber'],
    a: 'Your Reddit link: <b>31 sign-ups</b>, more than the newsletter and ads together. Not just visits, sign-ups.',
    visual: `<table class="v-camp" aria-hidden="true"><tbody>
      ${[['reddit / social', 31, 100], ['newsletter / email', 24, 77], ['google / cpc', 6, 19]].map(([n, v, w]) => `<tr><td>${n}</td><td class="bar"><i style="width:${w}%"></i></td><td class="num">${v}</td></tr>`).join('')}
    </tbody></table><p class="v-foot">Sign-ups by campaign, last 28 days</p>` },
  { key: 'ai', feature: 'AI answers', to: 'ai',
    q: 'Does ChatGPT even know I exist?',
    verdict: ['3 of 4', 'good'],
    a: 'ChatGPT, Claude and Perplexity name you for “privacy-friendly analytics”. Gemini doesn’t yet.',
    visual: `<div class="v-ai">
      <p class="v-q">What’s a good privacy-friendly analytics tool?</p>
      <ol class="v-a"><li>Plausible</li><li class="you">Your site <span class="pill">named · cited</span></li><li>Fathom</li></ol>
    </div>` },
  { key: 'todos', feature: 'To-dos that report back', to: 'todos',
    q: 'Did my fix help, or am I imagining it?',
    verdict: ['Probably real', 'good'],
    a: 'The new pricing headline took sign-ups from <b>12 to 15 a day</b>. Three weeks of data, so it’s not one lucky day.',
    visual: `<div class="v-todo">
      <p class="v-task"><span class="tick" aria-hidden="true">✓</span> Rewrite the pricing headline <span class="muted">shipped Nov 3</span></p>
      <div class="v-ba"><span>Before</span><span class="t"><i style="width:70%"></i></span><b>12/day</b><span>After</span><span class="t a"><i style="width:88%"></i></span><b>15/day</b></div>
    </div>` },
];

// The last answer: the same questions, asked from any AI agent through the MCP server.
const AGENT = {
  q: 'Or just ask your agent.',
  a: 'Kauzl is an MCP server, so it works in Claude Code, Claude Desktop, Cursor and other agents that speak MCP. It reads the numbers, explains the dip and works through your to-dos.',
  visual: `<pre class="v-term" aria-label="Example conversation with an AI agent using Kauzl"><span class="you">you ›</span> why did sign-ups dip last week?
<span class="tool">● kauzl.daily_metrics</span>(site: "acme", range: "28d")
<span class="tool">● kauzl.day_story</span>(date: "2026-11-04")
<span class="ai">agent ›</span> Sign-ups fell 22% on Nov 4, the day the
        checkout deploy shipped. Mobile Safari
        conversions went to zero. I added a
        to-do to roll it back.</pre>`,
};

// "Plugs into what you ship with": every source Kauzl reads (left), what it
// turns them into (right). Only real connectors (server/*.mjs).
const HUB_IN = [
  ['Traffic', ['Google Analytics 4', 'Vercel Web Analytics', 'Firebase Hosting', 'BigQuery']],
  ['Search', ['Search Console', 'Bing Webmaster Tools', 'PageSpeed & CrUX']],
  ['What you ship', ['GitHub', 'Vercel deploys', 'Chrome Web Store']],
  ['Where people talk', ['Reddit', 'Hacker News', 'Product Hunt', 'Bluesky', 'Mastodon', 'Dev.to']],
  ['Your own numbers', ['Cloudflare D1']],
];
const HUB_OUT = [
  ['To-dos that report back', 'Every finding becomes a to-do. Tick it off and Kauzl checks, weeks later, whether it helped.', 'todos'],
  ['A goal for every page', 'What each page is for, how it’s doing, and the next realistic target: page 2, then page 1, not “rank #1”.', 'pages'],
  ['Search on Google and Bing', 'Where each page ranks on both, and what people search for. Bing also feeds Copilot, DuckDuckGo and ChatGPT search.', 'pages'],
  ['Alerts that know a normal week', 'Drops and spikes against the same weekday, with a daily digest in Slack or Discord.', 'alerts'],
  ['Verdicts on articles and posts', 'Content and Reddit cycles: grow, keep, improve or cut, every 14 days.', 'cycles'],
  ['Answers in your agent', 'Every number over MCP, in Claude, Cursor and other MCP agents.', null],
];


// "Works with what you have": what a tracker shows, and what Kauzl adds to it.
// Sample numbers.
const LEDGER = [
  ['548 visits, up 32%.', '<b>Reddit sent 18 more</b>, the day after your launch post.'],
  ['61 visits on Wednesday.', '<b>4× a normal Wednesday</b>, and nothing you shipped explains it. Don’t guess.'],
  ['“Raycast alternative” shown 927 times.', '<b>Rewrite that title</b>: position 4.7, only 1.5% click. Added to your to-dos.'],
  ['Sign-ups: 41.', '<b>Up 18% since the pricing change</b>, more than a normal week moves.'],
];

const GUIDES = [
  ['track-chatgpt-traffic-google-analytics', 'Track ChatGPT and AI traffic in GA4', 'Where AI visits hide in Google Analytics, and a regex to group them.'],
  ['did-a-website-change-work', 'How to tell if a website change worked', 'A fair before/after method for redesigns, launches and pricing changes.'],
  ['search-console-vs-google-analytics', 'Search Console vs Google Analytics', 'Eight reasons clicks and sessions never match.'],
  ['kauzl-vs-plausible', 'Kauzl vs Plausible', 'One counts visits, one explains them. When to use which.'],
  ['google-analytics-alternatives', 'Google Analytics alternatives', 'Nine options, grouped by the reason you want out of GA4.'],
  ['google-analytics-mcp-server', 'Google Analytics MCP', 'Ask Claude why your traffic moved: setup and prompts.'],
];

const FREE_TOOLS = [
  ['did-it-work', 'Did it work?', 'Paste daily numbers from before and after a change. Find out if the jump is real.'],
  ['utm-builder', 'UTM Builder', 'Tag campaign links for GA4, in bulk, with naming checks.'],
  ['ai-robots-txt-generator', 'AI robots.txt', 'Block AI training crawlers but stay visible in AI search.'],
];

const CSS = `
:root { color-scheme: light; --ink: #121522; --ink-2: #1C2135; --ink-line: #2A3048; --ink-text: #C9CDD8; --amber: #F5A524; --before: #9AA1B2;
  --bg: #F6F7F9; --surface: #FFFFFF; --sunk: #EEF0F4; --text: #121522; --text-2: #3A3F50; --muted: #5B6172; --line: #E3E6EC; --link: #A35F00;
  --good: #1F7A3D; --good-soft: #E4F4E9; --amber-soft: #FDF1DC; --label: #A35F00; --label-ink: #F5A524;
  --head: "Bricolage Grotesque", "Inter", system-ui, sans-serif; --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; }
/* Dark: neutral charcoal, not navy; amber only for actions, the owl and "after". */
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --ink: #141519; --ink-2: #1B1C21; --ink-line: #2A2C33; --ink-text: #C4C4CC; --before: #8B8B94; --bg: #0E0F12; --surface: #17181D; --sunk: #111215; --text: #F4F4F5; --text-2: #D4D4D8; --muted: #A1A1AA; --line: #26282F; --link: #F4F4F5; --amber-soft: #1F2026; --label: #A1A1AA; --label-ink: #A1A1AA; --good: #5FD08A; --good-soft: #13291C; } }
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
.eyebrow { margin: 0 0 18px; font: 600 13px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--label-ink); }
.hero h1 { font-size: clamp(42px, 6.6vw, 76px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.02; margin: 0 0 20px; }
.hero h1 em { font-style: normal; color: var(--amber); }
.lead { font-size: 19px; color: var(--ink-text); margin: 0 0 30px; max-width: 32em; }
.ctas { display: flex; flex-wrap: wrap; gap: 12px; }
.perks { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 22px 0 0; font-size: 14px; color: var(--ink-text); }
.perks li { display: inline-flex; align-items: center; gap: 6px; } .perks svg { color: var(--label-ink); }

/* "Ship it": the playable hero card, with the owl perched on top (home-play.js) */
.play-wrap { position: relative; padding-top: 58px; }
.play-wrap > svg.owl { position: absolute; top: 0; right: 36px; z-index: 2; filter: drop-shadow(0 10px 18px rgb(0 0 0 / .35)); }
.play { position: relative; margin: 0; background: var(--surface); color: var(--text); border-radius: 22px; padding: 20px 22px 22px; box-shadow: 0 30px 70px rgb(0 0 0 / .4), 0 0 0 1px rgb(255 255 255 / .04); }
.play-top { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--muted); }
.play-top .sample { font-weight: 600; color: var(--link); background: var(--amber-soft); padding: 1px 9px; border-radius: 99px; }
.ship { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 12px 0 2px; }
.ship[hidden] { display: none; }
.ship-lbl { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-right: 2px; }
.ship button { font: 600 13px var(--font); padding: 6px 11px; border-radius: 99px; border: 1px solid var(--line); background: var(--sunk); color: var(--text-2); cursor: pointer; transition: background .15s, border-color .15s, color .15s, transform .1s; }
.ship button:hover { border-color: var(--amber); color: var(--text); }
.ship button:active { transform: scale(.96); }
.ship button[aria-pressed=true] { background: var(--ink); border-color: var(--ink); color: #F6F7F9; }
.ship button[aria-pressed=true]::before { content: "⚑ "; color: var(--amber); }
.play-chart { margin: 8px -4px 0; }
.pc { display: block; width: 100%; height: auto; overflow: visible; }
.pc-band { fill: var(--sunk); }
.pc-base { stroke: var(--before); stroke-width: 1; stroke-dasharray: 3 4; }
.pc-normal, .pc-axis { fill: var(--muted); font: 600 7.5px var(--font); }
.pc polyline { fill: none; stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.pc-before { stroke: var(--before); }
.pc-after { stroke: var(--amber); stroke-width: 3; }
.pc-flag line { stroke: var(--text); stroke-width: 1.2; stroke-dasharray: 2 2.5; } .pc-flag path { fill: var(--amber); } .pc-flag text { fill: var(--text); font: 700 8px var(--font); }
.pc-end { fill: var(--amber); }
.play[data-tone=bad] .pc-after, .play[data-tone=bad] .pc-end { stroke: #E5484D; } .play[data-tone=bad] .pc-end { fill: #E5484D; }
.play-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 14px; }
.play-stats span { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 12px; background: var(--sunk); font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.play-stats b { font: 800 20px/1.1 var(--head); letter-spacing: -0.02em; text-transform: none; color: var(--text); font-variant-numeric: tabular-nums; }
.play-stats span:last-child b { color: var(--amber); }
.play[data-tone=good] .play-stats span:last-child b { color: var(--good); } .play[data-tone=bad] .play-stats span:last-child b { color: #E5484D; } .play[data-tone=muted] .play-stats span:last-child b { color: var(--muted); }
.play-say { display: flex; gap: 12px; align-items: flex-start; }
.play-say .who { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: var(--ink); flex: none; }
.play-say > div { flex: 1; min-width: 0; }
.play-head { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; }
.play-head .name { font: 800 16px/1 var(--head); letter-spacing: -0.03em; }
.play-head .verdict { margin-left: auto; }
.dots { display: none; gap: 3px; } .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); animation: blinkdot 1s infinite; } .dots i:nth-child(2) { animation-delay: .15s; } .dots i:nth-child(3) { animation-delay: .3s; }
@keyframes blinkdot { 50% { opacity: .2; } }
.play.reading .dots { display: inline-flex; }
.say { margin: 0; font-size: 15px; line-height: 1.5; color: var(--text-2); min-height: 4.5em; }
.play.live:not(.done) .verdict { visibility: hidden; }
.tag { flex: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 6px; background: var(--ink); color: var(--amber); }

/* sections */
section { padding: 112px 0 0; }
.kicker { margin: 0 0 8px; font: 600 13px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--label); }
h2.title { font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.035em; margin: 0 0 10px; }
p.sub { color: var(--text-2); margin: 0 0 32px; max-width: 40em; font-size: 17px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 1px 2px rgb(18 21 34 / .04); }
.card h3 { margin: 16px 0 8px; font-size: 19px; }
.card p { margin: 0; color: var(--text-2); font-size: 15px; }
/* What's inside: one panel. The questions are radio tabs (no script), the
   unpicked ones a hollow "before" eye, the picked one the filled "after" eye;
   the answers share one grid cell, so switching never moves the page. */
.qa { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 32px 48px; align-items: center; position: relative; }
.qa-r { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; }
.qa-list { display: flex; flex-direction: column; gap: 4px; }
.qa-tab { display: block; position: relative; padding: 16px 18px 16px 44px; border-radius: 16px; cursor: pointer; transition: background .2s; }
.qa-tab:hover { background: var(--surface); }
.qa-tab::before { content: ""; position: absolute; left: 16px; top: 19px; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--before); box-sizing: border-box; transition: border-color .2s, background .2s, transform .2s; }
.qa-n { display: block; margin: 0 0 4px; font: 600 12px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.qa-qt { display: block; font: 800 clamp(19px, 2vw, 24px)/1.15 var(--head); letter-spacing: -0.03em; color: var(--muted); transition: color .2s; }
${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-list [for=qa-${i + 1}]`).join(',\n')} { background: var(--surface); box-shadow: 0 1px 2px rgb(18 21 34 / .05), 0 10px 28px rgb(18 21 34 / .07); }
.qa-tab:is(${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-list [for=qa-${i + 1}]`).join(', ')})::before { border-color: var(--amber); background: var(--amber); transform: scale(1.15); }
:is(${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-list [for=qa-${i + 1}]`).join(', ')}) .qa-qt { color: var(--text); }
${QA.map((_, i) => `#qa-${i + 1}:focus-visible ~ .qa-list [for=qa-${i + 1}]`).join(',\n')} { outline: 2px solid var(--amber); outline-offset: 2px; }
.qa-panels { display: grid; position: relative; }
.qa-panels::before { content: ""; position: absolute; inset: -12% -8%; background: radial-gradient(closest-side, rgb(245 165 36 / .22), transparent); filter: blur(10px); z-index: -1; pointer-events: none; }
.qa-panels > .qa-a { grid-area: 1 / 1; visibility: hidden; opacity: 0; }
.qa-panels > .qa-a:is(${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-panels .p${i + 1}`).join(', ')}) { visibility: visible; opacity: 1; animation: qa-in .45s cubic-bezier(.2, .8, .2, 1); }
.qa-panels > .qa-a { box-shadow: 0 1px 2px rgb(18 21 34 / .04), 0 30px 60px rgb(18 21 34 / .12); }
.qa-a { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 22px; box-shadow: 0 1px 2px rgb(18 21 34 / .04); }
.qa-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.qa-head .who { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--ink); flex: none; }
.qa-head .name { font: 800 17px/1 var(--head); letter-spacing: -0.03em; }
.verdict { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 4px 10px; border-radius: 99px; }
.verdict::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.verdict.good { color: var(--good); background: var(--good-soft); }
.verdict.amber { color: var(--link); background: var(--amber-soft); }
.verdict.muted { color: var(--muted); background: var(--sunk); }
.verdict.bad { color: #C62F35; background: #FDECEC; }
.qa-text { margin: 0 0 16px; font: 600 19px/1.4 var(--font); letter-spacing: -0.01em; color: var(--text); }
.qa-text b { box-shadow: inset 0 -.42em 0 rgb(245 165 36 / .38); }
.b-vis { background: var(--sunk); border-radius: 14px; padding: 16px; font-size: 13px; min-width: 0; }
.qa-go { display: inline-block; margin-top: 14px; font-size: 14px; font-weight: 600; color: var(--link); text-decoration: none; }
.qa-go:hover { text-decoration: underline; }
.qa-claude { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px 56px; align-items: center; margin-top: 40px; background: var(--ink); color: #F6F7F9; border: 1px solid var(--ink-line); border-radius: 24px; padding: 36px; }
.qa-claude h3 { margin: 0 0 10px; font-size: clamp(28px, 3.4vw, 40px); font-weight: 800; letter-spacing: -0.035em; color: #F6F7F9; }
.qa-claude h3 em { font-style: normal; color: var(--amber); }
.qa-claude p { margin: 0; color: var(--ink-text); }
.qa-claude .b-vis { background: #0B0C0F; border: 1px solid var(--ink-line); }
.good { color: var(--good); }
.v-foot { margin: 10px 0 0; color: var(--muted); font-size: 12.5px; }
.v-lead { margin: 0 0 6px; font: 700 17px/1.3 var(--head); letter-spacing: -0.01em; }
.v-chart { width: 100%; height: auto; display: block; }
.v-chart polyline { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.v-chart .prev { stroke: var(--before); stroke-dasharray: 4 4; stroke-width: 2; } .v-chart .now { stroke: var(--amber); }
.v-chart .flag { stroke: var(--muted); stroke-dasharray: 3 3; } .v-chart .dot { fill: var(--amber); }
.v-chart text { fill: var(--muted); font: 600 7px var(--font); }
.v-q { margin: 0 0 10px; background: var(--ink); color: #F6F7F9; border-radius: 12px 12px 4px 12px; padding: 8px 12px; margin-left: 18%; }
.v-a { margin: 0; padding: 10px 12px 10px 30px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px 12px 12px 4px; margin-right: 10%; }
.v-a li { padding: 2px 0; } .v-a li.you { font-weight: 700; }
.pill { font-size: 11px; font-weight: 700; color: var(--good); background: var(--good-soft); padding: 1px 7px; border-radius: 99px; margin-left: 4px; }
.v-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; height: 132px; align-items: end; }
.v-week .day { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
.v-week i { display: block; width: 100%; border-radius: 6px 6px 3px 3px; background: var(--before); }
.v-week .has i { background: var(--amber); }
.v-week .mark { font-size: 10px; font-weight: 700; color: var(--label); min-height: 14px; }
.v-week .d { font-size: 11px; color: var(--muted); }
.v-cyc { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.v-cyc th { text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); padding: 0 6px 6px 0; }
.v-cyc td { padding: 7px 6px 7px 0; border-top: 1px solid var(--line); white-space: nowrap; }
.v-cyc td:first-child { white-space: normal; color: var(--text); font-weight: 600; }
.v-cyc td i { display: block; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--before); box-sizing: border-box; }
.v-cyc td i.on { background: var(--amber); border-color: var(--amber); }
.v-cyc .num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; padding-right: 12px; }
.v-cyc th:nth-child(n+2):not(:last-child) { text-align: center; } .v-cyc:not(.v-sub) td:nth-child(n+2):nth-child(-n+4) i { margin: 0 auto; }
.v-sub th:nth-child(n+2):not(:last-child) { text-align: right; padding-right: 12px; }
.vp { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.vp.good { color: var(--good); background: var(--good-soft); } .vp.amber { color: var(--link); background: var(--amber-soft); } .vp.bad { color: #C62F35; background: #FDECEC; }
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

/* Works with what you have: a full-width ink band. Each row starts as the
   tracker's grey number and turns into Kauzl's sentence as it scrolls in. */
section.band { position: relative; margin-top: 112px; padding: 96px 0; background: var(--ink); color: #F6F7F9; overflow: hidden; }
section.band::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgb(255 255 255 / .07) 1px, transparent 1.2px); background-size: 22px 22px; mask-image: radial-gradient(ellipse at 80% 20%, #000, transparent 70%); pointer-events: none; }
section.band::after { content: ""; position: absolute; width: 560px; height: 560px; right: -160px; top: -200px; background: radial-gradient(closest-side, rgb(245 165 36 / .18), transparent); pointer-events: none; }
section.band .wrap { position: relative; z-index: 1; }
section.band .kicker { color: var(--label-ink); } section.band h2.title { color: #F6F7F9; } section.band p.sub { color: var(--ink-text); }
.ledger { border-top: 1px solid var(--ink-line); }
.l-row { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); align-items: center; border-bottom: 1px solid var(--ink-line); }
.l-row > span { padding: 22px 0; font-size: 17px; }
.l-row > span:first-child { color: #8B90A0; padding-right: 24px; font-variant-numeric: tabular-nums; }
.l-row > span:last-child { color: var(--ink-text); position: relative; padding-left: 30px; }
.l-row .arrow { position: absolute; left: 0; font-style: normal; font-weight: 700; color: var(--amber); }
.l-row b { color: #F6F7F9; box-shadow: inset 0 -.38em 0 rgb(245 165 36 / .35); }
.l-head > span { padding-block: 0 12px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8B90A0; }
.l-head > span:last-child { color: var(--amber); }
section.band .l-foot { color: var(--ink-text); } section.band .l-foot a { color: var(--amber); }
.l-foot { margin: 14px 0 0; color: var(--muted); font-size: 14px; } .l-foot a { color: var(--link); font-weight: 600; }

/* Plugs into: sources → the owl → what comes out. Dashes flow toward the owl. */
.hub { display: grid; grid-template-columns: minmax(0, 1fr) 150px minmax(0, 1.05fr); gap: 0 44px; align-items: center; }
.hub-in { display: flex; flex-direction: column; gap: 10px; }
.hub-grp { position: relative; z-index: 1; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px; }
.hub-grp::after, .hub-out li::before { content: ""; position: absolute; top: 50%; width: 119px; height: 2px; background: repeating-linear-gradient(90deg, var(--amber) 0 5px, transparent 5px 11px); opacity: .7; }
.hub-grp::after { right: -120px; }
.hub-lbl { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
.hub-grp ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.hub-grp li { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 99px; background: var(--sunk); color: var(--text-2); }
.hub-core { display: grid; justify-items: center; gap: 10px; position: relative; align-self: stretch; align-content: center; }
.hub-core::before { content: ""; position: absolute; top: 4%; bottom: 4%; left: 50%; width: 2px; transform: translateX(-50%); background: linear-gradient(transparent, rgb(245 165 36 / .45) 12%, rgb(245 165 36 / .45) 88%, transparent); }
.hub-ring { position: relative; z-index: 1; display: grid; place-items: center; width: 132px; height: 132px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 10px rgb(245 165 36 / .12), 0 0 0 22px rgb(245 165 36 / .06), 0 24px 50px rgb(18 21 34 / .25); }
.hub-word { position: relative; z-index: 1; font: 800 20px/1 var(--head); letter-spacing: -0.045em; background: var(--bg); padding: 2px 8px; }
.hub-out { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.hub-out li { position: relative; }
.hub-out a { z-index: 1; }
.hub-out li::before { left: -120px; }
.hub-out a { display: grid; gap: 2px; padding: 12px 16px 12px 44px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); color: inherit; text-decoration: none; position: relative; transition: border-color .15s, transform .15s, box-shadow .15s; }
.hub-out a::before { content: ""; position: absolute; left: 16px; top: 15px; width: 14px; height: 14px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 0 4px var(--amber-soft); }
.hub-out a:hover { border-color: var(--amber); transform: translateX(3px); box-shadow: 0 12px 28px rgb(18 21 34 / .08); }
.hub-out b { font: 800 16px/1.25 var(--head); letter-spacing: -0.02em; }
.hub-out span { font-size: 13.5px; color: var(--text-2); line-height: 1.45; }

.steps { counter-reset: s; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; position: relative; }
.steps .card::before { counter-increment: s; content: counter(s); display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--amber); color: var(--ink); font: 800 17px var(--head); }
.steps .card h3 { margin-top: 14px; }

/* why an owl */


.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.tile { display: flex; flex-direction: column; text-decoration: none; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px; transition: border-color .15s, transform .15s, box-shadow .15s; }
.tile:hover { border-color: var(--amber); transform: translateY(-2px); box-shadow: 0 14px 30px rgb(18 21 34 / .1); }
.tile h3 { margin: 0 0 6px; font-size: 18px; }
.tile p { margin: 0 0 14px; font-size: 14px; color: var(--text-2); flex: 1; }
.tile .go { font-size: 14px; font-weight: 600; color: var(--link); }
.sec-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.all { flex: none; font-size: 15px; font-weight: 600; color: var(--link); text-decoration: none; white-space: nowrap; } .all:hover { text-decoration: underline; }
.sec-head .all { margin-bottom: 34px; }
.guides { display: flex; align-items: center; gap: 12px 18px; flex-wrap: wrap; margin-top: 16px; padding: 14px 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
.guides .lbl { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.guides .chips { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; }
.guides .chips a { padding: 6px 12px; border-radius: 99px; background: var(--sunk); border: 1px solid var(--line); color: var(--text-2); font-size: 14px; text-decoration: none; transition: border-color .15s, color .15s; }
.guides .chips a:hover { border-color: var(--amber); color: var(--text); }
.tile .kick { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--label); }

.final { position: relative; overflow: hidden; display: grid; justify-items: center; text-align: center; background: var(--ink); color: #F6F7F9; border-radius: 28px; padding: 44px; }
.final > * { position: relative; }
.final h2 { font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.035em; margin: 16px 0 10px; }
.final p { color: var(--ink-text); margin: 0 auto 24px; max-width: 30em; }
.join { display: flex; gap: 10px; width: 100%; max-width: 460px; margin: 0 auto; }
.join input[type=email] { flex: 1; min-width: 0; min-height: 46px; padding: 10px 14px; border-radius: 11px; border: 1px solid var(--ink-line); background: var(--ink-2); color: #F6F7F9; font: 15px var(--font); }
.join input[type=email]::placeholder { color: var(--ink-text); opacity: .7; }
.join input[type=email]:focus { outline: none; border-color: var(--amber); }
.join .btn { border: 0; cursor: pointer; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.final .fine { margin: 14px auto 0; font-size: 14px; } .final .fine a { color: #F6F7F9; } .final .ctas { justify-content: center; } .final svg.owl { margin: 0 auto; }

footer { margin-top: 72px; padding: 36px 0 48px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer .wrap { display: flex; justify-content: space-between; align-items: center; gap: 16px 32px; flex-wrap: wrap; }
.foot-brand { display: flex; gap: 12px; align-items: center; }
.foot-brand p { margin: 0; } .foot-brand .why { margin-top: 6px; max-width: 34em; font-size: 13px; } .foot-brand .word { font-size: 22px; color: var(--text); }
footer nav { display: flex; gap: 18px; flex-wrap: wrap; } footer nav a { color: var(--muted); text-decoration: none; } footer nav a:hover { color: var(--text); }
/* Motion: the hero acts out before → after once; answers animate when picked;
   ledger rows turn over as they scroll in (where the browser supports it). */
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@keyframes qa-in { from { opacity: 0; transform: translateY(14px) scale(.985); } }
@keyframes draw { from { stroke-dashoffset: 1; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(8px); } }
@keyframes pop { 0% { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.08); } }
@keyframes grow-y { from { transform: scaleY(0); } }
@keyframes grow-x { from { transform: scaleX(0); } }
@keyframes turn { from { opacity: .25; transform: translateX(-10px); filter: blur(3px); } }
@keyframes dim { from { color: #F6F7F9; } }
@keyframes flow { to { background-position: 22px 0; } }
@keyframes breathe { 50% { box-shadow: 0 0 0 14px rgb(245 165 36 / .16), 0 0 0 30px rgb(245 165 36 / .05), 0 24px 50px rgb(18 21 34 / .25); } }
@keyframes nudge { 0%, 100% { transform: none; } 10% { transform: translateY(-3px); } 20% { transform: none; } }
@keyframes drop { 0% { transform: translateY(-40px); opacity: 0; } 60% { transform: translateY(3px); opacity: 1; } }
@media (prefers-reduced-motion: no-preference) {
  .hub-grp::after, .hub-out li::before { animation: flow .9s linear infinite; }
  .hub-ring { animation: breathe 3.2s ease-in-out infinite; }
  .play.shipping .pc-flag > * { animation: drop .5s cubic-bezier(.3, 1.4, .5, 1) both; }
  .play.shipping .pc-band, .play.shipping .pc-base, .play.shipping .pc-normal { animation: fade-up .5s .5s both; }
  .play.shipping .pc-after { stroke-dasharray: 1; animation: draw 1.1s .55s cubic-bezier(.5, 0, .3, 1) both; }
  .play.shipping .pc-end { opacity: 0; }
  .play.done .pc-end { transform-box: fill-box; transform-origin: center; animation: pop .4s both; }
  .play.done .verdict { animation: pop .45s both; }
  .play.done .play-stats b { animation: fade-up .35s both; } .play.done .play-stats span:nth-child(2) b { animation-delay: .08s; } .play.done .play-stats span:nth-child(3) b { animation-delay: .16s; }
  .play.live .ship button:not([aria-pressed=true]) { animation: nudge 2.4s 4s 2 ease-in-out; }
  .qa-panels > .qa-a:is(${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-panels .p${i + 1}`).join(', ')}) {
    & .verdict { animation: pop .45s .25s both; }
    & .qa-text { animation: fade-up .4s .1s both; }
    & .v-chart .now { stroke-dasharray: 1; animation: draw 1s .3s cubic-bezier(.6, 0, .2, 1) both; }
    & .v-chart .flag, & .v-chart text, & .v-chart .dot { animation: fade-up .4s .8s both; }
    & .v-week i { transform-origin: bottom; animation: grow-y .6s cubic-bezier(.2, .8, .2, 1) both; }
    & .v-week .day:nth-child(2) i { animation-delay: .05s; } & .v-week .day:nth-child(3) i { animation-delay: .1s; } & .v-week .day:nth-child(4) i { animation-delay: .15s; }
    & .v-week .day:nth-child(5) i { animation-delay: .2s; } & .v-week .day:nth-child(6) i { animation-delay: .25s; } & .v-week .day:nth-child(7) i { animation-delay: .3s; }
    & .v-week .mark { animation: fade-up .4s .5s both; }
    & .v-camp .bar i, & .v-ba .t i { transform-origin: left; animation: grow-x .7s .2s cubic-bezier(.2, .8, .2, 1) both; }
    & .v-camp tr:nth-child(2) .bar i, & .v-ba .t.a i { animation-delay: .35s; } & .v-camp tr:nth-child(3) .bar i { animation-delay: .5s; }
    & .v-a li { animation: fade-up .35s both; } & .v-a li:nth-child(2) { animation-delay: .25s; } & .v-a li:nth-child(3) { animation-delay: .4s; }
    & .v-task .tick { animation: pop .4s .15s both; }
    & .v-cyc tbody tr { animation: fade-up .35s both; } & .v-cyc tbody tr:nth-child(2) { animation-delay: .08s; } & .v-cyc tbody tr:nth-child(3) { animation-delay: .16s; } & .v-cyc tbody tr:nth-child(4) { animation-delay: .24s; }
    & .vp { animation: pop .4s .45s both; }
  }
  @supports (animation-timeline: view()) {
    .l-row:not(.l-head) > span:last-child { animation: turn linear both; animation-timeline: view(); animation-range: entry 0% cover 25%; }
    .l-row:not(.l-head) > span:first-child { animation: dim linear both; animation-timeline: view(); animation-range: entry 0% cover 25%; }
  }
}
@media (prefers-color-scheme: dark) {
  .final, .tag { border: 1px solid var(--ink-line); }
  .verdict.amber { color: var(--amber); }
  .verdict.bad, .vp.bad { color: #FF8A8E; background: #2A1416; } .vp.amber { color: var(--amber); }
  .ship button[aria-pressed=true] { background: var(--amber); border-color: var(--amber); color: #121522; }
  .ship button[aria-pressed=true]::before { color: #121522; }
  .hub-ring { border: 1px solid var(--line); }
  .hub-ring svg.owl path:first-child { fill: #F6F7F9; }
  .play { box-shadow: 0 30px 70px rgb(0 0 0 / .5), 0 0 0 1px var(--line); }
  .play-say .who { border: 1px solid var(--line); }
  section.band { border-block: 1px solid var(--ink-line); }
  /* Ink owls would vanish on dark cards: draw them light. */
  .foot-brand svg.owl path:first-child { fill: #F6F7F9; }
  .foot-brand svg.owl .eyes > circle { fill: var(--ink); }
}

@media (max-width: 900px) {
  .hero-in { grid-template-columns: minmax(0, 1fr); }
  .hero { padding: 44px 0 100px; }
  .grid, .steps, .tiles { grid-template-columns: minmax(0, 1fr); }
  .qa, .qa-claude { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .hub { grid-template-columns: minmax(0, 1fr); gap: 20px; } .hub-grp::after, .hub-out li::before, .hub-core::before { display: none; } .hub-ring { width: 104px; height: 104px; } .qa-claude { padding: 24px; }
  .qa-list { flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -24px; padding: 4px 24px 12px; gap: 8px; }
  .qa-tab { flex: 0 0 min(78%, 300px); scroll-snap-align: start; background: var(--surface); border: 1px solid var(--line); }
  .l-row { grid-template-columns: minmax(0, 1fr); } .l-row > span:first-child { padding-bottom: 0; } .l-head { display: none; }
  section.band { padding: 64px 0; }
  nav.links a:not(.keep) { display: none; }
  .sec-head { flex-direction: column; align-items: flex-start; } .sec-head .all { margin: -16px 0 24px; }
  .top .wrap { gap: 16px; }
}
@media (max-width: 480px) { .join { flex-direction: column; } .wrap { padding-inline: 16px; } .final { padding: 28px; } section { padding-top: 72px; } .qa-list { margin-inline: -16px; padding-inline: 16px; } }
`;

// tools: the free tools are served at /tools/ (TOOLS_ORIGIN is set), so link
// them and borrow their site.js for the owl's moving eyes.
export function homePage({ signedIn = false, tools = false, ga = '', v = '' } = {}) {
  const q = v ? `?v=${encodeURIComponent(v)}` : '';
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
  <nav class="links" aria-label="Sections"><a href="/demo">Demo</a><a href="#features">Features</a><a href="#how">How it works</a>${toolsLink('<a class="keep" href="/tools/">Free tools</a><a href="/guides/">Guides</a>')}</nav>
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
        ${signedIn ? `<a class="btn ghost" href="${enter}">Open Kauzl</a>` : '<a class="btn ghost" href="/waitlist">Get early access</a>'}
      </div>
      <ul class="perks"><li>${CHECK}Demo needs no sign-up</li><li>${CHECK}No tracking script</li></ul>
    </div>

    <div class="play-wrap">
      ${owl(78, { variant: 'paper' })}
      <figure class="play" id="play" data-tone="${FIRST.tone}">
        <div class="play-top"><span class="play-metric">${FIRST.metric} a day</span><span class="sample">Try it · sample data</span></div>
        <div class="ship" role="group" aria-label="Pick something to ship" hidden>
          <span class="ship-lbl">Ship</span>${SCENARIOS.map((x, i) => `<button type="button" data-s="${x.key}" aria-pressed="${i ? 'false' : 'true'}">${x.label}</button>`).join('')}
        </div>
        <div class="play-chart">${chartSvg(FIRST)}</div>
        <div class="play-stats"><span>Before<b>${FIRST.nums.before}</b></span><span>After<b>${FIRST.nums.after}</b></span><span>Change<b>${FIRST.nums.change}</b></span></div>
        <div class="play-say">
          <span class="who">${owl(26, { variant: 'paper' })}</span>
          <div><p class="play-head"><span class="name">kauzl</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="verdict ${FIRST.tone}">${FIRST.verdict}</span></p>
          <p class="say" aria-hidden="true">${FIRST.text}</p><p class="play-live sr" aria-live="polite">${FIRST.verdict}. ${FIRST.text}</p></div>
        </div>
      </figure>
    </div>
  </div></div>

  <section id="features"><div class="wrap">
    <p class="kicker">What’s inside</p><h2 class="title">Answers, not dashboards</h2>
    <p class="sub">Every part of Kauzl ends in a decision, not a chart to read: which articles to grow, which subreddits to keep, which link brought sign-ups, whether your fix helped. The proof sits underneath.</p>
    <div class="qa">
      ${QA.map((x, i) => `<input class="qa-r" type="radio" name="qa" id="qa-${i + 1}" aria-label="${x.q}"${i ? '' : ' checked'}>`).join('')}
      <div class="qa-list">
        ${QA.map((x, i) => `<label class="qa-tab" for="qa-${i + 1}"><span class="qa-n">${String(i + 1).padStart(2, '0')} · ${x.feature}</span><span class="qa-qt">“${x.q}”</span></label>`).join('\n        ')}
      </div>
      <div class="qa-panels">
        ${QA.map((x, i) => `<div class="qa-a p${i + 1}">
          <div class="qa-head"><span class="who">${owl(24, { variant: 'paper' })}</span><span class="name">kauzl</span><span class="verdict ${x.verdict[1]}">${x.verdict[0]}</span></div>
          <p class="qa-text">${x.a}</p>
          <div class="b-vis">${x.visual}</div>
          <a class="qa-go" href="/demo?to=${x.to}">See it in the demo →</a>
        </div>`).join('\n        ')}
      </div>
    </div>
    <div class="qa-claude">
      <div><h3>${AGENT.q.replace('your agent', '<em>your agent</em>')}</h3><p>${AGENT.a}</p></div>
      <div class="b-vis">${AGENT.visual}</div>
    </div>
  </div></section>

  <section id="works-with" class="band"><div class="wrap">
    <p class="kicker">Works with what you have</p><h2 class="title">Keep your analytics. Add the why.</h2>
    <p class="sub">You already have something counting visits. Kauzl doesn’t replace it. It reads it, lines it up with what you shipped and posted, and says which work paid off.</p>
    <div class="ledger" role="table" aria-label="Example: what your tracker says, and what Kauzl adds">
      <div class="l-row l-head" role="row"><span role="columnheader">Your analytics says</span><span role="columnheader">Kauzl adds</span></div>
      ${LEDGER.map(([says, adds]) => `<div class="l-row" role="row"><span role="cell">${says}</span><span role="cell"><i class="arrow" aria-hidden="true">→</i>${adds}</span></div>`).join('\n      ')}
    </div>
    <p class="l-foot">Sample numbers. Comparing tools? <a href="/guides/kauzl-vs-plausible/">Kauzl vs Plausible</a>, honestly.</p>
  </div></section>

  <section id="connects"><div class="wrap">
    <p class="kicker">Plugs into what you ship with</p><h2 class="title">Everything you use, one verdict</h2>
    <p class="sub">Traffic, search, deploys, posts and your own numbers go in. To-dos, goals, alerts and answers come out. Read-only, and no new tracking script.</p>
    <div class="hub">
      <div class="hub-in">
        ${HUB_IN.map(([group, items]) => `<div class="hub-grp"><p class="hub-lbl">${group}</p><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('\n        ')}
      </div>
      <div class="hub-core" aria-hidden="true"><span class="hub-ring">${owl(64, { variant: 'paper' })}</span><span class="hub-word">kauzl</span></div>
      <ol class="hub-out">
        ${HUB_OUT.map(([title, text, to]) => `<li><a href="/demo${to ? `?to=${to}` : ''}"><b>${title}</b><span>${text}</span></a></li>`).join('\n        ')}
      </ol>
    </div>
  </div></section>

  <section id="how"><div class="wrap">
    <p class="kicker">How it works</p><h2 class="title">Set up in a few minutes</h2>
    <p class="sub">No new tracking script. Connect what you already use, read-only, and the first Story is ready in minutes.</p>
    <div class="steps">
      <div class="card"><h3>Sign in with Google</h3><p>Pick your Analytics property and Search Console site. Read-only access.</p></div>
      <div class="card"><h3>Add what you ship</h3><p>Link the GitHub repo, store listing and accounts you post from, so releases and posts land on the Timeline.</p></div>
      <div class="card"><h3>Read the Story</h3><p>See what moved and why, set goals and alerts, and turn findings into to-dos that report back.</p></div>
    </div>
  </div></section>

${tools ? `  <section id="tools"><div class="wrap">
    <div class="sec-head"><div><p class="kicker">Free tools</p><h2 class="title">Start without signing up</h2>
    <p class="sub">Small tools that run in your browser. Nothing you type leaves the page.</p></div>
    <a class="all" href="/tools/">All 10 tools →</a></div>
    <div class="tiles">
      ${FREE_TOOLS.map(([slug, name, blurb]) => `<a class="tile" href="/tools/${slug}/"><h3>${name}</h3><p>${blurb}</p><span class="go">Open →</span></a>`).join('\n      ')}
    </div>
    <nav class="guides" aria-label="Guides"><span class="lbl">Guides</span>
      <div class="chips">${GUIDES.map(([slug, name]) => `<a href="/guides/${slug}/">${name}</a>`).join('')}</div>
      <a class="all" href="/guides/">All guides →</a></nav>
  </div></section>
` : ''}
  <section id="early-access"><div class="wrap">
    <div class="final">
      <div>${owl(56, { variant: 'paper' })}
        ${signedIn ? `<h2>See your site’s Story</h2>
        <p>Connect a site and find out what last month’s releases, posts and articles actually did.</p>
        <div class="ctas"><a class="btn amber" href="${enter}">Open Kauzl</a><a class="btn ghost" href="/demo">See the demo first</a></div>` : `<h2>Get early access</h2>
        <p>Kauzl is opening to a few teams at a time. Leave your email and we’ll invite you, with a link to sign in.</p>
        <form class="join" method="post" action="/waitlist">
          <input type="hidden" name="from" value="home">
          <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
          <input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@company.com" aria-label="Your email">
          <button class="btn amber" type="submit">Get early access</button>
        </form>
        <p class="fine">Already invited? <a href="/login">Sign in</a> · or <a href="/demo">look around the demo</a></p>`}
      </div>
    </div>
  </div></section>
</main>

<footer><div class="wrap">
  <div class="foot-brand">${owl(40)}<div><p class="word">kauzl</p><p>The owl that watches what you ship.</p><p class="why"><b>Why an owl</b> · <em>Kauz</em> is German for a small owl, and Kauzl sounds like “causal”. Its left eye is before you shipped, the right one after.</p></div></div>
  <nav aria-label="Footer">${toolsLink('<a href="/tools/">Free tools</a><a href="/guides/">Guides</a>')}<a href="#features">Features</a><a href="${enter}">Open Kauzl</a></nav>
</div></footer>
<script type="module" src="/home-play.js${q}"></script>
${tools ? `<script type="module" src="/tools/assets/site.js${q}"></script>` : ''}
${tools && /^(GTM|G)-[A-Z0-9]+$/.test(ga) ? `<script defer src="/tools/assets/ga.js${q}" data-ga="${ga}"></script>` : ''}
</body></html>`;
}
