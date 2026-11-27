import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section } from './ConnectionKit.jsx';

const editHref = (siteId) => `#/account?${new URLSearchParams({ tab: 'sites', edit: siteId, part: 'code' })}`;
const repoHref = (name) => `https://github.com/${name}`;
const short = (name) => name.split('/')[1] || name;
const n = (v) => Number(v || 0).toLocaleString();

// Below the GitHub connection: which repos each site uses, and every repo Kauzl stores.
export function GitHubRepos({ connected }) {
  const sites = useAsync(() => (connected ? api.get('/github/sites') : Promise.resolve({ sites: [] })), [connected]);
  const overview = useAsync(() => (connected ? api.get('/github/overview?range=28d') : Promise.resolve({ repos: [] })), [connected]);
  const [filter, setFilter] = useState('');
  if (!connected) return null;

  const siteRows = sites.data?.sites || [];
  const repos = (overview.data?.repos || []).filter((r) => !r.archived);
  const q = filter.trim().toLowerCase();
  const shown = (q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : repos)
    .slice().sort((a, b) => (b.views - a.views) || (b.stars - a.stars) || a.name.localeCompare(b.name));

  return (
    <>
      {siteRows.length > 0 && (
        <Section title="Your sites on GitHub" sub="Linked in each site’s setup, or found because the repo’s homepage is the site. Change one if it’s wrong.">
          <div class="cx-list">
            {siteRows.map((s) => (
              <div key={s.siteId} class="cx-list-row">
                <span class="cx-list-name"><b>{s.label}</b><span class="small muted">{s.host}</span></span>
                <span class="row gap-6">
                  {s.repos.length
                    ? <span class="small">{s.repos.map((r, i) => <span key={r}>{i > 0 && ', '}<a href={repoHref(r)} target="_blank" rel="noreferrer">{short(r)}</a></span>)}</span>
                    : <span class="small muted">{s.note || 'No repo linked'}</span>}
                  <a class="small" href={editHref(s.siteId)}>{s.repos.length ? 'Change' : 'Link a repo'}</a>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Repos" sub={`${repos.length} repo${repos.length === 1 ? '' : 's'} synced hourly. Views and clones are the last 28 days.`}>
        {repos.length > 8 && (
          <input type="search" placeholder={`Search ${repos.length} repos`} value={filter}
            onInput={(e) => setFilter(e.currentTarget.value)} aria-label="Search repos" style={{ marginBottom: '8px', width: '100%' }} />
        )}
        {overview.loading && !repos.length
          ? <p class="small muted m-0">Loading repos…</p>
          : !shown.length
            ? <p class="small muted m-0">{q ? 'No repo matches.' : 'No repos yet. Sync now to fetch them.'}</p>
            : (
              <div class="cx-list">
                {shown.map((r) => (
                  <div key={r.name} class="cx-list-row">
                    <span class="cx-list-name">
                      <a href={repoHref(r.name)} target="_blank" rel="noreferrer"><b>{short(r.name)}</b></a>
                      <span class="small muted">{r.name.split('/')[0]}{r.fork ? ' · fork' : ''}</span>
                    </span>
                    <span class="small muted">{n(r.views)} views · {n(r.clones)} clones · {n(r.stars)} stars</span>
                  </div>
                ))}
              </div>
            )}
      </Section>
    </>
  );
}
