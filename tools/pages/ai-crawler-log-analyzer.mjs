export default {
  name: 'AI Crawler Log Analyzer',
  title: 'AI Crawler Log Analyzer: See GPTBot, ClaudeBot & Perplexity Visits | Kauzl',
  description: 'Drop in your server or CDN access logs and see which AI crawlers visit your site, how often, which pages they read and where they hit errors. Works with Nginx, Apache, Vercel, Netlify and Cloudflare logs. Logs never leave your browser.',
  blurb: 'Drop in access logs and see which AI bots read your site, and which pages.',
  related: ['ai-robots-txt-generator', 'llms-txt-generator', 'serp-preview'],
  h1: 'AI crawler log analyzer',
  intro: 'GA4 can’t see AI crawlers: they don’t run JavaScript. Your server logs can. Drop a log file here to see which AI bots read your site and what they read. Everything is processed in your browser.',
  script: 'log-analyzer.js',
  tool: `
<div class="tool single">
  <div class="panel">
    <h2>Your logs</h2>
    <label class="field"><span>Access log file</span><input type="file" id="file" accept=".log,.txt,.json,.jsonl,.ndjson,.csv,text/*"><small>Nginx/Apache combined format, or JSON lines from Vercel, Netlify or Cloudflare. Files stay on your computer.</small></label>
    <label class="field"><span>…or paste lines</span><textarea id="paste" rows="6" placeholder='66.249.66.1 - - [14/Nov/2026:10:00:00 +0000] "GET /blog/post HTTP/1.1" 200 5120 "-" "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"'></textarea></label>
    <div class="btns"><button class="btn" type="button" id="example">Try sample logs</button></div>
  </div>
</div>
<div class="tool single"><div class="panel" aria-live="polite"><h2>AI crawler visits</h2><div id="out"></div></div></div>`,
  content: `
<h2>Why look at logs?</h2>
<p>Analytics tools like GA4 and Plausible count visits by running JavaScript in a browser. Crawlers don’t run it, so AI bots are invisible there. Your web server, CDN or host records every request, including the user-agent, which is how each crawler identifies itself.</p>
<h2>Where to get your logs</h2>
<ul>
<li><strong>Nginx / Apache</strong>: usually <code>/var/log/nginx/access.log</code> or <code>/var/log/apache2/access.log</code>.</li>
<li><strong>Vercel</strong>: Logs tab in the dashboard, or a log drain. Export as JSON.</li>
<li><strong>Netlify</strong>: Log Drains (Pro and up), JSON lines.</li>
<li><strong>Cloudflare</strong>: Logpush (Enterprise) or, on any plan, Security → Events filtered by user-agent.</li>
</ul>
<h2>What to look for</h2>
<ul>
<li><strong>Search and user fetchers</strong> (OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot) mean AI assistants are reading your pages to answer people. The pages they hit most are the ones being cited.</li>
<li><strong>Errors</strong>: 404s and 5xx for AI bots mean broken links they found somewhere, or pages that fail without JavaScript.</li>
<li><strong>Bots you blocked</strong> still showing up: check your <a href="../ai-robots-txt-generator/">robots.txt</a>, or block them at your CDN.</li>
</ul>
<p>User-agents can be faked. For a strict check, verify the request IP against the ranges each company publishes.</p>`,
  faq: [
    ['Are my logs uploaded?', 'No. The file is read by JavaScript in this page and never sent anywhere. You can disconnect from the internet after the page loads and it still works.'],
    ['How big a file can I use?', 'Tens of megabytes is fine in a modern browser. For larger logs, filter first, for example <code>grep -iE "gptbot|claude|perplexity|oai-search" access.log</code>.'],
    ['Why don’t I see Google-Extended?', 'Google-Extended isn’t a crawler. It’s a robots.txt switch. Google’s crawling shows up as Googlebot.'],
  ],
  cta: { title: 'See AI answers next to your traffic', text: 'Kauzl asks ChatGPT, Claude, Gemini and Perplexity the questions your customers ask, and shows whether they name you, cite you or send you visitors, on the same timeline as GA4.' },
};
