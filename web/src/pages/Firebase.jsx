import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, BarList, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { dayLabel } from './GitHub.jsx';

// Who loads the pages: humans first (accent), then the bot families.
export const VISITOR_SERIES = [
  { key: 'human', label: 'Humans', color: 'var(--series-1)' },
  { key: 'search', label: 'Search bots', color: 'var(--series-3)' },
  { key: 'ai', label: 'AI bots', color: 'var(--series-7)' },
  { key: 'other', label: 'Other bots', color: 'var(--series-muted)' },
];
const KIND_CHIP = { 'ai-crawler': 'accent', 'ai-assistant': 'accent', search: 'good' };
const ms = (v) => (v === null || v === undefined ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);

export function Firebase({ range, params }) {
  const status = useAsync(() => api.get('/firebase/status'), []);
  if (status.error) return <ErrorState error={status.error} onRetry={status.reload} />;
  if (!status.data) return <><Loading height={92} /><Loading height={300} /></>;
  const { links } = status.data;
  if (!links.length) return <Setup onLinked={status.reload} />;
  // From a site (?site=), only that site; a site that isn't on Firebase says so.
  const scoped = params.get('site') || '';
  const link = scoped ? links.find((l) => l.siteId === scoped) : links[0];
  if (!link) {
    return (
      <div class="state">
        <h3>This site isn’t on Firebase App Hosting</h3>
        <p>Studio reads server-side traffic from Firebase only for sites linked to an App Hosting backend.</p>
        <a class="btn" href="#/settings?i=firebase">Link it</a> <a class="btn ghost" href="#/firebase">All Firebase sites</a>
      </div>
    );
  }

  return (
    <>
      {!scoped && links.length > 1 && (
        <div class="health-sites" role="group" aria-label="Site" style={{ marginBottom: '16px' }}>
          {links.map((l) => (
            <button key={l.siteId} type="button" class={`btn${l.siteId === link.siteId ? ' primary' : ''}`} aria-pressed={l.siteId === link.siteId}
              onClick={() => navigate(`/firebase${qs({ site: l.siteId })}`)}>{l.label}</button>
          ))}
        </div>
      )}
      <SiteTraffic key={`${link.siteId}:${range}`} link={link} range={range} onSynced={status.reload} />
    </>
  );
}

function Setup({ onLinked }) {
  const [state, setState] = useState({ busy: false, error: null, result: null });
  async function find() {
    setState({ busy: true, error: null, result: null });
    try {
      const result = await api.post('/firebase/auto-link');
      setState({ busy: false, error: null, result });
      if (result.linked.length) onLinked();
    } catch (error) {
      setState({ busy: false, error, result: null });
    }
  }
  const { result, error } = state;
  return (
    <div class="state">
      <h3>Connect Firebase App Hosting</h3>
      <p>
        Studio reads your backend's request logs from Cloud Logging, so it sees every page load, including AI crawlers, search bots
        and visitors who block GA4, plus errors, latency and deploys. It looks through your Google Cloud projects for the backend that serves each site.
      </p>
      <div class="row">
        <button class="btn primary" type="button" disabled={state.busy} onClick={find}>
          <Icon name="search" size={13} /> {state.busy ? 'Searching your projects…' : 'Find my backends'}
        </button>
        <a class="btn ghost" href="#/settings?i=firebase">Link by hand</a>
      </div>
      {error && (
        <p class="small" style={{ color: 'var(--critical-ink)', margin: 0 }}>
          {error.message} {error.hint && <span class="muted">{error.hint}</span>}
          {error.kind === 'needs-logging-scope' && <> <a href="#/settings?i=google">Sign in again</a></>}
        </p>
      )}
      {result && !result.linked.length && (
        <p class="hint">
          No backend in {result.scanned.join(', ') || 'your projects'} served a Studio site in the last 3 days.
          {result.services.length > 0 && <> Seen: {result.services.map((s) => `${s.project}/${s.service} (${s.hosts.join(', ') || 'no host'})`).join(' · ')}.</>}
          {result.errors.length > 0 && <> Skipped: {result.errors.map((e) => `${e.project}: ${e.error}`).join(' · ')}</>}
        </p>
      )}
    </div>
  );
}

