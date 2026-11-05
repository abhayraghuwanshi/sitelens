import { Card, humanBytes } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { EXPLORE, tabHref } from '../stages.js';

// Explore: the tools that query the site's GA4 BigQuery export directly, for
// questions the journey pages don't answer. Each runs only when opened, behind
// the site's scan cap.
export function ExploreHome({ site }) {
  const ready = site.modes.warehouse;
  return (
    <>
      {!ready && (
        <p class="journey-summary warn">
          <span class="status-dot warn" aria-hidden="true" />
          <span>
            These tools read the GA4 BigQuery export, which isn’t connected for this site.{' '}
            <a href={`#/settings?tab=sites&edit=${site.id}`}>Connect it</a> (it’s free to turn on in GA4 Admin → BigQuery links), or try them on the demo site.
          </span>
        </p>
      )}
      <ol class="stage-cards explore-cards">
        {EXPLORE.tabs.map((t) => (
          <li key={t.view}>
            <a class={`journey-step stage-card${ready ? '' : ' off'}`} href={tabHref(t, site)}>
              <span class="journey-head">
                <Icon name={t.icon} size={13} />
                {t.label}
                {!ready && <Icon name="lock" size={11} />}
                <Icon name="chevron" size={12} />
              </span>
              <span class="journey-line">{t.about}</span>
            </a>
          </li>
        ))}
      </ol>
      {ready && (
        <Card title="What it costs" sub="BigQuery bills by data scanned">
          <ul class="checks">
            <li class="ok">Every query is dry-run first. Anything over this site’s cap of <b>{site.demo ? 'n/a' : humanBytes(site.bq?.maxBytes || 5e9)}</b> is refused before it runs.</li>
            <li class="ok">Results are cached for an hour, and BigQuery doesn’t charge for repeating an identical query.</li>
            <li class={site.bq?.sessionsTable || site.demo ? 'ok' : ''}>
              {site.demo ? 'The demo site runs on generated data, so nothing is billed.' : site.bq?.sessionsTable
                ? <>Paths, Funnels, Retention and Sessions read the sessions rollup <code>{site.bq.sessionsTable}</code>, which scans far less.</>
                : <>Build a sessions rollup in <a href={`#/settings?tab=sites&edit=${site.id}`}>the site’s settings</a> to scan 10–50× less for Paths, Funnels, Retention and Sessions.</>}
            </li>
          </ul>
        </Card>
      )}
    </>
  );
}
