import { useState } from 'preact/hooks';
import { formatNumber, formatPercent } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, WarehouseMeta, KpiStrip } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';

const STEPS = 7; // --seq-1 … --seq-7

export function Retention({ site, range }) {
  const data = useAsync((o) => api.get(`/sites/${site.id}/warehouse/cohorts${qs({ range, fresh: o?.fresh })}`), [site.id, range]);
  const [hover, setHover] = useState(null);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={420} />;
  const { cohorts } = data.data;
  if (!cohorts.length) return <p class="muted">No new users in this range.</p>;

  // A cohort can only be measured for weeks that have started before the range ends.
  const end = new Date(`${data.data.range.endDate}T12:00:00`);
  const weeksFor = (c) => Math.floor((end - new Date(`${c.cohort}T12:00:00`)) / (7 * 86_400_000)) + 1;
  const width = Math.max(...cohorts.map(weeksFor));
  const avg = Array.from({ length: width }, (_, w) => {
    const eligible = cohorts.filter((c) => weeksFor(c) > w);
    const users = eligible.reduce((a, c) => a + (c.cells[w]?.users || 0), 0);
    const size = eligible.reduce((a, c) => a + c.size, 0);
    return size ? users / size : null;
  });
  const maxRate = Math.max(0.01, ...cohorts.flatMap((c) => c.cells.slice(1).map((x) => x.rate)));
  const newUsers = cohorts.reduce((a, c) => a + c.size, 0);

  return (
    <>
      <KpiStrip
        items={[
          { label: 'New users', value: formatNumber(newUsers), meta: `${cohorts.length} weekly cohorts` },
          { label: 'Week 1 retention', value: avg[1] === null || avg[1] === undefined ? '—' : formatPercent(avg[1]), help: 'Share of new users who came back the following week.' },
          { label: 'Week 4 retention', value: avg[4] === null || avg[4] === undefined ? '—' : formatPercent(avg[4]) },
        ]}
      />
      <Card title="Weekly retention" sub="Cohort = week of first visit · cell = share active N weeks later">
        <div class="table-wrap" style={{ position: 'relative' }}>
          <table class="heat">
            <thead>
              <tr>
                <th class="l">Cohort</th>
                <th>Users</th>
                {Array.from({ length: width }, (_, w) => <th key={w}>W{w}</th>)}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort}>
                  <th class="l">{weekLabel(c.cohort)}</th>
                  <td class="size">{formatNumber(c.size)}</td>
                  {Array.from({ length: width }, (_, w) => {
                    if (w >= weeksFor(c)) return <td key={w} />;
                    const cell = c.cells[w] || { offset: w, users: 0, rate: 0 };
                    // W0 is 100% by definition, so it stays neutral and the color budget goes to the retained weeks.
                    const step = w === 0 ? 'base' : cell.rate === 0 ? 0 : Math.max(1, Math.ceil((cell.rate / maxRate) * STEPS));
                    return (
                      <td key={w} data-step={step}
                        onMouseEnter={() => setHover({ c, cell })} onMouseLeave={() => setHover(null)}
                        title={`${weekLabel(c.cohort)} cohort, week ${w}: ${formatNumber(cell.users)} of ${formatNumber(c.size)} users (${formatPercent(cell.rate)})`}>
                        {w === 0 ? '100%' : formatPercent(cell.rate, 0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="note" style={{ marginTop: '10px' }}>
          {hover
            ? `${weekLabel(hover.c.cohort)} cohort · week ${hover.cell.offset}: ${formatNumber(hover.cell.users)} of ${formatNumber(hover.c.size)} users returned.`
            : 'Built from user_pseudo_id and user_first_touch_timestamp in the raw export — GA4’s Data API cannot produce this. Stronger color = more retained, scaled to the best cell after W0.'}
        </p>
        <WarehouseMeta data={data.data} />
      </Card>
      <Card title="Average retention curve" sub="Weighted by cohort size">
        <LineChart labels={avg.map((_, w) => `W${w}`)} series={[{ label: 'Retained', values: avg.map((v) => (v === null ? NaN : v)) }]}
          format={(v) => formatPercent(v, 0)} height={200} area={false} />
      </Card>
    </>
  );
}

function weekLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
