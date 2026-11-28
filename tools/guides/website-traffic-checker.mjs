// Targets: "website traffic checker" (~40/week on Bing US, ~150 broad), "traffic
// checker", "web traffic checker", "similarweb free", "check website traffic"
// (Nov 2026). Honest: only your own site has real numbers; anything else is an
// estimate. Not a Compare guide (no ranking of vendors), so no prices anyway.
export default {
  order: 4.15,
  kicker: 'Choose your tools',
  short: 'Check any website’s traffic',
  title: 'How to Check Any Website’s Traffic | Kauzl',
  h1: 'How to check a website’s traffic: yours, and anyone else’s',
  description: 'Your own site’s traffic comes from analytics and Search Console. Anyone else’s is an estimate: how traffic checkers work and how far to trust them.',
  blurb: 'Real numbers for your own site, estimates for others, and how wrong the estimates can be.',
  lead: 'Only a site’s owner can see its real traffic. For your own site, that means your analytics and Search Console. For anyone else’s, every “traffic checker” gives an estimate, and estimates for small sites can be off by several times.',
  published: '2026-11-28',
  tools: ['did-it-work', 'utm-builder', 'serp-preview'],
  inShort: [
    '<strong>Your own site:</strong> use your analytics (Google Analytics, Plausible, PostHog or Cloudflare) for visits, and Search Console and Bing Webmaster Tools for search clicks.',
    '<strong>Someone else’s site:</strong> traffic checkers such as Similarweb, Semrush and Ahrefs <strong>estimate</strong> it from panels, clickstream data and rankings.',
    'Search-based tools estimate <strong>organic search traffic only</strong>, from rankings and click-through rates. They miss direct, social, email and AI traffic.',
    'Estimates are most useful for <strong>comparing sites and spotting trends</strong>, least useful as an exact visit count, especially below a few thousand visits a month.',
  ],
  body: `
<h2>Checking your own website’s traffic</h2>
<p>For a site you run, use the numbers measured on your own site and in the search engines:</p>
<table>
<thead><tr><th>Source</th><th>What it counts</th><th>Blind spots</th></tr></thead>
<tbody>
<tr><td>Google Analytics 4</td><td>Visits, pages, sources, key events</td><td>Ad blockers and declined consent; bots mostly filtered</td></tr>
<tr><td>Plausible, Cloudflare Web Analytics</td><td>Visits and sources without cookies</td><td>Less detail on behaviour</td></tr>
<tr><td>Google Search Console</td><td>Google searches, impressions, clicks, position</td><td>Only Google search</td></tr>
<tr><td>Bing Webmaster Tools</td><td>Bing searches and clicks</td><td>Only Bing search</td></tr>
<tr><td>Server or CDN logs</td><td>Every request, bots and AI crawlers included</td><td>Needs filtering to mean “people”</td></tr>
</tbody>
</table>
<p>Analytics and Search Console never match exactly: one counts visits on your site, the other clicks on Google’s results page. Watch them move together. Kauzl puts them on one calendar, with Bing and your releases, so you see one picture instead of four tabs.</p>

<h2>Checking someone else’s website traffic</h2>
<p>Nobody outside a company can see its analytics, so third-party tools build an estimate. There are two broad methods:</p>
<ul>
<li><strong>Panel and clickstream data.</strong> Tools like Similarweb combine browsing data from panels of users, partner data, and measurements from sites that connect their own analytics, then model the rest. They estimate total visits and the mix of sources.</li>
<li><strong>Search rankings.</strong> SEO tools like Semrush and Ahrefs track where a site ranks for millions of searches, multiply by each search’s estimated volume and click-through rate, and add it up. That’s an estimate of <strong>organic search traffic</strong> only.</li>
</ul>
<p>Most offer a free lookup with limits. Enter the domain, and compare at least two tools before believing a number.</p>

<h2>How accurate are traffic checkers?</h2>
<p>For large sites, estimates are often in the right range and good at showing direction. For small and niche sites they can be wrong by several times in either direction, because few panel users visit them and their long-tail searches aren’t tracked.</p>
<ul>
<li><strong>Use them to compare,</strong> for example whether a competitor is roughly bigger or smaller than you, or growing or shrinking, measured by the same tool.</li>
<li><strong>Use them to find sources,</strong> such as which searches or referring sites send a competitor traffic.</li>
<li><strong>Don’t use them as a count.</strong> A test worth doing: look your own site up and compare the estimate with your analytics.</li>
</ul>

<h2>Free signals that need no tool</h2>
<ul>
<li><strong>Search the site’s topics</strong> and see where it ranks for the searches you care about.</li>
<li><strong>Ask AI assistants</strong> your customers’ questions and note whether they name the site, a rough sign of how visible it is in AI search.</li>
<li><strong>Look at its activity:</strong> how often it publishes, its release notes, and comments or reviews on its posts.</li>
</ul>
`,
  goal: [
    'Check your own site’s traffic in analytics and Search Console.',
    'Use traffic checkers to compare sites, not to count visits.',
    'Test a checker’s accuracy against your own real numbers.',
  ],
  steps: [
    { text: 'Open your analytics and Search Console for the same 28 days and note visits and clicks.', href: 'https://search.google.com/search-console' },
    { text: 'Look your own site up in two traffic checkers and compare with your real numbers.' },
    { text: 'Look a competitor up in the same two tools and compare direction, not counts.' },
  ],
  check: [
    { q: 'Where do you get your own site’s real traffic?', options: ['Your analytics and Search Console', 'A traffic checker', 'An AI assistant', 'Your domain registrar'], answer: 0, why: 'Only measurement on your site, and the search engines’ own reports, are real counts.' },
    { q: 'What do rankings-based traffic estimates cover?', options: ['Organic search only', 'All traffic', 'Direct traffic', 'Social and email'], answer: 0, why: 'They add up estimated clicks from rankings, so direct, social, email and AI visits are missing.' },
  ],
  faq: [
    ['How can I check a website’s traffic for free?', 'Traffic checkers such as Similarweb, Semrush and Ahrefs offer a free estimate of another website’s traffic. For your own site, Google Analytics, Search Console and Bing Webmaster Tools give real numbers for free.'],
    ['Are website traffic checkers accurate?', 'Website traffic checkers give estimates, not counts. They are often in the right range for large sites but can be off by several times for small or niche sites, so use them to compare sites and trends.'],
    ['Can I see another website’s Google Analytics?', 'Another website’s Google Analytics is private to its owner. Unless they share access or publish their numbers, the only option is a third-party estimate.'],
    ['Why do traffic checkers show different numbers?', 'Traffic checkers show different numbers because they use different data: browsing panels, partner data, or search rankings multiplied by estimated click-through rates. Each has its own gaps and models.'],
  ],
};
