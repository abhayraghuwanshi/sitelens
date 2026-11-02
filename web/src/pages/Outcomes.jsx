import { formatNumber, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { SummaryLine } from '../components/Journey.jsx';
import { dayLabel } from './GitHub.jsx';

const TONE = { bad: 'bad', warn: 'warn', good: 'good', info: 'idle' };
const TONE_LABEL = { bad: 'Fix', warn: 'Improve', good: 'Working', info: 'Context' };
const money = (v) => `$${formatNumber(Math.round(v))}`;
const SOURCE_LABEL = { event: 'Site event', page: 'Page visited', installs: 'Store installs', downloads: 'Release downloads', stars: 'GitHub stars' };
const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`);

export function Outcomes({ id, range }) {
  const list = useAsync(() => api.get('/products'), []);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading height={360} />;
  const { products } = list.data;
  if (!products.length) {
    return (
      <Empty title="Outcomes are measured per product">
        Add a product first (a site plus its store listing or repos), then come back: <a href="#/product">Products</a>.
      </Empty>
    );
  }
  const product = products.find((p) => p.id === id) || products[0];
  return (
    <>
      {products.length > 1 && (
        <div class="row" style={{ marginBottom: '12px' }}>
          <Segmented label="Product" value={product.id} options={products.map((p) => ({ key: p.id, label: p.label }))} onChange={(key) => navigate(`/outcomes/${key}`)} />
        </div>
      )}
      <OutcomeView key={product.id} product={product} range={range} />
    </>
  );
}

function OutcomeView({ product, range }) {
  const data = useAsync((o) => api.get(`/outcomes/${product.id}${qs({ range, fresh: o?.fresh })}`), [product.id, range]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={52} /><Loading height={92} /><Loading height={360} /></>;
  const d = data.data;
  const worst = d.insights.find((i) => i.tone === 'bad') ? 'bad' : d.insights.find((i) => i.tone === 'warn') ? 'warn' : 'good';
  const errors = Object.entries(d.errors);
  const editGoals = `#/settings?tab=products&edit=${product.id}&focus=goals`;
  const conv = d.rateLabel;

  return (
    <>
      <SummaryLine summary={{ text: d.headline, status: worst }} />
      <div class="meta-line" style={{ alignItems: 'center' }}>
        <span>{d.goals.custom ? 'Measured against your goals.' : 'No goals set, so Studio is guessing from event names and linked sources.'}</span>
        <span class="spacer" />
        <a class="btn" href={editGoals}><Icon name="target" size={13} /> {d.goals.custom ? 'Edit goals' : 'Set goals'}</a>
        <a class="btn ghost" href={`#/product/${product.id}`}>Journey</a>
        <button class="btn ghost" type="button" disabled={data.loading} onClick={() => data.reload({ fresh: true })}><Icon name="refresh" size={13} /> Refresh</button>
      </div>
      {errors.map(([k, msg]) => <p class="note" key={k}><b>{k}:</b> {msg}</p>)}

      <KpiStrip
        items={d.scorecard.map((k) => ({
          label: k.label,
          value: k.format === 'decimal' ? formatDecimal(k.value) : k.format === 'money' ? money(k.value) : formatNumber(k.value),
          raw: k.value,
          previous: k.previous,
          meta: k.meta,
        }))}
      />

      <Card title="What to do next" sub={`${d.insights.length} finding${d.insights.length === 1 ? '' : 's'}, most impact first`}>
        {d.insights.length ? (
          <ol class="insights">
            {d.insights.map((i) => <Insight key={i.key} item={i} productId={product.id} />)}
          </ol>
        ) : (
          <p class="note">Nothing stands out yet. Insights appear once there’s enough traffic and at least one goal event.</p>
        )}
      </Card>

      <div class="grid cols-2">
        <Card title="Funnel" sub="Users at each step, this period">
          <Funnel funnel={d.funnel} host={d.site?.host} />
        </Card>
        <Card title="Outcomes per day" sub={d.series.installs.length ? `Store installs and ${d.series.goalsLabel.toLowerCase()}` : d.series.goalsLabel}>
          <LineChart
            labels={d.series.dates.map(dayLabel)}
            series={[
              ...(d.series.installs.length ? [{ label: 'Store installs', values: d.series.installs }] : []),
              ...(d.series.goals.some(Boolean) || !d.series.installs.length ? [{ label: d.series.goalsLabel, values: d.series.goals }] : []),
            ]}
            format={(v) => formatNumber(v)}
            height={220}
            area={false}
          />
        </Card>
      </div>

      <div class="grid cols-2">
        {d.channels.length > 0 && (
          <Card title="Site: which channels convert" sub={`Visitors → ${conv.toLowerCase()}`}>
            <RateTable rows={d.channels} cols={[['Visitors', 'visitors'], [conv, 'goalUsers']]} engaged />
          </Card>
        )}
        {d.listing.length > 0 && (
          <Card title="Store: which channels install" sub="Web Store listing visitors → installs">
            <RateTable rows={d.listing} cols={[['Visitors', 'visitors'], ['Installs', 'installs']]} />
          </Card>
        )}
      </div>

      <div class="grid cols-2">
        {d.pages.length > 0 && (
          <Card title="Landing pages" sub="Where visitors start, and how many go on to convert">
            <RateTable rows={d.pages} cols={[['Visitors', 'visitors'], [conv, 'goalUsers']]} mono />
          </Card>
        )}
        {d.countries.length > 0 && (
          <Card title="Countries" sub="Low engagement and no conversions usually means bots">
            <RateTable rows={d.countries} cols={[['Visitors', 'visitors'], [conv, 'goalUsers']]} engaged />
          </Card>
        )}
      </div>

      <GoalsCard goals={d.goals} editHref={editGoals} />
    </>
  );
}

