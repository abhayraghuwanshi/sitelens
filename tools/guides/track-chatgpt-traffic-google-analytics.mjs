// Targets: "chatgpt traffic google analytics", "track ai traffic ga4",
// "chatgpt referral traffic". Low on Bing, fast-growing on Google; a good
// post for Reddit and newsletters.
export default {
  order: 3,
  kicker: 'AI search',
  short: 'Track ChatGPT traffic in GA4',
  title: 'How to Track ChatGPT and AI Traffic in Google Analytics 4 | Kauzl',
  h1: 'How to track ChatGPT and AI traffic in Google Analytics 4',
  description: 'See how many visitors ChatGPT, Perplexity, Claude, Gemini and Copilot send you in GA4: where AI visits show up, a custom channel with a copy-paste regex, and why GA4 still undercounts them.',
  blurb: 'Where AI visits show up in GA4, a regex for an AI channel, and what GA4 still misses.',
  lead: 'People now find websites through ChatGPT, Perplexity and Claude. Those visits do reach Google Analytics, but they’re scattered across Referral, Unassigned and Direct. Here’s how to pull them together.',
  published: '2026-11-14',
  tools: ['ai-crawler-log-analyzer', 'ai-robots-txt-generator', 'utm-builder'],
  inShort: [
    'AI assistants send visits with referrers like <code>chatgpt.com</code>, <code>perplexity.ai</code>, <code>claude.ai</code> and <code>gemini.google.com</code>. ChatGPT also adds <code>utm_source=chatgpt.com</code> to many links.',
    'GA4 has started grouping these into an “AI Assistant” channel. Check Traffic acquisition for it first.',
    'If it’s missing or incomplete, build a custom channel group with the regex below and place it above Referral.',
    'GA4 is a floor, not a total: app clicks and copied links often arrive as Direct, and AI crawlers never appear at all.',
  ],
  body: `
<h2>Where AI visits show up today</h2>
<p>When someone clicks a link in an AI answer, the visit usually carries the assistant’s domain as the referrer. Open <strong>Reports → Acquisition → Traffic acquisition</strong>, switch the dimension to <strong>Session source / medium</strong>, and search the table for:</p>
<pre><code>chatgpt|perplexity|claude|gemini|copilot</code></pre>
<p>You’ll typically see rows such as <code>chatgpt.com / referral</code>, <code>perplexity.ai / referral</code>, <code>claude.ai / referral</code>, <code>gemini.google.com / referral</code> and <code>copilot.microsoft.com / referral</code>.</p>
<p>ChatGPT adds <code>utm_source=chatgpt.com</code> to many of the links it shows, but no <code>utm_medium</code>. A visit with a source and no medium can land in GA4’s <em>Unassigned</em> channel instead of Referral, which is why ChatGPT traffic often seems to be missing.</p>

<h2>Check for GA4’s AI Assistant channel</h2>
<p>In 2026 Google added an <strong>AI Assistant</strong> channel to GA4’s default channel group, according to several analytics publications. In Traffic acquisition, with the dimension set to <em>Session default channel group</em>, look for it in the list. If it’s there, click into it and switch to Session source to see which assistants it covers. If your main referrers are included, you may not need anything else.</p>

<h2>Build your own AI channel</h2>
<p>A custom channel group lets you decide exactly what counts as AI, and it applies to past data as well as new.</p>
<ol class="steps-list">
<li><strong>Admin → Data display → Channel groups → Create new channel group.</strong> Standard properties can have a small number of custom groups (two at the time of writing), so name it clearly, for example “Channels with AI”.</li>
<li><strong>Add a new channel</strong> called <em>AI assistants</em> with the condition <strong>Source matches regex</strong>:
<pre><code>.*(chatgpt|openai|perplexity|claude|anthropic|gemini\\.google|copilot\\.microsoft|deepseek|meta\\.ai|mistral|you\\.com|phind).*</code></pre>
GA4 matches regex against the whole value and is case-sensitive, which is why the pattern starts and ends with <code>.*</code> and uses lowercase.</li>
<li><strong>Drag the AI channel above Referral and Unassigned.</strong> GA4 assigns each visit to the first channel that matches, top to bottom. If Referral sits above it, AI visits are caught there first.</li>
<li><strong>Save</strong>, then in Traffic acquisition change the primary dimension to your new channel group.</li>
</ol>

<h2>Which pages do AI assistants send people to?</h2>
<p>In <strong>Explore → Free form</strong>, add the dimensions <em>Session source</em> and <em>Landing page + query string</em>, the metrics <em>Sessions</em> and <em>Key events</em>, and a filter on Session source matching the same regex. These are the pages assistants cite. They’re usually guides, comparisons and documentation, and they’re the ones worth keeping accurate and up to date.</p>

<h2>What GA4 can’t see</h2>
<ul>
<li><strong>App and copied links:</strong> clicks from the ChatGPT desktop and mobile apps, and links people copy into a new tab, often have no referrer. They show up as Direct.</li>
<li><strong>Google’s AI Overviews and AI Mode:</strong> clicks from these come from google.com and count as ordinary Google organic search, so you can’t separate them in GA4.</li>
<li><strong>AI crawlers:</strong> GPTBot, ClaudeBot and PerplexityBot fetch your pages but don’t run JavaScript, so they never appear in GA4. To see them, look at your server logs with the <a href="/tools/ai-crawler-log-analyzer/">AI crawler log analyzer</a>.</li>
<li><strong>Answers without a click:</strong> an assistant can recommend you by name without linking. That shows up later as branded searches and Direct visits, if at all.</li>
</ul>
<blockquote><p>Treat GA4’s AI number as the minimum. If it’s growing, the real figure is growing faster.</p></blockquote>

<h2>Make sure AI assistants can read you</h2>
<p>An assistant can only cite what it can fetch. Check that your robots.txt doesn’t block AI <em>search</em> crawlers like OAI-SearchBot, Claude-SearchBot and PerplexityBot, even if you block training crawlers. The <a href="/tools/ai-robots-txt-generator/">AI robots.txt generator</a> sets that up, and the guide to <a href="/guides/ai-crawlers-robots-txt/">which AI crawlers to block</a> explains the difference.</p>

<h2>Ask the assistants directly</h2>
<p>Referral numbers tell you about the visits you got, not the answers where you weren’t mentioned. Kauzl asks ChatGPT, Claude, Gemini and Perplexity the questions your customers ask, every week, and shows whether they name you, cite you or send you visitors, next to your GA4 traffic. You can <a href="/demo?to=ai">see it in the demo</a>.</p>
`,
  faq: [
    ['Why does ChatGPT traffic show as Direct in GA4?', 'Clicks from the ChatGPT apps, and links copied out of a chat, often carry no referrer, so GA4 can’t tell where they came from.'],
    ['Why does ChatGPT traffic show as Unassigned?', 'ChatGPT adds <code>utm_source=chatgpt.com</code> without a <code>utm_medium</code>. Without a medium, GA4’s default rules may not place the visit in Referral. A custom AI channel fixes this.'],
    ['Does a custom channel group change my old data?', 'Custom channel groups apply to past data in reports, so you can see AI traffic from before you created it.'],
    ['Can I track Google AI Overviews separately?', 'Not in GA4. Those clicks come from google.com and count as Google organic search.'],
  ],
};
