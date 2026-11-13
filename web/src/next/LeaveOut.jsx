import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';

// The site Edit page's "Left out" card: the countries whose unengaged visits a site leaves
// out of its BigQuery views (Story 4, Sessions, Paths, Funnels, Retention).
// GA4's own reports can't drop single visits, so the Story notes them instead.
export function LeaveOut({ site, onSaved }) {
  const rule = site.leaveOut || { countries: [], unengagedOnly: true };
  const [countries, setCountries] = useState(rule.countries.join(', '));
  const [unengagedOnly, setUnengagedOnly] = useState(rule.unengagedOnly !== false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const count = useAsync(() => (rule.countries.length ? api.get(`/sites/${site.id}/warehouse/left-out${qs({ range: '28d' })}`).catch(() => null) : null), [site.id, rule.countries.join(), rule.unengagedOnly]);

  if (!site.modes?.warehouse) return null;
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.post(`/sites/${site.id}/leave-out`, { countries: countries.split(',').map((c) => c.trim()).filter(Boolean), unengagedOnly });
      setMessage('Saved. Every BigQuery view now uses it.');
      onSaved?.();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form class="nx-card" onSubmit={save} aria-labelledby="leave-out-h">
      <div class="nx-section-head"><h2 class="nx-h2" id="leave-out-h">Left out</h2>
        {count.data && <span class="muted small">{count.data.leftOut} of {count.data.total} visits in the last 28 days</span>}
      </div>
      <p class="muted m-0">Visits that look like bots, left out of every view that reads BigQuery. GA4’s own numbers can’t drop single visits; the Story says how many they still include.</p>
      <label class="field">
        <span>Countries, as GA4 names them</span>
        <input id="leave-out-countries" value={countries} onInput={(e) => setCountries(e.currentTarget.value)} placeholder="Singapore, China" />
      </label>
      <label class="nx-check">
        <input id="leave-out-unengaged" type="checkbox" checked={unengagedOnly} onChange={(e) => setUnengagedOnly(e.currentTarget.checked)} />
        <span>Only visits GA4 didn’t count as engaged, so real readers there still count</span>
      </label>
      <div class="nx-action-row items-center">
        <button type="submit" class="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {message && <span class="muted small" role="status">{message}</span>}
      </div>
    </form>
  );
}

// The Story's line under the period: what the rule removed from the BigQuery
// parts, and that GA4-based numbers still include it.
export function LeftOutLine({ site, range }) {
  const rule = site.leaveOut;
  const on = Boolean(site.modes?.warehouse && rule?.countries?.length);
  const count = useAsync(() => (on ? api.get(`/sites/${site.id}/warehouse/left-out${qs({ range })}`).catch(() => null) : null), [site.id, range, on]);
  if (!on || !count.data?.leftOut) return null;
  const r = count.data.range;
  const since = r?.firstDay && r.firstDay > r.start ? ` since ${Number(r.firstDay.slice(6))} ${new Date(`${r.firstDay.slice(0, 4)}-${r.firstDay.slice(4, 6)}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}` : '';
  return (
    <p class="nx-leftout">
      <span>Left out: <b>{count.data.leftOut}</b> bot-like visits{since} ({rule.countries.join(', ')}{rule.unengagedOnly !== false ? ', not engaged' : ''}) from the BigQuery parts. Sections 1–3 come from GA4 and still include them.</span>
      <a href={`#/site/${site.id}/setup`}>Rule</a>
    </p>
  );
}
