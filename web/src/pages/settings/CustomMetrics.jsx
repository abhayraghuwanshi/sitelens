import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card, Loading, ErrorState } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';
import { BrandIcon } from '../../components/BrandIcon.jsx';
import { ConnectionHero } from './ConnectionKit.jsx';
import { MetricChart } from '../CustomMetrics.jsx';

// The starting query, in the source's own SQL (Postgres casts; the rest are SQLite or MySQL).
const EXAMPLE_SQL = {
  postgres: `SELECT created_at::date AS day,
       count(*) AS value
FROM signups
WHERE created_at >= {{start}} AND created_at < {{end}}
GROUP BY 1`,
  mysql: `SELECT DATE(created_at) AS day,
       COUNT(*) AS value
FROM signups
WHERE created_at >= {{start}} AND created_at < {{end}}
GROUP BY 1`,
  sqlite: `SELECT date(created_at) AS day,
       count(*) AS value
FROM signups
WHERE created_at >= {{start}} AND created_at < {{end}}
GROUP BY 1`,
};

const SUMMARIES = [
  { key: 'sum', label: 'Sum of the days', help: 'Pings, signups, revenue' },
  { key: 'average', label: 'Daily average', help: 'Daily active installs' },
  { key: 'latest', label: 'Latest day', help: 'Running totals' },
];

const exampleFor = (kinds, ds) => EXAMPLE_SQL[ds?.kind === 'mysql' ? 'mysql' : kinds[ds?.kind]?.placeholders || 'sqlite'];
const blankMetric = (sites, sources, kinds) => ({
  siteId: sites[0]?.id || '', label: '', unit: '', summary: 'sum',
  source: { dataSource: sources[0]?.id || '' }, sql: exampleFor(kinds, sources[0]),
});

