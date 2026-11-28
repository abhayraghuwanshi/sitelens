// The one course: Kauzl's free "Learn web analytics for your app". Single
// source of truth for the course name, its five modules and the lesson order.
// The build, the course page, the home page footer and llms.txt all read from
// here, so the course can never drift into "a pile of blog posts" again.

export const COURSE = {
  name: 'Learn web analytics for your app',
  description: 'A free course in short lessons: set up analytics, choose your tools, read the numbers, get found in AI search, and ask AI about your data.',
};

export const MODULES = [
  {
    id: 'basics',
    name: 'Basics',
    sub: 'What to measure, and the free tools every site needs.',
    teaches: 'Know what to measure, and set up the free tools every site needs.',
    lessons: [
      { slug: 'web-analytics-tools', name: 'The web analytics tools map' },
      { slug: 'google-analytics-4-setup', name: 'Set up Google Analytics 4' },
      { slug: 'what-is-a-utm-code', name: 'What is a UTM code?' },
      { slug: 'search-console-vs-google-analytics', name: 'Search Console vs Google Analytics' },
      { slug: 'bounce-rate-ga4', name: 'Bounce rate vs engagement rate' },
      { slug: 'bing-webmaster-tools', name: 'Set up Bing Webmaster Tools' },
    ],
  },
  {
    id: 'choose-tools',
    name: 'Choose your tools',
    sub: 'Each kind of tool compared, from our own research.',
    teaches: 'Compare the kinds of analytics tool, and pick the two or three you need.',
    lessons: [
      { slug: 'google-analytics-alternatives', name: 'Google Analytics alternatives' },
      { slug: 'plausible-alternatives', name: 'Plausible alternatives' },
      { slug: 'open-source-web-analytics', name: 'Open-source web analytics compared' },
      { slug: 'product-analytics-tools', name: 'Product analytics for your app' },
      { slug: 'session-replay-heatmaps', name: 'Session replay and heatmaps' },
      { slug: 'hotjar-alternatives', name: 'Hotjar alternatives' },
      { slug: 'seo-tools-compared', name: 'SEO tools compared' },
      { slug: 'semrush-alternatives', name: 'Semrush alternatives' },
      { slug: 'kauzl-vs-plausible', name: 'Kauzl vs Plausible' },
      { slug: 'website-traffic-checker', name: 'Check any website’s traffic' },
      { slug: 'similarweb-alternatives', name: 'Similarweb alternatives' },
    ],
  },
  {
    id: 'read-numbers',
    name: 'Read your numbers',
    sub: 'Turn reports into answers, and know when a change worked.',
    teaches: 'Turn reports into answers, and know when a change worked.',
    lessons: [
      { slug: 'simple-google-analytics-dashboard', name: 'A simpler GA4 dashboard' },
      { slug: 'ga4-bigquery-export', name: 'Connect GA4 to BigQuery' },
      { slug: 'did-a-website-change-work', name: 'Did a website change work?' },
      { slug: 'google-update-traffic-drop', name: 'Was it a Google update?' },
      { slug: 'statistical-significance-ab-testing', name: 'Statistical significance, explained' },
    ],
  },
  {
    id: 'ai-search',
    name: 'AI search',
    sub: 'Get found, and cited, when people ask ChatGPT or Claude.',
    teaches: 'Get found, and cited, when people ask AI search.',
    lessons: [
      { slug: 'track-chatgpt-traffic-google-analytics', name: 'Track ChatGPT traffic in GA4' },
      { slug: 'what-is-aeo', name: 'What is AEO?' },
      { slug: 'google-ai-overviews', name: 'Get cited in AI Overviews' },
      { slug: 'google-ai-mode', name: 'Google AI Mode and your traffic' },
      { slug: 'generative-engine-optimization', name: 'Get recommended by AI' },
      { slug: 'ai-crawlers-robots-txt', name: 'Which AI crawlers to block' },
      { slug: 'openai-crawlers', name: 'OpenAI’s crawlers explained' },
      { slug: 'claude-crawlers', name: 'ClaudeBot and Claude’s crawlers' },
      { slug: 'llms-txt', name: 'What is llms.txt?' },
    ],
  },
  {
    id: 'ask-ai',
    name: 'Ask AI about your data',
    sub: 'Connect your analytics to Claude, Cursor or ChatGPT.',
    teaches: 'Connect analytics to an AI assistant, and ask it about your data.',
    lessons: [
      { slug: 'google-analytics-mcp-server', name: 'Google Analytics MCP' },
      { slug: 'connect-google-analytics-to-chatgpt', name: 'Connect GA4 to ChatGPT' },
    ],
  },
];

export const COURSE_ORDER = MODULES.flatMap((m) => m.lessons.map((l) => l.slug));
const lesson = (slug) => MODULES.flatMap((m) => m.lessons).find((l) => l.slug === slug);

// The owl's path picker: answer keys are `${building}|${stage}|${worry}`, with
// '*' as a wildcard; the first matching rule wins, ending in a default.
export const PATHS = {
  'app|*|changes': ['web-analytics-tools', 'google-analytics-4-setup', 'product-analytics-tools', 'did-a-website-change-work', 'statistical-significance-ab-testing', 'session-replay-heatmaps'],
  '*|*|ai': ['web-analytics-tools', 'track-chatgpt-traffic-google-analytics', 'what-is-aeo', 'google-ai-overviews', 'google-ai-mode', 'generative-engine-optimization', 'bing-webmaster-tools', 'ai-crawlers-robots-txt', 'llms-txt'],
  '*|*|*': ['web-analytics-tools', 'google-analytics-4-setup', 'google-analytics-alternatives', 'simple-google-analytics-dashboard', 'track-chatgpt-traffic-google-analytics', 'google-analytics-mcp-server'],
};

// Lesson number (1-based) in course order; unlisted guides follow the course.
export const lessonNo = (g, guides) => { const i = COURSE_ORDER.indexOf(g.slug); return i >= 0 ? i + 1 : COURSE_ORDER.length + guides.filter((o) => !COURSE_ORDER.includes(o.slug)).indexOf(g) + 1; };
export const moduleOf = (slug) => MODULES.findIndex((m) => m.lessons.some((l) => l.slug === slug));
export const inCourseOrder = (guides) => [...guides].sort((a, b) => lessonNo(a, guides) - lessonNo(b, guides));
