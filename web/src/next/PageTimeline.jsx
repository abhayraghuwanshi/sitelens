import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { pushPanel } from './Panel.jsx';

// A page's timeline (docs/redesign/prototype.html → a page): every event from
// GET /sites/:id/page-timeline, oldest first, as a vertical line of mail-style
// messages, ending in Now. The rules (titles, folding, what each attachment
// holds) live in server/page-events.mjs; this file only draws what it returns.
//   collapsed: date · kind icon on the line · sender · title — detail
//   open:      sender, "to <page>", title, detail, one attachment chip, actions
//   attachment: the diff (for a change), the 4-week chart with the day marked, number cells, findings
const fmtD = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const WHO = { you: ['You', 'A'], kauzl: ['Kauzl', 'K'], agent: ['Claude Code', 'C'], claude: ['Claude', 'C'], google: ['Google', 'G'], bing: ['Bing', 'B'] };
const KIND_ICON = { change: 'github', spike: 'trend', check: 'search', mark: 'star', todo: 'check', crawl: 'globe' };
const TRACK_LABEL = { goals: 'Goal', search: 'Search', content: 'Content', speed: 'Speed', index: 'Index', ai: 'AI answers', visitors: 'Visitors', work: 'Your work' };
const STAGE_LABEL = { open: 'Open', proposed: 'Proposed', changed: 'Changed', live: 'Live', checked: 'Checked' };
const SEV = { high: 'down', mid: 'warn', low: 'warn', ok: 'up' };

export function PageTimeline({ site, path }) {
  const res = useAsync(() => api.get(`/sites/${site.id}/page-timeline${qs({ path })}`), [site.id, path]);
  const [track, setTrack] = useState('');
  const [open, setOpen] = useState(null);
  const [att, setAtt] = useState(null);
  const [showQuiet, setShowQuiet] = useState(false);

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <Loading height={360} owl label="Putting the page’s story together: its changes, visits and to-dos…" />;
  const t = res.data;
  const shown = t.events.filter((e) => !track || e.track === track);
  const byId = new Map(t.events.map((e) => [e.id, e]));
  const toggle = (id) => { setOpen(open === id ? null : id); setAtt(null); };
  const jump = (id) => { setTrack(''); setShowQuiet(true); setOpen(id); setAtt(null); };

  // Quiet events (repeats with nothing new) fold into one line per run.
  const rows = [];
  for (const e of shown) {
    if (e.quiet && !showQuiet) {
      const last = rows.at(-1);
      if (last?.fold) last.n += 1;
      else rows.push({ fold: true, n: 1, date: e.date });
    } else rows.push(e);
  }
  const notes = Object.entries(t.notes || {}).filter(([, v]) => v && v !== 'demo');

  return (
    <div class="pt">
      {Object.values(t.tracks).filter(Boolean).length > 1 && <div class="pt-tracks" role="group" aria-label="Show one kind of event">
        <button type="button" class={`pt-trk${!track ? ' on' : ''}`} aria-pressed={!track} onClick={() => setTrack('')}>All <b>{t.events.length - t.quiet}</b></button>
        {Object.entries(t.tracks).filter(([, n]) => n).map(([k, n]) => (
          <button key={k} type="button" class={`pt-trk${track === k ? ' on' : ''}`} aria-pressed={track === k} onClick={() => setTrack(track === k ? '' : k)}>{TRACK_LABEL[k] || k} <b>{n}</b></button>
        ))}
      </div>}

      {!shown.length && <p class="muted small">{track ? 'Nothing on this track in 90 days.' : 'Nothing has happened to this page in 90 days that Kauzl can see: no commits to its file, no notes that name it, no busy days, no to-dos.'}</p>}

      <ol class="pt-tl">
        {rows.map((e, i) => e.fold ? (
          <li key={`f${i}`} class="pt-row pt-fold">
            <span class="pt-date muted">{fmtD(e.date)}</span><span class="pt-ico quiet" aria-hidden="true" />
            <button type="button" class="todo-link" onClick={() => setShowQuiet(true)}>{e.n} quieter {e.n > 1 ? 'events' : 'event'}: no change</button>
          </li>
        ) : (
          <li key={e.id} class={`pt-row${open === e.id ? ' open' : ''}${e.quiet ? ' quiet' : ''}`}>
            <span class="pt-date muted">{fmtD(e.date)}</span>
            <span class={`pt-ico ${e.tone || ''}`} aria-hidden="true"><Icon name={KIND_ICON[e.kind] || 'star'} size={12} /></span>
            {open === e.id
              ? <EventCard e={e} site={site} path={path} att={att} setAtt={setAtt} onClose={() => toggle(e.id)} />
              : (
                <button type="button" class="pt-ev" onClick={() => toggle(e.id)} aria-expanded="false">
                  <span class="pt-who"><Avatar who={e.who} /><b>{(WHO[e.who] || [e.who])[0]}</b></span>
                  <span class="pt-sub">{e.tone && e.tone !== 'muted' && <i class={`pt-dot ${e.tone}`} />}<b>{e.title}</b>{e.detail && <span class="muted"> — {e.detail}</span>}</span>
                  <Icon name="chevron" size={14} class="pt-go" />
                </button>
              )}
          </li>
        ))}
        {t.now && (
          <li class="pt-row open pt-nowrow">
            <span class="pt-date pt-nowl">Now</span>
            <span class="pt-ico now" aria-hidden="true" />
            <NowCard now={t.now} site={site} byId={byId} onJump={jump} />
          </li>
        )}
      </ol>
      {notes.length > 0 && <p class="muted small pt-notes">{notes.map(([k, v]) => <span key={k}>{v} </span>)}</p>}
    </div>
  );
}

