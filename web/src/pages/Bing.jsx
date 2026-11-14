import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { dayLabel } from './GitHub.jsx';

const METRICS = [
  { key: 'clicks', label: 'Clicks' },
  { key: 'impressions', label: 'Impressions' },
];

// Google | Bing switch shared by the two search views.
export function Bing({ site, range }) {
  const data = useAsync((o) => api.get(`/bing/sites/${site.id}${qs({ range, fresh: o?.fresh })}`), [site.id, range]);
  const [metric, setMetric] = useState('clicks');

  if (data.error) {
    const setup = ['needs-bing', 'bing-site', 'bing-key'].includes(data.error.kind);
    return (
      <>
        {setup ? (
          <Empty title={data.error.kind === 'needs-bing' ? 'Connect Bing Webmaster Tools' : data.error.message}>
            {data.error.kind === 'needs-bing'
              ? 'One API key shows Bing clicks, queries, pages and crawl health for every site you’ve verified in Bing.'
              : data.error.hint}
            <div class="mt-10"><a class="btn primary" href="#/settings?i=bing">Open Bing settings</a></div>
          </Empty>
        ) : <ErrorState error={data.error} onRetry={data.reload} />}
      </>
    );
  }
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;

  const b = data.data;
  const labels = b.range.dates.map(dayLabel);
  const prev = b.previous || {};
  const c = b.crawl.latest;
  return (
    <>
      <KpiStrip items={[
        { label: 'Clicks', value: formatNumber(b.current.clicks), raw: b.current.clicks, previous: prev.clicks },
        { label: 'Impressions', value: formatNumber(b.current.impressions), raw: b.current.impressions, previous: prev.impressions },
        { label: 'CTR', value: b.current.ctr === null ? '—' : formatPercent(b.current.ctr), raw: b.current.ctr, previous: prev.ctr },
        { label: 'Avg. position', value: b.current.position === null ? '—' : formatDecimal(b.current.position, 1), raw: b.current.position, previous: prev.position, invert: true, help: 'Impression-weighted, from top queries. Lower is better.' },
      ]} />
      <p class="note">
        {b.siteUrl} · Bing reported up to {b.range.lastReported || '—'}, so this range ends there.
        {b.range.historyFrom && ` Kauzl has kept daily history since ${b.range.historyFrom}.`}
        {' '}<button class="btn ghost" type="button" onClick={() => data.reload({ fresh: true })} disabled={data.loading}><Icon name="refresh" size={12} /> Refresh</button>
      </p>

      <Card title={`Bing ${metric}`} actions={<Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />}>
        <LineChart labels={labels} series={[{ label: METRICS.find((m) => m.key === metric).label, values: b.series[metric].map((v) => (v === null ? NaN : v)) }]}
          format={(v, axis) => formatNumber(v, { compact: axis })} height={220} />
      </Card>

      <div class="grid cols-2">
        <Card title="Top queries in Bing" flush>
          <QueryTable rows={b.queries} first="Query" field="query" />
        </Card>
        <Card title="Top pages in Bing" flush>
          <QueryTable rows={b.pages} first="Page" field="page" path />
        </Card>
      </div>

      <div class="grid cols-2-1">
        <Card title="Crawl health" sub={c ? `Latest Bing crawl report: ${c.date}` : 'No crawl report yet'}>
          {c ? (
            <>
              <div class="crawl-grid">
                <Stat label="Pages in index" value={c.inIndex} />
                <Stat label="Crawled" value={c.crawled} />
                <Stat label="Crawl errors" value={c.errors} bad={c.errors > 0} />
                <Stat label="4xx" value={c.code4xx} bad={c.code4xx > 0} />
                <Stat label="5xx" value={c.code5xx} bad={c.code5xx > 0} />
                <Stat label="Blocked by robots.txt" value={c.blocked} />
                <Stat label="DNS failures" value={c.dns} bad={c.dns > 0} />
                <Stat label="Timeouts" value={c.timeouts} bad={c.timeouts > 0} />
                <Stat label="Inbound links" value={c.inLinks} />
              </div>
              {b.crawl.series.errors.some((v) => v) && (
                <LineChart labels={labels} height={140} format={(v, axis) => formatNumber(v, { compact: axis })}
                  series={[{ label: 'Crawl errors', values: b.crawl.series.errors.map((v) => (v === null ? NaN : v)), color: 'var(--critical)' }]} />
              )}
            </>
          ) : <p class="muted small">Bing hasn’t reported crawl stats for this site yet.</p>}
        </Card>
        <Submit site={site} quota={b.quota} host={b.siteUrl} />
      </div>
    </>
  );
}

export function Stat({ label, value, bad }) {
  return (
    <div class="crawl-stat">
      <div class="small muted">{label}</div>
      <div class="crawl-value" style={bad ? { color: 'var(--critical-ink)' } : undefined}>{value === null || value === undefined ? '—' : formatNumber(value)}</div>
    </div>
  );
}

function QueryTable({ rows, first, field, path }) {
  if (!rows.length) return <p class="muted small inset">Nothing reported for this range.</p>;
  const show = (v) => {
    if (!path) return v;
    try {
      return new URL(v).pathname;
    } catch {
      return v;
    }
  };
  return (
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>{first}</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">CTR</th><th class="num">Pos.</th></tr></thead>
        <tbody>
          {rows.slice(0, 25).map((q) => (
            <tr key={q[field]}>
              <td class="cell-path">{path ? <code title={q[field]}>{show(q[field])}</code> : q[field]}</td>
              <td class="num">{formatNumber(q.clicks)}</td>
              <td class="num">{formatNumber(q.impressions)}</td>
              <td class="num">{formatPercent(q.ctr)}</td>
              <td class="num">{q.position === null ? '—' : formatDecimal(q.position, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Submit({ site, quota, host }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(quota);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post(`/bing/sites/${site.id}/submit`, { urls: text.split(/\s+/).filter(Boolean) });
      setMsg({ ok: true, text: `Submitted ${r.submitted} URL${r.submitted === 1 ? '' : 's'}.` });
      setLeft(r.quota);
      setText('');
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Submit URLs to Bing" sub={left ? `${formatNumber(left.daily)} left today · ${formatNumber(left.monthly)} this month` : ''}>
      <form class="stack gap-8" onSubmit={submit}>
        <textarea rows={4} value={text} placeholder={`${host}new-page\n${host}blog/launch`} onInput={(e) => setText(e.currentTarget.value)} aria-label="URLs to submit" />
        <div class="row">
          <button class="btn primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Submitting…' : 'Submit'}</button>
          {msg && <span class={`small ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</span>}
        </div>
        <p class="note m-0">One URL per line. Use it after a deploy or a new post so Bing (and the AI answers built on it) picks the page up within hours.</p>
      </form>
    </Card>
  );
}
