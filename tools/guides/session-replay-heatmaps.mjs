// From the Gap Map research (Clarity free, Hotjar, PostHog replay). Targets
// "microsoft clarity" (~5.7k/4wk Bing US), "what is microsoft clarity",
// "heatmaps", "microsoft clarity vs hotjar", "hotjar alternative". No prices
// (Compare rule). Clarity is free; say that without amounts.
export default {
  order: 6.4,
  kicker: 'Compare',
  short: 'Session replay: Clarity vs Hotjar vs PostHog',
  title: 'Microsoft Clarity vs Hotjar vs PostHog | Kauzl',
  h1: 'Session replay and heatmaps: Microsoft Clarity vs Hotjar vs PostHog',
  description: 'What session recordings and heatmaps show that GA4 can’t, how Microsoft Clarity, Hotjar and PostHog compare, and how to watch them without wasting a day.',
  blurb: 'What recordings and heatmaps show that GA4 can’t, and which tool to use.',
  lead: 'GA4 can tell you that 80% of visitors left your pricing page. A session recording shows you what they saw before they left. Here’s when that’s worth it, and how the three main tools compare. We make Kauzl, which doesn’t record sessions.',
  published: '2026-11-22',
  tools: ['did-it-work'],
  inShort: [
    '<strong>Session replay</strong> rebuilds a visitor’s screen, clicks and scrolls as a video. <strong>Heatmaps</strong> add up clicks and scroll depth across everyone who saw a page.',
    '<strong>Microsoft Clarity</strong> is free and does both well. It’s the obvious place to start.',
    '<strong>Hotjar</strong> adds surveys and feedback widgets beside recordings. <strong>PostHog</strong> ties recordings to product analytics and feature flags.',
    'Watch recordings with one question in mind, on one page, filtered to the visitors you care about. Ten targeted recordings beat an afternoon of random ones.',
  ],
  body: `
<h2>What replay shows that numbers can’t</h2>
<ul>
<li><strong>Rage clicks:</strong> repeated clicks on something that isn’t a button, or a button that doesn’t respond.</li>
<li><strong>Dead ends:</strong> people scrolling up and down looking for a price, a download link or the next step.</li>
<li><strong>Broken layouts:</strong> a form hidden behind a cookie banner on one phone size, which no test caught.</li>
<li><strong>Hesitation:</strong> the cursor hovering over the plan picker for 20 seconds, then leaving.</li>
</ul>
<p>Heatmaps answer the quieter questions: how far down people scroll, and what they click that you didn’t mean to be clickable.</p>

<h2>Clarity, Hotjar and PostHog compared</h2>
<table>
<thead><tr><th></th><th>Microsoft Clarity</th><th>Hotjar</th><th>PostHog</th></tr></thead>
<tbody>
<tr><td>Recordings and heatmaps</td><td>Yes</td><td>Yes</td><td>Recordings, plus heatmaps</td></tr>
<tr><td>Cost</td><td>Free</td><td>Free plan, then paid tiers</td><td>Free tier, then usage-based</td></tr>
<tr><td>Extras</td><td>Rage-click and dead-click detection, GA4 integration, AI summaries of sessions</td><td>On-page surveys, feedback widget, user interviews</td><td>Product analytics, feature flags, experiments, surveys</td></tr>
<tr><td>Best for</td><td>Anyone starting out; marketing sites</td><td>Teams who also want to ask visitors why</td><td>Apps that want replay tied to user events</td></tr>
<tr><td>Open source</td><td>No</td><td>No</td><td>Yes, MIT core</td></tr>
</tbody>
</table>
<p>Hotjar is now part of Contentsquare, which also sells enterprise experience analytics. Check each tool’s current limits on its own site before relying on them (as of November 2026).</p>

<h2>How to watch recordings without wasting a day</h2>
<ol class="steps-list">
<li><strong>Pick one page and one question,</strong> such as “why do mobile visitors leave the pricing page?”.</li>
<li><strong>Filter hard:</strong> that page, that device, sessions that didn’t convert, longer than 10 seconds.</li>
<li><strong>Watch ten,</strong> at double speed, and note what you see in a list. Patterns show up by the fifth or sixth.</li>
<li><strong>Fix the most common one,</strong> then check the page’s numbers before and after against normal swings with the <a href="/tools/did-it-work/">Did it work? checker</a>.</li>
</ol>

<h2>Privacy and performance</h2>
<ul>
<li><strong>Masking:</strong> all three mask text typed into form fields by default. Check that sensitive areas, such as account pages, are masked too.</li>
<li><strong>Consent:</strong> recordings usually count as tracking. In the EU and UK they need consent like other analytics cookies.</li>
<li><strong>Page speed:</strong> the scripts are light but not free. Load them after the page is interactive, and don’t record pages you’ll never review.</li>
</ul>
`,
  faq: [
    ['What is Microsoft Clarity?', 'Microsoft Clarity is a free tool from Microsoft that records visitor sessions and builds heatmaps of clicks and scrolling. It also flags rage clicks and dead clicks, and can connect to Google Analytics 4.'],
    ['Is Microsoft Clarity really free?', 'Microsoft Clarity is free to use, with no paid tier for its core recordings and heatmaps. Read its terms and data-handling page before adding it to a site with strict privacy needs.'],
    ['Is Hotjar better than Clarity?', 'Hotjar adds on-page surveys and feedback tools that Clarity lacks, so it suits teams who want to ask visitors why. For recordings and heatmaps alone, Clarity does the job for free.'],
    ['Does session recording slow down my site?', 'Session recording scripts add a small amount of JavaScript and network traffic. Loading them after the page becomes interactive, and only on pages you review, keeps the effect small.'],
  ],
};
