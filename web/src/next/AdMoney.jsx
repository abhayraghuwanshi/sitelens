import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { Icon } from '../components/icons.jsx';

// Traffic → Ad money: what you spent on ads, what it brought, and what ads on
// your own site earned (server/campaigns.mjs). Google Ads spend comes from GA4
// once the property is linked; Reddit, X, Meta and LinkedIn spend is entered
// here and matched to the visits its links brought. The add/edit form takes the
// section's place rather than stacking under the list.

const PLATFORM = { google: 'Google Ads', reddit: 'Reddit Ads', x: 'X Ads', meta: 'Meta Ads', linkedin: 'LinkedIn Ads', other: 'Other' };
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const day = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function moneyFormat(currency) {
  const make = (digits) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: digits, minimumFractionDigits: 0 });
    } catch {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits });
    }
  };
  const small = make(2);
  const big = make(0);
  return (v) => (Math.abs(v || 0) >= 100 ? big : small).format(v || 0);
}

export function AdMoney({ site, d, onChanged }) {
  const [editing, setEditing] = useState(null);
  const money = moneyFormat(d.currency);
  const ads = d.ads?.linked ? d.ads.campaigns || [] : [];
  const entries = d.spend?.entries || [];
  const rows = [
    ...ads.map((a) => ({ key: `g:${a.campaign}`, platform: 'google', name: a.campaign, when: 'This period', spent: a.cost, sessions: a.sessions, keyEvents: a.keyEvents, auto: true })),
    ...entries.filter((e) => e.inPeriod).map((e) => ({ key: e.id, platform: e.platform, name: e.name, when: `${day(e.start)} – ${day(e.end)}`, spent: e.spent, sessions: e.sessions, keyEvents: e.keyEvents, entry: e })),
  ];
  const outside = entries.filter((e) => !e.inPeriod).length;
  const spent = d.money?.spent || 0;
  const visits = rows.reduce((t, r) => t + r.sessions, 0);
  const keyEvents = rows.reduce((t, r) => t + r.keyEvents, 0);
  const earned = d.earnings?.total || 0;

  if (editing) {
    return <SpendForm site={site} entry={editing === 'new' ? null : editing} currency={d.currency} onDone={(changed) => { setEditing(null); if (changed) onChanged(); }} />;
  }

  return (
    <section class="nx-block" aria-label="Ad money">
      <div class="am-head">
        <h2 class="nx-h2">Ad money <span class="muted small">· what you spent on ads, what it brought, and what ads on your site earned</span></h2>
        <button type="button" class="btn" onClick={() => setEditing('new')}><Icon name="plus" size={14} /> Add ad spend</button>
      </div>
      {!spent && !earned && !rows.length ? (
        <div class="card card-plain">
          <p class="m-0">No ad spend or ad earnings in this period. Add what you spend on Reddit, X, Meta or LinkedIn ads, and Kauzl sets it against the visits and key events those ads brought.</p>
          <Hints d={d} rows={rows} outside={outside} />
        </div>
      ) : (
      <div class="card card-plain">
        <div class="am-stats">
          <div><small>Spent on ads</small><b>{money(spent)}</b><span class="muted">{rows.length ? `${rows.length} campaign${rows.length === 1 ? '' : 's'}` : 'none this period'}</span></div>
          <div><small>It brought</small><b>{fmt(visits)} visits</b><span class="muted">{fmt(keyEvents)} key event{keyEvents === 1 ? '' : 's'}</span></div>
          <div><small>Per key event</small><b class={spent && !keyEvents ? 'bad' : ''}>{spent ? (keyEvents ? money(spent / keyEvents) : 'none yet') : '—'}</b><span class="muted">{spent && visits ? `${money(spent / visits)} a visit` : ''}</span></div>
          <div><small>Earned from ads on your site</small><b class={earned ? 'good' : ''}>{d.earnings ? money(earned) : '—'}</b>
            <span class="muted">{d.earnings && earned ? `${fmt(d.earnings.impressions)} ad views · ${fmt(d.earnings.clicks)} clicks${d.earnings.previous ? ` · ${change(earned, d.earnings.previous)}` : ''}` : 'none this period'}</span></div>
        </div>

        {rows.length > 0 && (
          <div class="am-rows">
            <div class="am-row am-th" aria-hidden="true"><span>Campaign</span><span class="nx-num">Spent</span><span class="nx-num">Visits</span><span class="nx-num">Key events</span><span>Worth it?</span><span /></div>
            {rows.map((r) => (
              <div class="am-row" key={r.key}>
                <span class="am-name"><b>{r.name}</b><small class="muted">{PLATFORM[r.platform] || r.platform} · {r.when}{r.entry?.matchedBy === 'campaign' ? ` · utm_campaign=${r.entry.campaign}` : r.entry ? ' · paid visits from this platform' : ' · from Google Ads'}</small></span>
                <span class="nx-num">{money(r.spent)}</span>
                <span class="nx-num">{fmt(r.sessions)}</span>
                <span class="nx-num">{fmt(r.keyEvents)}</span>
                <span class={r.keyEvents ? '' : r.sessions ? 'muted' : 'bad'}>{r.keyEvents ? `${money(r.spent / r.keyEvents)} per key event` : r.sessions ? 'Visits, no key events' : 'No visits found'}</span>
                <span class="am-act">{r.entry && <button type="button" class="link-btn small" onClick={() => setEditing(r.entry)}>Edit</button>}</span>
              </div>
            ))}
          </div>
        )}

        <Hints d={d} rows={rows} outside={outside} />
      </div>
      )}
    </section>
  );
}

