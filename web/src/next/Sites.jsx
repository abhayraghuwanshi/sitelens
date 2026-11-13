import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Page } from './Page.jsx';
import { Icon } from '../components/icons.jsx';

export const ADD_SITE = '#/account?tab=sites&edit=new';

// Every site, one sentence each from its own Story (last 28 whole days),
// sorted so the site that moved most comes first.
export function Sites({ sites, auth, viewer }) {
  const stories = useAsync(() => Promise.all(sites.map((s) => api.get(`/sites/${s.id}/story?range=28d`).catch(() => null))), [sites.map((s) => s.id).join()]);
  const rows = sites.map((s, i) => ({ site: s, story: stories.data?.[i] || null }));
  if (stories.data) rows.sort((a, b) => Math.abs(b.story?.change ?? 0) - Math.abs(a.story?.change ?? 0));

  return (
    <Page title="Sites" sub="Last 28 whole days, against the 28 before"
      actions={viewer ? null : <a class="btn primary" href={ADD_SITE}><Icon name="plus" size={14} /> Add a site</a>}>
      {!viewer && !sites.some((s) => !s.demo) && <GetStarted auth={auth} />}
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
    </Page>
  );
}

// Until a real site is added: the three steps, each a link to where it's done.
function GetStarted({ auth }) {
  const google = auth?.connected && !auth.expired;
  const steps = [
    { done: google, title: 'Connect Google', text: 'Lets Studio read your Analytics, Search Console and BigQuery.', href: '#/account?i=google', action: 'Connect' },
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
