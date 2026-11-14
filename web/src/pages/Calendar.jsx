import { useState } from 'preact/hooks';
import { formatNumber, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate, withParam, usePersistent } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented, Empty } from '../components/ui.jsx';
import { ClaudeComments } from '../components/ClaudeComments.jsx';
import { Icon } from '../components/icons.jsx';
import { LineChart, kindColor } from '../charts/LineChart.jsx';
import { postHref } from './Posts.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const METRICS = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'clicks', label: 'Search clicks' },
];
const LINE_ICONS = { site: 'grid', source: 'flow', page: 'pages', search: 'search', event: 'megaphone', github: 'github', extension: 'puzzle', alert: 'bell', error: 'x' };

// Month grid of daily traffic vs a typical same weekday, with each day's events
// and alerts; picking a day shows its story. Month, site and day live in the URL.
export function Calendar({ sites, params }) {
  const [savedSite, setSavedSite] = usePersistent('calendar-site', 'all');
  const [metric, setMetric] = usePersistent('calendar-metric', 'sessions');
  const site = params.get('site') || (savedSite === 'all' || sites.some((s) => s.id === savedSite) ? savedSite : 'all');
  const month = params.get('month') || '';
  const data = useAsync((opts) => api.get(`/calendar${qs({ month, site, fresh: opts?.fresh })}`), [month, site]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={520} /></>;

  const m = data.data;
  const selected = params.get('day') || defaultDay(m);
  const pickSite = (id) => {
    setSavedSite(id);
    navigate(withParam('day', '', `#${withParam('site', id === 'all' ? '' : id)}`));
  };
  const goMonth = (offset) => navigate(withParam('day', '', `#${withParam('month', shiftMonth(m.month, offset))}`));
  const thisMonth = m.today.slice(0, 7);
  const useMetric = metric === 'clicks' && !m.hasSearch ? 'sessions' : metric;
  const t = m.totals;

  return (
    <>
      <div class="toolbar">
        <div class="row gap-4">
          <button class="btn icon-btn" type="button" aria-label="Previous month" onClick={() => goMonth(-1)}>
            <Icon name="chevron" size={14} class="flip" />
          </button>
          <h2 class="cal-title">{monthLabel(m.month)}</h2>
          <button class="btn icon-btn" type="button" aria-label="Next month" disabled={m.month >= thisMonth} onClick={() => goMonth(1)}>
            <Icon name="chevron" size={14} />
          </button>
          {m.month !== thisMonth && <button class="btn ghost" type="button" onClick={() => navigate(withParam('day', '', `#${withParam('month', '')}`))}>This month</button>}
        </div>
        <span class="grow" />
        <label class="sr-only" for="calendar-site">Site</label>
        <select id="calendar-site" value={site} onChange={(e) => pickSite(e.currentTarget.value)} style={{ width: 'auto' }}>
          <option value="all">All sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.label}{s.demo ? ' (demo)' : ''}</option>)}
        </select>
        {m.hasSearch && <Segmented label="Cell metric" value={useMetric} options={METRICS} onChange={setMetric} />}
        <button class="btn icon-btn" type="button" title="Reload from Google" aria-label="Reload from Google" onClick={() => data.reload({ fresh: true })}>
          <Icon name="refresh" size={14} />
        </button>
      </div>

      {m.errors.length > 0 && (
        <div class="state error" role="alert">
          <h3>Some sources didn’t load</h3>
          <ul class="small" style={{ margin: 0, paddingLeft: '18px' }}>
            {m.errors.map((e, i) => <li key={i}><b>{e.site}:</b> {e.message}</li>)}
          </ul>
          {m.errors.some((e) => e.kind === 'auth') && <a class="btn primary" href="#/settings?i=google">Connect Google</a>}
        </div>
      )}

      <KpiStrip items={[
        { label: 'Sessions', value: m.hasTraffic ? formatNumber(t.sessions) : '—', raw: t.sessions, previous: t.baseline || undefined,
          meta: t.baseline ? 'vs typical weekdays' : '', help: 'Each day is compared with the same weekday over the previous 4 weeks.' },
        { label: 'Search clicks', value: t.clicks === null ? '—' : formatNumber(t.clicks), meta: m.searchLast ? `through ${formatDate(m.searchLast.replaceAll('-', ''))}` : m.hasSearch ? '' : 'no Search Console' },
        { label: 'Best day', value: t.best ? dayLabel(t.best) : '—', meta: t.best ? pctLabel(m.days.find((d) => d.date === t.best).change) : '' },
        { label: 'Worst day', value: t.worst ? dayLabel(t.worst) : '—', meta: t.worst ? pctLabel(m.days.find((d) => d.date === t.worst).change) : '' },
        { label: 'Events', value: formatNumber(t.events), meta: `${t.alerts} alert${t.alerts === 1 ? '' : 's'}${t.stars ? ` · +${t.stars} stars` : ''}` },
      ]} />

      <div class="grid cols-2-1">
        {/* Claude sits under the month so the two columns end at about the same height. */}
        <div class="stack cal-left" style={{ gap: '16px', minWidth: 0 }}>
          <Card title="Month" sub={useMetric === 'clicks' ? 'Search clicks vs a typical same weekday' : 'Sessions vs a typical same weekday'} flush class="cal-month">
            <MonthGrid m={m} metric={useMetric} selected={selected} />
            <Legend />
          </Card>
          <ClaudeComments key={`claude:${site}:${selected}`} siteId={site} date={selected} onChange={data.reload} />
        </div>
        <DayStory key={`${site}:${selected}`} date={selected} site={site} today={m.today} onChange={data.reload} />
      </div>
    </>
  );
}

