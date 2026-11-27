import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickIcon, createSiteIcons } from '../server/site-icon.mjs';

test('pickIcon prefers an SVG, then the largest small raster, then any icon', () => {
  assert.equal(pickIcon('<link rel="icon" href="/a.png" sizes="16x16"><link rel="icon" type="image/svg+xml" href="/logo.svg">'), '/logo.svg');
  assert.equal(pickIcon('<link rel="icon" href="/16.png" sizes="16x16"><link rel="icon" href="/32.png" sizes="32x32"><link rel="icon" href="/512.png" sizes="512x512">'), '/32.png');
  assert.equal(pickIcon(`<link href='/x.ico' rel='shortcut icon'>`), '/x.ico');
  assert.equal(pickIcon('<link rel="apple-touch-icon" href="/apple.png">'), '/apple.png');
  assert.equal(pickIcon('<link rel="stylesheet" href="/a.css"><link rel="icon" href="data:image/png;base64,AA">'), '');
});

const page = (html, url) => Object.assign(new Response(html, { headers: { 'content-type': 'text/html' } }), {});
const image = (type, bytes = 'PNGDATA') => new Response(bytes, { headers: { 'content-type': type } });

test('a site icon is read from the page, falls back to /favicon.ico, and is kept for a day', async () => {
  let now = 0;
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === 'https://a.example/') return page('<link rel="icon" href="/brand.svg">');
    if (url === 'https://a.example/brand.svg') return image('image/svg+xml', '<svg/>');
    if (url === 'https://b.example/') return page('<title>no icon</title>');
    if (url === 'https://b.example/favicon.ico') return image('image/x-icon');
    if (url === 'https://c.example/') return page('<link rel="icon" href="/missing.png">');
    return new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } });
  };
  const icons = createSiteIcons({ fetchImpl, now: () => now, guard: false });
  assert.equal((await icons.icon('a.example')).type, 'image/svg+xml');
  assert.equal((await icons.icon('b.example')).type, 'image/x-icon');
  assert.equal(await icons.icon('c.example'), null, 'no usable icon anywhere');
  const before = calls.length;
  await icons.icon('a.example');
  assert.equal(calls.length, before, 'cached');
  now += 86_400_001;
  await icons.icon('a.example');
  assert.ok(calls.length > before, 'fetched again after a day');
  // Not a host name: nothing is fetched.
  assert.equal(await icons.icon('localhost'), null);
  assert.equal(await icons.icon('a.example/../x'), null);
});

test('a page that answers with a non-image or an oversized file gives no icon', async () => {
  const big = 'x'.repeat(300 * 1024);
  const icons = createSiteIcons({ guard: false, fetchImpl: async (url) => (url.endsWith('/') ? page('<link rel="icon" href="/big.png">')
    : url.endsWith('big.png') ? image('image/png', big) : image('text/html', '<html>')) });
  assert.equal(await icons.icon('d.example'), null);
});
