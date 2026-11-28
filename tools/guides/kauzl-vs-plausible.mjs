// Targets: "plausible alternative", "kauzl vs plausible", "plausible analytics
// review". Honest on purpose: Plausible is a tracker, Kauzl explains a tracker,
// and today Kauzl reads GA4, not Plausible. Re-check Plausible's features
// before editing; don't quote their prices here, they change.
export default {
  order: 6,
  kicker: 'Compare',
  short: 'Kauzl vs Plausible',
  title: 'Kauzl vs Plausible: An Honest Comparison | Kauzl',
  h1: 'Kauzl vs Plausible: one counts visits, one explains them',
  description: 'Plausible is a privacy-first Google Analytics replacement. Kauzl reads the analytics you have and says why numbers moved. When to use which.',
  blurb: 'One counts visits, one explains them. When to use which.',
  lead: 'We make Kauzl, so read this with that in mind. We’ve tried to be fair: Plausible is a good product, and for a lot of sites it’s the better choice.',
  published: '2026-11-16',
  updated: '2026-11-28',
  tools: ['did-it-work', 'utm-builder', 'serp-preview'],
  inShort: [
    '<strong>Plausible counts visits.</strong> It replaces Google Analytics with a small, cookieless script and one clean dashboard.',
    '<strong>Kauzl explains visits.</strong> It adds no script. It reads Plausible, Google Analytics or Search Console and lines them up with your releases, posts and campaigns.',
    'Want privacy-first counting with no cookie banner? <strong>Use Plausible.</strong>',
    'Already on GA4 and can’t tell <em>why</em> a number moved? <strong>Use Kauzl.</strong> It reads Plausible too, so you can use both.',
  ],
  body: `
<h2>They do different jobs</h2>
<p><strong>Plausible</strong> is a tracker. You add its script to your site, and it records visits, sources, pages, goals and custom events, without cookies. It’s open source, hosted in the EU, and you can run it yourself.</p>
<p><strong>Kauzl</strong> isn’t a tracker. It reads the analytics you already collect (Plausible, Google Analytics 4, PostHog, Cloudflare Web Analytics and Search Console), adds what you did (GitHub releases, Chrome Web Store versions, Reddit and Hacker News posts, tagged campaigns), and writes down what changed and why. For example: “Visits up 32%. Reddit sent 18 more, the day after your launch post.”</p>
<p>So the real question isn’t which is better. It’s which problem you have.</p>

<h2>Side by side</h2>
<table>
<thead><tr><th></th><th>Plausible</th><th>Kauzl</th></tr></thead>
<tbody>
<tr><td>What it is</td><td>Privacy-first analytics</td><td>An analyst on top of your analytics</td></tr>
<tr><td>Tracking script</td><td>Yes, its own, small and cookieless</td><td>None. Reads Plausible or GA4</td></tr>
<tr><td>Cookie banner needed</td><td>No</td><td>None of its own; your tracker decides</td></tr>
<tr><td>Visits, sources, pages</td><td>Yes, in one clean dashboard</td><td>Yes, from Plausible or GA4</td></tr>
<tr><td>Search Console data</td><td>Yes, search terms in the dashboard</td><td>Yes, plus Bing, and to-dos from it</td></tr>
<tr><td>“Why did this move?” in sentences</td><td>No</td><td>Yes, on each day of the calendar</td></tr>
<tr><td>Releases and posts on the same timeline</td><td>Not built in</td><td>Yes, from GitHub, stores, Reddit, Hacker News</td></tr>
<tr><td>Each day against a normal day for that weekday</td><td>No</td><td>Yes</td></tr>
<tr><td>Alerts</td><td>Traffic spike emails</td><td>Jumps and drops in traffic, search, goals and store users</td></tr>
<tr><td>Does ChatGPT or Claude name you?</td><td>No</td><td>Yes, weekly answer checks</td></tr>
<tr><td>Open source, self-host</td><td>Yes</td><td>No</td></tr>
<tr><td>Ask about it from Claude (MCP)</td><td>Through its API</td><td>Yes, built in</td></tr>
</tbody>
</table>

<h2>Choose Plausible if</h2>
<ul>
<li>You want to <strong>leave Google Analytics</strong>, or never start with it.</li>
<li>You don’t want a <strong>cookie banner</strong>, or privacy is part of what you sell.</li>
<li>You want <strong>one simple page</strong> you can glance at, and you’re happy reading the trend yourself.</li>
<li>You want <strong>open source</strong> or to host it yourself.</li>
</ul>

<h2>Choose Kauzl if</h2>
<ul>
<li>You <strong>already have GA4</strong> and its history, and don’t want to switch.</li>
<li>You ship often (releases, posts, articles) and want to know <strong>which ones worked</strong>.</li>
<li>You run <strong>several small sites</strong> and want one place that says what changed on each.</li>
<li>You care whether <strong>AI assistants recommend you</strong>, not just whether Google ranks you.</li>
</ul>

<h2>Can you use both?</h2>
<p>Yes, and many people with GA4 should keep it alongside a privacy-first tool anyway. Kauzl reads Plausible directly, so it works even if Plausible is your only tracker: add a Plausible API key and your visits sit on the same calendar as your releases and posts. Plausible counts the visits; Kauzl tells you why they moved.</p>

<h2>Without either tool</h2>
<p>If you only want to check whether one change worked, you don’t need a new tool. Paste your daily numbers from before and after into the <a href="/tools/did-it-work/">Did it work? checker</a>. Tag your links with the <a href="/tools/utm-builder/">UTM builder</a> so you can tell later which post sent the visits.</p>
`,
  faq: [
    ['Is Kauzl a Plausible alternative?', 'Not really. Plausible replaces Google Analytics as the thing that counts visits. Kauzl doesn’t count visits; it reads Plausible, Google Analytics or Search Console and explains what changed.'],
    ['Does Kauzl work with Plausible?', 'Yes. Add a Plausible API key, hosted or self-hosted, and Kauzl reads visitors, pageviews, bounce rate and goals for each site. Umami is planned.'],
    ['Does Kauzl add a tracking script to my site?', 'No. It connects to the analytics you already have (Plausible, Google Analytics, PostHog, Cloudflare or Search Console) with read-only access.'],
    ['Which is better for privacy?', 'Plausible. It’s cookieless and collects no personal data. Kauzl collects nothing itself; it only reads what your analytics tool already has.'],
  ],
};
