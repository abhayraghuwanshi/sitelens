// Targets: "oai-searchbot", "openai bot", "claudebot", "gptbot robots.txt",
// "what is robots.txt", "robots.txt file" (Bing US, Nov 2026).
export default {
  order: 4,
  kicker: 'AI search',
  short: 'Which AI crawlers to block',
  title: 'GPTBot vs OAI-SearchBot vs ClaudeBot: Which AI Crawlers to Block in robots.txt | Kauzl',
  h1: 'GPTBot, OAI-SearchBot, ClaudeBot: which AI crawlers should you block?',
  description: 'Every major AI crawler explained: which ones train models and which ones power AI search. Copy-paste robots.txt rules to block training while staying visible in ChatGPT, Claude and Perplexity.',
  blurb: 'Training crawlers vs AI search crawlers, and robots.txt rules that keep you citable.',
  lead: 'Blocking “AI” in robots.txt isn’t one switch. Each company runs separate crawlers for training and for search, and blocking the wrong one quietly removes you from AI answers.',
  published: '2026-11-14',
  tools: ['ai-robots-txt-generator', 'ai-crawler-log-analyzer', 'llms-txt-generator'],
  inShort: [
    '<strong>Training crawlers</strong> (GPTBot, ClaudeBot, CCBot, Google-Extended…) collect pages to train future models. Blocking them costs you no traffic today.',
    '<strong>AI search crawlers</strong> (OAI-SearchBot, Claude-SearchBot, PerplexityBot) decide whether assistants can cite and link to you. Block them and you disappear from those answers.',
    'A sensible default for most businesses: block training if you want to, keep search crawlers open, and check your logs to see who actually visits.',
  ],
  body: `
<h2>What robots.txt is (and isn’t)</h2>
<p><code>robots.txt</code> is a plain-text file at the root of your site, such as <code>https://example.com/robots.txt</code>, that tells crawlers which paths they may fetch. Each rule names a crawler by its <em>user-agent token</em>. It’s a request, not a lock: the major AI companies say they follow it, but nothing forces a crawler to. For hard blocking, use your CDN or firewall.</p>

<h2>The AI crawlers, by job</h2>
<table>
<thead><tr><th>Token</th><th>Company</th><th>Job</th></tr></thead>
<tbody>
<tr><td><code>GPTBot</code></td><td>OpenAI</td><td>Training data for OpenAI models</td></tr>
<tr><td><code>OAI-SearchBot</code></td><td>OpenAI</td><td>Index for ChatGPT search results and citations</td></tr>
<tr><td><code>ChatGPT-User</code></td><td>OpenAI</td><td>Fetches a page when a user asks ChatGPT about it</td></tr>
<tr><td><code>ClaudeBot</code></td><td>Anthropic</td><td>Training data for Claude models</td></tr>
<tr><td><code>Claude-SearchBot</code></td><td>Anthropic</td><td>Index for Claude’s search answers</td></tr>
<tr><td><code>Claude-User</code></td><td>Anthropic</td><td>Fetches a page when a user asks Claude about it</td></tr>
<tr><td><code>PerplexityBot</code></td><td>Perplexity</td><td>Index for Perplexity answers</td></tr>
<tr><td><code>Perplexity-User</code></td><td>Perplexity</td><td>Fetches a page for a user’s question</td></tr>
<tr><td><code>Google-Extended</code></td><td>Google</td><td>Switch for Gemini training (not a crawler; doesn’t affect Google Search)</td></tr>
<tr><td><code>Applebot-Extended</code></td><td>Apple</td><td>Switch for Apple AI training (doesn’t affect Siri or Spotlight)</td></tr>
<tr><td><code>CCBot</code></td><td>Common Crawl</td><td>Open web archive many models train on</td></tr>
<tr><td><code>meta-externalagent</code></td><td>Meta</td><td>Training data for Meta AI</td></tr>
<tr><td><code>Bytespider</code></td><td>ByteDance</td><td>Training data for ByteDance models</td></tr>
</tbody>
</table>

<h2>Option 1: block training, keep AI search (recommended for most)</h2>
<pre><code># AI training crawlers kept out
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
User-agent: meta-externalagent
User-agent: Bytespider
Disallow: /

# Everyone else, including AI search crawlers
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml</code></pre>
<p>Several <code>User-agent</code> lines in a row share the rules that follow, so one <code>Disallow: /</code> covers the whole group. OAI-SearchBot, Claude-SearchBot and PerplexityBot fall through to <code>User-agent: *</code> and can still read the site.</p>

<h2>Option 2: allow everything</h2>
<p>If being in as many AI answers as possible matters more than how your content is used, don’t list AI crawlers at all. <code>User-agent: *</code> with <code>Allow: /</code> lets everyone in.</p>

<h2>Option 3: block all AI</h2>
<p>List every token from the table under one <code>Disallow: /</code> group. Expect to stop appearing as a cited source in ChatGPT search, Claude and Perplexity. User-triggered fetchers such as ChatGPT-User act on a person’s request, and the companies note that they may not apply robots.txt to them in the same way.</p>

<h2>Does Google-Extended affect Google Search or AI Overviews?</h2>
<p>No. Googlebot crawls for Search, and AI Overviews draw on the Search index. <code>Google-Extended</code> only controls use of your content for Gemini models and grounding. Blocking it doesn’t change your Google rankings.</p>

<h2>Check who actually visits</h2>
<p>robots.txt says what you’d like; your server logs say what happens. GA4 can’t show crawlers because they don’t run JavaScript. Export a day or a week of access logs and drop them into the <a href="/tools/ai-crawler-log-analyzer/">AI crawler log analyzer</a>, which runs entirely in your browser. It shows each bot’s requests, the pages it reads most and any errors it hits. If a crawler you blocked keeps arriving, block it at your CDN.</p>

<h2>Changes take about a day</h2>
<p>Crawlers re-read robots.txt regularly; OpenAI says changes take effect within about 24 hours. Blocking a training crawler stops future collection but doesn’t remove anything already collected.</p>

<h2>Make your own</h2>
<p>The free <a href="/tools/ai-robots-txt-generator/">AI robots.txt generator</a> builds these rules from a checklist, with presets for each option above. If you also want to give assistants a tidy map of your site, add an <a href="/tools/llms-txt-generator/">llms.txt file</a>.</p>
`,
  faq: [
    ['Will blocking GPTBot remove my site from ChatGPT?', 'Not from ChatGPT search. Search results come from OAI-SearchBot and live fetches from ChatGPT-User; GPTBot only collects training data.'],
    ['Is ClaudeBot the same as Claude-SearchBot?', 'No. ClaudeBot collects training data. Claude-SearchBot indexes pages for search answers, and Claude-User fetches pages for a user’s request.'],
    ['Where do I put robots.txt?', 'At the root of your domain, for example <code>https://example.com/robots.txt</code>. Each subdomain needs its own.'],
    ['Do AI crawlers show up in Google Analytics?', 'No. They don’t run JavaScript, so GA4 never sees them. Use your server logs.'],
  ],
};
