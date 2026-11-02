import { useEffect, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDuration, formatDate } from '@shared/format.js';
import { METRIC_INFO } from '@shared/insights.js';
import { countryName, flagForCountry } from '@shared/site.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, BarList, Segmented, Delta } from '../components/ui.jsx';
import { STAGES, tabHref } from '../stages.js';
import { LineChart } from '../charts/LineChart.jsx';
import { useAnnotations, AnnotationBar, toIso } from '../components/Annotations.jsx';
import { ClaudeComments } from '../components/ClaudeComments.jsx';
import { ServerTrafficCard } from './Firebase.jsx';

const TREND_METRICS = [
  { key: 'activeUsers', label: 'Users' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'screenPageViews', label: 'Views' },
];

export function Overview({ site, range }) {
  const dash = useAsync((opts) => api.get(`/sites/${site.id}/dashboard${qs({ range, fresh: opts?.fresh })}`), [site.id, range]);
  const live = useLive(site, dash.data?.live);
  const [metric, setMetric] = useState('sessions');
  const trendDates = (dash.data?.reports.trend || []).map((t) => t.date);
  const notes = useAnnotations([`site:${site.id}`], trendDates);
  // Search Console is its own source; the journey strip shows it when the site has one.
  const search = useAsync(() => (site.modes.search ? api.get(`/sites/${site.id}/search${qs({ range })}`) : null), [site.id, range, site.modes.search]);

  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  if (!dash.data) return <><Loading height={92} /><Loading height={300} /></>;

  const { reports, insights, ai } = dash.data;
  const cur = reports.overview.current;
  const prev = reports.overview.previous;
  const trendLabels = reports.trend.map((t) => t.label || formatDate(t.date));
  const metricLabel = TREND_METRICS.find((m) => m.key === metric).label;

  return (
    <>
      <JourneyMap site={site} cur={cur} prev={prev} notes={notes.annotations} search={search} />

      <KpiStrip
        items={[
          { label: 'Live now', value: live ? formatNumber(live.total) : '—', dot: Boolean(live?.total), help: METRIC_INFO.live.help,
            meta: live ? (live.scopedByStream ? 'this stream · 5 min' : 'property-wide · 5 min') : 'unavailable' },
          kpi('Users', cur.activeUsers, prev.activeUsers, formatNumber, METRIC_INFO.activeUsers.short),
          kpi('Sessions', cur.sessions, prev.sessions, formatNumber, METRIC_INFO.sessions.short),
          kpi('Views', cur.screenPageViews, prev.screenPageViews, formatNumber, METRIC_INFO.screenPageViews.short),
          kpi('Engagement', cur.engagementRate, prev.engagementRate, (v) => formatPercent(v), METRIC_INFO.engagementRate.help),
          kpi('Avg. session', cur.averageSessionDuration, prev.averageSessionDuration, formatDuration, METRIC_INFO.averageSessionDuration.short),
          ...(Number.isFinite(cur.keyEvents) ? [kpi('Key events', cur.keyEvents, prev.keyEvents, formatNumber, METRIC_INFO.keyEvents.short)] : []),
        ]}
      />

      {reports.warnings?.length > 0 && <p class="note">Partial data: {reports.warnings.join(' · ')}</p>}

      <div class="grid cols-2-1">
        <Card
          title={`${metricLabel} over time`}
          sub={`${reports.range.startLabel} – ${reports.range.endLabel}`}
          actions={<Segmented label="Trend metric" value={metric} options={TREND_METRICS} onChange={setMetric} />}
        >
          <LineChart labels={trendLabels} series={[{ label: metricLabel, values: reports.trend.map((t) => t[metric]) }]}
            format={(v, axis) => formatNumber(v, { compact: axis })} height={260} annotations={notes.annotations} dates={trendDates} />
          <AnnotationBar annotations={notes.annotations} scope={`site:${site.id}`} scopeLabel="this site" onChange={notes.reload} />
        </Card>
        <Card title="Insights" sub="Generated from this period">
          {insights.length ? (
            <div class="insights">
              {insights.map((i) => (
                <div class={`insight ${i.tone}`} key={i.key}>
                  <span class="mark" aria-hidden="true" />
                  <div>
                    <div class="title">{i.title}</div>
                    <div class="detail">{i.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p class="muted">Nothing unusual this period.</p>
          )}
        </Card>
      </div>

      {trendDates.length > 0 && (
        <ClaudeComments siteId={site.id} from={toIso(trendDates[0])} to={toIso(trendDates[trendDates.length - 1])} onChange={notes.reload} />
      )}

      <div class="grid cols-3">
        <Card title="Traffic sources" sub="Sessions by channel">
          <BarList rows={reports.channels} label={(r) => r.channel} value={(r) => r.sessions} format={formatNumber}
            extra={(r) => formatPercent(r.engagementRate, 0)} />
        </Card>
        <Card title="Landing pages" sub="Where sessions start">
          <BarList rows={reports.entryPages.slice(0, 8)} label={(r) => r.path} value={(r) => r.sessions} format={formatNumber}
            extra={(r) => formatPercent(r.engagementRate, 0)} />
        </Card>
        <Card title="Countries" sub="Users">
          <BarList rows={reports.countries.slice(0, 8)} label={(r) => `${flagForCountry(r.country)} ${countryName(r.country)}`}
            value={(r) => r.users} format={formatNumber} />
        </Card>
      </div>

      <div class="grid cols-3">
        <Card title="Devices" sub="Sessions">
          <BarList rows={reports.devices} label={(r) => capitalize(r.device)} value={(r) => r.sessions} format={formatNumber}
            extra={(r) => formatPercent(r.engagementRate, 0)} />
        </Card>
        <Card title="AI assistant referrals" sub={ai ? `${formatNumber(ai.sessions)} sessions` : ''}>
          {ai && ai.sources?.length ? (
            <BarList rows={ai.sources.slice(0, 7)} label={(r) => r.source} value={(r) => r.sessions} format={formatNumber} />
          ) : (
            <p class="muted small">No sessions from ChatGPT, Perplexity, Claude, Gemini or Copilot in this range.</p>
          )}
        </Card>
        <Card title="Live pages" sub="Last 5 minutes">
          {live?.top?.length ? (
            <BarList rows={live.top} label={(r) => r.title} value={(r) => r.users} format={formatNumber} />
          ) : (
            <p class="muted small">Nobody on the site right now.</p>
          )}
        </Card>
      </div>

      {!site.demo && <ServerTrafficCard site={site} range={range} />}
    </>
  );
}

// Things you did, as opposed to notes and alerts about them.
const SHIPPED = new Set(['deploy', 'release', 'post', 'extension']);

// One card per stage, left to right in cause → effect order. The biggest drop is
// flagged so the eye goes to where the journey breaks; each card opens its stage.
function JourneyMap({ site, cur, prev, notes, search }) {
  const shipped = notes.filter((n) => SHIPPED.has(n.kind));
  const sc = search.data;
  const cards = {
    ship: shipped.length
      ? { value: `${formatNumber(shipped.length)} ${shipped.length === 1 ? 'change' : 'changes'}`, meta: shipped[shipped.length - 1].label }
      : { value: 'Nothing logged', meta: 'Deploys, releases and posts show here', off: true },
    found: sc
      ? { value: `${formatNumber(sc.current.clicks)} search clicks`, raw: sc.current.clicks, previous: sc.previous.clicks, meta: `${formatNumber(sc.current.impressions)} impressions` }
      : site.modes.search
        ? { value: search.error ? 'Couldn’t load' : '…', meta: 'Google Search', off: true }
        : { value: 'Not connected', meta: 'Add Search Console in Settings', off: true },
    arrive: { value: `${formatNumber(cur.sessions)} sessions`, raw: cur.sessions, previous: prev.sessions, meta: `${formatNumber(cur.activeUsers)} users` },
    engage: { value: `${formatPercent(cur.engagementRate, 0)} engaged`, raw: cur.engagementRate, previous: prev.engagementRate, meta: `${formatDuration(cur.averageSessionDuration)} avg. session` },
    payoff: Number.isFinite(cur.keyEvents) && cur.keyEvents > 0
      ? { value: `${formatNumber(cur.keyEvents)} key events`, raw: cur.keyEvents, previous: prev.keyEvents, meta: 'Conversions in GA4' }
      : { value: 'No key events', meta: 'Mark a conversion in GA4, or set up Outcomes', off: true },
  };
  const change = (c) => (c.previous > 0 && Number.isFinite(c.raw) ? c.raw / c.previous - 1 : null);
  const worst = Object.entries(cards)
    .filter(([, c]) => change(c) !== null && change(c) < -0.05)
    .sort(([, a], [, b]) => change(a) - change(b))[0]?.[0];

  return (
    <ol class="journey-steps journey-map" aria-label="Visitor journey">
      {STAGES.filter((s) => s.step).map((s) => {
        const c = cards[s.key];
        return (
          <li key={s.key}>
            <a class={`journey-step${worst === s.key ? ' bad' : ''}${c.off ? ' off' : ''}`} href={tabHref(s.tabs[0], site)} title={s.question}>
              <span class="journey-head">
                <span class="step-num" aria-hidden="true">{s.step}</span>
                {s.label}
                {worst === s.key && <span class="journey-flag">Biggest drop</span>}
              </span>
              <span class="journey-value">{c.value}</span>
              <span class="journey-line">
                {c.previous !== undefined && <Delta current={c.raw} previous={c.previous} />} {c.meta}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function kpi(label, raw, previous, format, help) {
  return { label, raw, previous, value: format(raw), help };
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Realtime refreshes every 60s while the tab is visible.
function useLive(site, initial) {
  const [live, setLive] = useState(initial || null);
  useEffect(() => setLive(initial || null), [initial]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      api.get(`/sites/${site.id}/live`).then(setLive, () => {});
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [site.id]);
  return live;
}
