import { useEffect } from 'preact/hooks';
import { formatNumber } from '@shared/format.js';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { kindColor } from '../charts/LineChart.jsx';
import { Icon } from './icons.jsx';
import { Loading } from './ui.jsx';

const STAGE_ICONS = { domain: 'globe', deploy: 'rocket', speed: 'pulse', traffic: 'trend', outcome: 'download' };
const STATUS_LABEL = { good: 'Fine', warn: 'Needs a look', bad: 'Broken', idle: 'Quiet', off: 'Not connected' };

// Where each stage's evidence lives.
function stageHref(key, site, productId) {
  if (key === 'speed' && site) return `#/health?site=${site.id}`;
  if (key === 'traffic' && site) return `#/site/${site.id}/overview`;
  if (key === 'deploy') return site ? `#/firebase?site=${site.id}` : '#/github';
  if (key === 'outcome') return productId ? `#/outcomes/${productId}` : '#/extensions';
  if (key === 'domain' && !site) return '#/settings?tab=products';
  return '';
}

// The week in one sentence, colored by the worst stage.
export function SummaryLine({ summary }) {
  return (
    <p class={`journey-summary ${summary.status}`}>
      <span class={`status-dot ${summary.status}`} aria-hidden="true" />
      {summary.text}
    </p>
  );
}

// Five stages, left to right in the order things break. Clicking one opens its detail.
export function JourneyStrip({ stages, site, productId, open, onOpen }) {
  const current = stages.find((s) => s.key === open);
  return (
    <div class="journey">
      <ol class="journey-steps" aria-label="Product journey">
        {stages.map((s) => (
          <li key={s.key}>
            <button type="button" class={`journey-step ${s.status}${open === s.key ? ' open' : ''}`} aria-expanded={open === s.key}
              onClick={() => onOpen(open === s.key ? '' : s.key)}>
              <span class="journey-head">
                <Icon name={STAGE_ICONS[s.key]} size={14} />
                {s.label}
                <span class={`status-dot ${s.status}`} title={STATUS_LABEL[s.status]} aria-label={STATUS_LABEL[s.status]} />
              </span>
              <span class="journey-line">{s.headline}</span>
            </button>
          </li>
        ))}
      </ol>
      {current && <StageDetail stage={current} href={stageHref(current.key, site, productId)} />}
    </div>
  );
}

function StageDetail({ stage, href }) {
  return (
    <div class="journey-detail">
      {stage.items.length > 0 ? (
        <ul class="journey-items">
          {stage.items.map((i) => (
            <li key={i.label}>
              <span class={`status-dot ${i.status}`} aria-hidden="true" />
              <b>{i.label}</b>
              {i.url ? <a href={i.url} target="_blank" rel="noreferrer">{i.text}</a> : <span>{i.text}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p class="note" style={{ margin: 0 }}>{stage.headline}.</p>
      )}
      {stage.key === 'deploy' && stage.ships?.length > 1 && (
        <ul class="journey-ships">
          {[...stage.ships].reverse().slice(0, 6).map((a) => <AnnotationRow key={a.id} a={a} />)}
        </ul>
      )}
      {stage.key === 'traffic' && stage.referrers?.length > 0 && (
        <table class="journey-table">
          <thead><tr><th>Source</th><th class="num">Sessions</th><th class="num">Before</th></tr></thead>
          <tbody>
            {stage.referrers.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td class="num">{formatNumber(r.value)}</td>
                <td class="num muted">{formatNumber(r.previous)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {stage.key === 'domain' && <p class="note">Checked with public RDAP, DNS and a TLS handshake every 6 hours. No registrar login needed.</p>}
      {href && <a class="btn ghost" href={href} style={{ alignSelf: 'flex-start' }}>Open the full view <Icon name="external" size={12} /></a>}
    </div>
  );
}

function AnnotationRow({ a }) {
  return (
    <li>
      <i style={{ background: kindColor(a.kind) }} aria-hidden="true" />
      <span class="muted mono">{a.date}</span>
      {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.label}</a> : <span>{a.label}</span>}
    </li>
  );
}

// Side drawer: everything Studio knows about one chart day.
export function DayDrawer({ productId, date, onClose }) {
  const data = useAsync(() => api.get(`/journey/${productId}/day/${date}`), [productId, date]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  const d = data.data;
  const title = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const empty = d && !d.annotations.length && !d.mentions.length && !d.referrers.length;
  return (
    <>
      <div class="drawer-scrim" onClick={onClose} />
      <aside class="drawer" role="dialog" aria-label={`What happened on ${title}`}>
        <header class="drawer-head">
          <div>
            <div class="small muted">What happened</div>
            <h2>{title}</h2>
          </div>
          <span class="spacer" />
          <button class="btn ghost" type="button" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>
        {data.error && <p class="note">{data.error.message}</p>}
        {!d && !data.error && <Loading height={240} />}
        {d && (
          <div class="stack">
            {d.sessions && (
              <section>
                <h3>Sessions</h3>
                <p class="drawer-big">
                  {formatNumber(d.sessions.value)}
                  <span class="muted small"> vs a typical {formatNumber(d.sessions.typical)} (7-day average)</span>
                </p>
              </section>
            )}
            {d.referrers.length > 0 && (
              <section>
                <h3>Where they came from</h3>
                <table class="journey-table">
                  <thead><tr><th>Source</th><th class="num">That day</th><th class="num">Typical</th></tr></thead>
                  <tbody>
                    {d.referrers.map((r) => (
                      <tr key={r.label} class={r.gain >= 5 && r.value >= r.previous * 2 ? 'hot' : ''}>
                        <td>{r.label}</td>
                        <td class="num">{formatNumber(r.value)}</td>
                        <td class="num muted">{formatNumber(Math.round(r.previous))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {d.mentions.length > 0 && (
              <section>
                <h3>Posts and mentions (that day and the day before)</h3>
                <ul class="journey-ships">
                  {d.mentions.map((m) => (
                    <li key={m.id}>
                      <i style={{ background: kindColor('mention') }} aria-hidden="true" />
                      <a href={m.permalink} target="_blank" rel="noreferrer">{m.title}</a>
                      <span class="muted small">{m.community ? `${m.community} · ` : ''}{m.points} pts</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.annotations.length > 0 && (
              <section>
                <h3>Shipped and noted</h3>
                <ul class="journey-ships">{d.annotations.map((a) => <AnnotationRow key={a.id} a={a} />)}</ul>
              </section>
            )}
            {empty && <p class="note">Nothing recorded that day: no deploys, releases, mentions or referrer data.</p>}
            {Object.entries(d.errors).map(([k, msg]) => <p class="note" key={k}><b>{k}:</b> {msg}</p>)}
          </div>
        )}
      </aside>
    </>
  );
}
