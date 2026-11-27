// Targets: "oai-searchbot" (Bing US 23/4wk, up from 12), "oai-searchbot
// robots.txt" and "gptbot robots.txt" (Search Console impressions for kauzl.com),
// "chatgpt-user", "gptbot". Facts from developers.openai.com/api/docs/bots
// (checked Nov 2026): ChatGPT-User is user-initiated and robots.txt "may not
// apply"; IP lists at openai.com/searchbot.json, gptbot.json, chatgpt-user.json.
// Don't print full user-agent strings: versions change. Re-check on update.
export default {
  order: 4.1,
  kicker: 'AI search',
  short: 'OpenAI’s crawlers explained',
  title: 'OAI-SearchBot vs GPTBot vs ChatGPT-User | Kauzl',
  h1: 'OAI-SearchBot, GPTBot and ChatGPT-User: OpenAI’s crawlers explained',
  description: 'What each OpenAI bot does, which ones affect ChatGPT search, robots.txt rules for each, and how to verify a request really came from OpenAI.',
  blurb: 'Which OpenAI bot does what, how each treats robots.txt, and how to spot fakes in your logs.',
  lead: 'OpenAI runs separate bots for ChatGPT search, for training, and for fetching a page a user asked about. Blocking the wrong one removes you from ChatGPT’s answers. Here’s what each does and how to handle it.',
  published: '2026-11-22',
  tools: ['ai-robots-txt-generator', 'ai-crawler-log-analyzer'],
  inShort: [
    '<strong>OAI-SearchBot</strong> builds the index ChatGPT search cites and links to. Block it and you stop appearing as a ChatGPT search source.',
    '<strong>GPTBot</strong> collects pages that may be used to train OpenAI’s models. Blocking it doesn’t affect ChatGPT search.',
    '<strong>ChatGPT-User</strong> fetches a page when a person in ChatGPT asks about it. OpenAI says robots.txt rules may not apply to it, because a user started the request.',
    'Each bot has its own robots.txt token and a published list of IP addresses, so you can allow search, block training, and verify that a request is real.',
  ],
  body: `
<h2>The three bots at a glance</h2>
<table>
<thead><tr><th>User-agent token</th><th>What it does</th><th>Follows robots.txt</th><th>Block it if…</th></tr></thead>
<tbody>
<tr><td><code>OAI-SearchBot</code></td><td>Crawls pages for ChatGPT search results and citations</td><td>Yes</td><td>You don’t want to appear in ChatGPT search at all</td></tr>
<tr><td><code>GPTBot</code></td><td>Collects content that may be used to train models</td><td>Yes</td><td>You don’t want your content used for training</td></tr>
<tr><td><code>ChatGPT-User</code></td><td>Fetches a page on a user’s behalf, for example a link pasted into a chat or a custom GPT action</td><td>Not reliably: OpenAI says robots.txt rules may not apply</td><td>Use your firewall or CDN, not robots.txt</td></tr>
</tbody>
</table>
<p>OpenAI also lists <code>OAI-AdsBot</code>, which checks the landing pages of ChatGPT ads. It doesn’t affect whether ChatGPT cites you. The full and current list, with exact user-agent strings, is on OpenAI’s <a href="https://developers.openai.com/api/docs/bots" rel="nofollow">crawler overview page</a>.</p>

<h2>robots.txt rules</h2>
<p><strong>Stay in ChatGPT search, keep out of training</strong> (the common choice):</p>
<pre><code>User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /</code></pre>
<p><strong>Allow everything</strong>: don’t mention OpenAI’s bots at all. They follow your <code>User-agent: *</code> rules.</p>
<p><strong>Leave ChatGPT search too:</strong></p>
<pre><code>User-agent: GPTBot
User-agent: OAI-SearchBot
Disallow: /</code></pre>
<p>OpenAI says sites that opt out of OAI-SearchBot won’t be shown in ChatGPT search answers, though they can still appear as navigational links. OpenAI says robots.txt changes take effect within about 24 hours for search.</p>
<p>Want to cover Anthropic, Perplexity, Google and others in one file? The <a href="/tools/ai-robots-txt-generator/">AI robots.txt generator</a> builds it from a checklist, and the guide to <a href="/guides/ai-crawlers-robots-txt/">which AI crawlers to block</a> explains every token.</p>

<h2>Why ChatGPT-User ignores robots.txt</h2>
<p>ChatGPT-User doesn’t crawl. It runs only when a person asks ChatGPT to read a specific page, much like a browser does. OpenAI treats that as the user’s request and says robots.txt rules may not apply. If you need to stop it, for example on a members-only area, block its user agent or OpenAI’s published IP ranges at your CDN or firewall. Better still, put that content behind a login.</p>

<h2>Is it really OpenAI? Verify by IP</h2>
<p>Anyone can send a request that says “GPTBot” in its user agent. Scrapers do it all the time. OpenAI publishes the IP ranges for each bot as JSON files:</p>
<ul>
<li><code>https://openai.com/searchbot.json</code> for OAI-SearchBot</li>
<li><code>https://openai.com/gptbot.json</code> for GPTBot</li>
<li><code>https://openai.com/chatgpt-user.json</code> for ChatGPT-User</li>
<li><code>https://openai.com/adsbot.json</code> for OAI-AdsBot</li>
</ul>
<p>Check the request’s IP address against the matching list. If a “GPTBot” request comes from an IP that isn’t in <code>gptbot.json</code>, it isn’t OpenAI, and you can block it freely. Many CDNs, Cloudflare included, have a “verified bots” setting that does this check for you.</p>

<h2>See what OpenAI’s bots actually read</h2>
<p>None of these bots run JavaScript, so they never appear in Google Analytics. Your server or CDN logs show them. Paste a day of access logs into the <a href="/tools/ai-crawler-log-analyzer/">AI crawler log analyzer</a>. It runs in your browser, counts requests per bot and lists the pages each one reads most. Lots of OAI-SearchBot visits to a page usually come before ChatGPT starts citing it. ChatGPT-User visits mean real people asked ChatGPT about that page.</p>
<p>When people click through from ChatGPT, they show up in GA4 as <code>chatgpt.com</code> referrals. See <a href="/guides/track-chatgpt-traffic-google-analytics/">how to track ChatGPT traffic in GA4</a>.</p>
`,
  faq: [
    ['What is OAI-SearchBot?', 'OAI-SearchBot is OpenAI’s crawler for ChatGPT search. It indexes pages so ChatGPT can show and link to them as sources. Blocking it in robots.txt removes your pages from ChatGPT search results.'],
    ['Should I block GPTBot?', 'GPTBot only collects content that may be used for training, so blocking it doesn’t affect ChatGPT search. Block it if you don’t want your content used for training, and keep OAI-SearchBot allowed.'],
    ['Does ChatGPT-User respect robots.txt?', 'ChatGPT-User acts on a user’s request, and OpenAI says robots.txt rules may not apply to it. To stop it, block its user agent or OpenAI’s published IP ranges at your CDN or firewall.'],
    ['How do I know a GPTBot request is real?', 'A real GPTBot request comes from an IP address listed in openai.com/gptbot.json. OpenAI publishes similar lists for OAI-SearchBot and ChatGPT-User. A request whose IP isn’t on the list is an impostor.'],
  ],
};
