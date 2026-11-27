import { useEffect, useRef, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { moneyFormat } from './AdMoney.jsx';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { ClaudeComments } from '../components/ClaudeComments.jsx';
import { TimelineAdd } from '../pages/Calendar.jsx';
import { TimelineCreate } from './TimelineCreate.jsx';
import { Page, OptionsSheet } from './Page.jsx';
import { SetupNote } from './TimelineTop.jsx';
import { pushPanel } from './Panel.jsx';
import { useSiteProduct } from '../product.js';
import { People, REGION } from './Live.jsx';
import { DayMap, dayPlaces } from './DayMap.jsx';
import { HEAT, mix, amountFill, peakFill, shareFill, changeFill, amountLegendStops, changeLegendStops, changeTone, toneClass } from './heatmap.js';

// Timeline (docs/redesign → Timeline): every day of a site as a map, with an
// inspector beside it. One bar of controls in the header: the period (a menu,
// with ‹ › to step), what colours the days (change vs usual, amount, or the
// pages / sources / searches behind them), which marks show, calendar or line.
// The tiles above pick the number. The inspector shows the whole period (what's
// moving, best and worst days, what happened) or the picked day (?day=).
// Everything lives in the address: ?z=day|7d|28d|month|year &end= &month= &m= &by= &f= &v=line &day=
const DAY = 86_400_000;
const tOf = (d) => Date.parse(`${d}T00:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addD = (d, n) => iso(tOf(d) + n * DAY);
const fmtD = (d, o) => new Date(tOf(d)).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-US'));
const kfmt = (v) => (v >= 10_000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmt(v));
const pct = (c) => (c === null || !Number.isFinite(c) ? '—' : `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}%`);
const monthName = (ym, short) => new Date(tOf(`${ym}-01`)).toLocaleDateString('en-GB', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC' });
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); return iso(Date.UTC(y, m - 1 + n, 1)).slice(0, 7); };

const METRICS = [['sessions', 'Visits'], ['users', 'People'], ['views', 'Page views'], ['clicks', 'Search clicks'], ['spent', 'Ad spend'], ['earned', 'Ad earnings']];
// Money metrics (Traffic → Ad money): shown only for sites with any, in the GA4 currency.
const MONEY = new Set(['spent', 'earned']);
const LENSES = { page: { name: 'Landing pages', one: 'page', of: 'sessions', picker: true }, source: { name: 'Sources', one: 'source', of: 'sessions', picker: true }, query: { name: 'Searches', one: 'search', of: 'clicks', picker: true }, goal: { name: 'Goals', one: 'goal', of: 'sessions', picker: true }, citation: { name: 'Citation sources', one: 'citation source', picker: true }, metric: { name: 'Connected metrics', one: 'connected metric', picker: true }, job: { name: 'Job results', one: 'job', picker: true }, bing: { name: 'Bing search', one: 'Bing metric', picker: true } };
const ZOOMS = { day: 1, '7d': 7, '28d': 28 };
// Marks: what you did and what happened, by kind.
const KINDS = { deploy: ['rocket', 'Deploys'], release: ['github', 'Releases'], post: ['megaphone', 'Posts'], ad: ['target', 'Ads'], mention: ['chat', 'Mentions'], note: ['star', 'Notes'], custom: ['layers', 'Custom events'], alert: ['bell', 'Alerts'] };
const kindOf = (k) => (k === 'custom' ? 'custom' : k === 'deploy' ? 'deploy' : k === 'release' || k === 'extension' ? 'release' : k === 'post' ? 'post' : k === 'ad' ? 'ad' : k === 'mention' ? 'mention' : 'note');
const CHANGE_RULES = new Set(['traffic', 'search', 'installs', 'goals']);
const BREAKDOWN_REPORTS = {
  page: ['pages', 'View pages'], source: ['traffic', 'View traffic report'],
  query: ['search', 'View search report'],
};

function timelineChange(alert) {
  if (!CHANGE_RULES.has(alert.rule) || !Number.isFinite(alert.value) || !Number.isFinite(alert.baseline)) {
    return { label: alert.title || alert.label, detail: alert.detail };
  }
  return {
    label: (alert.title || alert.label).replace('sessions ', 'visits ').replace(/\s+[+−-]?\d+(?:[.,]\d+)?%$/, ''),
    detail: `${metricNumber(alert.value)} that day · ${metricNumber(alert.baseline)} per day over the previous 7 days`,
  };
}

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
const pageName = (p) => (p === '/' ? 'Home page' : p);

function metricAmount(values, summary) {
  const known = values.filter(Number.isFinite);
  if (!known.length) return null;
  if (summary === 'latest') return known.at(-1);
  const total = known.reduce((a, b) => a + b, 0);
  return summary === 'average' ? total / known.length : total;
}

const metricNumber = (value) => value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });

// A usual day: the same weekday over the four weeks before (the median, like the
// server's own baseline, which visits use directly so every sentence agrees).
export function usualOf(map, date, k) {
  if (k === 'sessions' && map.get(date)?.baseline != null) return map.get(date).baseline;
  const vals = [7, 14, 21, 28].map((n) => map.get(addD(date, -n))?.[k]).filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

export function Timeline({ site, sites, params }) {
  const scope = site ? site.id : 'all';
  const today = iso(Date.now());
  const yesterday = addD(today, -1);
  const custom = params.get('by') === 'custom';
  const last = custom || params.get('by') === 'job' ? today : yesterday;
  const zoom = ['day', '7d', '28d', 'month', 'year'].includes(params.get('z')) ? params.get('z') : 'month';
  const end = params.get('end') && params.get('end') <= last ? params.get('end') : last;
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : last.slice(0, 7);
  const metric = METRICS.some(([k]) => k === params.get('m')) ? params.get('m') : 'sessions';
  const lens = ['change', 'amount', 'custom', ...Object.keys(LENSES)].includes(params.get('by')) ? params.get('by') : 'amount';
  const focus = params.get('f') || '';
  const asLine = params.get('v') === 'line' && zoom !== 'day';
  const picked = params.get('day') || '';
  const [marks, setMarks] = usePersistent('tl-marks', Object.keys(KINDS).join(','));
  // Marks introduced after the preference was saved start visible.
  const defaultMarks = ['ad', 'custom'];
  const savedMarks = new Set(marks.split(',').filter(Boolean));
  const layers = Object.keys(KINDS).filter((kind) => savedMarks.has(kind) || (defaultMarks.includes(kind) && !savedMarks.has(`-${kind}`)));
  const [menu, setMenu] = useState('');
  const [adding, setAdding] = useState(false);
  const phone = usePhone();

  const go = (patch) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v === '' || v === null || v === undefined ? p.delete(k) : p.set(k, v));
    const path = site ? `/site/${site.id}/timeline` : '/timeline';
    location.hash = `${path}${p.toString() ? `?${p}` : ''}`;
    setMenu('');
  };

  // The window's days (future days of this month included, drawn empty).
  const days = windowDays(zoom, end, month, last);
  const first = days[0];
  const lastData = days.filter((d) => d <= last).at(-1) || first;
  const back = zoom === 'year' ? 28 : Math.max(28, days.length);
  const metrics = useAsync(() => api.get(`/calendar/metrics${qs({ site: scope, from: addD(first, -back), to: lastData < yesterday ? lastData : yesterday })}`), [scope, first, lastData]);
  const events = useAsync(() => api.get(`/calendar/events${qs({ site: scope, from: first, to: lastData })}`), [scope, first, lastData]);
  const L = LENSES[lens];
  const hasMetricPicker = custom || Boolean(L?.picker);
  const lead = useAsync(() => (L ? api.get(`/calendar/breakdown${qs({ site: scope, from: addD(first, -back), to: lastData, by: lens, limit: hasMetricPicker ? 200 : 12, daily: 1 })}`) : null), [scope, first, lastData, lens]);

  const map = new Map((metrics.data?.days || []).map((d) => [d.date, d]));
  const usual = (d, k = metric) => usualOf(map, d, k);
  const evList = [
    ...(events.data?.events || []).map((e) => ({ date: e.date, kind: kindOf(e.kind), label: e.label, url: e.url })),
    ...(events.data?.alerts || []).map((a) => ({ date: a.date, kind: 'alert', ...timelineChange(a) })),
  ].filter((e) => layers.includes(e.kind));
  const evOn = (d) => evList.filter((e) => e.date === d);

  const customTypes = events.data?.site === scope ? events.data.customTypes || [] : [];
  const customDates = days.filter((date) => date <= last);
  const customTotals = new Map();
  for (const event of events.data?.site === scope ? events.data.events || [] : []) {
    if (event.kind !== 'custom' || !event.eventType) continue;
    const key = event.eventType.toLowerCase();
    if (!customTotals.has(key)) customTotals.set(key, new Map());
    const totals = customTotals.get(key);
    totals.set(event.date, (totals.get(event.date) || 0) + event.value);
  }
  const breakdown = custom ? {
    by: 'custom', dates: customDates,
    rows: customTypes.map((type) => ({ ...type, days: customDates.map((date) => customTotals.get(type.key)?.get(date) ?? 0) })),
  } : lead.data;

  // Each lens item's value per day, over the window and the days before it.
  const items = (breakdown?.by === lens ? breakdown.rows : []).map((r, i) => {
    const byDate = new Map(breakdown.dates.map((d, j) => [d, r.days[j]]));
    const inWin = days.filter((d) => d <= last).map((d) => hasMetricPicker ? byDate.get(d) ?? null : byDate.get(d) || 0);
    const before = days.filter((d) => d <= last).map((d) => byDate.get(addD(d, -days.length)) ?? null);
    const total = metricAmount(inWin, r.summary);
    const prev = zoom === 'year' || (!hasMetricPicker && before.some((v) => v === null)) ? null : metricAmount(before, r.summary);
    const since = breakdown.dates.find((d) => byDate.get(d) > 0);
    return { key: r.key, label: r.label || (lens === 'page' ? pageName(r.key) : r.key), summary: r.summary, unit: (lens === 'page' || lens === 'source') ? 'visits' : lens === 'query' ? 'clicks' : r.unit, color: COLORS[i % COLORS.length], byDate, series: inWin, total, prev, fresh: since && since >= first ? since : null };
  });
  const ofDay = (d) => (L ? map.get(d)?.[L.of] || 0 : 0);
  const share = (it, d) => (ofDay(d) ? (it.byDate.get(d) || 0) / ofDay(d) : 0);
  const baseShare = (it, d) => [7, 14, 21, 28].reduce((a, n) => a + share(it, addD(d, -n)), 0) / 4;
  // A day is named only when something starts: a new item, or one running at 2× its usual share.
  const jumpOn = (d) => {
    const hot = (dd, it) => { const s = share(it, dd); const b = baseShare(it, dd); return s >= 0.08 && b > 0.005 && s / b >= 2 ? s / b : 0; };
    return items
      .map((it) => ({ it, isNew: it.fresh === d && share(it, d) >= 0.05, ratio: hot(d, it) }))
      .filter((x) => x.isNew || (x.ratio && !hot(addD(d, -1), x.it)))
      .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.ratio - a.ratio)[0];
  };
  const focused = items.find((it) => it.key === focus) || (lens === 'citation' ? items.find((it) => it.key === 'citing') : lens === 'bing' ? items.find((it) => it.unit === 'clicks') : undefined);
  const focusedPeak = hasMetricPicker && focused ? Math.max(1, ...focused.series.map((v) => v || 0)) : 1;
  const max = Math.max(1, ...days.map((d) => map.get(d)?.[metric] || 0));
  const fill = (d) => {
    const row = map.get(d);
    if (!hasMetricPicker && (!row || row[metric] === null)) return '';
    if (focused && hasMetricPicker) return peakFill(focused.byDate.get(d), focusedPeak, focused.color);
    if (focused) return shareFill(share(focused, d), focused.color);
    // Money is shaded by amount: a usual day of ad spend is usually nothing.
    if (lens === 'amount' || (lens === 'change' && MONEY.has(metric))) return amountFill(row[metric], max);
    if (lens !== 'change') return '';
    const u = usual(d);
    if (!u) return '';
    return changeFill(row[metric] / u - 1);
  };
  const money = moneyFormat(metrics.data?.currency);
  // A metric's value as text: money in the currency, counts as counts (vk: short).
  const vf = (v, k = metric) => (v === null || v === undefined ? '—' : MONEY.has(k) ? money(v) : fmt(v));
  const vk = (v, k = metric) => (MONEY.has(k) && v !== null && v !== undefined ? money(v) : kfmt(v));
  // On a phone the calendar is the screen and one day (the picked one, else yesterday)
  // sits in a sheet docked above the tab bar (DaySheet).
  const phoneDay = picked && picked <= last ? picked : last;
  const ctx = { map, metric, lens, items, hasMetricPicker, usual, fill, evOn, jumpOn, focused, share, last, picked: phone && zoom !== 'day' ? phoneDay : picked, L, phone, go, vf, vk, today };
  const touch = useRef(null);
  // A day picked on a phone stays in sight above the sheet that rose to show it, as Maps
  // keeps a picked place visible above its card.
  useEffect(() => {
    if (!phone || !picked) return undefined;
    const t = setTimeout(() => {
      const cell = document.querySelector('.tl-phone .sel');
      const sheet = document.querySelector('.tl-sheet');
      if (!cell || !sheet) return;
      const top = document.querySelector('.nx-ptop')?.getBoundingClientRect().bottom || 0;
      const r = cell.getBoundingClientRect();
      const below = r.bottom - (sheet.getBoundingClientRect().top - 12);
      const above = top + 12 - r.top;
      if (below > 0) window.scrollBy({ top: below, behavior: 'smooth' });
      else if (above > 0) window.scrollBy({ top: -above, behavior: 'smooth' });
    }, 320);
    return () => clearTimeout(t);
  }, [phone, picked]);
  const swipe = {
    onTouchStart: (e) => { const t = e.touches[0]; touch.current = [t.clientX, t.clientY]; },
    onTouchEnd: (e) => {
      if (!touch.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.current[0];
      const dy = t.clientY - touch.current[1];
      touch.current = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      const to = addD(phoneDay, dx < 0 ? 1 : -1);
      if (to <= last) go({ day: to === last ? '' : to });
    },
  };

  // Header controls.
  const periodLabel = zoom === 'day' ? (end === today ? 'Today' : end === yesterday ? 'Yesterday' : fmtD(end, { weekday: 'short', day: 'numeric', month: 'short' }))
    : zoom === 'month' ? (phone ? fmtD(`${month}-01`, { month: 'short', year: 'numeric' }) : monthName(month))
    : zoom === 'year' ? 'Last 12 months'
    : end === last ? `Last ${ZOOMS[zoom]} days` : `${fmtD(first, { day: 'numeric', month: 'short' })} – ${fmtD(end, { day: 'numeric', month: 'short' })}`;
  const step = (dir) => (zoom === 'month' ? go({ month: shiftMonth(month, dir), day: '' }) : go({ end: addD(end, dir * ZOOMS[zoom]), day: '' }));
  const offNext = zoom === 'year' || (zoom === 'month' ? month >= last.slice(0, 7) : end >= last);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(last.slice(0, 7), -i));
  const byLabel = custom ? 'Custom events' : L?.name || (lens === 'amount' ? 'Daily totals' : 'vs usual');
  const lensItems = (
    <>
      <MenuItem on={lens === 'amount'} onClick={() => go({ by: '', f: '' })}>Daily totals</MenuItem>
      <MenuItem on={lens === 'change'} onClick={() => go({ by: 'change', f: '' })}>Change vs usual</MenuItem>
      <hr /><span class="tl-lab">Break down by</span>
      {Object.entries(LENSES).map(([k, x]) => <MenuItem key={k} on={lens === k} onClick={() => go({ by: k, f: '' })}>{x.name}</MenuItem>)}
      {customTypes.length > 0 && <>
        <hr /><span class="tl-lab">Custom event types</span>
        {customTypes.map(({ key, label }) => <MenuItem key={key} on={custom && focus === key} onClick={() => go({ by: 'custom', f: key })}>{label}</MenuItem>)}
      </>}
    </>
  );
  const markRows = Object.entries(KINDS).map(([k, [ic, l]]) => {
    const on = layers.includes(k);
    const n = [...(events.data?.events || []).map((e) => kindOf(e.kind)), ...(events.data?.alerts || []).map(() => 'alert')].filter((x) => x === k).length;
    return (
      <button key={k} type="button" class="nx-pop-row" role="menuitemcheckbox" aria-checked={on}
        onClick={() => {
          savedMarks.delete(on ? k : `-${k}`);
          if (!on || defaultMarks.includes(k)) savedMarks.add(on ? `-${k}` : k);
          setMarks([...savedMarks].join(','));
        }}>
        <span class={`tl-cbx${on ? ' on' : ''}`}>{on && <Icon name="check" size={11} />}</span><Icon name={ic} size={14} />{l}<span class="nx-pop-meta">{n}</span>
      </button>
    );
  });
  const marksLabel = `Marks${layers.length < Object.keys(KINDS).length ? ` ${layers.length}/${Object.keys(KINDS).length}` : ''}`;
  const drawAs = (
    <span class="tl-seg" role="group" aria-label="Draw as">
      <button type="button" class={!asLine ? 'on' : ''} aria-pressed={!asLine} title="Calendar" aria-label="Calendar" onClick={() => go({ v: '' })}><Icon name="calendar" size={15} />{phone && ' Calendar'}</button>
      <button type="button" class={asLine ? 'on' : ''} aria-pressed={asLine} title="Line" aria-label="Line" onClick={() => go({ v: 'line' })}><Icon name="chart" size={15} />{phone && ' Line'}</button>
    </span>
  );
  const jobsHref = site ? `#/site/${encodeURIComponent(site.id)}/jobs` : '#/jobs';
  const addBtn = !site?.shared && <button type="button" class="nx-icon-btn" title="Add to Timeline" aria-label="Add to Timeline" onClick={() => setAdding(true)}><Icon name="plus" size={15} /></button>;
  const pickerLabel = { page: 'landing page', source: 'traffic source', query: 'search query', citation: 'citation source', goal: 'goal metric', metric: 'connected metric', job: 'job result', bing: 'Bing metric', custom: 'custom event type' }[lens];
  const pickerNames = { bing: 'Bing metrics', page: 'landing pages', source: 'traffic sources', query: 'searches', custom: 'event types' }[lens] || 'metrics';
  const pickerPrompt = { page: 'Choose a landing page', source: 'Choose a source', query: 'Choose a search', custom: 'Choose an event type' }[lens] || 'Choose a metric';
  const metricPicker = hasMetricPicker && (
    <select class="tl-pbtn tl-goal-metric" aria-label={`Timeline ${pickerLabel}`} value={focused?.key || ''}
      disabled={!items.length} onChange={(e) => go({ f: e.currentTarget.value })}>
      <option value="" disabled={lens === 'citation' && items.length > 0}>{(custom ? events.loading : lead.loading) ? `Loading ${pickerNames}…` : items.length ? pickerPrompt : `No ${pickerNames} available`}</option>
      {items.map((item) => {
        const period = item.summary === 'average' ? 'daily average' : item.summary === 'latest' ? 'latest' : 'total';
        const amount = item.total == null ? 'No data' : `${metricNumber(item.total)} ${lens === 'citation' ? 'answers' : item.unit && !['goal', 'metric'].includes(lens) ? item.unit : period}`;
        return <option key={item.key} value={item.key}>{item.label} · {amount}</option>;
      })}
    </select>
  );
  const timelinePicker = L || custom ? metricPicker : (
    <select class="tl-pbtn tl-goal-metric" aria-label="Timeline metric" value={metric}
      onChange={(e) => go({ m: e.currentTarget.value === 'sessions' ? '' : e.currentTarget.value })}>
      {METRICS.filter(([key]) => !MONEY.has(key) || key === metric || days.some((date) => map.get(date)?.[key] != null))
        .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );
  const metricErrors = hasMetricPicker && lead.data?.by === lens && lead.data.errors?.length > 0
    ? <p class="nx-note-line warn">{lead.data.errors.map((e) => `${e.site}: ${e.message}`).join(' · ')}</p>
    : null;
  const pickerSlot = (
    <span class="tl-picker-slot">
      {timelinePicker}
      {timelinePicker && <Icon name="updown" size={11} />}
    </span>
  );
  const report = site && BREAKDOWN_REPORTS[lens];
  const metricSetup = site && !site.demo && !site.shared && lens === 'metric'
    ? `#/account?${new URLSearchParams({ i: 'metrics', edit: 'new', site: site.id, timeline: '1' })}`
    : '';
  const reportLink = site && !site.demo && !site.shared && lens === 'bing'
    ? <a class="tl-report-link" href="#/account?i=bing">Bing settings <Icon name="chevron" size={11} /></a>
    : metricSetup ? <a class="tl-report-link" href={metricSetup}>Add a connected metric <Icon name="chevron" size={11} /></a>
    : site && !site.demo && !site.shared && lens === 'goal' ? <a class="tl-report-link" href={`#/site/${site.id}/goals?edit=1`}><Icon name="target" size={11} /> Edit goals</a>
    : report && <a class="tl-report-link" href={`#/site/${site.id}/${report[0]}`}>{report[1]} <Icon name="chevron" size={11} /></a>;
  const controls = (
    <div class="tl-ctl" role="group" aria-label="Timeline controls">
      <div class="tl-toolbar">
        <div class="tl-period">
          <button type="button" class="nx-icon-btn" aria-label="Earlier" disabled={zoom === 'year'} onClick={() => step(-1)}><Icon name="chevron" size={14} class="flip" /></button>
          <Menu name="period" open={menu} setOpen={setMenu} label={<>{periodLabel} <Icon name="updown" size={12} /></>} cls="tl-pbtn">
            <MenuItem on={zoom === 'day' && end === yesterday} onClick={() => go({ z: 'day', end: last === today ? yesterday : '', day: '' })}>Yesterday</MenuItem>
            <MenuItem on={zoom === '7d' && end === last} onClick={() => go({ z: '7d', end: '', day: '' })}>Last 7 days</MenuItem>
            <MenuItem on={zoom === '28d' && end === last} onClick={() => go({ z: '28d', end: '', day: '' })}>Last 28 days</MenuItem>
            <hr />
            {months.map((ym) => <MenuItem key={ym} on={zoom === 'month' && month === ym} onClick={() => go({ z: '', month: ym === last.slice(0, 7) ? '' : ym, day: '' })}>{monthName(ym)}</MenuItem>)}
            <hr />
            <MenuItem on={zoom === 'year'} onClick={() => go({ z: 'year', day: '' })}>Last 12 months</MenuItem>
          </Menu>
          <button type="button" class="nx-icon-btn" aria-label="Later" disabled={offNext} onClick={() => step(1)}><Icon name="chevron" size={14} /></button>
        </div>
        {phone ? (
          <span class="tl-bar">
            <OptionsSheet title="Timeline view" label="View options">
              <section class="nx-opts-sec"><h3 class="nx-label-sm">Colour the days</h3><div class="nx-pop-list">{lensItems}</div></section>
              {zoom !== 'day' && <section class="nx-opts-sec"><h3 class="nx-label-sm">Draw as</h3>{drawAs}</section>}
              <section class="nx-opts-sec"><h3 class="nx-label-sm">Marks on the days</h3><div class="nx-pop-list">{markRows}</div></section>
            </OptionsSheet>
            {addBtn}
          </span>
        ) : (
          <span class="tl-bar">
            <span class="tl-filter-group">
              <Menu name="by" open={menu} setOpen={setMenu} label={<>{byLabel} <Icon name="updown" size={11} /></>} cls="nx-chip tl-breakdown" title="What colours the days">{lensItems}</Menu>
              {pickerSlot}
            </span>
            <Menu name="marks" open={menu} setOpen={setMenu} label={<>{marksLabel} <Icon name="updown" size={11} /></>} cls="nx-chip">{markRows}</Menu>
            {zoom !== 'day' && drawAs}
            {addBtn}
          </span>
        )}
      </div>
      {phone && pickerSlot}
    </div>
  );

  const addForm = adding && (
    <TimelineCreate scope={scope} sites={sites} date={zoom === 'day' ? end : picked || last} today={today} customTypes={customTypes} jobsHref={jobsHref}
      onClose={() => setAdding(false)} onAdded={(event) => {
        setAdding(false);
        if (event?.kind === 'custom') {
          go({ by: 'custom', f: event.eventType.toLowerCase(), z: '', end: '', month: event.date.slice(0, 7), day: event.date });
        }
        events.reload();
      }} onGoalSaved={(target) => {
        setAdding(false);
        if (scope === 'all') location.hash = `/site/${target.id}/timeline?by=goal`;
        else {
          if (lens === 'goal') lead.reload();
          go({ by: 'goal', f: '' });
        }
      }} />
  );

  const loading = !metrics.data || (custom && events.loading && !events.data) || (L && lead.data?.by !== lens && !lead.error);
  const err = metrics.error || events.error || lead.error;

  if (phone && zoom !== 'day') {
    return (
      <div class="nx-page tl-phone">
        {addForm}
        {controls}
        {err ? <ErrorState error={err} onRetry={() => { metrics.reload(); events.reload(); lead.reload?.(); }} />
          : loading ? <Loading height={320} owl label="Reading every day…" />
          : (
            <>
              {metricErrors}
              {reportLink}
              <div class="tl-map card card-plain">
                {asLine ? <LineView days={days} items={items} ctx={ctx} evList={evList} />
                  : zoom === 'year' ? <YearGrid days={days} ctx={ctx} />
                  : zoom === '7d' ? <WeekView days={days} ctx={ctx} />
                  : <MonthGrid days={days} zoom={zoom} ctx={ctx} />}
                <ScaleKey ctx={ctx} asLine={asLine} />
              </div>
            </>
          )}
        {site && <SetupNote site={site} />}
        <DaySheet picked={picked} swipe={swipe}>
          <DayPanel key={phoneDay} site={site} scope={scope} date={phoneDay} ctx={ctx} />
        </DaySheet>
      </div>
    );
  }

  return (
    <Page title="Timeline" sub={`Every day: how it went, where people landed, what shipped${site ? '' : ' · all sites'}`} actions={controls}>
      {site && <SetupNote site={site} />}
      {addForm}
      {err ? <ErrorState error={err} onRetry={() => { metrics.reload(); events.reload(); lead.reload?.(); }} />
        : loading ? <Loading height={420} owl label="Reading every day…" />
        : (
          <>
            {metrics.data.errors?.length > 0 && <p class="nx-note-line warn">{metrics.data.errors.map((e) => `${e.site}: ${e.message}`).join(' · ')}</p>}
            {metricErrors}
            {reportLink}
            <div class={`tl-split${zoom === 'day' ? ' one' : ''}`}>
              <div class="tl-map card card-plain">
                {zoom === 'day' ? <DayPanel site={site} scope={scope} date={end} ctx={ctx} inline />
                  : asLine ? <LineView days={days} items={items} ctx={ctx} evList={evList} />
                  : zoom === 'year' ? <YearGrid days={days} ctx={ctx} />
                  : zoom === '7d' ? <WeekView days={days} ctx={ctx} />
                  : <MonthGrid days={days} zoom={zoom} ctx={ctx} />}
                {zoom !== 'day' && <ScaleKey ctx={ctx} asLine={asLine} />}
              </div>
              {zoom !== 'day' && !phone && (
                <aside class="tl-insp card card-plain" aria-label={picked ? 'Day' : 'Period'}>
                  {picked ? <DayPanel site={site} scope={scope} date={picked} ctx={ctx} onClose={() => go({ day: '' })} />
                    : <WindowPanel days={days} zoom={zoom} label={periodLabel} items={items} ctx={ctx} evList={evList} />}
                </aside>
              )}
            </div>
          </>
        )}
    </Page>
  );
}

// The phone's day sheet, docked above the tab bar like Maps' place card: peek (the
// day's headline), half (its numbers) or full (everything). Drag the grip, or tap it
// to step up; picking a day on the calendar lifts it to half. Swipe sideways for the
// day before or after.
const SNAPS = ['peek', 'half', 'full'];
function DaySheet({ picked, swipe, children }) {
  const [snap, setSnap] = useState('peek');
  const [dragH, setDragH] = useState(null);
  const start = useRef(null);
  const body = useRef(null);
  const sizes = () => {
    const vh = window.innerHeight;
    const top = document.querySelector('.nx-ptop')?.getBoundingClientRect().bottom || 60;
    const bar = document.querySelector('.nx-tabbar')?.offsetHeight || 60;
    const full = Math.max(320, vh - top - bar - 8);
    return { peek: 136, half: Math.min(full, Math.round(vh * 0.52)), full, bar };
  };
  useEffect(() => { if (picked) setSnap((x) => (x === 'peek' ? 'half' : x)); }, [picked]);
  useEffect(() => { if (body.current && snap === 'peek') body.current.scrollTop = 0; }, [snap]);
  const z0 = sizes();
  const h = dragH ?? z0[snap];
  // The page leaves room under the calendar for the sheet, so any day can scroll above it.
  useEffect(() => {
    document.documentElement.style.setProperty('--tl-sheet-h', `${z0[snap]}px`);
    return () => document.documentElement.style.removeProperty('--tl-sheet-h');
  }, [snap]);
  const grip = {
    onPointerDown: (e) => { start.current = { y: e.clientY, h, t: Date.now(), moved: false }; e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerMove: (e) => {
      const st = start.current;
      if (!st) return;
      const dy = e.clientY - st.y;
      if (!st.moved && Math.abs(dy) < 6) return;
      st.moved = true;
      const z = sizes();
      setDragH(Math.max(z.peek - 40, Math.min(z.full, st.h - dy)));
    },
    onPointerUp: (e) => {
      const st = start.current;
      start.current = null;
      if (!st) return;
      if (!st.moved) { setSnap((x) => SNAPS[(SNAPS.indexOf(x) + 1) % SNAPS.length]); return; }
      const z = sizes();
      const now = Math.max(z.peek, Math.min(z.full, st.h - (e.clientY - st.y)));
      const v = (st.y - e.clientY) / Math.max(1, Date.now() - st.t); // px per ms, up is positive
      let next = SNAPS.reduce((a, k) => (Math.abs(z[k] - now) < Math.abs(z[a] - now) ? k : a), 'peek');
      if (Math.abs(v) > 0.5) next = SNAPS[Math.max(0, Math.min(2, SNAPS.indexOf(snap) + (v > 0 ? 1 : -1)))];
      setDragH(null);
      setSnap(next);
    },
  };
  return (
    <section class={`tl-sheet ${snap}${dragH != null ? ' drag' : ''}`} style={`height:${h}px;bottom:${z0.bar}px`} aria-label="The picked day">
      <button type="button" class="tl-sheet-grip" aria-label={snap === 'full' ? 'Lower the day' : 'Raise the day'} {...grip}><span class="nx-grab" aria-hidden="true" /></button>
      <div class="tl-sheet-body" ref={body} {...swipe}>{children}</div>
    </section>
  );
}

function windowDays(zoom, end, month, last) {
  if (zoom === 'month') {
    const out = [];
    for (let d = `${month}-01`; d.startsWith(month); d = addD(d, 1)) out.push(d);
    return out;
  }
  if (zoom === 'year') {
    const from = `${shiftMonth(last.slice(0, 7), -11)}-01`;
    const out = [];
    for (let d = from; d <= last; d = addD(d, 1)) out.push(d);
    return out;
  }
  const n = ZOOMS[zoom];
  return Array.from({ length: n }, (_, i) => addD(end, -(n - 1 - i)));
}

function usePhone() {
  const q = '(max-width: 820px)';
  const [phone, setPhone] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const l = matchMedia(q);
    const on = () => setPhone(l.matches);
    l.addEventListener('change', on);
    return () => l.removeEventListener('change', on);
  }, []);
  return phone;
}

