// Targets: "how to connect ga4 to chatgpt", "ga4 to chatgpt", "chatgpt google
// analytics", "google analytics 4 to chatgpt" — Search Console already shows
// kauzl.com for these (Nov 2026, position ~80) with no page written for them.
// Facts as of Nov 2026: ChatGPT custom connectors need a remote HTTPS MCP
// server with OAuth; Google's analytics-mcp runs locally (stdio). Kauzl's MCP
// uses a token, so it's NOT a ChatGPT option: don't promise it until OAuth ships.
// Plan requirements for custom connectors vary and change: don't state them.
export default {
  order: 3.3,
  kicker: 'AI search',
  short: 'Connect GA4 to ChatGPT',
  title: 'How to Connect Google Analytics 4 to ChatGPT | Kauzl',
  h1: 'How to connect Google Analytics 4 to ChatGPT',
  description: 'Four ways to get GA4 data into ChatGPT: a CSV export, a hosted MCP connector, Google’s own MCP server, or BigQuery. What each can and can’t do.',
  blurb: 'Four ways to get GA4 into ChatGPT, from a CSV to a live connector, and the catch with each.',
  lead: 'ChatGPT has no built-in Google Analytics connection. You can still get your GA4 numbers into it in four ways, from a two-minute CSV export to a live connector. We make Kauzl, which connects GA4 to Claude instead, and say below why that’s different.',
  published: '2026-11-22',
  tools: ['did-it-work', 'utm-builder'],
  inShort: [
    'The quickest way: <strong>export a GA4 report as CSV</strong> and upload it to ChatGPT. It works on any plan, but it’s a snapshot.',
    'For live data, add a <strong>hosted GA4 MCP server as a custom connector</strong> in ChatGPT’s settings and sign in with Google. ChatGPT only accepts remote servers that sign in with OAuth.',
    '<strong>Google’s own GA4 MCP server runs on your computer</strong>, so ChatGPT can’t reach it unless you host it yourself over HTTPS.',
    'Whatever the route, give ChatGPT <strong>read-only</strong> access, and remember it sees numbers, not what you shipped. That’s why it’s good at “what” and weak at “why”.',
  ],
  body: `
<h2>Option 1: export a report and upload it (any plan, 2 minutes)</h2>
<p>This is the simplest route and enough for one-off questions.</p>
<ol class="steps-list">
<li>In GA4, open the report you care about, for example <strong>Reports → Acquisition → Traffic acquisition</strong>, and set the date range. Compare it with the period before if you want ChatGPT to explain a change.</li>
<li>Click the <strong>share icon</strong> at the top right, then <strong>Download file → Download CSV</strong>.</li>
<li>In ChatGPT, attach the CSV and ask your question: “Which channels grew and which shrank? Show the biggest changes first.”</li>
</ol>
<p>Daily data works better than totals. Add <em>Date</em> as a secondary dimension or use an Exploration, so ChatGPT can see when something changed, not just that it did. Watch the row limit: GA4 exports only the rows you can see, so increase the rows per page first.</p>
<p><strong>Catch:</strong> a snapshot goes stale, and you’ll be exporting again next week. A Google Sheet fed by the GA4 add-on, uploaded the same way, is a halfway house.</p>

<h2>Option 2: a hosted GA4 MCP connector (live data)</h2>
<p>MCP (the Model Context Protocol) lets ChatGPT call tools such as “sessions by channel for these dates”. ChatGPT supports <strong>custom connectors</strong>: you give it the web address of an MCP server, sign in, and it can query your data while it answers.</p>
<p>ChatGPT only talks to <strong>remote</strong> servers over HTTPS, and expects them to sign in with OAuth. Several analytics and reporting companies now host GA4 MCP servers that meet both. The setup is usually:</p>
<ol class="steps-list">
<li>In ChatGPT, open <strong>Settings → Connectors</strong> (on some plans you first turn on developer mode under <em>Advanced</em>).</li>
<li>Choose <strong>Add custom connector</strong>, give it a name, and paste the provider’s MCP server address.</li>
<li>Sign in with the Google account that can read your GA4 property, and allow read-only access.</li>
<li>In a new chat, enable the connector and ask: “Sessions by channel for the last 28 days against the 28 before.”</li>
</ol>
<p>Which ChatGPT plans can add custom connectors, and what they can do there, has changed several times. Check the current help page for your plan before paying for a connector.</p>
<p><strong>Catch:</strong> you’re giving a third party read access to your analytics. Check what it stores, pick one that’s read-only, and remove access in your Google account when you stop using it.</p>

<h2>Option 3: Google’s own GA4 MCP server</h2>
<p>Google publishes an open-source, read-only MCP server for Google Analytics (<code>analytics-mcp</code>). It runs on your computer with Google Cloud credentials, and it’s designed for agents that run locally, such as Claude Code, Claude Desktop and Cursor.</p>
<p>ChatGPT can’t start programs on your machine, so it can’t use this server as it is. To use it with ChatGPT you’d have to host it on a server, put it behind HTTPS and add a sign-in, which is a small engineering project. For most people, option 2 or a local agent is easier.</p>

<h2>Option 4: BigQuery export (for big or raw data)</h2>
<p>GA4 can export every event to BigQuery, free to set up and cheap at small volumes. You can then query it with SQL, or with any assistant that has a BigQuery connector, and get raw events GA4’s reports never show. It takes a day to start filling and doesn’t include past data. See the <a href="/guides/ga4-bigquery-export/">GA4 BigQuery export guide</a> for setup.</p>

<h2>Which one to pick</h2>
<table>
<thead><tr><th>You want</th><th>Use</th></tr></thead>
<tbody>
<tr><td>One answer about last month</td><td>CSV upload</td></tr>
<tr><td>To ask ChatGPT about live GA4 data regularly</td><td>A hosted MCP connector</td></tr>
<tr><td>Full control, and you’re a developer</td><td>Google’s server, self-hosted, or a local agent</td></tr>
<tr><td>Raw events, joins with other data</td><td>BigQuery export</td></tr>
</tbody>
</table>

<h2>What ChatGPT still can’t tell you</h2>
<p>With GA4 alone, ChatGPT can tell you visits fell 22% on Tuesday. It can’t tell you that you shipped a new checkout on Monday, or whether 22% is unusual for a Tuesday. It will guess, confidently. Before you trust an explanation, check two things yourself: what changed on your site that week, and whether the drop is bigger than a normal week moves. The free <a href="/tools/did-it-work/">Did it work? checker</a> does the second from pasted daily numbers.</p>

<h2>If you use Claude instead</h2>
<p>Claude Code, Claude Desktop and Cursor can use MCP servers that take an access token, which is simpler to set up than OAuth. Kauzl’s MCP server works this way. It gives Claude GA4, Search Console, Bing, your releases and posts, and a normal-week baseline for each day, so it can answer “why” as well as “what”. It doesn’t work in ChatGPT yet, because ChatGPT needs OAuth. The <a href="/guides/google-analytics-mcp-server/">Google Analytics MCP guide</a> has the setup.</p>
`,
  faq: [
    ['Can ChatGPT connect to Google Analytics directly?', 'ChatGPT has no built-in Google Analytics connection as of November 2026. You can upload a GA4 CSV export, or add a hosted GA4 MCP server as a custom connector and sign in with Google.'],
    ['Does Google’s GA4 MCP server work with ChatGPT?', 'Google’s analytics-mcp server runs locally on your computer, and ChatGPT only connects to remote servers over HTTPS. To use it with ChatGPT you would need to host it yourself with HTTPS and a sign-in.'],
    ['Is it safe to connect GA4 to ChatGPT?', 'Connecting GA4 is reasonably safe with read-only access and a provider you trust. Read-only access lets ChatGPT read reports but not change settings or users. Remove the access in your Google account when you stop using it.'],
    ['Why does ChatGPT get my traffic analysis wrong?', 'ChatGPT sees only the numbers you give it. Without what you shipped or posted, and a normal week to compare with, it guesses at causes and treats ordinary day-to-day swings as real changes.'],
  ],
  cta: { title: 'Want the “why”, not just the numbers?', text: 'Kauzl puts GA4, Search Console and what you shipped on one timeline, and gives Claude the same view through MCP.' },
};
