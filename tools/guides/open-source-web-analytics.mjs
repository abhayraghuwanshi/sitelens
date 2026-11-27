// From our research doc "Open-source SEO and analytics tools compared":
// stars, licences and languages from the GitHub API on 2026-11-20. Update the
// date and `updated` when refreshing numbers. Targets "open source web
// analytics", "umami analytics", "plausible vs umami", "self-hosted google
// analytics alternative". No prices (Compare rule).
export default {
  order: 6,
  kicker: 'Compare',
  short: 'Open-source web analytics compared',
  title: 'Open-Source Web Analytics Compared (2026) | Kauzl',
  h1: 'Open-source web analytics compared: Umami, Plausible, Matomo, PostHog and more',
  description: 'Twelve open-source analytics tools side by side: GitHub stars, licence, language and what each is for, so you can self-host the right one.',
  blurb: 'Twelve self-hostable analytics tools: stars, licence and what each is for.',
  lead: 'Open-source analytics lets you own your data and skip the cookie banner, but the tools differ more than their landing pages suggest. Here are twelve, with the numbers from GitHub. We make Kauzl, which reads analytics rather than collecting it, and isn’t in the list.',
  published: '2026-11-22',
  updated: '2026-11-28',
  tools: ['did-it-work', 'utm-builder'],
  inShort: [
    'For <strong>simple, private website stats</strong>: Umami (MIT) or Plausible (AGPL). Both are cookie-free and easy to self-host.',
    'For <strong>Google Analytics-level depth you own</strong>: Matomo (GPL), the most complete self-hosted alternative.',
    'For <strong>apps</strong> (funnels, session replay, feature flags): PostHog, whose core is MIT-licensed.',
    '<strong>The licence matters</strong> if you plan to modify or embed the code: MIT and Apache let you do almost anything, while AGPL and GPL require sharing your changes.',
  ],
  body: `
<h2>The twelve, side by side</h2>
<p>Stars, licence and language come from the GitHub API on 20 November 2026. Stars measure popularity, not quality, but they’re a fair signal of how many people will answer your question when something breaks.</p>
<table>
<thead><tr><th>Tool</th><th>GitHub stars</th><th>Licence</th><th>Language</th><th>What it is</th></tr></thead>
<tbody>
<tr><td><a href="https://github.com/PostHog/posthog" rel="nofollow">PostHog</a></td><td>40,986</td><td>MIT core, paid parts separate</td><td>Python</td><td>Product analytics, session replay, feature flags, experiments</td></tr>
<tr><td><a href="https://github.com/umami-software/umami" rel="nofollow">Umami</a></td><td>40,262</td><td>MIT</td><td>TypeScript</td><td>Privacy-first, cookie-free web analytics</td></tr>
<tr><td><a href="https://github.com/plausible/analytics" rel="nofollow">Plausible</a></td><td>29,899</td><td>AGPL-3.0</td><td>Elixir</td><td>Privacy-first, cookie-free web analytics</td></tr>
<tr><td><a href="https://github.com/matomo-org/matomo" rel="nofollow">Matomo</a></td><td>22,036</td><td>GPL-3.0</td><td>PHP</td><td>Full Google Analytics alternative, self-hosted</td></tr>
<tr><td><a href="https://github.com/rybbit-io/rybbit" rel="nofollow">Rybbit</a></td><td>13,343</td><td>AGPL-3.0</td><td>TypeScript</td><td>GA alternative with funnels and session replay, growing fast</td></tr>
<tr><td><a href="https://github.com/openreplay/openreplay" rel="nofollow">OpenReplay</a></td><td>13,164</td><td>Source-available</td><td>TypeScript</td><td>Session replay and product analytics</td></tr>
<tr><td><a href="https://github.com/arp242/goatcounter" rel="nofollow">GoatCounter</a></td><td>6,177</td><td>EUPL</td><td>Go</td><td>Minimal counter that stores no personal data</td></tr>
<tr><td><a href="https://github.com/electerious/Ackee" rel="nofollow">Ackee</a></td><td>4,733</td><td>MIT</td><td>JavaScript</td><td>Self-hosted Node.js analytics</td></tr>
<tr><td><a href="https://github.com/milesmcc/shynet" rel="nofollow">Shynet</a></td><td>3,155</td><td>Apache-2.0</td><td>Python</td><td>Cookie-free, works even without JavaScript</td></tr>
<tr><td><a href="https://github.com/Open-Web-Analytics/Open-Web-Analytics" rel="nofollow">Open Web Analytics</a></td><td>2,693</td><td>GPL-2.0</td><td>PHP</td><td>An older Google Analytics alternative</td></tr>
<tr><td><a href="https://github.com/benvinegar/counterscale" rel="nofollow">Counterscale</a></td><td>2,210</td><td>MIT</td><td>TypeScript</td><td>Analytics that runs on Cloudflare</td></tr>
<tr><td><a href="https://github.com/talivia-group/talivia" rel="nofollow">Talivia</a></td><td>2,124</td><td>MIT</td><td>TypeScript</td><td>Revenue-first analytics with session replay</td></tr>
</tbody>
</table>

<h2>Which one to pick</h2>
<table>
<thead><tr><th>You want</th><th>Pick</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Simple stats, the easiest self-host</td><td>Umami</td><td>MIT licence, one Node app and a database, clean dashboard</td></tr>
<tr><td>Simple stats, with a hosted option from the same team</td><td>Plausible</td><td>Mature, privacy-first, offered both self-hosted and as a paid cloud</td></tr>
<tr><td>Everything GA4 does, on your own server</td><td>Matomo</td><td>Goals, ecommerce, segments, tag manager, and a long track record</td></tr>
<tr><td>Product analytics for an app</td><td>PostHog</td><td>Funnels, retention, replay and flags in one tool (<a href="/guides/product-analytics-tools/">lesson 7</a>)</td></tr>
<tr><td>Funnels and replay in a lighter package</td><td>Rybbit</td><td>Newer, growing quickly; check it’s mature enough for you</td></tr>
<tr><td>The absolute minimum, no personal data</td><td>GoatCounter or Shynet</td><td>Tiny, private, and fine for a blog or docs site</td></tr>
</tbody>
</table>

<h2>What self-hosting really costs</h2>
<ul>
<li><strong>A server and a database</strong> you keep patched and backed up. If the analytics server goes down, that day’s visits are lost.</li>
<li><strong>Ad blockers</strong> block many self-hosted scripts too. Serving the script from your own domain helps.</li>
<li><strong>Upgrades</strong> sometimes need database migrations. Read the release notes before you update.</li>
<li><strong>Licences</strong> matter if you change the code: AGPL means that if you run a modified version as a service, you share your changes.</li>
</ul>
<p>If you don’t want to run a server, most of these offer a hosted plan, and so do closed-source privacy tools such as Fathom and Simple Analytics (<a href="/guides/google-analytics-alternatives/">lesson 5</a>).</p>

<h2>Keep your history when you switch</h2>
<p>None of these imports your old Google Analytics data completely. Export the reports you care about first, and run both trackers side by side for a few weeks so you can see how the numbers differ. Different tools count visits differently, so a 20% gap is normal. Kauzl reads Plausible, PostHog and Cloudflare Web Analytics as well as Google Analytics; Umami is on our list.</p>
`,
  faq: [
    ['What is the best open-source Google Analytics alternative?', 'Matomo is the closest open-source match to Google Analytics in depth. For simpler, cookie-free stats, Umami and Plausible are the most popular choices, each with tens of thousands of GitHub stars.'],
    ['Is Umami better than Plausible?', 'Umami and Plausible do the same job: simple, private website stats. Umami has a permissive MIT licence and is easy to self-host. Plausible is AGPL-licensed and its team also runs a paid hosted version.'],
    ['Is PostHog open source?', 'PostHog’s core is open source under the MIT licence, with some paid features kept separate. It can be self-hosted, though most teams use PostHog’s cloud.'],
    ['Do open-source analytics tools need a cookie banner?', 'Cookie-free tools like Umami, Plausible and GoatCounter usually don’t need a cookie consent banner because they store no personal data. Check your own legal requirements, especially in the EU.'],
  ],
};
