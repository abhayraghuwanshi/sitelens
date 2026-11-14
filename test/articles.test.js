import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scanContent, parseSitemap, robotsSitemaps, parseArticleHtml, isArticlePath, frontMatter, contentEntry, matchFile, buildArticles, articleTotals, createArticles,
} from '../server/articles.mjs';

test('parseSitemap: url sets, sitemap indexes, CDATA and entities', () => {
  const index = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap><loc>https://a.com/sitemap-posts.xml</loc></sitemap><sitemap><loc>https://a.com/sitemap-pages.xml</loc></sitemap></sitemapindex>`;
  assert.deepEqual(parseSitemap(index), { sitemaps: ['https://a.com/sitemap-posts.xml', 'https://a.com/sitemap-pages.xml'], urls: [] });
  const set = `<urlset><url><loc><![CDATA[https://a.com/blog/one]]></loc><lastmod>2026-03-01</lastmod></url>
    <url><loc>https://a.com/search?a=1&amp;b=2</loc></url></urlset>`;
  assert.deepEqual(parseSitemap(set).urls, [{ loc: 'https://a.com/blog/one', lastmod: '2026-03-01' }, { loc: 'https://a.com/search?a=1&b=2', lastmod: '' }]);
});

test('robotsSitemaps: every Sitemap line, any case', () => {
  assert.deepEqual(robotsSitemaps('User-agent: *\nDisallow:\nSitemap: https://a.com/s1.xml\nsitemap:https://a.com/s2.xml'), ['https://a.com/s1.xml', 'https://a.com/s2.xml']);
});

test('isArticlePath: sections and dated paths, not listings', () => {
  assert.equal(isArticlePath('/blog/ga4-vs-plausible'), true);
  assert.equal(isArticlePath('/en/docs/setup'), true);
  assert.equal(isArticlePath('/2025/04/hello'), true);
  // Search landing pages: templates, alternatives, comparisons.
  assert.equal(isArticlePath('/templates/gta-6-stream-overlay'), true);
  assert.equal(isArticlePath('/alternatives/plausible'), true);
  assert.equal(isArticlePath('/templates'), false);
  assert.equal(isArticlePath('/blog'), false);
  assert.equal(isArticlePath('/blog/tag/seo'), false);
  assert.equal(isArticlePath('/blog/page/2'), false);
  assert.equal(isArticlePath('/pricing'), false);
});

test('parseArticleHtml: og title, description, published date from meta or JSON-LD', () => {
  const html = `<head><title>Fallback</title><meta content="Real title" property="og:title">
    <meta name="description" content="What it&#39;s about"><script type="application/ld+json">{"datePublished": "2026-02-03T10:00:00Z"}</script></head>`;
  assert.deepEqual(parseArticleHtml(html), { title: 'Real title', description: "What it's about", published: '2026-02-03' });
  assert.equal(parseArticleHtml('<title>Only</title>').title, 'Only');
});

test('frontMatter and contentEntry: slugs from front matter, file names, folders and Jekyll dates', () => {
  assert.deepEqual(frontMatter('---\ntitle: "Hello: world"\ndraft: false\n---\nBody'), { title: 'Hello: world', draft: 'false' });
  assert.deepEqual(contentEntry('content/blog/my-post.mdx', '---\ntitle: My post\npubDate: 2026-01-05\n---\n'),
    { file: 'content/blog/my-post.mdx', slug: 'my-post', title: 'My post', published: '2026-01-05', draft: false });
  const jekyll = contentEntry('_posts/2024-05-01-launch.md', '# Launch day\nText');
  assert.equal(jekyll.slug, 'launch');
  assert.equal(jekyll.published, '2024-05-01');
  assert.equal(jekyll.title, 'Launch day');
  assert.equal(contentEntry('docs/setup/index.md', '').slug, 'setup');
  assert.equal(contentEntry('blog/x.md', '---\nslug: Custom-Slug\n---').slug, 'custom-slug');
  assert.equal(contentEntry('blog/x.md', '---\ndraft: true\n---').draft, true);
});

test('matchFile: folder breaks ties between pages with the same slug', () => {
  const paths = ['/docs/api/introduction', '/docs/cli/introduction', '/blog/other'];
  assert.equal(matchFile({ file: 'docs/cli/introduction.md', slug: 'introduction' }, paths), '/docs/cli/introduction');
  assert.equal(matchFile({ file: 'docs/nothing.md', slug: 'nothing' }, paths), null);
});

