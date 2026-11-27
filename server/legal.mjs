// Public legal pages of hosted Kauzl: /privacy and /terms. Plain HTML, no
// script, styled like the home page (ink + amber, the owl). The privacy page
// is what Google's OAuth review reads: what Google data Kauzl reads, why, how
// it's kept, and the Limited Use statement. Keep it true to what the code does.

import { owl, FAVICON, FONTS } from './home.mjs';

// Where people write about their data. Change it here; both pages use it.
export const CONTACT = 'hello@kauzl.com';
export const UPDATED = '22 November 2026';

const CSS = `
:root { color-scheme: light; --ink: #121522; --amber: #F5A524; --bg: #F6F7F9; --surface: #FFFFFF; --text: #121522; --text-2: #3A3F50; --muted: #5B6172; --line: #E3E6EC; --link: #121522;
  --head: "Bricolage Grotesque", "Inter", system-ui, sans-serif; --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --ink: #141519; --bg: #0E0F12; --surface: #18191E; --text: #F4F4F5; --text-2: #D4D4D8; --muted: #A1A1AA; --line: #2C2E36; --link: #F4F4F5; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--link); text-underline-offset: 2px; }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
.wrap { max-width: 760px; margin: 0 auto; padding-inline: 24px; }
header.top { background: var(--ink); color: #F6F7F9; }
header.top .wrap { max-width: 1120px; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; }
.brand { display: flex; align-items: center; gap: 10px; color: #F6F7F9; text-decoration: none; font: 800 20px var(--head); letter-spacing: -0.02em; }
.top nav { display: flex; gap: 20px; font-size: 14px; } .top nav a { color: #C9CDD8; text-decoration: none; } .top nav a:hover, .top nav a[aria-current] { color: #F6F7F9; }
svg.owl { display: block; flex: none; }
main { padding: 56px 0 24px; }
h1 { font: 800 clamp(32px, 5vw, 44px)/1.1 var(--head); letter-spacing: -0.03em; margin: 0 0 8px; }
.updated { color: var(--muted); margin: 0 0 32px; font-size: 14px; }
.lead { font-size: 18px; color: var(--text-2); margin: 0 0 8px; }
h2 { font: 700 22px/1.25 var(--head); letter-spacing: -0.02em; margin: 44px 0 10px; }
h3 { font: 600 17px/1.3 var(--font); margin: 24px 0 6px; }
p, li { color: var(--text-2); } ul { padding-left: 22px; } li { margin: 6px 0; } b { color: var(--text); }
.note { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--amber); border-radius: 12px; padding: 16px 20px; margin: 24px 0; }
.note p { margin: 0; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 15px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
th, td { text-align: left; vertical-align: top; padding: 10px 14px; border-bottom: 1px solid var(--line); }
th { font-weight: 600; color: var(--text); } tr:last-child td { border-bottom: 0; } td { color: var(--text-2); }
code { font-size: 13.5px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; overflow-wrap: anywhere; }
footer { margin-top: 64px; padding: 32px 0 48px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer .wrap { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; } footer a { color: var(--muted); }
@media (max-width: 560px) { .wrap { padding-inline: 16px; } main { padding-top: 36px; } .top nav { gap: 14px; } table, thead, tbody, tr, th, td { display: block; } thead { display: none; } td { border-bottom: 0; padding: 4px 14px; } td:first-child { padding-top: 12px; font-weight: 600; color: var(--text); } tr { border-bottom: 1px solid var(--line); padding-bottom: 8px; } }
`;

