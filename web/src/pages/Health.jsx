import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Empty, Segmented } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { CwvBadge, formatMetric, formatPct, formatAgo, statusClass } from '../components/vitals.jsx';
import { ServerHealthCard } from './Firebase.jsx';

const RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

const dayLabel = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const timeLabel = (at) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const stamp = (at) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function Health({ sites, params }) {
  const monitored = sites.filter((s) => s.host);
  // From a site (?site=), only that site, with no row of other sites.
  const scoped = params.get('site') || '';
  const siteId = scoped || monitored.find((s) => !s.demo)?.id || monitored[0]?.id || '';
  const site = monitored.find((s) => s.id === siteId);
  const [range, setRange] = useState(params.get('range') || '7d');
  const summary = useAsync(() => api.get('/vitals'), [sites.length]);

  if (!monitored.length) return <Empty title="No sites to monitor">Add a site with a host in Settings and Kauzl starts checking it every 5 minutes.</Empty>;

  const healthOf = new Map((summary.data?.sites || []).map((h) => [h.id, h]));
  return (
    <>
      <div class="row" style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
        <div class="health-sites" role="group" aria-label="Site">
          {(scoped ? monitored.filter((s) => s.id === scoped) : monitored).map((s) => (
            <button key={s.id} type="button" class={`btn${s.id === siteId ? ' primary' : ''}`} aria-pressed={s.id === siteId}
              onClick={() => navigate(`/health${qs({ site: s.id, range })}`)}>
              <span class={`dot ${statusClass(healthOf.get(s.id)?.uptime?.last)}`} aria-hidden="true" /> {s.label}
            </button>
          ))}
        </div>
        <Segmented label="Health range" value={range} options={RANGES} onChange={setRange} />
      </div>
      {site ? <SiteHealth key={`${site.id}:${range}`} site={site} range={range} /> : <Empty title="Unknown site" />}
    </>
  );
}

