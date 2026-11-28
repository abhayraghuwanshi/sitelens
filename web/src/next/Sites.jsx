import { formatRelative } from '@shared/format.js';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Page } from './Page.jsx';
import { Icon } from '../components/icons.jsx';
import { BrandIcon } from '../components/BrandIcon.jsx';
import { useTodos } from '../components/Todos.jsx';
import { grouped, headline, stageOf } from './Inbox.jsx';

export const ADD_SITE = '#/account?tab=sites&edit=new';

// All sites' home, the page you see when no site is picked (like an editor's
// start page). Left: ways to start, then your sites, the one that moved most
// first. Right: what's waiting on you across every site, and short walk-throughs.
// Picking a site leaves this page for that site's Timeline.
export function Sites({ sites, auth, viewer, browser = false, goals }) {
  const stories = useAsync(() => Promise.all(sites.map((s) => api.get(`/sites/${s.id}/story?range=28d`).catch(() => null))), [sites.map((s) => s.id).join()]);
  const rows = sites.map((s, i) => ({ site: s, story: stories.data?.[i] || null }));
  if (stories.data) rows.sort((a, b) => Math.abs(b.story?.change ?? 0) - Math.abs(a.story?.change ?? 0));
  const fresh = !viewer && !sites.some((s) => !s.demo);

  return (
    <Page title="Home" sub={`${sites.length} site${sites.length === 1 ? '' : 's'} · pick one to open its Timeline`}>
      {fresh && (browser ? <GetStartedBrowser /> : <GetStarted auth={auth} />)}
      <div class="nx-home">
        <div class="nx-home-col">
          {!viewer && (
            <section class="nx-home-sec k-start" aria-label="Start">
              <h2 class="nx-label-sm">Start</h2>
              <ul class="nx-home-links">
                <li><a href={ADD_SITE}><Icon name="plus" size={15} />Add a site</a></li>
                <li><a href="#/account?tab=integrations"><Icon name="plug" size={15} />Connect a data source</a></li>
                <li><a href="#/timeline"><Icon name="calendar" size={15} />Timeline of every site</a></li>
                <li><a href="#/inbox?add=1"><Icon name="check" size={15} />Add a to-do</a></li>
                {!browser && <li><a href="#/account?tab=mcp"><Icon name="terminal" size={15} />Connect Claude (MCP)</a></li>}
              </ul>
            </section>
          )}
          <section class="nx-home-sec k-sites" aria-label="Your sites">
            <h2 class="nx-label-sm">Your sites <span class="nx-home-note">last 28 days against the 28 before</span></h2>
            <div class="nx-home-sites">
              {rows.map(({ site, story }) => (
                <a key={site.id} class="nx-home-site" href={`#/site/${site.id}`}>
                  <span class="nx-home-sname"><b>{site.label}</b><small class="muted">{site.demo ? 'Sample data' : site.shared ? `Shared by ${site.shared.by}` : site.host}</small></span>
                  <span class="nx-home-sline">{story ? story.headline : stories.loading ? 'Reading…' : 'No numbers yet: connect Google Analytics or Search Console in its settings.'}</span>
                  {story && (
                    <span class="nx-home-snum">
                      <b>{Math.round(story.value).toLocaleString('en-US')}</b>
                      <small class={story.change === null ? 'muted' : story.change >= 0 ? 'good' : 'bad'}>{changeText(story)}</small>
                    </span>
                  )}
                </a>
              ))}
            </div>
          </section>
        </div>
        <div class="nx-home-col">
          <Waiting sites={sites} auth={auth} viewer={viewer} goals={goals} />
          <section class="nx-home-sec k-learn" aria-label="Walk-throughs">
            <h2 class="nx-label-sm">Walk-throughs</h2>
            <ul class="nx-home-links">
              <li><a href="#/timeline?tour=1"><Icon name="sparkles" size={15} /><span>Read the Timeline<small>What the colours, marks and side panel mean</small></span></a></li>
              {!viewer && !browser && <li><a href="#/account?tab=mcp"><Icon name="terminal" size={15} /><span>Let Claude work your to-dos<small>It reads the data, makes the change and writes up what it did</small></span></a></li>}
              <li><a href="#/inbox"><Icon name="inbox" size={15} /><span>How the Inbox works<small>Alerts, to-dos and goals behind, all in one place</small></span></a></li>
            </ul>
          </section>
          {!viewer && <TrackMore />}
        </div>
      </div>
    </Page>
  );
}

