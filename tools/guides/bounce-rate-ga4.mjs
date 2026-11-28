// Targets: "bounce rate" (~270/week on Bing US), "what is bounce rate" (~200),
// "engagement rate formula" (~180), "how to calculate engagement rate" (~170),
// "engagement rate" (Nov 2026). GA4-specific definitions; no social-media angle.
export default {
  order: 2.4,
  kicker: 'Google Analytics 4',
  short: 'Bounce rate vs engagement rate',
  title: 'Bounce Rate vs Engagement Rate in GA4 | Kauzl',
  h1: 'Bounce rate vs engagement rate in GA4, explained',
  description: 'How GA4 defines bounce rate and engagement rate, the formulas, what counts as an engaged session, how to add bounce rate to reports, and what’s good.',
  blurb: 'The two formulas, what makes a session “engaged”, and how to show bounce rate in GA4.',
  lead: 'In Google Analytics 4, bounce rate is simply the share of sessions that were not engaged, so bounce rate and engagement rate always add up to 100%. A session counts as engaged if it lasts over 10 seconds, has a key event, or views two or more pages.',
  published: '2026-11-28',
  tools: ['did-it-work', 'utm-builder', 'ab-test-calculator'],
  inShort: [
    '<strong>Engagement rate</strong> = engaged sessions ÷ all sessions. <strong>Bounce rate</strong> = 100% − engagement rate.',
    'A session is <strong>engaged</strong> if it lasts longer than 10 seconds, includes a key event, or has 2 or more page or screen views.',
    'This is <strong>not</strong> Universal Analytics’ bounce rate, which counted single-page sessions. A visitor who reads one page for two minutes was a bounce then and is engaged now.',
    'Bounce rate isn’t in GA4’s default reports. Add it with <strong>Customize report → Metrics</strong>, or use it in an Exploration.',
    'There’s no universal “good” rate. Compare a page with itself over time, and with pages of the same kind.',
  ],
  body: `
<h2>The two formulas</h2>
<table>
<thead><tr><th>Metric</th><th>Formula</th><th>Example</th></tr></thead>
<tbody>
<tr><td>Engagement rate</td><td>Engaged sessions ÷ sessions</td><td>620 ÷ 1,000 = 62%</td></tr>
<tr><td>Bounce rate</td><td>(Sessions − engaged sessions) ÷ sessions</td><td>380 ÷ 1,000 = 38%</td></tr>
</tbody>
</table>
<p>The two are mirror images: whatever one goes up by, the other goes down by. Pick one to report, and say which.</p>

<h2>What counts as an engaged session</h2>
<p>GA4 marks a session engaged when <strong>any one</strong> of these is true:</p>
<ul>
<li>it lasted <strong>longer than 10 seconds</strong> with the page in view,</li>
<li>it included a <strong>key event</strong> (what GA4 used to call a conversion), or</li>
<li>it had <strong>2 or more page or screen views</strong>.</li>
</ul>
<p>The 10-second timer can be raised to as much as 60 seconds: <strong>Admin → Data streams → your web stream → Configure tag settings → Show more → Adjust session timeout → Adjust timer for engaged sessions</strong>. A higher timer means a stricter definition and a higher bounce rate; note the date you change it, because the numbers will jump that day.</p>

<h2>Why GA4’s bounce rate differs from the old one</h2>
<p>Universal Analytics, retired in 2023, counted a bounce as any session with a single page and no other interaction, however long it lasted. On a blog, someone could read a whole article and leave satisfied, and still be a bounce.</p>
<p>GA4 counts that reader as engaged, because they stayed more than 10 seconds. So GA4 bounce rates are usually much lower than old Universal Analytics ones for the same site. Don’t compare the two directly.</p>

<h2>How to see bounce rate in GA4</h2>
<ol class="steps-list">
<li>Open <strong>Reports → Engagement → Pages and screens</strong> (or any detail report).</li>
<li>Click the <strong>pencil icon</strong> (Customize report) at the top right.</li>
<li>Choose <strong>Metrics → Add metric</strong>, search for <em>Bounce rate</em>, add it, and click <strong>Apply</strong>.</li>
<li><strong>Save</strong> the report, either changing it or saving as a new one. Editing reports needs Editor access.</li>
</ol>
<p>In <strong>Explore</strong>, add <em>Bounce rate</em> and <em>Engagement rate</em> as metrics in any free-form exploration, broken down by landing page or session source.</p>

<h2>What’s a good bounce rate?</h2>
<p>It depends on what the page is for. A contact page that people read and leave, or a docs page that answers one question, will bounce more than a pricing page that leads to sign-up. Rather than chase a benchmark:</p>
<ul>
<li><strong>Compare a page with itself</strong> before and after a change (<a href="/guides/did-a-website-change-work/">how to tell if a change worked</a>).</li>
<li><strong>Compare by traffic source.</strong> A jump in bounce rate is often a new source, such as a social post or bots, not a worse page.</li>
<li><strong>Look at key events, not just bounce.</strong> A page that bounces at 70% but sends the other 30% to sign-up is doing its job.</li>
</ul>
`,
  goal: [
    'Know how GA4 calculates bounce rate and engagement rate.',
    'Add bounce rate to a GA4 report.',
    'Compare bounce rate by page and source, not against a benchmark.',
  ],
  steps: [
    { text: 'Open Pages and screens, customize the report and add the Bounce rate metric.', href: 'https://analytics.google.com' },
    { text: 'Sort landing pages by sessions and note the bounce rate of your top five.' },
    { text: 'Break a high one down by session source to see if one source drives it.' },
  ],
  check: [
    { q: 'A visitor reads one page for 90 seconds and leaves. Is that a bounce in GA4?', options: ['No, it’s an engaged session', 'Yes, one page is a bounce', 'It isn’t counted', 'It’s a key event'], answer: 0, why: 'Over 10 seconds makes a session engaged, so it isn’t a bounce in GA4.' },
    { q: 'If engagement rate is 58%, what is bounce rate?', options: ['42%', '58%', '100%', 'It can’t be worked out'], answer: 0, why: 'In GA4 bounce rate is 100% minus engagement rate.' },
  ],
  faq: [
    ['What is bounce rate in GA4?', 'Bounce rate in GA4 is the percentage of sessions that were not engaged. It equals 100% minus the engagement rate.'],
    ['How is engagement rate calculated in GA4?', 'Engagement rate in GA4 is engaged sessions divided by all sessions. A session is engaged if it lasts over 10 seconds, has a key event, or has two or more page or screen views.'],
    ['Why is my GA4 bounce rate lower than in Universal Analytics?', 'GA4 bounce rates are lower because a single-page visit that lasts more than 10 seconds now counts as engaged. Universal Analytics counted every single-page session as a bounce.'],
    ['Can I change what counts as an engaged session?', 'GA4 lets you raise the engaged-session timer from 10 seconds to as much as 60 seconds in the web stream’s tag settings. The other two conditions, a key event or two page views, can’t be changed.'],
    ['What is a good bounce rate?', 'A good bounce rate depends on the page’s purpose and traffic source. Compare a page with its own past and with similar pages, and judge it by the key events it leads to.'],
  ],
};
