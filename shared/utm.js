// Tagged links: a URL with utm_source/medium/campaign, so GA4 credits a post's
// visits exactly instead of guessing from timing. Shared by the server (which
// matches campaigns back to posts) and the Posts page (which builds the links).

// The utm_source each platform's tagged links use; sourceFamily maps them back.
export const UTM_SOURCES = {
  reddit: 'reddit', hn: 'hackernews', devto: 'devto', medium: 'medium', ph: 'producthunt',
  bluesky: 'bluesky', mastodon: 'mastodon', lobsters: 'lobsters', linkedin: 'linkedin', x: 'x', other: '',
};

export const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);

// A link to your page that GA4 credits exactly: utm_source/medium/campaign.
export function taggedLink({ url, platform = 'other', source = '', medium = 'social', campaign = '', content = '' }) {
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    throw new Error('Enter the page’s URL.');
  }
  const src = slug(source) || UTM_SOURCES[platform] || '';
  const name = slug(campaign);
  if (!src) throw new Error('Name the source, e.g. newsletter.');
  if (!name) throw new Error('Name the campaign, e.g. launch-post.');
  u.searchParams.set('utm_source', src);
  u.searchParams.set('utm_medium', slug(medium) || 'social');
  u.searchParams.set('utm_campaign', name);
  if (slug(content)) u.searchParams.set('utm_content', slug(content));
  else u.searchParams.delete('utm_content');
  return u.toString();
}
