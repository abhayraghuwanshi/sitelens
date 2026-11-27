// The public home page of hosted Kauzl: what it is, and Open Kauzl.
// Served at / to visitors without a session (signed-in people get the app
// there) and at /home for everyone. HTML and CSS with no inline script; the
// owl's eye-tracking comes from the free tools' site.js when those are served
// (same origin), and the page works without it. Styled like the free tools
// (tools/assets/site.css): ink, the owl, grey before / green after (the app's teal accent).

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

import { COURSE, MODULES, COURSE_ORDER } from '../tools/course.mjs';
import { BRAND_MARKS, BRAND_NAMES } from '../shared/brand-marks.js';


// Questions people ask before signing up. Plain text answers (also FAQPage
// data): under 320 characters, each starting with its subject (tools/seo-rules.mjs).
const FAQ = [
  ['What is Kauzl?', 'Kauzl is an analytics calendar for your website. It reads Google Analytics 4, Search Console and Bing, shows each day’s visits and searches next to your releases, posts and campaigns, and says what changed, why, and what to do next.'],
  ['Does Kauzl replace Google Analytics?', 'No. Kauzl reads the analytics you already have and adds the why: which release, post or campaign moved the numbers. Keep GA4 or Vercel Web Analytics counting visits.'],
  ['Do I need to add a tracking script?', 'No. Kauzl adds no script to your site. It connects to the tools you already use, read-only, so there is nothing to install and nothing new for visitors to block.'],
  ['What access does Kauzl need?', 'Kauzl asks Google for read-only access to the Analytics property and Search Console site you pick. GitHub, Reddit, the Chrome Web Store and the other sources are optional, and you add only the ones you use.'],
  ['Does Kauzl work without Google Analytics?', 'Yes, from Search Console alone. The calendar then shows search clicks instead of visits. Add GA4, Plausible, PostHog, Cloudflare or Vercel Web Analytics later to see every source.'],
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

// "Why a calendar": the same Thursday, first spread across tools, then on one day.
const WHY_TABS = [
  ['Google Analytics', 'Visits jumped on Thursday'],
  ['Reddit', 'Your post went up Thursday morning'],
  ['GitHub', 'v2.3 released Tuesday'],
  ['Vercel', '3 deploys this week'],
  ['Search Console', 'Clicks about the same'],
  ['Your inbox', 'Alert: sign-ups spiked'],
];
const WHY_DAY = [
  ['post', 'Posted on r/SideProject, 9:12', 'sent 54', 'g'],
  ['bell', 'Sign-ups spiked', '11, usually 6', 'g'],
  ['search', 'Search clicks', 'as usual', 'm'],
  ['ship', 'v2.3 shipped Tuesday', 'no change since', 'm'],
];
// One week of the calendar, drawn like the app: [weekday, date, visits, marks].
const WHY_WEEK = [['Mon', 10, 34, []], ['Tue', 11, 38, ['ship']], ['Wed', 12, 41, []], ['Thu', 13, 88, ['post', 'bell']], ['Fri', 14, 63, []], ['Sat', 15, 30, []], ['Sun', 16, 28, []]];
const svgI = (d) => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const WHY_ICON = {
  post: svgI('<path d="M4 5h16v11H9l-5 4z"/>'),
  bell: svgI('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  ship: svgI('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  search: svgI('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
};

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
  ['Traffic', [['analytics', 'Google Analytics 4'], ['plausible', 'Plausible'], ['posthog', 'PostHog'], ['cloudflare', 'Cloudflare Web Analytics'], ['vercel', 'Vercel Web Analytics'], ['firebase', 'Firebase Hosting'], ['bigquery', 'BigQuery']]],
  ['Search', [['search', 'Search Console'], ['bing', 'Bing Webmaster Tools'], ['pagespeed', 'PageSpeed & CrUX']]],
  ['What you ship', [['github', 'GitHub'], ['vercel', 'Vercel deploys'], ['netlify', 'Netlify'], ['fly', 'Fly.io'], ['extensions', 'Chrome Web Store']]],
  ['Where people talk', [['reddit', 'Reddit, with Reddit cycles'], ['hn', 'Hacker News'], ['producthunt', 'Product Hunt'], ['bluesky', 'Bluesky'], ['mastodon', 'Mastodon'], ['devto', 'Dev.to']]],
];
// The app's own marks (shared/brand-marks.js, from BrandIcon.jsx), plus stand-ins for the three the app doesn't draw.
// Simplified marks in each brand's colour, used only to name the service.
const MARK = {
  ...BRAND_MARKS,
  bluesky: '<path d="M6.3 4.6c2.3 1.7 4.7 5.2 5.7 7 1-1.8 3.4-5.3 5.7-7 1.6-1.2 4.3-2.2 4.3.9 0 .6-.4 5.2-.6 5.9-.7 2.6-3.3 3.2-5.6 2.8 4 .7 5 3 2.8 5.2-4.2 4.3-6-1.1-6.5-2.5l-.1-.3-.1.3c-.5 1.4-2.3 6.8-6.5 2.5-2.2-2.2-1.2-4.5 2.8-5.2-2.3.4-4.9-.2-5.6-2.8C2.4 10.7 2 6.1 2 5.5c0-3.1 2.7-2.1 4.3-.9z" fill="#1185FE"/>',
  mastodon: '<rect x="3" y="2.5" width="18" height="17" rx="5" fill="#6364FF"/><path d="M7.5 15V9.4c0-1.3.9-2.2 2.1-2.2s2.1.9 2.1 2.2v2.8-2.8c0-1.3.9-2.2 2.1-2.2s2.1.9 2.1 2.2V15" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 19.5c1 1.3 3.5 2 6.5 1.2" fill="none" stroke="#6364FF" stroke-width="1.8" stroke-linecap="round"/>',
  devto: '<rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor"/><text x="12" y="15.2" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="7.2" fill="var(--surface)">DEV</text>',
};
// The strip under the product: the best-known of them, one mark each.
const READS = ['analytics', 'search', 'plausible', 'posthog', 'cloudflare', 'vercel', 'github', 'netlify', 'bing', 'reddit', 'hn', 'producthunt'];
const mark = (key) => (MARK[key] ? `<span class="lg" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18">${MARK[key]}</svg></span>` : '');


// "Works with what you have": what a tracker shows, and what Kauzl adds to it.
// Sample numbers.
const FREE_TOOLS = [
  ['did-it-work', 'Did it work?', 'Paste daily numbers from before and after a change. Find out if the jump is real.'],
  ['utm-builder', 'UTM Builder', 'Tag campaign links for GA4, in bulk, with naming checks.'],
  ['ai-robots-txt-generator', 'AI robots.txt', 'Block AI training crawlers but stay visible in AI search.'],
];

const CSS = `
:root { color-scheme: light; --ink: #121522; --ink-2: #1C2135; --ink-line: #2A3048; --ink-text: #C9CDD8; --accent: #2FA596; --accent-hi: #7FD1C4; --before: #9AA1B2;
  --bg: #F6F7F9; --surface: #FFFFFF; --sunk: #EEF0F4; --text: #121522; --text-2: #3A3F50; --muted: #5B6172; --line: #E3E6EC; --link: #121522; --accent-text: #0F766E;
  --good: #1F7A3D; --good-soft: #E4F4E9; --accent-soft: #DCEFEB; --label: #5B6172; --label-ink: #9AA1B2;
  --head: "Bricolage Grotesque", "Inter", system-ui, sans-serif; --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; }
/* Dark: neutral charcoal, not navy; green only for actions and "after"; amber only in the owl's eyes. */
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --ink: #141519; --ink-2: #1B1C21; --ink-line: #2A2C33; --ink-text: #C4C4CC; --before: #8B8B94; --bg: #0E0F12; --surface: #18191E; --sunk: #111215; --text: #F4F4F5; --text-2: #D4D4D8; --muted: #A1A1AA; --line: #2C2E36; --link: #F4F4F5; --accent-text: #4FC0B0; --accent-soft: #13302C; --label: #A1A1AA; --label-ink: #A1A1AA; --good: #5FD08A; --good-soft: #13291C; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--link); }
h1, h2 { font-family: var(--head); letter-spacing: -0.02em; line-height: 1.1; }
h3 { font-family: var(--font); font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
.wrap { max-width: 1120px; margin: 0 auto; padding-inline: 24px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

svg.owl { display: block; flex: none; overflow: visible; }
svg.owl .pupils { transition: transform .18s ease-out; }
svg.owl .eyes { transform-box: fill-box; transform-origin: center; animation: blink 7s infinite; }
@keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(.08); } 97% { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { svg.owl .eyes { animation: none; } }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: 11px; font: 600 15px var(--font); text-decoration: none; border: 1px solid transparent; white-space: nowrap; transition: filter .15s, border-color .15s; }
.btn { transition: transform .15s ease, box-shadow .2s ease, border-color .2s, filter .2s; }
.btn.accent { background: var(--accent); color: #06201c; box-shadow: inset 0 1px 0 rgb(255 255 255 / .25), 0 6px 20px rgb(47 165 150 / .28); }
.btn.accent:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgb(255 255 255 / .25), 0 10px 28px rgb(47 165 150 / .4); }
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
.hero { background: var(--ink); color: #F6F7F9; position: relative; overflow: hidden; padding: 80px 0 280px; text-align: center; }
/* A green light rising from where the product sits. */
.hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(55% 45% at 50% 100%, rgb(47 165 150 / .30), transparent 70%), radial-gradient(40% 30% at 50% 0%, rgb(47 165 150 / .10), transparent 70%); pointer-events: none; }
.hero::before, .final::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgb(255 255 255 / .07) 1px, transparent 1.2px); background-size: 22px 22px; pointer-events: none; }
.hero::before { mask-image: radial-gradient(ellipse at center, #000 20%, transparent 75%); }
.hero-in { position: relative; display: grid; justify-items: center; }
.hero-in > svg.owl { margin-bottom: 20px; filter: drop-shadow(0 10px 18px rgb(0 0 0 / .35)); }
.eyebrow { margin: 0 0 18px; font: 500 15px var(--font); color: var(--ink-text); }
.hero h1 { font-size: clamp(42px, 6.6vw, 76px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.02; margin: 0 0 20px; }
.hero h1 em { font-style: normal; color: var(--accent); background: linear-gradient(100deg, #A7E6DB 0%, #2FA596 55%, #1E8A7D 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.lead { font-size: 19px; color: var(--ink-text); margin: 0 0 30px; max-width: 36em; }
.ctas { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.hero .perks { justify-content: center; }
.perks { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 22px 0 0; font-size: 14px; color: var(--ink-text); }
.perks li { display: inline-flex; align-items: center; gap: 6px; } .perks svg { color: var(--ink-text); }

.tag { flex: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 6px; background: var(--ink); color: var(--accent); }

/* sections */
section { padding: 128px 0 0; }
.kicker { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 4px 12px 4px 10px; border-radius: 99px; font: 600 13px var(--font); color: var(--accent-text); background: var(--accent-soft); }
.kicker::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
h2.title { font-size: clamp(28px, 3.2vw, 38px); font-weight: 800; letter-spacing: -0.03em; margin: 0 0 14px; }
p.sub { color: var(--muted); margin: 0 0 40px; max-width: 36em; font-size: 17px; line-height: 1.6; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 1px 2px rgb(18 21 34 / .04); }
.card h3 { margin: 16px 0 6px; font-size: 17px; }
.card p { margin: 0; color: var(--muted); font-size: 15px; }
/* What's inside: one panel. The questions are radio tabs (no script), the
   unpicked ones a hollow "before" eye, the picked one the filled "after" eye;
   the answers share one grid cell, so switching never moves the page. */
.why { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.15fr); gap: 20px; align-items: center; margin: 32px 0 0; padding: 32px; border-radius: 24px; background: var(--ink); color: #F6F7F9; border: 1px solid var(--ink-line); position: relative; overflow: hidden; }
.why::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgb(255 255 255 / .06) 1px, transparent 1.2px); background-size: 22px 22px; pointer-events: none; mask-image: linear-gradient(90deg, #000, transparent 55%); }
.why figure { margin: 0; display: grid; gap: 16px; position: relative; }
.why figcaption { display: grid; gap: 2px; font: 700 20px/1.2 var(--head); letter-spacing: -0.02em; }
.why figcaption span { font: 600 12px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-text); }
.why-a figcaption span { color: var(--accent); }
.why-cap { margin: 0; font-size: 14px; color: var(--ink-text); }
/* Before: six tool tabs, scattered and grey. */
.why-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.why-tab { background: var(--ink-2); border: 1px solid var(--ink-line); border-radius: 10px; padding: 0 0 10px; color: var(--before); font-size: 13px; line-height: 1.35; }
.why-tab:nth-child(odd) { transform: rotate(-1.2deg); } .why-tab:nth-child(even) { transform: rotate(1deg) translateY(6px); }
.why-tt { display: flex; align-items: center; gap: 4px; padding: 7px 10px; margin-bottom: 8px; border-bottom: 1px solid var(--ink-line); font-weight: 600; font-size: 12px; color: var(--ink-text); }
.why-tt i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-line); } .why-tt i:last-of-type { margin-right: 6px; }
.why-tab p { margin: 0; padding: 0 10px; }
.why-arrow { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: var(--ink); box-shadow: 0 0 0 8px rgb(47 165 150 / .12); }
/* After: the app's calendar, in its own dark teal. */
.why-app { background: #1a1a19; border: 1px solid #2d2d2a; border-radius: 14px; padding: 14px; display: grid; gap: 12px; color: #f0efec; box-shadow: 0 24px 50px rgb(0 0 0 / .35); }
.why-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.why-cd { position: relative; display: grid; align-content: space-between; min-height: 74px; padding: 6px 7px; border-radius: 8px; border: 1px solid #2d2d2a; background: color-mix(in srgb, #2fa596 calc(var(--h) * .55), #1f2120); font-size: 11px; }
.why-cd .wd { color: #8f8e86; font-size: 10px; }
.why-cd .dn { display: flex; align-items: center; gap: 3px; color: #c3c2b7; font-weight: 600; } .why-cd .dn svg { width: 10px; height: 10px; } .why-cd .dn svg:first-of-type { margin-left: auto; }
.why-cd b { font-size: 14px; font-variant-numeric: tabular-nums; }
.why-cd.on { outline: 2px solid var(--accent-hi); outline-offset: 1px; background: color-mix(in srgb, #2fa596 70%, #1f2120); }
.why-pick { display: grid; gap: 8px; padding: 12px 4px 2px; border-top: 1px solid #2d2d2a; font-size: 13px; }
.why-ph { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; color: #8f8e86; margin-bottom: 2px; }
.why-ph > b { font-size: 14px; color: #f0efec; } .why-ph span b { font-size: 18px; color: #f0efec; }
.why-row { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.why-row svg { color: #8f8e86; }
.why-row .g { color: #5fd08a; } .why-row .m { color: #8f8e86; }
@media (max-width: 900px) { .why { grid-template-columns: minmax(0, 1fr); padding: 22px; } .why-arrow { justify-self: center; transform: rotate(90deg); } }
@media (max-width: 480px) { .why-cd { min-height: 60px; padding: 5px; } .why-cd .dn svg { display: none; } .why-cd b { font-size: 12px; } }
.b-vis { background: var(--sunk); border-radius: 14px; padding: 16px; font-size: 13px; min-width: 0; }
/* The tour fills the frame; the frame is the only border, in the page's own colours (no white edge in dark mode). */
.tour-frame { margin-top: 24px; border: 1px solid #2d2d2a; border-radius: 16px; overflow: hidden; box-shadow: 0 18px 50px rgba(18,21,34,.14); background: #121211; isolation: isolate; }
/* The product rises out of the hero, in a window, lit from behind. */
section.showcase { padding-top: 0; }
.showcase .tour-frame { position: relative; z-index: 2; margin-top: -220px; border-radius: 18px; border-color: #34342f; box-shadow: 0 50px 100px -20px rgb(0 0 0 / .45), 0 0 0 1px rgb(255 255 255 / .04), 0 0 140px -10px rgb(47 165 150 / .35); }
.win { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; background: #1a1a19; border-bottom: 1px solid #2d2d2a; }
.win i { width: 11px; height: 11px; border-radius: 50%; background: #3a3a36; }
.win span { flex: 1; text-align: center; margin-right: 50px; font-size: 12.5px; color: #8f8e86; }
.show-cap { margin: 18px auto 0; max-width: 46em; text-align: center; font-size: 14.5px; color: var(--muted); }
.show-cap a { color: var(--accent-text); font-weight: 600; text-decoration: none; white-space: nowrap; }
.reads { margin-top: 64px; display: grid; justify-items: center; gap: 18px; }
.reads p { margin: 0; font-size: 12.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.reads ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.reads li { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); color: var(--text); box-shadow: 0 1px 2px rgb(18 21 34 / .05); filter: grayscale(1); opacity: .75; transition: filter .2s, opacity .2s, transform .2s; }
.reads li:hover { filter: none; opacity: 1; transform: translateY(-2px); }
.tour-frame iframe { display: block; width: 100%; height: 780px; border: 0; }
.tour-full { margin-top: 10px; font-size: 14px; }
.tour-full a { color: var(--link); font-weight: 600; text-decoration: none; }
@media (max-width: 760px) { .tour-frame iframe { height: 720px; } .hero { padding-bottom: 190px; } .showcase .tour-frame { margin-top: -150px; } .win span { margin-right: 0; } .reads li { width: 44px; height: 44px; } }
.qa-claude { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px 56px; align-items: center; margin-top: 40px; background: var(--ink); color: #F6F7F9; border: 1px solid var(--ink-line); border-radius: 24px; padding: 36px; }
.qa-claude h3 { margin: 0 0 10px; font-family: var(--head); font-size: clamp(26px, 3vw, 34px); font-weight: 800; letter-spacing: -0.035em; color: #F6F7F9; }
.qa-claude h3 em { font-style: normal; color: var(--accent); }
.qa-claude p { margin: 0; color: var(--ink-text); }
.qa-claude .b-vis { background: #0B0C0F; border: 1px solid var(--ink-line); }
.v-term { margin: 0; font: 13px/1.7 ui-monospace, "SF Mono", Menlo, monospace; color: #D8DBE5; white-space: pre; overflow-x: auto; }
.v-term .you { color: var(--accent); font-weight: 700; } .v-term .tool { color: #8FB3FF; } .v-term .ai { color: #7EE2A8; font-weight: 700; }

/* Plugs into: four plain columns of sources, then your own numbers. */
.srcs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 32px; border-top: 1px solid var(--line); padding-top: 24px; }
.srcs h3 { margin: 0 0 12px; font-size: 15px; color: var(--muted); font-weight: 500; }
.srcs ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 15.5px; font-weight: 500; color: var(--text); }
.srcs li { display: flex; align-items: center; gap: 10px; }
.srcs .lg { display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 9px; background: var(--surface); border: 1px solid var(--line); color: var(--text); box-shadow: 0 1px 2px rgb(18 21 34 / .05); }
.own { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 24px 48px; align-items: center; margin-top: 40px; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 28px 32px; }
.own h3 { margin: 0 0 8px; font-size: 20px; }
.own p { margin: 0; color: var(--muted); font-size: 15.5px; }
.own ul { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 6px; font-size: 15px; color: var(--text-2); }
.own li::before { content: "✓"; color: var(--good); font-weight: 700; margin-right: 8px; }
.own li.soon::before { content: "○"; color: var(--muted); }
.soon-tag { font-size: 12px; font-weight: 600; color: var(--accent-text); background: var(--accent-soft); padding: 1px 8px; border-radius: 99px; margin-left: 6px; }
.own .v-term { background: #0B0C0F; border: 1px solid var(--ink-line); border-radius: 14px; padding: 16px 18px; font-size: 12.5px; }

/* How it works: headline left, three numbered steps right on one rail; no cards. */
.how { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 32px 72px; align-items: start; }
.how p.sub { margin-bottom: 0; }
.steps { list-style: none; margin: 0; padding: 0; counter-reset: s; position: relative; }
.steps li:not(:last-child)::after { content: ""; position: absolute; left: 21px; top: 44px; bottom: 0; width: 2px; background: var(--line); }
.steps li { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 0 20px; padding-bottom: 32px; }
.steps li:last-child { padding-bottom: 0; }
.steps li::before { counter-increment: s; content: counter(s); position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--surface); border: 2px solid var(--line); color: var(--text); font: 800 18px var(--head); }
.steps li:last-child::before { background: var(--ink); border-color: var(--ink); color: var(--accent); }
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
.faq details[open] summary::after { transform: rotate(45deg); background: var(--ink); border-color: var(--ink); color: var(--accent); }
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




.final { position: relative; overflow: hidden; display: grid; justify-items: center; text-align: center; background: var(--ink); color: #F6F7F9; border-radius: 28px; padding: 56px 44px; }
.final::after { content: ""; position: absolute; inset: 0; background: radial-gradient(50% 70% at 50% 120%, rgb(47 165 150 / .35), transparent 70%); pointer-events: none; }
.final > * { position: relative; z-index: 1; }
.final > * { position: relative; }
.final h2 { font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.035em; margin: 16px 0 10px; }
.final p { color: var(--ink-text); margin: 0 auto 24px; max-width: 30em; }
.join { display: flex; gap: 10px; width: 100%; max-width: 460px; margin: 0 auto; }
.join input[type=email] { flex: 1; min-width: 0; min-height: 46px; padding: 10px 14px; border-radius: 11px; border: 1px solid var(--ink-line); background: var(--ink-2); color: #F6F7F9; font: 15px var(--font); }
.join input[type=email]::placeholder { color: var(--ink-text); opacity: .7; }
.join input[type=email]:focus { outline: none; border-color: var(--accent); }
.join .btn { border: 0; cursor: pointer; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.final .fine { margin: 14px auto 0; font-size: 14px; } .final .fine a { color: #F6F7F9; } .final .ctas { justify-content: center; } .final svg.owl { margin: 0 auto; }

footer { margin-top: 96px; padding: 48px 0 56px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer .wrap { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)); gap: 32px; align-items: start; }
.foot-brand { display: flex; gap: 12px; align-items: flex-start; }
.foot-brand p { margin: 0; } .foot-brand .foot-why { margin-top: 6px; max-width: 30em; font-size: 13px; } .foot-brand .word { font-size: 22px; color: var(--text); }
.foot-col h2 { margin: 0 0 12px; font: 600 14px var(--font); letter-spacing: 0; color: var(--text); }
.foot-col ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
.foot-col a { color: var(--muted); text-decoration: none; } .foot-col a:hover { color: var(--text); }
/* Motion helpers. */
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@keyframes draw { from { stroke-dashoffset: 1; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(8px); } }
@keyframes pop { 0% { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.08); } }
@keyframes grow-y { from { transform: scaleY(0); } }
@keyframes grow-x { from { transform: scaleX(0); } }
@keyframes dim { from { color: #F6F7F9; } }
@keyframes flow { to { background-position: 22px 0; } }
@keyframes breathe { 50% { box-shadow: 0 0 0 14px rgb(47 165 150 / .16), 0 0 0 30px rgb(47 165 150 / .05), 0 24px 50px rgb(18 21 34 / .25); } }
@keyframes nudge { 0%, 100% { transform: none; } 10% { transform: translateY(-3px); } 20% { transform: none; } }
@keyframes drop { 0% { transform: translateY(-40px); opacity: 0; } 60% { transform: translateY(3px); opacity: 1; } }
@media (prefers-color-scheme: dark) {
  .final, .tag { border: 1px solid var(--ink-line); }
  .st-story .who { border: 1px solid var(--line); }
  .steps li:last-child::before { border-color: #3A3C45; }
  /* Ink owls would vanish on dark cards: draw them light. */
  .foot-brand svg.owl path:first-child { fill: #F6F7F9; }
  .foot-brand svg.owl .eyes > circle { fill: var(--ink); }
}

@media (max-width: 900px) {
  .hero { padding: 56px 0 220px; } .showcase .tour-frame { margin-top: -170px; }
  .grid, .how { grid-template-columns: minmax(0, 1fr); }
  footer .wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); } .foot-brand { grid-column: 1 / -1; }
  .st-row { grid-template-columns: minmax(0, 1fr) auto; } .st-row .k { grid-column: 1 / -1; font-size: 12px; }
  .qa-claude { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .srcs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; } .own { grid-template-columns: minmax(0, 1fr); padding: 22px; } .qa-claude { padding: 24px; }
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
  <a class="btn accent small" href="${enter}">Open Kauzl</a>
</div></header>

<main>
  <div class="hero"><div class="wrap hero-in">
    ${owl(72, { variant: 'paper' })}
    <p class="eyebrow">One timeline for everything you ship</p>
    <h1>The analytics calendar<br><em>for your app.</em></h1>
    <p class="lead">Kauzl puts your visits, search and AI answers on one calendar, next to what you shipped, posted and launched. It tells you what moved, why, and what to do next.</p>
    <div class="ctas">
      <a class="btn accent" href="#inside">Look inside</a>
      <a class="btn ghost" href="${enter}">${signedIn ? 'Open Kauzl' : 'Start, no sign-in'}</a>
    </div>
    <ul class="perks"><li>${CHECK}Look around, no sign-up</li><li>${CHECK}No tracking script</li></ul>
  </div></div>

  <section id="inside" class="showcase"><div class="wrap">
    <div class="tour-frame">
      <div class="win" aria-hidden="true"><i></i><i></i><i></i><span>kauzl.com · Timeline</span></div>
      <iframe src="/tour/?embed=1&amp;only=timeline&amp;theme=dark" title="Kauzl’s Timeline, with sample data" loading="lazy"></iframe>
    </div>
    <p class="show-cap">This is the real Timeline, with sample data from a made-up site. Pick a day to see why it moved. <a href="/tour/">See the whole app →</a></p>
    <div class="reads">
      <p>Reads what you already use</p>
      <ul>${READS.map((k) => `<li title="${BRAND_NAMES[k] || k}"><svg viewBox="0 0 24 24" width="22" height="22" role="img" aria-label="${BRAND_NAMES[k] || k}">${MARK[k]}</svg></li>`).join('')}</ul>
    </div>
  </div></section>

  <section id="features"><div class="wrap">
    <p class="kicker">Why a calendar</p><h2 class="title">Everything that happened, in one place</h2>
    <p class="sub">Your visits are in Google Analytics, releases in GitHub, deploys in Vercel, posts on Reddit, alerts in your inbox. When a number moves, the reason is in another tab, under a date you match up yourself. Kauzl puts it all on one calendar, so the why sits on the same day as the number.</p>
    <div class="why">
      <figure class="why-b"><figcaption><span>Today</span>Six tabs, six dates</figcaption>
        <div class="why-tabs">${WHY_TABS.map(([tool, says]) => `<div class="why-tab"><span class="why-tt"><i></i><i></i><i></i>${tool}</span><p>${says}</p></div>`).join('')}</div>
        <p class="why-cap">You line the dates up in your head.</p></figure>
      <div class="why-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
      <figure class="why-a"><figcaption><span>In Kauzl</span>One calendar, one day</figcaption>
        <div class="why-app">
          <div class="why-week">${WHY_WEEK.map(([d, n, v, marks]) => `<div class="why-cd${d === 'Thu' ? ' on' : ''}" style="--h:${Math.round(Math.min(1, v / 90) * 100)}%"><span class="wd">${d}</span><span class="dn">${n}${marks.map((m) => WHY_ICON[m]).join('')}</span><b>${v}</b></div>`).join('')}</div>
          <div class="why-pick"><div class="why-ph"><b>Thu 13 Nov</b><span><b>88</b> visits · usually 40</span></div>
            ${WHY_DAY.map(([icon, what, note, tone]) => `<div class="why-row">${WHY_ICON[icon]}<span>${what}</span><span class="${tone}">${note}</span></div>`).join('')}
          </div>
        </div>
        <p class="why-cap">The reason sits on the same day as the number.</p></figure>
    </div>
    <div class="qa-claude">
      <div><h3>${AGENT.q.replace('your agent', '<em>your agent</em>')}</h3><p>${AGENT.a}</p></div>
      <div class="b-vis">${AGENT.visual}</div>
    </div>
  </div></section>

  <section id="connects"><div class="wrap">
    <p class="kicker">Plugs into what you ship with</p><h2 class="title">Everything you use, one verdict</h2>
    <p class="sub">Connect what you already use, read-only. Kauzl lines it all up on one timeline, so a dip has a reason next to it.</p>
    <div class="srcs">
      ${HUB_IN.map(([group, items]) => `<div><h3>${group}</h3><ul>${items.map(([key, name]) => `<li>${mark(key)}${name}</li>`).join('')}</ul></div>`).join('\n      ')}
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
    <p class="sub">No new tracking script. Connect what you already use, read-only, and your calendar fills in within minutes.</p></div>
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
      <li><div><h3>Open the calendar</h3><p>Pick a day to see what moved and why, next to what you shipped. Alerts and to-dos wait in the Inbox.</p>
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
        ${signedIn ? `<h2>See your site’s calendar</h2>
        <p>Connect a site and find out what last month’s releases, posts and articles actually did.</p>
        <div class="ctas"><a class="btn accent" href="${enter}">Open Kauzl</a><a class="btn ghost" href="#inside">Look inside first</a></div>` : `<h2>Get early access</h2>
        <p>Kauzl is opening to a few teams at a time. Leave your email and we’ll invite you, with a link to sign in.</p>
        <form class="join" method="post" action="/waitlist">
          <input type="hidden" name="from" value="home">
          <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
          <input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@company.com" aria-label="Your email">
          <button class="btn accent" type="submit">Get early access</button>
        </form>
        <p class="fine">Already invited? <a href="/login">Sign in</a> · or <a href="#inside">look inside first</a></p>`}
      </div>
    </div>
  </div></section>
</main>

<footer><div class="wrap">
  <div class="foot-brand">${owl(40)}<div><p class="word">kauzl</p><p>The owl that watches your site, day by day.</p><p class="foot-why"><b>Why an owl</b> · <em>Kauz</em> is German for a small owl, and Kauzl sounds like “causal”. Its left eye is before you shipped, the right one after.</p></div></div>
  <nav class="foot-col" aria-label="Kauzl"><h2>Kauzl</h2><ul><li><a href="#inside">Look inside</a></li><li><a href="#features">Features</a></li><li><a href="#how">How it works</a></li><li><a href="#faq">FAQ</a></li><li><a href="${enter}">Open Kauzl</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms of service</a></li></ul></nav>
${tools ? `  <nav class="foot-col" aria-label="Free tools"><h2>Free tools</h2><ul>${FREE_TOOLS.map(([slug, name]) => `<li><a href="/tools/${slug}/">${name}</a></li>`).join('')}<li><a href="/tools/">All tools →</a></li></ul></nav>
  <nav class="foot-col" aria-label="Free course"><h2>Free course</h2><ul>${COURSE_ORDER.slice(0, 4).map((slug) => {
    const mod = MODULES.find((m) => m.lessons.some((l) => l.slug === slug));
    const lesson = mod.lessons.find((l) => l.slug === slug);
    return `<li><a href="/guides/${slug}/">Lesson ${COURSE_ORDER.indexOf(slug) + 1} · ${lesson.name}</a></li>`;
  }).join('')}<li><a href="/guides/">All ${COURSE_ORDER.length} lessons →</a></li></ul></nav>
` : ''}</div></footer>
${tools ? `<script type="module" src="/tools/assets/site.js${q}"></script>` : ''}
${tools && /^(GTM|G)-[A-Z0-9]+$/.test(ga) ? `<script defer src="/tools/assets/ga.js${q}" data-ga="${ga}"></script>` : ''}
</body></html>`;
}