function Avatar({ who }) {
  return <span class={`pt-av ${who}`}>{(WHO[who] || ['', '?'])[1]}</span>;
}

function EventCard({ e, site, path, att, setAtt, onClose }) {
  const a = e.attachment;
  const parts = [a.diff && 'diff', a.series && (a.diff ? 'what happened after' : '4-week chart'), a.cells?.length && `${a.cells.length} ${a.cells.length > 1 ? 'numbers' : 'number'}`, a.findings?.length && `${a.findings.length} ${a.findings.length > 1 ? 'findings' : 'finding'}`].filter(Boolean);
  const actions = [
    e.attachment.diff?.url && <a key="c" class="btn" href={e.attachment.diff.url} target="_blank" rel="noopener noreferrer"><Icon name="github" size={13} /> Open the commit</a>,
    e.todo && <a key="t" class="btn" href={pushPanel({ kind: 'todo', key: e.todo })}>Open the to-do</a>,
    <a key="d" class="btn ghost" href={pushPanel({ kind: 'day', key: e.date })}>See this day</a>,
  ].filter(Boolean);
  return (
    <div class="pt-card">
      <button type="button" class="pt-hd" onClick={onClose} aria-expanded="true">
        <Avatar who={e.who} />
        <span class="pt-from"><b>{(WHO[e.who] || [e.who])[0]}</b><small>to {path}</small></span>
      </button>
      <h3 class="pt-title">{e.tone && e.tone !== 'muted' && <i class={`pt-dot ${e.tone}`} />}{e.title}</h3>
      {e.detail && <p class="pt-body">{e.detail}</p>}
      {parts.length > 0 && (att ? <Attachment a={a} date={e.date} onClose={() => setAtt(null)} /> : (
        <button type="button" class="pt-att" onClick={() => setAtt(e.id)} aria-expanded="false">
          <span class="pt-th"><Thumb a={a} /></span>
          <span class="pt-attn"><b>{a.title}</b><small>{parts.join(' · ')}</small></span>
          <Icon name="chevron" size={14} />
        </button>
      ))}
      <div class="nx-btns">{actions}</div>
    </div>
  );
}

