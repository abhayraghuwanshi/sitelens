// A goal per page: what the page is for, whether it's doing that today, and
// the next realistic target, one rung up from where it is, not "rank #1".
//
// Purposes (guessed from the page, changeable):
//  - search:  bring visitors from search. Rungs for its main search: get shown →
//             page 2 (top 20) → page 1 (top 10) → top 3 → the clicks that
//             position usually earns → rank for its next search.
//  - convert: turn visitors into users (the product's outcome goals, from
//             Outcomes): reach the site's average rate, then half as much again.
//  - help:    answer people (docs, guides): reach the site's typical engagement.
// Gains use a generic click-rate-by-position curve: a way to size a target,
// not a forecast. Targets are judged per month and checked after the weeks a
// change usually takes to show (rankings ~6, a title ~3, the page itself ~4).
//
// A goal you set is kept in studio.json `pageGoals[siteId][path]` =
// { purpose?, target?: { key, title, metric, from, to, query?, checkBy, setAt } }
// and its progress is read from the same numbers each time.

import { expectedCtr } from '../shared/sitelens/gsc.js';

const DAY = 86_400_000;
export const PURPOSES = {
  search: 'Bring visitors from search',
  convert: 'Turn visitors into users',
  help: 'Help people who arrive',
};
const HELP = /^\/(?:docs?|help|guide|guides|faq|support|kb|manual|tutorials?)(?:\/|$)/i;
const PRODUCT = /^\/(?:$|download|downloads|install|pricing|features?|get|signup|sign-up|start|try|product|app)(?:[/.-]|$)/i;
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (v, d = 0) => `${(Math.round((v || 0) * 100 * 10 ** d) / 10 ** d).toFixed(d)}%`;
// "about 12", or "almost no" below one: never "about 0".
const aboutN = (v) => (v < 0.5 ? 'almost no' : `about ${fmt(v)}`);
const timesMonth = (v) => (v < 0.5 ? 'less than once a month' : `about ${fmt(v)} time${Math.round(v) === 1 ? '' : 's'} a month`);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function guessPurpose(row, { converts = false } = {}) {
  if (HELP.test(row.path || '')) return 'help';
  if (converts && PRODUCT.test(row.path || '')) return 'convert';
  return 'search';
}

// The search the page is mostly shown for (most impressions), with its numbers.
function mainSearch(row) {
  const qs = (row.google?.queries || []).filter((q) => q.query);
  return qs.slice().sort((a, b) => (b.impressions || 0) - (a.impressions || 0))[0] || null;
}

// One step up for one search, with what it's worth in clicks a month; null
// when it's already near the top and clicked as often as that usually earns.
function climb(subject, { perMonth, today }) {
  const pos = subject.position || 0;
  const ctr = subject.impressions ? (subject.clicks || 0) / subject.impressions : 0;
  const monthly = (subject.impressions || 0) * perMonth;
  const clicksNow = (subject.clicks || 0) * perMonth;
  const about = subject.query ? ` for “${subject.query}”` : '';
  const at = (p) => monthly * expectedCtr(p);
  const better = `Cover what the pages above it cover for “${subject.query || 'its main search'}”: answer it in the first screen, add the sections they have and it lacks, and link to it from your pages that already rank.`;
  const rung = (key, to, title, how) => ({
    key, metric: 'position', query: subject.query || '', from: Math.round(pos * 10) / 10, to, title, how,
    why: `Now around position ${pos.toFixed(1)}${about}, shown ${timesMonth(monthly)} with ${aboutN(clicksNow)} clicks.`,
    gainValue: Math.max(0, at(to) - clicksNow),
    gain: `about ${fmt(Math.max(0, at(to) - clicksNow))} more clicks a month (${fmt(at(to))} at position ${to})`,
    checkBy: addDays(today, 42),
  });
  if (pos > 20) return rung('search:page2', 20, `Reach page 2 (top 20)${about}`, better);
  if (pos > 10.5) return rung('search:page1', 10, `Reach page 1 (top 10)${about}`, better);
  if (pos > 3.5) return rung('search:top3', 3, `Reach the top 3${about}`, `${better} Small wins count here: a clearer title, an up-to-date year, a comparison table.`);
  const usual = expectedCtr(pos);
  if (ctr >= usual * 0.7) return null;
  return {
    key: 'search:ctr', metric: 'ctr', query: subject.query || '', from: Math.round(ctr * 1000) / 1000, to: Math.round(usual * 1000) / 1000,
    title: `Win the click${about}`,
    why: `Already near the top (position ${pos.toFixed(1)}), but ${pct(ctr, 1)} click where that position usually gets about ${pct(usual)}.`,
    how: `Rewrite the title and description to promise exactly what “${subject.query || 'the search'}” asks, with a concrete benefit or number.`,
    gainValue: Math.max(0, monthly * usual - clicksNow),
    gain: `about ${fmt(Math.max(0, monthly * usual - clicksNow))} more clicks a month`, checkBy: addDays(today, 21),
  };
}

