import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, BarList, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { dayLabel } from './GitHub.jsx';

const STATE_COLOR = { READY: 'var(--good-ink)', ERROR: 'var(--critical-ink)', CANCELED: 'var(--text-3)' };
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function Vercel({ range, params }) {
  const data = useAsync((o) => api.get(`/vercel/projects${qs({ fresh: o?.fresh })}`), []);
  const projectId = params.get('project');

  if (data.error?.kind === 'needs-vercel') {
    return (
      <div class="state">
        <h3>Connect Vercel</h3>
        <p>{data.error.message} Studio then lists your projects, their deployments and Web Analytics, and lines them up with GA4.</p>
        {data.error.hint && <p class="hint">{data.error.hint}</p>}
        <a class="btn primary" href="#/settings?i=vercel">Open settings</a>
      </div>
    );
  }
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;

  const { projects, sites } = data.data;
  const project = projects.find((p) => p.id === projectId);
  const siteFor = (id) => sites.find((s) => s.projectId === id);

  return (
    <>
      <div class="meta-line" style={{ alignItems: 'center' }}>
        <span><Icon name="layers" size={13} /> {data.data.login || 'Vercel'}{data.data.teamId && <> · <span class="mono">{data.data.teamId}</span></>}</span>
        <span>{projects.length} projects</span>
        {project && <a href="#/vercel">← All projects</a>}
        <button class="btn ghost" type="button" onClick={() => data.reload({ fresh: true })}><Icon name="refresh" size={13} /> Refresh</button>
      </div>
      {project
        ? <ProjectDetail key={`${project.id}:${range}`} project={project} site={siteFor(project.id)} range={range} />
        : <ProjectList projects={projects} sites={sites} siteFor={siteFor} onMatched={() => data.reload()} />}
    </>
  );
}

