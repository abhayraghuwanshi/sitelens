export default {
  name: 'AI robots.txt Generator',
  title: 'AI robots.txt Generator: Block GPTBot & ClaudeBot, Keep AI Search Traffic | Kauzl',
  description: 'Generate a robots.txt that controls AI crawlers: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot and more. Block model training while staying visible in ChatGPT, Claude and Perplexity search.',
  blurb: 'Block AI training crawlers but stay visible in ChatGPT, Claude and Perplexity search.',
  related: ['ai-crawler-log-analyzer', 'llms-txt-generator', 'schema-generator'],
  h1: 'AI robots.txt generator',
  intro: 'Decide which AI crawlers can read your site. The usual sweet spot: keep training crawlers out, and let AI search crawlers in so ChatGPT, Claude and Perplexity can still cite you and send visitors.',
  script: 'ai-robots.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Pick a policy</h2>
    <div class="seg" id="presets" role="group" aria-label="Presets" style="margin-bottom:14px">
      <button type="button" data-p="search">Block training, allow AI search</button>
      <button type="button" data-p="all">Allow all</button>
      <button type="button" data-p="none">Block all AI</button>
    </div>
    <div class="scroll-x"><table class="table" id="bots"><thead><tr><th>Crawler</th><th>What it does</th><th>Allow</th></tr></thead><tbody></tbody></table></div>
    <h3>Other rules</h3>
    <label class="field"><span>Paths to keep every crawler out of</span><textarea name="disallow" rows="3" placeholder="/admin&#10;/checkout"></textarea></label>
    <label class="field"><span>Sitemap URL</span><input type="url" name="sitemap" placeholder="https://example.com/sitemap.xml"></label>
  </form>
  <div class="panel sticky">
    <h2>robots.txt</h2>
    <pre class="out" id="out"></pre>
    <div class="btns"><button class="btn primary" type="button" data-copy="#out">Copy</button><button class="btn" type="button" id="dl">Download robots.txt</button></div>
    <p class="hint">Put it at the root of your domain: <code>https://yoursite.com/robots.txt</code>.</p>
  </div>
</div>`,
  content: `
<h2>Three kinds of AI crawler</h2>
<p>Blocking “AI” in robots.txt isn’t one switch. Each company runs separate crawlers for separate jobs, and blocking the wrong one can cost you traffic.</p>
<ul>
<li><strong>Training crawlers</strong> (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Bytespider, meta-externalagent) collect pages to train future models. Blocking them sends you no less traffic today.</li>
<li><strong>AI search crawlers</strong> (OAI-SearchBot, Claude-SearchBot, PerplexityBot) build the index that ChatGPT search, Claude and Perplexity cite with links. Block these and you disappear from those answers.</li>
<li><strong>User fetchers</strong> (ChatGPT-User, Claude-User, Perplexity-User) open a page because a person asked an assistant about it right now. They act on a person’s request, so some of them may not follow robots.txt.</li>
</ul>
<h2>Does Google-Extended affect Google Search?</h2>
<p>No. <code>Google-Extended</code> only controls whether your content is used for Gemini training and grounding. Googlebot still crawls and ranks you normally, and AI Overviews are governed by Googlebot, not Google-Extended.</p>
<h2>robots.txt is a request, not a wall</h2>
<p>The big AI companies say they respect robots.txt, but it’s voluntary. To see who actually visits, run your server logs through the <a href="../ai-crawler-log-analyzer/">AI crawler log analyzer</a>. For hard blocking, use your CDN or firewall (Cloudflare, Vercel and Netlify all have bot rules).</p>`,
  faq: [
    ['Will blocking GPTBot remove me from ChatGPT?', 'Not from ChatGPT search. ChatGPT search uses OAI-SearchBot, and live browsing uses ChatGPT-User. GPTBot only collects training data. Blocking GPTBot but allowing OAI-SearchBot keeps you citable.'],
    ['How long until a change takes effect?', 'Crawlers re-read robots.txt regularly; OpenAI says about 24 hours. Content already collected for training isn’t removed.'],
    ['Should I block AI crawlers at all?', 'If AI answers can send you customers, keep the search and user crawlers open. Blocking training crawlers is a business choice: it doesn’t change your traffic today, but it limits how your content is used.'],
    ['What about anthropic-ai and Claude-Web?', 'Those are older Anthropic user-agents. Anthropic now uses ClaudeBot, Claude-SearchBot and Claude-User.'],
  ],
};