// The next goal for a search page: the step up worth the most clicks among its
// searches; a real search to aim at when none is worth climbing. Pure.
function searchGoal(row, { perMonth, today }) {
  const g = row.google;
  const impressions = g?.impressions || 0;
  if (!impressions) {
    return {
      key: 'search:shown', metric: 'impressions', from: 0, to: Math.round(100 / perMonth) || 100,
      title: 'Get it shown in search',
      why: 'Google hasn’t shown it for any search yet.',
      how: 'Check it’s indexed (Check index status below), make sure the sitemap lists it, link to it from a page that already gets visits, and request indexing in Search Console.',
      gain: 'Any search visits at all', checkBy: addDays(today, 28),
    };
  }
  const queries = (g.queries || []).filter((q) => q.query);
  const steps = (queries.length ? queries : [{ query: '', impressions, clicks: g.clicks, position: g.position }])
    .map((q) => climb(q, { perMonth, today }))
    .filter(Boolean)
    .sort((a, b) => b.gainValue - a.gainValue);
  const best = steps[0];
  if (best && best.gainValue >= 3) return best;
  const earning = (g.clicks || 0) * perMonth >= 30;
  if (!best && !earning && impressions * perMonth >= 50) {
    return { key: 'search:hold', metric: 'clicks', from: g.clicks, to: g.clicks, title: 'Hold its place', why: 'Near the top for its searches and clicked as often as that usually earns.', how: 'Keep it current: refresh facts and the year once a quarter, and add a section for the next search people ask.', gain: 'Keeps what it earns', checkBy: addDays(today, 90) };
  }
  // Even one step up wouldn't bring visitors: the searches it's shown for are too small.
  const main = mainSearch(row);
  const clicksMonth = (g.clicks || 0) * perMonth;
  if (earning) {
    return {
      key: 'search:bigger', metric: 'impressions', from: impressions, to: Math.round(impressions * 1.5),
      title: 'Go after a bigger search',
      why: `It already brings about ${fmt(clicksMonth)} search clicks a month, and its searches are near their ceiling: one step up adds ${aboutN(best?.gainValue || 0)} clicks.`,
      how: 'Find a related search with more volume (Search → Search volume), add a section that answers it with those words in a heading, and link to it from related pages.',
      gain: 'half as many impressions again', checkBy: addDays(today, 42),
    };
  }
  return {
    key: 'search:demand', metric: 'impressions', from: impressions, to: Math.max(impressions + 1, Math.round(100 / perMonth)),
    title: 'Get shown for a search people actually make',
    why: `Google shows it ${timesMonth(impressions * perMonth)}${main ? `, mostly for “${main.query}”` : ''}: even a better position there would bring ${aboutN(best?.gainValue || 0)} more clicks a month.`,
    how: 'Pick a search with real volume (Search → Search volume shows Bing’s numbers for any wording), use those words in the title and first heading, answer it in the first screen, and link to the page from pages that already get visits.',
    gain: 'about 100 impressions a month to start from', checkBy: addDays(today, 42),
  };
}

