import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { BrandIcon } from '../../components/BrandIcon.jsx';

// Analytics sources beyond Google, in "Your site": each one connected once in
// Integrations, then matched to this site here. Matches are keyed by the site's
// id, so a new site's picks are saved right after the site itself (saveSourcePicks).
export const SOURCES = [
  { key: 'plausible', name: 'Plausible', what: 'Visitors, pageviews, bounce rate and goals.', list: (d) => (d.sites || []).map((x) => x.domain), current: (m) => m.siteId, body: (v) => ({ plausibleSite: v }), ready: (i) => Boolean(i?.source) },
  { key: 'posthog', name: 'PostHog', what: 'Visitors, sessions, top pages and conversions.', list: (d) => (d.sites || []).map((x) => x.host), current: (m) => m.siteId, body: (v) => ({ posthogSite: v }), ready: (i) => Boolean(i?.source && i?.projectId) },
  { key: 'cloudflare', name: 'Cloudflare Web Analytics', what: 'Privacy-first visits, top pages and referrers.', list: () => null, current: (m) => m.siteTag, body: (v) => ({ siteTag: v }), ready: (i) => Boolean(i?.source && i?.accountId) },
];

const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '');

export function MoreAnalyticsSources({ siteId, host, picks, onPick }) {
  const integrations = useAsync(() => api.get('/integrations').catch(() => ({})), []);
  const lists = useAsync(async () => {
    const info = integrations.data || {};
    const out = {};
    await Promise.all(SOURCES.filter((s) => s.ready(info[s.key])).map(async (s) => {
      out[s.key] = await api.get(`/${s.key}/sites`).catch(() => null);
    }));
    return out;
  }, [integrations.data]);
  if (!integrations.data) return null;
  return SOURCES.map((s) => {
    const ready = s.ready(integrations.data[s.key]);
    const data = lists.data?.[s.key];
    const options = data ? s.list(data) : null;
    const matched = data?.matches?.find((m) => m.id === siteId);
    // What the form shows: the user's pick, else this site's saved match, else the account's site with this address.
    const guess = options?.find((o) => bare(o) === bare(host)) || '';
    const value = picks[s.key] ?? (matched ? s.current(matched) || '' : guess);
    return (
      <section key={s.key} class="an-src">
        <div class="an-src-id">
          <BrandIcon name={s.key} />
          <div>
            <b>{s.name}</b>
            <small>{s.what}</small>
            <span class={`an-pill${ready && value ? ' on' : ''}`}>{!ready ? 'Not connected' : value ? 'Connected' : 'Optional'}</span>
          </div>
        </div>
        <div class="an-src-fields">
          {!ready ? (
            <p class="small muted m-0">Connect {s.name} once in Integrations, then pick this site’s data here. <a href={`#/account?i=${s.key}`}>Connect {s.name}</a></p>
          ) : options ? (
            <label class="field">Site in {s.name}
              <select value={value} onChange={(e) => onPick(s.key, e.currentTarget.value)}>
                <option value="">Not in {s.name}</option>
                {value && !options.includes(value) && <option value={value}>{value}</option>}
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          ) : (
            <label class="field">Site tag
              <input class="mono" value={value} placeholder="From Web Analytics → Manage site" onInput={(e) => onPick(s.key, e.currentTarget.value.trim())} />
              <small>Leave blank to skip. Kauzl reads this site’s visits from Cloudflare by its tag.</small>
            </label>
          )}
        </div>
      </section>
    );
  });
}

// After the site is saved: store each source the user picked or changed, for this site's id.
export async function saveSourcePicks(siteId, picks) {
  for (const s of SOURCES) {
    if (picks[s.key] === undefined) continue;
    await api.post(`/${s.key}/match`, { siteId, ...s.body(picks[s.key]) });
  }
}