// Account → Connections → Databases. One list (data sources, then metrics) with
// both Add buttons on top, or one form on its own: a form never sits under the list.
export function CustomMetricsSettings({ sites, params }) {
  const status = useAsync(() => api.get('/metrics'), []);
  const [view, setView] = useState(null); // { form: 'source' | 'metric', initial }
  const [error, setError] = useState('');
  const real = sites.filter((s) => !s.demo && !s.shared);
  if (status.error) return <ErrorState error={status.error} onRetry={status.reload} />;
  if (!status.data) return <Loading height={320} />;
  const { kinds, platforms, dataSources, metrics } = status.data;

  // Links from the Timeline: ?edit=new|<metric id>&site=<id>&timeline=1|jobs.
  const edit = params.get('edit');
  const requestedSite = real.find((s) => s.id === params.get('site'));
  const returnToJobs = params.get('timeline') === 'jobs' && Boolean(requestedSite);
  const fromTimeline = params.get('timeline') === '1' && Boolean(requestedSite);
  const fromLink = edit === 'new' && real.length
    ? (dataSources.length ? { form: 'metric', initial: blankMetric(requestedSite ? [requestedSite] : real, dataSources, kinds) } : { form: 'source', initial: null, then: 'metric' })
    : metrics.find((m) => m.id === edit && m.from !== 'file') ? { form: 'metric', initial: metrics.find((m) => m.id === edit) } : null;
  const sourceParam = params.get('source');
  // ?platform=d1&accountId=…&databaseId=… fills the new form (a D1 database a .sitelens.yml names).
  const preset = params.get('platform') ? { platform: params.get('platform'), config: { accountId: params.get('accountId') || '', databaseId: params.get('databaseId') || '' } } : null;
  const sourceLink = sourceParam === 'new' ? { form: 'source', initial: null, preset, back: true }
    : dataSources.find((d) => d.id === sourceParam) ? { form: 'source', initial: dataSources.find((d) => d.id === sourceParam), back: true } : null;
  const current = view || (view !== false ? sourceLink || fromLink : null);

  const backToTimeline = (siteId, id) => {
    const query = new URLSearchParams({ by: 'metric' });
    if (id) query.set('f', `metric:${id}`);
    location.hash = `/site/${encodeURIComponent(siteId)}/timeline?${query}`;
  };
  const toList = () => { setView(false); setError(''); status.reload(); };
  const siteLabel = (id) => real.find((s) => s.id === id)?.label || id;
  // A file's inline D1 source shows the saved data source for the same database, which holds its token.
  const sourceName = (m) => (m.source.dataSource ? dataSources.find((d) => d.id === m.source.dataSource)?.name || 'Removed source'
    : dataSources.find((d) => d.kind === 'd1' && d.config.databaseId === m.source.databaseId)?.name || 'Cloudflare D1');
  const platformLabel = (key) => platforms.find((p) => p.key === key)?.label || kinds[key]?.label || key;

  if (current?.form === 'source') {
    return (
      <DataSourceForm initial={current.initial} preset={current.preset} kinds={kinds} platforms={platforms}
        onDone={async (saved) => {
          // Came here to add a metric with no source yet: carry on to the metric form.
          if (saved && !current.initial && (current.then === 'metric' || !metrics.length) && real.length) {
            const fresh = await api.get('/metrics');
            status.reload();
            setView({ form: 'metric', initial: { ...blankMetric(requestedSite ? [requestedSite] : real, fresh.dataSources, kinds), source: { dataSource: saved.id }, sql: exampleFor(kinds, saved) } });
          } else if (current.back) location.hash = '#/account?tab=integrations';
          else toList();
        }} />
    );
  }
  if (current?.form === 'metric') {
    return (
      <MetricEditor initial={current.initial} sites={real} dataSources={dataSources} kinds={kinds}
        onAddSource={() => setView({ form: 'source', initial: null, then: 'metric' })}
        onDone={(saved) => {
          if (saved && returnToJobs) location.hash = `/site/${encodeURIComponent(saved.siteId)}/jobs`;
          else if (saved && fromTimeline) backToTimeline(saved.siteId, saved.id);
          else if (!saved && (returnToJobs || fromTimeline)) backToTimeline(requestedSite.id);
          else toList();
        }} />
    );
  }

  async function removeSource(ds) {
    setError('');
    try {
      await api.del(`/data-sources/${ds.id}`);
      status.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div class="stack gap-16">
      <div class="row">
        <button class="btn primary" type="button" onClick={() => setView({ form: 'source', initial: null })}>
          <Icon name="plus" size={14} /> Add data source
        </button>
        <button class="btn" type="button" disabled={!real.length}
          title={real.length ? undefined : 'Add a site first; each metric belongs to one site.'}
          onClick={() => (dataSources.length ? setView({ form: 'metric', initial: blankMetric(real, dataSources, kinds) }) : setView({ form: 'source', initial: null, then: 'metric' }))}>
          <Icon name="plus" size={14} /> Add metric
        </button>
      </div>
      {error && <p class="nx-note-line bad m-0">{error}</p>}

      <section class="nx-block" aria-label="Data sources">
        <h2 class="nx-h2">Data sources</h2>
        <div class="card card-plain nx-tight nx-conn-list">
          {dataSources.length ? dataSources.map((ds) => {
            const used = metrics.filter((m) => m.source.dataSource === ds.id || (ds.kind === 'd1' && m.source.type === 'd1' && m.source.databaseId === ds.config.databaseId)).length;
            return (
              <div key={ds.id} class="nx-conn-row ds-row">
                <BrandIcon name={ds.platform} title={platformLabel(ds.platform)} />
                <span class="nx-ob">
                  <b>{ds.name}</b>
                  <small class={ds.secret === 'missing' ? 'bad' : 'muted'}>
                    <span class={`dot${ds.secret === 'missing' ? '' : ' on'}`} />
                    {platformLabel(ds.platform)}{ds.where ? ` · ${ds.where}` : ''}{ds.secret === 'missing' ? ` · needs its ${kinds[ds.kind].secret.label.toLowerCase()}` : ''}
                  </small>
                </span>
                <span class="nx-conn-desc muted small">{used ? `${used} ${used === 1 ? 'metric' : 'metrics'}` : 'No metrics yet'}</span>
                <span class="row gap-6 nowrap">
                  <button class="btn ghost" type="button" onClick={() => setView({ form: 'source', initial: ds })}>Edit</button>
                  <button class="btn ghost danger" type="button" onClick={() => removeSource(ds)}>Remove</button>
                </span>
              </div>
            );
          }) : (
            <p class="muted inset m-0">No data sources yet. Add Supabase, Neon, Postgres, MySQL, PlanetScale, Turso, Cloudflare D1{platforms.some((p) => p.key === 'sqlite') ? ' or a SQLite file' : ''}.</p>
          )}
        </div>
      </section>

      <section class="nx-block" aria-label="Metrics">
        <h2 class="nx-h2">Metrics</h2>
        <div class="card card-plain nx-tight nx-conn-list">
          {metrics.length ? metrics.map((m) => (
            <div key={m.id} class="nx-conn-row ds-row">
              <span class="nx-hk"><Icon name="trend" size={15} /></span>
              <span class="nx-ob">
                <b>{m.label}</b>
                <small class="muted">{siteLabel(m.siteId)} · {SUMMARIES.find((s) => s.key === m.summary)?.label}</small>
              </span>
              <span class="nx-conn-desc muted small">{sourceName(m)}</span>
              <span class="row gap-6 nowrap">
                {/* A file's metric changes in the site's repo, not here. */}
                {m.from === 'file' ? <span class="muted small">In .sitelens.yml</span> : (
                  <>
                    <button class="btn ghost" type="button" onClick={() => setView({ form: 'metric', initial: m })}>Edit</button>
                    <button class="btn ghost danger" type="button" onClick={async () => { await api.del(`/metrics/${m.id}`); status.reload(); }}>Remove</button>
                  </>
                )}
              </span>
            </div>
          )) : (
            <p class="muted inset m-0">{real.length ? 'No metrics yet. A metric is one query that returns a number per day, charted on its site’s Timeline.' : 'Add a site first; each metric belongs to one site.'}</p>
          )}
        </div>
      </section>
    </div>
  );
}

// Where each platform's connection details live, for the header's link.
const PLATFORM_LINKS = {
  supabase: { label: 'Supabase', href: 'https://supabase.com/dashboard' },
  neon: { label: 'Neon console', href: 'https://console.neon.tech' },
  planetscale: { label: 'PlanetScale', href: 'https://app.planetscale.com' },
  turso: { label: 'Turso', href: 'https://app.turso.tech' },
  d1: { label: 'Cloudflare', href: 'https://dash.cloudflare.com/profile/api-tokens' },
};

// Add or edit one data source: pick the platform, paste what it gives you,
// test it (which lists its tables), save.
function DataSourceForm({ initial, preset, kinds, platforms, onDone }) {
  const [platform, setPlatform] = useState(initial?.platform || (platforms.some((x) => x.key === preset?.platform) ? preset.platform : ''));
  const [form, setForm] = useState(() => ({ name: initial?.name || '', config: { ...(initial?.config || preset?.config || {}) }, secret: '' }));
  const [test, setTest] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const p = platforms.find((x) => x.key === platform);
  const kind = p && kinds[p.kind];
  const body = () => ({ id: initial?.id, platform, name: form.name.trim() || p.label, config: form.config, secret: form.secret });

  async function act(what) {
    setBusy(what);
    setError(null);
    try {
      if (what === 'test') setTest(await api.post('/data-sources/test', body()));
      else onDone(await api.post('/data-sources', body()));
    } catch (err) {
      setError(err);
      if (what === 'test') setTest(null);
    } finally {
      setBusy('');
    }
  }

  const head = (
    <div class="form-bar">
      <b class="form-bar-title">{initial ? `Edit ${initial.name}` : p ? `Add ${p.label}` : 'Add a data source'}</b>
      <button class="btn ghost" type="button" onClick={() => onDone()}>Cancel</button>
    </div>
  );

  if (!p) {
    return (
      <div class="stack gap-16">
        {head}
        <p class="muted m-0">Where do your app’s numbers live? Kauzl only reads: every query runs read-only.</p>
        <div class="provider-grid ds-platforms">
          {platforms.map((x) => (
            <button key={x.key} type="button" class="provider" onClick={() => { setPlatform(x.key); setTest(null); setError(null); }}>
              <BrandIcon name={x.key} title={x.label} />
              <b>{x.label}</b>
              <small>{x.note}</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form class="stack gap-16" onSubmit={(e) => { e.preventDefault(); act('save'); }}>
      {head}
      <ConnectionHero brand={p.key} name={initial?.name || p.label} tagline={p.help}
        status={initial ? { on: initial.secret !== 'missing', warn: initial.secret === 'missing', text: `${p.label}${initial.where ? ` · ${initial.where}` : ''}` } : { on: false, text: `${p.note} · read-only` }}
        link={PLATFORM_LINKS[p.key]} />
      {!initial && <button class="btn ghost ds-change" type="button" onClick={() => { setPlatform(''); setTest(null); }}>← Pick another platform</button>}
      <Card>
        <div class="stack">
          <label class="field">Name
            <input value={form.name} placeholder={p.label} onInput={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))} />
            <small>What the metric form shows, like “App database”.</small>
          </label>
          {kind.fields.map((f) => (
            <label key={f.key} class="field">{f.label}
              <input required class="mono" value={form.config[f.key] || ''} placeholder={f.placeholder}
                onInput={(e) => setForm((s) => ({ ...s, config: { ...s.config, [f.key]: e.currentTarget.value } }))} />
              <small>{f.hint}</small>
            </label>
          ))}
          {kind.secret && (
            <label class="field">{kind.secret.label}
              <input type="password" class="mono" autocomplete="off" value={form.secret}
                placeholder={initial && initial.secret !== 'missing' ? 'Saved · leave blank to keep it' : kind.secret.placeholder}
                onInput={(e) => setForm((f) => ({ ...f, secret: e.currentTarget.value }))} />
              <small>Kept on this Kauzl only, never shown again. {kind.secret.help}</small>
            </label>
          )}
          {error && <ErrorState error={error} />}
          {test && (
            <div class="ds-test">
              <p class="small m-0 text-good"><Icon name="check" size={13} /> Connected · {test.tables.length} {test.tables.length === 1 ? 'table' : 'tables'}</p>
              {test.tables.length > 0 && <p class="small muted m-0 mono ds-test-list">{test.tables.slice(0, 40).map((t) => t.name).join(', ')}{test.tables.length > 40 ? ', …' : ''}</p>}
            </div>
          )}
          <div class="row">
            <button class="btn" type="button" disabled={Boolean(busy)} onClick={() => act('test')}>{busy === 'test' ? 'Connecting…' : 'Test connection'}</button>
            <button class="btn primary" type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Card>
    </form>
  );
}

// One metric: the facts on top, then the query beside the source's tables.
function MetricEditor({ initial, sites, dataSources, kinds, onAddSource, onDone }) {
  const [form, setForm] = useState(() => structuredClone(initial));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const inline = !form.source.dataSource; // an older inline D1 metric, before data sources
  const ds = dataSources.find((d) => d.id === form.source.dataSource);
  const tables = useAsync(() => (ds ? api.get(`/data-sources/${ds.id}/tables`) : Promise.resolve(null)), [ds?.id]);

  function pickSource(id) {
    const next = dataSources.find((d) => d.id === id);
    const prev = ds;
    setForm((f) => ({
      ...f,
      source: { dataSource: id },
      // Swap the starting query for the new source's dialect while it's still untouched.
      sql: !f.sql.trim() || f.sql === exampleFor(kinds, prev) ? exampleFor(kinds, next) : f.sql,
    }));
    setPreview(null);
  }

  async function act(kind) {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'test') setPreview(await api.post('/metrics/preview', { ...form, range: '28d' }));
      else onDone(await api.post('/metrics', form));
    } catch (err) {
      setError(err);
      if (kind === 'test') setPreview(null);
    } finally {
      setBusy('');
    }
  }

  return (
    <form class="stack gap-16" onSubmit={(e) => { e.preventDefault(); act('save'); }}>
      <div class="form-bar">
        <b class="form-bar-title">{initial.id ? `Edit ${initial.label}` : 'Add a metric'}</b>
        <button class="btn ghost" type="button" disabled={Boolean(busy)} onClick={() => onDone()}>Cancel</button>
        <button class="btn primary" type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
      </div>

      <div class="settings-grid">
        <label class="field">Name<input required value={form.label} placeholder="Daily signups" onInput={(e) => set({ label: e.currentTarget.value })} /></label>
        <label class="field">Site
          <select value={form.siteId} onChange={(e) => set({ siteId: e.currentTarget.value })}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label class="field">Data source
          {inline ? <input disabled value="Cloudflare D1 (older setup)" /> : (
            <select value={form.source.dataSource} onChange={(e) => (e.currentTarget.value === '+' ? onAddSource() : pickSource(e.currentTarget.value))}>
              {dataSources.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              <option value="+">+ Add data source…</option>
            </select>
          )}
        </label>
        <label class="field">Headline number
          <select value={form.summary} onChange={(e) => set({ summary: e.currentTarget.value })}>
            {SUMMARIES.map((s) => <option key={s.key} value={s.key}>{s.label} · {s.help}</option>)}
          </select>
        </label>
        <label class="field">Unit<input value={form.unit} placeholder="optional, e.g. signups" onInput={(e) => set({ unit: e.currentTarget.value })} /></label>
      </div>

      <div class="ds-editor">
        <label class="field ds-query">Query
          <textarea rows={12} class="mono" spellcheck={false} value={form.sql} onInput={(e) => set({ sql: e.currentTarget.value })} />
          <small>
            Return one row per day: <code>day</code>, <code>value</code>, and optionally <code>dimension</code> to split the line.
            {' '}<code>{'{{start}}'}</code> / <code>{'{{end}}'}</code> are the dates (end not included); <code>{'{{start_ms}}'}</code> or <code>{'{{start_s}}'}</code> for epoch timestamps.
          </small>
        </label>
        <aside class="ds-tables" aria-label="Tables">
          <h3 class="nx-label-sm">Tables</h3>
          {!ds ? <p class="small muted m-0">{inline ? 'Not listed for older setups.' : 'Pick a data source.'}</p>
            : tables.error ? <p class="small text-bad m-0">{tables.error.message}</p>
              : !tables.data ? <p class="small muted m-0">Loading…</p>
                : !tables.data.tables.length ? <p class="small muted m-0">No tables found.</p>
                  : (
                    <ul class="ds-table-list">
                      {tables.data.tables.map((t) => (
                        <li key={t.name}>
                          <details>
                            <summary class="mono">{t.name}</summary>
                            <ul>{t.columns.map((c) => <li key={c.name} class="mono small"><span>{c.name}</span> <span class="muted">{c.type}</span></li>)}</ul>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
        </aside>
      </div>

      {error && <ErrorState error={error} />}
      <div class="row">
        <button class="btn" type="button" disabled={Boolean(busy) || (!ds && !inline)} onClick={() => act('test')}>{busy === 'test' ? 'Running…' : 'Run (last 28 days)'}</button>
      </div>

      {preview && (
        <Card title="Preview" sub={`${preview.rows} rows matched · first rows as the source returned them`}>
          <div class="stack">
            <MetricChart metric={{ ...preview, label: form.label, unit: form.unit, summary: form.summary }} height={180} />
            {preview.sample.length > 0 && (
              <div class="table-wrap">
                <table class="data compact">
                  <thead><tr>{Object.keys(preview.sample[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>
                    {preview.sample.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} class="small mono">{String(v)}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </form>
  );
}
