import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Page } from './Page.jsx';
import { Icon } from '../components/icons.jsx';
import { BrandIcon } from '../components/BrandIcon.jsx';

export const ADD_SITE = '#/account?tab=sites&edit=new';

// Every site, one sentence each from its own Story (last 28 whole days),
// sorted so the site that moved most comes first.
export function Sites({ sites, auth, viewer, browser = false }) {
  const stories = useAsync(() => Promise.all(sites.map((s) => api.get(`/sites/${s.id}/story?range=28d`).catch(() => null))), [sites.map((s) => s.id).join()]);
  const rows = sites.map((s, i) => ({ site: s, story: stories.data?.[i] || null }));
  if (stories.data) rows.sort((a, b) => Math.abs(b.story?.change ?? 0) - Math.abs(a.story?.change ?? 0));

  return (
    <Page title="Sites" sub="Last 28 whole days, against the 28 before"
      actions={viewer ? null : <a class="btn primary" href={ADD_SITE}><Icon name="plus" size={14} /> Add a site</a>}>
      {browser && <CloudSave />}
      {!viewer && !sites.some((s) => !s.demo) && (browser ? <GetStartedBrowser /> : <GetStarted auth={auth} />)}
      <div class="nx-sites">
        {rows.map(({ site, story }) => (
          <a key={site.id} class="card card-plain nx-site-card" href={`#/site/${site.id}`}>
            <span class="nx-site-name"><b>{site.label}</b><span class="muted">{site.demo ? 'Sample data' : site.host}</span></span>
            <span class="nx-site-line">{story ? story.headline : stories.loading ? 'Reading the story…' : 'No story yet: edit the site to connect Google Analytics or Search Console.'}</span>
            {story && (
              <span class="nx-site-num">
                <b>{Math.round(story.value).toLocaleString('en-US')}</b>
                <span class={story.change === null ? 'muted' : story.change >= 0 ? 'good' : 'bad'}>
                  {changeText(story)}
                </span>
              </span>
            )}
          </a>
        ))}
      </div>
      {!viewer && <TrackMore />}
    </Page>
  );
}

// "Track more of what you ship": a few things not connected yet, each one click from here.
const PROMOS = [
  { key: 'vercel', title: 'Vercel deploys', text: 'Every production deploy, on the day it shipped.', href: '#/account?i=vercel', action: 'Connect', on: (i) => i.vercel?.source },
  { key: 'github', title: 'GitHub releases & stars', text: 'Releases on the calendar; views, clones and stars daily.', href: '#/account?i=github', action: 'Connect', on: (i) => i.github?.source },
  { key: 'extensions', title: 'Your browser extension', text: 'Installs, users, rating and every new version.', href: '#/extensions', action: 'Add', on: (i) => i.extensions?.count > 0 },
  { key: 'netlify', title: 'Netlify deploys', text: 'Production deploys, failed ones too.', href: '#/account?i=netlify', action: 'Connect', on: (i) => i.netlify?.source },
  { key: 'plausible', title: 'Plausible visits', text: 'Cookieless visitors and goals, next to what you shipped.', href: '#/account?i=plausible', action: 'Connect', on: (i) => i.plausible?.source },
  { key: 'posthog', title: 'PostHog product data', text: 'Sessions, top pages and conversions.', href: '#/account?i=posthog', action: 'Connect', on: (i) => i.posthog?.source },
  { key: 'cloudflare', title: 'Cloudflare Web Analytics', text: 'Privacy-first visits and referrers.', href: '#/account?i=cloudflare', action: 'Connect', on: (i) => i.cloudflare?.source },
  { key: 'fly', title: 'Fly.io releases', text: 'Each release, and requests and errors per app.', href: '#/account?i=fly', action: 'Connect', on: (i) => i.fly?.source },
  { key: 'bing', title: 'Bing search', text: 'Clicks and queries, plus what feeds Copilot and ChatGPT search.', href: '#/account?i=bing', action: 'Connect', on: (i) => i.bing?.source },
];

