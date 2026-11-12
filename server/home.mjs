// The public home page of the hosted Studio: what it is, and Enter Studio.
// Served at / to visitors without a session (signed-in people get the app
// there) and at /home for everyone. Plain HTML and CSS, no scripts, so it fits
// the gateway's CSP; the logo is inline so nothing behind sign-in is needed.

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><defs><linearGradient id="sl-bg" x1="0" y1="0" x2="1" y2="1.3"><stop offset="0" stop-color="#db562d"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect x="3.5" y="3.5" width="57" height="57" rx="15" fill="url(#sl-bg)"/><circle cx="29" cy="29" r="16" fill="none" stroke="#fff" stroke-width="4"/><path d="M41 41l8.5 8.5" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/><rect x="21" y="30" width="4.6" height="7" rx="2.3" fill="#fff"/><rect x="26.8" y="25.5" width="4.6" height="11.5" rx="2.3" fill="#fff"/><rect x="32.6" y="21" width="4.6" height="16" rx="2.3" fill="#fff"/><circle cx="40.3" cy="17.7" r="3.8" fill="#f6c453"/></svg>`;

export const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="3.5" y="3.5" width="57" height="57" rx="15" fill="#0f766e"/><circle cx="29" cy="29" r="16" fill="none" stroke="#fff" stroke-width="4"/><path d="M41 41l8.5 8.5" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/></svg>')}`;

const FEATURES = [
  ['The Story', 'Open a site and read what happened: visits up or down, what moved them, the days that stood out and what you shipped around then. No reports to build.'],
  ['Timeline', 'Every day on one calendar with your releases, deploys, posts and mentions on it, so a spike explains itself.'],
  ['Campaigns', 'Tagged links, every source and medium, and Google Ads spend, measured against the goals that matter: installs, sign-ups, downloads.'],
  ['AI answers', 'Ask ChatGPT, Claude, Gemini and Perplexity the questions your customers ask, and see whether they name you, cite you, or send you visitors.'],
  ['To-dos that report back', 'Turn a finding into a change. Tick it off when it ships, and the Timeline shows whether it helped.'],
  ['Inside Claude', 'An MCP server for Claude Code and Claude: your agent reads the numbers, works through your to-dos and writes up what it changed.'],
];

const SOURCES = ['Google Analytics', 'Search Console', 'Bing', 'BigQuery', 'GitHub', 'Chrome Web Store', 'Reddit', 'Hacker News'];

