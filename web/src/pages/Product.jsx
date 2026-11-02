import { useState } from 'preact/hooks';
import { formatNumber, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate, withParam } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { useAnnotations, AnnotationBar } from '../components/Annotations.jsx';
import { dayLabel } from './GitHub.jsx';
import { SummaryLine, JourneyStrip, DayDrawer } from '../components/Journey.jsx';

// Growth charts, in order. Each is drawn only when its source returned a series.
const CHARTS = [
  { key: 'sessions', label: 'Site sessions' },
  { key: 'installs', label: 'Store installs' },
  { key: 'stars', label: 'GitHub stars', area: false },
];
const MORE = [
  { key: 'users', label: 'Site users' },
  { key: 'listingViews', label: 'Listing views' },
  { key: 'storeUsers', label: 'Store users', area: false },
  { key: 'downloads', label: 'Downloads' },
  { key: 'repoViews', label: 'Repo views' },
];

export function Product({ id, range, params }) {
  const list = useAsync(() => api.get('/products'), []);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading height={360} />;
  const { products, suggestions, options } = list.data;
  const onAdded = (p) => { list.reload(); navigate(`/product/${p.id}`); };
  if (!products.length) return <NoProducts suggestions={suggestions} options={options} onAdded={onAdded} />;
  // From a site's sidebar (?site=), show that site's product, not whichever comes first.
  const siteId = params?.get('site') || '';
  const product = siteId ? products.find((p) => p.siteId === siteId) : products.find((p) => p.id === id) || products[0];
  if (!product) {
    const site = options.sites.find((s) => s.id === siteId);
    return <NoProducts site={site} suggestions={suggestions.filter((s) => s.siteId === siteId)} options={options} onAdded={onAdded} />;
  }
  return (
    <>
      {products.length > 1 && (
        <div class="row" style={{ marginBottom: '12px' }}>
          <Segmented label="Product" value={product.id} options={products.map((p) => ({ key: p.id, label: p.label }))} onChange={(key) => navigate(`/product/${key}`)} />
        </div>
      )}
      <ProductView key={product.id} product={product} range={range} params={params} />
    </>
  );
}

function NoProducts({ site, suggestions, options, onAdded }) {
  const name = (list, id) => list?.find((x) => x.id === id)?.label || id;
  const [error, setError] = useState(null);
  async function add(s) {
    try {
      onAdded(await api.post('/products', s));
    } catch (err) {
      setError(err);
    }
  }
  return (
    <>
      <Empty title={site ? `No product for ${site.label} yet` : 'One page per product'}>
        A product joins a site, its GitHub repos and its Chrome extensions on one timeline, so a release, a store spike and a traffic jump line up.
      </Empty>
      {suggestions.map((s) => (
        <Card key={s.id} title={`Suggested: ${s.label}`} sub="Built from what Studio already tracks"
          actions={<button class="btn primary" type="button" onClick={() => add(s)}><Icon name="plus" size={13} /> Add {s.label}</button>}>
          <ul class="small" style={{ margin: 0, paddingLeft: '18px' }}>
            {s.siteId && <li>Site <b>{name(options?.sites, s.siteId)}</b></li>}
            {s.repos.map((r) => <li key={r}>Repo <span class="mono">{r}</span></li>)}
            {s.extensionIds.map((e) => <li key={e}>Extension <b>{name(options?.extensions, e)}</b></li>)}
          </ul>
        </Card>
      ))}
      {error && <ErrorState error={error} />}
      <p class="muted small">Or <a href={`#/settings?tab=products&edit=new${site ? `&site=${site.id}` : ''}`}>set one up stage by stage</a>: domains, hosting, analytics, code, store listings and community.</p>
    </>
  );
}

