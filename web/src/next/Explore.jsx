import { usePersistent } from '../hooks.js';
import { Segmented } from '../components/ui.jsx';
import { Overview } from '../pages/Overview.jsx';
import { PageReview } from '../pages/PageReview.jsx';
import { Articles } from '../pages/Articles.jsx';
import { ContentCycles } from '../pages/ContentCycles.jsx';
import { SearchHub } from '../pages/SearchHub.jsx';
import { AiSearch } from '../pages/AiSearch.jsx';
import { Paths } from '../pages/Paths.jsx';
import { Funnels } from '../pages/Funnels.jsx';
import { Retention } from '../pages/Retention.jsx';
import { Events } from '../pages/Events.jsx';
import { Sessions } from '../pages/Sessions.jsx';
import { Explore as SqlConsole } from '../pages/Explore.jsx';
import { Page } from './Page.jsx';
import { Campaigns } from './Campaigns.jsx';

// Explore: every full report from the classic layout, as tabs. The Story links
// into these for detail. Ranges follow what each report reads: GA4 reports take
// the API ranges, BigQuery ones 7/28/90 days, Bing its long history.
export const EXPLORE_TABS = [
  // Pages, searches and articles in one: every page (and its own view, the
  // article editor), the searches that find them, and GA4's page report.
  { key: 'pages', label: 'Pages', mode: 'content', component: PagesTab },
  // Articles measured every cycle in Google, Bing and AI: grow, improve or cut.
  // A cycle is its own period, so the tab has no date range.
  // Tagged links (utm), every source / medium, and Google Ads when GA4 is linked to it.
  { key: 'campaigns', label: 'Campaigns', mode: 'api', component: Campaigns },
  { key: 'cycles', label: 'Content cycles', mode: 'content', component: ContentCycles, ownPeriod: true },
  { key: 'ai', label: 'AI answers', mode: 'api', component: AiSearch },
  { key: 'sessions', label: 'Sessions', mode: 'warehouse', component: Sessions },
  { key: 'paths', label: 'Paths', mode: 'warehouse', component: Paths },
  { key: 'funnels', label: 'Funnels', mode: 'warehouse', component: Funnels },
  { key: 'retention', label: 'Retention', mode: 'warehouse', component: Retention },
  { key: 'events', label: 'Events', mode: 'warehouse', component: Events },
  { key: 'sql', label: 'SQL', mode: 'warehouse', component: SqlConsole },
  { key: 'overview', label: 'Classic overview', mode: 'api', component: Overview },
];

// Pages: the high level on top (Google and Bing for the site) and every page
// below it. Detail lives a click away, so this stays short: a page opens its
// own view (?article=, or ?path= from older traffic links), and the site's
// searches (rankings, demand, Bing crawl) open as their own view (?view=searches).
// `range` is the tab's period (Today … 90d, the switch in the header), for
// every number here and in a page's view; suggestions are judged on 90 days.
function PagesTab({ site, range, params }) {
  const open = params.get('article') || params.get('path');
  if (open) {
    const p = new URLSearchParams(params);
    p.delete('path');
    p.set('article', open);
    // Back always lands on the list, however the page was opened (?article= or ?path=).
    return <Articles site={site} range={range} params={p} onClose={() => { location.hash = `/site/${site.id}/pages`; }} />;
  }
  if (params.get('view') === 'searches') {
    return (
      <div class="pages-one">
        <div class="meta-line" style={{ alignItems: 'center' }}>
          <a class="btn ghost" href={`#/site/${site.id}/pages`}>← All pages</a>
          <span class="muted small">Searches across the site</span>
        </div>
        <SearchHub site={site} range={range} part="all" />
      </div>
    );
  }
  const search = site.modes?.search || site.modes?.bing;
  return (
    <div class="pages-one">
      {search && <SearchHub site={site} range={range} part="summary" />}
      <PageReview site={site} range={range} />
    </div>
  );
}

// Tabs that became views of Pages, so their old links still land there.
const MOVED = { search: 'searches', bing: 'searches', demand: 'searches', articles: '' };

export function ExploreFrame({ site, view, params, auth, ranges: lists }) {
  const [saved, setSaved] = usePersistent('range', '28d');
  // Pages (and a page's view) keep their own period, defaulting to 90 days like their suggestions.
  const [pagesRange, setPagesRange] = usePersistent('pagesRange', '90d');
  const moved = Object.hasOwn(MOVED, view);
  const tab = EXPLORE_TABS.find((t) => t.key === (moved ? 'pages' : view)) || EXPLORE_TABS[0];
  if (moved && MOVED[view] && !params.get('view')) {
    params = new URLSearchParams(params);
    params.set('view', MOVED[view]);
  }
  const shown = EXPLORE_TABS.filter((t) => t.mode === 'api' || site.modes?.[t.mode] !== false);
  const ranges = tab.mode === 'warehouse' ? lists.warehouse : tab.mode === 'bing' ? lists.history : lists.api;
  const pages = tab.key === 'pages';
  const wanted = pages ? pagesRange : params.get('range') || saved;
  const range = ranges.some((r) => r.key === wanted) ? wanted : pages ? '90d' : '28d';
  const View = tab.component;

  return (
    <Page title="Explore" sub={`Every full report for ${site.label}. The Story links here for detail.`}
      actions={tab.ownPeriod ? null : <Segmented label="Date range" value={range} options={ranges} onChange={(key) => {
        if (pages) return setPagesRange(key);
        setSaved(key);
        // Keep the view and the open page; only the range changes.
        const next = new URLSearchParams(params);
        next.set('range', key);
        location.hash = `/site/${site.id}/${tab.key}?${next}`;
      }} />}>
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
