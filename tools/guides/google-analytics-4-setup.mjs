// Targets: "google analytics tracking setup" (~950/week on Bing US),
// "ga4 analytics", "google analytics 4" (Nov 2026).
export default {
  order: 2,
  kicker: 'Google Analytics 4',
  short: 'Set up Google Analytics 4',
  title: 'How to Set Up Google Analytics 4: Tracking Setup Step by Step | Kauzl',
  h1: 'How to set up Google Analytics 4, step by step',
  description: 'A plain-English Google Analytics 4 tracking setup: create the property, install the tag, check it works, keep 14 months of data, filter your own visits, mark key events and link Search Console.',
  blurb: 'Create the property, install the tag, and the five settings most sites forget.',
  lead: 'Getting GA4 to count visits takes ten minutes. Getting it to count them <em>usefully</em> takes five more settings that most sites skip. This guide covers both.',
  published: '2026-11-14',
  tools: ['utm-builder', 'did-it-work', 'serp-preview'],
  inShort: [
    'Create a GA4 property and a web data stream; you get a Measurement ID that starts with <code>G-</code>.',
    'Install the Google tag with the snippet, Google Tag Manager, or your platform’s integration, then confirm visits in the Realtime report.',
    'Then change the settings that matter: data retention to 14 months, an internal-traffic filter, key events, and a Search Console link.',
  ],
  body: `
<p>Google moves menu items around from time to time. If a path below doesn’t match your screen, use the search box at the top of GA4 and type the setting’s name; it finds Admin pages too.</p>

<h2>1. Create the property and data stream</h2>
<ol class="steps-list">
<li><strong>Open <a href="https://analytics.google.com" rel="nofollow">analytics.google.com</a></strong> and sign in with the Google account that should own the data. For a business, use a shared account rather than one person’s.</li>
<li><strong>Admin → Create → Property.</strong> Name it after the website, and set the <strong>reporting time zone</strong> and currency. The time zone decides where each “day” starts in every report, so pick the one your team works in.</li>
<li><strong>Add a Web data stream</strong> with your site’s address. Leave <strong>Enhanced measurement</strong> on: it records page views, scrolls, outbound clicks, site search, video plays, file downloads and form interactions without any code.</li>
<li><strong>Copy the Measurement ID</strong>, which looks like <code>G-ABC123XYZ</code>.</li>
</ol>

<h2>2. Install the tag</h2>
<p>Pick <em>one</em> way. Installing two (say, the snippet and Tag Manager) counts every visit twice.</p>
<ul>
<li><strong>The snippet:</strong> in the data stream, open <em>View tag instructions → Install manually</em> and paste the code just after the opening <code>&lt;head&gt;</code> on every page.</li>
<li><strong>Google Tag Manager:</strong> add a <em>Google tag</em> with your Measurement ID, triggered on all pages, and publish the container.</li>
<li><strong>Your platform:</strong> WordPress (Site Kit by Google), Shopify (the Google &amp; YouTube app), Wix, Squarespace and Webflow all have a field for the Measurement ID. Next.js has <code>@next/third-parties/google</code>.</li>
</ul>

<h2>3. Check that it works</h2>
<p>Open your site in another tab, then <strong>Reports → Realtime</strong> in GA4. You should appear within a minute. For a closer look, install the Tag Assistant browser extension or use <strong>Admin → DebugView</strong> to see each event as it arrives.</p>
<p>No data? The usual causes are an ad blocker in your own browser, a cookie banner that blocks the tag until consent, or the tag only on some pages.</p>

<h2>4. Keep 14 months of data</h2>
<p>By default GA4 keeps detailed, event-level data for only <strong>2 months</strong>. Standard reports aren’t affected, but Explorations (funnels, paths, custom tables) can’t look further back. Go to <strong>Admin → Data collection and modification → Data retention</strong> and choose <strong>14 months</strong>, the maximum for free properties. This isn’t retroactive, so do it on day one.</p>

<h2>5. Stop counting yourself</h2>
<p>Your own visits, and your team’s, skew small sites badly. In the data stream, open <strong>Configure tag settings → Define internal traffic</strong> and add your office or home IP addresses. Then in <strong>Admin → Data filters</strong>, switch the “Internal traffic” filter from <em>Testing</em> to <em>Active</em>.</p>

<h2>6. Mark your key events</h2>
<p>“Key events” are what GA4 used to call conversions (Google renamed them in 2024): the actions that matter, such as a sign-up, purchase or contact form. Make sure the event is being sent, then go to <strong>Admin → Events</strong> and switch on <em>Mark as key event</em> for it. Common names are <code>sign_up</code>, <code>purchase</code> and <code>generate_lead</code>. From then on, every report can show key events by channel, page and campaign.</p>

<h2>7. Link Search Console</h2>
<p><strong>Admin → Product links → Search Console links</strong> connects the searches people typed in Google to what they did on your site. You need to be an owner of the Search Console property. (Why the two tools never show the same numbers is its own topic: see <a href="/guides/search-console-vs-google-analytics/">Search Console vs Google Analytics</a>.)</p>

<h2>8. Handle consent if you have EU visitors</h2>
<p>If you show a cookie banner, use one that supports <strong>Google Consent Mode v2</strong>, so GA4 respects visitors’ choices and can model some of the visits it can’t see. Without it, a banner that simply blocks the tag can hide a large share of your traffic.</p>

<h2>9. Tag your campaigns</h2>
<p>Links in emails, social posts and chat apps often arrive as “Direct”. Add UTM tags to every link you share. The <a href="/guides/what-is-a-utm-code/">UTM guide</a> explains the parameters and the <a href="/tools/utm-builder/">UTM builder</a> makes the links.</p>

<h2>What to look at once it’s running</h2>
<ul>
<li><strong>Traffic acquisition:</strong> where visits come from, by channel and by source / medium.</li>
<li><strong>Pages and screens:</strong> which pages people read.</li>
<li><strong>Key events by channel:</strong> which sources bring people who sign up or buy.</li>
</ul>
<p>The question GA4 doesn’t answer on its own is <em>why</em> a number moved. When you ship a redesign, publish a post or launch a campaign, compare the days before and after with the <a href="/tools/did-it-work/">Did it work? checker</a>, or let Kauzl line up every change you ship against GA4 automatically.</p>
`,
  faq: [
    ['Is Google Analytics 4 free?', 'Yes. The standard version is free. Google Analytics 360 is the paid version for very large sites.'],
    ['How long until data shows in GA4?', 'Realtime shows visits within a minute. Standard reports usually fill in within 24 to 48 hours.'],
    ['Should I use Google Tag Manager?', 'If you’ll add more tags later (ads pixels, other analytics), yes: it keeps them in one place. For a single GA4 tag, the snippet or your platform’s integration is simpler.'],
    ['What is the difference between a property and a data stream?', 'A property is one set of reports. A data stream is one source feeding it: a website, an iOS app or an Android app.'],
  ],
};
