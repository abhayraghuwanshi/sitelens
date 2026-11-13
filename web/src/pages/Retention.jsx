import { useState } from 'preact/hooks';
import { formatNumber, formatPercent } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, WarehouseMeta } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';

const STEPS = 7; // --seq-1 … --seq-7
const DAY = 86_400_000;

// Retention: of the people who first visited in a given week, how many came
// back in each week after. Explained on the page with one real example, read
// in plain words, then the full table and the average curve.
export function Retention({ site, range }) {
  const data = useAsync((o) => api.get(`/sites/${site.id}/warehouse/cohorts${qs({ range, fresh: o?.fresh })}`), [site.id, range]);
  const config = useAsync(() => api.get(`/sites/${site.id}/config`).catch(() => null), [site.id]);
  const outcome = (config.data?.config?.goals || []).find((g) => g.source === 'event' && g.role === 'outcome');
  const [hover, setHover] = useState(null);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={420} />;
  const { cohorts, dataFrom } = data.data;
  if (!cohorts.length) return <p class="muted">No new visitors in this range.</p>;

  // A cohort can only be measured for weeks that have started before the range ends.
  const end = new Date(`${data.data.range.endDate}T12:00:00`);
  const weeksFor = (c) => Math.floor((end - new Date(`${c.cohort}T12:00:00`)) / (7 * DAY)) + 1;
  const width = Math.max(...cohorts.map(weeksFor));
  const avg = Array.from({ length: width }, (_, w) => {
    const eligible = cohorts.filter((c) => weeksFor(c) > w);
    const users = eligible.reduce((a, c) => a + (c.cells[w]?.users || 0), 0);
    const size = eligible.reduce((a, c) => a + c.size, 0);
    return size ? { rate: users / size, users, size } : null;
  });
  const maxRate = Math.max(0.01, ...cohorts.flatMap((c) => c.cells.slice(1).map((x) => x.rate)));
  const newPeople = cohorts.reduce((a, c) => a + c.size, 0);
  const daysOfData = dataFrom ? Math.round((end - new Date(`${dataFrom}T12:00:00`)) / DAY) + 1 : width * 7;
  // The worked example: the biggest cohort that has a week 1 to show.
  const example = [...cohorts].filter((c) => weeksFor(c) > 1).sort((a, b) => b.size - a.size)[0];
  const notes = findings({ cohorts, avg, weeksFor, daysOfData, dataFrom, outcome });

  return (
    <>
      <section class="nx-card nx-jsum" aria-label="Retention summary">
        <div class="nx-ret-explain">
          <h3 class="nx-jsum-h">How this works</h3>
          <p>
            Everyone is grouped by the <b>week they first visited</b>. Each row follows one group: how many of them
            <b> came back</b> 1, 2, 3… weeks later. A visitor is a browser on a device (GA4’s anonymous ID), so someone on a
            new device or with cleared cookies counts as new.
          </p>
          {example && (
            <p class="nx-ret-example">
              Example from your data: <b>{formatNumber(example.size)}</b> people first visited in the week of {weekLabel(example.cohort)}.
              In the week after, <b>{formatNumber(example.cells[1]?.users || 0)}</b> of them came back
              ({formatPercent(example.cells[1]?.rate || 0)}). That’s the cell under “Week 1” in their row.
            </p>
          )}
        </div>
        <div class="nx-jsum-stats nx-tiles">
          <div><b>{formatNumber(newPeople)}</b><span class="muted small">new visitors · {cohorts.length} weekly groups</span></div>
          <div><b>{avg[1] ? formatPercent(avg[1].rate) : '–'}</b><span class="muted small">came back the next week{avg[1] ? ` · ${formatNumber(avg[1].users)} of ${formatNumber(avg[1].size)}` : ''}</span></div>
          <div><b>{avg[4] ? formatPercent(avg[4].rate) : '–'}</b><span class="muted small">{avg[4] ? 'still coming back 4 weeks later' : 'week 4: needs 5 weeks of data'}</span></div>
          <div><b>{daysOfData}</b><span class="muted small">days of data{dataFrom ? ` · since ${weekLabel(dataFrom)}` : ''}</span></div>
        </div>
        {notes.length > 0 && (
          <div>
            <h3 class="nx-jsum-h">What it means</h3>
            <ul class="nx-jfind nx-jfind-3">
              {notes.map((n) => <li key={n.title} class={`tone-${n.tone}`}><b>{n.title}</b><span class="muted small">{n.detail}</span></li>)}
            </ul>
          </div>
        )}
      </section>

      <section class="nx-card" aria-label="Weekly retention table">
        <div class="nx-jsum-bar">
          <h3 class="nx-jsum-h">Each week’s new visitors, and how many came back</h3>
        </div>
        <div class="table-wrap" style={{ position: 'relative' }}>
          <table class="heat nx-ret-heat">
            <thead>
              <tr>
                <th class="l">First visited</th>
                <th>People</th>
                {Array.from({ length: width - 1 }, (_, i) => <th key={i}>Week {i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort}>
                  <th class="l">
                    Week of {weekLabel(c.cohort)}
                    {c.partial && <span class="muted small" title={`Data starts ${weekLabel(dataFrom)}, partway through this week`}> · partial</span>}
                  </th>
                  <td class="size">{formatNumber(c.size)}</td>
                  {Array.from({ length: width - 1 }, (_, i) => {
                    const w = i + 1;
                    if (w >= weeksFor(c)) return <td key={w} class="nx-ret-later" title="This week hasn’t happened yet for this group">·</td>;
                    const cell = c.cells[w] || { offset: w, users: 0, rate: 0 };
                    const step = cell.rate === 0 ? 0 : Math.max(1, Math.ceil((cell.rate / maxRate) * STEPS));
                    return (
                      <td key={w} data-step={step}
                        onMouseEnter={() => setHover({ c, cell })} onMouseLeave={() => setHover(null)}
                        title={`Week of ${weekLabel(c.cohort)}, week ${w}: ${formatNumber(cell.users)} of ${formatNumber(c.size)} came back (${formatPercent(cell.rate)})`}>
                        {formatPercent(cell.rate, 0)}<span class="nx-ret-n">{formatNumber(cell.users)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="muted small" style={{ margin: '10px 0 6px' }}>
          {hover
            ? `Week of ${weekLabel(hover.c.cohort)} · week ${hover.cell.offset}: ${formatNumber(hover.cell.users)} of ${formatNumber(hover.c.size)} came back.`
            : 'Each cell: the share of that row’s people who visited again that week, and how many. Stronger colour = more came back. “·” = that week hasn’t happened yet.'}
        </p>
        <WarehouseMeta data={data.data} />
      </section>

      {width >= 4 ? (
        <section class="nx-card" aria-label="Average retention curve">
          <div class="nx-jsum-bar"><h3 class="nx-jsum-h">On average, how many are still coming back</h3></div>
          <LineChart labels={avg.map((_, w) => (w === 0 ? 'First week' : `Week ${w}`))} series={[{ label: 'Came back', values: avg.map((v) => (v ? v.rate : NaN)) }]}
            format={(v) => formatPercent(v, 0)} height={200} area={false} />
          <p class="muted small" style={{ margin: '6px 0 0' }}>All groups together, weighted by size. A curve that flattens out means a core of people keep returning.</p>
        </section>
      ) : null}
    </>
  );
}

// What the numbers mean, from the numbers only.
function findings({ cohorts, avg, weeksFor, daysOfData, dataFrom, outcome }) {
  const out = [];
  const w1 = avg[1];
  if (w1) {
    const oneIn = w1.rate > 0 ? Math.round(1 / w1.rate) : 0;
    out.push({
      // For a download site low returns are expected (next finding), so not a red flag.
      tone: w1.rate >= 0.1 ? 'good' : outcome || w1.rate >= 0.03 ? 'neutral' : 'bad',
      title: `${formatPercent(w1.rate)} come back the week after`,
      detail: oneIn ? `About 1 in ${oneIn} first-time visitors visits again the following week.` : 'None of the first-time visitors came back the following week.',
    });
    if (outcome && w1.rate < 0.05) {
      out.push({
        tone: 'neutral',
        title: 'Low is normal for a site people come to for a download',
        detail: `Once someone has “${outcome.label.toLowerCase()}”, they use the app, not the site. Website returns can’t show whether they keep using it; measure that inside the app.`,
      });
    }
  }
  // Are newer groups coming back more or less than older ones?
  const measured = cohorts.filter((c) => weeksFor(c) > 1 && c.size >= 20 && !c.partial);
  if (measured.length >= 2) {
    const [a, b] = [measured[0], measured.at(-1)];
    const ra = a.cells[1]?.rate || 0;
    const rb = b.cells[1]?.rate || 0;
    if (Math.abs(rb - ra) >= 0.02) {
      out.push({
        tone: rb > ra ? 'good' : 'bad',
        title: `Newer visitors come back ${rb > ra ? 'more' : 'less'}`,
        detail: `Week 1: ${formatPercent(ra)} for the week of ${weekLabel(a.cohort)}, ${formatPercent(rb)} for the week of ${weekLabel(b.cohort)}.`,
      });
    }
  }
  if (daysOfData < 35) {
    out.push({
      tone: 'warn',
      title: `Only ${daysOfData} days of data so far`,
      detail: `${dataFrom ? `The BigQuery export starts ${weekLabel(dataFrom)}. ` : ''}Longer-term return (week 4 and on) shows up as the weeks pass.`,
    });
  }
  return out;
}

function weekLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
