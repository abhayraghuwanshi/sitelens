import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading } from './ui.jsx';
import { Icon } from './icons.jsx';
import { SummaryLine } from './Journey.jsx';

// The top of Overview: the period as a story (server/story.mjs). How it
// went, what moved it, the days that stood out, and what shipped around them.
const STORY_RANGE = { '7d': '7d', '28d': '28d', '90d': '90d' };

// Overview reads the story once and shares it with the journey map.
export function useStory(site, range) {
  const storyRange = STORY_RANGE[range] || '7d';
  return useAsync(() => api.get(`/sites/${site.id}/story${qs({ range: storyRange })}`), [site.id, storyRange]);
}
const KIND_ICON = { deploy: 'rocket', release: 'github', post: 'megaphone', extension: 'puzzle', mention: 'chat' };
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function WhatHappened({ site, range, story }) {
  const storyRange = STORY_RANGE[range] || '7d';
  if (story.error) return null;
  if (!story.data) return <Loading height={160} />;
  const d = story.data;
  const where = (c) => (c.kind === 'query' ? `#/site/${site.id}/found` : `#/site/${site.id}/arrive`);

  return (
    <Card title="What happened" sub={`${short(d.range.from)} – ${short(d.range.to)}, against the ${storyRange.replace('d', '')} days before${storyRange !== range ? ' · whole days only' : ''}`}>
      <div class="stack" style={{ gap: '14px' }}>
        <SummaryLine summary={{ text: d.headline, status: d.tone }} />
        {(d.changes.length > 0 || d.days.length > 0) && (
          <div class="grid cols-2" style={{ marginBottom: 0 }}>
            <div>
              <div class="story-label">What moved it</div>
              {d.changes.length ? (
                <ul class="story-list">
                  {d.changes.map((c) => (
                    <li key={c.kind + c.key}>
                      <a href={where(c)}>{c.text}</a>
                      {c.cause && <Cause e={c.cause} lead="Around then" more={c.cause.more} />}
                    </li>
                  ))}
                </ul>
              ) : <p class="muted small">No single source or page moved much.</p>}
            </div>
            <div>
              <div class="story-label">Days that stood out</div>
              {d.days.length ? (
                <ul class="story-list">
                  {d.days.map((day) => (
                    <li key={day.date}>
                      <a href={`#/calendar${qs({ site: site.id, month: day.date.slice(0, 7), day: day.date })}`}>{day.text}</a>
                      {day.events.map((e) => <Cause key={e.label + e.date} e={e} lead={e.date === day.date ? 'Same day' : 'Day before'} />)}
                      {!day.events.length && <span class="story-cause muted">Nothing shipped around then. Open the day to see where visits came from.</span>}
                    </li>
                  ))}
                </ul>
              ) : <p class="muted small">Every day was close to a usual one for its weekday.</p>}
            </div>
          </div>
        )}
        <p class="note" style={{ margin: 0 }}>
          {d.shipped ? `${d.shipped} thing${d.shipped === 1 ? '' : 's'} shipped in this period: deploys, releases and posts.` : 'Nothing shipped in this period.'}{' '}
          <a href={`#/site/${site.id}/ship`}>See what shipped</a> · <a href={`#/calendar${qs({ site: site.id })}`}>Calendar</a>
        </p>
      </div>
    </Card>
  );
}

function Cause({ e, lead, more = 0 }) {
  return (
    <span class="story-cause">
      <Icon name={KIND_ICON[e.kind] || 'calendar'} size={12} />
      {lead}: {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.label}</a> : e.label} ({short(e.date)}){more > 0 ? `, and ${more} more` : ''}
    </span>
  );
}
