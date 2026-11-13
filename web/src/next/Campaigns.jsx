import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { taggedLink, slug, UTM_SOURCES } from '../../../shared/utm.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Delta, KpiStrip } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// Campaigns (server/campaigns.mjs): which tagged links (utm_campaign) bring
// visits and results, every source / medium, Google Ads spend when the GA4
// property is linked, and a builder for the next tagged link.
export function Campaigns({ site, range }) {
  const data = useAsync(() => api.get(`/sites/${site.id}/campaigns${qs({ range })}`), [site.id, range]);
  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  const d = data.data;
  if (d.needsGa4) {
    return <Card title="Campaigns"><p class="muted" style={{ margin: 0 }}>Campaigns come from Google Analytics. Connect a GA4 property for {site.label} in <a href={`#/site/${site.id}/setup`}>its settings</a>.</p></Card>;
  }
  return (
    <>
      <KpiStrip items={[
        { label: 'Visits', value: formatNumber(d.totals.sessions) },
        { label: 'From tagged links', value: formatNumber(d.totals.tagged), meta: `${formatPercent(d.totals.taggedShare, 0)} of visits` },
        { label: 'Campaigns', value: formatNumber(d.campaigns.filter((c) => c.sessions).length) },
        ...(d.ads.linked ? [{ label: 'Google Ads spend', value: formatDecimal(d.ads.cost, 2) }] : []),
      ]} />
      <CampaignTable data={d} />
      <LinkBuilder site={site} />
      <SourceTable data={d} />
      <AdsCard ads={d.ads} />
    </>
  );
}

const rate = (part, whole) => (whole ? formatPercent(part / whole, 0) : '—');