function change(now, before) {
  const c = now / before - 1;
  return `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}% on the period before`;
}

// What's missing and how to get it, one line each.
function Hints({ d, rows, outside }) {
  const notes = [];
  const lost = (d.spend?.entries || []).filter((e) => e.inPeriod && !e.sessions);
  if (!d.ads?.linked) notes.push(<>Google Ads spend appears here by itself once this GA4 property is linked: GA4 → Admin → Product links → <b>Google Ads links</b>.</>);
  if (lost.length) notes.push(<>No visits found for {lost.map((e) => e.name).join(', ')}. Tag the ad’s links with <code>utm_campaign</code> and put the same value on the entry.</>);
  if (!d.earnings) notes.push(<>Couldn’t read ad earnings from GA4 for this property.</>);
  else if (!d.earnings.total) notes.push(<>Earnings from ads on your site (AdSense, Ad Manager) show once they’re linked: GA4 → Admin → Product links.</>);
  if (outside) notes.push(<>{outside} entr{outside === 1 ? 'y ran' : 'ies ran'} outside this period; pick a longer range to see {outside === 1 ? 'it' : 'them'}.</>);
  if (!rows.length && !notes.length) return null;
  return notes.length ? <ul class="am-hints">{notes.map((n, i) => <li key={i} class="muted small">{n}</li>)}</ul> : null;
}

function SpendForm({ site, entry, currency, onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => entry || { platform: 'reddit', name: '', campaign: '', start: today, end: today, amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/sites/${site.id}/ad-spend`, { ...form, amount: Number(form.amount) });
      onDone(true);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/sites/${site.id}/ad-spend/${entry.id}`);
      onDone(true);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <section class="nx-block" aria-label={entry ? 'Edit ad spend' : 'Add ad spend'}>
      <h2 class="nx-h2">{entry ? 'Edit ad spend' : 'Add ad spend'} <span class="muted small">· for ads GA4 can’t see the cost of: Reddit, X, Meta, LinkedIn…</span></h2>
      <form class="card card-plain am-form" onSubmit={save}>
        <div class="am-grid">
          <label class="field">Where
            <select value={form.platform} onChange={(e) => set({ platform: e.currentTarget.value })}>
              {Object.entries(PLATFORM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label class="field">Campaign name<input required maxLength={120} value={form.name} placeholder="Launch week promoted post" onInput={(e) => set({ name: e.currentTarget.value })} /></label>
          <label class="field">Started<input required type="date" value={form.start} onInput={(e) => set({ start: e.currentTarget.value, end: form.end < e.currentTarget.value ? e.currentTarget.value : form.end })} /></label>
          <label class="field">Ended<input required type="date" value={form.end} min={form.start} onInput={(e) => set({ end: e.currentTarget.value })} /></label>
          <label class="field"><span class="field-label">Spent <small>({currency || 'your GA4 currency'})</small></span><input required type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} placeholder="250" onInput={(e) => set({ amount: e.currentTarget.value })} /></label>
          <label class="field"><span class="field-label">utm_campaign on its links <small>{form.platform === 'other' ? '(needed)' : '(optional)'}</small></span>
            <input required={form.platform === 'other'} maxLength={120} value={form.campaign} placeholder="launch-week" onInput={(e) => set({ campaign: e.currentTarget.value })} />
          </label>
        </div>
        <p class="muted small m-0">{form.campaign
          ? `Visits tagged utm_campaign=${form.campaign} count toward this spend.`
          : `Without a utm_campaign, paid visits from ${PLATFORM[form.platform]?.replace(' Ads', '') || 'this platform'} (medium cpc, paid or paid_social) count toward it.`} Spend is spread evenly over the days it ran.</p>
        <label class="field"><span class="field-label">Note <small>(optional)</small></span><input maxLength={300} value={form.note} onInput={(e) => set({ note: e.currentTarget.value })} /></label>
        {error && <p class="nx-error">{error}</p>}
        <div class="am-btns">
          <button type="submit" class="btn primary" disabled={busy}>{entry ? 'Save' : 'Add'}</button>
          <button type="button" class="btn ghost" disabled={busy} onClick={() => onDone(false)}>Cancel</button>
          {entry && (confirmRemove
            ? <span class="am-confirm small">Remove this entry? <button type="button" class="link-btn" disabled={busy} onClick={remove}>Yes, remove</button> · <button type="button" class="link-btn" onClick={() => setConfirmRemove(false)}>Keep</button></span>
            : <button type="button" class="link-btn small am-remove" onClick={() => setConfirmRemove(true)}>Remove</button>)}
        </div>
      </form>
    </section>
  );
}
