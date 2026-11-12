import test from 'node:test';
import assert from 'node:assert/strict';
import { isTagged, campaignGoals, summarizeCampaigns, summarizeSources, summarizeAds } from '../server/campaigns.mjs';

test('isTagged: GA4 placeholders like (organic) and (not set) are not campaigns', () => {
  assert.equal(isTagged('launch-week'), true);
  for (const c of ['(organic)', '(referral)', '(direct)', '(not set)', '', null]) assert.equal(isTagged(c), false);
});

test('campaignGoals: only outcome event goals, at most three', () => {
  const goals = campaignGoals({ goals: [
    { id: 'a', source: 'event', match: 'sign_up', label: 'Sign-ups', role: 'outcome' },
    { id: 'b', source: 'page', match: '/thanks', label: 'Thanks page', role: 'outcome' },
    { id: 'c', source: 'event', match: 'plan_select', label: 'Plan', role: 'step' },
    { id: 'd', source: 'event', match: 'download', label: 'Downloads' },
    { id: 'e', source: 'event', match: 'x', label: 'X' },
    { id: 'f', source: 'event', match: 'y', label: 'Y' },
  ] });
  assert.deepEqual(goals.map((g) => g.event), ['sign_up', 'download', 'x']);
  assert.deepEqual(campaignGoals(null), []);
});

test('summarizeCampaigns: one row per campaign (any case), sources and variants inside, goals and first day', () => {
  const rows = [
    { sessionCampaignName: 'launch', sessionSource: 'reddit', sessionMedium: 'social', sessionManualAdContent: '(not set)', sessions: '30', engagedSessions: '12', keyEvents: '2' },
    { sessionCampaignName: 'Launch', sessionSource: 'newsletter', sessionMedium: 'email', sessionManualAdContent: 'header', sessions: '20', engagedSessions: '15', keyEvents: '3' },
    { sessionCampaignName: '(organic)', sessionSource: 'google', sessionMedium: 'organic', sessionManualAdContent: '(not set)', sessions: '500', engagedSessions: '200', keyEvents: '9' },
    { sessionCampaignName: 'old', sessionSource: 'x', sessionMedium: 'social', sessionManualAdContent: '', sessions: '5', engagedSessions: '1', keyEvents: '0' },
  ];
  const out = summarizeCampaigns({
    rows,
    previous: [{ sessionCampaignName: 'launch', sessions: '10' }, { sessionCampaignName: 'gone', sessions: '7' }],
    goalRows: [
      { sessionCampaignName: 'launch', sessionSource: 'newsletter', sessionMedium: 'email', eventName: 'sign_up', totalUsers: '4' },
      { sessionCampaignName: 'launch', sessionSource: 'reddit', sessionMedium: 'social', eventName: 'other', totalUsers: '9' },
    ],
    firstSeen: [{ sessionCampaignName: 'launch', date: '20261105', sessions: '3' }, { sessionCampaignName: 'launch', date: '20261101', sessions: '0' }, { sessionCampaignName: 'Launch', date: '20261103', sessions: '1' }],
    goals: [{ id: 'su', label: 'Sign-ups', event: 'sign_up' }],
  });
  assert.deepEqual(out.map((c) => c.campaign), ['launch', 'old', 'gone']);
  const launch = out[0];
  assert.equal(launch.sessions, 50);
  assert.equal(launch.engaged, 27);
  assert.equal(launch.keyEvents, 5);
  assert.equal(launch.previous, 10);
  assert.deepEqual(launch.goals, { su: 4 });
  assert.equal(launch.firstDay, '2026-11-03');
  assert.deepEqual(launch.parts.map((p) => [p.source, p.content, p.goals.su || 0]), [['reddit', '', 0], ['newsletter', 'header', 4]]);
  assert.equal(out[2].sessions, 0);
  assert.equal(out[2].previous, 7);
});

test('summarizeSources: share and previous per source / medium', () => {
  const out = summarizeSources(
    [{ sessionSource: 'google', sessionMedium: 'organic', sessions: '75', engagedSessions: '30', keyEvents: '1' }, { sessionSource: 'reddit', sessionMedium: 'social', sessions: '25', engagedSessions: '5', keyEvents: '0' }],
    [{ sessionSource: 'google', sessionMedium: 'organic', sessions: '60' }],
  );
  assert.deepEqual(out.map((s) => [s.source, s.share, s.previous]), [['google', 0.75, 60], ['reddit', 0.25, 0]]);
});

test('summarizeAds: cost per key event, and unlinked when nothing was spent or clicked', () => {
  const linked = summarizeAds([
    { sessionGoogleAdsCampaignName: 'Brand', advertiserAdCost: '40', advertiserAdClicks: '20', advertiserAdImpressions: '300', sessions: '18', keyEvents: '4' },
    { sessionGoogleAdsCampaignName: 'Rivals', advertiserAdCost: '60', advertiserAdClicks: '10', advertiserAdImpressions: '900', sessions: '9', keyEvents: '0' },
    { sessionGoogleAdsCampaignName: '(not set)', advertiserAdCost: '0', advertiserAdClicks: '0', advertiserAdImpressions: '0', sessions: '900', keyEvents: '20' },
  ]);
  assert.equal(linked.linked, true);
  assert.equal(linked.cost, 100);
  assert.deepEqual(linked.campaigns.map((a) => [a.campaign, a.costPerKeyEvent]), [['Rivals', null], ['Brand', 10]]);
  assert.equal(summarizeAds([{ sessionGoogleAdsCampaignName: '(not set)', advertiserAdCost: '0', advertiserAdClicks: '0', sessions: '50', keyEvents: '1' }]).linked, false);
});
