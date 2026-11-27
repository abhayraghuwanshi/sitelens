// Targets: "google analytics alternatives", "ga4 alternative", "best google
// analytics alternative 2026", "privacy friendly analytics". Honest on purpose:
// most readers should switch to a tracker, and Kauzl isn't one. Group by the
// reason people leave GA4, not by a ranking. Don't quote prices, they change;
// re-check each product's claims before editing.
export default {
  order: 5.5,
  kicker: 'Compare',
  short: 'Google Analytics alternatives',
  title: 'Google Analytics Alternatives (2026), Compared | Kauzl',
  h1: 'Google Analytics alternatives: pick by why you’re leaving',
  description: 'Plausible, Fathom, Umami, Matomo, PostHog, Looker Studio and more, grouped by why you’re leaving GA4: privacy, simplicity, self-hosting or the UI.',
  blurb: 'Nine options, grouped by the reason you want out of GA4.',
  lead: 'We make Kauzl, which is on this list, so read with that in mind. It’s only the right answer for one of the five reasons below, and we say which.',
  published: '2026-11-16',
  updated: '2026-11-28',
  tools: ['did-it-work', 'utm-builder', 'ai-robots-txt-generator'],
  inShort: [
    'Leaving for <strong>privacy or the cookie banner</strong>: Plausible, Fathom or Simple Analytics.',
    'Want it <strong>free and on your own server</strong>: Umami, or Matomo if you need GA-level depth.',
    'Building a <strong>product</strong> and need funnels, replays and experiments: PostHog.',
    'You <strong>don’t mind GA4’s data, only its interface</strong>: keep GA4 and put something on top (Looker Studio, a simpler dashboard, or Kauzl).',
  ],
  body: `
<h2>First: why are you leaving?</h2>
<p>“Google Analytics alternative” means five different things, and the best tool for one is wrong for the others. Before comparing feature lists, pick the sentence that sounds like you:</p>
<ol>
<li><strong>“I don’t want a cookie banner, or to send visitor data to Google.”</strong> You need a privacy-first tracker.</li>
<li><strong>“I just want to see visits, sources and pages on one screen.”</strong> You need a simple tracker, or a simpler view of GA4.</li>
<li><strong>“I want to own the data and host it myself.”</strong> You need an open-source tracker.</li>
<li><strong>“I’m building a product, and need funnels, retention and session replays.”</strong> You need product analytics.</li>
<li><strong>“GA4 collects what I need. I just can’t get answers out of it.”</strong> You may not need to switch at all.</li>
</ol>

<h2>1. Privacy-first: no cookies, no banner</h2>
<p><strong>Plausible.</strong> A small, cookieless script and one clean dashboard: sources, pages, countries, goals, custom events and Search Console terms. Open source and hosted in the EU, and you can run it yourself. The default choice for most blogs, docs and marketing sites.</p>
<p><strong>Fathom.</strong> Also cookieless and simple, closed source, with EU traffic isolation and no limit on how long data is kept. A good fit if you want a polished hosted service and never plan to self-host.</p>
<p><strong>Simple Analytics.</strong> Privacy-first from the Netherlands, with a deliberately minimal dashboard. Good if you want the fewest possible numbers on screen.</p>
<p>All three drop GA4’s heavy script and, in most setups, the consent banner. What you give up: GA4’s audiences and ads integrations, and your old GA4 history doesn’t move across.</p>

<h2>2. Self-hosted and open source</h2>
<p><strong>Umami.</strong> Open source, light, and free to run on your own server; there’s also a hosted cloud. Covers pages, sources, events and simple funnels. Good if you’re comfortable deploying a small app and a database.</p>
<p><strong>Matomo.</strong> The closest thing to Google Analytics you can own: segments, goals, ecommerce, heatmaps (as plugins) and a GA importer. Heavier to run, but the answer when you need GA’s depth without Google.</p>

<h2>3. Product analytics</h2>
<p><strong>PostHog.</strong> Built for apps, not just websites: event funnels, retention, session replay, feature flags, experiments and surveys in one place, with a generous free tier and an open-source core. Overkill for a blog; very useful for a SaaS product.</p>
<p>Mixpanel and Amplitude sit here too, aimed at larger product teams.</p>

<h2>4. Keep GA4, change how you read it</h2>
<p>If GA4 already collects what you need, switching throws away your history and your setup to fix what is really a reading problem. Three ways to keep the data and lose the pain:</p>
<p><strong>Looker Studio.</strong> Google’s free dashboard builder. Connect GA4, start from a template, and you get a one-page report you can share. Free and flexible, but you build and maintain it, and it shows numbers, not reasons.</p>
<p><strong>A simpler GA4 dashboard.</strong> Read-only tools such as Owl Insight put your GA4 numbers into a calmer, fixed layout with summaries, without a new script.</p>
<p><strong>Kauzl</strong> (ours). Also read-only, also no new script, but aimed at a different question: <em>why</em> a number moved. It puts your releases, posts, deploys and campaigns on the same timeline as GA4, Search Console and Bing, compares each day with a normal day for that weekday, and says in a sentence what changed and whether it’s real: “Visits up 32%. Reddit sent 18 more, the day after your launch post.” It turns findings into to-dos and checks later whether they helped. Choose it if you ship often and keep asking “did that work?”. Don’t choose it if you’re leaving Google: today it reads GA4.</p>

<h2>Side by side</h2>
<table>
<thead><tr><th></th><th>Replaces GA4’s script</th><th>Cookieless</th><th>Self-host</th><th>Best for</th></tr></thead>
<tbody>
<tr><td>Plausible</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Sites that want simple, private counts</td></tr>
<tr><td>Fathom</td><td>Yes</td><td>Yes</td><td>No</td><td>Hosted, polished, private</td></tr>
<tr><td>Simple Analytics</td><td>Yes</td><td>Yes</td><td>No</td><td>Minimal dashboards, EU-based</td></tr>
<tr><td>Umami</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Free and self-hosted</td></tr>
<tr><td>Matomo</td><td>Yes</td><td>Can be</td><td>Yes</td><td>GA-level depth you own</td></tr>
<tr><td>PostHog</td><td>Yes (for products)</td><td>Can be</td><td>Yes</td><td>Apps: funnels, replays, flags</td></tr>
<tr><td>Looker Studio</td><td>No, reads GA4</td><td>—</td><td>No</td><td>Free custom GA4 reports</td></tr>
<tr><td>Owl Insight</td><td>No, reads GA4</td><td>—</td><td>No</td><td>A calmer GA4 dashboard</td></tr>
<tr><td>Kauzl</td><td>No, reads GA4</td><td>—</td><td>No</td><td>Knowing why numbers moved</td></tr>
</tbody>
</table>

<h2>If you do switch: don’t lose the before</h2>
<p>A new tracker starts empty, so for a while you can’t compare this month with last. Run both for four weeks before you remove GA4, and export the GA4 numbers you care about first (monthly visits by source and your top pages are usually enough). If you made a change during the switch, check it with the <a href="/tools/did-it-work/">Did it work? checker</a> rather than comparing two tools’ numbers, which never match exactly.</p>
<p>Whatever you pick, tag the links you share (<a href="/tools/utm-builder/">UTM builder</a>) so every tool can tell your newsletter from your Reddit post.</p>
`,
  faq: [
    ['What is the best Google Analytics alternative?', 'The best Google Analytics alternative depends on why you are leaving. For privacy and simplicity, Plausible or Fathom. For free self-hosting, Umami, or Matomo for more depth. For product analytics, PostHog. If you only dislike GA4’s interface, keep GA4 and use Looker Studio or a tool that reads it.'],
    ['Is there a free Google Analytics alternative?', 'Umami and Matomo are free if you host them yourself, and PostHog has a free tier. Looker Studio is free but reads GA4 rather than replacing it.'],
    ['Do privacy-first analytics tools need a cookie banner?', 'Cookieless tools like Plausible, Fathom and Simple Analytics are usually used without one, but whether you need consent depends on your setup and your jurisdiction, so check with your own advisor.'],
    ['Can I move my old GA4 data to another tool?', 'Mostly no. Matomo has a Google Analytics importer; most others start fresh. Export the reports you care about, and run both tools side by side for a few weeks.'],
    ['Is Kauzl a Google Analytics alternative?', 'Not in the usual sense. Kauzl reads Google Analytics 4, Plausible, PostHog, Cloudflare Web Analytics, Search Console and Bing instead of replacing them, and explains what changed. It suits people who want to keep GA4 but get answers out of it.'],
  ],
};