// The closed attachment's thumbnail: +a −d for a diff, else a mini chart, else the first number.
function Thumb({ a }) {
  if (a.diff) return <span class="pt-dn"><i class="good">+{fmt(a.diff.additions)}</i><i class="bad">−{fmt(a.diff.deletions)}</i></span>;
  if (a.series?.days?.length > 1) {
    const v = a.series.days, mx = Math.max(1, ...v) * 1.15, W = 56, H = 30;
    const X = (i) => (i / (v.length - 1)) * W, Y = (y) => H - 2 - (y / mx) * (H - 4);
    const days = v.length, mi = Math.round((Date.parse(a.series.mark) - Date.parse(a.series.from)) / 86_400_000);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        <path d={v.map((y, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')} fill="none" stroke="var(--accent)" stroke-width="1.4" />
        {mi >= 0 && mi < days && <><line x1={X(mi)} x2={X(mi)} y1="0" y2={H} stroke="var(--text-3)" stroke-dasharray="2 2" /><circle cx={X(mi)} cy={Y(v[mi])} r="2.4" fill="var(--text)" /></>}
      </svg>
    );
  }
  if (a.cells?.[0]) return <b class={`pt-num ${a.cells[0].tone || ''}`}>{a.cells[0].value}</b>;
  return <Icon name="pages" size={16} />;
}

export function Attachment({ a, date, onClose }) {
  return (
    <div class="pt-attv">
      <div class="pt-attvh"><Icon name="pages" size={13} /><b>{a.title}</b><span class="muted">{fmtD(date)}</span>{onClose && <button type="button" class="todo-link" onClick={onClose}>Close</button>}</div>
      {a.diff && <Diff d={a.diff} />}
      {a.series && <ProofChart s={a.series} />}
      {a.cells?.length > 0 && (
        <div class="pt-cells">{a.cells.map((c, i) => <div key={i}><small>{c.label}</small><b class={c.tone === 'up' ? 'good' : c.tone === 'down' ? 'bad' : c.tone === 'muted' ? 'muted' : ''}>{c.value}</b>{c.note && <span>{c.note}</span>}</div>)}</div>
      )}
      {a.findings?.length > 0 && (
        <ul class="pt-finds">{a.findings.map((f, i) => <li key={i}><i class={`pt-dot ${SEV[f.sev] || 'muted'}`} />{/^https:\/\//.test(f.note || '') ? <span><a href={f.note} target="_blank" rel="noopener noreferrer">{f.text} ↗</a></span> : <span>{f.text}{f.note && <small>{f.note}</small>}</span>}</li>)}</ul>
      )}
    </div>
  );
}

// One diff block for the whole flow: a change's real diff, and Now's proposal (was → to), the same look.
export function Diff({ d }) {
  return (
    <div class={`pt-dif${d.prose ? ' prose' : ''}`}>
      <div class="pt-difh"><Icon name="pages" size={12} /><b>{d.where}</b>{d.src && <span>{d.src}</span>}<em><i class="good">+{fmt(d.additions)}</i> <i class="bad">−{fmt(d.deletions)}</i></em></div>
      {d.lines.map(([op, text], i) => (
        <div key={i} class={`pt-dl${op === '+' ? ' add' : op === '-' ? ' del' : op === '…' ? ' skip' : ''}`}>
          <i aria-label={op === '+' ? 'added' : op === '-' ? 'removed' : undefined}>{op === '…' ? '⋯' : op === ' ' ? '' : op === '-' ? '−' : '+'}</i>
          <code>{String(text)}</code>
        </div>
      ))}
    </div>
  );
}

// The 4 weeks around the event, the day marked.
function ProofChart({ s }) {
  const v = s.days, n = v.length;
  if (n < 2) return null;
  const mx = Math.max(1, ...v) * 1.1, W = 600, H = 90;
  const X = (i) => (i / (n - 1)) * W, Y = (y) => H - (y / mx) * (H - 4);
  const line = v.map((y, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  const mi = Math.round((Date.parse(s.mark) - Date.parse(s.from)) / 86_400_000);
  const pos = `${((mi / (n - 1)) * 100).toFixed(1)}%`;
  const near = (a, b) => Math.abs(a - b) < 6;
  return (
    <div class="pt-chart">
      <div class="pt-chh"><small class="muted">Visits a day, 4 weeks</small>{mi >= 0 && mi < n && <small><b>{fmt(v[mi])}</b> <span class="muted">on {fmtD(s.mark)}</span></small>}</div>
      <div class="pt-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="var(--accent)" opacity=".12" />
          <path d={line} fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke" />
        </svg>
        {mi >= 0 && mi < n && <span class="pt-mark" style={`left:${pos}`} />}
      </div>
      <div class="pt-x">
        {!near(mi, 0) && <span style="left:0">{fmtD(s.from)}</span>}
        {mi >= 0 && mi < n && <b style={`left:${pos}`} class={near(mi, 0) ? 'l' : near(mi, n - 1) ? 'r' : ''}>{fmtD(s.mark)}</b>}
        {!near(mi, n - 1) && <span style="left:100%" class="r">{fmtD(s.to)}</span>}
      </div>
    </div>
  );
}

function NowCard({ now, site, byId, onJump }) {
  const because = now.because.map((id) => byId.get(id)).filter(Boolean);
  const at = now.stages.indexOf(now.stage);
  return (
    <div class="pt-card pt-now">
      <div class="pt-hd"><Avatar who="kauzl" /><span class="pt-from"><b>Kauzl</b><small>next step · {now.stage === 'proposed' ? 'needs your OK' : STAGE_LABEL[now.stage].toLowerCase()}</small></span></div>
      <h3 class="pt-title">{now.title}</h3>
      {now.detail && <p class="pt-body">{now.detail}</p>}
      {now.diff && <Diff d={now.diff} />}
      {now.proposal && <p class="pt-body small"><b>{(WHO[now.proposal.by] || ['You'])[0]} proposed:</b> {now.proposal.changes}{now.proposal.expected ? <span class="muted"> · Expected: {now.proposal.expected}</span> : ''}</p>}
      {because.length > 0 && (
        <div class="pt-bec"><small>Because</small>{because.map((e) => <button key={e.id} type="button" class="pt-why" onClick={() => onJump(e.id)}><span class="muted">{fmtD(e.date)}</span> {e.title}</button>)}</div>
      )}
      <ol class="pt-stages" aria-label="Where the to-do is">
        {now.stages.map((s, i) => <li key={s} class={i < at ? 'done' : i === at ? 'on' : ''} aria-current={i === at ? 'step' : undefined}>{STAGE_LABEL[s]}</li>)}
      </ol>
      <div class="pt-nowa">
        <a class="btn primary" href={pushPanel({ kind: 'todo', key: now.todo })}>{now.stage === 'proposed' ? 'Review the proposal' : 'Open the to-do'}</a>
        {now.more.length > 0 && <details class="pt-more"><summary>{now.more.length} other {now.more.length > 1 ? 'ideas' : 'idea'}</summary><ul>{now.more.map((m) => <li key={m.todo}><a href={pushPanel({ kind: 'todo', key: m.todo })}>{m.title}</a></li>)}</ul></details>}
      </div>
    </div>
  );
}
