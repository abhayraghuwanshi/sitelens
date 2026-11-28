// Targets: "google updates 2026" (~340/week on Bing US), "search updates" (~250),
// "google core update" (rising, Nov 2026), and the intent behind "why did my
// traffic drop". A diagnosis checklist; the calendar view is Kauzl's real answer.
export default {
  order: 5.3,
  kicker: 'Measuring changes',
  short: 'Was it a Google update?',
  title: 'Traffic Drop: Was It a Google Update? | Kauzl',
  h1: 'Your traffic dropped. Was it a Google update?',
  description: 'A step-by-step way to find out why search traffic fell: check tracking, seasons, your own changes, Google’s update dates and AI answers, in that order.',
  blurb: 'Five checks, in order, that tell a Google update apart from a broken tag, a season or your own deploy.',
  lead: 'When search traffic falls, a Google update is the first suspect and often the wrong one. Check five things in order: tracking, the calendar, your own changes, Google’s update dates, and AI answers. Most drops are explained by the first three.',
  published: '2026-11-28',
  tools: ['did-it-work', 'ai-crawler-log-analyzer', 'serp-preview'],
  inShort: [
    '<strong>1. Tracking:</strong> if GA4 fell but Search Console clicks didn’t, the tag broke, not your rankings.',
    '<strong>2. The calendar:</strong> compare with the same weeks last year. Holidays and school terms move traffic a lot.',
    '<strong>3. Your own changes:</strong> a deploy, redesign, redirect or robots.txt edit on the day the drop began is the likeliest cause.',
    '<strong>4. Google’s updates:</strong> match the start date against the <strong>Google Search Status Dashboard</strong>. Core updates take up to about two weeks to roll out.',
    '<strong>5. AI answers:</strong> impressions steady while clicks fall on question searches points to AI Overviews or AI Mode, not lost rankings.',
  ],
  body: `
<h2>1. Is the drop real, or is tracking broken?</h2>
<p>Put two sources side by side for the same days: <strong>GA4 organic sessions</strong> and <strong>Search Console clicks</strong>. They never match exactly, but they move together.</p>
<ul>
<li><strong>GA4 down, Search Console flat:</strong> the tag stopped firing on some pages, a consent banner changed, or a new template dropped the snippet. Your search traffic is fine.</li>
<li><strong>Both down:</strong> the drop is real. Carry on.</li>
<li><strong>Everything down, including direct and email:</strong> almost certainly tracking or the site itself, not Google.</li>
</ul>

<h2>2. Is it just the time of year?</h2>
<p>Compare the last 28 days with the <strong>same 28 days a year ago</strong>, not with the 28 days before. Many sites lose a third of their traffic over late December, or over a summer, every year. B2B sites dip at weekends and holidays; shopping and gift searches spike before them. If last year shows the same dip, it isn’t a penalty.</p>

<h2>3. Did you change something?</h2>
<p>Find the first day of the drop, then list everything that shipped that week. The usual culprits:</p>
<ul>
<li>a redesign or new template that changed titles, headings or internal links,</li>
<li>URL changes without 301 redirects,</li>
<li>a <code>noindex</code> left on from a staging site, or a robots.txt that now blocks a folder,</li>
<li>pages removed or merged, and slower pages after a new script or font.</li>
</ul>
<p>Search Console’s <strong>Pages</strong> report (indexing) and <strong>URL Inspection</strong> show whether Google can still crawl and index what you changed. This step is where seeing traffic and releases on one timeline helps most: Kauzl puts your deploys, releases and posts on the same calendar as visits and search clicks, so the day something shipped and the day traffic moved sit side by side.</p>

<h2>4. Does it line up with a Google update?</h2>
<p>Google lists confirmed ranking updates, with start and end dates, on the <strong>Google Search Status Dashboard</strong> (status.search.google.com). Check whether your drop began inside an update’s rollout window.</p>
<ul>
<li><strong>Core updates</strong> change how Google judges quality across the web, and roll out over up to about two weeks. Google’s advice is to wait until the rollout ends, then compare a week after with a week before.</li>
<li><strong>Spam updates</strong> target specific tactics such as scaled low-value content or link schemes.</li>
<li><strong>Which pages lost?</strong> In Search Console, compare the two periods and sort Pages by clicks lost. A whole site sliding points to a quality reassessment; a few pages points to those pages, or to competitors who got better.</li>
</ul>
<p>A core update has no single fix. Improve the pages that lost: make them more useful and original than what now outranks them, and keep them accurate. Recovery, if it comes, often shows at a later update.</p>

<h2>5. Are AI answers taking the clicks?</h2>
<p>If <strong>impressions held or rose while clicks fell</strong>, and the losses are on question-style searches, people are probably getting the answer on the results page from an AI Overview or in AI Mode. Your ranking didn’t drop; the click did. Read <a href="/guides/google-ai-mode/">what AI Mode means for your traffic</a> and <a href="/guides/google-ai-overviews/">how to get cited in AI Overviews</a>.</p>
`,
  goal: [
    'Check whether a traffic drop is real or a tracking problem.',
    'Compare a drop with last year and with your own changes.',
    'Check the drop’s start date against Google’s update dates.',
  ],
  steps: [
    { text: 'Put GA4 organic sessions and Search Console clicks side by side for 90 days.', href: 'https://search.google.com/search-console' },
    { text: 'Compare the drop with the same weeks last year, and list what shipped that week.' },
    { text: 'Check the start date against the Google Search Status Dashboard.', href: 'https://status.search.google.com' },
  ],
  check: [
    { q: 'GA4 organic visits fell 40%, Search Console clicks didn’t move. Likely cause?', options: ['Broken tracking', 'A core update', 'AI Overviews', 'Seasonality'], answer: 0, why: 'Search Console counts clicks on Google’s side; if it held, people still arrived and GA4 missed them.' },
    { q: 'How long can a Google core update take to roll out?', options: ['Up to about two weeks', 'One hour', 'Exactly one day', 'Six months'], answer: 0, why: 'Google says core updates roll out over up to about two weeks; compare after the rollout ends.' },
  ],
  faq: [
    ['How do I know if a Google update hit my site?', 'A Google update is the likely cause when search clicks fell on many pages, tracking is working, last year shows no similar dip, nothing shipped that week, and the drop began during an update listed on the Google Search Status Dashboard.'],
    ['Where can I see Google algorithm update dates?', 'Google lists confirmed ranking updates with their start and end dates on the Google Search Status Dashboard at status.search.google.com.'],
    ['How long does it take to recover from a core update?', 'Recovery from a core update has no fixed timeline. Google says improved sites may see changes at a later core update, which can be months away, because pages are reassessed over time.'],
    ['Why did my traffic drop but impressions stayed the same?', 'Traffic falling while impressions stay the same usually means fewer people click, not that you rank lower. AI Overviews, AI Mode and other result features often answer the question on Google’s page.'],
    ['Can a website change cause a traffic drop?', 'A website change is one of the most common causes of a traffic drop. Redesigns, URL changes without redirects, accidental noindex tags and robots.txt edits can all cut search traffic within days.'],
  ],
};
