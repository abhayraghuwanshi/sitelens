// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// Built-in explanations and automatic observations, so the panel answers
// "what am I looking at?" without sending anyone to the GA4 UI.

import { formatNumber, formatPercent, formatDuration, formatDelta, formatDate, plural } from './format.js';
import { countryName } from './site.js';

export const METRIC_INFO = {
  activeUsers: {
    label: 'Users',
    short: 'Distinct people who visited in the selected period.',
    help: 'GA4 counts a person once per period, even if they came back several times.',
  },
  newUsers: {
    label: 'New users',
    short: 'People who visited for the first time.',
    help: 'Based on the first time GA4 saw that user or device.',
  },
  sessions: {
    label: 'Sessions',
    short: 'Visits to the site.',
    help: 'A session starts when someone arrives and ends after 30 minutes of inactivity, at midnight, or when campaign parameters change.',
  },
  screenPageViews: {
    label: 'Views',
    short: 'Pages viewed, including repeat views.',
    help: 'One person reading three pages counts as three views but one user.',
  },
  engagementRate: {
    label: 'Engagement',
    short: 'Share of sessions that were engaged.',
    help: 'A session is engaged when it lasts 10+ seconds, has a key event, or has 2+ page views.',
  },
  averageSessionDuration: {
    label: 'Avg. session',
    short: 'Average time spent per session.',
    help: 'Total session time divided by sessions. Closing a tab can cut the final page short.',
  },
  keyEvents: {
    label: 'Key events',
    short: 'Conversions you marked as important.',
    help: 'Formerly called conversions. Counts events you flagged as key events in GA4.',
  },
  live: {
    label: 'Live now',
    short: 'Active users in the last 5 minutes.',
    help: 'GA4 realtime is property-wide unless a data stream is linked to this site.',
  },
  pageViewsShare: {
    label: 'Share of views',
    short: 'How much of the site’s traffic this page gets.',
    help: 'This page’s views ÷ all views on the site in the selected period.',
  },
};

export const GLOSSARY = [
  ['Users', 'Distinct people, counted once in the period.'],
  ['Sessions', 'Visits. One person can have many sessions.'],
  ['Views', 'Page views, including repeat views by the same person.'],
  ['Engagement rate', 'Share of sessions that lasted 10s+, had 2+ views, or a key event.'],
  ['Avg. session', 'Average session length. The last page of a visit is often undercounted.'],
  ['Key events', 'Events you marked as conversions in GA4.'],
  ['Live now', 'Active users in the last 5 minutes.'],
  [
    'AI referrals',
    'Sessions whose referrer is an AI assistant (ChatGPT, Perplexity, Claude, Gemini, Copilot). Google AI Overviews clicks still count as Google organic, so they are not included.',
  ],
  [
    'Landing page',
    'The first page of a visit. Search Console reports it per query, so you can see which URL a query earned clicks on.',
  ],
];

function pctShare(part, whole) {
  if (!whole) return 0;
  return part / whole;
}

