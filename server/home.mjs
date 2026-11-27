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

import { calendarHtml, dayHtml, day, FIRST_PICK } from './home-play.js';
import { COURSE, MODULES, COURSE_ORDER } from '../tools/course.mjs';

// The hero's calendar and its first picked day, drawn into the HTML; /home-play.js makes the days clickable.
const FIRST = day(FIRST_PICK);

// Questions people ask before signing up. Plain text answers (also FAQPage
// data): under 320 characters, each starting with its subject (tools/seo-rules.mjs).
const FAQ = [
  ['What is Kauzl?', 'Kauzl is an analytics calendar for your website. It reads Google Analytics 4, Search Console and Bing, shows each day’s visits and searches next to your releases, posts and campaigns, and says what changed, why, and what to do next.'],
  ['Does Kauzl replace Google Analytics?', 'No. Kauzl reads the analytics you already have and adds the why: which release, post or campaign moved the numbers. Keep GA4 or Vercel Web Analytics counting visits.'],
  ['Do I need to add a tracking script?', 'No. Kauzl adds no script to your site. It connects to the tools you already use, read-only, so there is nothing to install and nothing new for visitors to block.'],
  ['What access does Kauzl need?', 'Kauzl asks Google for read-only access to the Analytics property and Search Console site you pick. GitHub, Reddit, the Chrome Web Store and the other sources are optional, and you add only the ones you use.'],
  ['Does Kauzl work without Google Analytics?', 'Yes, from Search Console alone. The Story then uses search clicks instead of visits. Add GA4, Vercel Web Analytics or Firebase later to see every source.'],
  ['Can I ask Claude or Cursor about my traffic?', 'Yes. Kauzl is an MCP server, so Claude Code, Claude Desktop, Cursor and other MCP agents can read your numbers, explain a dip and work through your to-dos.'],
  ['How do I get access?', 'Kauzl is opening to a few teams at a time. Leave your email and we’ll send an invite with a link to sign in. Until then, look inside with sample data, no sign-up needed.'],
];

// What Kauzl is, for search engines and AI assistants (tools/seo-rules.mjs checks it).
const LD = JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'Organization', name: 'Kauzl', url: 'https://kauzl.com/', logo: 'https://kauzl.com/tools/assets/og.png' },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Kauzl', url: 'https://kauzl.com/' },
  { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Kauzl', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    url: 'https://kauzl.com/', description: 'The analytics calendar for your website: Kauzl reads Google Analytics 4, Search Console and Bing, shows each day next to your releases, posts and campaigns, and says what changed and why.' },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
]).replace(/</g, '\\u003c');