function Insight({ item, productId }) {
  const tone = TONE[item.tone];
  return (
    <li class={`insight ${tone}`}>
      <span class={`status-dot ${tone}`} aria-hidden="true" />
      <div>
        <div class="insight-title">
          <span class={`insight-tag ${tone}`}>{TONE_LABEL[item.tone]}</span>
          {item.title}
        </div>
        {item.detail && <p class="insight-detail">{item.detail}</p>}
        {item.action && (
          <p class="insight-action">
            <b>Do:</b> {item.action}
            {item.link && <> <a href={item.link} target="_blank" rel="noreferrer">Open GA4 <Icon name="external" size={11} /></a></>}
            {item.day && <> <a href={`#/product/${productId}?day=${item.day}`}>See that day</a></>}
          </p>
        )}
      </div>
    </li>
  );
}

function Funnel({ funnel, host }) {
  const top = funnel.steps[0]?.users || 0;
  if (!top) return <p class="note">No site visitors in this range, or the site isn’t linked to a GA4 property.</p>;
  return (
    <>
      <ol class="funnel">
        {funnel.steps.map((s, i) => {
          const leak = funnel.leak?.to.key === s.key;
          return (
            <li key={s.key} class={leak ? 'leak' : ''}>
              <div class="funnel-label">
                <span>{s.label}</span>
                {s.event && <code>{s.event}</code>}
              </div>
              <div class="funnel-bar"><span style={{ width: `${Math.max(1.5, (s.users / top) * 100)}%` }} /></div>
              <div class="funnel-nums">
                <b>{formatNumber(s.users)}</b>
                {i > 0 && <span class={leak ? 'bad' : ''}>{pct(s.rate)} of previous</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {funnel.store && (
        <p class="note" style={{ marginTop: '12px' }}>
          <b>Side path to the Web Store:</b> {formatNumber(funnel.store.visitors)} listing visitors came from {host || 'the site'} ({pct(funnel.store.rate)} of site visitors), {formatNumber(funnel.store.installs)} installed.
        </p>
      )}
    </>
  );
}

function RateTable({ rows, cols, engaged = false, mono = false }) {
  const best = Math.max(...rows.filter((r) => r.visitors >= 5).map((r) => r.rate || 0));
  return (
    <div class="table-wrap">
      <table class="journey-table outcome-table">
        <thead>
          <tr>
            <th />
            {cols.map(([label]) => <th key={label} class="num">{label}</th>)}
            <th class="num">Rate</th>
            {engaged && <th class="num">Engaged</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} class={r.visitors >= 5 && r.rate === best && best > 0 ? 'hot' : ''}>
              <td class={mono ? 'mono' : ''} title={r.key}>{r.key}</td>
              {cols.map(([label, key]) => <td key={label} class="num">{formatNumber(r[key])}</td>)}
              <td class="num">{pct(r.rate)}</td>
              {engaged && <td class={`num${r.engagement !== null && r.engagement < 0.25 ? ' low' : ''}`}>{pct(r.engagement)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalsCard({ goals, editHref }) {
  const list = goals.list;
  const revenue = list.some((g) => g.revenue > 0);
  return (
    <Card title="Goals" sub={goals.custom ? 'Set in Settings → Products' : 'Guessed by Studio until you set your own'}
      actions={<a class="btn ghost" href={editHref}><Icon name="target" size={13} /> {goals.custom ? 'Edit' : 'Set goals'}</a>}>
      {list.length ? (
        <div class="table-wrap">
          <table class="journey-table outcome-table">
            <thead>
              <tr><th>Goal</th><th>Measured by</th><th>Counts as</th><th class="num">This period</th><th class="num">Before</th>{revenue && <th class="num">Value</th>}</tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.id}>
                  <td>{g.label}</td>
                  <td class="small">{SOURCE_LABEL[g.source]}{g.match && <> · <span class="mono">{g.match}</span></>}</td>
                  <td>{g.role === 'outcome' ? 'Outcome' : 'Step'}</td>
                  <td class="num">{g.unavailable ? <span class="muted small">{g.unavailable}</span> : formatNumber(g.count)}</td>
                  <td class="num">{g.previous === null || g.previous === undefined ? '—' : formatNumber(g.previous)}</td>
                  {revenue && <td class="num">{g.revenue ? money(g.revenue) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="note">No goals yet, and nothing on the site looks like one. Add a goal (a purchase, a sign-up, a page like /pricing) to start measuring.</p>
      )}
      {goals.keyEvents === 0 && list.some((g) => g.source === 'event') && <p class="note">GA4 has none of these events marked as key events, so its own reports show 0 conversions.</p>}
    </Card>
  );
}
