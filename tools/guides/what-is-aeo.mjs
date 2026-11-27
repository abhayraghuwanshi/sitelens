// Targets: "what is aeo" (~940/4 weeks on Bing US, Nov 2026), "answer engine
// optimization" (~15/week), "aeo vs seo", "aeo vs geo". Short definition page;
// the how-to lives in generative-engine-optimization — link there, don't repeat it.
export default {
  order: 3.25,
  kicker: 'AI search',
  short: 'What is AEO?',
  title: 'What Is AEO? Answer Engine Optimization Explained | Kauzl',
  h1: 'What is AEO (answer engine optimization)?',
  description: 'AEO means shaping your pages so AI assistants and search features quote them as the answer. How it differs from SEO and GEO, with examples.',
  blurb: 'A plain definition of AEO, how it differs from SEO and GEO, and what it looks like on a page.',
  lead: 'AEO, answer engine optimization, is the work of getting your page used as <em>the answer</em>: quoted in a ChatGPT, Perplexity or Claude reply, a Google AI Overview, a featured snippet or a voice assistant. It builds on SEO rather than replacing it.',
  published: '2026-11-22',
  tools: ['schema-generator', 'serp-preview', 'llms-txt-generator'],
  inShort: [
    '<strong>SEO</strong> aims for a high place in a list of links. <strong>AEO</strong> aims to be the passage the engine quotes, with or without a click.',
    '<strong>Answer engines</strong> include AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot), Google’s AI Overviews and featured snippets, and voice assistants.',
    '<strong>GEO</strong> (generative engine optimization) is a near-synonym, used mostly about AI assistants. People use AEO and GEO interchangeably.',
    'In practice AEO means answer-first writing, one question per section, clear headings, FAQ and structured data, fresh dates, and being mentioned on other sites the engines trust.',
  ],
  body: `
<h2>AEO in one example</h2>
<p>Someone asks “how long does GA4 keep data?”. A classic search page shows ten links. An answer engine reads a few pages and replies in two sentences, often naming its source. AEO is making sure that sentence comes from your page, and that your page is the one linked.</p>
<p>The page that wins usually has the question as a heading and a one- or two-sentence answer directly below it, before any background. The engine can lift that passage whole.</p>

<h2>AEO vs SEO vs GEO</h2>
<table>
<thead><tr><th></th><th>SEO</th><th>AEO</th><th>GEO</th></tr></thead>
<tbody>
<tr><td>Goal</td><td>Rank high in the list of links</td><td>Be the quoted answer</td><td>Be named and cited by AI assistants</td></tr>
<tr><td>Where</td><td>Google, Bing results</td><td>Featured snippets, AI Overviews, voice, AI assistants</td><td>ChatGPT, Claude, Perplexity, Gemini, Copilot</td></tr>
<tr><td>Success looks like</td><td>Position and clicks</td><td>Being quoted, sometimes with no click</td><td>Being recommended, cited and visited from AI</td></tr>
<tr><td>Main levers</td><td>Relevance, links, technical health</td><td>Answer-first structure, FAQ, structured data</td><td>Mentions on other sites, comparisons, freshness</td></tr>
</tbody>
</table>
<p>The three overlap heavily. AI assistants with web search start from search results, so a page that doesn’t rank is rarely quoted. Think of AEO and GEO as extra layers on top of SEO, not a separate discipline.</p>

<h2>What AEO looks like on a page</h2>
<ul>
<li><strong>Answer first.</strong> Put the direct answer in the first one or two sentences under each heading, then explain.</li>
<li><strong>One question per section,</strong> with the question, or close to it, as the heading.</li>
<li><strong>Self-contained answers.</strong> Start with the subject, not “It” or “This”, so the passage makes sense when it’s lifted out alone.</li>
<li><strong>Lists and tables</strong> for steps and comparisons, which engines quote readily.</li>
<li><strong>FAQ and structured data.</strong> FAQPage and Article markup tell engines what the page is. The <a href="/tools/schema-generator/">schema generator</a> writes it.</li>
<li><strong>Dates and freshness.</strong> Show when the page was published and updated, and keep facts current.</li>
<li><strong>Crawlable by AI search bots.</strong> Don’t block OAI-SearchBot, Claude-SearchBot or PerplexityBot in robots.txt (<a href="/guides/ai-crawlers-robots-txt/">which bots to allow</a>).</li>
</ul>

<h2>How to tell if AEO is working</h2>
<p>Being quoted often means no click, so traffic alone undercounts it. Watch three things:</p>
<ol class="steps-list">
<li><strong>AI referral visits</strong> in GA4 from chatgpt.com, perplexity.ai, claude.ai and others (<a href="/guides/track-chatgpt-traffic-google-analytics/">how to track them</a>).</li>
<li><strong>Search Console impressions</strong> for question-style queries. Rising impressions with flat clicks often means you’re shown in an answer box.</li>
<li><strong>Direct checks:</strong> ask the assistants your customers’ questions every week and note whether they quote or name you. Kauzl runs these answer checks for you, next to your GA4 and Search Console data.</li>
</ol>

<h2>Where to go next</h2>
<p>For the full playbook, including why AI assistants skip small products and what gets you named, read <a href="/guides/generative-engine-optimization/">how to get recommended by ChatGPT, Claude and Perplexity</a>.</p>
`,
  faq: [
    ['What does AEO stand for?', 'AEO stands for answer engine optimization: shaping content so search features and AI assistants use it as the direct answer to a question, rather than just listing it as a link.'],
    ['Is AEO the same as GEO?', 'AEO and GEO mostly mean the same thing. GEO (generative engine optimization) is used more for AI assistants like ChatGPT, while AEO also covers featured snippets and voice assistants.'],
    ['Does AEO replace SEO?', 'AEO builds on SEO rather than replacing it. AI assistants and answer boxes mostly draw on pages that already rank, so search basics like relevance, links and crawlability still come first.'],
    ['How do I measure AEO?', 'AEO is measured by AI referral visits in GA4, Search Console impressions for question queries, and regular checks of whether AI assistants quote or name you for your customers’ questions.'],
  ],
};
