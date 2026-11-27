// Targets: "claudebot" (Bing US ~25-40/4wk, steady), "claude-searchbot",
// "claude-user", "block claudebot". Facts from Anthropic's support article
// support.claude.com/en/articles/8896518 (updated Feb 2026, checked Nov 2026):
// three bots; "Anthropic's Bots" honour robots.txt (Claude-User not named
// separately) and Crawl-delay; per-subdomain rules; IP blocking isn't a
// reliable opt-out; IPs at claude.com/crawling/bots.json; aipref "no AI
// training" signal since 2026-10-30. Re-check before changing claims.
export default {
  order: 4.2,
  kicker: 'AI search',
  short: 'ClaudeBot and Claude’s crawlers',
  title: 'ClaudeBot, Claude-SearchBot and Claude-User | Kauzl',
  h1: 'ClaudeBot, Claude-SearchBot and Claude-User: Anthropic’s crawlers explained',
  description: 'What each of Anthropic’s three bots does, which affect Claude’s search answers, and robots.txt rules to block training but stay citable.',
  blurb: 'Anthropic’s three bots, what blocking each one costs you, and the robots.txt to use.',
  lead: 'Anthropic runs three bots: one for training, one for Claude’s search index, and one that fetches pages when a user asks. They follow robots.txt separately, so you can keep your content out of training and still be cited in Claude’s answers.',
  published: '2026-11-22',
  tools: ['ai-robots-txt-generator', 'ai-crawler-log-analyzer'],
  inShort: [
    '<strong>ClaudeBot</strong> collects public pages that may be used to train Claude. Blocking it keeps your future content out of training.',
    '<strong>Claude-SearchBot</strong> crawls pages to improve Claude’s search results. Blocking it can make you less visible in Claude’s answers.',
    '<strong>Claude-User</strong> fetches a page when a Claude user’s question needs it. Blocking it can stop Claude from reading your page for that user.',
    'Anthropic says its bots honour robots.txt, including <code>Crawl-delay</code>, that you need rules on every subdomain, and publishes their IP addresses so you can spot fakes.',
  ],
  body: `
<h2>The three bots at a glance</h2>
<table>
<thead><tr><th>User-agent token</th><th>What it does</th><th>What blocking it costs</th></tr></thead>
<tbody>
<tr><td><code>ClaudeBot</code></td><td>Collects public web content that may be used to train Claude</td><td>Nothing in today’s answers. Future content stays out of training data</td></tr>
<tr><td><code>Claude-SearchBot</code></td><td>Crawls content to improve the quality of Claude’s search results</td><td>Less visibility and accuracy in Claude’s search answers</td></tr>
<tr><td><code>Claude-User</code></td><td>Fetches pages when a Claude user asks something that needs them</td><td>Claude can’t read your page when a user asks about it</td></tr>
</tbody>
</table>
<p>The details are in Anthropic’s support article on <a href="https://support.claude.com/en/articles/8896518" rel="nofollow">how its crawlers work and how to block them</a>, last updated in February 2026.</p>

<h2>robots.txt rules</h2>
<p><strong>Keep out of training, stay visible in Claude</strong> (the common choice):</p>
<pre><code>User-agent: ClaudeBot
Disallow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /</code></pre>
<p><strong>Slow Claude’s crawlers down</strong> instead of blocking them. Anthropic supports the non-standard <code>Crawl-delay</code> rule, in seconds:</p>
<pre><code>User-agent: ClaudeBot
Crawl-delay: 10</code></pre>
<p><strong>Block Anthropic entirely:</strong></p>
<pre><code>User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: Claude-User
Disallow: /</code></pre>
<p>Expect to stop being cited in Claude’s answers if you do this.</p>

<h2>Three things that catch people out</h2>
<ol class="steps-list">
<li><strong>Every subdomain needs its own robots.txt.</strong> Rules on <code>example.com</code> don’t cover <code>docs.example.com</code> or <code>blog.example.com</code>.</li>
<li><strong>Blocking by IP isn’t a reliable opt-out.</strong> Anthropic says blocking its IP addresses may not work correctly or guarantee an opt-out over time. Use robots.txt to opt out, and use IPs only to verify.</li>
<li><strong>Old “anthropic-ai” and “Claude-Web” rules.</strong> Those tokens still appear in many copy-paste lists, but Anthropic’s current documentation doesn’t mention them. Use the three current names above.</li>
</ol>

<h2>The “no AI training” signal</h2>
<p>Since October 30, 2026, Anthropic also recognises a machine-readable “no AI training” preference, based on an IETF draft (aipref). If your robots.txt has rules that name ClaudeBot, those take priority over the general signal. The simplest way to be sure is still a <code>ClaudeBot</code> rule.</p>

<h2>Is it really Anthropic?</h2>
<p>A user agent is easy to fake, and scrapers often borrow “ClaudeBot”. Anthropic publishes the IP addresses its crawlers use at <code>https://claude.com/crawling/bots.json</code>. A request from an address on that list is Anthropic. A “ClaudeBot” request from anywhere else is an impostor, and you can block it at your CDN. To report a real Anthropic crawler misbehaving, use the contact address in Anthropic’s support article, writing from an email at the domain concerned.</p>

<h2>See what Claude’s bots read</h2>
<p>Crawlers don’t run JavaScript, so Google Analytics never sees them. Your server or CDN logs do. Paste a day of logs into the <a href="/tools/ai-crawler-log-analyzer/">AI crawler log analyzer</a>, which runs in your browser, to see requests per bot and the pages each reads most. Claude-User requests mean someone asked Claude about that page. People who click a link in Claude’s answer arrive in GA4 as <code>claude.ai</code> referrals (<a href="/guides/track-chatgpt-traffic-google-analytics/">how to track AI referrals</a>).</p>
<p>For OpenAI’s equivalents, see <a href="/guides/openai-crawlers/">OAI-SearchBot, GPTBot and ChatGPT-User</a>. To set rules for every AI company at once, use the <a href="/tools/ai-robots-txt-generator/">AI robots.txt generator</a>.</p>
`,
  faq: [
    ['What is ClaudeBot?', 'ClaudeBot is Anthropic’s crawler that collects public web content that may be used to train Claude models. Blocking it in robots.txt keeps your future content out of training data without affecting Claude’s search answers.'],
    ['Does blocking ClaudeBot remove me from Claude?', 'Blocking ClaudeBot doesn’t remove you from Claude’s answers. Claude’s search uses Claude-SearchBot and Claude-User. Blocking those reduces your visibility in Claude.'],
    ['Does Claude-User follow robots.txt?', 'Claude-User is covered by Anthropic’s statement that its bots honour standard robots.txt directives, and Anthropic’s support article describes blocking it there. Blocking it stops Claude fetching your pages for users.'],
    ['How do I verify a ClaudeBot request?', 'A real ClaudeBot request comes from an IP address listed in claude.com/crawling/bots.json, which Anthropic publishes. A request claiming to be ClaudeBot from any other address is an impostor.'],
    ['Do I still need the anthropic-ai user agent in robots.txt?', 'The anthropic-ai and Claude-Web tokens are older names that Anthropic’s current documentation doesn’t mention. Use ClaudeBot, Claude-SearchBot and Claude-User instead.'],
  ],
};
