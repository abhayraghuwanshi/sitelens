import { useEffect, useRef, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { moneyFormat } from './AdMoney.jsx';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { ClaudeComments } from '../components/ClaudeComments.jsx';
import { TimelineAdd } from '../pages/Calendar.jsx';
import { Page } from './Page.jsx';
import { Ask, Waiting, SetupNote } from './TimelineTop.jsx';
import { pushPanel } from './Panel.jsx';
import { Drawer } from './Drawer.jsx';

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
const LENSES = { page: { name: 'Landing pages', one: 'page', of: 'sessions' }, source: { name: 'Sources', one: 'source', of: 'sessions' }, query: { name: 'Searches', one: 'search', of: 'clicks' } };
const ZOOMS = { day: 1, '7d': 7, '28d': 28 };
// Marks: what you did and what happened, by kind.
const KINDS = { deploy: ['rocket', 'Deploys'], release: ['github', 'Releases'], post: ['megaphone', 'Posts'], ad: ['target', 'Ads'], mention: ['chat', 'Mentions'], note: ['star', 'Notes'], alert: ['bell', 'Alerts'] };
const kindOf = (k) => (k === 'deploy' ? 'deploy' : k === 'release' || k === 'extension' ? 'release' : k === 'post' ? 'post' : k === 'ad' ? 'ad' : k === 'mention' ? 'mention' : 'note');
const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-7)', 'var(--series-4)', 'var(--series-5)', 'var(--series-3)', 'var(--series-8)', 'var(--series-6)'];
const pageName = (p) => (p === '/' ? 'Home page' : p);

