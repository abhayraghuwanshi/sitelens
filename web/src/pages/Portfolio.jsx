import { formatNumber, formatPercent } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Delta, Loading } from '../components/ui.jsx';
import { Sparkline } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { HealthStrip } from '../components/vitals.jsx';

export function Portfolio({ sites, range, auth }) {
  const data = useAsync(() => api.get(`/portfolio${qs({ range })}`), [range, sites.length]);
  const byId = new Map((data.data || []).map((r) => [r.id, r]));
  // Health loads on its own so a slow GA4 call never hides it (and vice versa).
  const health = useAsync(() => api.get('/vitals'), [sites.length]);
  const healthById = new Map((health.data?.sites || []).map((h) => [h.id, h]));
  const onlyDemo = sites.every((s) => s.demo);

  return (
    <>
      {onlyDemo && (
        <div class="state">
          <h3>You’re looking at sample data</h3>
          <p>
            Every view works on the demo site, including the warehouse views, which run on generated event-level data.
            {auth.connected ? ' Add your own sites in Settings.' : ' Connect Google and add a site to see your own numbers.'}
          </p>
          <a class="btn primary" href="#/settings?tab=sites"><Icon name="plus" size={14} /> Add a site</a>
        </div>
      )}
      <div class="site-cards">
        {sites.map((site) => {
          const row = byId.get(site.id);
          return (
            <button type="button" class="card site-card" key={site.id} onClick={() => navigate(`/site/${site.id}/overview`)}>
              <div class="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{site.label}</div>
                  <div class="muted small">{site.demo ? 'Sample data' : site.host}</div>
                </div>
                {row?.trend && <Sparkline values={row.trend.map((t) => t.sessions)} />}
              </div>
              {!row && data.loading && <Loading height={44} />}
              {row?.error && <p class="small" style={{ margin: 0, color: 'var(--critical-ink)' }}>{row.error}</p>}
              {row?.overview && (
                <div class="stats">
                  <Stat label="Users" cur={row.overview.current.activeUsers} prev={row.overview.previous.activeUsers} format={formatNumber} />
                  <Stat label="Sessions" cur={row.overview.current.sessions} prev={row.overview.previous.sessions} format={formatNumber} />
                  <Stat label="Engagement" cur={row.overview.current.engagementRate} prev={row.overview.previous.engagementRate} format={(v) => formatPercent(v, 0)} />
                </div>
              )}
              <HealthStrip health={healthById.get(site.id)} />
              <div class="modes">
                {site.modes.api && <span class="chip">GA4</span>}
                {site.modes.search && <span class="chip">Search Console</span>}
                {site.modes.warehouse && <span class="chip accent"><Icon name="database" size={11} /> BigQuery</span>}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Stat({ label, cur, prev, format }) {
  return (
    <div>
      <div class="v">{format(cur)}</div>
      <div class="l">{label} <Delta current={cur} previous={prev} /></div>
    </div>
  );
}
