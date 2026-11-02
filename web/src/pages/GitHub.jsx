import { useMemo, useState } from 'preact/hooks';
import { formatNumber, formatDate, formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, usePersistent, navigate } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, BarList, Segmented } from '../components/ui.jsx';
import { LineChart, Sparkline } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { useAnnotations } from '../components/Annotations.jsx';

const METRICS = [
  { key: 'views', label: 'Views' },
  { key: 'clones', label: 'Clones' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'stars', label: 'Stars' },
];

const COLUMNS = [
  { key: 'stars', label: 'Stars' },
  { key: 'views', label: 'Views' },
  { key: 'uniques', label: 'Visitors' },
  { key: 'clones', label: 'Clones' },
  { key: 'downloads', label: 'Downloads' },
];

const PLATFORM_LABEL = { windows: 'Windows', macos: 'macOS', linux: 'Linux', other: 'Other / source' };

export const dayLabel = (iso) => formatDate(iso.replaceAll('-', ''));

export function GitHub({ range, params, sync, onSynced }) {
  const repo = params.get('repo');
  // Re-mount views after a sync so they refetch.
  const stamp = sync.lastRun || 0;
  return (
    <>
      <SyncBar sync={sync} onSynced={onSynced} />
      {repo ? <RepoDetail key={`${repo}:${stamp}`} name={repo} range={range} /> : <GitHubOverview key={stamp} range={range} />}
    </>
  );
}

function SyncBar({ sync, onSynced }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!sync.tokenSource) return null;
  const lastSync = sync.lastRun || (sync.data.lastSync ? Date.parse(sync.data.lastSync) : 0);
  async function run() {
    setBusy(true);
    setError('');
    try {
      await api.post('/github/sync');
      onSynced();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="meta-line" style={{ alignItems: 'center' }}>
      <span><Icon name="github" size={13} /> {sync.login || sync.data.login ? `@${sync.login || sync.data.login}` : 'GitHub token'} · syncs hourly while Studio runs</span>
      <span>{sync.running || busy ? 'Syncing…' : lastSync ? `last sync ${formatRelative(lastSync)}` : 'not synced yet'}</span>
      {sync.rateRemaining !== null && <span>{formatNumber(sync.rateRemaining)} API calls left this hour</span>}
      {(error || sync.lastError) && <span style={{ color: 'var(--critical-ink)' }}>{error || sync.lastError}</span>}
      <button class="btn ghost" type="button" disabled={busy || sync.running} onClick={run}><Icon name="refresh" size={13} /> Sync now</button>
    </div>
  );
}