function ProductView({ product, range, params }) {
  const data = useAsync((o) => api.get(`/products/${product.id}${qs({ range, fresh: o?.fresh })}`), [product.id, range]);
  const journey = useAsync((o) => api.get(`/journey/${product.id}${qs({ range, fresh: o?.fresh })}`), [product.id, range]);
  const stage = params?.get('stage') || '';
  const day = params?.get('day') || '';
  const [more, setMore] = useState('');
  const dates = data.data?.range.dates || [];
  const notes = useAnnotations(data.data?.scopes || [], dates);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={420} /></>;

  const { kpis, series, sources } = data.data;
  const labels = dates.map(dayLabel);
  // A line needs two known days; a lone first snapshot (new star history) is just noted.
  const drawable = (key) => series[key]?.filter((v) => v !== null).length > 1;
  const charts = CHARTS.filter((c) => drawable(c.key));
  const extras = MORE.filter((c) => drawable(c.key));
  const young = [...CHARTS, ...MORE].filter((c) => series[c.key] && !drawable(c.key));
  const extra = extras.find((c) => c.key === more) || extras[0];
  const format = (v, axis) => formatNumber(v, { compact: axis });
  const marks = { annotations: notes.annotations, dates, onSelect: (i) => navigate(withParam('day', dates[i])) };
  const refresh = () => {
    data.reload({ fresh: true });
    journey.reload({ fresh: true });
  };

  return (
    <>
      {journey.data && (
        <>
          <SummaryLine summary={journey.data.summary} />
          <JourneyStrip stages={journey.data.stages} site={journey.data.site} productId={product.id} open={stage} onOpen={(key) => navigate(withParam('stage', key))} />
        </>
      )}
      {!journey.data && !journey.error && <Loading height={120} />}
      {journey.error && <p class="note">Journey: {journey.error.message}</p>}
      <SourceLine sources={sources} demo={data.data.demo} onRefresh={refresh} loading={data.loading || journey.loading} productId={product.id} />
      {kpis.length > 0 && (
        <KpiStrip
          items={kpis.map((k) => ({
            label: k.label,
            value: k.value === null || k.value === undefined ? '—' : k.format === 'rating' ? `${formatDecimal(k.value)}★` : formatNumber(k.value),
            raw: k.value,
            previous: k.previous,
            meta: k.meta,
          }))}
        />
      )}
      {charts.length > 0 && (
        <Card title="Growth" sub="Shared timeline · click any day to see what caused it">
          <div class="stack" style={{ gap: '14px' }}>
            {charts.map((c) => (
              <div key={c.key}>
                <div class="small muted" style={{ marginBottom: '2px' }}>{c.label}</div>
                <LineChart labels={labels} series={[{ label: c.label, values: series[c.key].map((v) => (v === null ? NaN : v)) }]}
                  format={format} height={150} area={c.area !== false} {...marks} />
              </div>
            ))}
          </div>
          {young.length > 0 && <p class="note">{young.map((c) => c.label).join(', ')}: only one day of history so far, so there’s no line yet.</p>}
          <AnnotationBar annotations={notes.annotations} onChange={notes.reload} />
        </Card>
      )}
      {extra && (
        <Card title={extra.label} actions={<Segmented label="Metric" value={extra.key} options={extras} onChange={setMore} />}>
          <LineChart labels={labels} series={[{ label: extra.label, values: series[extra.key].map((v) => (v === null ? NaN : v)) }]}
            format={format} height={200} area={extra.area !== false} {...marks} />
          {extra.key === 'storeUsers' && <p class="note">From daily Web Store listing snapshots; days before the first snapshot are blank.</p>}
        </Card>
      )}
      {!charts.length && !extra && <Empty title="No data from any source yet">Fix the sources above, then refresh.</Empty>}
      {day && <DayDrawer productId={product.id} date={day} onClose={() => navigate(withParam('day', ''))} />}
    </>
  );
}

function SourceLine({ sources, demo, onRefresh, loading, productId }) {
  const failed = sources.filter((s) => s.error);
  return (
    <>
      <div class="meta-line" style={{ alignItems: 'center' }}>
        {sources.map((s) => (
          <a key={s.key} class={`chip${s.error ? '' : ' accent'}`} href={s.href} title={s.error || 'Connected'}>
            <Icon name={s.type === 'site' ? 'chart' : s.type === 'extension' ? 'puzzle' : 'github'} size={11} /> {s.label}
            {s.error && <span aria-label="has a problem"> · !</span>}
          </a>
        ))}
        {demo && <span>sample data</span>}
        <button class="btn ghost" type="button" disabled={loading} onClick={onRefresh}><Icon name="refresh" size={13} /> Refresh</button>
        <a class="btn ghost" href={`#/settings?tab=products&edit=${productId}`}>Set up product</a>
      </div>
      {failed.map((s) => (
        <p class="note" key={s.key} style={{ marginTop: '0' }}>
          <b>{s.label}:</b> {s.error}{s.hint ? ` ${s.hint}` : ''}
          {s.kind === 'auth' && <> <a href="#/settings?i=google">Connect Google</a></>}
        </p>
      ))}
    </>
  );
}