test('buildArticles: joins sitemap, code, traffic and search; flags gaps', () => {
  const rows = buildArticles({
    sitemap: [
      { loc: 'https://a.com/blog/one/', path: '/blog/one', lastmod: '2026-01-01' },
      { loc: 'https://a.com/blog/two', path: '/blog/two', lastmod: '' },
      { loc: 'https://a.com/pricing', path: '/pricing', lastmod: '' },
    ],
    pages: new Map([['/blog/two', { title: 'Two', description: '', published: '2026-02-02' }]]),
    views: new Map([['/blog/one', { views: 50, users: 40 }], ['/blog/three', { views: 9, users: 9 }]]),
    landings: new Map([['/blog/one', { sessions: 30, sources: new Map([['Google', 20], ['Reddit', 10]]) }]]),
    search: new Map([['/blog/one', { clicks: 12, impressions: 300, position: 5, queries: [{ query: 'one thing', clicks: 12 }] }]]),
    files: [
      { file: 'content/blog/one.md', slug: 'one', title: 'One', published: '2025-12-30' },
      { file: 'content/blog/three.md', slug: 'three', title: 'Three', published: '' },
      { file: 'content/blog/draftish.md', slug: 'draftish', title: 'Unpublished', published: '' },
    ],
  });
  assert.deepEqual(rows.map((r) => r.path), ['/blog/one', '/blog/three', '/blog/two', '']);
  const one = rows[0];
  assert.equal(one.title, 'One');
  assert.equal(one.published, '2025-12-30');
  assert.equal(one.sessions, 30);
  assert.deepEqual(one.sources, [{ label: 'Google', sessions: 20 }, { label: 'Reddit', sessions: 10 }]);
  assert.equal(one.search.clicks, 12);
  assert.equal(rows[1].inSitemap, false); // in code and seen by GA4, missing from the sitemap
  assert.equal(rows[2].title, 'Two');
  assert.equal(rows[3].title, 'Unpublished');

  const t = articleTotals(rows, { siteSessions: 120, searchLinked: true, codeRead: true });
  assert.deepEqual(t, { articles: 4, withTraffic: 2, noTraffic: 1, sessions: 30, share: 0.25, notInGoogle: 2, notInSitemap: 2, noSource: 1 });
  assert.equal(buildArticles({ sitemap: [{ loc: 'https://a.com/pricing', path: '/pricing' }], all: true }).length, 1);

  const other = buildArticles({
    sitemap: [{ loc: 'https://a.com/blog/one', path: '/blog/one' }],
    files: [{ file: 'blog-posts/one.md', slug: 'one', repo: 'me/site' }, { file: 'docs/privacy.md', slug: 'privacy', repo: 'me/extension' }],
  });
  assert.deepEqual(other.map((r) => r.file?.file), ['blog-posts/one.md'], 'a repo with no matching URL is not site content');
});

test('createArticles: reads robots.txt → sitemap index → article pages, without GA4 or GitHub', async () => {
  const pages = {
    'https://a.com/robots.txt': 'Sitemap: https://a.com/sitemap.xml',
    'https://a.com/sitemap.xml': '<sitemapindex><sitemap><loc>https://a.com/posts.xml.gz</loc></sitemap></sitemapindex>',
    'https://a.com/posts.xml.gz': gzipSync('<urlset><url><loc>https://www.a.com/blog/hello</loc></url><url><loc>https://other.com/blog/x</loc></url><url><loc>https://a.com/about</loc></url></urlset>'),
    'https://a.com/blog/hello': '<title>Hello there</title><meta property="article:published_time" content="2026-06-01">',
  };
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    const body = pages[url];
    return body === undefined ? new Response('nope', { status: 404 }) : new Response(body);
  };
  const articles = createArticles({ auth: {}, store: { get: async () => ({}) }, getToken: async () => '', fetchImpl });
  const out = await articles.list({ id: 's', host: 'a.com' }, '28d');
  assert.deepEqual(out.sitemaps, ['https://a.com/sitemap.xml', 'https://a.com/posts.xml.gz']);
  assert.equal(out.sitemapUrls, 2);
  assert.deepEqual(out.rows.map((r) => [r.path, r.title, r.published]), [['/blog/hello', 'Hello there', '2026-06-01']]);
  assert.match(out.notes.code, /GitHub token/);
  assert.match(out.notes.ga4, /GA4 property/);
  assert.equal(seen.filter((u) => u === 'https://a.com/blog/hello').length, 1);
  await articles.list({ id: 's', host: 'a.com' }, '28d', { all: true });
  assert.equal(seen.filter((u) => u === 'https://a.com/blog/hello').length, 1, 'page metadata is cached');
});

test('createArticles: demo site needs no network', async () => {
  const articles = createArticles({ auth: {}, store: {}, getToken: async () => '', fetchImpl: () => { throw new Error('no network'); } });
  const out = await articles.list({ id: 'demo', demo: true, host: 'demo.sitelens.dev' }, '28d');
  assert.ok(out.rows.length > 3);
  assert.ok(out.totals.notInSitemap >= 1);
});

test('scanContent: Markdown in content folders only, drafts and READMEs skipped', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-content-'));
  try {
    const root = join(dir, 'owner-site-abc123');
    await mkdir(join(root, 'src', 'content', 'blog'), { recursive: true });
    await mkdir(join(root, 'docs'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'pkg', 'docs'), { recursive: true });
    await writeFile(join(root, 'src', 'content', 'blog', 'first.mdx'), '---\ntitle: First\ndate: 2026-01-02\n---\n');
    await writeFile(join(root, 'src', 'content', 'blog', 'wip.md'), '---\ntitle: WIP\ndraft: true\n---\n');
    await writeFile(join(root, 'docs', 'README.md'), '# Docs');
    await writeFile(join(root, 'docs', 'install.md'), '# Install');
    await writeFile(join(root, 'node_modules', 'pkg', 'docs', 'api.md'), '# Not ours');
    await writeFile(join(root, 'NOTES.md'), '# Top level');
    execFileSync('tar', ['-czf', join(dir, 'repo.tgz'), '-C', dir, 'owner-site-abc123']);
    const entries = scanContent(await readFile(join(dir, 'repo.tgz')));
    assert.deepEqual(entries.map((e) => [e.file, e.slug, e.title]).sort(), [
      ['docs/install.md', 'install', 'Install'],
      ['src/content/blog/first.mdx', 'first', 'First'],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