function SiteTraffic({ link, range, onSynced }) {
  const data = useAsync(() => api.get(`/firebase/sites/${link.siteId}${qs({ range })}`), [link.siteId, range]);
  const [sync, setSync] = useState({ busy: false, msg: '' });

  async function syncNow() {
    setSync({ busy: true, msg: '' });
    try {
      const { results } = await api.post('/firebase/sync');
      const mine = results.find((r) => r.siteId === link.siteId);
      setSync({ busy: false, msg: mine?.error ? `${mine.error}${mine.hint ? ` ${mine.hint}` : ''}` : mine?.more ? 'Synced a batch; more history is still coming in.' : '' });
      data.reload();
      onSynced();
    } catch (err) {
      setSync({ busy: false, msg: err.message });
    }
  }

  const header = (
    <div class="meta-line" style={{ alignItems: 'center' }}>
      <span><Icon name="flame" size={13} /> <span class="mono">{link.project}</span> · backend <b>{link.service}</b></span>
      <span>{link.lastSync ? `Synced ${formatRelative(link.lastSync)}` : 'Not synced yet'}</span>
      <a href={`https://console.firebase.google.com/project/${link.project}/apphosting`} target="_blank" rel="noreferrer">Firebase console <Icon name="external" size={11} /></a>
      <button class="btn ghost" type="button" disabled={sync.busy} onClick={syncNow}><Icon name="refresh" size={13} /> {sync.busy ? 'Syncing…' : 'Sync now'}</button>
    </div>
  );

  if (data.error) return <>{header}<ErrorState error={data.error} onRetry={data.reload} /></>;
  if (!data.data) return <>{header}<Loading height={92} /><Loading height={300} /></>;
  const d = data.data;
  const t = d.totals;
  const dates = d.range.dates;
  const deployNotes = d.deploys.map((x) => ({ date: x.date, label: `Deploy ${x.revision.replace(`${link.service}-`, '')}`, kind: 'deploy' }));
  const syncError = sync.msg || d.syncError;

  if (!d.dataStart) {
    return (
      <>
        {header}
        {syncError && <p class="small" style={{ color: 'var(--critical-ink)' }}>{syncError}</p>}
        <Empty title="No requests synced yet">The first sync pulls the last 30 days of logs and takes a minute. Press <b>Sync now</b> if it hasn't started.</Empty>
      </>
    );
  }

  return (
    <>
      {header}
      {syncError && <p class="small" style={{ color: 'var(--critical-ink)', margin: 0 }}>{syncError}</p>}
      <KpiStrip items={[
        { label: 'Human page loads', value: formatNumber(t.human), meta: `${formatNumber(Math.round(t.visitorDays / Math.max(1, d.series.visitors.filter((v) => v !== null).length)))} visitors a day` },
        { label: 'Bot share', value: t.botShare === null ? '—' : formatPercent(t.botShare, 0), meta: 'of page loads' },
        { label: 'AI bots', value: formatNumber(t.ai), meta: 'crawlers + assistants' },
        { label: 'Search bots', value: formatNumber(t.search) },
        { label: 'Server errors', value: t.errorRate === null ? '—' : formatPercent(t.errorRate, 2), meta: `${formatNumber(t.errors5xx)} 5xx` },
        { label: 'Page latency', value: ms(t.p95), meta: `p95 · p50 ${ms(t.p50)}` },
        { label: 'Cold starts', value: formatNumber(t.coldStarts) },
      ]} />

      <Card title="Who loads your pages" sub="Page and robots/sitemap requests that reached the server, by visitor type">
        <LineChart labels={dates.map(dayLabel)} dates={dates} annotations={deployNotes} area={false} height={240}
          series={VISITOR_SERIES.map((s) => ({ label: s.label, color: s.color, values: d.series[s.key] }))}
          format={(v, axis) => formatNumber(v, { compact: axis })} />
        {d.dataStart > d.range.start && (
          <p class="note">Cloud Logging keeps 30 days, so history starts {d.dataStart}. Studio keeps its own copy from here on, so longer ranges fill in over time.</p>
        )}
      </Card>

      <div class="grid cols-2">
        <Card title="Bots" sub="Every automated client, by requests" flush>
          {d.bots.length ? (
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Bot</th><th>Type</th><th class="num">Requests</th><th class="num">Pages</th><th class="num">Last seen</th></tr></thead>
                <tbody>
                  {d.bots.map((b) => (
                    <tr key={`${b.bot}:${b.kind}`}>
                      <td><b>{b.bot}</b>{b.robots > 0 && <span class="muted small"> · read robots.txt</span>}</td>
                      <td class="small"><span class={`chip ${KIND_CHIP[b.kind] || ''}`}>{b.label}</span></td>
                      <td class="num">{formatNumber(b.hits)}</td>
                      <td class="num">{formatNumber(b.pages)}</td>
                      <td class="num small">{formatRelative(b.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p class="muted small" style={{ padding: '0 16px' }}>No bots in this range.</p>}
        </Card>
        <Card title="What AI reads" sub="Pages fetched by AI crawlers and assistants">
          {d.aiPaths.length
            ? <BarList rows={d.aiPaths} value={(r) => r.hits} label={(r) => r.path} format={formatNumber} extra={(r) => r.bots.slice(0, 2).join(', ')} />
            : <p class="muted small">No AI crawler or assistant fetched a page in this range.</p>}
        </Card>
      </div>

      <div class="grid cols-2">
        <Card title="Top pages" sub="Full page loads by humans, including visitors GA4 can't see">
          {d.humanPaths.length
            ? <BarList rows={d.humanPaths} value={(r) => r.hits} label={(r) => r.path} format={formatNumber} />
            : <p class="muted small">No human page loads in this range.</p>}
        </Card>
        <Card title="Referrers" sub="Other sites that sent visitors, from the server's Referer header">
          {d.referrers.length
            ? <BarList rows={d.referrers} value={(r) => r.hits} label={(r) => r.host} format={formatNumber} />
            : <p class="muted small">No external referrers in this range.</p>}
        </Card>
      </div>

      {d.endpoints.length > 0 && (
        <Card title="App endpoints" sub="/api/* routes: update checks, downloads, redirects. Clients = distinct IP + user agent per day." flush>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Endpoint</th><th class="num">Requests</th><th class="num">Client-days</th><th class="num">Errors</th><th class="num">Last hit</th></tr></thead>
              <tbody>
                {d.endpoints.map((e) => (
                  <tr key={e.path}>
                    <td class="mono small">{e.path}</td>
                    <td class="num">{formatNumber(e.hits)}</td>
                    <td class="num">{formatNumber(e.daily.reduce((a, v) => a + (v || 0), 0))}</td>
                    <td class="num" style={{ color: e.errors ? 'var(--critical-ink)' : undefined }}>{formatNumber(e.errors)}</td>
                    <td class="num small">{formatRelative(e.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div class="grid cols-2">
        <Card title="Broken pages and server errors" sub="404s on pages and files, and every 5xx" flush>
          {d.errors.length ? (
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Path</th><th>Status</th><th class="num">Hits</th><th class="num">By humans</th><th class="num">Last</th></tr></thead>
                <tbody>
                  {d.errors.map((e) => (
                    <tr key={`${e.path}:${e.status}`}>
                      <td class="mono small">{e.path}</td>
                      <td class="small" style={{ color: e.status >= 500 ? 'var(--critical-ink)' : 'var(--text-2)' }}>{e.status}</td>
                      <td class="num">{formatNumber(e.hits)}</td>
                      <td class="num">{formatNumber(e.humans)}</td>
                      <td class="num small">{formatRelative(e.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p class="muted small" style={{ padding: '0 16px' }}>No 404s or server errors in this range.</p>}
        </Card>
        <Card title="Server" sub={`${d.deploys.length} ${d.deploys.length === 1 ? 'deploy' : 'deploys'} in this range · markers show each new revision`}>
          <LineChart labels={dates.map(dayLabel)} dates={dates} annotations={deployNotes} area={false} height={200}
            series={[
              { label: 'Requests', color: 'var(--series-1)', values: d.series.requests },
              { label: '5xx errors', color: 'var(--series-8)', values: d.series.errors5xx },
              { label: 'Cold starts', color: 'var(--series-4)', values: d.series.coldStarts },
            ]}
            format={(v, axis) => formatNumber(v, { compact: axis })} />
        </Card>
      </div>

      <p class="note">
        App Hosting's CDN answers cached files (scripts, images) itself, so those barely show here. HTML and <code>/api/*</code> always reach the server,
        so page loads, bots, errors and endpoint hits are complete. IP addresses are never stored: visitors are counted with a hash that changes every day.
      </p>
    </>
  );
}

// Compact cards for other pages. Render nothing until the site is linked.
const historyKey = (range) => (range === '90d' ? '90d' : range === '28d' || range === '30d' ? '28d' : '7d');

function useSummary(siteId, range) {
  return useAsync(() => api.get(`/firebase/sites/${siteId}/summary${qs({ range: historyKey(range) })}`).catch(() => ({ summary: null })), [siteId, range]);
}

// Site Overview: who loads the pages, from the server's side.
export function ServerTrafficCard({ site, range }) {
  const data = useSummary(site.id, range);
  const s = data.data?.summary;
  if (!s?.dataStart) return null;
  const t = s.totals;
  return (
    <Card title="Server-side visitors" sub={`Firebase request log · ${historyKey(range)} · humans and bots GA4 never sees`}
      actions={<a class="small" href={`#/firebase${qs({ site: site.id })}`}>Open Firebase →</a>}>
      <div class="grid cols-2" style={{ gap: '16px', marginBottom: 0 }}>
        <div>
          <KpiStrip items={[
            { label: 'Human page loads', value: formatNumber(t.human) },
            { label: 'Bot share', value: t.botShare === null ? '—' : formatPercent(t.botShare, 0) },
            { label: 'AI bots', value: formatNumber(t.ai) },
          ]} />
          <LineChart labels={s.dates.map(dayLabel)} dates={s.dates} area={false} height={150}
            series={VISITOR_SERIES.map((x) => ({ label: x.label, color: x.color, values: s.series[x.key] }))}
            format={(v, axis) => formatNumber(v, { compact: axis })} />
        </div>
        <div>
          <div class="small muted" style={{ marginBottom: '8px' }}>AI crawlers and assistants</div>
          {s.bots.length
            ? <BarList rows={s.bots} value={(r) => r.hits} label={(r) => r.bot} format={formatNumber} extra={(r) => r.label} />
            : <p class="muted small">No AI bots fetched a page in this range.</p>}
        </div>
      </div>
    </Card>
  );
}

// Site health: what the server itself saw.
export function ServerHealthCard({ site, range }) {
  const data = useSummary(site.id, range);
  const s = data.data?.summary;
  if (!s?.dataStart) return null;
  const t = s.totals;
  return (
    <Card title="Server" sub={`Firebase App Hosting · ${s.link.service} · ${historyKey(range)} from the request log`}
      actions={<a class="small" href={`#/firebase${qs({ site: site.id })}`}>Details →</a>}>
      <KpiStrip items={[
        { label: 'Requests', value: formatNumber(t.requests) },
        { label: '5xx rate', value: t.errorRate === null ? '—' : formatPercent(t.errorRate, 2), meta: `${formatNumber(t.errors5xx)} errors` },
        { label: 'Page latency p95', value: ms(t.p95), meta: `p50 ${ms(t.p50)}` },
        { label: 'Cold starts', value: formatNumber(t.coldStarts), meta: 'new instances started' },
      ]} />
    </Card>
  );
}
