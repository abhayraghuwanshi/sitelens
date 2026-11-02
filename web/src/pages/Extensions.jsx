import { useState } from 'preact/hooks';
import { formatNumber, formatRelative, formatPercent } from '@shared/format.js';
import { countryName } from '@shared/site.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Segmented, Empty, BarList } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { dayLabel } from './GitHub.jsx';
import { useAnnotations } from '../components/Annotations.jsx';

export function Extensions({ range, onChange }) {
  const data = useAsync((o) => api.get(`/extensions${qs({ range, fresh: o?.fresh })}`), [range]);
  const reload = () => {
    data.reload();
    onChange();
  };

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={360} />;
  const { extensions } = data.data;

  return (
    <>
      {extensions.length === 0 && (
        <Empty title="Track a Chrome extension">
          Studio reads the public Web Store listing once a day (users, rating, version) and keeps the history — the store itself shows no history.
          For installs and uninstalls, import the CSV from the developer dashboard.
        </Empty>
      )}
      {extensions.map((ext) => <ExtensionCard key={ext.id} ext={ext} range={data.data.range} onChange={reload} />)}
      <AddExtension onAdded={reload} />
    </>
  );
}

function ExtensionCard({ ext, range, onChange }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const importNames = Object.keys(ext.imports);
  const [metric, setMetric] = useState(importNames.find((n) => /install/i.test(n)) || importNames[0] || '');
  const latest = ext.latest || {};
  const labels = range.dates.map(dayLabel);
  const notes = useAnnotations([`ext:${ext.id}`], range.dates);
  const marks = { annotations: notes.annotations, dates: range.dates };

  async function act(kind, fn) {
    setBusy(kind);
    setError(null);
    setNote('');
    try {
      const result = await fn();
      if (kind === 'import') setNote(`Imported ${result.points} data points into ${result.metrics.join(', ')}.`);
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy('');
    }
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 4_000_000) {
      setError({ message: 'That file is larger than 4 MB — export a shorter date range.' });
      return;
    }
    const csv = await file.text();
    act('import', () => api.post(`/extensions/${ext.id}/import`, { filename: file.name, csv }));
  }

  // Users per day from the listing snapshots, aligned to the range.
  const byDate = new Map(ext.history.map((p) => [p.date, p.users]));
  const usersSeries = range.dates.map((d) => (byDate.has(d) ? byDate.get(d) : NaN));
  const snapshots = ext.history.length;

  return (
    <Card
      title={
        <span class="row" style={{ gap: '10px', flexWrap: 'nowrap' }}>
          {ext.icon && <img src={ext.icon} alt="" width="28" height="28" style={{ borderRadius: '6px' }} />}
          <span>{ext.label}</span>
        </span>
      }
      sub={[ext.version && `v${ext.version}`, ext.updated && `updated ${ext.updated}`].filter(Boolean).join(' · ')}
      actions={
        <div class="row">
          <a class="btn ghost" href={ext.url} target="_blank" rel="noreferrer">Store listing ↗</a>
          <button class="btn ghost" type="button" disabled={Boolean(busy)} onClick={() => act('refresh', () => api.post(`/extensions/${ext.id}/refresh`))}>
            <Icon name="refresh" size={13} /> {busy === 'refresh' ? 'Checking…' : 'Check now'}
          </button>
          <label class="btn" style={{ cursor: 'pointer' }}>
            <Icon name="download" size={13} /> {busy === 'import' ? 'Importing…' : 'Import dashboard CSV'}
            <input type="file" accept=".csv,text/csv" class="sr-only" onChange={(e) => { importFile(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
          </label>
          <button class="btn ghost danger" type="button" onClick={() => act('remove', () => api.del(`/extensions/${ext.id}`))}>Remove</button>
        </div>
      }
    >
      <div class="stack">
        <div class="kpis">
          <div class="kpi">
            <div class="label">Users</div>
            <div class="value">{latest.users === null || latest.users === undefined ? '—' : `${formatNumber(latest.users)}${latest.usersPlus ? '+' : ''}`}</div>
            <div class="meta">
              {ext.usersChange !== null ? (
                <span class={`delta ${ext.usersChange > 0 ? 'up' : ext.usersChange < 0 ? 'down' : 'flat'}`}>
                  {ext.usersChange > 0 ? '+' : ''}{formatNumber(ext.usersChange)}
                </span>
              ) : null}
              <span>{ext.usersChange !== null ? 'this period' : 'weekly active, per the store'}</span>
            </div>
          </div>
          <div class="kpi">
            <div class="label">Rating</div>
            <div class="value">{latest.rating ? `${latest.rating.toFixed(1)} ★` : '—'}</div>
            <div class="meta">{latest.ratings ? `${formatNumber(latest.ratings)} ratings` : 'no ratings yet'}</div>
          </div>
          <div class="kpi">
            <div class="label">Tracked since</div>
            <div class="value" style={{ fontSize: 'var(--text-xl)', marginTop: '8px' }}>{ext.trackedSince || '—'}</div>
            <div class="meta">{snapshots} daily {snapshots === 1 ? 'snapshot' : 'snapshots'} · checked {formatRelative(ext.checkedAt)}</div>
          </div>
        </div>

        <ListingAnalytics ext={ext} range={range} marks={marks} />

        {usersSeries.filter(Number.isFinite).length >= 2 ? (
          <div>
            <div class="small muted" style={{ marginBottom: '4px' }}>Users from daily listing snapshots</div>
            <LineChart labels={labels} series={[{ label: 'Users', values: usersSeries }]} format={(v, axis) => formatNumber(v, { compact: axis })} height={180} area={false} {...marks} />
          </div>
        ) : (
          <p class="note">The user history fills in as Studio takes one snapshot a day while it’s running. The Web Store only ever shows today’s number.</p>
        )}

        {importNames.length > 0 && (
          <div>
            <div class="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
              <span class="small muted">From dashboard CSV{ext.lastImport ? ` · ${ext.lastImport.filename}` : ''}</span>
              {importNames.length > 1 && (
                <Segmented label="Imported metric" value={metric} options={importNames.slice(0, 6).map((n) => ({ key: n, label: n }))} onChange={setMetric} />
              )}
            </div>
            {ext.imports[metric]?.some((v) => v !== null) ? (
              <LineChart labels={labels} series={[{ label: metric, values: ext.imports[metric].map((v) => (v === null ? NaN : v)) }]}
                format={(v, axis) => formatNumber(v, { compact: axis })} height={200} {...marks} />
            ) : (
              <p class="note">No imported <b>{metric}</b> data in this range — try a longer range or a newer export.</p>
            )}
          </div>
        )}
        {note && <p class="note">{note}</p>}
        {error && <ErrorState error={error} />}
      </div>
    </Card>
  );
}

function AddExtension({ onAdded }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/extensions', { id: input });
      setInput('');
      onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add an extension">
      <form class="stack" onSubmit={add}>
        <div class="row">
          <input type="text" style={{ flex: '1', minWidth: '260px' }} placeholder="https://chromewebstore.google.com/detail/…/ioggffobciopdddacpclplkeodllhjko"
            value={input} onInput={(e) => setInput(e.currentTarget.value)} aria-label="Web Store link or extension ID" />
          <button class="btn primary" type="submit" disabled={busy || !input.trim()}>{busy ? 'Checking listing…' : 'Track'}</button>
        </div>
        <p class="note">
          Paste a Web Store link or the 32-letter ID. For exact installs and uninstalls: Developer Dashboard → your item → <b>Stats</b> → download CSV, then <b>Import dashboard CSV</b> here.
          Re-importing an overlapping export updates those days instead of duplicating them.
        </p>
        {error && <ErrorState error={error} />}
      </form>
    </Card>
  );
}

const LISTING_METRICS = [
  { key: 'installs', label: 'Installs' },
  { key: 'views', label: 'Listing views' },
  { key: 'visitors', label: 'Visitors' },
];

// Store-listing traffic and installs from the GA4 property Chrome Web Store created for this item.
function ListingAnalytics({ ext, range, marks }) {
  const data = useAsync((o) => api.get(`/extensions/${ext.id}/analytics${qs({ range: range.key, fresh: o?.fresh })}`), [ext.id, range.key]);
  const [metric, setMetric] = useState('installs');

  if (data.error) {
    if (data.error.kind === 'needs-listing-ga' || data.error.kind === 'auth') {
      return <p class="note"><b>Store listing analytics:</b> {data.error.message} {data.error.hint}</p>;
    }
    return <ErrorState error={data.error} onRetry={data.reload} />;
  }
  if (!data.data) return <Loading height={260} />;
  const { totals, series, sources, countries } = data.data;
  const labels = range.dates.map(dayLabel);
  const label = LISTING_METRICS.find((m) => m.key === metric).label;

  return (
    <div class="stack">
      <div class="kpis">
        <div class="kpi"><div class="label">Installs from listing</div><div class="value">{formatNumber(totals.installs)}</div>
          <div class="meta">{formatNumber(totals.installers)} people</div></div>
        <div class="kpi"><div class="label">Listing views</div><div class="value">{formatNumber(totals.views)}</div>
          <div class="meta">{formatNumber(totals.visitors)} visitors</div></div>
        <div class="kpi" title="People who installed ÷ people who visited the listing"><div class="label">Visit → install</div>
          <div class="value">{formatPercent(totals.conversion)}</div><div class="meta">of listing visitors installed</div></div>
      </div>
      <div>
        <div class="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
          <span class="small muted">Store listing · GA4 property {data.data.propertyId}</span>
          <Segmented label="Listing metric" value={metric} options={LISTING_METRICS} onChange={setMetric} />
        </div>
        <LineChart labels={labels} series={[{ label, values: series[metric] }]} format={(v, axis) => formatNumber(v, { compact: axis })} height={200} {...marks} />
      </div>
      <div class="grid cols-2-1">
        <div>
          <div class="small muted" style={{ marginBottom: '4px' }}>Where installers come from</div>
          <table class="data">
            <thead><tr><th>Source</th><th class="num">Visitors</th><th class="num">Installs</th><th class="num">Converts</th></tr></thead>
            <tbody>
              {sources.slice(0, 10).map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td class="num">{formatNumber(s.visitors)}</td>
                  <td class="num">{formatNumber(s.installs)}</td>
                  <td class="num">{s.visitors >= 5 ? formatPercent(s.conversion, 0) : <span class="muted" title="Too few visitors to compare">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div class="small muted" style={{ marginBottom: '4px' }}>Installs by country</div>
          {countries.length ? <BarList rows={countries} label={(r) => countryName(r.country)} value={(r) => r.installs} format={formatNumber} />
            : <p class="muted small">No installs in this range.</p>}
        </div>
      </div>
      <p class="note">Counts only installs made from the store listing page, which is what Chrome Web Store reports to GA4. Conversion is hidden for sources with fewer than 5 visitors.</p>
    </div>
  );
}
