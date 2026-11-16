// Targets: "ga4 bigquery export", "connect ga4 to bigquery", "ga4 bigquery link".
// Also the help page Kauzl links from Edit site → Connect the GA4 BigQuery export.
export default {
  order: 8,
  kicker: 'Google Analytics 4',
  short: 'Connect GA4 to BigQuery',
  title: 'How to Connect GA4 to BigQuery: The Free Export, Step by Step | Kauzl',
  h1: 'How to connect GA4 to BigQuery, step by step',
  description: 'Turn on the free GA4 BigQuery export: the Cloud project, the GA4 link, which settings to pick, what it costs, and using raw events for funnels.',
  blurb: 'The free export that gives you every raw event: link it once, and funnels, paths and retention work on your own data.',
  lead: 'GA4’s reports show totals. The <strong>BigQuery export</strong> gives you every single event, as rows you can query. It’s free for standard properties, takes ten minutes to link, and is the only way to answer questions like “which pages did people read before signing up?” on your own data.',
  published: '2026-11-15',
  tools: ['did-it-work', 'utm-builder', 'ab-test-calculator'],
  inShort: [
    'You need a Google Cloud project with BigQuery, and an Editor role on the GA4 property.',
    'In GA4: <strong>Admin → Product links → BigQuery links → Link</strong>, pick the project and a data location, tick <strong>Daily</strong>, submit.',
    'Data starts from the day you link (it isn’t backfilled) and the first day arrives within 24 hours, in a dataset named <code>analytics_&lt;property ID&gt;</code>.',
  ],
  body: `
<p>Google moves menu items around from time to time. If a path below doesn’t match your screen, use the search box at the top of GA4 or Google Cloud and type the setting’s name.</p>

<h2>What the export gives you</h2>
<p>Every day, GA4 writes a table of that day’s events into BigQuery: one row per event, with its parameters, the page, the device, the traffic source and an anonymous user ID. Because it’s the raw data, there’s no sampling and no “(other)” row, and you can ask it things the standard reports can’t:</p>
<ul>
<li><strong>Paths:</strong> what people did before and after a page or event.</li>
<li><strong>Funnels:</strong> how many got from step one to a sign-up, in order, within one visit.</li>
<li><strong>Retention:</strong> of the people who first came in a given week, how many came back.</li>
<li><strong>Anything else</strong> in SQL, joined with your own data.</li>
</ul>

<h2>Before you start</h2>
<ul>
<li><strong>A role on the GA4 property</strong> of Editor or above (Admin → Property access management).</li>
<li><strong>A Google Cloud project</strong> you own. Create one at <a href="https://console.cloud.google.com/projectcreate" rel="nofollow">console.cloud.google.com</a> if you don’t have one; the name doesn’t matter.</li>
<li><strong>The BigQuery API turned on</strong> in that project. It usually is for new projects; if not, search for “BigQuery API” in the Cloud console and click <em>Enable</em>.</li>
<li><strong>Billing, ideally.</strong> The daily export works without a billing account (BigQuery’s “sandbox”), but sandbox tables are deleted after 60 days, so you’d never have more than two months of history. With billing on, small sites stay inside the free tier; see costs below.</li>
</ul>

<h2>1. Link GA4 to BigQuery</h2>
<ol class="steps-list">
<li><strong>Open GA4 → Admin → Product links → BigQuery links</strong> and click <strong>Link</strong>.</li>
<li><strong>Choose a BigQuery project</strong>: the Cloud project from above.</li>
<li><strong>Pick a data location</strong>, such as US, EU or a single region near you. It can’t be changed later, and queries are cheapest when everything you join lives in one location.</li>
<li><strong>Choose what to export.</strong> Leave all data streams and events included unless you have a reason to leave some out.</li>
<li><strong>Tick Daily.</strong> Leave <em>Streaming</em> off: it costs money and isn’t needed for reports that look at whole days. You can leave the user-data export off too.</li>
<li><strong>Submit.</strong></li>
</ol>

<h2>2. Wait for the first day</h2>
<p>The export isn’t retroactive: data starts on the day you link. Within 24 hours a dataset named <code>analytics_123456789</code> (your property ID) appears in the project, with one table per day called <code>events_YYYYMMDD</code>. Each day’s table usually lands by the next morning, though it can be later.</p>
<p>To check, open <strong>BigQuery Studio</strong> in the Cloud console, expand the project, and look for the dataset. Run this to see the last few days (swap in your project and dataset):</p>
<pre><code>SELECT event_date, COUNT(*) AS events
FROM \`my-project.analytics_123456789.events_*\`
GROUP BY event_date
ORDER BY event_date DESC
LIMIT 7</code></pre>

<h2>3. What it costs</h2>
<ul>
<li><strong>The export itself is free</strong> for standard GA4 properties, up to <strong>1 million events a day</strong>. Above that, GA4 may pause the daily export; that limit is the main reason big sites move to GA4 360.</li>
<li><strong>Storage:</strong> the first 10 GB a month are free. A small or medium site stores well under that.</li>
<li><strong>Queries:</strong> the first 1 TB scanned a month is free. Queries that read only the columns and days they need stay small; <code>SELECT *</code> over every day is what gets expensive.</li>
</ul>
<p>To stay safe, set a <strong>budget alert</strong> in Google Cloud Billing, and when you query, always limit the date range with <code>_TABLE_SUFFIX</code> or a date filter.</p>

<h2>4. Use it in Kauzl</h2>
<p>Kauzl reads the export directly, so funnels, paths, retention, events, sessions and SQL work on your own data without writing queries:</p>
<ol class="steps-list">
<li><strong>Open your site’s settings:</strong> Account → Sites &amp; products → <em>Edit</em> on the site.</li>
<li><strong>Tick “Connect the GA4 BigQuery export”</strong> under Analytics. Kauzl looks up the property’s link and fills in the project, dataset and location for you. If the link exists but the first day hasn’t arrived, it says so: save anyway and it starts working when the data lands.</li>
<li><strong>Click Save site</strong> at the top.</li>
</ol>
<p>Under <em>Advanced</em> you can change the details Kauzl filled in:</p>
<ul>
<li><strong>Billing project:</strong> the project that runs (and pays for) the queries. Usually the same as the data project.</li>
<li><strong>Stream ID:</strong> if one GA4 property collects several sites, this keeps queries to one of them.</li>
<li><strong>Scan cap:</strong> Kauzl estimates every query first and refuses any that would scan more than this (5 GB by default), so a wide date range can’t surprise you.</li>
</ul>
<p>The Google account you signed in to Kauzl with needs to be able to run queries in the billing project and read the dataset: the <em>BigQuery Job User</em> and <em>BigQuery Data Viewer</em> roles, which project owners already have.</p>
<p><strong>Make it faster and cheaper:</strong> once saved, <em>Materialize sessions</em> builds a sessions table from the last 90 days in your billing project. Paths, funnels, retention and sessions then read that table instead of the raw events, usually scanning 10 to 50 times less. Re-run it daily, or copy its SQL into a BigQuery scheduled query.</p>

<h2>When something doesn’t work</h2>
<ul>
<li><strong>No dataset after a day:</strong> check the link in GA4 Admin is still there, and that the BigQuery API is enabled in the project.</li>
<li><strong>Only the last 60 days:</strong> the project has no billing account, so it’s in sandbox mode. Add billing and new tables stop expiring.</li>
<li><strong>“Access denied” in Kauzl:</strong> the signed-in Google account is missing a role on the project or dataset; see above.</li>
<li><strong>Yesterday is missing:</strong> the daily table can arrive late in the day. It fills in once the table lands; nothing needs doing.</li>
</ul>
`,
  faq: [
    ['Is the GA4 BigQuery export free?', 'Yes, for standard GA4 properties, up to 1 million events a day. You pay only for BigQuery storage and queries beyond the free tier: 10 GB of storage and 1 TB of queries a month.'],
    ['Does the export include my past data?', 'No. It starts on the day you link GA4 to BigQuery, so link it early even if you won’t use it yet.'],
    ['Do I need a billing account?', 'Not to start: the daily export works in BigQuery’s free sandbox. But sandbox tables are deleted after 60 days, so add billing to keep your history.'],
    ['Should I choose Daily or Streaming?', 'Daily. Streaming sends events within minutes but costs extra and needs billing. For reports by day, Daily is enough.'],
    ['Can I change the data location later?', 'No. To move it you have to unlink and link again, and the new export starts from that day. Pick the location carefully the first time.'],
  ],
};