function GitHubOverview({ range }) {
  const data = useAsync((o) => api.get(`/github/overview${qs({ range, fresh: o?.fresh })}`), [range]);
  const notes = useAnnotations(null, data.data?.range.dates);
  const [metric, setMetric] = useState('views');
  const [filter, setFilter] = useState('');
  const [showQuiet, setShowQuiet] = usePersistent('gh:quiet', false);
  const [sort, setSort] = useState({ key: 'views', desc: true });

  const repos = data.data?.repos || [];
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return repos
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .filter((r) => showQuiet || q || r.views || r.clones || r.downloads || r.starsGained)
      .sort((a, b) => (sort.desc ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]) || a.name.localeCompare(b.name));
  }, [repos, filter, showQuiet, sort]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;

  const { totals, series } = data.data;
  const labels = data.data.range.dates.map(dayLabel);
  const quiet = repos.length - repos.filter((r) => r.views || r.clones || r.downloads || r.starsGained).length;

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Stars', value: formatNumber(totals.stars), meta: totals.starsGained ? `+${formatNumber(totals.starsGained)} this period` : 'no new stars' },
          { label: 'Views', value: formatNumber(totals.views), meta: `${formatNumber(totals.uniques)} visitors (sum of daily uniques)` },
          { label: 'Clones', value: formatNumber(totals.clones) },
          { label: 'Release downloads', value: formatNumber(totals.downloads), meta: `${formatNumber(totals.downloadsTotal)} all time` },
          { label: 'Forks', value: formatNumber(totals.forks) },
        ]}
      />
      <Card title={`${METRICS.find((m) => m.key === metric).label} across all repos`}
        sub={`Last data ${data.data.lastSync || '—'}`}
        actions={<Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />}>
        <LineChart labels={labels} series={[{ label: METRICS.find((m) => m.key === metric).label, values: series[metric] }]}
          format={(v, axis) => formatNumber(v, { compact: axis })} height={240} area={metric !== 'stars'}
          annotations={notes.annotations.filter((a) => a.kind === 'release' || !a.scope)} dates={data.data.range.dates} />
        {data.data.historyStart > data.data.range.start && (
          <p class="note">History starts {data.data.historyStart}: GitHub only serves the last 14 days of traffic, so days before that are empty, not zero traffic.
            To fill them, use <a href="#/settings?i=github">Settings → GitHub → Import older history</a> with an old ghstats database.</p>
        )}
        {metric === 'downloads' && <p class="note">Daily downloads are the change between daily snapshots of each repo’s release total; a day without a snapshot rolls into the next one.</p>}
      </Card>
      <Card title="Repositories" sub={`${rows.length} shown`} flush
        actions={
          <div class="row">
            <label class="check"><input type="checkbox" checked={showQuiet} onChange={(e) => setShowQuiet(e.currentTarget.checked)} /> Show {quiet} quiet {quiet === 1 ? 'repo' : 'repos'}</label>
            <input type="search" placeholder="Filter repos" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} aria-label="Filter repos" />
          </div>
        }>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Views / day</th>
                {COLUMNS.map((c) => (
                  <th class="num" key={c.key} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : true })}>
                      {c.label} {sort.key === c.key ? (sort.desc ? '↓' : '↑') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} class="clickable" tabIndex={0} onClick={() => navigate(`/github?repo=${encodeURIComponent(r.name)}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/github?repo=${encodeURIComponent(r.name)}`)}>
                  <td class="cell-path">
                    <b>{r.name.split('/')[1]}</b> <span class="muted small">{r.name.split('/')[0]}</span>
                    {r.fork && <span class="chip" style={{ marginLeft: '6px' }}>fork</span>}
                    {r.archived && <span class="chip" style={{ marginLeft: '6px' }}>archived</span>}
                    {r.description && <span class="t">{r.description}</span>}
                  </td>
                  <td><Sparkline values={r.spark} width={90} height={22} /></td>
                  <td class="num">{formatNumber(r.stars)}{r.starsGained > 0 && <span class="delta up" style={{ marginLeft: '4px' }}>+{r.starsGained}</span>}</td>
                  <td class="num">{formatNumber(r.views)}</td>
                  <td class="num">{formatNumber(r.uniques)}</td>
                  <td class="num">{formatNumber(r.clones)}</td>
                  <td class="num">{r.downloads ? formatNumber(r.downloads) : <span class="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p class="muted" style={{ padding: '8px 16px' }}>No repos with activity in this range. Tick “Show quiet repos” to list everything.</p>}
        </div>
      </Card>
    </>
  );
}

