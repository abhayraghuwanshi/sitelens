// From our research "Open-source SEO and analytics tools compared" (GitHub
// data 2026-11-20) and the Gap Map (Semrush, Ahrefs, Screaming Frog). Targets
// "seo tools", "screaming frog alternative", "free seo audit tool", "open
// source seo tools", "claude seo". No prices (Compare rule).
export default {
  order: 6.6,
  kicker: 'Compare',
  short: 'SEO tools: suites, crawlers, open source',
  title: 'SEO Tools Compared: Free, Paid and Open Source | Kauzl',
  h1: 'SEO tools compared: Search Console, Semrush, Ahrefs, Screaming Frog and the open-source crawlers',
  description: 'Which SEO tools do what: free Google and Bing data, paid suites, desktop crawlers, open-source auditors and Claude-based SEO agents, compared.',
  blurb: 'Free search data, paid suites, crawlers and open-source auditors, and which you need.',
  lead: 'SEO tools fall into four groups: your own search data, research suites, crawlers that audit your site, and a new wave of AI agents. Most sites need the free first group long before the rest. We make Kauzl, which works from your own Search Console and Bing data, and say where it fits.',
  published: '2026-11-22',
  tools: ['serp-preview', 'schema-generator', 'open-graph-preview'],
  inShort: [
    '<strong>Start with your own data:</strong> Google Search Console and Bing Webmaster Tools are free, exact, and show what you already rank for.',
    '<strong>Semrush and Ahrefs</strong> estimate what you <em>could</em> rank for, who links to competitors, and keyword volumes. They’re for when you plan content at scale.',
    '<strong>Crawlers</strong> such as Screaming Frog and the open-source SEOmator, FreeCrawl and LibreCrawl find broken links, missing tags and duplicate titles across a whole site.',
    'Most audits check every site the same way. The useful step is ranking each problem by the search clicks it costs <em>you</em>.',
  ],
  body: `
<h2>The four groups</h2>
<table>
<thead><tr><th>Group</th><th>Tools</th><th>Answers</th><th>Cost</th></tr></thead>
<tbody>
<tr><td><strong>Your own search data</strong></td><td>Google Search Console, Bing Webmaster Tools, Ahrefs Webmaster Tools</td><td>What you rank for, clicks, indexing problems, links to your site</td><td>Free</td></tr>
<tr><td><strong>Research suites</strong></td><td>Semrush, Ahrefs, SE Ranking, Moz</td><td>Keyword volumes, competitors’ rankings, backlinks, daily rank tracking</td><td>Paid</td></tr>
<tr><td><strong>Crawlers and auditors</strong></td><td>Screaming Frog, Lighthouse, Unlighthouse, SEOmator, FreeCrawl, LibreCrawl, SEOnaut</td><td>Broken links, redirects, missing tags, duplicate titles, speed</td><td>Free to paid</td></tr>
<tr><td><strong>AI SEO agents</strong></td><td>claude-seo, open-seo-mcp-skills, OpenGSO</td><td>Audits and fixes written by an AI agent, including GEO checks</td><td>Mostly free and open source</td></tr>
</tbody>
</table>

<h2>Open-source crawlers and auditors</h2>
<p>GitHub data from 20 November 2026. These run on your machine or in CI, so your site data stays with you.</p>
<table>
<thead><tr><th>Tool</th><th>Stars</th><th>Licence</th><th>What it checks</th></tr></thead>
<tbody>
<tr><td><a href="https://github.com/GoogleChrome/lighthouse" rel="nofollow">Lighthouse</a></td><td>31,170</td><td>Apache-2.0</td><td>One page: speed, Core Web Vitals, accessibility, about 14 SEO checks</td></tr>
<tr><td><a href="https://github.com/harlan-zw/unlighthouse" rel="nofollow">Unlighthouse</a></td><td>4,959</td><td>MIT</td><td>Lighthouse on every page of a site</td></tr>
<tr><td><a href="https://github.com/JustinBeckwith/linkinator" rel="nofollow">linkinator</a></td><td>1,290</td><td>MIT</td><td>Broken links across a site</td></tr>
<tr><td><a href="https://github.com/PhialsBasement/LibreCrawl" rel="nofollow">LibreCrawl</a></td><td>1,131</td><td>MIT</td><td>Desktop crawler, a free alternative to Screaming Frog</td></tr>
<tr><td><a href="https://github.com/StJudeWasHere/seonaut" rel="nofollow">SEOnaut</a></td><td>872</td><td>MIT</td><td>Self-hosted crawler with about 50 site issues</td></tr>
<tr><td><a href="https://github.com/seo-skills/seo-audit-skill" rel="nofollow">SEOmator</a></td><td>837</td><td>MIT</td><td>398 rules in 20 groups, CI exit codes; says “not measured” rather than passing a check it can’t make</td></tr>
<tr><td><a href="https://github.com/kemalai/FreeCrawl-SEO-Tool" rel="nofollow">FreeCrawl</a></td><td>163</td><td>MIT</td><td>Desktop crawler for large sites, 200+ checks, compares each run with the last</td></tr>
</tbody>
</table>
<p>Screaming Frog, the best-known desktop crawler, is closed source and free for up to 500 URLs per crawl. LibreCrawl and FreeCrawl are the closest open-source alternatives.</p>

<h2>AI SEO agents</h2>
<p>The most-starred SEO project on GitHub we found is <a href="https://github.com/AgriciDaniel/claude-seo" rel="nofollow">claude-seo</a> (31,048 stars), a Claude Code plugin with 29 skills and 20 agents covering technical SEO, content, schema, GEO and more. These tools are mostly instructions for the AI; the model does the checking, so results can vary from run to run. <a href="https://github.com/Ryze-AI-Adgent/open-seo-mcp-skills" rel="nofollow">open-seo-mcp-skills</a> (10,563 stars) connects agents to your own Search Console and GA4 through a hosted service. <a href="https://github.com/sherwinvishesh/OpenGSO" rel="nofollow">OpenGSO</a> scores what an AI agent actually receives from your page.</p>

<h2>What to use, by size</h2>
<ol class="steps-list">
<li><strong>Any site:</strong> Search Console, Bing Webmaster Tools and a Lighthouse run on your key pages. Check the <a href="/tools/serp-preview/">snippet preview</a> before you publish.</li>
<li><strong>A growing content site:</strong> add a crawler once a month (Screaming Frog’s free tier, LibreCrawl or Unlighthouse) and Ahrefs Webmaster Tools for links.</li>
<li><strong>Content is your main channel:</strong> add Semrush or Ahrefs for keyword research and rank tracking.</li>
</ol>

<h2>Rank the problems by what they cost you</h2>
<p>A crawler will happily report 300 issues. Most don’t matter. A missing description on a page with no search impressions costs nothing, while a broken title on the page that gets half your clicks costs a lot. Sort fixes by the impressions or clicks at stake, which you only get from your own Search Console data. Kauzl does this: each content problem is tied to that page’s Search Console, Bing and AI-citation data, and checked again after you fix it.</p>
`,
  faq: [
    ['What is the best free SEO tool?', 'Google Search Console is the most useful free SEO tool because it shows real search queries, clicks and indexing problems for your own site. Bing Webmaster Tools and Ahrefs Webmaster Tools add more free data.'],
    ['Is there a free alternative to Screaming Frog?', 'Screaming Frog itself is free for crawls of up to 500 URLs. For larger sites, open-source crawlers such as LibreCrawl, FreeCrawl and SEOnaut cover many of the same checks.'],
    ['Do I need Semrush or Ahrefs?', 'Semrush or Ahrefs are worth it when you plan content at scale and need keyword volumes, competitor rankings and backlink data. Small sites get further with Search Console data first.'],
    ['Can Claude do an SEO audit?', 'Claude can audit a site using open-source plugins like claude-seo, which bundle SEO skills and agents. Results depend on the model and can vary by run, so confirm important findings with a crawler or Search Console.'],
  ],
};
