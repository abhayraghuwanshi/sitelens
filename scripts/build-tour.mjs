// Builds the public tour (kauzl.com/tour) from the design prototype
// (docs/redesign/prototype.html): the "Proposed" app only, with its sample data,
// without the design notes or the "Today" version. The script goes to its own
// file because the public pages' CSP allows no inline JS.
//
//   node scripts/build-tour.mjs   → server/tour/index.html, server/tour/tour.js
//
// Rerun it whenever the prototype changes.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const src = await readFile(new URL('../docs/redesign/prototype.html', import.meta.url), 'utf8');
const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
let js = src.slice(src.lastIndexOf('<script>') + 8, src.lastIndexOf('</script>'));

const must = (cond, what) => { if (!cond) throw new Error(`build-tour: ${what} not found in the prototype; update scripts/build-tour.mjs`); };

// The one inline handler (Fetch as… select) becomes a delegated listener.
const inline = `onchange="run('botas:' + ['google', 'bing', 'gpt'][this.selectedIndex])"`;
must(js.includes(inline), 'the botas onchange handler');
js = js.replace(inline, 'data-botas="1"');
must(/\n\s*const S = \{\n\s*mode: 'after'/.test(js), "S starting in mode 'after'");

// The tour's hint, and its start: ?to=<screen> (the home page links to screens),
// ?embed=1 inside the home page's frame, a phone frame on narrow screens.
const hintAt = js.indexOf('  hint.textContent = S.mode');
must(hintAt > 0, 'the hint text');
js = js.replace(/  hint\.textContent = S\.mode === 'after'[\s\S]*?;\n/, "  hint.textContent = S.device === 'phone' ? 'Tap anything: the tabs, a day, the site chip.' : 'Click anything: the sidebar, a day on the Timeline, a search, a source. Sample data.';\n");
must(js.trimEnd().endsWith('render();'), 'the final render()');
js = js.trimEnd().replace(/render\(\);$/, `// --- tour start (scripts/build-tour.mjs) ---
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el && el.dataset && el.dataset.botas) run('botas:' + ['google', 'bing', 'gpt'][el.selectedIndex]);
});
{
  const p = new URLSearchParams(location.search);
  const TO = { story: 'view:timeline', timeline: 'view:timeline', inbox: 'view:inbox', todos: 'view:inbox', alerts: 'view:inbox',
    pages: 'view:pages', cycles: 'view:pages', health: 'view:pages|tab:health', search: 'view:search', ai: 'view:search|tab:ai',
    traffic: 'view:traffic', campaigns: 'view:traffic', journeys: 'view:journeys', funnels: 'view:journeys', goals: 'view:goals', outcomes: 'view:goals', live: 'view:live' };
  if (p.get('device') === 'phone' || p.get('device') === 'desktop') S.device = p.get('device');
  else if (window.innerWidth < 760) S.device = 'phone';
  if (p.get('embed') === '1') document.body.classList.add('embed');
  const to = TO[p.get('to')];
  if (to) run(to); else render();
}
`);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A look inside Kauzl</title>
<meta name="description" content="Click through Kauzl with sample data: the Story, Timeline, Search, Traffic, Journeys and Goals.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>${css}
/* --- tour (scripts/build-tour.mjs) --- */
.tour-bar { display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; max-width: 1320px; margin: 0 auto; padding: 14px 16px; }
.tour-logo { display: inline-flex; align-items: center; gap: 8px; color: var(--text); font-family: 'Space Grotesk', var(--font); font-weight: 700; font-size: 18px; text-decoration: none; }
.tour-note { color: var(--text-3); font-size: 13px; }
.tour-bar .tour-grow { flex: 1; }
.tour-cta { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 10px; background: #F5A524; color: #121522; font-weight: 600; font-size: 14px; text-decoration: none; }
.tour-main { max-width: 1320px; margin: 0 auto; padding: 0 16px 24px; display: grid; gap: 8px; }
body.embed .tour-bar { display: none; }
body.embed .tour-main { padding: 0; max-width: none; }
body.embed .hint { display: none; }
</style>
</head>
<body>
<header class="tour-bar">
  <a class="tour-logo" href="/" target="_top"><svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="15" fill="#121522"/><g transform="translate(8.96 9.96) scale(.72)"><path d="M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z" fill="#F6F7F9"/><circle cx="22.5" cy="34" r="9.5" fill="#121522"/><circle cx="41.5" cy="34" r="9.5" fill="#121522"/><circle cx="22.5" cy="34" r="4.2" fill="none" stroke="#F5A524" stroke-width="2.6"/><circle cx="41.5" cy="34" r="5" fill="#F5A524"/><path d="M32 44 L28.8 47.6 L32 52 L35.2 47.6 Z" fill="#F5A524"/></g></svg>Kauzl</a>
  <span class="tour-note">A look inside · sample data, nothing here is yours</span>
  <span class="tour-grow"></span>
  <div class="seg" role="group" aria-label="Device">
    <button type="button" data-act="device:desktop">Desktop</button>
    <button type="button" data-act="device:phone">Phone</button>
  </div>
  <a class="tour-cta" href="/waitlist" target="_top">Get early access</a>
</header>
<main class="tour-main">
  <div id="stage" class="stage"></div>
  <p class="hint" id="hint"></p>
</main>
<script src="/tour/tour.js"></script>
</body>
</html>
`;

await mkdir(new URL('../server/tour/', import.meta.url), { recursive: true });
await writeFile(new URL('../server/tour/index.html', import.meta.url), html);
await writeFile(new URL('../server/tour/tour.js', import.meta.url), js);
console.log(`Tour built: server/tour/index.html (${(html.length / 1024).toFixed(0)} KB), server/tour/tour.js (${(js.length / 1024).toFixed(0)} KB)`);