export function homePage({ signedIn = false } = {}) {
  const enter = signedIn ? '/' : '/login';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SiteLens Studio</title>
<meta name="description" content="Did what you shipped work? SiteLens puts releases, posts and campaigns on the same timeline as traffic, search and AI answers.">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --surface: #fff; --text: #17171c; --text-2: #45454f; --muted: #6b6b76; --line: #e3e3e8; --accent: #3b5bdb; --accent-ink: #fff; --soft: #edf1ff; --good: #2b8a3e; --bad: #c92a2a; --font: system-ui, -apple-system, "Segoe UI", sans-serif; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111114; --surface: #1b1b20; --text: #ececf1; --text-2: #c4c4cc; --muted: #9a9aa6; --line: #2c2c34; --accent: #748ffc; --accent-ink: #0d0d12; --soft: #1e2440; --good: #69db7c; --bad: #ff8787; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--font); }
  a { color: inherit; }
  .wrap { max-width: 1080px; margin: 0 auto; padding-inline: 24px; }
  header { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  .bar { display: flex; align-items: center; gap: 24px; height: 64px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; }
  .brand span span { color: var(--muted); font-weight: 400; }
  nav.links { display: flex; gap: 20px; margin-left: auto; font-size: 15px; }
  nav.links a { color: var(--text-2); text-decoration: none; }
  nav.links a:hover { color: var(--text); }
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 9px; font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid transparent; white-space: nowrap; }
  .btn.primary { background: var(--accent); color: var(--accent-ink); }
  .btn.primary:hover { filter: brightness(1.08); }
  .btn.ghost { border-color: var(--line); background: var(--surface); }
  .btn:focus-visible, nav.links a:focus-visible, .brand:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 48px; align-items: center; padding-block: 72px 56px; }
  .eyebrow { display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: .04em; color: var(--accent); background: var(--soft); padding: 4px 10px; border-radius: 99px; margin-bottom: 18px; }
  h1 { font-size: clamp(34px, 5vw, 52px); line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 18px; }
  .lead { font-size: 18px; color: var(--text-2); margin: 0 0 28px; max-width: 34em; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; }
  .note { margin: 14px 0 0; font-size: 14px; color: var(--muted); }
  .story { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 22px; box-shadow: 0 18px 50px rgb(0 0 0 / .08); }
  .story-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; color: var(--muted); }
  .story h2 { font-size: 21px; line-height: 1.3; margin: 10px 0 14px; }
  .story svg.chart { width: 100%; height: auto; display: block; margin: 6px 0 14px; }
  .moved { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--text-2); }
  .moved li { display: flex; gap: 10px; align-items: baseline; }
  .moved b { color: var(--text); font-weight: 600; }
  .up { color: var(--good); font-weight: 600; } .down { color: var(--bad); font-weight: 600; }
  .tag { flex: none; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border-radius: 6px; background: var(--soft); color: var(--accent); }
  section { padding: 56px 0; }
  section h2.title { font-size: clamp(26px, 3.4vw, 34px); letter-spacing: -0.01em; margin: 0 0 10px; }
  section p.sub { color: var(--text-2); margin: 0 0 32px; max-width: 40em; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px; }
  .card h3 { margin: 0 0 8px; font-size: 17px; }
  .card p { margin: 0; color: var(--text-2); font-size: 15px; }
  .steps { counter-reset: s; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .steps .card::before { counter-increment: s; content: counter(s); display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--soft); color: var(--accent); font-weight: 700; font-size: 14px; margin-bottom: 12px; }
  .sources { display: flex; flex-wrap: wrap; gap: 10px; }
  .sources span { padding: 7px 14px; border-radius: 99px; border: 1px solid var(--line); background: var(--surface); font-size: 14px; color: var(--text-2); }
  .final { text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 48px 24px; }
  .final p { color: var(--text-2); margin: 0 auto 24px; max-width: 32em; }
  footer { padding: 32px 0 48px; color: var(--muted); font-size: 14px; }
  footer .wrap { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  @media (max-width: 860px) {
    .hero { grid-template-columns: 1fr; padding-block: 44px 32px; gap: 32px; }
    .grid, .steps { grid-template-columns: 1fr; }
    nav.links { display: none; }
    .bar { justify-content: space-between; }
  }
  @media (max-width: 480px) { .wrap { padding-inline: 16px; } .brand span span { display: none; } section { padding: 40px 0; } }
</style></head>
<body>
<header><div class="wrap bar">
  <a class="brand" href="/home">${LOGO}<span>SiteLens <span>Studio</span></span></a>
  <nav class="links" aria-label="Sections"><a href="#features">Features</a><a href="#how">How it works</a><a href="#sources">Works with</a></nav>
  <a class="btn primary" href="${enter}">Enter Studio</a>
</div></header>

<main>
  <div class="wrap hero">
    <div>
      <span class="eyebrow">Analytics for people who ship</span>
      <h1>Did what you shipped actually work?</h1>
      <p class="lead">SiteLens puts your releases, posts and campaigns on the same timeline as your traffic, search and AI answers. It tells you what moved, why, and what to do next.</p>
      <div class="ctas">
        <a class="btn primary" href="${enter}">Enter Studio</a>
        <a class="btn ghost" href="#features">See what’s inside</a>
      </div>
      <p class="note">${signedIn ? 'You’re signed in.' : 'Early access, invite only. Sign in with Google.'}</p>
    </div>

    <figure class="story" aria-label="Example: a site’s Story">
      <div class="story-top"><span>What happened · last 28 days</span><span>Sample</span></div>
      <h2>Visits were up <span class="up">32%</span> on the previous 28 days: 548, against 415.</h2>
      <svg class="chart" viewBox="0 0 320 90" role="img" aria-label="Visits per day, with a spike after a Reddit post">
        <polyline fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5" stroke-dasharray="4 4" points="0,62 40,60 80,63 120,58 160,61 200,59 240,57 280,55 320,52" />
        <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="0,66 20,60 40,64 60,56 80,58 100,50 120,54 140,18 160,46 180,52 200,44 220,48 240,40 260,46 280,36 300,42 320,34" />
        <line x1="140" y1="4" x2="140" y2="86" stroke="var(--bad)" stroke-dasharray="3 3" stroke-opacity=".7" />
        <circle cx="140" cy="6" r="4" fill="var(--bad)" />
      </svg>
      <ul class="moved">
        <li><span class="tag">Post</span><span><b>Reddit</b> sent 18 more visits <span class="up">↑ 225%</span>, the day after your launch post.</span></li>
        <li><span class="tag">Search</span><span><b>Google</b> sent 62 more visits <span class="up">↑ 41%</span>.</span></li>
        <li><span class="tag">AI</span><span><b>ChatGPT</b> now names you for “Raycast alternative for Windows”.</span></li>
      </ul>
    </figure>
  </div>

  <section id="features"><div class="wrap">
    <h2 class="title">Answers, not dashboards</h2>
    <p class="sub">Most analytics tools count visits. SiteLens connects them to what you did, so you can tell which work paid off.</p>
    <div class="grid">
      ${FEATURES.map(([t, d]) => `<div class="card"><h3>${t}</h3><p>${d}</p></div>`).join('\n      ')}
    </div>
  </div></section>

  <section id="how"><div class="wrap">
    <h2 class="title">Set up in a few minutes</h2>
    <p class="sub">No new tracking script. SiteLens reads the tools you already use.</p>
    <div class="steps">
      <div class="card"><h3>Sign in with Google</h3><p>Pick your Analytics property and Search Console site. Read-only access.</p></div>
      <div class="card"><h3>Add what you ship</h3><p>Link the GitHub repo, store listing and accounts you post from, so releases and posts land on the Timeline.</p></div>
      <div class="card"><h3>Read the Story</h3><p>See what moved and why, set goals and alerts, and turn findings into to-dos that report back.</p></div>
    </div>
  </div></section>

  <section id="sources"><div class="wrap">
    <h2 class="title">Works with</h2>
    <p class="sub">Your numbers stay in the tools you own. SiteLens brings them together.</p>
    <div class="sources">${SOURCES.map((s) => `<span>${s}</span>`).join('')}</div>
  </div></section>

  <section><div class="wrap">
    <div class="final">
      <h2 class="title">See your site’s Story</h2>
      <p>Connect a site and find out what last month’s releases, posts and articles actually did.</p>
      <a class="btn primary" href="${enter}">Enter Studio</a>
    </div>
  </div></section>
</main>

<footer><div class="wrap"><span>SiteLens Studio</span><a href="${enter}">Enter Studio</a></div></footer>
</body></html>`;
}
