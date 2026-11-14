// Targets: "what does statistically significant mean", "p value meaning",
// "what is statistical significance", "what is a/b testing",
// "statistical significance calculator" (Bing US, Nov 2026: ~2,500/week).
export default {
  order: 6,
  kicker: 'Experiments',
  short: 'Statistical significance, explained',
  title: 'What Does Statistically Significant Mean? A/B Testing in Plain English | Kauzl',
  h1: 'What does “statistically significant” mean in an A/B test?',
  description: 'Statistical significance and p-values explained without the maths degree: what 95% confidence really means, a worked A/B example, and the four mistakes that produce fake winners.',
  blurb: 'p-values and 95% confidence in plain English, with a worked example and common traps.',
  lead: 'Your testing tool says variant B won “with 95% significance”. Here’s what that actually promises, what it doesn’t, and how to avoid shipping a winner that was only luck.',
  published: '2026-11-14',
  tools: ['ab-test-calculator', 'sample-size-calculator', 'did-it-work'],
  inShort: [
    'A result is <strong>statistically significant</strong> when a difference that big would rarely happen by chance if A and B were really the same.',
    'The <strong>p-value</strong> is that chance. Below 0.05 is the usual bar, matching 95% confidence.',
    'It is <em>not</em> the probability that B is better, and it says nothing about whether the difference is big enough to matter.',
    'Decide your sample size before you start, run whole weeks, and don’t stop the moment it turns green.',
  ],
  body: `
<h2>The idea in one paragraph</h2>
<p>Even if two versions of a page were identical, their conversion rates would never be exactly equal: some days one gets luckier visitors. A significance test asks: <em>if A and B were truly the same, how often would luck alone produce a gap at least as big as the one we see?</em> If the answer is “rarely”, the difference is called statistically significant.</p>

<h2>What a p-value is</h2>
<p>The p-value is that “how often”. A p-value of <strong>0.03</strong> means: if there were no real difference, you’d see a gap this large about 3% of the time. Most teams call a result significant when p is below <strong>0.05</strong>, which is the same as “95% confidence”.</p>

<h2>A worked example</h2>
<table>
<thead><tr><th></th><th>Visitors</th><th>Sign-ups</th><th>Conversion rate</th></tr></thead>
<tbody>
<tr><td>A (current page)</td><td>5,000</td><td>250</td><td>5.0%</td></tr>
<tr><td>B (new headline)</td><td>5,000</td><td>300</td><td>6.0%</td></tr>
</tbody>
</table>
<p>B converts 20% better (5% → 6%). A two-proportion z-test gives a p-value of about <strong>0.028</strong>, so the result is significant at 95%. The 95% confidence interval for the difference runs from roughly +0.1 to +1.9 percentage points, so the true lift could be small or quite large, but probably isn’t zero. You can check these numbers in the <a href="/tools/ab-test-calculator/">A/B test calculator</a>.</p>
<p>Now halve the traffic: 2,500 visitors each, 125 vs 150 sign-ups. Same rates, same 20% lift, but the p-value rises to about 0.12. Not significant. With less data, luck can explain more.</p>

<h2>What significance does not mean</h2>
<ul>
<li><strong>It isn’t “95% chance B is better”.</strong> It’s about how surprising the data would be if there were no difference. Some tools also show a Bayesian “chance to beat”, which answers the question people actually ask; it’s a different number.</li>
<li><strong>It isn’t “the lift is 20%”.</strong> The measured lift is an estimate. Look at the confidence interval for the plausible range.</li>
<li><strong>It isn’t “this matters”.</strong> With huge traffic, a 0.1% lift can be significant and still not worth the engineering time. That’s <em>practical</em> significance, and only you can judge it.</li>
<li><strong>A non-significant result isn’t proof of no effect.</strong> It means the test couldn’t tell. Often the honest answer is “too small to see with this much traffic”.</li>
</ul>

<h2>Four mistakes that create fake winners</h2>
<ol class="steps-list">
<li><strong>Peeking and stopping early.</strong> If you check every day and stop the first time p dips below 0.05, the real false-positive rate climbs far above 5%. Decide the sample size up front with the <a href="/tools/sample-size-calculator/">sample size calculator</a> and wait for it.</li>
<li><strong>Running for less than a week.</strong> Weekday and weekend visitors behave differently. Run whole weeks so both versions see the same mix.</li>
<li><strong>Testing many things at once.</strong> Compare ten variants or twenty metrics and one will look significant by luck. Pick one primary metric before the test, and use a stricter bar (such as 99%) when comparing many variants.</li>
<li><strong>Underpowered tests.</strong> If your traffic can only detect a 40% lift, a real 10% improvement will usually look like “no difference”. Test bolder changes, or test where there’s more traffic.</li>
</ol>

<h2>How many visitors do you need?</h2>
<p>It depends on your current conversion rate and the smallest lift you care about. At a 3% conversion rate, detecting a 20% relative lift (3% → 3.6%) at 95% confidence and 80% power takes about 14,000 visitors per variant. Detecting a 10% lift takes roughly four times as many. The <a href="/tools/sample-size-calculator/">sample size calculator</a> turns that into days using your traffic.</p>

<h2>When you can’t split traffic</h2>
<p>Most small sites can’t run a proper A/B test for every change: there isn’t enough traffic, or the change ships to everyone. You can still check a before/after difference for significance. The <a href="/tools/did-it-work/">Did it work? checker</a> compares daily numbers, pairs the same weekdays to remove the weekend effect, and gives a plain verdict. The <a href="/guides/did-a-website-change-work/">guide to measuring a change</a> explains how to set it up fairly.</p>
`,
  faq: [
    ['What p-value is considered significant?', 'Below 0.05 is the common convention (95% confidence). Use 0.01 for expensive, hard-to-reverse decisions or when comparing many variants.'],
    ['Is 90% confidence good enough?', 'It can be, if you test often and accept more false winners in exchange for faster decisions. Be consistent: pick the level before the test.'],
    ['How long should an A/B test run?', 'Until it reaches the sample size you planned, in whole weeks, usually at least one or two full weeks.'],
    ['What is statistical power?', 'The chance your test detects a real effect of the size you planned for. 80% is the common target.'],
  ],
};
