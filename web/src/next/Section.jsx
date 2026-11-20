import { usePersistent } from '../hooks.js';
import { Segmented } from '../components/ui.jsx';
import { Articles } from '../pages/Articles.jsx';
import { ContentCycles } from '../pages/ContentCycles.jsx';
import { AiSearch } from '../pages/AiSearch.jsx';
import { Funnels } from '../pages/Funnels.jsx';
import { Retention } from '../pages/Retention.jsx';
import { Events } from '../pages/Events.jsx';
import { Sessions } from '../pages/Sessions.jsx';
import { Explore as SqlConsole } from '../pages/Explore.jsx';
import { Page, SectionTabs } from './Page.jsx';
import { TrafficView } from './TrafficView.jsx';
import { GoalsView } from './GoalsView.jsx';
import { PagesList } from './PagesList.jsx';
import { PageView } from './PageView.jsx';
import { HealthView } from './HealthView.jsx';
import { SearchView, EngineSwitch, engineOf, engineSub } from './SearchView.jsx';
import { JourneysPage } from './Journeys.jsx';
import { OutcomesPage } from './Outcomes.jsx';
import { DiagnoseView } from './DiagnoseView.jsx';
import { SECTIONS, hrefFor, hasWarehouse } from './nav.js';

// The reports: Pages, Search, Traffic, Journeys, Goals and Raw data. Each is one
// question with a few tabs. `mode` says which ranges a tab reads (GA4's API
// ranges, BigQuery's 7/28/90 days); `own` tabs draw their own header and period;
// `period: false` tabs have none (a cycle is its own period, Health its own).
const TABS = {
  pages: {
    pages: { mode: 'content', component: PagesTab },
    cycles: { mode: 'content', component: ContentCycles, period: false },
    health: { component: HealthView, period: false },
  },
  search: {
    queries: { mode: 'api', component: SearchView },
    ai: { mode: 'api', component: AiSearch },
  },
  traffic: {
    sources: { mode: 'api', component: TrafficView },
  },
  journeys: {
    journeys: { own: JourneysPage },
    funnels: { mode: 'warehouse', component: Funnels },
    retention: { mode: 'warehouse', component: Retention },
  },
  goals: {
    numbers: { mode: 'api', component: GoalsView },
    results: { own: OutcomesPage },
  },
  diagnose: {
    run: { own: DiagnoseView },
  },
  raw: {
    events: { mode: 'warehouse', component: Events },
    paths: { mode: 'warehouse', component: Sessions },
    sql: { mode: 'warehouse', component: SqlConsole },
  },
};

const WAREHOUSE_TABS = new Set(['paths', 'retention', 'events', 'sql']);

export function Section({ view, tab: wanted, site, params, auth, ranges: lists }) {
  const [saved, setSaved] = usePersistent('range', '28d');
  // Pages (and a page's view) keep their own period, defaulting to 90 days like their suggestions.
  const [pagesRange, setPagesRange] = usePersistent('pagesRange', '90d');
  const sec = SECTIONS[view];
  const tabs = sec.tabs.filter(([k]) => !WAREHOUSE_TABS.has(k) || hasWarehouse(site));
  // A few views live behind a link instead of in the tab row (Edit steps, Retention).
  const hidden = !tabs.some(([k]) => k === wanted) && Boolean(TABS[view][wanted]);
  const tab = hidden ? wanted : tabs.find(([k]) => k === wanted)?.[0] || tabs[0][0];
  const spec = TABS[view][tab];
  // A page opens as its own view (its story); ?edit=1 opens the editor inside Pages.
  const page = view === 'pages' && tab === 'pages' && (params.get('article') || params.get('path'));
  if (page && !params.get('edit')) {
    return <PageView key={`${site.id}:${page}`} site={site} path={page} back={{ href: `#/site/${site.id}/pages`, label: 'All pages' }} />;
  }

  const nav = tabs.length > 1 ? (
    <nav class="tabs nx-tabs-row" aria-label={sec.label}>
      {tabs.map(([k, l]) => (
        <a key={k} class={k === tab ? 'active' : undefined} href={hrefFor(site.id, view, k === tabs[0][0] ? '' : k)} aria-current={k === tab ? 'page' : undefined}>{l}</a>
      ))}
    </nav>
  ) : null;

  if (spec.own) {
    const Own = spec.own;
    return (
      <SectionTabs.Provider value={nav}>
        <Own key={`${site.id}:${tab}`} site={site} params={params} />
      </SectionTabs.Provider>
    );
  }

  const ranges = spec.mode === 'warehouse' ? lists.warehouse : lists.api;
  const pages = view === 'pages';
  const want = pages ? pagesRange : params.get('range') || saved;
  const range = ranges.some((r) => r.key === want) ? want : pages ? '90d' : '28d';
  const View = spec.component;
  const period = spec.period !== false && (
    <Segmented label="Date range" value={range} options={ranges} onChange={(key) => {
      if (pages) return setPagesRange(key);
      setSaved(key);
      // Keep the tab and anything open; only the range changes.
      const next = new URLSearchParams(params);
      next.set('range', key);
      // Older links (#/site/<id>/sessions…) carry no ?tab; keep the tab they opened.
      if (tab !== tabs[0][0]) next.set('tab', tab);
      location.hash = `/site/${site.id}/${view}?${next}`;
    }} />
  );

  // Search's searches: which engine sits in the header beside the period.
  const searchTab = view === 'search' && tab === 'queries';
  return (
    <SectionTabs.Provider value={nav}>
      <Page title={sec.label}
        sub={searchTab ? `${engineSub(engineOf(params))}, plus AI answers · ${site.label}` : `${sec.q} · ${site.label}`}
        actions={searchTab ? <span class="nx-head-ctl"><EngineSwitch params={params} />{period}</span> : period || null}
        back={hidden ? { href: hrefFor(site.id, view), label: sec.label } : view === 'raw' ? { href: hrefFor(site.id, 'journeys'), label: 'Journeys' } : null}>
        <SectionTabs.Provider value={null}>
          <div class="nx-explore-body">
            <View key={`${site.id}:${tab}`} site={site} range={range} params={params} auth={auth} />
          </div>
        </SectionTabs.Provider>
      </Page>
    </SectionTabs.Provider>
  );
}

// A report picked with All sites in scope: say what it shows, and pick a site.
export function PickSite({ view, sites }) {
  const sec = SECTIONS[view];
  const list = sites.filter((s) => view !== 'journeys' && view !== 'raw' ? true : hasWarehouse(s));
  return (
    <Page title={sec.label} sub={`${sec.q}. Pick a site:`}>
      <div class="nx-pick">
        {list.map((s) => (
          <a key={s.id} class="nx-pick-row" href={hrefFor(s.id, view)}>
            <b>{s.label}</b><span class="muted">{s.demo ? 'Sample data' : s.host}</span>
          </a>
        ))}
      </div>
    </Page>
  );
}

// All pages: every page with its verdict; a page opens its own view (?article=,
// or ?path= from older traffic links). Search's summary sits above the list.
function PagesTab({ site, range, params }) {
  const open = params.get('article') || params.get('path');
  if (open) {
    const p = new URLSearchParams(params);
    p.delete('path');
    p.set('article', open);
    // Closing the editor goes back to the page's own view.
    return <Articles site={site} range={range} params={p} onClose={() => { location.hash = `/site/${site.id}/pages?article=${encodeURIComponent(open)}`; }} />;
  }
  return <PagesList site={site} range={range} />;
}