// Purpose, whether it's served, and the next goal for one page. Pure.
//   row: a page-review row; ctx: { days, today, conversion: { visitors, goalUsers, rate } | null,
//   siteRate, siteEngagement, outcome (label), purpose (your choice, if any) }
export function nextGoal(row, { days = 90, today, conversion = null, siteRate = null, siteEngagement = 0.5, outcome = 'converted', purpose = '' } = {}) {
  const perMonth = 30 / days;
  const chosen = purpose && PURPOSES[purpose] ? purpose : guessPurpose(row, { converts: siteRate !== null });
  const visitsMonth = (row.visits || 0) * perMonth;
  const clicksMonth = ((row.google?.clicks || 0) + (row.bing?.clicks || 0)) * perMonth;
  let serving;
  let goal;

  if (chosen === 'convert' && siteRate !== null && conversion?.visitors >= 30) {
    const rate = conversion.rate || 0;
    serving = rate >= siteRate ? 'yes' : rate > 0 ? 'partly' : 'no';
    const to = Math.min(0.9, rate >= siteRate ? rate * 1.5 : siteRate);
    goal = {
      key: 'convert:rate', metric: 'rate', from: Math.round(rate * 1000) / 1000, to: Math.round(to * 1000) / 1000,
      title: rate >= siteRate ? `Lift “${outcome}” from ${pct(rate, 1)} to ${pct(to, 1)}` : `Reach the site’s average: ${pct(to, 1)} ${outcome}`,
      why: `${fmt(conversion.goalUsers)} of ${fmt(conversion.visitors)} visitors (${pct(rate, 1)}) went on to “${outcome}”; the site averages ${pct(siteRate, 1)}.`,
      how: 'Put the call to action in the first screen and again at the end, say what happens after the click, and cut what competes with it.',
      gain: `about ${fmt(Math.max(0, (to - rate) * conversion.visitors * perMonth))} more a month`, checkBy: addDays(today, 28),
    };
  } else if (chosen === 'help' && (row.visits || 0) * perMonth >= 10) {
    const e = row.engagementRate || 0;
    serving = e >= siteEngagement ? 'yes' : e >= siteEngagement * 0.7 ? 'partly' : 'no';
    const to = Math.min(0.85, Math.max(siteEngagement, e + 0.1));
    goal = {
      key: 'help:engaged', metric: 'engagement', from: Math.round(e * 100) / 100, to: Math.round(to * 100) / 100,
      title: `Get ${pct(to)} of readers to stay`,
      why: `${pct(e)} of its ${fmt(visitsMonth)} monthly visitors stay engaged; the site’s pages typically keep ${pct(siteEngagement)}.`,
      how: 'Answer the question in the first screen, add steps or screenshots where people get stuck, and link to the next thing they need.',
      gain: `about ${fmt(Math.max(0, (to - e) * visitsMonth))} more engaged readers a month`, checkBy: addDays(today, 28),
    };
  } else {
    goal = searchGoal(row, { perMonth, today });
    serving = clicksMonth >= 30 ? 'yes' : (row.google?.impressions || 0) + (row.bing?.impressions || 0) > 0 || visitsMonth >= 10 ? 'partly' : 'no';
  }

  const servingText = {
    search: { yes: `Yes: about ${fmt(clicksMonth)} search clicks a month.`, partly: `Partly: search shows it, but it brings ${aboutN(clicksMonth)} clicks a month.`, no: 'Not yet: search doesn’t bring anyone.' },
    convert: { yes: 'Yes: it converts at or above the site’s average.', partly: 'Partly: people convert, but below the site’s average.', no: `Not yet: nobody who lands here goes on to “${outcome}”.` },
    help: { yes: 'Yes: readers stay as long as on the site’s best pages.', partly: 'Partly: some readers stay, many leave early.', no: 'Not yet: most readers leave quickly.' },
  };
  const effective = goal.key.startsWith('convert') ? 'convert' : goal.key.startsWith('help') ? 'help' : 'search';
  return {
    purpose: chosen, purposeLabel: PURPOSES[chosen], chosen: Boolean(purpose),
    serving, servingText: servingText[effective][serving],
    ...(effective !== chosen ? { note: chosen === 'convert' ? 'Too few visitors yet to judge conversions: getting found comes first.' : 'Too few visitors yet to judge reading: getting found comes first.' } : {}),
    next: goal,
  };
}

// A saved goal's progress from today's value of the same metric. Pure.
export function progress(target, current) {
  if (!target || current === null || current === undefined) return null;
  const lower = target.metric === 'position';
  const reached = lower ? current <= target.to : current >= target.to;
  const span = lower ? target.from - target.to : target.to - target.from;
  const done = lower ? target.from - current : current - target.from;
  return { now: current, reached, share: span > 0 ? Math.round(Math.max(0, Math.min(1, done / span)) * 100) / 100 : reached ? 1 : 0 };
}

// Today's value of a goal's metric for a page row.
export function currentValue(target, row, conversion) {
  if (!target) return null;
  if (target.metric === 'position') {
    const q = (row.google?.queries || []).find((x) => x.query === target.query);
    return q?.position ?? (target.query ? null : row.google?.position ?? null);
  }
  if (target.metric === 'ctr') {
    const q = (row.google?.queries || []).find((x) => x.query === target.query);
    return q?.impressions ? q.clicks / q.impressions : null;
  }
  if (target.metric === 'impressions') return (row.google?.impressions || 0);
  if (target.metric === 'rate') return conversion?.rate ?? null;
  if (target.metric === 'engagement') return row.engagementRate ?? null;
  if (target.metric === 'clicks') return row.google?.clicks ?? null;
  return null;
}
