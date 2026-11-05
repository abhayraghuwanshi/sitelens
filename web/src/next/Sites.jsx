import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Page } from './Page.jsx';

// Every site, one sentence each from its own Story (last 28 whole days),
// sorted so the site that moved most comes first.
export function Sites({ sites }) {
  const stories = useAsync(() => Promise.all(sites.map((s) => api.get(`/sites/${s.id}/story?range=28d`).catch(() => null))), [sites.map((s) => s.id).join()]);
  const rows = sites.map((s, i) => ({ site: s, story: stories.data?.[i] || null }));
  if (stories.data) rows.sort((a, b) => Math.abs(b.story?.change ?? 0) - Math.abs(a.story?.change ?? 0));

  return (
    <Page title="Sites" sub="Last 28 whole days, against the 28 before">
      <div class="nx-sites">
        {rows.map(({ site, story }) => (
          <a key={site.id} class="nx-card nx-site-card" href={`#/site/${site.id}`}>
            <span class="nx-site-name"><b>{site.label}</b><span class="nx-dim">{site.demo ? 'Sample data' : site.host}</span></span>
            <span class="nx-site-line">{story ? story.headline : stories.loading ? 'Reading the story…' : 'No story yet: connect Google Analytics or Search Console in Setup.'}</span>
            {story && (
              <span class="nx-site-num">
                <b>{Math.round(story.value).toLocaleString('en-US')}</b>
                <span class={story.change === null ? 'nx-dim' : story.change >= 0 ? 'good' : 'bad'}>
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

// From almost nothing, the starting number says more than a percentage.
function changeText(story) {
  if (story.change === null) return story.metric === 'sessions' ? 'visits' : 'clicks';
  if (story.previous * 4 < story.value) return `from ${Math.round(story.previous).toLocaleString('en-US')}`;
  return `${story.change >= 0 ? '↑' : '↓'} ${Math.round(Math.abs(story.change) * 100)}%`;
}