function RepoDetail({ name, range }) {
  const data = useAsync(() => api.get(`/github/repo${qs({ name, range })}`), [name, range]);
  const notes = useAnnotations([`repo:${name}`], data.data?.range.dates);
  const [metric, setMetric] = useState('views');

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;

  const { repo, referrers, paths, releases, platforms } = data.data;
  const labels = data.data.range.dates.map(dayLabel);
  const platformRows = Object.entries(platforms).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  const platformTotal = platformRows.reduce((a, r) => a + r.n, 0);
  const series = {
    views: [{ label: 'Views', values: repo.series.views }, { label: 'Unique visitors', values: repo.series.uniques }],
    clones: [{ label: 'Clones', values: repo.series.clones }, { label: 'Unique cloners', values: repo.series.cloners }],
    downloads: [{ label: 'Downloads', values: repo.series.downloads }],
    stars: [{ label: 'Stars', values: repo.series.stars }],
  }[metric];

  return (
    <>
      <div class="row">
        <a class="btn ghost" href="#/github">← All repos</a>
        <a class="btn ghost" href={`https://github.com/${repo.name}`} target="_blank" rel="noreferrer">Open on GitHub ↗</a>
        {repo.description && <span class="muted small">{repo.description}</span>}
      </div>
      <KpiStrip
        items={[
          { label: 'Stars', value: formatNumber(repo.stars), meta: repo.starsGained ? `+${repo.starsGained} this period` : '' },
          { label: 'Views', value: formatNumber(repo.views), meta: `${formatNumber(repo.uniques)} visitors` },
          { label: 'Clones', value: formatNumber(repo.clones) },
          { label: 'Downloads', value: formatNumber(repo.downloads), meta: `${formatNumber(repo.downloadsTotal)} all time` },
          { label: 'Forks', value: formatNumber(repo.forks) },
        ]}
      />
      <Card title={repo.name} actions={<Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />}>
        <LineChart labels={labels} series={series} format={(v, axis) => formatNumber(v, { compact: axis })} height={240} area={metric !== 'stars'}
          annotations={notes.annotations} dates={data.data.range.dates} />
      </Card>
      <div class="grid cols-3">
        <Card title="Referrers" sub="Views from each source">
          {referrers.length ? <BarList rows={referrers} label={(r) => r.name} value={(r) => r.count} format={formatNumber} extra={(r) => `${formatNumber(r.uniques)} unique`} />
            : <p class="muted small">No referrer data in this range.</p>}
        </Card>
        <Card title="Popular content" sub="Pages viewed on GitHub">
          {paths.length ? <BarList rows={paths} label={(r) => r.title && r.title !== r.name ? r.title : r.name.replace(`/${repo.name}`, '') || '/'} value={(r) => r.count} format={formatNumber} />
            : <p class="muted small">No page data in this range.</p>}
        </Card>
        <Card title="Downloads by platform" sub="All releases, all time">
          {platformRows.length ? (
            <BarList rows={platformRows} label={(r) => PLATFORM_LABEL[r.key]} value={(r) => r.n} format={formatNumber}
              extra={(r) => `${Math.round((r.n / platformTotal) * 100)}%`} />
          ) : <p class="muted small">This repo has no release assets.</p>}
          {platformRows.length > 0 && <p class="note" style={{ marginTop: '8px' }}>Guessed from asset file names. Signature files are not counted.</p>}
        </Card>
      </div>
      {releases.length > 0 && (
        <Card title="Releases" sub={`${releases.length} published`} flush>
          <div class="table-wrap result-scroll">
            <table class="data">
              <thead><tr><th>Release</th><th>Published</th><th>Assets</th><th class="num">Downloads</th></tr></thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.tag}>
                    <td><b>{r.tag}</b>{r.prerelease && <span class="chip" style={{ marginLeft: '6px' }}>pre-release</span>}{r.name !== r.tag && <div class="muted small">{r.name}</div>}</td>
                    <td class="small">{r.published ? new Date(r.published).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td class="small">
                      {r.assets.slice().sort((a, b) => b.downloads - a.downloads).slice(0, 4).map((a) => (
                        <div key={a.name} class="mono" title={a.name}>{a.name.length > 46 ? `${a.name.slice(0, 45)}…` : a.name} <span class="muted">· {formatNumber(a.downloads)}</span></div>
                      ))}
                      {r.assets.length > 4 && <span class="muted">+{r.assets.length - 4} more</span>}
                    </td>
                    <td class="num">{formatNumber(r.downloads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
