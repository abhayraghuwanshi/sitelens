// Targets: "search console vs google analytics", "gsc vs ga4",
// "search console clicks vs sessions". "google search console" alone is
// ~76,000/week on Bing US (Nov 2026); this catches the comparison intent.
export default {
  order: 5,
  kicker: 'Search',
  short: 'Search Console vs Google Analytics',
  title: 'Search Console vs Google Analytics: Why Clicks and Sessions Don’t Match | Kauzl',
  h1: 'Search Console vs Google Analytics: why the numbers never match',
  description: 'Search Console clicks and GA4 organic sessions are never equal. Here are the eight reasons, how to compare them fairly, and which tool to trust for which question.',
  blurb: 'Eight reasons GSC clicks and GA4 sessions differ, and how to compare them fairly.',
  lead: 'Search Console says Google sent 1,200 clicks. GA4 says 950 organic sessions. Neither is broken: they measure different things in different places. Here’s what each one counts.',
  published: '2026-11-14',
  tools: ['serp-preview', 'did-it-work', 'schema-generator'],
  inShort: [
    'Search Console counts <strong>clicks on Google’s results</strong>, measured by Google. GA4 counts <strong>sessions on your site</strong>, measured by a script in the visitor’s browser.',
    'GA4 misses visitors who block the script, decline cookies or leave before it loads, so it is usually lower than Search Console for Google traffic.',
    'Search Console uses Pacific Time; GA4 uses your property’s time zone. Daily numbers never line up exactly.',
    'Use Search Console for “how do people find us in Google?” and GA4 for “what do they do once they arrive?”.',
  ],
  body: `
<h2>They measure different things</h2>
<p><strong>Google Search Console</strong> records what happens on Google: how often your pages appeared in results (impressions), how often people clicked (clicks), and for which searches. It never sees your website.</p>
<p><strong>Google Analytics 4</strong> records what happens on your website: sessions, pages viewed, sign-ups. It only knows a visit came from Google because the browser says so.</p>
<p>A click is not a session. Most of the gap comes from that one fact.</p>

<h2>Eight reasons the numbers differ</h2>
<ol class="steps-list">
<li><strong>The GA4 tag doesn’t always run.</strong> Ad blockers, privacy browsers and declined cookie banners stop it. Google still counted the click.</li>
<li><strong>People leave before the page loads.</strong> If the visitor clicks and goes back before the GA4 script runs, there is a click but no session. Slow pages widen this gap.</li>
<li><strong>Different time zones.</strong> Search Console reports in Pacific Time; GA4 uses your property’s time zone. “Monday” covers different hours in each.</li>
<li><strong>Organic Search isn’t only Google.</strong> GA4’s Organic Search channel includes Bing, DuckDuckGo, Yahoo, Ecosia and others. Filter GA4 to <code>google / organic</code> before comparing.</li>
<li><strong>One session, several clicks.</strong> Someone who clicks two of your results within 30 minutes makes two clicks but can be one session.</li>
<li><strong>Different URLs.</strong> Search Console reports the canonical URL Google chose; GA4 reports the page actually loaded, including redirects and query strings.</li>
<li><strong>Discover and News are separate.</strong> Search Console shows Google Discover and Google News in their own reports; in GA4 those visits can appear under different sources.</li>
<li><strong>Freshness and privacy filtering.</strong> Search Console data arrives a couple of days late, and it hides rare queries to protect privacy, so the query table never adds up to the total.</li>
</ol>

<h2>How to compare them fairly</h2>
<ul>
<li>Use the <strong>same date range</strong>, and prefer weeks or months over single days to blur the time-zone difference.</li>
<li>In GA4, open <strong>Traffic acquisition</strong>, set the dimension to <em>Session source / medium</em>, and read the <code>google / organic</code> row only.</li>
<li>Compare <strong>trends, not totals</strong>. If both move together, tracking is fine. If clicks rise while GA4 sessions fall, investigate: a broken tag, a new cookie banner or a slow page.</li>
<li>For page-level checks, use GA4’s <strong>Landing page</strong> report against Search Console’s <strong>Pages</strong> tab, and expect canonical vs actual URL differences.</li>
</ul>

<h2>Link the two</h2>
<p>In GA4, <strong>Admin → Product links → Search Console links</strong> adds Search Console reports inside GA4, so you can see queries next to landing-page behaviour. You need owner access to the Search Console property. The <a href="/guides/google-analytics-4-setup/">GA4 setup guide</a> covers this with the other settings worth changing.</p>

<h2>Which one to trust for what</h2>
<table>
<thead><tr><th>Question</th><th>Use</th></tr></thead>
<tbody>
<tr><td>Which searches show my site, and at what position?</td><td>Search Console</td></tr>
<tr><td>Did my new title get more clicks?</td><td>Search Console (click-through rate)</td></tr>
<tr><td>Is Google indexing my new pages?</td><td>Search Console (Pages and URL inspection)</td></tr>
<tr><td>Do people from Google sign up or buy?</td><td>GA4 (key events by source)</td></tr>
<tr><td>How does Google compare with Reddit, email or ChatGPT?</td><td>GA4 (Traffic acquisition)</td></tr>
</tbody>
</table>

<h2>The question neither answers</h2>
<p>Both tools tell you what happened. Neither tells you whether it was because of something you did, like the title you rewrote or the article you published. Preview a new title with the <a href="/tools/serp-preview/">SERP preview tool</a>, then check the clicks before and after with the <a href="/tools/did-it-work/">Did it work? checker</a>. Kauzl puts Search Console, GA4 and your releases on one timeline, so that answer comes without exporting anything (<a href="/demo?to=story">see the demo</a>).</p>
`,
  faq: [
    ['Why is GA4 organic traffic lower than Search Console clicks?', 'Mostly because GA4 depends on a script that ad blockers, declined cookie banners and quick exits stop, while Google counts every click on its own results.'],
    ['Which is more accurate, Search Console or Google Analytics?', 'Each is accurate for what it measures. Search Console is the better count of clicks from Google; GA4 is the only one that shows what visitors do on your site.'],
    ['What time zone does Search Console use?', 'Pacific Time (PT), regardless of where you are. GA4 uses the time zone set on the property.'],
    ['Can GA4 show search queries?', 'Only through the Search Console link, and only with Search Console’s data. GA4 itself never receives the query people typed into Google.'],
  ],
};
