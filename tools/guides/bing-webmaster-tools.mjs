// Targets: "bing webmaster tools" (~950/week on Bing US, steady, Nov 2026),
// "bing search console" (~1,200 broad), "bing webmaster" , "indexnow" (~12/week).
// The angle: Bing feeds Copilot and other AI search, so it's an AEO step too.
export default {
  order: 2.6,
  kicker: 'Search',
  short: 'Set up Bing Webmaster Tools',
  title: 'Bing Webmaster Tools Setup, Step by Step | Kauzl',
  h1: 'How to set up Bing Webmaster Tools (and why it matters for AI search)',
  description: 'Add your site to Bing Webmaster Tools in five minutes: import from Search Console, submit a sitemap, turn on IndexNow, and read the reports.',
  blurb: 'Import from Search Console, submit your sitemap, turn on IndexNow, and what the reports tell you.',
  lead: 'Bing Webmaster Tools is Bing’s version of Google Search Console: free, and about five minutes to set up if you import from Google. It matters more than Bing’s share suggests, because Bing’s index also feeds Microsoft Copilot and other search and AI tools.',
  published: '2026-11-28',
  tools: ['serp-preview', 'ai-robots-txt-generator', 'llms-txt-generator'],
  inShort: [
    '<strong>Bing Webmaster Tools</strong> is free. Sign in at bing.com/webmasters with a Microsoft, Google or Facebook account.',
    'The fastest setup is <strong>Import from Google Search Console</strong>: it brings your verified sites and sitemaps across in one step.',
    'Then turn on <strong>IndexNow</strong>, so new and changed pages reach Bing in minutes instead of waiting for a crawl.',
    'Bing’s index powers Bing and <strong>Microsoft Copilot</strong>, and other search engines and AI tools draw on it too, so it’s part of getting found in AI answers.',
    'Check the <strong>Search Performance</strong> and <strong>URL Inspection</strong> reports monthly, as you would in Search Console.',
  ],
  body: `
<h2>Why Bing Webmaster Tools is worth five minutes</h2>
<p>Bing’s own search share is small next to Google’s, but its index reaches further than its search box:</p>
<ul>
<li><strong>Microsoft Copilot</strong> answers with Bing’s search results, in Windows, Edge and Microsoft 365.</li>
<li><strong>Other search engines,</strong> Yahoo and DuckDuckGo among them, have long used Bing results for much of what they show.</li>
<li><strong>AI assistants with web search</strong> rely on search providers to find pages, and Bing has been one of them for ChatGPT search.</li>
</ul>
<p>A page Bing hasn’t indexed can’t be found by any of these. Bing Webmaster Tools is where you see whether it has, and push it if not.</p>

<h2>Set it up in five minutes</h2>
<ol class="steps-list">
<li><strong>Sign in</strong> at <a href="https://www.bing.com/webmasters" rel="noopener">bing.com/webmasters</a> with a Microsoft, Google or Facebook account.</li>
<li><strong>Choose Import from Google Search Console.</strong> Approve access, pick the sites, and Bing verifies them and copies their sitemaps. Nothing else to add.</li>
<li><strong>Or add the site by hand:</strong> type its URL, then verify with an XML file in your site’s root, a meta tag in the home page’s head, or a CNAME record in DNS.</li>
<li><strong>Submit your sitemap</strong> under Sitemaps if it wasn’t imported, for example <code>https://example.com/sitemap.xml</code>.</li>
<li><strong>Check robots.txt</strong> doesn’t block Bingbot. The <a href="/tools/ai-robots-txt-generator/">AI robots.txt generator</a> writes one that blocks AI training bots but keeps search and AI search open.</li>
</ol>

<h2>Turn on IndexNow</h2>
<p><strong>IndexNow</strong> is an open protocol: when a page is added, changed or deleted, your site pings the search engines that support it with the URL, instead of waiting for them to recrawl. Bing supports it, along with Yandex, Seznam and Naver. Google doesn’t use it, so keep your sitemap for Google.</p>
<ul>
<li><strong>Your platform may already do it.</strong> Several CMS and SEO plugins and hosting providers have an IndexNow switch; check before adding code.</li>
<li><strong>By hand:</strong> put a key file at your site’s root, then send changed URLs to <code>https://api.indexnow.org/indexnow</code> with that key, from your deploy script or CMS.</li>
<li><strong>Check it worked</strong> in Bing Webmaster Tools under IndexNow, which lists the URLs received.</li>
</ul>

<h2>The reports to check</h2>
<table>
<thead><tr><th>Report</th><th>What it tells you</th></tr></thead>
<tbody>
<tr><td>Search Performance</td><td>Clicks, impressions, average position and CTR on Bing, by page and by query</td></tr>
<tr><td>URL Inspection</td><td>Whether one page is indexed, and why not if it isn’t</td></tr>
<tr><td>Site Explorer</td><td>Every URL Bing knows about, with errors and redirects</td></tr>
<tr><td>Backlinks</td><td>Sites linking to you, as Bing sees them</td></tr>
<tr><td>Recommendations (SEO)</td><td>Fixable issues: titles too long, missing descriptions, broken links</td></tr>
</tbody>
</table>
<p>Look at Bing’s queries next to Google’s: they often differ, and Bing tends to rank smaller sites sooner. Kauzl reads both through their APIs and shows Google and Bing side by side for each page and search, with your traffic and deploys on the same calendar.</p>
`,
  goal: [
    'Add your site to Bing Webmaster Tools by importing from Search Console.',
    'Turn on IndexNow so Bing hears about new pages in minutes.',
    'Read Bing’s Search Performance next to Google’s.',
  ],
  steps: [
    { text: 'Sign in to Bing Webmaster Tools and import your sites from Search Console.', href: 'https://www.bing.com/webmasters' },
    { text: 'Confirm your sitemap is listed, and that robots.txt allows Bingbot.', href: '/tools/ai-robots-txt-generator/' },
    { text: 'Turn on IndexNow in your CMS or deploy script, then check the IndexNow report.' },
  ],
  check: [
    { q: 'What is the fastest way to add a site to Bing Webmaster Tools?', options: ['Import from Google Search Console', 'Email Microsoft support', 'Wait for Bing to find it', 'Add an llms.txt file'], answer: 0, why: 'Importing verifies your Search Console sites and copies their sitemaps in one step.' },
    { q: 'Does Google use IndexNow?', options: ['No, keep a sitemap for Google', 'Yes, it replaces the sitemap', 'Only for news sites', 'Only with Search Console linked'], answer: 0, why: 'IndexNow is supported by Bing, Yandex, Seznam and Naver; Google still finds pages by crawling and sitemaps.' },
  ],
  faq: [
    ['Is Bing Webmaster Tools free?', 'Bing Webmaster Tools is free. You sign in with a Microsoft, Google or Facebook account and can add as many sites as you can verify.'],
    ['How do I verify my site in Bing Webmaster Tools?', 'Bing Webmaster Tools verifies a site automatically when you import it from Google Search Console. Otherwise use an XML file at the site root, a meta tag on the home page, or a CNAME record in DNS.'],
    ['What is IndexNow?', 'IndexNow is an open protocol that lets a website tell search engines the moment a page is added, changed or deleted. Bing, Yandex, Seznam and Naver support it; Google does not.'],
    ['Does Bing matter for AI search?', 'Bing matters for AI search because Microsoft Copilot answers from Bing’s results, and other search engines and AI tools have drawn on Bing’s index. A page Bing hasn’t indexed can’t be found through them.'],
    ['Is Bing Webmaster Tools the same as Google Search Console?', 'Bing Webmaster Tools does the same job as Google Search Console for Bing: indexing status, search performance, sitemaps and fixes. The data differs because the two engines rank pages differently.'],
  ],
};
