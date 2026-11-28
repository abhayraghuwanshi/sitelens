// Targets: "plausible alternatives", "plausible analytics alternative", "fathom vs
// plausible", "umami vs plausible". Bing shows little volume for these (developer
// audience searches Google); high intent. Head-to-head lives in kauzl-vs-plausible.
export default {
  order: 4.12,
  kicker: 'Compare',
  short: 'Plausible alternatives',
  title: 'Plausible Alternatives: 7 Privacy-First Options | Kauzl',
  h1: 'Plausible alternatives: seven privacy-first analytics tools compared',
  description: 'Fathom, Umami, Simple Analytics, Cloudflare Web Analytics, Matomo, Pirsch and GoatCounter compared with Plausible: hosting, licence and who each suits.',
  blurb: 'Seven cookieless analytics tools next to Plausible, and which kind of site each one suits.',
  lead: 'We make Kauzl, which reads analytics rather than collecting it, so it isn’t on this list as a replacement. Plausible is a good tool; people look elsewhere for a free tier, a different licence, self-hosting with less upkeep, or more detail. Here’s where each alternative fits.',
  published: '2026-11-28',
  tools: ['utm-builder', 'did-it-work', 'ai-crawler-log-analyzer'],
  inShort: [
    '<strong>Free and hosted for you:</strong> Cloudflare Web Analytics. <strong>Free if you host it:</strong> Umami, Matomo, GoatCounter, and Plausible’s own Community Edition.',
    '<strong>Paid and closest to Plausible:</strong> Fathom and Simple Analytics, both cookieless with a single-page dashboard.',
    '<strong>More detail than Plausible:</strong> Matomo, which can do almost everything Google Analytics does, self-hosted or in its cloud.',
    'All of these can run <strong>without cookies</strong>; check each one’s data location and your own legal advice for consent rules where you are.',
    'Whatever you pick, export your old numbers first so the history doesn’t start from zero.',
  ],
  body: `
<h2>Why people look past Plausible</h2>
<p>Plausible counts visits without cookies, keeps data in the EU, and fits on one screen. The usual reasons to look elsewhere are: wanting a <strong>free</strong> hosted option, preferring a <strong>different licence</strong> (Plausible is AGPL), wanting <strong>less upkeep</strong> when self-hosting, or needing <strong>more detail</strong> such as funnels, heatmaps or e-commerce reports.</p>

<h2>The seven alternatives, side by side</h2>
<table>
<thead><tr><th>Tool</th><th>Hosting</th><th>Open source</th><th>Best for</th></tr></thead>
<tbody>
<tr><td>Fathom</td><td>Their cloud</td><td>No</td><td>A Plausible-like dashboard from a long-running company, with EU data isolation</td></tr>
<tr><td>Umami</td><td>Self-host or Umami Cloud</td><td>Yes (MIT)</td><td>Developers who want a light, permissively licensed self-hosted tool</td></tr>
<tr><td>Simple Analytics</td><td>Their cloud (EU)</td><td>No</td><td>EU teams who want privacy-first analytics with a strong compliance story</td></tr>
<tr><td>Cloudflare Web Analytics</td><td>Cloudflare</td><td>No</td><td>Free, basic visit counts, especially for sites already on Cloudflare</td></tr>
<tr><td>Matomo</td><td>Self-host or Matomo Cloud</td><td>Yes (GPL)</td><td>Teams who want Google Analytics–level detail without Google</td></tr>
<tr><td>Pirsch</td><td>Their cloud (Germany)</td><td>Partly</td><td>Cookieless analytics with a server-side option, so ad blockers don’t hide visits</td></tr>
<tr><td>GoatCounter</td><td>Self-host or hosted</td><td>Yes (EUPL)</td><td>Personal sites and small projects; hosted use is free for non-commercial sites</td></tr>
</tbody>
</table>
<p>Features and plans change; check each tool’s own site before deciding. For self-hosted tools with GitHub numbers, see <a href="/guides/open-source-web-analytics/">open-source web analytics compared</a>.</p>

<h2>Which one to pick</h2>
<ul>
<li><strong>You want it free and hosted:</strong> Cloudflare Web Analytics. You get visits, pages, referrers and countries; no goals or funnels to speak of.</li>
<li><strong>You want free and don’t mind a server:</strong> Umami for the lightest setup, Plausible Community Edition to keep Plausible’s interface, Matomo for the most features.</li>
<li><strong>You want Plausible’s simplicity from another vendor:</strong> Fathom or Simple Analytics.</li>
<li><strong>You need funnels, e-commerce or heatmaps:</strong> Matomo, or keep GA4 and add product analytics (<a href="/guides/product-analytics-tools/">PostHog, Mixpanel and Amplitude compared</a>).</li>
<li><strong>Ad blockers hide too many visits:</strong> a tool with a server-side or proxied script, such as Pirsch, or proxying your current script through your own domain.</li>
</ul>

<h2>Switching without losing your history</h2>
<p>None of these imports another tool’s history perfectly. Export Plausible’s CSVs before you cancel, run the new tool alongside the old one for two to four weeks, and note the switch date: numbers always shift a little, because each tool counts sessions and filters bots differently.</p>
<p>If you’d rather not choose one view, Kauzl reads Plausible, Cloudflare Web Analytics, PostHog and Google Analytics side by side, on one calendar with your Search Console data and releases. It doesn’t collect visits itself.</p>
`,
  faq: [
    ['What is the best free alternative to Plausible?', 'Cloudflare Web Analytics is the best free hosted alternative to Plausible for basic visit counts. For free self-hosting, Umami, Matomo, GoatCounter and Plausible Community Edition are all options.'],
    ['Is Fathom better than Plausible?', 'Fathom and Plausible are very similar: both are cookieless, privacy-first and simple. Plausible is open source and EU-hosted; Fathom is closed source with EU data isolation. Pick on interface and features you need.'],
    ['Umami or Plausible: which should I self-host?', 'Umami is lighter to self-host and MIT-licensed. Plausible Community Edition has the familiar Plausible interface but needs more resources and is AGPL-licensed. Both run without cookies.'],
    ['Do privacy-first analytics tools need a cookie banner?', 'Privacy-first tools that set no cookies and store no personal data often don’t need a consent banner in many places, but rules differ by country. Check each tool’s documentation and your own legal advice.'],
  ],
};
