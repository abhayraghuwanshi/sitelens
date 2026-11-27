import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSource, cleanMedium, cleanPair, campaignKey, attribute, stripTracking } from '../shared/traffic-source.js';
import { UTM_SOURCES } from '../shared/utm.js';

test('cleanSource: spellings, domains and app referrers of one place become one id', () => {
  for (const v of ['Facebook', 'fb', 'facebook.com', 'm.facebook.com', 'l.facebook.com', 'https://www.facebook.com/groups/x', 'android-app://com.facebook.katana/']) {
    assert.equal(cleanSource(v), 'facebook', v);
  }
  for (const v of ['t.co', 'Twitter', 'x.com', 'mobile.twitter.com']) assert.equal(cleanSource(v), 'x', v);
  for (const v of ['out.reddit.com', 'old.reddit.com', 'Reddit', 'android-app://com.reddit.frontpage']) assert.equal(cleanSource(v), 'reddit', v);
  for (const v of ['news.ycombinator.com', 'HN', 'hacker news']) assert.equal(cleanSource(v), 'hackernews', v);
  assert.equal(cleanSource('www.google.co.uk'), 'google');
  assert.equal(cleanSource('mail.google.com'), 'gmail');
  assert.equal(cleanSource('chatgpt.com'), 'chatgpt');
  assert.equal(cleanSource('chromewebstore.google.com'), 'chromewebstore');
  assert.equal(cleanSource('dev.to'), 'devto');
});

test('cleanSource: unknown sites keep their domain, unknown names are tidied, placeholders pass', () => {
  assert.equal(cleanSource('https://www.blog.example.com/post'), 'blog.example.com');
  assert.equal(cleanSource('Spring  Newsletter'), 'spring-newsletter');
  assert.equal(cleanSource('(direct)'), '(direct)');
  assert.equal(cleanSource(''), '');
});

test('cleanSource agrees with the utm_source values taggedLink writes', () => {
  for (const id of Object.values(UTM_SOURCES).filter(Boolean)) assert.equal(cleanSource(id), id, id);
});

test('cleanMedium: hand-typed mediums become the few that mean something', () => {
  assert.equal(cleanMedium('Social Media'), 'social');
  assert.equal(cleanMedium('PPC'), 'cpc');
  assert.equal(cleanMedium('paid_social'), 'paid-social');
  assert.equal(cleanMedium('E-mail'), 'email');
  assert.equal(cleanMedium('newsletter'), 'email');
  assert.equal(cleanMedium('(none)'), '(none)');
  assert.equal(cleanMedium('Podcast Read'), 'podcast-read');
});

test('cleanPair: a missing medium is guessed from the source', () => {
  assert.deepEqual(cleanPair('reddit', ''), { source: 'reddit', medium: 'social' });
  assert.deepEqual(cleanPair('google', '(not set)'), { source: 'google', medium: 'organic' });
  assert.deepEqual(cleanPair('substack', ''), { source: 'substack', medium: 'email' });
  assert.deepEqual(cleanPair('', ''), { source: '(not set)', medium: '(not set)' });
  assert.deepEqual(cleanPair('(direct)', '(none)'), { source: '(direct)', medium: '(none)' });
});

test('campaignKey: case, spaces and underscores do not split a campaign', () => {
  assert.equal(campaignKey('Launch_Post'), 'launch-post');
  assert.equal(campaignKey(' launch post '), 'launch-post');
  assert.equal(campaignKey('launch+post'), 'launch-post');
  assert.equal(campaignKey('(organic)'), '(organic)');
});

test('attribute: utm tags first, cleaned; a tag without a source takes the referrer', () => {
  assert.deepEqual(
    attribute({ url: 'https://example.com/?UTM_Source=Facebook&utm_medium=Social%20Media&utm_campaign=Launch_Post&utm_content=Header', referrer: '' }),
    { source: 'facebook', medium: 'social', campaign: 'launch-post', content: 'header', term: '', via: 'utm' },
  );
  const noSource = attribute({ url: 'https://example.com/?utm_campaign=spring', referrer: 'https://www.linkedin.com/feed/', host: 'example.com' });
  assert.equal(noSource.source, 'linkedin');
  assert.equal(noSource.medium, 'social');
  assert.equal(noSource.campaign, 'spring');
  assert.equal(attribute({ url: 'https://example.com/?ref=producthunt' }).source, 'producthunt');
});

test('attribute: ad click ids, then the referrer, then direct', () => {
  assert.deepEqual(attribute({ url: 'https://example.com/?gclid=abc' }), { source: 'google', medium: 'cpc', campaign: '', content: '', term: '', via: 'click-id' });
  assert.equal(attribute({ url: 'https://example.com/?msclkid=1' }).source, 'bing');
  // fbclid is on unpaid Facebook clicks too, so the referrer decides.
  assert.deepEqual(attribute({ url: 'https://example.com/?fbclid=1', referrer: 'https://l.facebook.com/' }).medium, 'social');
  assert.deepEqual(attribute({ url: 'https://example.com/', referrer: 'https://www.google.com/' }), { source: 'google', medium: 'organic', campaign: '', content: '', term: '', via: 'referrer' });
  assert.equal(attribute({ url: 'https://example.com/', referrer: 'https://someblog.dev/post' }).medium, 'referral');
  assert.equal(attribute({ url: 'https://example.com/' }).via, 'direct');
});

test('attribute: a page of the same site is not a new source', () => {
  assert.equal(attribute({ url: 'https://example.com/pricing', referrer: 'https://www.example.com/', host: 'example.com' }), null);
  assert.equal(attribute({ url: 'https://app.example.com/', referrer: 'https://example.com/', host: 'example.com' }), null);
});

test('stripTracking: drops utm and click ids, keeps other params and the hash', () => {
  assert.equal(
    stripTracking('https://example.com/p?utm_source=x&id=7&gclid=1&fbclid=2#top'),
    'https://example.com/p?id=7#top',
  );
  assert.equal(stripTracking('not a url'), 'not a url');
});
