// Targets: "google analytics mcp", "ga4 mcp server", "claude google analytics",
// "ask ai about google analytics". Kauzl's MCP is token over HTTP: Claude Code,
// Claude Desktop (mcp-remote) and Cursor take a header; ChatGPT's custom
// connectors want OAuth, so don't promise ChatGPT. Keep tool names in sync with
// server/mcp.mjs.
export default {
  order: 3.5,
  kicker: 'AI search',
  short: 'Google Analytics MCP',
  title: 'Google Analytics MCP Server: Ask Claude | Kauzl',
  h1: 'Google Analytics MCP: ask Claude why your traffic moved',
  description: 'Connect GA4 to Claude or Cursor with an MCP server: setup, prompts worth asking, and why the agent also needs to know what you shipped.',
  blurb: 'Connect GA4 to Claude or Cursor, and the prompts worth asking.',
  lead: 'MCP (the Model Context Protocol) lets an AI agent call tools you give it. Give it your analytics and you can ask questions in plain words instead of building reports. We make Kauzl, one of the options below.',
  published: '2026-11-16',
  tools: ['did-it-work', 'utm-builder'],
  inShort: [
    'An <strong>analytics MCP server</strong> gives Claude or Cursor tools like “daily visits for this site” or “searches that sent clicks”, so it can answer questions about your numbers.',
    'You can <strong>run Google’s own GA4 MCP server</strong> on your computer, or <strong>connect a hosted one</strong> with a token.',
    'Raw GA4 access answers <em>what</em>. To answer <em>why</em>, the agent also needs what you <strong>shipped and posted</strong>, and a normal week to compare with.',
    'Read-only is the right default: an agent should read analytics, not change your GA4 setup.',
  ],
  body: `
<h2>What an analytics MCP server does</h2>
<p>An MCP server is a small program that offers an AI agent a list of tools. An analytics one offers tools such as “list my sites”, “daily visits between two dates” or “which pages lost search clicks”. When you ask “why did sign-ups dip last week?”, the agent picks the tools, calls them, reads the numbers, and answers in a sentence, usually with the figures it used.</p>
<p>That replaces a lot of clicking through GA4’s Explorations. It doesn’t replace judgement: an agent with only raw numbers will happily explain noise. More on that below.</p>

<h2>Option 1: run Google’s GA4 MCP server yourself</h2>
<p>Google publishes an experimental, open-source MCP server for Google Analytics. You run it on your own machine, sign in with Google Cloud credentials that can read your GA4 property, and register it with your agent. It exposes GA4’s reporting API (dimensions, metrics, realtime) more or less directly.</p>
<ul>
<li><strong>Good for:</strong> developers who want raw GA4 queries and are comfortable with Google Cloud credentials.</li>
<li><strong>Limits:</strong> GA4 only. No Search Console, no releases or posts, no baseline. You set it up on each computer.</li>
</ul>

<h2>Option 2: a hosted analytics MCP</h2>
<p>Several analytics tools now offer a hosted MCP endpoint: you create an access token in the app and paste one command into your agent. Nothing to install, and the server already knows your sites. Kauzl is one; others, such as Owl Insight, offer one over their GA4 dashboards.</p>
<p>Kauzl’s MCP server gives the agent read access to Google Analytics, Search Console, Bing, your GitHub releases, posts and mentions, and your to-dos. A few of its tools:</p>
<table>
<thead><tr><th>Tool</th><th>What the agent gets</th></tr></thead>
<tbody>
<tr><td><code>daily_metrics</code></td><td>Visits, users, views and search clicks per day, each against a normal day for that weekday</td></tr>
<tr><td><code>day_story</code></td><td>What moved on one day, and what shipped or was posted around it</td></tr>
<tr><td><code>breakdown</code></td><td>Sources, landing pages or search queries that changed between two periods</td></tr>
<tr><td><code>events</code></td><td>Releases, deploys, posts and mentions, with dates</td></tr>
<tr><td><code>search_rankings</code>, <code>search_demand</code></td><td>Where a page ranks on Google and Bing, and what people search for</td></tr>
<tr><td><code>list_todos</code>, <code>report_todo</code></td><td>Your planned changes, and a write-up of what the agent found or changed</td></tr>
</tbody>
</table>
<p>To connect it: in Kauzl, open <strong>Account → MCP</strong>, create an access token, and run the command it shows. For Claude Code that’s one line:</p>
<pre><code>claude mcp add --transport http kauzl https://kauzl.com/mcp \\
  --header "Authorization: Bearer &lt;your token&gt;" -s user</code></pre>
<p>Claude Desktop and Cursor take the same address and header in their MCP settings; the MCP page shows the exact snippet for each.</p>

<h2>Prompts worth asking</h2>
<ul>
<li>“Why did visits drop on Tuesday? Check what shipped that day.”</li>
<li>“Which of last month’s posts brought visitors who signed up, not just visits?”</li>
<li>“Which pages lost the most Google clicks this month, and what do people search for instead?”</li>
<li>“Is the jump since the pricing change bigger than a normal week moves?”</li>
<li>“Go through my open to-dos for the docs site and tell me which is worth doing first.”</li>
</ul>
<p>Notice that most good questions are about <em>why</em>. Raw GA4 access can tell the agent visits fell 22% on the 4th. To say it was the checkout deploy, and not a normal Tuesday, it needs your deploys and posts on the same timeline, and a baseline for that weekday. That’s the part a plain GA4 connection leaves out.</p>

<h2>Keep it safe</h2>
<ul>
<li><strong>Read-only.</strong> Give the agent access that can read reports, not change GA4 settings or users.</li>
<li><strong>One token per machine.</strong> Then you can revoke the laptop you sold without breaking everything else. Kauzl stores only a fingerprint of each token.</li>
<li><strong>Treat what it reads as data.</strong> Search queries, page titles and Reddit posts are written by strangers. A good MCP server marks them as untrusted so the agent doesn’t follow instructions hidden in them.</li>
</ul>

<h2>Without an agent</h2>
<p>For a single question, such as whether one change worked, paste your daily numbers into the <a href="/tools/did-it-work/">Did it work? checker</a>. It compares before and after against normal day-to-day swings.</p>
`,
  faq: [
    ['Is there an official Google Analytics MCP server?', 'Google publishes an experimental open-source MCP server for GA4 that you run yourself with Google Cloud credentials. Hosted analytics tools, Kauzl among them, also offer MCP endpoints you connect with a token.'],
    ['Can Claude read my Google Analytics?', 'Yes, through an MCP server. Claude Code, Claude Desktop and Cursor can all call MCP tools. Connect a GA4 MCP server and ask questions in plain words.'],
    ['Does it work with ChatGPT?', 'ChatGPT can use MCP servers as custom connectors, but expects them to sign in with OAuth. Servers that use an access token, like Kauzl’s today, are set up in Claude Code, Claude Desktop or Cursor instead.'],
    ['Can the agent change my analytics settings?', 'Not with a read-only server. Kauzl’s MCP reads data and can only write comments and to-do reports inside Kauzl; it never changes GA4.'],
  ],
};