function page({ path, title, description, body }) {
  const nav = [['/home', 'Home'], ['/privacy', 'Privacy'], ['/terms', 'Terms']]
    .map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Kauzl</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://kauzl.com${path}">
<meta name="theme-color" content="#121522">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style></head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/home" aria-label="Kauzl home">${owl(28, { variant: 'paper' })}kauzl</a>
  <nav aria-label="Pages">${nav}</nav>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer><div class="wrap">${owl(24)}<span>Kauzl</span><a href="/home">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="mailto:${CONTACT}">${CONTACT}</a></div></footer>
</body></html>`;
}

export function privacyPage() {
  return page({
    path: '/privacy',
    title: 'Privacy policy',
    description: 'Kauzl privacy policy: what Google user data Kauzl accesses, how it is used, shared, stored and protected, and how it is kept and deleted.',
    body: `<h1>Kauzl privacy policy</h1>
<p class="updated">Last updated ${UPDATED}</p>
<p class="lead">This privacy policy explains how Kauzl (the web app at https://kauzl.com, "Kauzl", "we", "us") collects, accesses, uses, shares, stores, protects, retains and deletes your information, including the Google user data Kauzl receives when you sign in with Google and connect Google Analytics, Google Search Console and Google BigQuery.</p>

<div class="note"><p><b>Summary.</b> Kauzl reads your website analytics and search data, read-only, to show you how your website is doing. We do not sell your data, do not use it for advertising, do not use it to train AI or machine-learning models, and do not let people read it except as described below. You can revoke access and have your data deleted at any time.</p></div>

<h2>1. What Kauzl does</h2>
<p>Kauzl is an analytics calendar for website owners. It connects to the analytics and search tools you already use, puts your traffic and search results on one timeline next to your releases, posts and campaigns, and explains what changed. Kauzl only shows each user data about websites and accounts that user has connected.</p>

<h2>2. Google user data Kauzl accesses</h2>
<p>When you sign in with Google, Kauzl requests the following Google OAuth scopes. Kauzl only accesses the Google Analytics properties, Search Console sites, BigQuery datasets and Google Cloud projects that you choose inside Kauzl.</p>
<h3>Basic profile: email address (openid, email)</h3>
<p>We receive your Google account email address and a Google account ID. We do not receive your Google password.</p>
<h3>Google Analytics, read-only (https://www.googleapis.com/auth/analytics.readonly)</h3>
<p>We access the list of Google Analytics accounts and GA4 properties you can see, and report data for the properties you select: visits, users, sessions, page views, pages, traffic sources, countries, devices, events, conversions and real-time active users. This data is aggregated website statistics; it does not identify your website's visitors by name.</p>
<h3>Google Search Console, read-only (https://www.googleapis.com/auth/webmasters.readonly)</h3>
<p>We access the list of Search Console sites you can see, and for the sites you select: search clicks, impressions, click-through rate, average position, search queries and pages, and URL Inspection results (whether a page is indexed).</p>
<h3>Google BigQuery (https://www.googleapis.com/auth/bigquery)</h3>
<p>Only if you connect your Google Analytics 4 BigQuery export. We access the export dataset you select and run read-only SQL queries on it (in the Google Cloud project you select) to show sessions, funnels, visitor journeys and live visits. Kauzl does not create, modify or delete your BigQuery datasets or tables. Every query is size-checked first and capped so it cannot run beyond a set amount of data.</p>
<h3>Google Cloud Logging, read-only (https://www.googleapis.com/auth/logging.read)</h3>
<p>Only if you connect Firebase App Hosting. We read request logs and rollout records for the Google Cloud project you select, to show your deploys and request counts on the timeline.</p>

<h2>3. How Kauzl uses Google user data</h2>
<p>Kauzl uses Google user data only to provide and improve the features you use in Kauzl:</p>
<ul>
<li>to sign you in and keep your account secure (email address);</li>
<li>to show you charts, reports, timelines, alerts and explanations about your own websites;</li>
<li>to answer questions you ask about your data inside Kauzl, or through an AI assistant you connect yourself (see section 5);</li>
<li>to send you the alerts and summaries you turn on.</li>
</ul>
<p>Kauzl does <b>not</b> use Google user data to serve advertisements, does not sell it, does not use it to determine creditworthiness or for lending, and does not use it to develop, improve or train generalized artificial-intelligence or machine-learning models.</p>

<h2>4. Limited Use disclosure</h2>
<p>Kauzl's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
<p>No person at Kauzl reads your Google user data, except (a) with your explicit permission, for example when you ask for support; (b) when it is necessary for security purposes, such as investigating abuse; (c) to comply with applicable law; or (d) when the data is aggregated and anonymized and used for internal operations.</p>

<h2>5. How Kauzl shares, transfers and discloses Google user data</h2>
<p>We do not sell, rent or trade Google user data, and we do not share it with advertisers, data brokers or other information resellers. Google user data is transferred only in these cases:</p>
<ul>
<li><b>People you choose to share with.</b> If you share a website in Kauzl with another person by email, that person can view that website's reports. You can remove their access at any time.</li>
<li><b>AI providers you choose to use.</b> If you add your own Anthropic or OpenRouter API key, or connect your own AI assistant (such as Claude or Cursor) to Kauzl with an access token you create, the specific data needed to answer your request is sent to that provider at your direction, under your account with them. Those providers do not receive your data unless you set this up.</li>
<li><b>Service providers.</b> Our hosting and network providers (Fly.io for servers and storage, Cloudflare for network delivery and security) process data only on our behalf, to run Kauzl.</li>
<li><b>Legal reasons.</b> If required by law, or to protect the rights, safety and security of Kauzl, our users or the public.</li>
<li><b>Business transfer.</b> If Kauzl is merged or sold, your data may move to the new owner, who must follow this policy.</li>
</ul>

<h2>6. Other information Kauzl collects</h2>
<ul>
<li><b>Other services you connect</b> (all optional): Microsoft Bing Webmaster Tools, GitHub, Vercel, Reddit, the Chrome Web Store and similar. Kauzl reads them read-only, for the websites you select, and uses that data the same way as Google user data above.</li>
<li><b>Content you create</b> in Kauzl: notes, to-dos, goals, alerts and site settings.</li>
<li><b>API keys you enter</b>, such as a Bing, Google, Anthropic or OpenRouter key, used only for the feature you add them for.</li>
<li><b>Early-access sign-ups</b>: the email address you leave on our website, used only to invite you.</li>
<li><b>Technical data</b>: your IP address and browser details when you use Kauzl, used for security and rate limiting, and a session cookie that keeps you signed in.</li>
<li><b>Website analytics on our public pages</b>: our home page, free tools and guides use Google Analytics (via Google Tag Manager) and its cookies to count visits. The signed-in Kauzl app does not.</li>
</ul>

<h2>7. How Kauzl stores and protects data</h2>
<ul>
<li>Data is stored on servers run by Fly.io. Each account's data is kept in its own separate storage area.</li>
<li>Google OAuth tokens and API keys are encrypted at rest with a key unique to each account.</li>
<li>Kauzl keeps a copy of the reports it reads so that pages load quickly and past periods can be compared. This copy is used only for your account.</li>
<li>All connections use HTTPS (TLS) encryption. Session cookies are random, HttpOnly and Secure, and only a hash of them is stored. Access tokens for AI assistants are stored only as hashes.</li>
<li>Kauzl's servers block requests to private and internal network addresses, and access to production systems is limited to the people who operate Kauzl.</li>
</ul>

<h2>8. Data retention and deletion</h2>
<ul>
<li>We keep your data while your account is active.</li>
<li><b>Disconnect a source:</b> you can disconnect Google or any other source in Kauzl's settings at any time.</li>
<li><b>Revoke Google access:</b> you can remove Kauzl's access to your Google account at any time at <a href="https://myaccount.google.com/permissions">https://myaccount.google.com/permissions</a>. Kauzl then can no longer read new Google data.</li>
<li><b>Delete your account and data:</b> email <a href="mailto:${CONTACT}">${CONTACT}</a> from the address you sign in with. We delete your account, your stored Google user data, tokens and all other data for your account within 30 days, except where the law requires us to keep it.</li>
<li>Early-access emails are deleted when you ask, or when early access ends.</li>
</ul>

<h2>9. Your choices and rights</h2>
<p>You can ask to access, correct, export or delete your personal data, or object to how it's used, by emailing <a href="mailto:${CONTACT}">${CONTACT}</a>. We answer within 30 days. Depending on where you live, you may also have the right to complain to your data-protection authority.</p>

<h2>10. Children</h2>
<p>Kauzl is not directed to children under 16, and we do not knowingly collect their data.</p>

<h2>11. Changes to this policy</h2>
<p>If we change this policy in a way that matters, we will update the date at the top and tell signed-in users before the change takes effect. If a change affects how we use Google user data, we will ask for your consent first.</p>

<h2>12. Contact</h2>
<p>Questions about this privacy policy or your data: <a href="mailto:${CONTACT}">${CONTACT}</a>, or visit <a href="https://kauzl.com/">https://kauzl.com</a>.</p>`,
  });
}

export function termsPage() {
  return page({
    path: '/terms',
    title: 'Terms of service',
    description: 'The terms for using Kauzl, the analytics calendar for your website.',
    body: `<h1>Terms of service</h1>
<p class="updated">Last updated ${UPDATED}</p>
<p class="lead">These terms cover your use of Kauzl at kauzl.com. By signing in, you agree to them.</p>

<h2>The service</h2>
<p>Kauzl reads the analytics, search and other tools you connect and shows what changed on your sites and why. It is in early access: features may change, and we may pause or end the service. If we end it, we'll give you notice and a way to get your data.</p>

<h2>Your account</h2>
<ul>
<li>You sign in with Google. Keep your Google account secure; you're responsible for what happens under your account.</li>
<li>Only connect sites and accounts you're allowed to access, and only share a site with people who are allowed to see its data.</li>
<li>You can stop using Kauzl and ask us to delete your account at any time (see the <a href="/privacy">privacy policy</a>).</li>
</ul>

<h2>Your data</h2>
<p>Your data stays yours. You give Kauzl permission to read and process it only to run the service for you. How we handle it is set out in the <a href="/privacy">privacy policy</a>, which is part of these terms.</p>

<h2>Acceptable use</h2>
<p>Don't use Kauzl to break the law or anyone's rights; to get into data or accounts that aren't yours; to overload, probe or attack the service or the sites it reads; or to resell access to it without our permission. We may suspend accounts that do.</p>

<h2>Other services</h2>
<p>Kauzl works with services run by others, such as Google, Microsoft Bing, GitHub, Vercel, Anthropic and OpenRouter. Your use of them is under their own terms, and some (like BigQuery queries in your own Google Cloud project, or AI keys you add) may cost you money with that provider. Kauzl caps the size of BigQuery queries it runs, but you're responsible for your own accounts with those services.</p>

<h2>No guarantees</h2>
<p>Kauzl is provided "as is". We work to keep it accurate and available, but numbers come from other services and can be delayed, sampled or wrong, and Kauzl's explanations and suggestions are estimates, not advice. Check anything important before you rely on it.</p>

<h2>Limit of liability</h2>
<p>To the extent the law allows, Kauzl is not liable for indirect or consequential losses, lost profits or lost data, and our total liability for any claim is limited to the amount you paid us for Kauzl in the 12 months before it (zero while Kauzl is free).</p>

<h2>Changes</h2>
<p>We may update these terms. If a change matters, we'll update the date above and tell signed-in users before it takes effect. Using Kauzl after that means you accept the new terms.</p>

<h2>Contact</h2>
<p>Questions about these terms: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`,
  });
}
