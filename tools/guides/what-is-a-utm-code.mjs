// Targets: "utm meaning", "what is utm", "what does utm stand for", "utm_source",
// "utm codes" (Bing US, Nov 2026: ~1,600 searches/week across the group).
export default {
  order: 1,
  kicker: 'Campaign tracking',
  short: 'What is a UTM code?',
  title: 'What Is a UTM Code? Meaning, the 5 Parameters and Examples | Kauzl',
  h1: 'What is a UTM code? Meaning, parameters and examples',
  description: 'UTM codes explained: what UTM stands for, the five utm_ parameters, real examples for email, Reddit, LinkedIn and ads, naming rules for GA4, and the mistakes that break your reports.',
  blurb: 'What UTM stands for, the five parameters, examples, and the naming rules that keep GA4 clean.',
  lead: 'A UTM code is a few tags added to the end of a link so Google Analytics knows exactly which email, post or ad sent a visitor. Here’s how they work, with examples you can copy.',
  published: '2026-11-14',
  tools: ['utm-builder', 'did-it-work'],
  inShort: [
    'UTM stands for <strong>Urchin Tracking Module</strong>, named after Urchin, the analytics company Google bought in 2005 and turned into Google Analytics.',
    'A UTM code is query parameters like <code>?utm_source=newsletter&amp;utm_medium=email</code> on the end of a link.',
    'You need <code>utm_source</code> and <code>utm_medium</code>; add <code>utm_campaign</code> to tell launches apart.',
    'Use lowercase and dashes, pick mediums GA4 recognises (<code>email</code>, <code>social</code>, <code>cpc</code>), and never tag links between your own pages.',
  ],
  body: `
<h2>What does UTM stand for?</h2>
<p>UTM stands for <strong>Urchin Tracking Module</strong>. Urchin was a web analytics company that Google bought in 2005; its software became Google Analytics, and its link-tagging format stuck. Today every major analytics tool reads UTM tags: Google Analytics 4, Adobe Analytics, Plausible, Fathom, Matomo, HubSpot and more.</p>

<h2>What a UTM link looks like</h2>
<p>Here is a normal link to a pricing page, and the same link with UTM tags:</p>
<pre><code>https://example.com/pricing

https://example.com/pricing?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=spring-sale</code></pre>
<p>Both open the same page. The difference is what your analytics records. Without tags, a click from an email app often shows up as <em>Direct</em>, because email apps don’t say where the click came from. With tags, Google Analytics files the visit under source <code>newsletter</code>, medium <code>email</code>, campaign <code>spring-sale</code>.</p>

<h2>The five UTM parameters</h2>
<table>
<thead><tr><th>Parameter</th><th>What it answers</th><th>Examples</th></tr></thead>
<tbody>
<tr><td><code>utm_source</code></td><td>Where did the click come from?</td><td><code>newsletter</code>, <code>reddit</code>, <code>linkedin</code>, <code>google</code></td></tr>
<tr><td><code>utm_medium</code></td><td>What kind of channel is it?</td><td><code>email</code>, <code>social</code>, <code>cpc</code>, <code>referral</code></td></tr>
<tr><td><code>utm_campaign</code></td><td>Which push or promotion?</td><td><code>spring-sale</code>, <code>v2-launch</code></td></tr>
<tr><td><code>utm_content</code></td><td>Which link or creative, when there are several?</td><td><code>hero-button</code>, <code>footer-link</code></td></tr>
<tr><td><code>utm_term</code></td><td>Which paid keyword?</td><td><code>running-shoes</code></td></tr>
</tbody>
</table>
<p>GA4 also reads <code>utm_id</code> (a campaign ID, used to join with cost data you import) and three newer ones: <code>utm_source_platform</code>, <code>utm_creative_format</code> and <code>utm_marketing_tactic</code>. Most small teams never need them.</p>

<h2>UTM examples you can copy</h2>
<table>
<thead><tr><th>Where you post</th><th>utm_source</th><th>utm_medium</th></tr></thead>
<tbody>
<tr><td>Your email newsletter</td><td><code>newsletter</code></td><td><code>email</code></td></tr>
<tr><td>A Reddit post</td><td><code>reddit</code></td><td><code>social</code></td></tr>
<tr><td>LinkedIn post</td><td><code>linkedin</code></td><td><code>social</code></td></tr>
<tr><td>X (Twitter) post</td><td><code>twitter</code></td><td><code>social</code></td></tr>
<tr><td>Meta (Facebook/Instagram) ads</td><td><code>facebook</code></td><td><code>paid-social</code></td></tr>
<tr><td>Product Hunt launch</td><td><code>producthunt</code></td><td><code>referral</code></td></tr>
<tr><td>A partner’s blog</td><td><code>partner-name</code></td><td><code>affiliate</code> or <code>referral</code></td></tr>
</tbody>
</table>
<p>For Google Ads, turn on <strong>auto-tagging</strong> instead. It adds a <code>gclid</code> to every ad click and GA4 reads campaign, ad group and keyword from your linked Ads account, which is more detailed than UTMs.</p>

<h2>Naming rules that keep GA4 reports clean</h2>
<p>Most messy campaign reports come from inconsistent tags, not missing ones.</p>
<ul>
<li><strong>Lowercase everything.</strong> GA4 is case-sensitive, so <code>Newsletter</code> and <code>newsletter</code> become two separate rows.</li>
<li><strong>Use dashes, not spaces.</strong> Spaces become <code>%20</code> and are easy to mistype.</li>
<li><strong>Pick mediums GA4 recognises.</strong> GA4 sorts visits into channels like Email, Organic Social, Paid Search and Referral using the medium. <code>email</code>, <code>social</code>, <code>cpc</code>, <code>referral</code>, <code>affiliate</code> and <code>display</code> land where you expect. A made-up medium such as <code>newsletter</code> or <code>blast</code> ends up in <em>Unassigned</em>.</li>
<li><strong>Write the convention down.</strong> A shared list of sources and mediums stops “linkedin”, “LinkedIn” and “li” from all appearing.</li>
</ul>

<h2>Where to see UTM data in Google Analytics 4</h2>
<p>Open <strong>Reports → Acquisition → Traffic acquisition</strong>. The default view groups visits by channel; click the dimension dropdown and choose <strong>Session source / medium</strong> or <strong>Session campaign</strong> to see your tags. Data appears in Realtime within seconds and in standard reports within a day.</p>

<h2>Mistakes that break UTM tracking</h2>
<ul>
<li><strong>Tagging internal links.</strong> A UTM link from one of your pages to another starts a new session and overwrites the real source. Only tag links that live <em>outside</em> your site.</li>
<li><strong>Redirects that drop the query string.</strong> If a short link or an <code>http → https</code> redirect strips <code>?utm_…</code>, the tags never arrive. Test the final URL in a private window and check GA4’s Realtime report.</li>
<li><strong>Tagging Google Ads by hand on top of auto-tagging.</strong> GA4 prefers the <code>gclid</code>, so manual tags are ignored or cause confusion.</li>
<li><strong>Stopping at clicks.</strong> UTMs tell you where visitors came from, not whether the campaign worked. Compare sign-ups or sales before and after with the <a href="/tools/did-it-work/">Did it work? checker</a>.</li>
</ul>

<h2>Build your links in seconds</h2>
<p>The free <a href="/tools/utm-builder/">Kauzl UTM builder</a> lowercases and dashes your tags, warns when GA4 won’t recognise a medium, keeps the other parameters already on your URL, and builds one link per channel in bulk. It runs in your browser, with nothing to sign up for.</p>
`,
  faq: [
    ['Do UTM codes affect SEO?', 'No. Google ignores UTM parameters for ranking. Use them only on links outside your site, and keep a canonical tag on your pages so tagged URLs aren’t indexed as duplicates.'],
    ['Are UTM parameters case-sensitive?', 'Yes. In GA4, <code>Email</code> and <code>email</code> are two different mediums. Lowercase everything.'],
    ['Which UTM parameters are required?', 'GA4 needs <code>utm_source</code> to attribute a visit. Add <code>utm_medium</code> so it can assign a channel, and <code>utm_campaign</code> to tell campaigns apart.'],
    ['What is the difference between utm_source and utm_medium?', 'Source is the specific place (newsletter, reddit, google). Medium is the type of channel (email, social, cpc). Many sources can share one medium.'],
  ],
};
