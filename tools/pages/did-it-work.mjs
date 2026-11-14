export default {
  name: 'Did It Work? Launch Impact Checker',
  title: 'Did It Work? Free Before/After Launch Impact Calculator | Kauzl',
  description: 'Paste daily visits, sign-ups or sales from before and after a launch, redesign or campaign. Find out whether the change is real or just noise, with a plain-English verdict.',
  blurb: 'Paste daily numbers from before and after a change. Find out if the jump is real or noise.',
  related: ['utm-builder', 'ab-test-calculator', 'sample-size-calculator'],
  h1: 'Did it work? Before/after impact checker',
  intro: 'You shipped a redesign, posted on Reddit or changed your pricing page. Paste the daily numbers from before and after, and see whether the change is real or just a normal wobble.',
  script: 'did-it-work.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Your daily numbers</h2>
    <label class="field"><span>What are you measuring?</span><input type="text" name="metric" value="sign-ups" placeholder="visits, sign-ups, sales"></label>
    <label class="field"><span>Before the change</span><textarea name="before" rows="7" placeholder="One number per day. Paste a column from GA4 or a spreadsheet."></textarea><small>Dates are fine too: <code>2026-11-01 &nbsp;124</code></small></label>
    <label class="field"><span>After the change</span><textarea name="after" rows="7" placeholder="Same number of days if you can."></textarea></label>
    <div class="btns"><button class="btn" type="button" id="example">Try an example</button><button class="btn" type="button" id="clear">Clear</button></div>
  </form>
  <div class="panel sticky" aria-live="polite">
    <h2>Verdict</h2>
    <div id="out"></div>
  </div>
</div>`,
  content: `
<h2>How this works</h2>
<p>Daily numbers bounce around even when nothing changes: weekends dip, a newsletter goes out, a bot visits. The checker asks a simple question: <em>is the gap between the before and after averages bigger than that normal day-to-day bounce?</em></p>
<p>When both sides cover the same number of whole weeks, it compares each day with the same weekday on the other side (a paired t-test), so the weekend dip doesn’t drown out a real change. Otherwise it uses Welch’s t-test on the two sets of days. Either way, the p-value is the chance of seeing a gap this big if the change did nothing at all.</p>
<ul>
<li><strong>Below 5%</strong>: a real change. Very unlikely to be chance.</li>
<li><strong>5% to 20%</strong>: promising, but wait for more days before celebrating.</li>
<li><strong>Above 20%</strong>: no clear change yet. It may still be working, but the numbers can’t show it.</li>
</ul>
<h2>Getting a fair answer</h2>
<ul>
<li><strong>Use whole weeks.</strong> Compare 14 days to 14 days, not Friday–Sunday to Monday–Wednesday.</li>
<li><strong>Skip the launch day itself</strong> if it had a one-off spike from your own announcement.</li>
<li><strong>Watch for other changes.</strong> A holiday, an outage, a Google update or another campaign in the same window will show up here too. This test tells you <em>whether</em> the number moved, not <em>why</em>.</li>
</ul>
<p>Answering the “why” is what Kauzl is for: it puts your releases, posts, campaigns and Google updates on the same timeline as GA4 and Search Console, and does this before/after check for every one of them automatically.</p>`,
  faq: [
    ['Where do I get daily numbers?', 'In GA4, open a report, set the date range, add a “Date” dimension and export to Google Sheets or CSV. Copy the value column and paste it here. Search Console’s Performance report exports daily clicks the same way.'],
    ['How many days do I need?', 'At least 7 on each side, ideally 14 or 28. Small changes need more days to show up.'],
    ['Can I use this for revenue or conversion rate?', 'Yes. Any daily number works: visits, sign-ups, orders, revenue, or a rate like conversion %.'],
    ['Is this the same as an A/B test?', 'No. An A/B test splits visitors at the same time, so it rules out seasonality. A before/after check is what you can do when you’ve already shipped to everyone. For a split test, use the <a href="../ab-test-calculator/">A/B test calculator</a>.'],
  ],
  cta: { title: 'Want this for every launch, automatically?', text: 'Kauzl marks your deploys, posts and campaigns on a timeline with GA4 and Search Console, and checks each one before and after. No spreadsheets.' },
};
