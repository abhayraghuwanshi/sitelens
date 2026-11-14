export default {
  name: 'A/B Test Significance Calculator',
  title: 'A/B Test Significance Calculator: Free, Instant p-value & Uplift | Kauzl',
  description: 'Enter visitors and conversions for A and B. Get the conversion rates, uplift, p-value, confidence interval and chance that B beats A, with a plain-English answer.',
  blurb: 'Is variant B really better? Uplift, p-value and the chance B beats A.',
  related: ['sample-size-calculator', 'did-it-work', 'utm-builder'],
  h1: 'A/B test significance calculator',
  intro: 'Find out whether your winning variant actually won, or whether the gap could just be luck.',
  script: 'ab-calculator.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Results so far</h2>
    <h3 style="margin-top:0">A · control</h3>
    <div class="row">
      <label class="field"><span>Visitors</span><input type="number" min="0" name="visitorsA" value="5000"></label>
      <label class="field"><span>Conversions</span><input type="number" min="0" name="conversionsA" value="250"></label>
    </div>
    <h3>B · variant</h3>
    <div class="row">
      <label class="field"><span>Visitors</span><input type="number" min="0" name="visitorsB" value="5000"></label>
      <label class="field"><span>Conversions</span><input type="number" min="0" name="conversionsB" value="300"></label>
    </div>
    <label class="field"><span>Confidence level</span>
      <select name="confidence"><option value="0.9">90%</option><option value="0.95" selected>95% (standard)</option><option value="0.99">99%</option></select></label>
  </form>
  <div class="panel sticky" aria-live="polite"><h2>Result</h2><div id="out"></div></div>
</div>`,
  content: `
<h2>Reading the result</h2>
<ul>
<li><strong>Uplift</strong> is how much better (or worse) B converts, relative to A. Going from 5% to 6% is a 20% uplift.</li>
<li><strong>p-value</strong> is the chance of seeing a gap at least this big if A and B were really the same. Under 0.05 is the usual bar for “significant” at 95% confidence.</li>
<li><strong>Confidence interval</strong> is the range the true difference probably sits in. If it crosses zero, you can’t rule out that B is no better.</li>
<li><strong>Chance B beats A</strong> is an easier-to-read version: how likely it is that B’s true rate is higher.</li>
</ul>
<h2>Common A/B testing mistakes</h2>
<ul>
<li><strong>Stopping as soon as it turns green.</strong> Checking every day and stopping at the first significant result inflates false positives a lot. Decide your sample size up front with the <a href="../sample-size-calculator/">sample size calculator</a> and wait for it.</li>
<li><strong>Running for less than a week.</strong> Weekday and weekend visitors behave differently. Run whole weeks.</li>
<li><strong>Testing tiny changes on tiny traffic.</strong> With 500 visitors a week, only big differences are detectable.</li>
<li><strong>Counting the wrong conversion.</strong> A button click is easy to move; sign-ups and revenue are what matter.</li>
</ul>
<p>The calculator uses a two-sided two-proportion z-test, the same method as most testing tools.</p>`,
  faq: [
    ['What confidence level should I use?', '95% is the standard. Use 90% if you test often and can live with more false wins, or 99% for expensive, hard-to-reverse changes.'],
    ['My result is not significant. Did B lose?', 'Not necessarily. It means the test can’t tell A and B apart yet. Either the difference is small or you need more visitors.'],
    ['Can I compare more than two variants?', 'Compare each variant against the control one at a time, and use a stricter confidence level (for example 99%) to make up for the extra comparisons.'],
    ['I can’t run a split test. What can I do?', 'If you’ve shipped the change to everyone, compare daily numbers before and after with the <a href="../did-it-work/">Did it work? checker</a>.'],
  ],
};