function SiteHealth({ site, range }) {
  const data = useAsync(() => api.get(`/vitals/sites/${site.id}${qs({ range })}`), [site.id, range]);
  const [run, setRun] = useState({ busy: false, msg: null });

  async function runNow() {
    setRun({ busy: true, msg: null });
    try {
      const r = await api.post(`/vitals/sites/${site.id}/run`);
      const errors = [...r.psi.filter((p) => p.error).map((p) => `${p.strategy}: ${p.error}`), r.crux?.error && `CrUX: ${r.crux.error}`].filter(Boolean);
      // Both devices usually fail for the same reason; say it once.
      setRun({ busy: false, msg: errors.length ? { ok: false, text: [...new Set(errors.map((e) => e.replace(/^(mobile|desktop): /, '')))].join(' · ') } : { ok: true, text: 'PageSpeed run finished.' } });
      data.reload();
    } catch (err) {
      setRun({ busy: false, msg: { ok: false, text: err.message } });
    }
  }

  if (data.loading && !data.data) return <Loading height={420} />;
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  const d = data.data;
  const { uptime, buckets, latest, vitals, crux, psiHistory } = d;
  const labelOf = d.range.days === 1 ? timeLabel : dayLabel;
  const last = [...buckets].reverse().find((b) => b.checks);

  return (
    <div class="stack gap-16">
      <KpiStrip items={[
        { label: `Uptime · ${d.range.key}`, value: formatPct(uptime.pct), meta: `${uptime.checks} checks${uptime.down ? ` · ${uptime.down} failed` : ''}` },
        { label: 'Avg response', value: uptime.avgMs === null ? '—' : `${uptime.avgMs}ms`, meta: uptime.p95Ms === null ? '' : `p95 ${uptime.p95Ms}ms` },
        { label: 'Incidents', value: String(d.incidents.filter((i) => i.start >= d.range.from).length), meta: d.incidents[0] && !d.incidents[0].resolvedAt ? 'ongoing' : '' },
        { label: 'Performance · mobile', value: latest.mobile?.score ?? '—', meta: runMeta(latest.mobile) },
        { label: 'Performance · desktop', value: latest.desktop?.score ?? '—', meta: runMeta(latest.desktop) },
      ]} />

      <Card title="Uptime" sub={`${d.host} · checked every 5 minutes${last ? ` · last ${formatAgo(last.at + d.range.bucketMs)}` : ''}`}>
        {uptime.checks ? (
          <>
            <div class="uptime-bar" role="img" aria-label={`Uptime ${formatPct(uptime.pct)} over ${d.range.key}`}>
              {buckets.map((b) => (
                <i key={b.at} class={b.state} title={`${stamp(b.at)} · ${b.checks ? `${b.up}/${b.checks} up${b.avgMs ? ` · ${b.avgMs}ms` : ''}` : 'no checks'}`} />
              ))}
            </div>
            <div class="uptime-axis"><span>{stamp(d.range.from)}</span><span>now</span></div>
            <div class="mt-16">
              <LineChart height={180} labels={buckets.map((b) => labelOf(b.at))}
                series={[{ label: 'Response time', values: buckets.map((b) => (b.avgMs === null ? NaN : b.avgMs)) }]} area={false}
                format={(v) => `${Math.round(v)}ms`} tooltipTitle={(i) => stamp(buckets[i].at)} />
            </div>
          </>
        ) : <p class="muted">No checks in this range yet. The first one runs when the server starts, then every 5 minutes while it’s running.</p>}
      </Card>

      <Card title="Core Web Vitals" sub={`p75 from real Chrome users (CrUX), ${crux?.source === 'bigquery' ? 'monthly via BigQuery' : 'weekly'} · dashed badges are Lighthouse lab values`}
        actions={!d.demo && <button class="btn" type="button" disabled={run.busy || d.running} onClick={runNow}>
          <Icon name="refresh" size={13} /> {run.busy || d.running ? 'Running PageSpeed…' : 'Run PageSpeed now'}</button>}>
        <div class="stack">
          {run.msg && <p class={`small m-0 ${run.msg.ok ? 'text-good' : 'text-bad'}`}><Linked text={run.msg.text} /></p>}
          <div class="vitals-grid">
            {['lcp', 'inp', 'cls'].map((m) => (
              <VitalTrend key={m} metric={m} headline={vitals[m]} series={crux?.series || []} monthly={crux?.source === 'bigquery'} />
            ))}
          </div>
          {!crux?.series?.length && (
            <p class="note m-0">
              {crux?.error ? <Linked text={crux.error} /> : 'No CrUX history yet — it’s fetched with each PageSpeed run.'}
            </p>
          )}
        </div>
      </Card>

      <Card title="Lighthouse" sub="Lab run on the home page, daily while the server runs" flush>
        <div style={{ overflowX: 'auto' }}>
        <table class="data">
          <thead><tr><th>Device</th><th class="num">Score</th><th class="num">LCP</th><th class="num">TBT</th><th class="num">CLS</th><th class="num">FCP</th><th>Run</th></tr></thead>
          <tbody>
            {['mobile', 'desktop'].map((s) => {
              const r = latest[s];
              return (
                <tr key={s}>
                  <td style={{ textTransform: 'capitalize' }}>{s}</td>
                  {r && !r.error ? (
                    <>
                      <td class="num"><b>{r.score ?? '—'}</b></td>
                      <td class="num">{formatMetric('lcp', r.lcp)}</td>
                      <td class="num">{formatMetric('tbt', r.tbt)}</td>
                      <td class="num">{formatMetric('cls', r.cls)}</td>
                      <td class="num">{formatMetric('fcp', r.fcp)}</td>
                    </>
                  ) : <td colSpan={5} class="small" style={{ color: r?.error ? 'var(--critical-ink)' : undefined }}>{r?.error ? <Linked text={r.error} /> : <span class="muted">Not run yet</span>}</td>}
                  <td class="small muted nowrap">{r ? stamp(r.at) : ''}
                    {r?.lastError && <div class="text-bad" title={r.lastError.message}>Last run failed {formatAgo(r.lastError.at)}</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {psiHistory.filter((p) => p.strategy === 'mobile' && p.score !== null).length > 1 && (
          <div style={{ padding: '12px 16px' }}>
            <ScoreHistory rows={psiHistory.filter((p) => p.strategy === 'mobile' && p.score !== null)} />
          </div>
        )}
      </Card>

      {!d.demo && <ServerHealthCard site={site} range={range} />}

      {d.incidents.length > 0 && (
        <Card title="Incidents" sub="Consecutive failed checks" flush>
          <table class="data">
            <thead><tr><th>Started</th><th>Duration</th><th>Error</th><th>Status</th></tr></thead>
            <tbody>
              {d.incidents.map((i) => (
                <tr key={i.start}>
                  <td class="small">{stamp(i.start)}</td>
                  <td class="small">{i.resolvedAt ? duration(i.resolvedAt - i.start) : 'ongoing'}</td>
                  <td class="small">{i.error}</td>
                  <td class="small">{i.resolvedAt ? <span class="chip good">resolved</span> : <span class="chip text-bad">down</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function VitalTrend({ metric, headline, series, monthly = false }) {
  const points = series.filter((p) => p[metric] !== null && p[metric] !== undefined);
  return (
    <div>
      <div class="vital-head">
        <span class="small muted">{{ lcp: 'Largest Contentful Paint', inp: 'Interaction to Next Paint', cls: 'Cumulative Layout Shift' }[metric]}</span>
        <CwvBadge metric={metric} data={headline} />
      </div>
      {points.length > 1 ? (
        <LineChart height={150} labels={points.map((p) => (monthly ? p.date.slice(0, 7) : p.date.slice(5)))}
          series={[{ label: `p75 ${metric.toUpperCase()}`, values: points.map((p) => p[metric]) }]}
          format={(v) => formatMetric(metric, v)} tooltipTitle={(i) => (monthly ? `Month of ${points[i].date.slice(0, 7)}` : `Week ending ${points[i].date}`)} />
      ) : <div class="muted small" style={{ padding: '24px 0' }}>No field history</div>}
    </div>
  );
}

function ScoreHistory({ rows }) {
  return (
    <LineChart height={150} labels={rows.map((r) => dayLabel(r.at))}
      series={[{ label: 'Mobile performance score', values: rows.map((r) => r.score) }]}
      format={(v) => String(Math.round(v))} tooltipTitle={(i) => stamp(rows[i].at)} />
  );
}

function duration(ms) {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function runMeta(r) {
  if (!r) return 'not run yet';
  if (r.error) return 'last run failed';
  return r.lastError ? `${formatAgo(r.at)} · last run failed` : formatAgo(r.at);
}

// Google's errors embed a console URL; show it as a short link.
function Linked({ text }) {
  const parts = String(text).split(/\s*\(?(https:\/\/\S+?)\)?(?=[\s,]|$)/);
  return parts.map((part, i) => (i % 2 ? <> <a key={i} href={part} target="_blank" rel="noreferrer">open Cloud Console</a></> : part));
}