// A usual day: the same weekday over the four weeks before (the median, like the
// server's own baseline, which visits use directly so every sentence agrees).
export function usualOf(map, date, k) {
  if (k === 'sessions' && map.get(date)?.baseline != null) return map.get(date).baseline;
  const vals = [7, 14, 21, 28].map((n) => map.get(addD(date, -n))?.[k]).filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

export function Timeline({ site, sites, params, waiting = null }) {
  const scope = site ? site.id : 'all';
  const last = iso(Date.now() - DAY); // whole days only: yesterday is the latest
  const zoom = ['day', '7d', '28d', 'month', 'year'].includes(params.get('z')) ? params.get('z') : 'month';
  const end = params.get('end') && params.get('end') <= last ? params.get('end') : last;
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : last.slice(0, 7);
  const metric = METRICS.some(([k]) => k === params.get('m')) ? params.get('m') : 'sessions';
  const lens = ['change', 'amount', ...Object.keys(LENSES)].includes(params.get('by')) ? params.get('by') : 'change';
  const focus = params.get('f') || '';
  const asLine = params.get('v') === 'line' && zoom !== 'day';
  const picked = params.get('day') || '';
  const [marks, setMarks] = usePersistent('tl-marks', Object.keys(KINDS).join(','));
  // Saved before "Ads" existed: show it until it's turned off ("-ad" remembers that).
  const layers = [...marks.split(',').filter((k) => k && k !== '-ad'), ...(marks.includes('ad') ? [] : ['ad'])];
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
  const metrics = useAsync(() => api.get(`/calendar/metrics${qs({ site: scope, from: addD(first, -back), to: lastData })}`), [scope, first, lastData]);
  const events = useAsync(() => api.get(`/calendar/events${qs({ site: scope, from: first, to: lastData })}`), [scope, first, lastData]);
  const L = LENSES[lens];
  const lead = useAsync(() => (L ? api.get(`/calendar/breakdown${qs({ site: scope, from: addD(first, -back), to: lastData, by: lens, limit: 12, daily: 1 })}`) : null), [scope, first, lastData, lens]);

  const map = new Map((metrics.data?.days || []).map((d) => [d.date, d]));
  const usual = (d, k = metric) => usualOf(map, d, k);
  const evList = [
    ...(events.data?.events || []).map((e) => ({ date: e.date, kind: kindOf(e.kind), label: e.label, url: e.url })),
    ...(events.data?.alerts || []).map((a) => ({ date: a.date, kind: 'alert', label: a.title })),
  ].filter((e) => layers.includes(e.kind));
  const evOn = (d) => evList.filter((e) => e.date === d);

  // Each lens item's value per day, over the window and the days before it.
  const items = (lead.data?.rows || []).map((r, i) => {
    const byDate = new Map(lead.data.dates.map((d, j) => [d, r.days[j]]));
    const inWin = days.filter((d) => d <= last).map((d) => byDate.get(d) || 0);
    const before = days.filter((d) => d <= last).map((d) => byDate.get(addD(d, -days.length)) ?? null);
    const total = inWin.reduce((a, b) => a + b, 0);
    const prev = zoom === 'year' || before.some((v) => v === null) ? null : before.reduce((a, b) => a + b, 0);
    const since = lead.data.dates.find((d) => byDate.get(d) > 0);
    return { key: r.key, color: COLORS[i % COLORS.length], byDate, series: inWin, total, prev, fresh: since && since >= first ? since : null };
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
  const focused = items.find((it) => it.key === focus);
  const max = Math.max(1, ...days.map((d) => map.get(d)?.[metric] || 0));
  const fill = (d) => {
    const row = map.get(d);
    if (!row || row[metric] === null) return '';
    if (focused) return `background:color-mix(in srgb, ${focused.color} ${Math.round(Math.min(share(focused, d) * 130, 72))}%, var(--surface))`;
    // Money is shaded by amount: a usual day of ad spend is usually nothing.
    if (lens === 'amount' || (lens === 'change' && MONEY.has(metric))) return row[metric] ? `background:color-mix(in srgb, var(--accent) ${Math.round(6 + (row[metric] / max) * 64)}%, var(--surface))` : '';
    if (lens !== 'change') return '';
    const u = usual(d);
    if (!u) return '';
    const c = row[metric] / u - 1;
    const a = Math.min(Math.abs(c), 0.6);
    return a < 0.05 ? '' : `background:color-mix(in srgb, var(${c > 0 ? '--good-ink' : '--critical-ink'}) ${Math.round(8 + (a / 0.6) * 34)}%, var(--surface))`;
  };
  const money = moneyFormat(metrics.data?.currency);
  // A metric's value as text: money in the currency, counts as counts (vk: short).
  const vf = (v, k = metric) => (v === null || v === undefined ? '—' : MONEY.has(k) ? money(v) : fmt(v));
  const vk = (v, k = metric) => (MONEY.has(k) && v !== null && v !== undefined ? money(v) : kfmt(v));
  const ctx = { map, metric, lens, usual, fill, evOn, jumpOn, focused, share, last, picked, L, phone, go, vf, vk, today: iso(Date.now()) };

  // Header controls.
  const periodLabel = zoom === 'day' ? (end === last ? 'Yesterday' : fmtD(end, { weekday: 'short', day: 'numeric', month: 'short' }))
    : zoom === 'month' ? monthName(month)
    : zoom === 'year' ? 'Last 12 months'
    : end === last ? `Last ${ZOOMS[zoom]} days` : `${fmtD(first, { day: 'numeric', month: 'short' })} – ${fmtD(end, { day: 'numeric', month: 'short' })}`;
  const step = (dir) => (zoom === 'month' ? go({ month: shiftMonth(month, dir), day: '' }) : go({ end: addD(end, dir * ZOOMS[zoom]), day: '' }));
  const offNext = zoom === 'year' || (zoom === 'month' ? month >= last.slice(0, 7) : end >= last);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(last.slice(0, 7), -i));
  const byLabel = L ? `By ${L.one}` : lens === 'amount' ? 'Amount' : 'vs usual';
  const controls = (
    <div class="tl-ctl">
      <div class="tl-period">
        <button type="button" class="nx-icon-btn" aria-label="Earlier" disabled={zoom === 'year'} onClick={() => step(-1)}><Icon name="chevron" size={14} class="flip" /></button>
        <Menu name="period" open={menu} setOpen={setMenu} label={<>{periodLabel} <Icon name="updown" size={12} /></>} cls="tl-pbtn">
          <MenuItem on={zoom === 'day' && end === last} onClick={() => go({ z: 'day', end: '', day: '' })}>Yesterday</MenuItem>
          <MenuItem on={zoom === '7d' && end === last} onClick={() => go({ z: '7d', end: '', day: '' })}>Last 7 days</MenuItem>
          <MenuItem on={zoom === '28d' && end === last} onClick={() => go({ z: '28d', end: '', day: '' })}>Last 28 days</MenuItem>
          <hr />
          {months.map((ym) => <MenuItem key={ym} on={zoom === 'month' && month === ym} onClick={() => go({ z: '', month: ym === last.slice(0, 7) ? '' : ym, day: '' })}>{monthName(ym)}</MenuItem>)}
          <hr />
          <MenuItem on={zoom === 'year'} onClick={() => go({ z: 'year', day: '' })}>Last 12 months</MenuItem>
        </Menu>
        <button type="button" class="nx-icon-btn" aria-label="Later" disabled={offNext} onClick={() => step(1)}><Icon name="chevron" size={14} /></button>
      </div>
      <span class="tl-bar">
        <Menu name="by" open={menu} setOpen={setMenu} label={<>{byLabel} <Icon name="updown" size={11} /></>} cls="nx-chip" title="What colours the days">
          <MenuItem on={lens === 'change'} onClick={() => go({ by: '', f: '' })}>Change vs usual</MenuItem>
          <MenuItem on={lens === 'amount'} onClick={() => go({ by: 'amount', f: '' })}>Amount</MenuItem>
          <hr /><span class="tl-lab">Break down by</span>
          {Object.entries(LENSES).map(([k, x]) => <MenuItem key={k} on={lens === k} onClick={() => go({ by: k, f: '' })}>{x.name}</MenuItem>)}
        </Menu>
        <Menu name="marks" open={menu} setOpen={setMenu} label={<>Marks{layers.length < Object.keys(KINDS).length ? ` ${layers.length}/${Object.keys(KINDS).length}` : ''} <Icon name="updown" size={11} /></>} cls="nx-chip">
          {Object.entries(KINDS).map(([k, [ic, l]]) => {
            const on = layers.includes(k);
            const n = [...(events.data?.events || []).map((e) => kindOf(e.kind)), ...(events.data?.alerts || []).map(() => 'alert')].filter((x) => x === k).length;
            return (
              <button key={k} type="button" class="nx-pop-row" role="menuitemcheckbox" aria-checked={on}
                onClick={() => setMarks([...(on ? layers.filter((x) => x !== k) : [...layers, k]), ...(on && k === 'ad' ? ['-ad'] : [])].join(','))}>
                <span class={`tl-cbx${on ? ' on' : ''}`}>{on && <Icon name="check" size={11} />}</span><Icon name={ic} size={14} />{l}<span class="nx-pop-meta">{n}</span>
              </button>
            );
          })}
        </Menu>
        {zoom !== 'day' && (
          <span class="tl-seg" role="group" aria-label="Draw as">
            <button type="button" class={!asLine ? 'on' : ''} aria-pressed={!asLine} title="Calendar" aria-label="Calendar" onClick={() => go({ v: '' })}><Icon name="calendar" size={15} /></button>
            <button type="button" class={asLine ? 'on' : ''} aria-pressed={asLine} title="Line" aria-label="Line" onClick={() => go({ v: 'line' })}><Icon name="chart" size={15} /></button>
          </span>
        )}
        <button type="button" class="nx-icon-btn" title="Add a post or note" aria-label="Add a post or note" onClick={() => setAdding(true)}><Icon name="plus" size={15} /></button>
      </span>
    </div>
  );

  const loading = !metrics.data || (L && !lead.data && !lead.error);
  const err = metrics.error || events.error || lead.error;
  const dayDetail = zoom === 'day' ? end : picked;

  return (
    <Page title="Timeline" sub={`Every day: how it went, where people landed, what shipped${site ? '' : ' · all sites'}`} actions={controls}>
      {site && <><Ask site={site} span={null} /><Waiting site={site} waiting={waiting} /><SetupNote site={site} /></>}
      {adding && <TimelineAdd site={scope} sites={sites} date={picked || last} today={ctx.today} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); events.reload(); }} />}
      {err ? <ErrorState error={err} onRetry={() => { metrics.reload(); events.reload(); lead.reload?.(); }} />
        : loading ? <Loading height={420} owl label="Reading every day…" />
        : (
          <>
            {metrics.data.errors?.length > 0 && <p class="nx-note-line warn">{metrics.data.errors.map((e) => `${e.site}: ${e.message}`).join(' · ')}</p>}
            <Tiles days={days} ctx={ctx} />
            <div class={`tl-split${zoom === 'day' ? ' one' : ''}`}>
              <div class="tl-map card card-plain">
                {zoom === 'day' ? <DayPanel scope={scope} date={end} ctx={ctx} inline />
                  : asLine ? <LineView days={days} items={items} ctx={ctx} evList={evList} />
                  : zoom === 'year' ? <YearGrid days={days} ctx={ctx} />
                  : zoom === '7d' ? <WeekView days={days} ctx={ctx} />
                  : <MonthGrid days={days} zoom={zoom} ctx={ctx} />}
                {zoom !== 'day' && <ScaleKey ctx={ctx} asLine={asLine} />}
              </div>
              {zoom !== 'day' && !phone && (
                <aside class="tl-insp card card-plain" aria-label={picked ? 'Day' : 'Period'}>
                  {picked ? <DayPanel scope={scope} date={picked} ctx={ctx} onClose={() => go({ day: '' })} />
                    : <WindowPanel days={days} zoom={zoom} label={periodLabel} items={items} ctx={ctx} evList={evList} />}
                </aside>
              )}
            </div>
            {zoom !== 'day' && phone && (
              <section class="tl-insp card card-plain"><WindowPanel days={days} zoom={zoom} label={periodLabel} items={items} ctx={ctx} evList={evList} /></section>
            )}
            {phone && dayDetail && zoom !== 'day' && (
              <Drawer title={fmtD(dayDetail, { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => go({ day: '' })}>
                <DayPanel scope={scope} date={dayDetail} ctx={ctx} inline />
              </Drawer>
            )}
          </>
        )}
    </Page>
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

function Tiles({ days, ctx }) {
  const ds = days.filter((d) => d <= ctx.last && ctx.map.get(d));
  return (
    <div class="tl-tiles">
      {METRICS.map(([k, l]) => {
        const vals = ds.map((d) => ctx.map.get(d)[k]);
        if (vals.every((v) => v === null)) return null;
        const tot = vals.reduce((a, v) => a + (v || 0), 0);
        const us = ds.reduce((a, d) => a + (ctx.usual(d, k) || 0), 0);
        const c = us ? tot / us - 1 : null;
        const on = ctx.metric === k && (ctx.lens === 'change' || ctx.lens === 'amount');
        return (
          <button key={k} type="button" class={`tl-tile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => ctx.go({ m: k === 'sessions' ? '' : k, ...(ctx.L ? { by: '', f: '' } : {}) })}>
            <small>{l}</small>
            <b>{ctx.vk(tot, k)}{!(MONEY.has(k) && c === null) && <span class={c === null ? 'muted' : c >= 0 ? 'good' : 'bad'}>{pct(c)}</span>}</b>
            <Spark vals={vals} dates={ds} unit={l.toLowerCase()} format={MONEY.has(k) ? (v) => ctx.vf(v, k) : null} />
          </button>
        );
      })}
    </div>
  );
}

function Cell({ d, ctx }) {
  const n = Number(d.slice(8));
  const row = ctx.map.get(d);
  const future = d > ctx.last;
  if (future || !row) {
    return <div class={`tl-day fut${d === ctx.today ? ' today' : ''}`} role="gridcell"><span class="tl-dn">{n}</span>{d === ctx.today && !ctx.phone && <span class="tl-dv muted">today</span>}</div>;
  }
  const ev = ctx.evOn(d);
  let val = null;
  if (ctx.focused) {
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
    const c = v !== null && u ? v / u - 1 : null;
    val = v === null ? <span class="tl-dv muted">—</span>
      : <span class="tl-dv">{ctx.phone ? ctx.vk(v) : ctx.vf(v)}{!ctx.phone && ctx.lens === 'change' && c !== null && <small class={c >= 0 ? 'good' : 'bad'}>{pct(c)}</small>}</span>;
  }
  return (
    <button type="button" class={`tl-day${ctx.picked === d ? ' sel' : ''}`} style={ctx.fill(d)} aria-label={fmtD(d, { weekday: 'long', day: 'numeric', month: 'long' })}
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
        const v = row?.[ctx.metric] ?? null;
        const u = ctx.usual(d);
        const c = v !== null && u ? v / u - 1 : null;
        return (
          <button key={d} type="button" class={`tl-wcol${ctx.picked === d ? ' sel' : ''}`} onClick={() => ctx.go({ day: ctx.picked === d ? '' : d })}>
            <span class="tl-wtop" style={ctx.fill(d)}>
              <span class="muted small">{fmtD(d, { weekday: 'short', day: 'numeric' })}</span>
              <b>{ctx.vf(v)}</b>
              <small class={c === null ? 'muted' : c >= 0 ? 'good' : 'bad'}>{pct(c)} vs usual</small>
            </span>
            <span class="tl-wev">
              {ctx.L && (() => { const j = ctx.jumpOn(d); return j ? <span><i style={`background:${j.it.color}`} />{ctx.lens === 'page' ? pageName(j.it.key) : j.it.key}</span> : null; })()}
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
                  title={`${fmtD(d, { weekday: 'short', day: 'numeric', month: 'short' })} · ${ctx.vf(ctx.map.get(d)?.[ctx.metric])}${ev.length ? ` · ${ev.map((e) => e.label).join(', ')}` : ''}`}
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
  if (n < 2) return <p class="nx-empty">Not enough days in this window yet.</p>;
  const sum = (g, f) => g.reduce((a, d) => a + (f(d) || 0), 0);
  let series;
  if (ctx.L) {
    const top = items.slice(0, 5);
    series = top.map((it) => ({ label: ctx.lens === 'page' ? pageName(it.key) : it.key, color: it.color, vals: groups.map((g) => sum(g, (d) => it.byDate.get(d))), faded: Boolean(ctx.focused) && ctx.focused.key !== it.key }));
  } else {
    series = [
      { label: METRICS.find(([k]) => k === ctx.metric)[1], color: 'var(--accent)', vals: groups.map((g) => sum(g, (d) => ctx.map.get(d)?.[ctx.metric])), area: true },
      { label: 'A usual day', color: 'var(--text-3)', vals: groups.map((g) => sum(g, (d) => ctx.usual(d))), dashed: true },
    ];
  }
  const mx = niceTop(Math.max(1, ...series.flatMap((s) => s.vals)));
  const W = 600;
  const H = 200;
  const X = (i) => (i / (n - 1)) * W;
  const Y = (v) => H - (v / mx) * H;
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
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
            </g>
          ))}
          {hi >= 0 && <line x1={X(hi)} x2={X(hi)} y1="0" y2={H} stroke="var(--text-3)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />}
        </svg>
        {hi >= 0 && series.filter((s) => !s.faded).map((s) => <i key={s.label} class="tl-sdot" style={`left:${hx * 100}%;top:${(Y(s.vals[hi]) / H) * 100}%;background:${s.color}`} />)}
        {hi >= 0 && (
          <div class={`tl-ltip${hx > 0.65 ? ' r' : ''}`} style={`left:${hx * 100}%`}>
            <b>{weekly ? `Week of ${fmtD(groups[hi][0], { day: 'numeric', month: 'short' })}` : fmtD(groups[hi][0], { weekday: 'short', day: 'numeric', month: 'short' })}</b>
            {[...series].sort((a, b) => (b.dashed ? -1 : 0) || b.vals[hi] - a.vals[hi]).map((s) => <span key={s.label}><i style={`background:${s.color}`} /><em>{s.label}</em><b>{ctx.L ? fmt(s.vals[hi]) : ctx.vf(s.vals[hi])}</b></span>)}
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
  if (asLine) return <p class="tl-scale">Each point is a day; click one to open it.</p>;
  if (ctx.focused) return <p class="tl-scale"><b>{ctx.focused.key}</b>: its {ctx.L.of === 'clicks' ? 'clicks' : 'visits'} each day; darker is a bigger share. <button type="button" class="todo-link" onClick={() => ctx.go({ f: '' })}>Stop</button></p>;
  if (ctx.L) return <p class="tl-scale">A day is named when something starts: a new {ctx.L.one}, or one rising to 2× its usual share.</p>;
  if (ctx.lens === 'amount' || MONEY.has(ctx.metric)) return <p class="tl-scale">{MONEY.has(ctx.metric) ? 'Less' : 'Fewer'} <i style="background:color-mix(in srgb, var(--accent) 10%, var(--surface))" /><i style="background:color-mix(in srgb, var(--accent) 38%, var(--surface))" /><i style="background:color-mix(in srgb, var(--accent) 70%, var(--surface))" /> More</p>;
  return (
    <p class="tl-scale">Below a usual day
      <i style="background:color-mix(in srgb, var(--critical-ink) 40%, var(--surface))" /><i style="background:color-mix(in srgb, var(--critical-ink) 18%, var(--surface))" /><i style="background:var(--surface)" />
      <i style="background:color-mix(in srgb, var(--good-ink) 18%, var(--surface))" /><i style="background:color-mix(in srgb, var(--good-ink) 40%, var(--surface))" /> Above
    </p>
  );
}

// The whole period: what's moving (with a lens), else the best and worst days; then what happened.
function WindowPanel({ days, zoom, label, items, ctx, evList }) {
  const ds = days.filter((d) => d <= ctx.last && ctx.map.get(d)?.[ctx.metric] != null);
  const ml = METRICS.find(([k]) => k === ctx.metric)[1];
  const rows = ds.map((d) => ({ d, v: ctx.map.get(d)[ctx.metric], c: ctx.usual(d) ? ctx.map.get(d)[ctx.metric] / ctx.usual(d) - 1 : null })).filter((x) => x.c !== null);
  const best = [...rows].sort((a, b) => b.c - a.c).slice(0, 3).filter((x) => x.c > 0);
  const worst = [...rows].sort((a, b) => a.c - b.c).slice(0, 3).filter((x) => x.c < 0);
  const dayRow = (x) => (
    <button key={x.d} type="button" class="tl-brow" onClick={() => ctx.go({ day: x.d })}>
      <span>{fmtD(x.d, { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>{ctx.vf(x.v)}</b><span class={x.c >= 0 ? 'good' : 'bad'}>{pct(x.c)}</span>
    </button>
  );
  const effect = (date) => {
    const after = [1, 2, 3].map((i) => addD(date, i));
    if (after[2] > ctx.last) return null;
    const s = (list) => list.reduce((a, d) => a + (ctx.map.get(d)?.sessions || 0), 0);
    const before = s([1, 2, 3].map((i) => addD(date, -i)));
    return before ? s(after) / before - 1 : null;
  };
  const shipped = [...evList].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  return (
    <div class="tl-in">
      <div class="tl-in-h"><b>{zoom === 'month' && label === monthName(ctx.last.slice(0, 7)) ? `${label}, so far` : label}</b><span class="muted small">{ctx.phone ? 'Tap a day for detail' : 'Pick a day for detail'}</span></div>
      {ctx.L ? (
        <div class="tl-sec">
          <h3 class="nx-label-sm">What’s moving · {ctx.L.name.toLowerCase()}</h3>
          {items.length ? [...items].sort((a, b) => (b.prev ? b.total / b.prev : 99) - (a.prev ? a.total / a.prev : 99)).slice(0, 8).map((it) => {
            const c = it.prev ? it.total / it.prev - 1 : null;
            const tag = it.fresh ? `New ${fmtD(it.fresh, { day: 'numeric', month: 'short' })}` : c === null ? '' : c > 0.3 ? 'Rising' : c < -0.2 ? 'Falling' : 'Steady';
            const tone = it.fresh || c > 0.3 ? 'good' : c < -0.2 ? 'bad' : 'muted';
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
          {best.length > 0 && <div class="tl-sec"><h3 class="nx-label-sm">Best days · {ml}</h3>{best.map(dayRow)}</div>}
          {worst.length > 0 && <div class="tl-sec"><h3 class="nx-label-sm">Worst days</h3>{worst.map(dayRow)}</div>}
        </>
      )}
      <div class="tl-sec">
        <h3 class="nx-label-sm">What happened</h3>
        {shipped.length ? shipped.map((e, i) => {
          const c = e.kind === 'alert' || e.kind === 'mention' ? undefined : effect(e.date);
          return (
            <button key={i} type="button" class="tl-erow" onClick={() => ctx.go({ day: e.date })}>
              <span class="muted">{fmtD(e.date, { day: 'numeric', month: 'short' })}</span>
              <span class={e.kind === 'alert' ? 'bad' : ''}><Icon name={KINDS[e.kind][0]} size={13} /></span>
              <span class="tl-et">{e.label}</span>
              <span>{c === undefined ? '' : c === null ? <span class="muted" title="The 3 days after it aren’t in yet">too early</span> : <span class={c >= 0 ? 'good' : 'bad'} title="Visits, the 3 days after against the 3 before">{pct(c)}</span>}</span>
            </button>
          );
        }) : <p class="muted small m-0">Nothing marked in this window. Add a post or note with +.</p>}
      </div>
    </div>
  );
}

// One day: what happened in a sentence, its numbers against a usual (or last) same weekday,
// where visits came from and landed, and what was marked that day.
export function DayPanel({ scope, date, ctx, onClose, inline }) {
  const d = useAsync(() => api.get(`/calendar/day${qs({ site: scope, date })}`), [scope, date]);
  const [cmp, setCmp] = usePersistent('tl-cmp', 'usual');
  const [tab, setTab] = useState(ctx.L ? ctx.lens : 'page');
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
  const marks = d.data ? [...(d.data.events || []).map((e) => ({ kind: kindOf(e.kind), label: e.label, url: e.url })), ...(d.data.alerts || []).map((a) => ({ kind: 'alert', label: a.title || a.label }))] : [];
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
      {d.error ? <ErrorState error={d.error} onRetry={d.reload} /> : !d.data ? <Loading height={200} /> : (
        <>
          <p class="tl-story"><b>{d.data.headline}</b>{d.data.lines?.length ? ' ' : ''}{d.data.lines?.slice(0, 2).map((l) => l.text).join(' ')}</p>
          <div class="tl-sec">
            <div class="tl-cmprow">
              <h3 class="nx-label-sm">Against</h3>
              <span class="tl-seg small" role="group" aria-label="Compare with">
                <button type="button" class={cmp === 'usual' ? 'on' : ''} onClick={() => setCmp('usual')}>Usual {wd}</button>
                <button type="button" class={cmp === 'week' ? 'on' : ''} onClick={() => setCmp('week')}>Last {wd}</button>
              </span>
            </div>
            <div class="tl-nums">
              {METRICS.map(([k, l]) => {
                const v = row?.[k] ?? null;
                if (v === null) return null;
                const b = baseOf(k);
                const c = b ? v / b - 1 : null;
                const vf = ctx.vf || ((x, key) => (MONEY.has(key) && x != null ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : fmt(x)));
                return <div key={k} class="tl-num"><span>{l}</span><b>{vf(v, k)}</b><span class="muted">{vf(b, k)}</span><span class={c === null ? 'muted' : c >= 0 ? 'good' : 'bad'}>{pct(c)}</span></div>;
              })}
            </div>
          </div>
          {hours && (
            <div class="tl-sec">
              <h3 class="nx-label-sm">By hour{peak >= 0 && hours[peak] ? <span class="tl-peak"> · busiest {String(peak).padStart(2, '0')}:00</span> : null}</h3>
              <div class="tl-hours" role="img" aria-label={`Visits by hour: ${hours.map((v, h) => `${h}:00 ${v}`).join(', ')}`}>
                {hours.map((v, h) => <span key={h} class="tl-hb" onMouseEnter={() => setHh(h)} onMouseLeave={() => setHh(-1)}><i style={`height:${Math.max(v ? 4 : 1, Math.round((v / hmax) * 40))}px`} class={h === peak || h === hh ? 'pk' : ''} /></span>)}
                {hh >= 0 && <span class={`tl-tip${hh > 16 ? ' r' : hh < 7 ? ' l' : ''}`} style={`left:${((hh + 0.5) / 24) * 100}%;top:-6px`}>{String(hh).padStart(2, '0')}:00 · <b>{fmt(hours[hh])}</b> visit{hours[hh] === 1 ? '' : 's'}</span>}
                <span class="tl-hl"><span>00</span><span>06</span><span>12</span><span>18</span><span /></span>
              </div>
            </div>
          )}
          <div class="tl-sec">
            <div class="tl-dtabs" role="tablist">
              {[['page', 'Pages'], ['source', 'Sources'], ['query', 'Searches'], ['country', 'Countries']].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            {lists[tab].length ? lists[tab].slice(0, 6).map((x) => {
              const gain = x.expected === undefined ? null : x.value - x.expected;
              const flat = gain !== null && Math.abs(gain) < Math.max(3, x.expected * 0.15);
              const fresh = gain !== null && !x.expected && x.value > 0;
              return (
                <div key={x.label} class="tl-srow">
                  <span class="tl-sl">{tab === 'page' && scope !== 'all' && x.label.startsWith('/') ? <a href={pushPanel({ kind: 'page', key: x.label })}>{pageName(x.label)}</a> : <span>{tab === 'page' ? pageName(x.label) : x.label}</span>}<i style={`width:${listTotal ? Math.max(2, Math.round((x.value / listTotal) * 100)) : 0}%`} /></span>
                  <b>{fmt(x.value)}</b>
                  <span class={gain === null ? 'muted' : fresh ? 'good' : flat ? 'muted' : gain > 0 ? 'good' : 'bad'}>{gain === null ? '' : fresh ? 'new' : flat ? 'as usual' : `${gain > 0 ? '+' : '−'}${fmt(Math.abs(gain))}`}</span>
                </div>
              );
            }) : <p class="muted small m-0">{tab === 'query' ? 'Search Console hasn’t reported this day yet, or nothing came from search.' : 'Nothing recorded.'}</p>}
          </div>
          <div class="tl-sec">
            <h3 class="nx-label-sm">What happened</h3>
            {marks.map((e, i) => (
              <div key={i} class="tl-erow static">
                <span class={e.kind === 'alert' ? 'bad' : ''}><Icon name={KINDS[e.kind][0]} size={14} /></span>
                <span class="tl-et">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a> : e.label}</span>
              </div>
            ))}
            {ef !== undefined && (
              <p class="tl-effect">{ef === null ? <span class="muted">Too early to judge: the 3 days after aren’t in yet.</span>
                : <>Visits <b class={ef >= 0 ? 'good' : 'bad'}>{pct(ef)}</b> in the 3 days after, against the 3 before.</>}</p>
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

// A day's pages or sources across the sites in scope, biggest first.
function merge(sites, key) {
  const out = new Map();
  for (const s of sites || []) {
    for (const x of s[key] || []) {
      const cur = out.get(x.label) || { label: x.label, value: 0, expected: 0 };
      cur.value += x.value;
      cur.expected += x.expected || 0;
      out.set(x.label, cur);
    }
  }
  return [...out.values()].sort((a, b) => b.value - a.value);
}