export function buildInsights(data) {
  const insights = [];
  const { overview, trend, pages, page, channels, devices, live, openTabs, entryPages, range } = data || {};
  const current = overview?.current || {};
  const previous = overview?.previous || {};
  const siteViews = current.screenPageViews || 0;
  const siteEngagement = current.engagementRate || 0;

  const push = (priority, insight) => {
    if (insight) insights.push({ priority, ...insight });
  };

  // 1. Live traffic — the freshest, most human thing on the panel.
  if (live && live.total > 0) {
    push(100, {
      key: 'live',
      tone: 'live',
      title: `${formatNumber(live.total)} ${live.total === 1 ? 'person' : 'people'} on the site now`,
      detail: live.page
        ? `${formatNumber(live.page)} ${live.page === 1 ? 'is' : 'are'} on this page.`
        : live.scopedByStream
          ? 'Counting this site’s data stream.'
          : 'Live count is property-wide (no stream linked to this site).',
    });
  }

  // 2. This page vs. the rest of the site.
  if (page && page.views > 0) {
    if (page.engagementRate < siteEngagement * 0.7 && siteViews > 30) {
      push(92, {
        key: 'page-engagement',
        tone: 'warn',
        title: 'This page engages less than the rest of the site',
        detail: `${formatPercent(page.engagementRate)} engagement here vs ${formatPercent(siteEngagement)} site-wide. Check the intro, speed, and mobile layout.`,
      });
    } else if (page.engagementRate > siteEngagement * 1.25 && page.views >= 10) {
      push(60, {
        key: 'page-engagement-good',
        tone: 'good',
        title: 'This page holds attention well',
        detail: `${formatPercent(page.engagementRate)} engagement vs ${formatPercent(siteEngagement)} site-wide, with ${plural(page.views, 'view')}.`,
      });
    }
  } else if (page && siteViews > 50) {
    push(55, {
      key: 'page-empty',
      tone: 'warn',
      title: 'No GA4 views recorded for this page',
      detail: `Nothing matched ${page.path} in ${range?.title || 'this period'}. The URL may differ in GA4, or this page may not be tagged.`,
    });
  }

  // 3. Session trend vs previous period.
  const sessionsDelta = formatDelta(current.sessions, previous.sessions);
  if (sessionsDelta.pct !== null && Math.abs(sessionsDelta.pct) >= 0.05) {
    push(85, {
      key: 'trend',
      tone: sessionsDelta.direction === 'up' ? 'good' : 'warn',
      title: `Sessions ${sessionsDelta.direction === 'up' ? 'up' : 'down'} ${sessionsDelta.label}`,
      detail: `${formatNumber(current.sessions)} this period vs ${formatNumber(previous.sessions)} the period before.`,
    });
  }

  // 4. Traffic concentration on one page.
  if (pages?.length && siteViews > 30) {
    const top = pages[0];
    const share = pctShare(top.views, siteViews);
    if (share >= 0.3) {
      push(70, {
        key: 'concentration',
        tone: 'info',
        title: `${formatPercent(share, 0)} of all views land on one page`,
        detail: `${top.path} gets ${plural(top.views, 'view')}. Worth testing a clearer next step from there.`,
      });
    }
  }

  // 5. Channel mix.
  if (channels?.length && current.sessions > 20) {
    const total = channels.reduce((acc, row) => acc + row.sessions, 0) || 1;
    const top = channels[0];
    const share = top.sessions / total;
    if (share >= 0.55) {
      push(62, {
        key: 'channel',
        tone: 'info',
        title: `${top.channel} drives ${formatPercent(share, 0)} of sessions`,
        detail: `${formatNumber(top.sessions)} of ${formatNumber(total)} sessions. A single-channel dependency is worth watching.`,
      });
    }
  }

  // 6. Mobile share.
  if (devices?.length && current.sessions > 20) {
    const total = devices.reduce((acc, row) => acc + row.sessions, 0) || 1;
    const mobile = devices.find((row) => row.device.toLowerCase() === 'mobile');
    if (mobile && mobile.sessions / total >= 0.55) {
      push(50, {
        key: 'mobile',
        tone: 'info',
        title: `${formatPercent(mobile.sessions / total, 0)} of sessions are mobile`,
        detail: `${formatNumber(mobile.sessions)} mobile sessions at ${formatPercent(mobile.engagementRate)} engagement. Preview on a phone before shipping layout changes.`,
      });
    }
  }

  // 7. Best day in the trend.
  if (trend?.length >= 4) {
    const best = trend.reduce((acc, row) => (row.activeUsers > acc.activeUsers ? row : acc), trend[0]);
    if (best.activeUsers > 0) {
      push(35, {
        key: 'best-day',
        tone: 'info',
        title: `Busiest day: ${formatDate(best.date)}`,
        detail: `${plural(best.activeUsers, 'user')} and ${plural(best.screenPageViews, 'view')} that day.`,
      });
    }
  }

  // 8. A weak landing page.
  if (entryPages?.length) {
    const weak = entryPages.find(
      (row) => row.sessions >= 25 && row.engagementRate > 0 && row.engagementRate < 0.35,
    );
    if (weak) {
      push(48, {
        key: 'weak-landing',
        tone: 'warn',
        title: 'A busy landing page is not engaging',
        detail: `${weak.path} starts ${plural(weak.sessions, 'session')} but only ${formatPercent(weak.engagementRate)} engage.`,
      });
    }
  }

  // 9. Open tabs, linked to page performance.
  if (openTabs?.length) {
    const matched = openTabs.filter((tab) => tab.metrics?.views > 0);
    if (matched.length) {
      const top = matched.sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0))[0];
      push(40, {
        key: 'tabs',
        tone: 'neutral',
        title: `${plural(openTabs.length, 'open tab')} on this site`,
        detail: `${top.path} has ${plural(top.metrics.views, 'view')} in ${range?.title?.toLowerCase() || 'this period'}. Click it under Open tabs to jump over.`,
      });
    }
  }

  // 10. New vs returning context.
  if (current.activeUsers > 30 && current.newUsers > 0) {
    const share = current.newUsers / current.activeUsers;
    if (share >= 0.75) {
      push(28, {
        key: 'new-users',
        tone: 'neutral',
        title: `${formatPercent(share, 0)} of users are new`,
        detail: 'Great for reach, but returning users are usually cheaper to convert.',
      });
    }
  }

  return insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(({ priority, ...insight }) => insight);
}

export function buildPageSummary(page, siteViews) {
  if (!page) return null;
  const share = siteViews ? page.views / siteViews : 0;
  return {
    ...page,
    share,
    shareLabel: formatPercent(share, 0),
    avgDurationLabel: formatDuration(page.avgDuration),
    engagementLabel: formatPercent(page.engagementRate),
  };
}

export function topCountryLabel(rows) {
  if (!rows?.length) return '—';
  return countryName(rows[0].country);
}