function MonthGrid({ m, metric, selected }) {
  const lead = (new Date(`${m.days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...m.days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const value = (d) => (metric === 'clicks' ? d.clicks : d.sessions);
  const base = (d) => (metric === 'clicks' ? d.clicksBaseline : d.baseline);

  return (
    <div class="cal" role="grid" aria-label={`${monthLabel(m.month)} by day`}>
      <div class="cal-row cal-head" role="row">
        {WEEKDAYS.map((w) => <div key={w} role="columnheader">{w}</div>)}
        <div role="columnheader" class="cal-week">Week</div>
      </div>
      {weeks.map((week, wi) => {
        const done = week.filter((d) => d && value(d) !== null && !d.partial);
        const total = done.reduce((a, d) => a + value(d), 0);
        const usual = done.reduce((a, d) => a + (base(d) || 0), 0);
        return (
          <div class="cal-row" role="row" key={wi}>
            {week.map((d, i) => (d ? <DayCell key={d.date} d={d} metric={metric} selected={d.date === selected} /> : <div key={`x${i}`} class="cal-day blank" role="gridcell" />))}
            <div class="cal-week" role="gridcell">
              {done.length > 0 && (
                <>
                  <span class="cal-val">{formatNumber(total, { compact: true })}</span>
                  {usual > 0 && <span class={`cal-delta ${toneClass(total, usual)}`}>{pctLabel((total - usual) / usual)}</span>}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayCell({ d, metric, selected }) {
  const value = metric === 'clicks' ? d.clicks : d.sessions;
  const tone = metric === 'clicks' ? d.clicksTone : d.tone;
  const change = metric === 'clicks' ? (d.clicksBaseline ? (d.clicks - d.clicksBaseline) / d.clicksBaseline : null) : d.change;
  const day = Number(d.date.slice(8));
  const marks = [...new Map(d.events.map((e) => [e.kind, e])).values()].slice(0, 4);
  const label = [
    formatLong(d.date),
    value === null ? (d.future ? 'not yet' : 'no data') : `${formatNumber(value)} ${metric === 'clicks' ? 'search clicks' : 'sessions'}${d.partial ? ' so far' : ''}`,
    change !== null && Number.isFinite(change) && !d.partial ? `${pctLabel(change)} vs usual` : '',
    d.events.length ? `${d.events.length} event${d.events.length === 1 ? '' : 's'}` : '',
    d.alerts.length ? `${d.alerts.length} alert${d.alerts.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(', ');

  if (d.future) {
    return (
      <div class="cal-day future" role="gridcell" aria-label={label} title={d.events.map((e) => e.label).join('\n') || undefined}>
        <span class="cal-num">{day}</span>
        {marks.length > 0 && <span class="cal-marks" aria-hidden="true">{marks.map((e) => <i key={e.kind} style={{ background: kindColor(e.kind) }} />)}</span>}
      </div>
    );
  }
  return (
    <button type="button" role="gridcell" aria-label={label} aria-selected={selected} title={d.events.map((e) => e.label).join('\n') || undefined}
      class={`cal-day tone-${tone}${selected ? ' selected' : ''}`} onClick={() => navigate(withParam('day', d.date))}>
      <span class="cal-num">{day}{d.partial && <span class="cal-today">today</span>}</span>
      <span class="cal-val">{value === null ? <span class="muted">—</span> : formatNumber(value, { compact: true })}</span>
      {change !== null && Number.isFinite(change) && !d.partial && tone !== 'flat' && <span class={`cal-delta ${tone.startsWith('up') ? 'up' : 'down'}`}>{pctLabel(change)}</span>}
      {(marks.length > 0 || d.alerts.length > 0 || d.stars > 0) && (
        <span class="cal-marks" aria-hidden="true">
          {marks.map((e) => <i key={e.kind} style={{ background: kindColor(e.kind) }} />)}
          {d.alerts.length > 0 && <Icon name="bell" size={11} />}
          {d.stars > 0 && <span class="cal-stars">★{d.stars}</span>}
        </span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div class="legend cal-legend">
      <span><i class="swatch tone-up2" /> 40%+ above</span>
      <span><i class="swatch tone-up" /> 15%+ above</span>
      <span><i class="swatch tone-down" /> 15%+ below</span>
      <span><i class="swatch tone-down2" /> 40%+ below</span>
      {[['release', 'Release'], ['deploy', 'Deploy'], ['post', 'Post'], ['mention', 'Mention'], ['note', 'Note'], ['claude', 'Claude']].map(([k, l]) => (
        <span key={k}><i class="dot" style={{ background: kindColor(k) }} /> {l}</span>
      ))}
    </div>
  );
}

function DayStory({ date, site, today, onChange }) {
  const data = useAsync(() => api.get(`/calendar/day${qs({ date, site })}`), [date, site]);
  if (data.error) return <Card title={formatLong(date)}><ErrorState error={data.error} onRetry={data.reload} /></Card>;
  if (!data.data) return <Card title={formatLong(date)}><Loading height={420} /></Card>;
  const d = data.data;
  const detailed = d.sites.filter((s) => s.sources.length || s.pages.length || s.search?.queries?.length);

  // The numbers in words; events and alerts get their own list below, so their lines are left out here.
  const lines = d.lines.filter((l) => l.kind !== 'event' && l.kind !== 'alert');
  const happened = [
    ...d.events.map((e) => ({ ...e, when: 'that day' })),
    ...d.eventsBefore.map((e) => ({ ...e, when: 'day before' })),
  ].filter((e) => e.kind !== 'claude');

  return (
    <Card title={formatLong(date)} sub={d.partial ? 'so far' : date === addDay(today, -1) ? 'yesterday' : ''} class="cal-story">
      <div class="stack">
        <p class={`cal-headline tone-text-${d.tone}`}>{d.headline}</p>
        {d.trend.length > 1 && (
          <LineChart height={120} area series={[{ label: 'Sessions', values: d.trend.map((p) => p.sessions) }]}
            labels={d.trend.map((p) => formatDate(p.date.replaceAll('-', '')))} dates={d.trend.map((p) => p.date)}
            annotations={[...d.eventsBefore, ...d.events]} format={formatNumber} tooltipTitle="Sessions" />
        )}
        {lines.length > 0 && (
          <ul class="cal-lines">
            {lines.map((l, i) => (
              <li key={i}>
                <Icon name={LINE_ICONS[l.kind] || 'chart'} size={14} />
                <span>{l.href ? <a href={l.href}>{l.text}</a> : l.text}</span>
              </li>
            ))}
          </ul>
        )}

        {detailed.map((s) => {
          const sources = [...s.sources.filter((r) => r.value > 0).slice(0, 4), ...s.losers].filter((r) => r.value > 0 || Math.abs(r.gain) >= 0.5);
          const pages = s.pages.filter((r) => r.value > 0).slice(0, 4);
          const queries = (s.search?.queries || []).filter((q) => q.clicks > 0);
          if (!sources.length && !pages.length && !queries.length) return null;
          return (
            <div key={s.id} class="cal-moved">
              {d.sites.length > 1 && <h3 class="cal-sub"><a href={`#/site/${s.id}/overview`}>{s.label}</a></h3>}
              <div class="cal-moved-cols">
                <MovedList title="Sources" rows={sources} />
                <MovedList title="Landing pages" rows={pages} mono />
                {queries.length > 0 && (
                  <div>
                    <span class="nx-label-sm">Searches</span>
                    <ul class="cal-moved-list">
                      {queries.map((q) => <li key={q.query}><span>{q.query}</span><b>{formatNumber(q.clicks)} clicks</b></li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div class="cal-happened">
          <span class="nx-label-sm">What happened</span>
          {happened.length || d.alerts.length ? (
            <ul class="cal-happened-list">
              {d.alerts.map((a) => (
                <li key={a.id}>
                  <Icon name="bell" size={13} />
                  <a href={a.link} class={a.direction === 'up' ? 'good' : 'bad'} {...(a.link?.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>{a.title}</a>
                  <span class="muted">alert</span>
                </li>
              ))}
              {happened.map((e) => (
                <li key={e.id}>
                  <i class="dot" style={{ background: kindColor(e.kind) }} aria-hidden="true" />
                  <span class="cal-happened-label">
                    {/* Your posts open their analysis here; other events link out. */}
                    {e.source === 'posts' ? (
                      <>
                        <a href={postHref(e.id.slice('post:'.length))}>{e.label}</a>
                        {e.url && <>{' '}<a href={e.url} target="_blank" rel="noreferrer" class="muted" title="Open the post" aria-label="Open the post"><Icon name="external" size={12} /></a></>}
                      </>
                    ) : e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.label}</a> : e.label}
                  </span>
                  <span class="muted">{e.when}</span>
                  {e.id.startsWith('post:manual:') && e.when === 'that day' && (
                    <button class="btn ghost" type="button" title="Remove link" aria-label="Remove link"
                      onClick={async () => { await api.post('/posts/hide', { id: e.id.slice('post:'.length) }); data.reload(); onChange?.(); }}>
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p class="small muted">Nothing shipped, posted or alerted that day or the day before.</p>}
          <AddLink date={date} site={site} onAdded={() => { data.reload(); onChange?.(); }} />
        </div>

        {d.sessions === null && !d.lines.length && !d.events.length && (
          <Empty title="Nothing recorded">Link a GA4 property or Search Console to a site to see its days here.</Empty>
        )}
      </div>
    </Card>
  );
}

// Sources or landing pages that day: sessions, and the change on a usual same weekday.
function MovedList({ title, rows, mono = false }) {
  if (!rows.length) return null;
  return (
    <div>
      <span class="nx-label-sm">{title}</span>
      <ul class="cal-moved-list">
        {rows.map((r) => {
          const gain = Math.round(r.gain);
          return (
            <li key={r.label} title={`${formatNumber(r.value)} sessions, usually ${formatNumber(r.expected)}`}>
              <span>{mono ? <code>{r.label}</code> : r.label}</span>
              <b>{formatNumber(r.value)} <span class={`delta ${gain > 0 ? 'up' : gain < 0 ? 'down' : 'flat'}`}>{gain ? `${gain > 0 ? '+' : '−'}${formatNumber(Math.abs(gain))}` : 'same'}</span></b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A post you made that day (Reddit, LinkedIn, X, a blog…), saved as a manual post
// so it shows here, on Posts, and in that platform's traffic attribution.
function AddLink({ date, site, onAdded }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button class="link-btn cal-add-open" type="button" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13} /> Add a post link
      </button>
    );
  }
  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/posts/manual', { url, title, date, site: site === 'all' ? '' : site });
      setUrl('');
      setTitle('');
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form class="cal-add stack" onSubmit={add}>
      <h3 class="cal-sub">Add a post link</h3>
      <label class="field">Post URL<input required autoFocus type="url" value={url} placeholder="https://www.reddit.com/r/…" onInput={(e) => setUrl(e.currentTarget.value)} /></label>
      <label class="field"><span class="field-label">Title <small>optional</small></span><input value={title} placeholder="What it was about" onInput={(e) => setTitle(e.currentTarget.value)} /></label>
      <div class="row gap-8">
        <button class="btn primary" type="submit" disabled={busy}><Icon name="plus" size={13} /> Add to {dayLabel(date)}</button>
        <button class="btn ghost" type="button" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
        {error && <span class="small text-bad">{error}</span>}
      </div>
    </form>
  );
}

// Yesterday when it's in view, else the month's biggest mover, else its last day.
function defaultDay(m) {
  const yesterday = addDay(m.today, -1);
  if (m.days.some((d) => d.date === yesterday)) return yesterday;
  if (m.days.some((d) => d.date === m.today)) return m.today;
  return m.totals.best || m.totals.worst || [...m.days].reverse().find((d) => !d.future)?.date || m.days[0].date;
}

function addDay(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function shiftMonth(month, offset) {
  const [y, mo] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [y, mo] = month.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatLong(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function dayLabel(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

function toneClass(value, usual) {
  const c = (value - usual) / usual;
  return c >= 0.15 ? 'up' : c <= -0.15 ? 'down' : 'flat';
}

const pctLabel = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '' : `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`);