function CampaignTable({ data }) {
  const [open, setOpen] = useState('');
  const { campaigns, goals } = data;
  if (!campaigns.length) {
    return (
      <Card title="Tagged campaigns" sub="Visits that came through a link with utm_campaign">
        <p class="muted" style={{ margin: 0 }}>No tagged links brought visits in this range. Share links made with the builder below and each one shows up here with what it brought.</p>
      </Card>
    );
  }
  const result = (g) => (goals.length ? goals.reduce((t, x) => t + (g.goals?.[x.id] || 0), 0) : g.keyEvents);
  return (
    <Card title="Tagged campaigns" sub={`Visits and ${goals.length ? goals.map((g) => g.label.toLowerCase()).join(', ') : 'key events'} per utm_campaign. Open one for its sources and variants.`} flush>
      <div class="table-wrap">
        <table class="data cmp-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th class="num">Visits</th>
              <th class="num" title="Share of visits that engaged">Engaged</th>
              {goals.length ? goals.map((g) => <th key={g.id} class="num">{g.label}</th>) : <th class="num" title="GA4 key events">Key events</th>}
              <th class="num" title="Results per 100 visits">Rate</th>
              <th class="num" title="First day it brought visits, in the last 90 days">Started</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const isOpen = open === c.campaign;
              return [
                <tr key={c.campaign} class={`clickable${isOpen ? ' selected' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : c.campaign)}>
                  <td class="cmp-name">
                    <Icon name="chevron" size={12} class={`cmp-chev${isOpen ? ' open' : ''}`} />
                    <span class="cmp-stack">
                      <code>{c.campaign}</code>
                      <span class="cmp-via">{[...new Set(c.parts.map((p) => p.source))].slice(0, 4).join(' · ')}</span>
                    </span>
                  </td>
                  <td class="num" data-label="Visits">{formatNumber(c.sessions)} <Delta current={c.sessions} previous={c.previous} /></td>
                  <td class="num" data-label="Engaged">{rate(c.engaged, c.sessions)}</td>
                  {goals.length
                    ? goals.map((g) => <td key={g.id} class="num" data-label={g.label}>{formatNumber(c.goals[g.id] || 0)}</td>)
                    : <td class="num" data-label="Key events">{formatNumber(c.keyEvents)}</td>}
                  <td class="num" data-label="Rate">{rate(result(c), c.sessions)}</td>
                  <td class="num muted" data-label="Started">{c.firstDay ? shortDay(c.firstDay) : 'before'}</td>
                </tr>,
                isOpen && c.parts.map((p) => (
                  <tr key={`${c.campaign}|${p.source}|${p.medium}|${p.content}`} class="cmp-part">
                    <td class="cmp-name"><span class="small">{p.source} / {p.medium}{p.content && <span class="muted"> · {p.content}</span>}</span></td>
                    <td class="num" data-label="Visits">{formatNumber(p.sessions)}</td>
                    <td class="num" data-label="Engaged">{rate(p.engaged, p.sessions)}</td>
                    {goals.length
                      ? goals.map((g) => <td key={g.id} class="num" data-label={g.label}>{formatNumber(p.goals[g.id] || 0)}</td>)
                      : <td class="num" data-label="Key events">{formatNumber(p.keyEvents)}</td>}
                    <td class="num" data-label="Rate">{rate(result(p), p.sessions)}</td>
                    <td />
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SourceTable({ data }) {
  const [all, setAll] = useState(false);
  const rows = all ? data.sources : data.sources.slice(0, 12);
  if (!rows.length) return null;
  return (
    <Card title="Where visits come from" sub="Every source and medium, tagged or not" flush>
      <div class="table-wrap">
        <table class="data cmp-table">
          <thead><tr><th>Source / medium</th><th class="num">Visits</th><th class="num">Share</th><th class="num">Engaged</th><th class="num">Key events</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={`${s.source}|${s.medium}`}>
                <td class="cmp-name"><span>{s.source} <span class="muted">/ {s.medium}</span></span></td>
                <td class="num" data-label="Visits">{formatNumber(s.sessions)} <Delta current={s.sessions} previous={s.previous} /></td>
                <td class="num" data-label="Share">{formatPercent(s.share, 0)}</td>
                <td class="num" data-label="Engaged">{rate(s.engaged, s.sessions)}</td>
                <td class="num" data-label="Key events">{formatNumber(s.keyEvents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.sources.length > 12 && (
        <button type="button" class="btn ghost" style={{ margin: '8px 16px' }} onClick={() => setAll(!all)}>{all ? 'Show the top 12' : `Show all ${data.sources.length}`}</button>
      )}
    </Card>
  );
}

function AdsCard({ ads }) {
  if (!ads.linked) {
    return (
      <Card title="Google Ads" sub="Spend and results per ad campaign">
        <p class="muted small" style={{ margin: 0 }}>
          This GA4 property isn’t linked to Google Ads, so there’s no ad spend to show. Link them in GA4 (Admin → Product links → Google Ads)
          and each ad campaign’s cost, clicks and key events appear here. Ads elsewhere (Meta, LinkedIn, Reddit) show up in the tables above when their links carry utm tags.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Google Ads" sub="Whole GA4 property; cost in its currency" flush>
      <div class="table-wrap">
        <table class="data cmp-table">
          <thead><tr><th>Ad campaign</th><th class="num">Cost</th><th class="num">Clicks</th><th class="num">Visits</th><th class="num">Key events</th><th class="num">Cost / key event</th></tr></thead>
          <tbody>
            {ads.campaigns.map((a) => (
              <tr key={a.campaign}>
                <td class="cmp-name"><span>{a.campaign}</span></td>
                <td class="num" data-label="Cost">{formatDecimal(a.cost, 2)}</td>
                <td class="num" data-label="Clicks">{formatNumber(a.clicks)}</td>
                <td class="num" data-label="Visits">{formatNumber(a.sessions)}</td>
                <td class="num" data-label="Key events">{formatNumber(a.keyEvents)}</td>
                <td class="num" data-label="Per key event">{a.costPerKeyEvent === null ? <span class="cmp-warn">none yet</span> : formatDecimal(a.costPerKeyEvent, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const SOURCES = Object.entries(UTM_SOURCES).filter(([, v]) => v).map(([, v]) => v);
const MEDIUMS = ['social', 'email', 'referral', 'cpc', 'partner', 'video'];

// A link to one of this site's pages with utm tags, so its visits land in the table above.
function LinkBuilder({ site }) {
  const [form, setForm] = useState({ url: `https://${site.host}/`, source: '', medium: 'social', campaign: '', content: '' });
  const [copied, setCopied] = useState(false);
  const set = (patch) => { setForm({ ...form, ...patch }); setCopied(false); };
  let link = '';
  let error = '';
  try {
    link = form.url && form.source && form.campaign ? taggedLink(form) : '';
  } catch (err) {
    error = err.message;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Card title="Make a tagged link" sub="Share this instead of the bare URL, and its visits are counted exactly">
      <div class="cmp-form">
        <label class="field cmp-wide">Page
          <input type="url" value={form.url} onInput={(e) => set({ url: e.currentTarget.value })} />
        </label>
        <label class="field">Source
          <input value={form.source} list="cmp-sources" placeholder="newsletter, reddit" onInput={(e) => set({ source: e.currentTarget.value })} onBlur={(e) => set({ source: slug(e.currentTarget.value) })} />
          <datalist id="cmp-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label class="field">Medium
          <select value={form.medium} onChange={(e) => set({ medium: e.currentTarget.value })}>{MEDIUMS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        </label>
        <label class="field">Campaign
          <input value={form.campaign} placeholder="launch-week" onInput={(e) => set({ campaign: e.currentTarget.value })} onBlur={(e) => set({ campaign: slug(e.currentTarget.value) })} />
        </label>
        <label class="field"><span class="field-label">Variant <small>optional</small></span>
          <input value={form.content} placeholder="header-button" onInput={(e) => set({ content: e.currentTarget.value })} />
        </label>
      </div>
      {link ? (
        <div class="cmp-link">
          <code class="mono small">{link}</code>
          <button class="btn primary" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      ) : (
        <p class="small muted" style={{ margin: '12px 0 0' }}>{error || 'Name the source and the campaign. Names are lowercased with dashes, so “Launch Week” and “launch-week” don’t split into two rows.'}</p>
      )}
    </Card>
  );
}

function shortDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
