import { useState } from 'preact/hooks';
import { formatNumber, formatDate, formatPercent } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, Loading, ErrorState, WarehouseMeta, BarList } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';

// Event catalog → event detail → parameter breakdown. Parameters come straight
// from the export, so nothing has to be registered as a custom dimension first.
export function Events({ site, range, params }) {
  const selected = params.get('event') || '';
  const catalog = useAsync((o) => api.get(`/sites/${site.id}/warehouse/events${qs({ range, fresh: o?.fresh })}`), [site.id, range]);
  const select = (name) => navigate(`/site/${site.id}/events${name ? `?event=${encodeURIComponent(name)}` : ''}`);

  if (catalog.error) return <ErrorState error={catalog.error} onRetry={catalog.reload} />;
  if (!catalog.data) return <Loading height={420} />;
  const events = catalog.data.events;
  const active = selected || events.find((e) => !['page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll'].includes(e.name))?.name || events[0]?.name;
  const max = Math.max(1, ...events.map((e) => e.events));

  return (
    <div class="grid cols-2-1" style={{ alignItems: 'start', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)' }}>
      <Card title="Events" sub={`${events.length} names`} flush>
        <div class="table-wrap result-scroll">
          <table class="data">
            <thead><tr><th>Event</th><th class="num">Count</th><th class="num">Users</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.name} class={`clickable${e.name === active ? ' selected' : ''}`} tabIndex={0}
                  onClick={() => select(e.name)} onKeyDown={(ev) => ev.key === 'Enter' && select(e.name)}>
                  <td>
                    <code>{e.name}</code>
                    <div class="inline-bar" style={{ marginTop: '5px' }}><span style={{ width: `${(e.events / max) * 100}%` }} /></div>
                  </td>
                  <td class="num">{formatNumber(e.events)}</td>
                  <td class="num">{formatNumber(e.users)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 16px 10px' }}><WarehouseMeta data={catalog.data} /></div>
      </Card>
      {active && <EventDetail key={active} site={site} range={range} name={active} />}
    </div>
  );
}

function EventDetail({ site, range, name }) {
  const detail = useAsync(() => api.get(`/sites/${site.id}/warehouse/event${qs({ range, name })}`), [site.id, range, name]);
  const [key, setKey] = useState('');

  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <Loading height={420} />;
  const keys = detail.data.keys.filter((k) => !['ga_session_id', 'ga_session_number', 'engagement_time_msec', 'engaged_session_event', 'session_engaged'].includes(k.key));
  // Default to the most informative parameter: few enough values to chart, more than one.
  const best = keys.find((k) => k.distinct_values > 1 && k.distinct_values <= 50 && k.key !== 'page_location') || keys[0];
  const activeKey = key || best?.key || '';

  return (
    <div class="stack">
      <Card title={<code>{name}</code>} sub="Daily count">
        <LineChart labels={detail.data.trend.map((t) => formatDate(String(t.date)))}
          series={[{ label: 'Events', values: detail.data.trend.map((t) => t.events) }]} format={(v, axis) => formatNumber(v, { compact: axis })} height={180} />
      </Card>
      <Card title="Parameters" sub="Every key sent with this event" actions={
        <select aria-label="Parameter" value={activeKey} onChange={(e) => setKey(e.currentTarget.value)}>
          {keys.map((k) => <option key={k.key} value={k.key}>{k.key} · {formatNumber(k.distinct_values)} values</option>)}
        </select>
      }>
        {activeKey ? <Breakdown site={site} range={range} name={name} paramKey={activeKey} /> : <p class="muted">This event has no parameters.</p>}
      </Card>
    </div>
  );
}

function Breakdown({ site, range, name, paramKey }) {
  const data = useAsync(() => api.get(`/sites/${site.id}/warehouse/breakdown${qs({ range, name, key: paramKey })}`), [site.id, range, name, paramKey]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={160} />;
  const total = data.data.values.reduce((a, v) => a + v.events, 0) || 1;
  return (
    <>
      <BarList rows={data.data.values.slice(0, 15)} label={(r) => r.value} value={(r) => r.events} format={formatNumber}
        extra={(r) => `${formatPercent(r.events / total, 0)} · ${formatNumber(r.users)} users`} />
      <p class="note" style={{ marginTop: '8px' }}>
        <code>{name}</code> split by <code>{paramKey}</code>. In the GA4 UI this needs <code>{paramKey}</code> registered as a custom dimension first; the export already has it.
      </p>
    </>
  );
}
