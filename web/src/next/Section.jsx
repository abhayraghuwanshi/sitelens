import { usePersistent } from '../hooks.js';
import { Segmented, PullDown } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Articles } from '../pages/Articles.jsx';
import { ArticleEditor } from '../pages/ArticleEditor.jsx';
import { ContentCycles } from '../pages/ContentCycles.jsx';
import { AiSearch } from '../pages/AiSearch.jsx';
import { Funnels } from '../pages/Funnels.jsx';
import { Retention } from '../pages/Retention.jsx';
import { Events } from '../pages/Events.jsx';
import { Sessions } from '../pages/Sessions.jsx';
import { Explore as SqlConsole } from '../pages/Explore.jsx';
import { Page, SectionTabs, SectionTitle, usePhoneWidth } from './Page.jsx';
import { TrafficView } from './TrafficView.jsx';
import { GoalsView } from './GoalsView.jsx';
import { GoalsEdit } from './GoalsEdit.jsx';
import { PagesList, PagesSort, PagesFilter } from './PagesList.jsx';
import { PageView } from './PageView.jsx';
import { HealthView } from './HealthView.jsx';
import { SearchView, EngineSwitch, engineOf, engineSub } from './SearchView.jsx';
import { JourneysPage } from './Journeys.jsx';
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
  const phone = usePhoneWidth();
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
  // Edit goals: just the site's goals on their own screen, back to Goals when saved.
  if (view === 'goals' && params.get('edit') === '1' && !site.demo && !site.shared) {
    const goalsPage = `#/site/${site.id}/goals`;
    return (
      <Page title="Edit goals" sub={`What counts as a result on ${site.label}`} back={{ href: goalsPage, label: 'Goals' }}>
        <GoalsEdit key={site.id} site={site} done={() => { location.hash = goalsPage; }} />
      </Page>
    );
  }
  // Edit the page: only the editing (title, description, the article, Claude's ideas, publish), back to its view.
  if (page) {
    const view = `#/site/${site.id}/pages?article=${encodeURIComponent(page)}`;
    return (
      <Page title="Edit the page" sub={page} back={{ href: view, label: 'Back to the page' }}>
        <ArticleEditor key={`${site.id}:${page}`} site={site} range={pagesRange} path={page} only="content" onClose={() => { location.hash = view; }} />
      </Page>
    );
  }

  const nav = tabs.length > 1 ? (
    <nav class="tabs nx-tabs-row" aria-label={sec.label}>
      {tabs.map(([k, l]) => (
        <a key={k} class={k === tab ? 'active' : undefined} href={hrefFor(site.id, view, k === tabs[0][0] ? '' : k)} aria-current={k === tab ? 'page' : undefined}>{l}</a>
      ))}
    </nav>
  ) : null;
  // Phone: the same tabs as a menu on the title.
  const titleMenu = phone && tabs.length > 1 && !hidden ? (
    <PullDown big label={sec.label} value={tab} options={tabs.map(([key, label]) => ({ key, label }))}
      onChange={(k) => { location.hash = hrefFor(site.id, view, k === tabs[0][0] ? '' : k).replace(/^#/, ''); }} />
  ) : null;

  if (spec.own) {
    const Own = spec.own;
    return (
      <SectionTabs.Provider value={nav}>
        <SectionTitle.Provider value={titleMenu}>
          <Own key={`${site.id}:${tab}`} site={site} params={params} />
        </SectionTitle.Provider>
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

  // Goals: editing them sits in the header (its own screen; a .sitelens.yml site is pointed to its file there).
  const goalsEdit = view === 'goals' && !site.demo && !site.shared ? `#/site/${site.id}/goals?edit=1` : '';
  // Search's searches: which engine sits in the header beside the period.
  const searchTab = view === 'search' && tab === 'queries';
  // All pages (not a page opened from it): its sort sits in the header with the period.
  const pagesList = view === 'pages' && tab === 'pages' && !params.get('article') && !params.get('path');
  return (
    <SectionTabs.Provider value={nav}>
      <SectionTitle.Provider value={titleMenu}>
      <Page title={sec.label}
        corner={goalsEdit && phone ? <a class="nx-corner" href={goalsEdit}><Icon name="target" size={13} /> Edit goals</a> : null}
        actions={goalsEdit && !phone ? <a class="btn" href={goalsEdit}><Icon name="target" size={13} /> Edit goals</a> : null}
        sub={searchTab ? `${engineSub(engineOf(params))}, plus AI answers · ${site.label}` : `${sec.q} · ${site.label}`}
        time={period || null}
        options={searchTab ? <EngineSwitch params={params} /> : pagesList ? <><PagesSort params={params} />{phone && <PagesFilter site={site} range={range} params={params} />}</> : null}
        back={hidden ? { href: hrefFor(site.id, view), label: sec.label } : view === 'raw' ? { href: hrefFor(site.id, 'journeys'), label: 'Journeys' } : null}>
        <SectionTabs.Provider value={null}>
          <SectionTitle.Provider value={null}>
            <div class="nx-explore-body">
              <View key={`${site.id}:${tab}`} site={site} range={range} params={params} auth={auth} />
            </div>
          </SectionTitle.Provider>
        </SectionTabs.Provider>
      </Page>
      </SectionTitle.Provider>
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
  return <PagesList site={site} range={range} params={params} />;
}
