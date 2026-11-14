// Kauzl's own question. Long-tail ("how to measure impact of website
// changes", "before and after analysis ga4") and the post to share on
// Reddit / Indie Hackers, since it leads straight into the product.
export default {
  order: 7,
  kicker: 'Measuring changes',
  short: 'Did a website change work?',
  title: 'How to Tell if a Website Change Worked: Before/After Analysis in GA4 | Kauzl',
  h1: 'How to tell if a website change actually worked',
  description: 'A practical before/after method for redesigns, new pages, pricing changes and launches: pick the metric, compare fair periods, rule out coincidences, and test whether the change is real.',
  blurb: 'A fair before/after method for redesigns, launches and pricing changes.',
  lead: 'You shipped a redesign, a new pricing page or a launch post, and the numbers moved. Or didn’t. Here’s how to tell a real effect from a normal wobble, without an A/B test.',
  published: '2026-11-14',
  tools: ['did-it-work', 'utm-builder', 'ab-test-calculator'],
  inShort: [
    'Pick <strong>one metric</strong> the change should move, and write it down before you look.',
    'Compare <strong>equal whole weeks</strong> before and after, and leave out the launch day itself.',
    'Rule out <strong>coincidences</strong>: holidays, Google updates, other campaigns, tracking changes.',
    'Then test whether the gap is bigger than normal day-to-day noise. The free checker does that from pasted numbers.',
  ],
  body: `
<h2>Why “the graph went up” isn’t enough</h2>
<p>Daily traffic bounces around even when nothing changes. Weekends dip, a newsletter goes out, someone links to an old post, a bot visits. After a launch it’s tempting to point at the first good day. A fair check asks whether the change is bigger than that normal bounce, and whether something else could explain it.</p>

<h2>Step 1: pick the metric before you look</h2>
<p>Decide what the change was supposed to move, and choose the number closest to it:</p>
<ul>
<li>New pricing page → sign-ups or trial starts per day, not page views.</li>
<li>Rewritten article title → clicks from Google (Search Console), not time on page.</li>
<li>Launch post on Reddit → visits from Reddit, then sign-ups from those visits.</li>
<li>Faster checkout → purchases per session.</li>
</ul>
<p>Writing it down first stops you from scanning twenty metrics and celebrating whichever one happened to rise.</p>

<h2>Step 2: compare fair periods</h2>
<ul>
<li><strong>Whole weeks on both sides.</strong> 14 days before vs 14 days after, so each side has the same number of Saturdays.</li>
<li><strong>Skip the launch day</strong> (and maybe the day after) if your own announcement caused a one-off spike.</li>
<li><strong>Give it time.</strong> Search changes can take weeks to show as Google recrawls. Conversion changes show within days if you have traffic.</li>
<li><strong>Seasonal business?</strong> Also compare with the same weeks last year.</li>
</ul>

<h2>Step 3: get daily numbers out of GA4</h2>
<ol class="steps-list">
<li>In GA4, open <strong>Explore → Free form</strong>.</li>
<li>Add the dimension <strong>Date</strong> and your metric, such as <em>Key events</em> filtered to <code>sign_up</code>, or <em>Sessions</em>.</li>
<li>Set the date range to cover both periods, then export to Google Sheets or CSV.</li>
<li>Copy the before days and the after days as two columns.</li>
</ol>
<p>For search clicks, export the daily chart from Search Console’s Performance report instead.</p>

<h2>Step 4: rule out coincidences</h2>
<p>Before crediting your change, check the same window for:</p>
<ul>
<li>Holidays, sales seasons and school terms.</li>
<li>Google core updates (Google lists them on its Search Status Dashboard).</li>
<li>Other things you shipped or posted: emails, ads, social posts, other releases.</li>
<li>Tracking changes: a new cookie banner, a tag moved into Tag Manager, a domain change. These can move numbers with no real change in visitors.</li>
</ul>
<p>A useful sanity check is a <strong>comparison group</strong>: pages or channels you didn’t change. If sign-ups rose 20% after your pricing change but visits to unrelated pages also rose 20%, something site-wide is going on.</p>

<h2>Step 5: test whether the gap is real</h2>
<p>Paste the two columns into the <a href="/tools/did-it-work/">Did it work? checker</a>. It compares the averages and works out how likely a gap that size would be from normal day-to-day variation alone. When both sides are equal whole weeks, it compares each day with the same weekday on the other side, so the weekend dip doesn’t hide a real change. You get a plain answer: <em>a real change</em>, <em>promising, wait for more days</em>, or <em>no clear change</em>.</p>
<p>An example: sign-ups averaged 36.7 a day for two weeks before a pricing change and 45.5 a day for two weeks after. That’s +24%, and comparing weekday to weekday, a gap that size would almost never happen by chance. Real.</p>

<h2>When before/after isn’t enough</h2>
<p>A before/after check can’t fully separate your change from everything else that happened at the same time. When the decision is expensive and you have the traffic, run a proper split test: the <a href="/guides/statistical-significance-ab-testing/">guide to statistical significance</a> and the <a href="/tools/sample-size-calculator/">sample size calculator</a> help you plan it.</p>

<h2>Make this a habit, not a project</h2>
<p>The hardest part isn’t the statistics; it’s remembering what you shipped and when, then exporting the right numbers weeks later. Kauzl puts your releases, posts and campaigns on the same timeline as GA4 and Search Console and runs this check for each one automatically. <a href="/demo?to=timeline">See it in the demo</a>.</p>
`,
  faq: [
    ['How many days of data do I need?', 'At least 7 on each side, ideally 14 or 28. Small effects need more days to stand out from normal variation.'],
    ['Can I compare different-length periods?', 'You can, but equal whole weeks are fairer: they give each side the same weekdays and weekends.'],
    ['Is a before/after comparison as good as an A/B test?', 'No. An A/B test runs both versions at the same time, which rules out seasonality and outside events. Before/after is what you can do once a change has shipped to everyone.'],
  ],
  cta: { title: 'Want this for every change you ship?', text: 'Kauzl marks your deploys, posts and campaigns on a timeline with GA4 and Search Console, and checks each one before and after. No spreadsheets.' },
};