function ProjectList({ projects, sites, siteFor, onMatched }) {
  return (
    <>
      <Card title="Projects" sub="Click a project for deployments and Web Analytics" flush>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Project</th><th>Domains</th><th>Web Analytics</th><th>Last production deploy</th><th>Studio site</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const site = siteFor(p.id);
                const open = () => navigate(`/vercel?project=${p.id}`);
                return (
                  <tr key={p.id} class="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}>
                    <td class="cell-path"><b>{p.name}</b>{p.repo && <span class="t">{p.repo}</span>}</td>
                    <td class="small">{p.domains.slice(0, 2).join(', ') || <span class="muted">{p.vercelDomains[0] || '—'}</span>}</td>
                    <td class="small">{p.webAnalytics.enabled ? (p.webAnalytics.hasData ? <span class="chip accent">on</span> : <span class="chip">on · no data yet</span>) : <span class="muted">off</span>}</td>
                    <td class="small">{p.lastProduction?.created ? formatRelative(p.lastProduction.created) : <span class="muted">—</span>}</td>
                    <td class="small">{site ? site.label : <span class="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {sites.length > 0 && <SiteMatches sites={sites} projects={projects} onMatched={onMatched} />}
    </>
  );
}

// Studio sites ↔ Vercel projects. Auto-matched by domain; a choice here is saved and wins.
function SiteMatches({ sites, projects, onMatched }) {
  const [error, setError] = useState('');
  async function pick(siteId, value) {
    setError('');
    try {
      await api.post('/vercel/match', { siteId, projectId: value === 'auto' ? null : value });
      onMatched();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Card title="Site matching" sub="Studio matches sites to projects by production domain. Override it when the domains differ." flush>
      <table class="data">
        <thead><tr><th>Site</th><th>Vercel project</th></tr></thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id}>
              <td><b>{s.label}</b><div class="muted small">{s.host}</div></td>
              <td>
                <select aria-label={`Vercel project for ${s.label}`} value={s.manual ? s.projectId || 'none' : 'auto'}
                  onChange={(e) => pick(s.id, e.currentTarget.value === 'none' ? '' : e.currentTarget.value)}>
                  <option value="auto">Auto{!s.manual && s.projectId ? ` (${projects.find((p) => p.id === s.projectId)?.name})` : ' (no match)'}</option>
                  <option value="none">Not on Vercel</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p class="small" style={{ padding: '8px 16px', margin: 0, color: 'var(--critical-ink)' }}>{error}</p>}
    </Card>
  );
}

function ProjectDetail({ project, site, range }) {
  const wa = useAsync((o) => api.get(`/vercel/projects/${project.id}/analytics${qs({ range, fresh: o?.fresh })}`), [project.id, range]);
  const deploys = useAsync(() => api.get(`/vercel/projects/${project.id}/deployments${qs({ limit: 40 })}`), [project.id]);
  const list = deploys.data?.deployments || [];
  const dates = wa.data?.range.dates || [];
  const inRange = list.filter((d) => d.target === 'production' && d.state === 'READY' && dates.length && isoDay(d.created) >= dates[0]);
  const annotations = inRange.map((d) => ({ date: isoDay(d.created), label: d.commit ? `Deploy: ${d.commit}` : 'Production deploy', kind: 'deploy', url: d.inspectUrl }));

  return (
    <>
      {wa.error ? <ErrorState error={wa.error} onRetry={wa.reload} /> : !wa.data ? <><Loading height={92} /><Loading height={280} /></> : (
        <>
          <KpiStrip items={[
            { label: 'Page views', value: formatNumber(wa.data.totals.pageviews), meta: 'Vercel Web Analytics' },
            { label: 'Visitors', value: formatNumber(wa.data.totals.visitors), meta: 'counted once per day' },
            { label: 'Production deploys', value: formatNumber(inRange.length), meta: 'in this range' },
            { label: 'Last deploy', value: project.lastProduction?.created ? formatRelative(project.lastProduction.created) : '—' },
          ]} />
          {!project.webAnalytics.enabled && (
            <div class="state">
              <h3>Web Analytics is off for {project.name}</h3>
              <p>Turn it on in the Vercel dashboard → {project.name} → Analytics, then add <code>@vercel/analytics</code> to the site and redeploy. Deployments below still work.</p>
            </div>
          )}
          <Card title={`${project.name} traffic`} sub={project.domains[0] || project.vercelDomains[0] || ''}>
            <LineChart labels={dates.map(dayLabel)} dates={dates} annotations={annotations}
              series={[{ label: 'Page views', values: wa.data.series.pageviews }, { label: 'Visitors', values: wa.data.series.visitors }]}
              format={(v, axis) => formatNumber(v, { compact: axis })} height={240} />
            {wa.data.dataStart > wa.data.range.start && (
              <p class="note">Vercel only serves the latest {wa.data.retentionDays || 31} days on this plan, so the chart starts {wa.data.dataStart}. Earlier days are blank, not zero traffic.</p>
            )}
          </Card>
          <div class="grid cols-2">
            <Card title="Top pages">
              {wa.data.pages.length
                ? <BarList rows={wa.data.pages} value={(r) => r.views} label={(r) => r.path} format={formatNumber} />
                : <p class="muted small">No page views in this range.</p>}
            </Card>
            <Card title="Referrers">
              {wa.data.referrers.length
                ? <BarList rows={wa.data.referrers} value={(r) => r.views} label={(r) => r.host || 'Direct / none'} format={formatNumber} />
                : <p class="muted small">No page views in this range.</p>}
            </Card>
          </div>
          {site?.propertyId && <Compare site={site} project={project} range={range} annotations={annotations} />}
        </>
      )}
      <Card title="Deployments" sub="Latest 40, production and preview" flush>
        {deploys.error ? <ErrorState error={deploys.error} onRetry={deploys.reload} /> : !deploys.data ? <Loading height={160} /> : (
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Commit</th><th>Target</th><th>State</th><th class="num">Created</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td class="cell-path">
                      <a href={d.inspectUrl || `https://${d.url}`} target="_blank" rel="noreferrer"><b>{d.commit || d.url}</b></a>
                      <span class="t mono">{[d.ref, d.sha].filter(Boolean).join(' · ') || d.source}</span>
                    </td>
                    <td class="small">{d.target === 'production' ? <span class="chip accent">production</span> : <span class="chip">preview</span>}</td>
                    <td class="small" style={{ color: STATE_COLOR[d.state] || 'var(--text-2)' }}>{d.state.toLowerCase()}</td>
                    <td class="num small">{formatRelative(d.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && <Empty title="No deployments yet" />}
          </div>
        )}
      </Card>
    </>
  );
}

// GA4 vs Vercel page views for the same days. Vercel's script is first-party and
// cookieless, so the gap is mostly ad/tracker blockers and consent banners.
function Compare({ site, project, range, annotations }) {
  const data = useAsync(() => api.get(`/vercel/sites/${site.id}/compare${qs({ range, project: project.id })}`), [site.id, project.id, range]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={280} />;
  const { range: r, vercel, ga, totals, capture } = data.data;
  return (
    <Card title={`GA4 vs Vercel · ${site.label}`}
      sub={capture !== null ? `GA4 records ${formatPercent(capture, 0)} of the page views Vercel sees`
        : totals.ga ? 'GA4 sees traffic but Vercel none: the @vercel/analytics script is probably not on the site' : 'No page views to compare yet'}>
      <KpiStrip items={[
        { label: 'Vercel page views', value: formatNumber(totals.vercel) },
        { label: 'GA4 page views', value: formatNumber(totals.ga) },
        { label: 'GA4 capture rate', value: capture === null ? '—' : formatPercent(capture, 0), meta: capture !== null && capture < 1 ? `${formatPercent(1 - capture, 0)} missing from GA4` : '' },
      ]} />
      <LineChart labels={r.dates.map(dayLabel)} dates={r.dates} annotations={annotations}
        series={[{ label: 'Vercel', values: vercel }, { label: 'GA4', values: ga }]}
        format={(v, axis) => formatNumber(v, { compact: axis })} height={220} />
      <p class="note">
        Vercel's analytics script is first-party and cookieless, so blockers and consent banners rarely hide it; GA4 misses those visits.
        A capture rate above 100% usually means GA4 also counts another host, or the Vercel script isn't on every page. GA4 days follow the property's time zone; Vercel's are UTC.
      </p>
    </Card>
  );
}