function TrackMore() {
  const info = useAsync(() => api.get('/integrations').catch(() => null), []);
  if (!info.data) return null;
  const cards = PROMOS.filter((p) => !p.on(info.data)).slice(0, 4);
  if (!cards.length) return null;
  return (
    <section class="nx-promo" aria-label="Track more of what you ship">
      <div class="nx-promo-h">
        <h2>Track more of what you ship</h2>
        <a href="#/account?tab=integrations">All connections →</a>
      </div>
      <div class="nx-promo-grid">
        {cards.map((p) => (
          <a key={p.key} class="card card-plain nx-promo-card" href={p.href}>
            <BrandIcon name={p.key} />
            <b>{p.title}</b>
            <span class="muted">{p.text}</span>
            <span class="nx-promo-go">{p.action} <Icon name="chevron" size={12} /></span>
          </a>
        ))}
      </div>
    </section>
  );
}

// Browser mode: everything lives in this browser until you sign in to Kauzl.
function CloudSave() {
  return (
    <section class="card card-plain nx-cloud" aria-label="Save to the cloud">
      <span class="nx-cloud-ico" aria-hidden="true"><Icon name="cloud" size={20} /></span>
      <span class="nx-cloud-text">
        <b>Save to the cloud: sign in to Kauzl</b>
        <span class="muted">Right now your sites and keys live only in this browser. A Kauzl account keeps them on every device. Bringing this browser’s setup into your account is coming soon.</span>
      </span>
      <a class="btn primary" href="/login">Sign in to Kauzl</a>
    </section>
  );
}

// Browser mode (no sign-in): nothing to log in to. Add the site, paste a key
// for where its numbers live, and sign in later only if you want cloud sync.
function GetStartedBrowser() {
  const steps = [
    { title: 'Add your site', text: 'Just its address to start. No account needed: everything you set up stays in this browser.', href: ADD_SITE, action: 'Add a site', primary: true },
    { title: 'Connect where its numbers come from', text: 'Paste a key for Plausible, PostHog or Cloudflare Web Analytics, or a Google access token to try it with your Analytics and Search Console. About a minute each.', href: '#/account?tab=integrations', action: 'Connections' },
  ];
  return (
    <section class="card card-plain nx-start" aria-label="Get started">
      <div>
        <h2>Get started</h2>
        <p class="muted">The sample site below shows what you’ll see. Two steps to see your own, no sign-in needed.</p>
      </div>
      <ol class="nx-steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span class="nx-step-num" aria-hidden="true">{i + 1}</span>
            <span class="nx-step-text"><b>{s.title}</b><span class="muted">{s.text}</span></span>
            {s.later ? <span class="nx-step-later">Later</span> : <a class={`btn${s.primary ? ' primary' : ''}`} href={s.href}>{s.action}</a>}
          </li>
        ))}
      </ol>
    </section>
  );
}

// Until a real site is added: the three steps, each a link to where it's done.
function GetStarted({ auth }) {
  const google = auth?.connected && !auth.expired;
  const steps = [
    { done: google, title: 'Connect Google', text: 'Lets Kauzl read your Analytics, Search Console and BigQuery.', href: '#/account?i=google', action: 'Connect' },
    { done: false, title: 'Add your site', text: 'Pick its GA4 property and Search Console property. BigQuery is found for you.', href: ADD_SITE, action: 'Add a site', primary: google },
    { done: false, title: 'Connect the rest (optional)', text: 'Bing, Vercel, GitHub, Firebase and more, each with one click where it can be.', href: '#/account', action: 'Integrations' },
  ];
  return (
    <section class="card card-plain nx-start" aria-label="Get started">
      <div>
        <h2>Get started</h2>
        <p class="muted">The sample site below shows what you’ll see. Three steps to see your own.</p>
      </div>
      <ol class="nx-steps">
        {steps.map((s, i) => (
          <li key={s.title} class={s.done ? 'done' : ''}>
            <span class="nx-step-num" aria-hidden="true">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
            <span class="nx-step-text"><b>{s.title}</b><span class="muted">{s.done ? 'Done.' : s.text}</span></span>
            {!s.done && <a class={`btn${s.primary ? ' primary' : ''}`} href={s.href}>{s.action}</a>}
          </li>
        ))}
      </ol>
    </section>
  );
}

// From almost nothing, the starting number says more than a percentage.
function changeText(story) {
  if (story.change === null) return story.metric === 'sessions' ? 'visits' : 'clicks';
  if (story.previous * 4 < story.value) return `from ${Math.round(story.previous).toLocaleString('en-US')}`;
  return `${story.change >= 0 ? '↑' : '↓'} ${Math.round(Math.abs(story.change) * 100)}%`;
}
