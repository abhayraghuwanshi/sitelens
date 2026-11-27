import { useState } from 'preact/hooks';
import { BrandIcon } from '../../components/BrandIcon.jsx';
import { Icon } from '../../components/icons.jsx';

// The parts every connection's own page is made of, top to bottom:
//   ConnectionHero  logo, name, status pill, what it gives, a link to the service
//   Gets            what you get, in a few plain lines
//   Steps           numbered setup, shown until it's connected
//   SecretField     the key: a masked "saved" row, or a field with show/hide
//   Section, Facts  titled blocks and label/value lines for the rest
// One look for all of them, so a key page isn't a bare input box.

// Sent after a key is saved or removed, so the page header's status refreshes.
export const CHANGED = 'kauzl:connection-changed';

// status: { on, warn, text } (same shape as the Connections rows).
export function ConnectionHero({ brand, name, tagline, status, link }) {
  const tone = status ? (status.warn ? 'warn' : status.on ? 'on' : 'off') : '';
  return (
    <header class="cx-hero">
      {brand ? <BrandIcon name={brand} large title={name} /> : <span class="brand-tile lg"><Icon name="plug" size={22} /></span>}
      <div class="cx-hero-text">
        <div class="cx-hero-top">
          <h2 class="cx-name">{name}</h2>
          {status && (
            <span class={`cx-pill ${tone}`}>
              <span class={`dot${status.on && !status.warn ? ' on' : ''}`} />
              {status.warn ? 'Needs attention' : status.on ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>
        {status?.text && <p class={`cx-status-line ${status.warn ? 'text-bad' : 'muted'}`}>{status.text}</p>}
        {tagline && <p class="cx-tagline">{tagline}</p>}
      </div>
      {link && <a class="btn ghost cx-open" href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>}
    </header>
  );
}

export function Gets({ items }) {
  return (
    <ul class="cx-gets">
      {items.map((t) => <li key={t}><Icon name="check" size={13} /><span>{t}</span></li>)}
    </ul>
  );
}

// items: [{ title, body?, href?, cta? }]
export function Steps({ items }) {
  return (
    <ol class="cx-steps">
      {items.map((s, i) => (
        <li key={i}>
          <span class="cx-step-n">{i + 1}</span>
          <div class="cx-step-body">
            <b>{s.title}</b>
            {s.body && <p class="small muted m-0">{s.body}</p>}
          </div>
          {s.href && <a class="btn ghost" href={s.href} target="_blank" rel="noreferrer">{s.cta || 'Open'} ↗</a>}
        </li>
      ))}
    </ol>
  );
}

export function Section({ title, sub, children, actions }) {
  return (
    <section class="cx-section">
      {(title || actions) && (
        <div class="cx-section-head">
          <div>
            {title && <h3 class="cx-h3">{title}</h3>}
            {sub && <p class="small muted m-0">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

// items: [{ label, value }] — value may be a node; empty values are skipped.
export function Facts({ items }) {
  const shown = items.filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  if (!shown.length) return null;
  return (
    <dl class="cx-facts">
      {shown.map((f) => (
        <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
      ))}
    </dl>
  );
}

// A key or token. `source` says where the saved one comes from: 'settings'
// (saved here), 'env' (.env, can't be removed here), 'oauth', or '' (none).
// onSave(value) resolves to a message (or throws); onRemove() likewise.
export function SecretField({ label, placeholder, source, envName, onSave, onRemove, busyText = 'Checking…', extra = null, canSaveEmpty = false }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const open = editing || !source;

  async function run(fn) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      setMsg({ ok: true, text: text || 'Saved.' });
      window.dispatchEvent(new Event(CHANGED));
      setValue('');
      setEditing(false);
    } catch (err) {
      setMsg({ ok: false, text: `${err.message}${err.hint ? ` ${err.hint}` : ''}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="cx-secret">
      {!open ? (
        <div class="cx-key-saved">
          <span class="cx-key-icon"><Icon name="lock" size={15} /></span>
          <div class="cx-key-text">
            <b>{label}</b>
            <span class="small muted">
              {source === 'env' ? <>From <code>{envName}</code> in .env</> : source === 'oauth' ? 'Signed in, no key needed' : 'Saved in Kauzl'} · <span class="mono">••••••••••••</span>
            </span>
          </div>
          <div class="row gap-6">
            <button class="btn ghost" type="button" disabled={busy} onClick={() => { setEditing(true); setMsg(null); }}>Replace</button>
            {source === 'settings' && onRemove && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => run(onRemove)}>Remove</button>}
          </div>
        </div>
      ) : (
        <form class="cx-key-form" onSubmit={(e) => { e.preventDefault(); run(() => onSave(value.trim())); }}>
          <label class="field m-0">{label}
            <span class="cx-key-input">
              <input type={shown ? 'text' : 'password'} class="mono" autocomplete="off" spellcheck={false} placeholder={placeholder}
                value={value} onInput={(e) => setValue(e.currentTarget.value)} />
              <button type="button" class="cx-eye" aria-label={shown ? 'Hide' : 'Show'} title={shown ? 'Hide' : 'Show'} onClick={() => setShown(!shown)}>
                <Icon name="eye" size={15} />
              </button>
            </span>
          </label>
          {extra}
          <div class="row gap-6">
            <button class="btn primary" type="submit" disabled={busy || (!value.trim() && !canSaveEmpty)}>{busy ? busyText : 'Save'}</button>
            {source && <button class="btn ghost" type="button" disabled={busy} onClick={() => { setEditing(false); setValue(''); }}>Cancel</button>}
          </div>
        </form>
      )}
      {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      {envName && source !== 'env' && <p class="small muted m-0">Or set <code>{envName}</code> in <code>.env</code> and restart Kauzl.</p>}
    </div>
  );
}
