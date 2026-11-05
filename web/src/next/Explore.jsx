import { usePersistent } from '../hooks.js';
import { Segmented } from '../components/ui.jsx';
import { Overview } from '../pages/Overview.jsx';
import { Pages } from '../pages/Pages.jsx';
import { Articles } from '../pages/Articles.jsx';
import { Search } from '../pages/Search.jsx';
import { Bing } from '../pages/Bing.jsx';
import { AiSearch } from '../pages/AiSearch.jsx';
import { Demand } from '../pages/Demand.jsx';
import { Paths } from '../pages/Paths.jsx';
import { Funnels } from '../pages/Funnels.jsx';
import { Retention } from '../pages/Retention.jsx';
import { Events } from '../pages/Events.jsx';
import { Sessions } from '../pages/Sessions.jsx';
import { Explore as SqlConsole } from '../pages/Explore.jsx';
import { Page } from './Page.jsx';

// Explore: every full report from the classic layout, as tabs. The Story links
// into these for detail. Ranges follow what each report reads: GA4 reports take
// the API ranges, BigQuery ones 7/28/90 days, Bing its long history.
export const EXPLORE_TABS = [
  { key: 'pages', label: 'Pages', mode: 'api', component: Pages },
  { key: 'search', label: 'Google', mode: 'search', component: Search },
  { key: 'bing', label: 'Bing', mode: 'bing', component: Bing },
  { key: 'ai', label: 'AI answers', mode: 'api', component: AiSearch },
  { key: 'demand', label: 'Demand', mode: 'search', component: Demand },
  { key: 'articles', label: 'Articles', mode: 'content', component: Articles },
  { key: 'sessions', label: 'Sessions', mode: 'warehouse', component: Sessions },
  { key: 'paths', label: 'Paths', mode: 'warehouse', component: Paths },
  { key: 'funnels', label: 'Funnels', mode: 'warehouse', component: Funnels },
  { key: 'retention', label: 'Retention', mode: 'warehouse', component: Retention },
  { key: 'events', label: 'Events', mode: 'warehouse', component: Events },
  { key: 'sql', label: 'SQL', mode: 'warehouse', component: SqlConsole },
  { key: 'overview', label: 'Classic overview', mode: 'api', component: Overview },
];

export function ExploreFrame({ site, view, params, auth, ranges: lists }) {
  const [saved, setSaved] = usePersistent('range', '28d');
  const tab = EXPLORE_TABS.find((t) => t.key === view) || EXPLORE_TABS[0];
  const shown = EXPLORE_TABS.filter((t) => t.mode === 'api' || site.modes?.[t.mode] !== false);
  const ranges = tab.mode === 'warehouse' ? lists.warehouse : tab.mode === 'bing' ? lists.history : lists.api;
  const wanted = params.get('range') || saved;
  const range = ranges.some((r) => r.key === wanted) ? wanted : '28d';
  const View = tab.component;

  return (
    <Page title="Explore" sub={`Every full report for ${site.label}. The Story links here for detail.`}
      actions={<Segmented label="Date range" value={range} options={ranges} onChange={(key) => { setSaved(key); location.hash = `/site/${site.id}/${tab.key}?range=${key}`; }} />}>
      <nav class="nx-tabs" aria-label="Reports">
        {shown.map((t) => (
          <a key={t.key} class={`nx-tab${t === tab ? ' active' : ''}`} href={`#/site/${site.id}/${t.key}`} aria-current={t === tab ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      <div class="nx-explore-body">
        <View key={`${site.id}:${tab.key}`} site={site} range={range} params={params} auth={auth} />
      </div>
    </Page>
  );
}
