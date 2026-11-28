// Targets: "hotjar alternatives", "free hotjar alternative", "hotjar alternative
// open source". Bing shows little volume (Nov 2026); high intent on Google. The
// three-way deep dive lives in session-replay-heatmaps; this is the wider list.
export default {
  order: 4.32,
  kicker: 'Compare',
  short: 'Hotjar alternatives',
  title: 'Hotjar Alternatives: Free and Paid Options | Kauzl',
  h1: 'Hotjar alternatives: heatmaps and session replay, free and paid',
  description: 'Microsoft Clarity, PostHog, FullStory, Mouseflow, Smartlook, Lucky Orange and LogRocket compared with Hotjar: what each records and who it’s for.',
  blurb: 'Seven tools that record sessions or draw heatmaps, grouped by who they suit.',
  lead: 'We make Kauzl, which doesn’t record sessions, so it isn’t a Hotjar replacement. Hotjar is the best-known tool for heatmaps, recordings and on-site surveys. The alternatives split into free tools, developer tools and enterprise suites.',
  published: '2026-11-28',
  tools: ['ab-test-calculator', 'did-it-work', 'sample-size-calculator'],
  inShort: [
    '<strong>Free:</strong> Microsoft Clarity gives heatmaps and session recordings at no cost, and connects to GA4.',
    '<strong>For developers:</strong> PostHog bundles replay with product analytics and feature flags; LogRocket ties replays to errors and performance.',
    '<strong>Closest like-for-like:</strong> Mouseflow, Smartlook and Lucky Orange, with heatmaps, recordings, funnels and forms.',
    '<strong>Enterprise:</strong> FullStory, for large teams that want search across every session.',
    'Whichever you pick, mask form fields and personal data, and add it to your consent setup where required.',
  ],
  body: `
<h2>Why people look past Hotjar</h2>
<p>Hotjar combines heatmaps, session recordings, surveys and feedback widgets. Teams look elsewhere when they want recordings <strong>free</strong>, want replay <strong>joined to product analytics or error tracking</strong>, or need <strong>more sessions</strong> than their plan keeps.</p>

<h2>Seven alternatives, side by side</h2>
<table>
<thead><tr><th>Tool</th><th>Heatmaps</th><th>Recordings</th><th>Best for</th></tr></thead>
<tbody>
<tr><td>Microsoft Clarity</td><td>Yes</td><td>Yes</td><td>Anyone who wants heatmaps and replay for free, with GA4 integration</td></tr>
<tr><td>PostHog</td><td>Yes</td><td>Yes</td><td>Product teams who want replay next to funnels, flags and experiments; open source</td></tr>
<tr><td>LogRocket</td><td>Limited</td><td>Yes</td><td>Developers debugging front-end errors and slow pages from real sessions</td></tr>
<tr><td>Mouseflow</td><td>Yes</td><td>Yes</td><td>Marketing teams wanting Hotjar-style tools plus funnels and form analytics</td></tr>
<tr><td>Smartlook</td><td>Yes</td><td>Yes</td><td>Websites and mobile apps recorded in one tool</td></tr>
<tr><td>Lucky Orange</td><td>Yes</td><td>Yes</td><td>Small businesses wanting recordings with live chat</td></tr>
<tr><td>FullStory</td><td>Yes</td><td>Yes</td><td>Large teams that need to search and segment every session</td></tr>
</tbody>
</table>
<p>Plans and limits change; check each tool’s own site. For a deeper look at the three most used, read <a href="/guides/session-replay-heatmaps/">Clarity vs Hotjar vs PostHog</a>.</p>

<h2>Which one to pick</h2>
<ul>
<li><strong>Just want to watch what people do, free:</strong> Microsoft Clarity.</li>
<li><strong>Building a product and already need analytics:</strong> PostHog, so replays sit next to funnels and you run one script, not two.</li>
<li><strong>Chasing bugs:</strong> LogRocket, or PostHog with its error tracking.</li>
<li><strong>Need on-site surveys too:</strong> stay with Hotjar, or pair Clarity with a separate survey tool.</li>
</ul>

<h2>Before you add a recording script</h2>
<ul>
<li><strong>Privacy:</strong> mask inputs and any text that could hold personal data, and keep recordings off account and payment pages unless you need them.</li>
<li><strong>Consent:</strong> session recording usually needs consent under GDPR-style rules; load the script through your consent tool.</li>
<li><strong>Speed:</strong> recording scripts add weight; check your page speed before and after.</li>
<li><strong>A question first:</strong> pick one page and one question (“why do people leave pricing?”) before watching, or you’ll spend a day on recordings. Use your analytics to find that page; Kauzl’s calendar shows which day and page a drop started.</li>
</ul>
`,
  faq: [
    ['What is the best free alternative to Hotjar?', 'Microsoft Clarity is the best-known free alternative to Hotjar. Clarity provides heatmaps and session recordings at no cost and can be connected to Google Analytics 4.'],
    ['Is there an open-source Hotjar alternative?', 'PostHog is an open-source alternative to Hotjar that includes session replay and heatmaps alongside product analytics, and it can be self-hosted or used in PostHog’s cloud.'],
    ['Is Microsoft Clarity as good as Hotjar?', 'Microsoft Clarity covers Hotjar’s core heatmaps and recordings for free. Hotjar adds on-site surveys and feedback widgets, which Clarity does not focus on.'],
    ['Do session recording tools need cookie consent?', 'Session recording tools usually need consent under GDPR and similar laws, because they collect detailed behaviour. Load them through your consent tool and mask personal data.'],
  ],
};