const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// What's inside: the questions people ask after they ship, each answered the
// way Kauzl answers it (a verdict and a sentence), with a small picture of the
// real screen as the proof, linked to that screen in the tour
// (/tour/?to=<view>, built from the design by scripts/build-tour.mjs). Sample numbers.
const QA = [
  { key: 'reddit', feature: 'Reddit cycles', to: 'traffic',
    q: 'Which subreddits are worth posting in?',
    verdict: ['Keep 1 · Drop 1', 'amber'],
    a: 'Keep posting in <b>r/SideProject</b>: 2 posts, 140 visits, 6 sign-ups. Drop r/webdev: the mods removed both.',
    visual: `<table class="v-reddit" aria-hidden="true"><thead><tr><th>Subreddit</th><th>Upvotes</th><th>Visits</th><th>Sign-ups</th><th></th></tr></thead><tbody>
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

// "Plugs into what you ship with": every source Kauzl reads. Only real
// connectors (server/*.mjs); your own numbers get their own card below.
const HUB_IN = [
  ['Traffic', ['Google Analytics 4', 'Vercel Web Analytics', 'Firebase Hosting', 'BigQuery']],
  ['Search', ['Search Console', 'Bing Webmaster Tools', 'PageSpeed & CrUX']],
  ['What you ship', ['GitHub', 'Vercel deploys', 'Chrome Web Store']],
  ['Where people talk', ['Reddit', 'Hacker News', 'Product Hunt', 'Bluesky', 'Mastodon', 'Dev.to']],
];


// "Works with what you have": what a tracker shows, and what Kauzl adds to it.
// Sample numbers.
const LEDGER = [
  ['548 visits, up 32%.', '<b>Reddit sent 18 more</b>, the day after your launch post.'],
  ['61 visits on Wednesday.', '<b>4× a normal Wednesday</b>, and nothing you shipped explains it. Don’t guess.'],
  ['“Raycast alternative” shown 927 times.', '<b>Rewrite that title</b>: position 4.7, only 1.5% click. Added to your to-dos.'],
  ['Sign-ups: 41.', '<b>Up 18% since the pricing change</b>, more than a normal week moves.'],
];

const FREE_TOOLS = [
  ['did-it-work', 'Did it work?', 'Paste daily numbers from before and after a change. Find out if the jump is real.'],
  ['utm-builder', 'UTM Builder', 'Tag campaign links for GA4, in bulk, with naming checks.'],
  ['ai-robots-txt-generator', 'AI robots.txt', 'Block AI training crawlers but stay visible in AI search.'],
];

const CSS = `
:root { color-scheme: light; --ink: #121522; --ink-2: #1C2135; --ink-line: #2A3048; --ink-text: #C9CDD8; --amber: #F5A524; --before: #9AA1B2;
  --bg: #F6F7F9; --surface: #FFFFFF; --sunk: #EEF0F4; --text: #121522; --text-2: #3A3F50; --muted: #5B6172; --line: #E3E6EC; --link: #121522; --amber-text: #A35F00;
  --good: #1F7A3D; --good-soft: #E4F4E9; --amber-soft: #FDF1DC; --label: #5B6172; --label-ink: #9AA1B2;
  --head: "Bricolage Grotesque", "Inter", system-ui, sans-serif; --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; }
/* Dark: neutral charcoal, not navy; amber only for actions, the owl and "after". */
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --ink: #141519; --ink-2: #1B1C21; --ink-line: #2A2C33; --ink-text: #C4C4CC; --before: #8B8B94; --bg: #0E0F12; --surface: #18191E; --sunk: #111215; --text: #F4F4F5; --text-2: #D4D4D8; --muted: #A1A1AA; --line: #2C2E36; --link: #F4F4F5; --amber-text: #F5A524; --amber-soft: #1F2026; --label: #A1A1AA; --label-ink: #A1A1AA; --good: #5FD08A; --good-soft: #13291C; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--link); }
h1, h2 { font-family: var(--head); letter-spacing: -0.02em; line-height: 1.1; }
h3 { font-family: var(--font); font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
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
.eyebrow { margin: 0 0 18px; font: 500 15px var(--font); color: var(--ink-text); }
.hero h1 { font-size: clamp(42px, 6.6vw, 76px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.02; margin: 0 0 20px; }
.hero h1 em { font-style: normal; color: var(--amber); }
.lead { font-size: 19px; color: var(--ink-text); margin: 0 0 30px; max-width: 32em; }
.ctas { display: flex; flex-wrap: wrap; gap: 12px; }
.perks { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 22px 0 0; font-size: 14px; color: var(--ink-text); }
.perks li { display: inline-flex; align-items: center; gap: 6px; } .perks svg { color: var(--ink-text); }

/* The hero: an analytics calendar you can click (home-play.js), the owl perched on top */
.play-wrap { position: relative; padding-top: 58px; }
.play-wrap > svg.owl { position: absolute; top: 0; right: 36px; z-index: 2; filter: drop-shadow(0 10px 18px rgb(0 0 0 / .35)); }
.play { position: relative; margin: 0; background: var(--surface); color: var(--text); border-radius: 22px; padding: 18px 20px 20px; box-shadow: 0 30px 70px rgb(0 0 0 / .4), 0 0 0 1px rgb(255 255 255 / .04); }
.play-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; color: var(--muted); margin-bottom: 10px; }
.play-top b { color: var(--text); font-size: 15px; }
.play-top .sample { font-weight: 600; color: var(--amber-text); background: var(--amber-soft); padding: 1px 9px; border-radius: 99px; }
.cal-wk, .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.cal-wk { margin-bottom: 4px; font-size: 11px; font-weight: 600; color: var(--muted); text-align: center; }
.cd { position: relative; height: 40px; padding: 0; border: 0; border-radius: 8px; background: var(--sunk); overflow: hidden; cursor: pointer; font: inherit; color: var(--muted); }
.cd i { position: absolute; left: 0; right: 0; bottom: 0; background: color-mix(in srgb, var(--before) 55%, transparent); transition: background .15s; }
.cd .n { position: absolute; left: 5px; top: 3px; z-index: 1; font-size: 10.5px; font-weight: 600; line-height: 1; }
.cd .mk { position: absolute; right: 3px; top: 2px; z-index: 1; display: grid; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: var(--surface); color: var(--text); }
.cd .mk svg { width: 11px; height: 11px; }
.cd.good .mk { color: var(--good); } .cd.amber .mk { color: var(--amber-text); } .cd.bad .mk { color: #C62F35; }
.cd:hover i { background: color-mix(in srgb, var(--before) 85%, transparent); }
.cd[aria-pressed=true] { outline: 2.5px solid var(--amber); outline-offset: -2.5px; color: var(--text); }
.cd[aria-pressed=true] i { background: var(--amber); }
.dp { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 14px; }
.dp-h { display: flex; align-items: center; gap: 10px; } .dp-h b { font-size: 15px; }
.dp-head { margin: 6px 0 12px; font-size: 15.5px; font-weight: 600; line-height: 1.4; color: var(--text); }
.dp-nums { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.dp-nums > div { display: grid; padding: 8px 12px; border-radius: 12px; background: var(--sunk); font-size: 12px; color: var(--muted); }
.dp-nums b { font: 800 20px/1.15 var(--head); letter-spacing: -0.02em; color: var(--text); }
.dp-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 16px; }
.dp .dp-lbl { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.dp-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 4.6em; gap: 8px; padding: 3px 0; font-size: 13px; }
.dp-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); } .dp-row span:last-child { text-align: right; }
.dp-ev { display: flex; gap: 7px; align-items: flex-start; padding: 3px 0; font-size: 13px; color: var(--text-2); line-height: 1.4; }
.dp-ev svg { flex: none; margin-top: 2px; } .dp-ev.alert svg { color: #C62F35; } .dp-ev.ship svg, .dp-ev.post svg { color: var(--amber-text); }
.dp-eff, .dp-none { margin: 4px 0 0; font-size: 13px; color: var(--muted); line-height: 1.4; }
.dp-now { margin: 12px 0 0; padding: 9px 12px; border-radius: 10px; background: var(--amber-soft); font-size: 13.5px; color: var(--text); line-height: 1.45; }
.dp .good { color: var(--good); } .dp .bad { color: #C62F35; } .dp .muted { color: var(--muted); }
@media (max-width: 520px) { .dp-cols { grid-template-columns: minmax(0, 1fr); gap: 12px; } .cd { height: 36px; } .cd .mk { display: none; } .cd.marked .n { color: var(--text); } .cd.marked::after { content: ""; position: absolute; right: 5px; top: 5px; width: 6px; height: 6px; border-radius: 50%; background: var(--amber); } }
.tag { flex: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 6px; background: var(--ink); color: var(--amber); }

/* sections */
section { padding: 128px 0 0; }
.kicker { margin: 0 0 10px; font: 500 15px var(--font); color: var(--muted); }
h2.title { font-size: clamp(28px, 3.2vw, 38px); font-weight: 800; letter-spacing: -0.03em; margin: 0 0 14px; }
p.sub { color: var(--muted); margin: 0 0 40px; max-width: 36em; font-size: 17px; line-height: 1.6; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 1px 2px rgb(18 21 34 / .04); }
.card h3 { margin: 16px 0 6px; font-size: 17px; }
.card p { margin: 0; color: var(--muted); font-size: 15px; }
/* What's inside: one panel. The questions are radio tabs (no script), the
   unpicked ones a hollow "before" eye, the picked one the filled "after" eye;
   the answers share one grid cell, so switching never moves the page. */
.qa { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 32px 48px; align-items: center; position: relative; }
.qa-r { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; }
.qa-list { display: flex; flex-direction: column; gap: 4px; }
.qa-tab { display: block; position: relative; padding: 14px 18px 14px 44px; border-radius: 16px; cursor: pointer; transition: background .2s; }
.qa-tab:hover { background: var(--surface); }
.qa-tab::before { content: ""; position: absolute; left: 16px; top: 17px; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--before); box-sizing: border-box; transition: border-color .2s, background .2s, transform .2s; }
.qa-n { display: block; margin: 0 0 3px; font: 500 13px var(--font); color: var(--muted); }
.qa-qt { display: block; font: 600 17px/1.35 var(--font); letter-spacing: -0.01em; color: var(--text-2); transition: color .2s; }
${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-list [for=qa-${i + 1}]`).join(',\n')} { background: var(--surface); box-shadow: 0 1px 2px rgb(18 21 34 / .05), 0 10px 28px rgb(18 21 34 / .07); }
.qa-tab:is(${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-list [for=qa-${i + 1}]`).join(', ')})::before { border-color: var(--amber); background: var(--amber); transform: scale(1.15); }
:is(${QA.map((_, i) => `#qa-${i + 1}:checked ~ .qa-list [for=qa-${i + 1}]`).join(', ')}) .qa-qt { color: var(--text); }
${QA.map((_, i) => `#qa-${i + 1}:focus-visible ~ .qa-list [for=qa-${i + 1}]`).join(',\n')} { outline: 2px solid var(--amber); outline-offset: 2px; }
.qa-panels { display: grid; position: relative; }
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
.verdict.amber { color: var(--amber-text); background: var(--amber-soft); }
.verdict.muted { color: var(--muted); background: var(--sunk); }
.verdict.bad { color: #C62F35; background: #FDECEC; }
.qa-text { margin: 0 0 16px; font: 400 17px/1.5 var(--font); color: var(--text-2); }
.qa-text b { font-weight: 650; color: var(--text); }
.b-vis { background: var(--sunk); border-radius: 14px; padding: 16px; font-size: 13px; min-width: 0; }
.qa-go { display: inline-block; margin-top: 14px; font-size: 14px; font-weight: 600; color: var(--link); text-decoration: none; }
.qa-go:hover { text-decoration: underline; }
/* The tour fills the frame; the frame is the only border, in the page's own colours (no white edge in dark mode). */
.tour-frame { margin-top: 24px; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: 0 18px 50px rgba(18,21,34,.14); background: var(--bg); isolation: isolate; }
.tour-frame iframe { display: block; width: 100%; height: 780px; border: 0; }
.tour-full { margin-top: 10px; font-size: 14px; }
.tour-full a { color: var(--link); font-weight: 600; text-decoration: none; }
@media (max-width: 760px) { .tour-frame iframe { height: 720px; } }
.qa-claude { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px 56px; align-items: center; margin-top: 40px; background: var(--ink); color: #F6F7F9; border: 1px solid var(--ink-line); border-radius: 24px; padding: 36px; }
.qa-claude h3 { margin: 0 0 10px; font-family: var(--head); font-size: clamp(26px, 3vw, 34px); font-weight: 800; letter-spacing: -0.035em; color: #F6F7F9; }
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
.v-week .mark { font-size: 10px; font-weight: 700; color: var(--amber-text); min-height: 14px; }
.v-week .d { font-size: 11px; color: var(--muted); }
.v-reddit { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.v-reddit th { text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); padding: 0 6px 6px 0; }
.v-reddit td { padding: 7px 6px 7px 0; border-top: 1px solid var(--line); white-space: nowrap; }
.v-reddit td:first-child { white-space: normal; color: var(--text); font-weight: 600; }
.v-reddit .num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; padding-right: 12px; }
.v-reddit th:nth-child(n+2):not(:last-child) { text-align: right; padding-right: 12px; }
.vp { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.vp.good { color: var(--good); background: var(--good-soft); } .vp.amber { color: var(--amber-text); background: var(--amber-soft); } .vp.bad { color: #C62F35; background: #FDECEC; }
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
section.band .wrap { position: relative; z-index: 1; }
section.band .kicker { color: var(--label-ink); } section.band h2.title { color: #F6F7F9; } section.band p.sub { color: var(--ink-text); }
/* Four before/after cards: the tracker's grey line on top, Kauzl's sentence below. */
.pairs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.pair { margin: 0; background: var(--ink-2); border: 1px solid var(--ink-line); border-radius: 18px; overflow: hidden; }
.pair .says { display: flex; align-items: baseline; gap: 10px; margin: 0; padding: 14px 20px; border-bottom: 1px dashed var(--ink-line); color: #8B90A0; font-size: 15px; font-variant-numeric: tabular-nums; }
.pair .says span { flex: none; font-size: 12.5px; font-weight: 500; padding: 1px 8px; border-radius: 99px; border: 1px solid var(--ink-line); }
.pair .adds { display: flex; gap: 12px; align-items: flex-start; margin: 0; padding: 18px 20px 20px; color: var(--ink-text); font-size: 17px; line-height: 1.45; }
.pair .adds .who { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: #0B0C0F; border: 1px solid var(--ink-line); flex: none; margin-top: -2px; }
.pair b { color: #F6F7F9; font-weight: 600; }
section.band .l-foot { color: var(--ink-text); } section.band .l-foot a { color: #F6F7F9; }
.l-foot { margin: 14px 0 0; color: var(--muted); font-size: 14px; } .l-foot a { color: var(--link); font-weight: 600; }

/* Plugs into: four plain columns of sources, then your own numbers. */
.srcs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 32px; border-top: 1px solid var(--line); padding-top: 24px; }
.srcs h3 { margin: 0 0 12px; font-size: 15px; color: var(--muted); font-weight: 500; }
.srcs ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 15.5px; font-weight: 500; color: var(--text); }
.own { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 24px 48px; align-items: center; margin-top: 40px; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 28px 32px; }
.own h3 { margin: 0 0 8px; font-size: 20px; }
.own p { margin: 0; color: var(--muted); font-size: 15.5px; }
.own ul { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 6px; font-size: 15px; color: var(--text-2); }
.own li::before { content: "✓"; color: var(--good); font-weight: 700; margin-right: 8px; }
.own li.soon::before { content: "○"; color: var(--muted); }
.soon-tag { font-size: 12px; font-weight: 600; color: var(--amber-text); background: var(--amber-soft); padding: 1px 8px; border-radius: 99px; margin-left: 6px; }
.own .v-term { background: #0B0C0F; border: 1px solid var(--ink-line); border-radius: 14px; padding: 16px 18px; font-size: 12.5px; }

/* How it works: headline left, three numbered steps right on one rail; no cards. */
.how { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 32px 72px; align-items: start; }
.how p.sub { margin-bottom: 0; }
.steps { list-style: none; margin: 0; padding: 0; counter-reset: s; position: relative; }
.steps li:not(:last-child)::after { content: ""; position: absolute; left: 21px; top: 44px; bottom: 0; width: 2px; background: var(--line); }
.steps li { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 0 20px; padding-bottom: 32px; }
.steps li:last-child { padding-bottom: 0; }
.steps li::before { counter-increment: s; content: counter(s); position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--surface); border: 2px solid var(--line); color: var(--text); font: 800 18px var(--head); }
.steps li:last-child::before { background: var(--ink); border-color: var(--ink); color: var(--amber); }
.steps h3 { margin: 9px 0 4px; font-size: 19px; }
.steps p { margin: 0; color: var(--muted); font-size: 15.5px; max-width: 32em; }
/* How it works sits on its own full-width band, a step lighter than the page,
   so it never reads as the same block as the FAQ below. */
section.soft { margin-top: 128px; padding: 96px 0; background: var(--surface); border-block: 1px solid var(--line); }
section.soft .st-vis { background: var(--bg); box-shadow: none; }
section.soft .steps li::before { background: var(--bg); }
section.soft .steps li:last-child::before { background: var(--ink); }
/* FAQ: one centred column; each question opens in place (no script). */
.faq-wrap { max-width: 760px; }
.faq-head { text-align: center; margin-bottom: 32px; }
.faq-head h2.title { margin: 0; }
.faq-more { text-align: center; }
.faq { border-top: 1px solid var(--line); }
.faq details { border-bottom: 1px solid var(--line); }
.faq summary { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 0; font-weight: 600; font-size: 17px; color: var(--text); cursor: pointer; list-style: none; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); color: var(--muted); font: 500 18px/1 var(--font); transition: transform .2s, background .2s, color .2s; }
.faq summary:hover::after { color: var(--text); border-color: var(--muted); }
.faq details[open] summary::after { transform: rotate(45deg); background: var(--ink); border-color: var(--ink); color: var(--amber); }
.faq details p { margin: -6px 0 0; padding: 0 44px 20px 0; color: var(--muted); font-size: 15.5px; max-width: 40em; }
.faq-more { margin: 20px 0 0; color: var(--muted); font-size: 15px; } .faq-more a { color: var(--link); font-weight: 600; }

/* Each step shows the screen you'll see: a small, plain picture, sample values. */
.st-vis { margin-top: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; font-size: 13.5px; box-shadow: 0 1px 2px rgb(18 21 34 / .04); }
.st-row { display: grid; grid-template-columns: 9.5em minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 0; }
.st-row + .st-row { border-top: 1px solid var(--line); }
.st-row .k { color: var(--muted); }
.st-row .v { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-ok { color: var(--good); font-size: 12px; font-weight: 600; white-space: nowrap; }
.st-add { color: var(--muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
.st-story { display: flex; gap: 10px; align-items: flex-start; }
.st-story .who { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--ink); flex: none; }
.st-story p { margin: 0; color: var(--text-2); font-size: 14px; max-width: none; }
.st-story b { color: var(--text); }

/* why an owl */




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

footer { margin-top: 96px; padding: 48px 0 56px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer .wrap { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)); gap: 32px; align-items: start; }
.foot-brand { display: flex; gap: 12px; align-items: flex-start; }
.foot-brand p { margin: 0; } .foot-brand .why { margin-top: 6px; max-width: 30em; font-size: 13px; } .foot-brand .word { font-size: 22px; color: var(--text); }
.foot-col h2 { margin: 0 0 12px; font: 600 14px var(--font); letter-spacing: 0; color: var(--text); }
.foot-col ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
.foot-col a { color: var(--muted); text-decoration: none; } .foot-col a:hover { color: var(--text); }
/* Motion: the hero acts out before → after once; answers animate when picked;
   before/after cards turn over as they scroll in (where the browser supports it). */
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
  .dp.in > * { animation: fade-up .3s both; } .dp.in > :nth-child(n+3) { animation-delay: .05s; }
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
    & .v-reddit tbody tr { animation: fade-up .35s both; } & .v-reddit tbody tr:nth-child(2) { animation-delay: .08s; } & .v-reddit tbody tr:nth-child(3) { animation-delay: .16s; } & .v-reddit tbody tr:nth-child(4) { animation-delay: .24s; }
    & .vp { animation: pop .4s .45s both; }
  }
  @supports (animation-timeline: view()) {
    .pair .adds { animation: turn linear both; animation-timeline: view(); animation-range: entry 0% cover 30%; }
  }
}
@media (prefers-color-scheme: dark) {
  .final, .tag { border: 1px solid var(--ink-line); }
  .verdict.bad, .vp.bad { color: #FF8A8E; background: #2A1416; } 
  .play { box-shadow: 0 30px 70px rgb(0 0 0 / .5), 0 0 0 1px var(--line); }
  .st-story .who { border: 1px solid var(--line); }
  .cd.bad .mk, .dp .bad, .dp-ev.alert svg { color: #FF8A8E; }
  .steps li:last-child::before { border-color: #3A3C45; }
  section.band { border-block: 1px solid var(--ink-line); }
  /* Ink owls would vanish on dark cards: draw them light. */
  .foot-brand svg.owl path:first-child { fill: #F6F7F9; }
  .foot-brand svg.owl .eyes > circle { fill: var(--ink); }
}

@media (max-width: 900px) {
  .hero-in { grid-template-columns: minmax(0, 1fr); }
  .hero { padding: 44px 0 100px; }
  .grid, .how { grid-template-columns: minmax(0, 1fr); }
  footer .wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); } .foot-brand { grid-column: 1 / -1; }
  .st-row { grid-template-columns: minmax(0, 1fr) auto; } .st-row .k { grid-column: 1 / -1; font-size: 12px; }
  .qa, .qa-claude { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .srcs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; } .own { grid-template-columns: minmax(0, 1fr); padding: 22px; } .qa-claude { padding: 24px; }
  .qa-list { flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -24px; padding: 4px 24px 12px; gap: 8px; }
  .qa-tab { flex: 0 0 min(78%, 300px); scroll-snap-align: start; background: var(--surface); border: 1px solid var(--line); }
  .pairs { grid-template-columns: minmax(0, 1fr); }
  section.band { padding: 64px 0; }
  nav.links a:not(.keep) { display: none; }
  .top .wrap { gap: 16px; }
}
@media (max-width: 480px) { .join { flex-direction: column; } .wrap { padding-inline: 16px; } .final { padding: 28px; } section { padding-top: 72px; } .qa-list { margin-inline: -16px; padding-inline: 16px; } }
`;

// tools: the free tools are served at /tools/ (TOOLS_ORIGIN is set), so link
// them and borrow their site.js for the owl's moving eyes.
export function homePage({ signedIn = false, tools = false, ga = '', v = '' } = {}) {
  const q = v ? `?v=${encodeURIComponent(v)}` : '';
  // No sign-in needed: /start opens Kauzl in this browser.
  const enter = signedIn ? '/' : '/start';
  const toolsLink = (html) => (tools ? html : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kauzl · The analytics calendar for your website</title>
<meta name="description" content="Kauzl is an analytics calendar for your site: each day’s traffic, search and AI answers next to what you shipped, posted and launched, and what moved and why.">
<link rel="canonical" href="https://kauzl.com/">
<meta property="og:title" content="Kauzl · The analytics calendar for your website"><meta property="og:description" content="Each day’s traffic, search and AI answers on a calendar, next to what you shipped, posted and launched. Kauzl says what moved and why."><meta property="og:type" content="website">
<meta property="og:url" content="https://kauzl.com/"><meta property="og:site_name" content="Kauzl">
<meta property="og:image" content="https://kauzl.com/tools/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Kauzl, the analytics calendar: an owl over a month of website traffic, one day picked and explained.">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${LD}</script>
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
  <nav class="links" aria-label="Sections"><a href="#inside">Look inside</a><a href="#features">Features</a><a href="#how">How it works</a>${toolsLink('<a class="keep" href="/tools/">Free tools</a><a href="/guides/">Course</a>')}</nav>
  <a class="btn amber small" href="${enter}">Open Kauzl</a>
</div></header>

<main>
  <div class="hero"><div class="wrap hero-in">
    <div>
      <p class="eyebrow">Analytics calendar</p>
      <h1>See what happened,<br><em>day by day.</em></h1>
      <p class="lead">Kauzl puts your visits, search and AI answers on a calendar, next to what you shipped, posted and launched. It tells you what moved, why, and what to do next.</p>
      <div class="ctas">
        <a class="btn amber" href="#inside">Look inside</a>
        <a class="btn ghost" href="${enter}">${signedIn ? 'Open Kauzl' : 'Start, no sign-in'}</a>
      </div>
      <ul class="perks"><li>${CHECK}Look around, no sign-up</li><li>${CHECK}No tracking script</li></ul>
    </div>

    <div class="play-wrap">
      ${owl(78, { variant: 'paper' })}
      <figure class="play" id="play">
        <div class="play-top"><b>March · visits a day</b><span class="sample">Pick a day · sample data</span></div>
        ${calendarHtml(FIRST_PICK)}
        <div class="dp">${dayHtml(FIRST_PICK)}</div>
        <p class="cal-live sr" aria-live="polite">${FIRST.label}. ${FIRST.head}</p>
      </figure>
    </div>
  </div></div>

  <section id="inside"><div class="wrap">
    <p class="kicker">Look inside</p><h2 class="title">This is Kauzl</h2>
    <p class="sub">Click around: the Story, a day on the Timeline, a search, a source. Sample data from a made-up site; nothing here is anyone’s.</p>
    <div class="tour-frame"><iframe src="/tour/?embed=1" title="Kauzl, with sample data" loading="lazy"></iframe></div>
    <p class="tour-full"><a href="/tour/">Open it full screen →</a></p>
  </div></section>

  <section id="features"><div class="wrap">
    <p class="kicker">What’s inside</p><h2 class="title">Answers, not dashboards</h2>
    <p class="sub">See which subreddits are worth posting in, which links brought sign-ups, and whether your latest fix helped. Each answer shows the numbers behind it.</p>
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
          <a class="qa-go" href="/tour/?to=${x.to}">See it in Kauzl →</a>
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
    <div class="pairs">
      ${LEDGER.map(([says, adds]) => `<figure class="pair"><p class="says"><span>Your analytics</span>${says}</p><p class="adds"><span class="who" aria-label="Kauzl">${owl(20, { variant: 'paper' })}</span><span>${adds}</span></p></figure>`).join('\n      ')}
    </div>
    <p class="l-foot">Sample numbers. Comparing tools? <a href="/guides/kauzl-vs-plausible/">Kauzl vs Plausible</a>, honestly.</p>
  </div></section>

  <section id="connects"><div class="wrap">
    <p class="kicker">Plugs into what you ship with</p><h2 class="title">Everything you use, one verdict</h2>
    <p class="sub">Connect what you already use, read-only. Kauzl lines it all up on one timeline, so a dip has a reason next to it.</p>
    <div class="srcs">
      ${HUB_IN.map(([group, items]) => `<div><h3>${group}</h3><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('\n      ')}
    </div>
    <div class="own">
      <div><h3>And the numbers only your app knows</h3>
        <p>Sign-ups, revenue, daily active users, trial starts. Bring them in as custom metrics and they sit on the same timeline as your traffic.</p>
        <ul><li>Read from Cloudflare D1 with a SELECT query</li><li class="soon">Send from your own code, cron or Zapier<span class="soon-tag">Soon</span></li></ul></div>
      <pre class="v-term" aria-label="Example: sending a daily number to Kauzl"><span class="you"># once a day, from anywhere</span>
curl -X POST https://kauzl.com/m/&lt;metric-key&gt; \\
  -d '{"day": "2026-11-19", "value": 41}'

<span class="ai">✓</span> Sign-ups · 41 · on the timeline</pre>
    </div>
  </div></section>

  <section id="how" class="soft"><div class="wrap how">
    <div><p class="kicker">How it works</p><h2 class="title">Set up in a few minutes</h2>
    <p class="sub">No new tracking script. Connect what you already use, read-only, and the first Story is ready in minutes.</p></div>
    <ol class="steps">
      <li><div><h3>Sign in with Google</h3><p>Pick your Analytics property and Search Console site. Read-only access.</p>
        <div class="st-vis" aria-hidden="true">
          <div class="st-row"><span class="k">Google Analytics 4</span><span class="v">acme.com · web</span><span class="st-ok">✓ Read-only</span></div>
          <div class="st-row"><span class="k">Search Console</span><span class="v">sc-domain:acme.com</span><span class="st-ok">✓ Read-only</span></div>
        </div></div></li>
      <li><div><h3>Add what you ship</h3><p>Link the GitHub repo, store listing and accounts you post from, so releases and posts land on the Timeline.</p>
        <div class="st-vis" aria-hidden="true">
          <div class="st-row"><span class="k">GitHub</span><span class="v">acme/web</span><span class="st-ok">✓ Releases</span></div>
          <div class="st-row"><span class="k">Reddit</span><span class="v">u/acme_team</span><span class="st-ok">✓ Posts</span></div>
          <div class="st-row"><span class="k">Chrome Web Store</span><span class="v">Acme for Chrome</span><span class="st-add">+ Add</span></div>
        </div></div></li>
      <li><div><h3>Read the Story</h3><p>See what moved and why, set goals and alerts, and turn findings into to-dos that report back.</p>
        <div class="st-vis" aria-hidden="true"><div class="st-story"><span class="who">${owl(20, { variant: 'paper' })}</span>
          <p><b>Sign-ups up 18% since the pricing change</b>, more than a normal week moves. The Reddit post on Thursday added 54 visits.</p></div></div></div></li>
    </ol>
  </div></section>

  <section id="faq"><div class="wrap faq-wrap">
    <div class="faq-head"><p class="kicker">FAQ</p><h2 class="title">Questions, answered</h2></div>
    <div><div class="faq">
      ${FAQ.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${q}</summary><p>${a}</p></details>`).join('\n      ')}
    </div>
    <p class="faq-more">Rather see it? <a href="#inside">Look inside with sample data</a>.</p></div>
  </div></section>

  <section id="early-access"><div class="wrap">
    <div class="final">
      <div>${owl(56, { variant: 'paper' })}
        ${signedIn ? `<h2>See your site’s Story</h2>
        <p>Connect a site and find out what last month’s releases, posts and articles actually did.</p>
        <div class="ctas"><a class="btn amber" href="${enter}">Open Kauzl</a><a class="btn ghost" href="#inside">Look inside first</a></div>` : `<h2>Get early access</h2>
        <p>Kauzl is opening to a few teams at a time. Leave your email and we’ll invite you, with a link to sign in.</p>
        <form class="join" method="post" action="/waitlist">
          <input type="hidden" name="from" value="home">
          <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
          <input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@company.com" aria-label="Your email">
          <button class="btn amber" type="submit">Get early access</button>
        </form>
        <p class="fine">Already invited? <a href="/login">Sign in</a> · or <a href="#inside">look inside first</a></p>`}
      </div>
    </div>
  </div></section>
</main>

<footer><div class="wrap">
  <div class="foot-brand">${owl(40)}<div><p class="word">kauzl</p><p>The owl that watches your site, day by day.</p><p class="why"><b>Why an owl</b> · <em>Kauz</em> is German for a small owl, and Kauzl sounds like “causal”. Its left eye is before you shipped, the right one after.</p></div></div>
  <nav class="foot-col" aria-label="Kauzl"><h2>Kauzl</h2><ul><li><a href="#inside">Look inside</a></li><li><a href="#features">Features</a></li><li><a href="#how">How it works</a></li><li><a href="#faq">FAQ</a></li><li><a href="${enter}">Open Kauzl</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms of service</a></li></ul></nav>
${tools ? `  <nav class="foot-col" aria-label="Free tools"><h2>Free tools</h2><ul>${FREE_TOOLS.map(([slug, name]) => `<li><a href="/tools/${slug}/">${name}</a></li>`).join('')}<li><a href="/tools/">All tools →</a></li></ul></nav>
  <nav class="foot-col" aria-label="Free course"><h2>Free course</h2><ul>${COURSE_ORDER.slice(0, 4).map((slug) => {
    const mod = MODULES.find((m) => m.lessons.some((l) => l.slug === slug));
    const lesson = mod.lessons.find((l) => l.slug === slug);
    return `<li><a href="/guides/${slug}/">Lesson ${COURSE_ORDER.indexOf(slug) + 1} · ${lesson.name}</a></li>\n`;
  })}<li><a href="/guides/">All ${COURSE_ORDER.length} lessons →</a></li></ul></nav>
` : ''}</div></footer>
<script type="module" src="/home-play.js${q}"></script>
${tools ? `<script type="module" src="/tools/assets/site.js${q}"></script>` : ''}
${tools && /^(GTM|G)-[A-Z0-9]+$/.test(ga) ? `<script defer src="/tools/assets/ga.js${q}" data-ga="${ga}"></script>` : ''}
</body></html>`;
}
