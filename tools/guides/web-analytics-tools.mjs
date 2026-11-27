// Lesson 1 of the course: the map of the market. Built from our own research:
// the "SiteLens Gap Map" (5 Nov 2026: GA4, Semrush, Ahrefs, Mixpanel, PostHog,
// Hotjar, Clarity, Plausible, Matomo, Sentry) and "Open-source SEO and
// analytics tools compared" (GitHub data 2026-11-20). Targets "web analytics
// tools", "website analytics", "what is google analytics", "types of analytics
// tools". No prices (Compare rule). Re-check product claims when updating.
export default {
  order: 1,
  kicker: 'Compare',
  short: 'The web analytics tools map',
  title: 'Web Analytics Tools: Which Kind Do You Need? | Kauzl',
  h1: 'Web analytics tools, mapped: which kind does your app need?',
  description: 'Seven kinds of analytics tools, the question each one answers, and the names in each: GA4, Plausible, PostHog, Clarity, Semrush, Sentry and more.',
  blurb: 'Seven kinds of analytics tools, the one question each answers, and which you need first.',
  lead: '“Analytics” covers at least seven kinds of tool, and each answers a different question. Most apps need two or three, not one of each. This lesson maps the market so you can pick. We make Kauzl, one of the tools on the map, and say where it fits.',
  published: '2026-11-22',
  tools: ['did-it-work', 'utm-builder'],
  inShort: [
    '<strong>Start with the question, not the tool.</strong> “How many people came, and from where?” is web analytics. “What do they do inside my app?” is product analytics. “Why did they leave this page?” is session replay.',
    'Most new apps need <strong>a traffic counter</strong> (GA4, Plausible or Umami) and <strong>Search Console</strong>. Add product analytics when you have sign-ups, and session replay when a page underperforms.',
    'SEO suites, error tracking and AI visibility trackers answer narrower questions. Add them when that question costs you money.',
    'A newer layer <strong>reads the tools you already have</strong> and explains them. Looker Studio, Owl Insight and Kauzl are in this group.',
  ],
  body: `
<h2>The seven kinds, by the question they answer</h2>
<table>
<thead><tr><th>Kind</th><th>The question</th><th>Well-known tools</th><th>You need it when…</th></tr></thead>
<tbody>
<tr><td><strong>Web analytics</strong> (traffic counters)</td><td>How many people came, from where, to which pages?</td><td>Google Analytics 4, Plausible, Umami, Fathom, Matomo</td><td>Always. It’s the base layer.</td></tr>
<tr><td><strong>Search data</strong></td><td>What did people search for before they found me?</td><td>Google Search Console, Bing Webmaster Tools</td><td>Always. Both are free.</td></tr>
<tr><td><strong>Product analytics</strong></td><td>What do signed-up users do, and who comes back?</td><td>PostHog, Mixpanel, Amplitude</td><td>You have accounts, an app or a trial to convert.</td></tr>
<tr><td><strong>Session replay and heatmaps</strong></td><td>What did this visitor actually see and click?</td><td>Microsoft Clarity, Hotjar, PostHog</td><td>A key page converts badly and the numbers can’t say why.</td></tr>
<tr><td><strong>SEO suites</strong></td><td>What could I rank for, and who links to me?</td><td>Semrush, Ahrefs, Screaming Frog</td><td>Search is your main channel and you’re choosing what to write.</td></tr>
<tr><td><strong>Error and crash tracking</strong></td><td>What broke, for whom, in which release?</td><td>Sentry, Crashlytics, Bugsnag</td><td>You ship an app or a lot of JavaScript.</td></tr>
<tr><td><strong>AI visibility</strong></td><td>Do ChatGPT, Claude and Perplexity name me?</td><td>Peec AI, Profound, Otterly.AI, Kauzl</td><td>Buyers ask AI assistants for recommendations in your category.</td></tr>
</tbody>
</table>
<p>One more group sits on top of these: tools that <strong>read the data you already collect</strong> and turn it into answers. Looker Studio builds custom GA4 reports, Owl Insight adds AI summaries to GA4, and Kauzl connects GA4, Search Console and Bing with what you shipped, to explain why numbers moved.</p>

<h2>What to set up first, by stage</h2>
<ol class="steps-list">
<li><strong>Before launch:</strong> one traffic counter and Search Console. Tag every link you share with UTMs (<a href="/guides/what-is-a-utm-code/">lesson 3</a>). That’s enough to answer “did anyone come, and from where?”.</li>
<li><strong>First sign-ups:</strong> add product analytics, or send sign-up and activation events to your traffic counter. You now need funnels and retention, not just visits (<a href="/guides/product-analytics-tools/">lesson 7</a>).</li>
<li><strong>A page that underperforms:</strong> add session replay on that page. Ten recordings often explain what a month of numbers can’t (<a href="/guides/session-replay-heatmaps/">lesson 8</a>).</li>
<li><strong>Search becomes a channel:</strong> add an SEO crawler and, if you write a lot, a keyword tool (<a href="/guides/seo-tools-compared/">lesson 9</a>).</li>
<li><strong>Buyers ask AI:</strong> start checking AI answers for your category (<a href="/guides/generative-engine-optimization/">lesson 17</a>).</li>
</ol>

<h2>What no single tool does</h2>
<p>When we mapped what the big tools cover, one gap stood out. Each tool sees its own slice: GA4 sees visits, Search Console sees searches, Sentry sees errors, and your Git history sees what you shipped. None of them puts “we changed the pricing page on Tuesday” next to “sign-ups fell on Wednesday” and says whether that’s more than a normal week moves.</p>
<table>
<thead><tr><th></th><th>Counts visits</th><th>Says why it moved</th><th>Links it to what you shipped</th><th>Says if it’s real or noise</th></tr></thead>
<tbody>
<tr><td>GA4</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
<tr><td>Plausible, Fathom, Umami</td><td>Yes, simpler</td><td>No</td><td>No</td><td>No</td></tr>
<tr><td>Owl Insight</td><td>Reads GA4</td><td>AI summaries</td><td>No</td><td>No</td></tr>
<tr><td>Kauzl</td><td>Reads GA4, Search Console, Bing</td><td>Yes</td><td>Releases, deploys, posts, campaigns</td><td>Yes, against a normal weekday</td></tr>
</tbody>
</table>
<p>That gap is why Kauzl exists, but you can close it by hand. Keep a dated log of what you change, and check each change against normal swings with the free <a href="/tools/did-it-work/">Did it work? checker</a>.</p>

<h2>How this course is laid out</h2>
<p>This is lesson 1 of a free course on web analytics for your app. Module 1 sets up the basics. Module 2 compares the tools in each kind, from the research behind this map. Module 3 is about reading the numbers, module 4 about AI search, and module 5 about asking AI agents about your data. Each lesson stands alone, so skip to what you need.</p>
`,
  goal: [
    'Know which question each analytics tool answers.',
    'Pick the two or three tools your app needs first.',
  ],
  steps: [
    { text: 'Write down the question you most want your analytics to answer.' },
    { text: 'Set up a traffic counter and Search Console before launch.', href: '/guides/google-analytics-4-setup/' },
    { text: 'Add product analytics or session replay when the question needs it.' },
  ],
  check: [
    { q: 'Which kind of tool shows what a visitor saw before leaving a page?', options: ['Web analytics', 'Session replay', 'Search data', 'Error tracking'], answer: 1, why: 'Session replay rebuilds the visitor’s screen; web analytics only counts the visit.' },
    { q: 'How many tools do most new apps need, not one of each?', options: ['Two or three', 'One of each kind', 'Only error tracking', 'Only AI visibility'], answer: 0, why: 'Most apps need a traffic counter and one answer layer, not every tool.' },
  ],
  faq: [
    ['What is a web analytics tool?', 'A web analytics tool counts visits to a website and records where they came from, which pages they saw and what they did, such as signing up. Google Analytics 4, Plausible, Umami and Matomo are common examples.'],
    ['What is the difference between web analytics and product analytics?', 'Web analytics measures traffic to a website: visits, sources and pages. Product analytics measures what signed-in users do inside an app: features used, funnels and who comes back. Many apps use one of each.'],
    ['Do I need more than Google Analytics?', 'Google Analytics alone covers traffic but not search queries, in-app behaviour, what a visitor saw, or errors. Most apps add the free Search Console first, then product analytics or session replay as they grow.'],
    ['Which analytics tools are free?', 'Google Analytics 4, Search Console, Bing Webmaster Tools and Microsoft Clarity are free. Umami, Plausible, Matomo and PostHog are open source and free to self-host, and most hosted tools have a free tier.'],
  ],
};
