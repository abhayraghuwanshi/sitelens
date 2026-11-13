import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Delta } from '../components/ui.jsx';

const STATUS = {
  top: { text: 'Top 3', cls: 'good' },
  page1: { text: 'Page 1', cls: '' },
  page2: { text: 'Page 2', cls: '' },
  far: { text: 'Past page 2', cls: 'bad' },
  unseen: { text: 'Not shown', cls: 'bad' },
};
const pos = (p) => (p == null ? '—' : formatDecimal(p, 1));

// Google › Topics: each topic in search: topics of the site's .sitelens.yml,
// with its target queries and what's in the way (server/search-topics.mjs).
export function SearchTopics({ site, range }) {
  const data = useAsync((o) => api.get(`/sites/${site.id}/search-topics${qs({ range, fresh: o?.fresh })}`), [site.id, range]);
  const [open, setOpen] = useState('');
  const setup = `#/site/${site.id}/setup`;

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={180} />;
  const { topics } = data.data;

  if (!topics.length) {
    return (
      <Card title="Topics" sub="What the site wants to be found for">
        <p class="note" style={{ margin: 0 }}>
          Add topics in the site’s settings (each with the page that should rank and the queries it should win), and this shows how each one does,
          which page Google really ranks, and which targets it never shows.{' '}
          <a href={setup}>Add topics</a>
        </p>
      </Card>
    );
  }

  return (
    <Card title="Topics" sub="From the site’s repo file · click a topic for its target queries" flush>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Topic</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">Pos.</th>
              <th class="num" title="Share of the topic’s impressions that land on the page set for it">On its page</th>
              <th>In the way</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => {
              const problems = [
                t.issues.wrongPage.length && `${t.issues.wrongPage.length} on another page`,
                t.issues.split.length && `${t.issues.split.length} split`,
                t.issues.unseen.length && `${t.issues.unseen.length} target${t.issues.unseen.length === 1 ? '' : 's'} not shown`,
              ].filter(Boolean);
              return (
                <Fragment key={t.name}>
                  <tr class={`clickable${open === t.name ? ' selected' : ''}`} onClick={() => setOpen(open === t.name ? '' : t.name)} aria-expanded={open === t.name}>
                    <td>
                      <b>{t.name}</b>
                      {t.page && <div class="small muted"><code>{t.page}</code></div>}
                    </td>
                    <td class="num">{formatNumber(t.clicks)} <Delta current={t.clicks} previous={t.previous.clicks} /></td>
                    <td class="num">{formatNumber(t.impressions)} <Delta current={t.impressions} previous={t.previous.impressions} /></td>
                    <td class="num">{pos(t.position)}</td>
                    <td class="num">{t.ownShare == null ? '—' : formatPercent(t.ownShare, 0)}</td>
                    <td class="small">{problems.length ? problems.join(' · ') : <span class="muted">Nothing</span>}{t.potential > 0 && <div class="muted">Top 3 for its targets: about +{formatNumber(t.potential)} clicks</div>}</td>
                  </tr>
                  {open === t.name && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--surface-2)' }}>
                        <TopicDetail t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="note" style={{ margin: '8px 16px 12px' }}>
        Queries go to the first topic that matches, after Brand, the same as on Demand. “About +N clicks” uses a generic CTR-by-position curve: a way to rank the work, not a forecast.{' '}
        <a href={setup}>Change topics</a>
      </p>
    </Card>
  );
}

function TopicDetail({ t }) {
  return (
    <div class="stack" style={{ gap: '10px' }}>
      {t.targets.length > 0 && (
        <table class="data">
          <thead><tr><th>Target query</th><th>Where</th><th class="num">Pos.</th><th class="num">Impr.</th><th class="num">Clicks</th><th>Page Google ranks</th></tr></thead>
          <tbody>
            {t.targets.map((x) => (
              <tr key={x.query}>
                <td class="cell-path">{x.query}</td>
                <td><span class={`chip ${STATUS[x.status].cls}`}>{STATUS[x.status].text}</span></td>
                <td class="num">{pos(x.position)}</td>
                <td class="num">{x.impressions == null ? '—' : formatNumber(x.impressions)}</td>
                <td class="num">{x.clicks == null ? '—' : formatNumber(x.clicks)}</td>
                <td class="small">
                  {x.page ? <code>{x.page}</code> : <span class="muted">—</span>}
                  {x.wrongPage && <span style={{ color: 'var(--critical-ink)' }}> · not {t.page}</span>}
                  {x.potential > 0 && <span class="muted"> · top 3 ≈ +{formatNumber(x.potential)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul class="note" style={{ margin: 0, paddingLeft: '18px' }}>
        {t.issues.wrongPage.map((w) => (
          <li key={`w:${w.query}`}>“{w.query}” ({formatNumber(w.impressions)} impr.) ranks <code>{w.page}</code>, not <code>{t.page}</code>. Link to {t.page} from there, or make {t.page} answer it.</li>
        ))}
        {t.issues.split.map((s) => (
          <li key={`s:${s.query}`}>“{s.query}” is split between {s.pages.map((p, i) => <Fragment key={p}>{i ? ' and ' : ''}<code>{p}</code></Fragment>)}, so neither ranks as well as one would.</li>
        ))}
        {t.issues.unseen.length > 0 && (
          <li>Google never showed the site for {t.issues.unseen.map((q) => `“${q}”`).join(', ')}. That usually needs a page that targets it in its title and headings.</li>
        )}
        {t.pages.length > 0 && (
          <li>Pages Google ranks for this topic: {t.pages.map((p, i) => <Fragment key={p.path}>{i ? ', ' : ''}<code>{p.path}</code> {formatPercent(p.share, 0)}</Fragment>)}.</li>
        )}
        {!t.queries && <li>No query in this range matched the topic.</li>}
      </ul>
    </div>
  );
}
