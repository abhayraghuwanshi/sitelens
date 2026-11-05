import { useEffect, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDuration, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Segmented, Delta } from '../components/ui.jsx';
import { STAGES, stageHref } from '../stages.js';
import { LineChart } from '../charts/LineChart.jsx';
import { useAnnotations, AnnotationBar, toIso } from '../components/Annotations.jsx';
import { ClaudeComments } from '../components/ClaudeComments.jsx';
import { WhatHappened, useStory } from '../components/WhatHappened.jsx';
import { CustomMetricsCard } from './CustomMetrics.jsx';

const TREND_METRICS = [
  { key: 'activeUsers', label: 'Users' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'screenPageViews', label: 'Views' },
];

export function Overview({ site, range }) {
  const dash = useAsync((opts) => api.get(`/sites/${site.id}/dashboard${qs({ range, fresh: opts?.fresh })}`), [site.id, range]);
  const [metric, setMetric] = useState('sessions');
  const trendDates = (dash.data?.reports.trend || []).map((t) => t.date);
  const notes = useAnnotations([`site:${site.id}`], trendDates);
  // Search Console is its own source; the journey strip shows it when the site has one.
  const story = useStory(site, range);
  // Pay off counts the product's outcomes (installs, downloads, goals), not just GA4 key events.
  const outcome = useAsync(async () => {
    const product = site.demo ? null : (await api.get('/products')).products.find((p) => p.siteId === site.id);
    return product ? api.get(`/outcomes/${product.id}${qs({ range: ['7d', '28d', '90d'].includes(range) ? range : '7d' })}`) : null;
  }, [site.id, range]);
  const search = useAsync(() => (site.modes.search ? api.get(`/sites/${site.id}/search${qs({ range })}`) : null), [site.id, range, site.modes.search]);

  // Custom metrics don't need GA4, so a site without it still gets them.
  if (dash.error) return <><WhatHappened site={site} range={range} story={story} /><ErrorState error={dash.error} onRetry={dash.reload} />{!site.demo && <CustomMetricsCard site={site} range={range} />}</>;
  if (!dash.data) return <><Loading height={92} /><Loading height={300} /></>;

  const { reports } = dash.data;
  const cur = reports.overview.current;
  const prev = reports.overview.previous;
  const trendLabels = reports.trend.map((t) => t.label || formatDate(t.date));
  const metricLabel = TREND_METRICS.find((m) => m.key === metric).label;

  return (
    <>
      <WhatHappened site={site} range={range} story={story} />
      <JourneyMap site={site} cur={cur} prev={prev} story={story.data} search={search} outcome={outcome.data} />

      {reports.warnings?.length > 0 && <p class="note">Partial data: {reports.warnings.join(' · ')}</p>}

      <Card
        title={`${metricLabel} over time`}
        sub={`${reports.range.startLabel} – ${reports.range.endLabel}`}
        actions={<Segmented label="Trend metric" value={metric} options={TREND_METRICS} onChange={setMetric} />}
      >
        <LineChart labels={trendLabels} series={[{ label: metricLabel, values: reports.trend.map((t) => t[metric]) }]}
          format={(v, axis) => formatNumber(v, { compact: axis })} height={260} annotations={notes.annotations} dates={trendDates} />
        <AnnotationBar annotations={notes.annotations} scope={`site:${site.id}`} scopeLabel="this site" onChange={notes.reload} />
      </Card>

      {!site.demo && <CustomMetricsCard site={site} range={range} annotations={notes.annotations} />}

      {trendDates.length > 0 && (
        <ClaudeComments siteId={site.id} from={toIso(trendDates[0])} to={toIso(trendDates[trendDates.length - 1])} onChange={notes.reload} />
      )}
    </>
  );
}

// One card per stage, left to right in cause → effect order. The biggest drop is
// flagged so the eye goes to where the journey breaks; each card opens its stage.
function JourneyMap({ site, cur, prev, story, search, outcome }) {
  const total = outcome?.scorecard?.[0];
  const sc = search.data;
  const cards = {
    // The same count as What happened, so the two never disagree.
    ship: !story
      ? { value: '…', meta: 'Deploys, releases and posts', off: true }
      : story.shipped
        ? { value: `${formatNumber(story.shipped)} shipped`, meta: 'Deploys, releases and posts' }
        : { value: 'Nothing logged', meta: 'Deploys, releases and posts show here', off: true },
    found: sc
      ? { value: `${formatNumber(sc.current.clicks)} search clicks`, raw: sc.current.clicks, previous: sc.previous.clicks, meta: `${formatNumber(sc.current.impressions)} impressions` }
      : site.modes.search
        ? { value: search.error ? 'Couldn’t load' : '…', meta: 'Google Search', off: true }
        : { value: 'Not connected', meta: 'Add Search Console in Settings', off: true },
    // Visits come from the story when it has them, so they match What happened.
    arrive: story?.metric === 'sessions'
      ? { value: `${formatNumber(story.value)} sessions`, raw: story.value, previous: story.previous, meta: 'Whole days, as in What happened' }
      : { value: `${formatNumber(cur.sessions)} sessions`, raw: cur.sessions, previous: prev.sessions, meta: `${formatNumber(cur.activeUsers)} users` },
    engage: { value: `${formatPercent(cur.engagementRate, 0)} engaged`, raw: cur.engagementRate, previous: prev.engagementRate, meta: `${formatDuration(cur.averageSessionDuration)} avg. session` },
    payoff: total?.value > 0
      ? { value: `${formatNumber(total.value)} ${total.label.toLowerCase()}`, raw: total.value, previous: total.previous, meta: total.meta }
      : Number.isFinite(cur.keyEvents) && cur.keyEvents > 0
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
            <a class={`journey-step${worst === s.key ? ' bad' : ''}${c.off ? ' off' : ''}`} href={stageHref(s, site)} title={s.question}>
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

// Realtime refreshes every 60s while the tab is visible.
export function useLive(site, initial) {
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
