// From the Gap Map research (Mixpanel, Amplitude, PostHog vs GA4) plus general
// product knowledge. Targets "product analytics tools", "posthog vs mixpanel",
// "mixpanel vs amplitude", "product analytics vs web analytics". No prices
// (Compare rule). Keep claims about plans generic: they change.
export default {
  order: 6.2,
  kicker: 'Compare',
  short: 'Product analytics: PostHog, Mixpanel, Amplitude',
  title: 'PostHog vs Mixpanel vs Amplitude vs GA4 | Kauzl',
  h1: 'Product analytics for your app: PostHog vs Mixpanel vs Amplitude (and when GA4 is enough)',
  description: 'When an app needs product analytics, what funnels, retention and cohorts tell you, and how PostHog, Mixpanel and Amplitude differ.',
  blurb: 'Funnels, retention and cohorts, and how PostHog, Mixpanel and Amplitude differ.',
  lead: 'Web analytics tells you who arrived. Product analytics tells you what signed-up users do next, and whether they come back. Here is when you need it, and how the three main tools differ. We make Kauzl, which reads web analytics, not in-app events.',
  published: '2026-11-22',
  tools: ['ab-test-calculator', 'sample-size-calculator'],
  inShort: [
    'You need product analytics once you have <strong>accounts or an installed app</strong>, and your questions turn to “do people use the feature?” and “do they come back?”.',
    'The three core reports: <strong>funnels</strong> (where people drop out of a flow), <strong>retention</strong> (who returns, week by week) and <strong>cohorts</strong> (how one group behaves compared with another).',
    '<strong>PostHog</strong> bundles product analytics with session replay, feature flags and experiments. <strong>Mixpanel</strong> is the classic, fast event explorer. <strong>Amplitude</strong> is built for larger product teams.',
    'For a small app, <strong>GA4 with a few key events</strong> can cover funnels to start with. Move up when you need per-user history and retention.',
  ],
  body: `
<h2>Web analytics vs product analytics</h2>
<table>
<thead><tr><th></th><th>Web analytics (GA4, Plausible)</th><th>Product analytics (PostHog, Mixpanel, Amplitude)</th></tr></thead>
<tbody>
<tr><td>Unit</td><td>Sessions and page views</td><td>Users and the events they trigger</td></tr>
<tr><td>Main question</td><td>Where did visitors come from?</td><td>What do users do, and do they stay?</td></tr>
<tr><td>Typical report</td><td>Traffic by channel and landing page</td><td>Funnels, retention curves, cohorts</td></tr>
<tr><td>Who is tracked</td><td>Mostly anonymous visitors</td><td>Identified users, linked across devices after login</td></tr>
<tr><td>Set-up work</td><td>One script</td><td>An event plan: names and properties for every action that matters</td></tr>
</tbody>
</table>

<h2>The three reports that matter</h2>
<ol class="steps-list">
<li><strong>Funnel:</strong> the share of people who get from step 1 to step N, such as sign-up → create project → invite teammate. It shows exactly where people drop out.</li>
<li><strong>Retention:</strong> of the people who started in a given week, how many came back in week 1, 2, 3 and so on. A curve that flattens means you’ve found users who stay; one that falls to zero doesn’t.</li>
<li><strong>Cohort comparison:</strong> the same report for two groups, such as users who tried feature X and those who didn’t, or sign-ups before and after a release.</li>
</ol>

<h2>PostHog, Mixpanel and Amplitude compared</h2>
<table>
<thead><tr><th></th><th>PostHog</th><th>Mixpanel</th><th>Amplitude</th></tr></thead>
<tbody>
<tr><td>Best for</td><td>Startups and engineers who want one tool</td><td>Teams that live in event reports</td><td>Larger product and growth teams</td></tr>
<tr><td>Beyond analytics</td><td>Session replay, feature flags, experiments, surveys</td><td>Mainly analytics; some replay and experiments</td><td>Experiments, a customer data platform, guides</td></tr>
<tr><td>Open source</td><td>Yes, MIT core; can be self-hosted</td><td>No</td><td>No</td></tr>
<tr><td>Free tier</td><td>Yes, usage-based</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Strength</td><td>Everything in one place, close to the code</td><td>Fast, flexible event exploration</td><td>Depth for big organisations</td></tr>
<tr><td>Watch out for</td><td>Many products to learn at once</td><td>Fewer extras, so you may add replay elsewhere</td><td>More set-up than a small team needs</td></tr>
</tbody>
</table>
<p>All three change plans and limits often. Check current pricing on their sites before you commit (as of November 2026).</p>

<h2>When GA4 is enough</h2>
<p>If your app has a handful of key actions, GA4 can carry you a long way. Send events such as <code>sign_up</code>, <code>create_project</code> and <code>purchase</code>, mark them as key events, and use a funnel exploration. You lose per-user history and easy retention curves, which is the point at which a product analytics tool pays for itself. <a href="/guides/google-analytics-4-setup/">Lesson 2</a> covers the GA4 events to set up first.</p>

<h2>Plan your events before you pick a tool</h2>
<ul>
<li><strong>Name events as verb_object</strong>, past tense or not but consistent: <code>project_created</code>, <code>invite_sent</code>.</li>
<li><strong>Track 10–20 events that matter,</strong> not every click. You can add more later; cleaning up hundreds of vague events is painful.</li>
<li><strong>Add the properties you’ll filter by:</strong> plan, platform, source.</li>
<li><strong>Call identify on login,</strong> so the same person on phone and laptop counts once.</li>
</ul>
<p>When you change the product, compare before and after against normal swings, not just the raw numbers. The <a href="/tools/ab-test-calculator/">A/B test calculator</a> and <a href="/guides/statistical-significance-ab-testing/">lesson 14</a> show how.</p>
`,
  faq: [
    ['What is product analytics?', 'Product analytics measures what users do inside an app or website after they sign up: which features they use, where they drop out of key flows, and whether they come back. PostHog, Mixpanel and Amplitude are the best-known tools.'],
    ['Is PostHog better than Mixpanel?', 'PostHog suits teams that want analytics, session replay, feature flags and experiments in one open-source tool. Mixpanel suits teams that mainly want fast, flexible event reports. Both have free tiers.'],
    ['Can Google Analytics do product analytics?', 'Google Analytics 4 can track events and build funnels, which covers a small app at first. It is weaker at per-user history, retention curves and cohorts, where PostHog, Mixpanel or Amplitude do better.'],
    ['How many events should I track?', 'Ten to twenty well-named events covering the actions that matter (sign-up, activation, the core feature, payment) is a good start. Tracking every click makes reports noisy and hard to trust.'],
  ],
};
