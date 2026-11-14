export default {
  name: 'A/B Test Sample Size Calculator',
  title: 'A/B Test Sample Size & Duration Calculator (Free) | Kauzl',
  description: 'How many visitors does your A/B test need, and how many days will it take? Enter your conversion rate, the smallest lift you care about and your daily traffic.',
  blurb: 'How many visitors and how many days your test needs before you can trust it.',
  related: ['ab-test-calculator', 'did-it-work', 'utm-builder'],
  h1: 'A/B test sample size calculator',
  intro: 'Work out how many visitors each variant needs, and how long to run the test, before you start. Then you won’t stop too early.',
  script: 'sample-size.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Your test</h2>
    <label class="field"><span>Current conversion rate (%)</span><input type="number" step="0.1" min="0.01" max="99" name="baseline" value="3"><small>What the page converts at today.</small></label>
    <label class="field"><span>Smallest lift worth detecting (%)</span><input type="number" step="1" min="1" name="mde" value="20"><small>Relative: 20% means 3% → 3.6%. Smaller lifts need far more visitors.</small></label>
    <div class="row">
      <label class="field"><span>Variants incl. control</span><input type="number" min="2" max="10" name="variants" value="2"></label>
      <label class="field"><span>Daily visitors to the page</span><input type="number" min="1" name="daily" value="1000"></label>
    </div>
    <div class="row">
      <label class="field"><span>Confidence</span><select name="confidence"><option value="0.9">90%</option><option value="0.95" selected>95%</option><option value="0.99">99%</option></select></label>
      <label class="field"><span>Power</span><select name="power"><option value="0.8" selected>80%</option><option value="0.9">90%</option></select></label>
    </div>
  </form>
  <div class="panel sticky" aria-live="polite"><h2>You need</h2><div id="out"></div></div>
</div>`,
  content: `
<h2>What the inputs mean</h2>
<ul>
<li><strong>Conversion rate</strong>: the share of visitors who do the thing you’re testing for today.</li>
<li><strong>Minimum detectable effect (MDE)</strong>: the smallest relative improvement you’d act on. If a 5% lift wouldn’t change your decision, don’t size the test for it.</li>
<li><strong>Confidence</strong>: how sure you want to be that a winner isn’t luck. 95% is standard.</li>
<li><strong>Power</strong>: the chance the test catches a real lift of your MDE size. 80% is standard; 90% is safer but needs more visitors.</li>
</ul>
<h2>Low traffic? Change what you test</h2>
<p>If the test would take months, test bigger changes (a new offer or page, not a button colour), test higher up the funnel where there are more conversions, or ship the change and compare <a href="../did-it-work/">before and after</a>. A before/after check is weaker than a split test, but far better than guessing.</p>
<p>The formula is the standard two-sided test for two proportions, as used by Optimizely, Evan Miller’s calculator and most stats textbooks.</p>`,
  faq: [
    ['Why does a smaller lift need so many more visitors?', 'Sample size grows with the square of 1 ÷ the difference. Halving the lift you want to detect roughly quadruples the visitors you need.'],
    ['Should I stop the test once it’s significant?', 'No. Run until you reach the sample size, in whole weeks. Stopping at the first green result makes false winners much more likely.'],
    ['Does the number include all variants?', 'The calculator shows visitors per variant and the total across all variants, and turns the total into days using your daily traffic.'],
  ],
};