// Everything waiting on you, every site: a broken sign-in first, then unread
// alerts, to-dos with something to look at, and goals behind. Each opens where
// it's dealt with; the rest are in the Inbox.
function Waiting({ sites, auth, viewer, goals }) {
  const feed = useAsync(() => api.get('/alerts').catch(() => null), []);
  const todos = useTodos({ status: 'open' });
  const nameOf = (id) => sites.find((s) => s.id === id)?.label || '';
  const items = [];
  if (!viewer && auth?.connected && (auth.expired || auth.broken)) {
    items.push({ key: 'google', icon: 'triangle', tone: 'bad', title: auth.expired ? 'Google sign-in expired' : 'Google needs you', meta: 'Analytics and Search Console stop updating until you reconnect', href: '#/account?i=google', at: Infinity });
  }
  for (const g of grouped((feed.data?.alerts || []).filter((a) => !a.read))) {
    const a = g[0];
    items.push({ key: `a${a.id}`, icon: 'bell', tone: a.direction === 'down' ? 'bad' : '', title: headline(a), meta: [nameOf(a.site), formatRelative(a.at)].filter(Boolean).join(' · '), href: `#/inbox?tab=alerts&open=${encodeURIComponent(a.id)}`, at: a.at });
  }
  for (const t of todos.data?.todos || []) {
    const [stage] = stageOf(t);
    items.push({ key: `t${t.id}`, icon: 'check', tone: '', title: t.title, meta: [nameOf(t.site), stage].filter(Boolean).join(' · '), href: `#/inbox?tab=todos&open=${encodeURIComponent(t.id)}`, at: t.entries?.at(-1)?.at || t.createdAt || 0 });
  }
  for (const g of (goals?.data || []).filter((x) => x.status === 'behind')) {
    items.push({ key: `g${g.site}${g.path}`, icon: 'target', tone: 'bad', title: g.goal, meta: [nameOf(g.site), 'Goal behind'].filter(Boolean).join(' · '), href: `#/site/${g.site}/pages?article=${encodeURIComponent(g.path)}`, at: 0 });
  }
  items.sort((a, b) => b.at - a.at);
  const loading = !feed.data && feed.loading;
  const shown = items.slice(0, 6);
  return (
    <section class="nx-home-sec k-wait" aria-label="Waiting on you">
      <h2 class="nx-label-sm">Waiting on you{items.length > 0 && <span class="nx-home-n">{items.length}</span>}</h2>
      {loading ? <p class="muted small m-0">Looking…</p>
        : !items.length ? <p class="muted small m-0">Nothing waiting. New alerts and to-dos show up here.</p>
        : (
          <ul class="nx-home-wait">
            {shown.map((x) => (
              <li key={x.key}>
                <a href={x.href}>
                  <span class={`nx-home-wico${x.tone ? ` ${x.tone}` : ''}`}><Icon name={x.icon} size={13} /></span>
                  <span class="nx-home-wtext"><b>{x.title}</b><small class="muted">{x.meta}</small></span>
                </a>
              </li>
            ))}
          </ul>
        )}
      {items.length > shown.length && <a class="nx-home-more" href="#/inbox">All {items.length} in the Inbox →</a>}
    </section>
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
    <section class="nx-home-sec k-more" aria-label="Track more of what you ship">
      <h2 class="nx-label-sm">Track more of what you ship</h2>
      <ul class="nx-home-links">
        {cards.map((p) => (
          <li key={p.key}><a href={p.href}><BrandIcon name={p.key} /><span>{p.title}<small>{p.text}</small></span></a></li>
        ))}
      </ul>
      <a class="nx-home-more" href="#/account?tab=integrations">All connections →</a>
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