// A button that opens a small menu under it; a click anywhere else closes it.
function Menu({ name, open, setOpen, label, cls, title, children }) {
  const ref = useRef(null);
  const isOpen = open === name;
  useEffect(() => {
    if (!isOpen) return undefined;
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(''); };
    addEventListener('pointerdown', off);
    return () => removeEventListener('pointerdown', off);
  }, [isOpen]);
  return (
    <span class="tl-menu" ref={ref}>
      <button type="button" class={`${cls}${isOpen ? ' on' : ''}`} title={title} aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : name)}>{label}</button>
      {isOpen && <div class="tl-pop nx-pop-list" role="menu">{children}</div>}
    </span>
  );
}
function MenuItem({ on, onClick, children }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={on} class={`nx-pop-row${on ? ' on' : ''}`} onClick={onClick}>
      {children}{on && <span class="nx-pop-meta"><Icon name="check" size={13} /></span>}
    </button>
  );
}

// One tile per number: the window's total, against usual days, and its line. Picks the number.
// A small line that reads out on hover: move anywhere over it and the nearest
// day's number shows above it (nothing shows until you hover).
export function Spark({ vals, dates, color = 'var(--accent)', unit = '', cls = '', format = null }) {
  const [i, setI] = useState(-1);
  const ref = useRef(null);
  const n = vals.length;
  if (n < 2) return null;
  const mx = Math.max(1, ...vals.map((v) => v || 0));
  const y = (v) => 22 - ((v || 0) / mx) * 20;
  const path = vals.map((v, j) => `${j ? 'L' : 'M'}${((j / (n - 1)) * 100).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    setI(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const at = i >= 0 ? i / (n - 1) : 0;
  return (
    <span ref={ref} class={`tl-spark ${cls}`} onMouseMove={move} onMouseLeave={() => setI(-1)}>
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} fill="none" stroke={color} stroke-width="1.5" vector-effect="non-scaling-stroke" />
        {i >= 0 && <line x1={at * 100} x2={at * 100} y1="0" y2="24" stroke="var(--text-3)" stroke-width="1" stroke-dasharray="2 2" vector-effect="non-scaling-stroke" />}
      </svg>
      {i >= 0 && <>
        <i class="tl-sdot" style={`left:${at * 100}%;top:${(y(vals[i]) / 24) * 100}%;background:${color}`} />
        <span class={`tl-tip${at > 0.7 ? ' r' : at < 0.3 ? ' l' : ''}`} style={`left:${at * 100}%`}>
          {fmtD(dates[i], { weekday: 'short', day: 'numeric', month: 'short' })} · {vals[i] == null ? 'no data' : <><b>{format ? format(vals[i]) : Number.isInteger(vals[i]) ? fmt(vals[i]) : vals[i].toLocaleString('en-US', { maximumFractionDigits: 1 })}</b>{unit ? ` ${unit}` : ''}</>}
        </span>
      </>}
    </span>
  );
}

function Cell({ d, ctx }) {
  const n = Number(d.slice(8));
  const row = ctx.map.get(d);
  const future = d > ctx.last;
  if (future) {
    return <div class={`tl-day fut${d === ctx.today ? ' today' : ''}`} role="gridcell" data-state="future"><span class="tl-dn">{n}</span>{d === ctx.today && !ctx.phone && <span class="tl-dv muted">today</span>}</div>;
  }
  // A past day with no row is *no data*, distinct from a future day and from a zero.
  if (!row && !['custom', 'job'].includes(ctx.lens)) {
    return <div class={`tl-day nodata${d === ctx.today ? ' today' : ''}`} role="gridcell" data-state="no-data"><span class="tl-dn">{n}</span><span class="tl-dv muted">—</span></div>;
  }
  const ev = ctx.evOn(d);
  let val = null;
  if (ctx.hasMetricPicker) {
    if (ctx.focused) val = <span class="tl-dv">{metricNumber(ctx.focused.byDate.get(d))}</span>;
  } else if (ctx.focused) {
    const v = ctx.focused.byDate.get(d) || 0;
    val = <span class="tl-dv">{fmt(v)}{!ctx.phone && <small class="muted">{Math.round(ctx.share(ctx.focused, d) * 100)}%</small>}</span>;
  } else if (ctx.L) {
    const j = ctx.jumpOn(d);
    if (j) {
      const what = j.isNew ? 'new' : `↑ ${j.ratio >= 10 ? Math.round(j.ratio) : j.ratio.toFixed(1)}× usual`;
      val = ctx.phone ? <span class="tl-pbar" style={`background:${j.it.color}`} />
        : <span class="tl-jmp" style={`--c:${j.it.color}`} title={`${j.it.key}: ${what}`}><b>{ctx.lens === 'page' ? pageName(j.it.key) : j.it.key}</b><small>{what}</small></span>;
    }
  } else {
    const v = row[ctx.metric];
    const u = ctx.usual(d);
    const c = v != null && u ? v / u - 1 : null;
    val = v == null ? <span class="tl-dv muted">—</span>
      : <span class="tl-dv">{ctx.phone ? ctx.vk(v) : ctx.vf(v)}{!ctx.phone && ctx.lens === 'change' && c !== null && <small class={toneClass(changeTone(c))}>{pct(c)}</small>}</span>;
  }
  return (
    <button type="button" class={`tl-day${ctx.picked === d ? ' sel' : ''}${(!ctx.hasMetricPicker && !ctx.L && !ctx.focused && row[ctx.metric] == null) ? ' nodata' : ''}`} data-state={(!ctx.hasMetricPicker && !ctx.L && !ctx.focused) ? (row[ctx.metric] == null ? 'no-data' : (row[ctx.metric] === 0 ? 'zero' : 'data')) : undefined} style={ctx.fill(d)} aria-label={fmtD(d, { weekday: 'long', day: 'numeric', month: 'long' })}
      onClick={() => ctx.go({ day: ctx.picked === d ? '' : d })}>
      <span class="tl-dtop">
        <span class="tl-dn">{n}</span>
        {ev.length > 0 && (ctx.phone
          ? <span class="tl-dots">{ev.slice(0, 3).map((e, i) => <i key={i} class={e.kind === 'alert' ? 'al' : ''} />)}</span>
          : <span class="tl-dev">{ev.slice(0, 3).map((e, i) => <span key={i} class={e.kind === 'alert' ? 'bad' : ''} title={e.label}><Icon name={KINDS[e.kind][0]} size={12} /></span>)}</span>)}
      </span>
      {val}
    </button>
  );
}

function MonthGrid({ days, ctx }) {
  const lead = (new Date(tOf(days[0])).getUTCDay() + 6) % 7;
  const wd = ctx.phone ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div class="tl-cal" role="grid">
      {wd.map((w, i) => <span key={i} class="tl-wdh">{w}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} class="tl-day blank" />)}
      {days.map((d) => <Cell key={d} d={d} ctx={ctx} />)}
    </div>
  );
}

function WeekView({ days, ctx }) {
  return (
    <div class="tl-week">
      {days.map((d) => {
        const row = ctx.map.get(d);
        const v = ctx.hasMetricPicker ? ctx.focused?.byDate.get(d) ?? null : row?.[ctx.metric] ?? null;
        const u = ctx.usual(d);
        const c = v != null && u ? v / u - 1 : null;
        return (
          <button key={d} type="button" class={`tl-wcol${ctx.picked === d ? ' sel' : ''}`} onClick={() => ctx.go({ day: ctx.picked === d ? '' : d })}>
            <span class="tl-wtop" style={ctx.fill(d)}>
              <span class="muted small">{fmtD(d, { weekday: 'short', day: 'numeric' })}</span>
              <b>{ctx.hasMetricPicker ? metricNumber(v) : ctx.vf(v)}</b>
              {ctx.lens !== 'amount' && !ctx.hasMetricPicker && <small class={toneClass(changeTone(c))}>{pct(c)} vs usual</small>}
            </span>
            <span class="tl-wev">
              {ctx.L && !ctx.hasMetricPicker && (() => { const j = ctx.jumpOn(d); return j ? <span><i style={`background:${j.it.color}`} />{ctx.lens === 'page' ? pageName(j.it.key) : j.it.key}</span> : null; })()}
              {ctx.evOn(d).map((e, i) => <span key={i} class={e.kind === 'alert' ? 'bad' : ''}><Icon name={KINDS[e.kind][0]} size={12} /> {e.label}</span>)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function YearGrid({ days, ctx }) {
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  return (
    <div class="tl-year">
      {months.map((ym) => {
        const ds = days.filter((d) => d.startsWith(ym));
        const lead = (new Date(tOf(`${ym}-01`)).getUTCDay() + 6) % 7;
        return (
          <div key={ym} class="tl-mini">
            <button type="button" class="todo-link" onClick={() => ctx.go({ z: '', month: ym, day: '' })}>{monthName(ym, true)}</button>
            <div class="tl-mg">
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} class="tl-sq b" />)}
              {ds.map((d) => {
                const ev = ctx.evOn(d);
                return <button key={d} type="button" class={`tl-sq${ev.some((e) => e.kind === 'alert') ? ' al' : ev.length ? ' ev' : ''}`} style={ctx.fill(d) || 'background:var(--surface-2)'}
                  title={`${fmtD(d, { weekday: 'short', day: 'numeric', month: 'short' })} · ${ctx.hasMetricPicker ? metricNumber(ctx.focused?.byDate.get(d)) : ctx.vf(ctx.map.get(d)?.[ctx.metric])}${ev.length ? ` · ${ev.map((e) => e.label).join(', ')}` : ''}`}
                  aria-label={d} onClick={() => ctx.go({ z: '', month: ym, day: d })} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The same window as a line: the number and a usual day (or the top items as lines), marks under it.
function LineView({ days, items, ctx, evList }) {
  const [hi, setHi] = useState(-1);
  const all = days.filter((d) => d <= ctx.last);
  const weekly = all.length > 120;
  const groups = weekly ? Array.from({ length: Math.floor(all.length / 7) }, (_, i) => all.slice(all.length - 7 * (i + 1), all.length - 7 * i)).reverse() : all.map((d) => [d]);
  const n = groups.length;
  if (ctx.hasMetricPicker && !ctx.focused) return <p class="nx-empty">{ctx.lens === 'citation' ? 'No AI answer checks recorded in this period.' : ctx.lens === 'custom' ? 'Choose an event type to plot its values.' : ctx.lens === 'page' ? 'Choose a landing page to plot its visits.' : ctx.lens === 'source' ? 'Choose a source to plot its visits.' : ctx.lens === 'query' ? 'Choose a search to plot its clicks.' : 'Choose a metric to plot its values.'}</p>;
  if (n < 2) return <p class="nx-empty">Not enough days in this window yet.</p>;
  const sum = (g, f) => g.reduce((a, d) => a + (f(d) || 0), 0);
  let series;
  if (ctx.L || ctx.lens === 'custom') {
    const top = ctx.hasMetricPicker && ctx.focused ? [ctx.focused] : items.slice(0, 5);
    series = top.map((it) => ({ label: ctx.lens === 'page' ? pageName(it.key) : it.label, color: it.color, vals: groups.map((g) => ctx.hasMetricPicker ? metricAmount(g.map((d) => it.byDate.get(d)), it.summary) : sum(g, (d) => it.byDate.get(d))), faded: Boolean(ctx.focused) && ctx.focused.key !== it.key }));
  } else {
    series = [{ label: METRICS.find(([k]) => k === ctx.metric)[1], color: 'var(--accent)', vals: groups.map((g) => sum(g, (d) => ctx.map.get(d)?.[ctx.metric])), area: true }];
    if (ctx.lens === 'change') {
      series.push({ label: 'A usual day', color: 'var(--text-3)', vals: groups.map((g) => sum(g, (d) => ctx.usual(d))), dashed: true });
    }
  }
  if (ctx.lens === 'citation' && !series.some((s) => s.vals.some(Number.isFinite))) {
    return <p class="nx-empty">No AI answer checks recorded in this period.</p>;
  }
  const mx = niceTop(Math.max(1, ...series.flatMap((s) => s.vals)));
  const W = 600;
  const H = 200;
  const X = (i) => (i / (n - 1)) * W;
  const Y = (v) => H - (v / mx) * H;
  const path = (vals) => vals.map((v, i) => v == null ? '' : `${i && vals[i - 1] != null ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const gi = (d) => groups.findIndex((g) => g.includes(d));
  const marks = evList.map((e) => ({ ...e, i: gi(e.date) })).filter((e) => e.i >= 0);
  const hx = hi >= 0 ? hi / (n - 1) : 0;
  return (
    <div class="tl-line">
      <div class="tl-plot" onMouseLeave={() => setHi(-1)}>
        {[0.5, 1].map((f) => <span key={f} class="tl-ylab" style={`top:${((Y(mx * f) / H) * 100).toFixed(1)}%`}>{kfmt(mx * f)}</span>)}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {[0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={Y(mx * f)} y2={Y(mx * f)} stroke="var(--border)" stroke-width="1" vector-effect="non-scaling-stroke" />)}
          {series.map((s) => (
            <g key={s.label}>
              {s.area && <path d={`${path(s.vals)} L${W},${H} L0,${H} Z`} fill={s.color} opacity=".1" />}
              <path d={path(s.vals)} fill="none" stroke={s.color} stroke-width={s.dashed || s.faded ? 1.5 : 2} stroke-dasharray={s.dashed ? '4 4' : undefined} opacity={s.faded ? 0.25 : 1} vector-effect="non-scaling-stroke" />
              {ctx.lens === 'citation' && s.vals.map((v, i) => v == null ? null : (
                <circle key={i} cx={X(i)} cy={Y(v)} r="2.5" fill={s.color} />
              ))}
            </g>
          ))}
          {hi >= 0 && <line x1={X(hi)} x2={X(hi)} y1="0" y2={H} stroke="var(--text-3)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />}
        </svg>
        {hi >= 0 && series.filter((s) => !s.faded && s.vals[hi] != null).map((s) => <i key={s.label} class="tl-sdot" style={`left:${hx * 100}%;top:${(Y(s.vals[hi]) / H) * 100}%;background:${s.color}`} />)}
        {hi >= 0 && (
          <div class={`tl-ltip${hx > 0.65 ? ' r' : ''}`} style={`left:${hx * 100}%`}>
            <b>{weekly ? `Week of ${fmtD(groups[hi][0], { day: 'numeric', month: 'short' })}` : fmtD(groups[hi][0], { weekday: 'short', day: 'numeric', month: 'short' })}</b>
            {[...series].sort((a, b) => (b.dashed ? -1 : 0) || b.vals[hi] - a.vals[hi]).map((s) => <span key={s.label}><i style={`background:${s.color}`} /><em>{s.label}</em><b>{(ctx.L || ctx.lens === 'custom') ? metricNumber(s.vals[hi]) : ctx.vf(s.vals[hi])}</b></span>)}
          </div>
        )}
        <div class="tl-cols">
          {groups.map((g, i) => (
            <button key={g[0]} type="button" class={ctx.picked && g.includes(ctx.picked) ? 'on' : ''} onMouseEnter={() => setHi(i)}
              aria-label={fmtD(g[0], { day: 'numeric', month: 'short' })} onClick={() => ctx.go(weekly ? { z: '', month: g[0].slice(0, 7), day: g[0] } : { day: g[0] })} />
          ))}
        </div>
      </div>
      <div class="tl-marks">
        {marks.map((e, k) => <span key={k} class={e.kind === 'alert' ? 'bad' : ''} style={`left:${(e.i / (n - 1)) * 100}%`} title={`${fmtD(e.date, { day: 'numeric', month: 'short' })}: ${e.label}`}><Icon name={KINDS[e.kind][0]} size={11} /></span>)}
      </div>
      <div class="tl-xl">{[0, Math.floor((n - 1) / 2), n - 1].map((i) => <span key={i} style={`left:${(i / (n - 1)) * 100}%`}>{fmtD(groups[i][0], { day: 'numeric', month: 'short' })}</span>)}</div>
      {ctx.L && (
        <div class="tl-legend">
          {items.slice(0, 5).map((it) => (
            <button key={it.key} type="button" class={`tl-lg${ctx.focused?.key === it.key ? ' on' : ctx.focused ? ' off' : ''}`} onClick={() => ctx.go({ f: ctx.focused?.key === it.key ? '' : it.key })}>
              <i style={`background:${it.color}`} />{ctx.lens === 'page' ? pageName(it.key) : it.key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const niceTop = (v) => { const p = 10 ** Math.floor(Math.log10(v)); return (Math.ceil((v / p) * 2) / 2) * p; };

function ScaleKey({ ctx, asLine }) {
  if (asLine && ctx.hasMetricPicker && !ctx.focused) return null;
  if (asLine) return <p class="tl-scale">Each point is a day; click one to open it.</p>;
  if (ctx.hasMetricPicker) return <p class="tl-scale">{ctx.focused ? <><b>{ctx.focused.label}</b> per day. Darker days have higher values.</> : ctx.lens === 'citation' ? 'No AI answer checks recorded in this period.' : ctx.lens === 'custom' ? 'Choose an event type to see its daily values.' : ctx.lens === 'page' ? 'Choose a landing page to see its daily visits.' : ctx.lens === 'source' ? 'Choose a source to see its daily visits.' : ctx.lens === 'query' ? 'Choose a search to see its daily clicks.' : 'Choose a goal or metric to see its daily values.'}</p>;
  if (ctx.focused) return <p class="tl-scale"><b>{ctx.focused.key}</b>: its {ctx.L.unit || (ctx.L.of === 'clicks' ? 'clicks' : 'visits')} each day; darker is a bigger share. <button type="button" class="todo-link" onClick={() => ctx.go({ f: '' })}>Stop</button></p>;
  if (ctx.L) return <p class="tl-scale">A day is named when something starts: a new {ctx.L.one}, or one rising to 2× its usual share.</p>;
  if (ctx.lens === 'amount' || MONEY.has(ctx.metric)) return <p class="tl-scale">{MONEY.has(ctx.metric) ? 'Less' : 'Fewer'} {amountLegendStops().map((p) => <i key={p} style={mix(HEAT.AMOUNT_COLOR, p)} />)} More</p>;
  const [strong, weak] = changeLegendStops();
  return (
    <p class="tl-scale">Below a usual day
      <i style={mix(HEAT.DOWN_COLOR, strong)} /><i style={mix(HEAT.DOWN_COLOR, weak)} /><i style={`background:${HEAT.SURFACE}`} />
      <i style={mix(HEAT.UP_COLOR, weak)} /><i style={mix(HEAT.UP_COLOR, strong)} /> Above
    </p>
  );
}

// The whole period: what's moving (with a lens), else the best and worst days; then what happened.
function WindowPanel({ days, zoom, label, items, ctx, evList }) {
  const ds = days.filter((d) => d <= ctx.last && ctx.map.get(d)?.[ctx.metric] != null);
  const ml = METRICS.find(([k]) => k === ctx.metric)[1];
  const totals = ctx.lens === 'amount';
  const rows = ds.map((d) => {
    const v = ctx.map.get(d)[ctx.metric];
    const baseline = totals ? null : ctx.usual(d);
    return { d, v, c: baseline ? v / baseline - 1 : null };
  });
  const best = totals
    ? rows.sort((a, b) => b.v - a.v).slice(0, 3)
    : rows.filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 3);
  const worst = rows.filter((x) => x.c < 0).sort((a, b) => a.c - b.c).slice(0, 3);
  const dayRow = (x) => (
    <button key={x.d} type="button" class={`tl-brow${totals ? ' tl-brow-total' : ''}`} onClick={() => ctx.go({ day: x.d })}>
      <span>{fmtD(x.d, { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>{ctx.vf(x.v)}</b>{!totals && <span class={toneClass(changeTone(x.c))}>{pct(x.c)}</span>}
    </button>
  );
  const effect = (date) => {
    const after = [1, 2, 3].map((i) => addD(date, i));
    if (after[2] > ctx.last) return null;
    const s = (list) => list.reduce((a, d) => a + (ctx.map.get(d)?.sessions || 0), 0);
    const before = s([1, 2, 3].map((i) => addD(date, -i)));
    return before ? s(after) / before - 1 : null;
  };
  const latest = [...evList].sort((a, b) => b.date.localeCompare(a.date));
  const changes = latest.filter((event) => event.kind === 'alert').slice(0, 5);
  const shipped = latest.filter((event) => event.kind !== 'alert').slice(0, 8);
  return (
    <div class="tl-in">
      <div class="tl-in-h"><b>{zoom === 'month' && label === monthName(ctx.last.slice(0, 7)) ? `${label}, so far` : label}</b><span class="muted small">{ctx.phone ? 'Tap a day for detail' : 'Pick a day for detail'}</span></div>
      <div class="tl-sec">
        <h3 class="nx-label-sm">Key changes</h3>
        {changes.length ? changes.map((event, i) => (
          <button key={i} type="button" class="tl-erow tl-change-row" onClick={() => ctx.go({ day: event.date })}>
            <span class="muted">{fmtD(event.date, { day: 'numeric', month: 'short' })}</span>
            <Icon name="bell" size={13} />
            <span><b>{event.label}</b>{event.detail && <small class="muted">{event.detail}</small>}</span>
          </button>
        )) : <p class="muted small m-0">No key changes shown for this period.</p>}
      </div>
      {ctx.hasMetricPicker ? null : ctx.L ? (
        <div class="tl-sec">
          <h3 class="nx-label-sm">What’s moving · {ctx.L.name.toLowerCase()}</h3>
          {items.length ? [...items].sort((a, b) => (b.prev ? b.total / b.prev : 99) - (a.prev ? a.total / a.prev : 99)).slice(0, 8).map((it) => {
            const c = it.prev ? it.total / it.prev - 1 : null;
            const t = changeTone(c);
            const tag = it.fresh ? `New ${fmtD(it.fresh, { day: 'numeric', month: 'short' })}` : c === null ? '' : (t === 'up' || t === 'up2') ? 'Rising' : (t === 'down' || t === 'down2') ? 'Falling' : 'Steady';
            const tone = it.fresh || t === 'up' || t === 'up2' ? 'good' : (t === 'down' || t === 'down2') ? 'bad' : 'muted';
            return (
              <button key={it.key} type="button" class={`tl-mrow${ctx.focused?.key === it.key ? ' on' : ''}`} title={ctx.focused?.key === it.key ? 'Showing on the calendar; click again to stop' : 'Show it on the calendar'}
                onClick={() => ctx.go({ f: ctx.focused?.key === it.key ? '' : it.key })}>
                <span class="tl-mn"><i style={`background:${it.color}`} /><span>{ctx.lens === 'page' ? pageName(it.key) : it.key}</span></span>
                <Spark vals={it.series} dates={days.filter((d) => d <= ctx.last)} color={it.color} cls="sm" />
                <b>{kfmt(it.total)}</b><span class={tone}>{tag || pct(c)}</span>
              </button>
            );
          }) : <p class="muted small m-0">Nothing recorded for this window.</p>}
          <p class="muted small m-0">Click one to see it on every day.</p>
        </div>
      ) : (
        <>
          {best.length > 0 && <div class="tl-sec"><h3 class="nx-label-sm">{totals ? 'Highest daily totals' : 'Best days'} · {ml}</h3>{best.map(dayRow)}</div>}
          {worst.length > 0 && <div class="tl-sec"><h3 class="nx-label-sm">Worst days</h3>{worst.map(dayRow)}</div>}
        </>
      )}
      <div class="tl-sec">
        <h3 class="nx-label-sm">Activity</h3>
        {shipped.length ? shipped.map((e, i) => {
          const c = totals || e.kind === 'alert' || e.kind === 'mention' ? undefined : effect(e.date);
          return (
            <button key={i} type="button" class="tl-erow" onClick={() => ctx.go({ day: e.date })}>
              <span class="muted">{fmtD(e.date, { day: 'numeric', month: 'short' })}</span>
              <span class={e.kind === 'alert' ? 'bad' : ''}><Icon name={KINDS[e.kind][0]} size={13} /></span>
              <span class="tl-et">{e.label}</span>
              <span>{c === undefined ? '' : c === null ? <span class="muted" title="The 3 days after it aren’t in yet">too early</span> : <span class={toneClass(changeTone(c))} title="Visits, the 3 days after against the 3 before">{pct(c)}</span>}</span>
            </button>
          );
        }) : <p class="muted small m-0">Nothing marked in this window. Add a post or note with +.</p>}
      </div>
    </div>
  );
}

// One day: what happened in a sentence, its numbers against a usual (or last) same weekday,
// where visits came from and landed, and what was marked that day.
export function DayPanel({ site, scope, date, ctx, onClose, inline }) {
  const d = useAsync(() => api.get(`/calendar/day${qs({ site: scope, date })}`), [scope, date]);
  const [cmp, setCmp] = usePersistent('tl-cmp', 'usual');
  const [tab, setTab] = useState(['page', 'source', 'query'].includes(ctx.lens) ? ctx.lens : 'page');
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [hh, setHh] = useState(-1);
  const wd = fmtD(date, { weekday: 'long' });
  const prev = addD(date, -1);
  const next = addD(date, 1);
  const baseOf = (k) => (cmp === 'week' ? ctx.map.get(addD(date, -7))?.[k] ?? null : ctx.usual(date, k));
  const byValue = (list) => [...list].sort((a, b) => b.value - a.value);
  const lists = d.data ? {
    page: byValue(merge(d.data.sites, 'pages')), source: byValue(merge(d.data.sites, 'sources')), country: byValue(merge(d.data.sites, 'countries')),
    query: d.data.sites.flatMap((s) => s.search?.queries || []).map((q) => ({ label: q.query, value: q.clicks })),
  } : null;
  const listTotal = lists?.[tab]?.reduce((a, x) => a + x.value, 0) || 0;
  // Visits per hour, summed over the sites in scope.
  const hourly = d.data?.sites.filter((s) => s.hours).map((s) => s.hours);
  const hours = hourly?.length ? Array.from({ length: 24 }, (_, h) => hourly.reduce((a, hs) => a + (hs[h] || 0), 0)) : null;
  const hmax = hours ? Math.max(1, ...hours) : 1;
  const peak = hours ? hours.indexOf(Math.max(...hours)) : -1;
  // Visits in the 3 days after a mark, against the 3 before.
  const effect = () => {
    if (addD(date, 3) > ctx.last) return null;
    const s = (ds) => ds.reduce((a, x) => a + (ctx.map.get(x)?.sessions || 0), 0);
    const before = s([1, 2, 3].map((i) => addD(date, -i)));
    return before ? s([1, 2, 3].map((i) => addD(date, i))) / before - 1 : undefined;
  };
  const row = ctx.map.get(date);
  const changes = (d.data?.alerts || []).map((alert) => ({ id: alert.id, ...timelineChange(alert) }));
  const marks = (d.data?.events || []).map((event) => ({ kind: kindOf(event.kind), label: event.label, url: event.url, detail: event.kind === 'custom' ? event.body : '' }));
  const ef = marks.some((m) => m.kind !== 'alert' && m.kind !== 'mention') ? effect() : undefined;
  return (
    <div class="tl-in">
      <div class="tl-in-h">
        <span class="tl-dnav">
          <button type="button" class="nx-icon-btn" aria-label="Day before" onClick={() => ctx.go({ day: prev, ...(inline && !onClose ? { end: prev } : {}) })}><Icon name="chevron" size={14} class="flip" /></button>
          <b>{fmtD(date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
          <button type="button" class="nx-icon-btn" aria-label="Day after" disabled={next > ctx.last} onClick={() => ctx.go({ day: next, ...(inline && !onClose ? { end: next } : {}) })}><Icon name="chevron" size={14} /></button>
        </span>
        {onClose && <button type="button" class="nx-icon-btn" aria-label="Back to the whole period" title="Back to the whole period" onClick={onClose}><Icon name="x" size={14} /></button>}
      </div>
      {ctx.hasMetricPicker && ctx.items?.length > 0 && (!['page', 'source', 'query'].includes(ctx.lens) || ctx.focused) && (
        <div class="tl-sec">
          <h3 class="nx-label-sm">{ctx.lens === 'bing' ? 'Bing search' : ctx.lens === 'job' ? 'Job results' : ctx.lens === 'metric' ? 'Connected metrics' : ctx.lens === 'custom' ? 'Custom event totals' : ctx.lens === 'page' ? 'Landing page visits' : ctx.lens === 'source' ? 'Visits from this source' : ctx.lens === 'query' ? 'Search clicks' : ctx.lens === 'citation' ? 'Citation sources' : 'Goals and product metrics'}</h3>
          {(ctx.focused ? [ctx.focused] : ctx.items).map((item) => (
            <div key={item.key} class="tl-num"><span>{item.label}</span><b>{metricNumber(item.byDate.get(date))}</b><span class="muted">{item.unit}</span></div>
          ))}
        </div>
      )}
      {d.error ? <ErrorState error={d.error} onRetry={d.reload} /> : !d.data ? <Loading height={200} /> : (
        <>
          {changes.length > 0 && (
            <div class="tl-sec tl-day-section">
              <h3 class="nx-label-sm">Key changes</h3>
              {changes.map((event) => (
                <div key={event.id} class="tl-day-change">
                  <Icon name="bell" size={14} />
                  <span><b>{event.label}</b>{event.detail && <small class="muted">{event.detail}</small>}</span>
                </div>
              ))}
            </div>
          )}
          <div class="tl-sec tl-day-section">
            <div class="tl-cmprow">
              <h3 class="nx-label-sm">Daily activity</h3>
              <span class="tl-seg small" role="group" aria-label="Compare with">
                <button type="button" class={cmp === 'usual' ? 'on' : ''} aria-pressed={cmp === 'usual'} onClick={() => setCmp('usual')}>Usual {wd}</button>
                <button type="button" class={cmp === 'week' ? 'on' : ''} aria-pressed={cmp === 'week'} onClick={() => setCmp('week')}>Last {wd}</button>
              </span>
            </div>
            <table class="tl-comparison" aria-label="Daily activity comparison">
              <thead><tr><th scope="col">Metric</th><th scope="col">This day</th><th scope="col">{cmp === 'week' ? 'Last week' : 'Typical'}</th><th scope="col">Difference</th></tr></thead>
              <tbody>
              {METRICS.map(([k, l]) => {
                const v = row?.[k] ?? null;
                if (v === null) return null;
                const b = baseOf(k);
                if (MONEY.has(k) && !v && !b) return null; // no ad spend that day or usually: nothing to say
                const difference = b == null ? null : MONEY.has(k) ? v - b : Math.round(v) - Math.round(b);
                const vf = ctx.vf || ((x, key) => (MONEY.has(key) && x != null ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : fmt(x)));
                const magnitude = MONEY.has(k) ? Math.round(Math.abs(difference) * 100) / 100 : Math.round(Math.abs(difference));
                const change = difference == null ? '—' : magnitude === 0 ? 'Same' : `${difference > 0 ? '+' : '−'}${vf(magnitude, k)}`;
                return (
                  <tr key={k}>
                    <th scope="row">{l}</th><td><b>{vf(v, k)}</b></td><td class="muted">{vf(b, k)}</td>
                    <td class={difference == null || magnitude === 0 ? 'muted' : difference > 0 ? 'good' : 'bad'}>{change}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
          <DayGoalsAndRetention site={site} scope={scope} date={date} countries={lists?.country} phone={ctx.phone}>
            {hours && (
              <div class="tl-sec tl-day-section">
                <h3 class="nx-label-sm">Visits by hour{peak >= 0 && hours[peak] ? <span class="tl-peak"> · Peak at {String(peak).padStart(2, '0')}:00</span> : null}</h3>
                <div class="tl-hours" role="img" aria-label={`Visits by hour: ${hours.map((v, h) => `${h}:00 ${v}`).join(', ')}`}>
                  {hours.map((v, h) => <span key={h} class="tl-hb" onMouseEnter={() => setHh(h)} onMouseLeave={() => setHh(-1)}><i style={`height:${Math.max(v ? 4 : 1, Math.round((v / hmax) * 40))}px`} class={h === peak || h === hh ? 'pk' : ''} /></span>)}
                  {hh >= 0 && <span class={`tl-tip${hh > 16 ? ' r' : hh < 7 ? ' l' : ''}`} style={`left:${((hh + 0.5) / 24) * 100}%;top:-6px`}>{String(hh).padStart(2, '0')}:00 · <b>{fmt(hours[hh])}</b> visit{hours[hh] === 1 ? '' : 's'}</span>}
                  <span class="tl-hl"><span>00</span><span>06</span><span>12</span><span>18</span><span /></span>
                </div>
              </div>
            )}
            <div class="tl-sec tl-day-section">
              <h3 class="nx-label-sm">Traffic breakdown</h3>
              <div class="tl-dtabs" role="tablist" aria-label="Traffic breakdown">
                {[['page', 'Pages'], ['source', 'Sources'], ['query', 'Searches'], ...(scope !== 'all' ? [['trend', 'Trends']] : []), ['country', 'Countries']].map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
                ))}
              </div>
              {tab === 'trend' ? <DayTrends scope={scope} date={date} wd={wd} /> : lists[tab].length ? <>
                <div class="tl-srow tl-breakdown-head" aria-hidden="true">
                  <span>{{ page: 'Landing page', source: 'Source', query: 'Search query', country: 'Country' }[tab]}</span>
                  <span>{tab === 'query' ? 'Clicks' : 'Visits'}</span>
                  <span>{lists[tab].some((item) => item.expected != null) ? 'Vs. typical' : ''}</span>
                </div>
                {lists[tab].slice(0, 6).map((x) => {
                const gain = x.expected == null ? null : x.value - x.expected;
                const flat = gain !== null && Math.abs(gain) < Math.max(3, x.expected * 0.15);
                const fresh = gain !== null && !x.expected && x.value > 0;
                return (
                  <div key={x.label} class="tl-srow">
                    <span class="tl-sl">{tab === 'page' && scope !== 'all' && x.label.startsWith('/') ? <a href={pushPanel({ kind: 'page', key: x.label })}>{pageName(x.label)}</a> : <span>{tab === 'page' ? pageName(x.label) : x.label}</span>}<i style={`width:${listTotal ? Math.max(2, Math.round((x.value / listTotal) * 100)) : 0}%`} /></span>
                    <b>{fmt(x.value)}</b>
                    <span class={gain === null ? 'muted' : fresh ? 'good' : flat ? 'muted' : gain > 0 ? 'good' : 'bad'}>{gain === null ? '' : fresh ? 'new' : flat ? 'as usual' : `${gain > 0 ? '+' : '−'}${fmt(Math.abs(gain))}`}</span>
                  </div>
                );
              })}</> : <p class="muted small m-0">{tab === 'query' ? 'Search Console hasn’t reported this day yet, or nothing came from search.' : 'Nothing recorded.'}</p>}
            </div>
          </DayGoalsAndRetention>
          <div class="tl-sec">
            <h3 class="nx-label-sm">What happened</h3>
            {marks.map((e, i) => (
              <div key={i} class="tl-erow static">
                <span class={e.kind === 'alert' ? 'bad' : ''}><Icon name={KINDS[e.kind][0]} size={14} /></span>
                <span class="tl-et">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a> : e.label}{e.detail && <small class="muted tl-event-detail">{e.detail}</small>}</span>
              </div>
            ))}
            {ef !== undefined && (
              <p class="tl-effect">{ef === null ? <span class="muted">Too early to judge: the 3 days after aren’t in yet.</span>
                : <>Visits <b class={toneClass(changeTone(ef))}>{pct(ef)}</b> in the 3 days after, against the 3 before.</>}</p>
            )}
            {!marks.length && !adding && (() => {
              // Nothing marked: on an unusual day, ask what caused it; on a quiet one, say what shows here.
              const ch = d.data.change;
              const odd = ch != null && Math.abs(ch) >= 0.3 && Math.max(d.data.sessions || 0, d.data.baseline || 0) >= 10;
              return (
                <div class={`tl-empty${odd ? ' odd' : ''}`}>
                  <p class="m-0">
                    <b>{odd ? `${ch > 0 ? 'Up' : 'Down'} ${pct(ch).replace(/^[+−]/, '')} on a usual ${wd}, and nothing is marked.` : 'Nothing marked on this day.'}</b>{' '}
                    <span class="muted">{odd ? 'If you shipped, posted or changed something, add it: Kauzl then tracks what it did.' : 'Releases, deploys, posts and your notes show here.'}</span>
                  </p>
                  <span class="tl-chips">
                    <button type="button" class={`btn${odd ? ' primary' : ''}`} onClick={() => { setAdding(true); setAsking(false); }}><Icon name="plus" size={12} /> Add what happened</button>
                    <button type="button" class={`btn ghost${asking ? ' on' : ''}`} aria-pressed={asking} onClick={() => setAsking(!asking)}><Icon name="sparkles" size={12} /> {odd ? 'Ask Claude why' : 'Ask about this day'}</button>
                  </span>
                </div>
              );
            })()}
            <ClaudeComments key={`${scope}:${date}`} siteId={scope} date={date} onChange={d.reload} bare asking={asking} />
            {adding && <TimelineAdd site={scope} sites={[]} date={date} today={ctx.today} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); d.reload(); }} />}
            {!adding && marks.length > 0 && (
              <span class="tl-chips">
                <button type="button" class="nx-chip" onClick={() => { setAdding(true); setAsking(false); }}><Icon name="plus" size={12} /> Add a note</button>
                <button type="button" class={`nx-chip${asking ? ' on' : ''}`} aria-pressed={asking} onClick={() => setAsking(!asking)}><Icon name="sparkles" size={12} /> Ask about this day</button>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const REGION_OF = (p) => REGION[p.country] || '';

// Goals and new-vs-returning visits for one day, from the site's BigQuery export.
// Sites without the export (or a day it hasn't reached) get one quiet line, not a card.
const WAREHOUSE_LINKS = { 'needs-warehouse': '#/settings?tab=sites', auth: '#/settings?i=google' };

function DayGoalsAndRetention({ site, scope, date, countries, phone, children }) {
  const single = scope !== 'all';
  const [place, setPlace] = useState('');
  useEffect(() => setPlace(''), [scope, date]);
  const config = useAsync(() => (single ? api.get(`/sites/${scope}/config`) : null), [scope]);
  const product = useSiteProduct(site || { id: '', demo: true });
  const goals = config.data?.config?.goals?.length ? config.data.config.goals : product.data?.goals || [];
  const trackedGoals = goals.filter((g) => (g.source === 'event' || g.source === 'page') && g.match)
    .map((g) => ({ ...g, key: `${g.source}:${g.match}` }));
  const keys = [...new Set(trackedGoals.map((g) => g.key))];
  const ready = !config.loading && !product.loading;
  const activity = useAsync(
    () => (single && ready ? api.get(`/sites/${scope}/warehouse/day-summary${qs({ date, goals: keys.join(',') })}`) : null),
    [scope, date, ready, keys.join(',')],
  );
  const summary = activity.data?.summary;
  const visits = useAsync(
    () => (single && summary?.sessions ? api.get(`/sites/${scope}/warehouse/day-sessions${qs({ date })}`) : null),
    [scope, date, Boolean(summary?.sessions)],
  );
  // The map: every site from GA4's countries; with BigQuery, from each visit.
  const people = visits.data?.people || null;
  const places = dayPlaces(people, countries);
  const pickedName = place && places.find((p) => (p.code || p.country) === place)?.country;
  const mapSec = places.length > 0 && (
    <div class="tl-sec">
      <div class="lv-night tl-daymap">
        <div class="tl-daymap-head">
          <span><b>Where they were</b> · {places.length} {places.length === 1 ? 'country' : 'countries'}</span>
          {pickedName ? <button type="button" class="link-btn" onClick={() => setPlace('')}>{pickedName} · show all</button>
            : <small>{people ? 'Click an owl for its visitors' : 'Visits by country'}</small>}
        </div>
        <DayMap places={places} detailed={Boolean(people)} picked={place} onPick={people ? setPlace : undefined} phone={phone} />
        {people && <p class="lv-legend m-0">Colour: where most came from · eyes open: most stayed · green dot: a goal reached</p>}
      </div>
    </div>
  );
  if (!single) return <>{children}{mapSec}</>;
  const counts = new Map((summary?.goals || []).map((g) => [g.key, g]));
  const err = config.error || product.error || activity.error;
  const quiet = (text, link) => (
    <><div class="tl-sec tl-day-section">
      <h3 class="nx-label-sm">Goals · returning visits</h3>
      <p class="muted small m-0">{text}{link}</p>
    </div>{children}{mapSec}</>
  );

  if (err?.kind === 'needs-warehouse') {
    return quiet('Daily goals and returning visits come from the GA4 BigQuery export. ', <a href={WAREHOUSE_LINKS[err.kind]}>Connect it →</a>);
  }
  if (err?.kind === 'no-data') return quiet(err.message, null);
  if (err?.kind === 'auth') return quiet(`${err.message} `, <a href={WAREHOUSE_LINKS.auth}>Sign in →</a>);
  if (err) {
    return (
      <><div class="tl-sec tl-day-section">
        <h3 class="nx-label-sm">Goals · returning visits</h3>
        <ErrorState error={err} onRetry={() => { config.reload(); product.reload(); activity.reload(); }} />
      </div>{children}{mapSec}</>
    );
  }
  if (!ready || activity.loading || !summary) {
    return <><div class="tl-sec tl-day-section"><h3 class="nx-label-sm">Goals and returning visits</h3><Loading height={54} /></div>{children}{mapSec}</>;
  }
  if (!summary.sessions) return quiet('The BigQuery export has no visits for this day yet — it usually lands a day later.', null);

  const otherGoals = goals.some((g) => g.source !== 'event' && g.source !== 'page');
  const shownPeople = people && place ? people.filter((p) => (REGION_OF(p) || p.country) === place) : people;
  return (
    <>
      <div class="tl-sec tl-day-section">
        <h3 class="nx-label-sm">Goals</h3>
        {!goals.length ? <p class="muted small m-0">No goals are set up. <a href={`#/site/${scope}/goals?edit=1`}>Set up goals →</a></p>
          : (
            <>
              {trackedGoals.map((goal) => {
                const result = counts.get(goal.key);
                return (
                  <div key={goal.key} class="tl-srow">
                    <span class="tl-sl"><span>{goal.label || goal.match}</span></span>
                    <b>{fmt(result?.completions || 0)}</b>
                    <span class="muted">{fmt(result?.people || 0)} people</span>
                  </div>
                );
              })}
              {otherGoals && (
                <p class="muted small m-0">{trackedGoals.length ? 'Store and GitHub goals aren’t counted per day here. ' : 'This site’s goals are store or GitHub goals, which aren’t counted per day here. '}
                  <a href={`#/site/${scope}/timeline?by=goal`}>See them on the Timeline →</a></p>
              )}
            </>
          )}
      </div>
      <div class="tl-sec tl-day-section">
        <h3 class="nx-label-sm">Returning visits</h3>
        <div class="tl-nums">
          <div class="tl-num"><span>New</span><b>{fmt(Math.max(0, summary.sessions - summary.returning))}</b></div>
          <div class="tl-num"><span>Returning</span><b>{fmt(summary.returning)}</b></div>
          <div class="tl-num"><span>Share returning</span><b>{Math.round((summary.returning / summary.sessions) * 100)}%</b></div>
        </div>
        <p class="muted small m-0">Returning: their first visit was before this day. <a href={`#/site/${scope}/journeys?tab=retention`}>Weekly cohorts →</a></p>
      </div>
      {children}
      {mapSec}
      <div class="tl-sec">
        {visits.error ? <><h3 class="nx-label-sm">Who came</h3><p class="muted small m-0">{visits.error.message}</p></>
          : !visits.data ? <><h3 class="nx-label-sm">Who came</h3><Loading height={120} /></>
            : <People key={place} day narrow={phone} people={shownPeople} head={<h3 class="nx-label-sm">Who came · {pickedName ? `${fmt(shownPeople.length)} from ${pickedName}` : `${fmt(people.length)}${people.length < summary.sessions ? ` of ${fmt(summary.sessions)}` : ''}`}, newest first</h3>} />}
      </div>
    </>
  );
}

// A day's pages or sources across the sites in scope, biggest first.
function merge(sites, key) {
  const out = new Map();
  for (const s of sites || []) {
    for (const x of s[key] || []) {
      const cur = out.get(x.label) || { label: x.label, value: 0 };
      cur.value += x.value;
      if (x.expected != null) cur.expected = (cur.expected ?? 0) + x.expected;
      out.set(x.label, cur);
    }
  }
  return [...out.values()].sort((a, b) => b.value - a.value);
}

// A day's search trends (server/day-trends.mjs): up or down because people searched more
// or less, you ranked differently, or fewer clicked, each search against the same weekday.
const WHY_LABEL = { demand: ['Searched more', 'Searched less'], rank: ['Ranked higher', 'Ranked lower'], ctr: ['Clicked more', 'Clicked less'], new: ['New search', 'New search'], gone: ['Not searched', 'Not searched'] };
function DayTrends({ scope, date, wd }) {
  const t = useAsync(() => api.get(`/sites/${scope}/day-trends${qs({ date })}`), [scope, date]);
  if (t.error) return <p class="muted small m-0">{t.error.message}</p>;
  if (!t.data) return <Loading height={120} />;
  const x = t.data;
  if (x.pending || !x.queries?.length) return <p class="muted small m-0">{x.verdict}</p>;
  const pctOf = (a, b) => (b ? Math.round((a / b - 1) * 100) : null);
  const ip = pctOf(x.total.impressions, x.total.usualImpressions), cp = pctOf(x.total.clicks, x.total.usualClicks);
  const top = x.queries[0]?.query;
  return (
    <div class="tl-trend">
      <p class="m-0"><b>{x.verdict}</b></p>
      <div class="tl-tcells">
        <div><small>People searching</small><b class={ip == null ? '' : ip >= 10 ? 'good' : ip <= -10 ? 'bad' : ''}>{ip == null ? '—' : `${ip > 0 ? '+' : ip < 0 ? '−' : ''}${Math.abs(ip)}%`}</b><span>{fmt(x.total.impressions)} impressions, usually {fmt(x.total.usualImpressions)}</span></div>
        <div><small>Search clicks</small><b class={cp == null ? '' : cp >= 10 ? 'good' : cp <= -10 ? 'bad' : ''}>{cp == null ? '—' : `${cp > 0 ? '+' : cp < 0 ? '−' : ''}${Math.abs(cp)}%`}</b><span>{fmt(x.total.clicks)}, usually {fmt(x.total.usualClicks)}</span></div>
      </div>
      <ul class="tl-tq">
        {x.queries.map((q) => {
          const up = q.why === 'rank' ? (q.day.position ?? 99) < (q.usual.position ?? 99) : q.why === 'demand' ? q.imprGap > 0 : q.clickGap > 0;
          return (
            <li key={q.query}>
              <span class="tl-tqn">“{q.query}”<small>{fmt(q.day.impressions)} searches, usually {fmt(q.usual.impressions)}{q.day.position != null ? ` · #${q.day.position.toFixed(1)}` : ''}{q.usual.position != null && q.why === 'rank' ? ` (was #${q.usual.position.toFixed(1)})` : ''}</small></span>
              <span class={`nx-pill ${q.why === 'new' || (up && q.why !== 'gone') ? 'up' : q.why === 'gone' || !up ? 'down' : ''}`}>{WHY_LABEL[q.why][up ? 0 : 1]}</span>
            </li>
          );
        })}
      </ul>
      <p class="muted small m-0">Against the same {wd} in the {x.weeks} weeks before, from Search Console.{top ? <> <a href={`https://trends.google.com/trends/explore?date=today%203-m&q=${encodeURIComponent(top)}`} target="_blank" rel="noopener noreferrer">“{top}” on Google Trends ↗</a></> : ''}</p>
    </div>
  );
}
