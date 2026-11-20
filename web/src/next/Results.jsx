import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// What a site's visits led to (Goals → Results), and the section heading it uses.
// These lived in the Story, which the Timeline replaced as a site's home.
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// What the visits led to, in three kinds that aren't added up: what visitors did
// on the site (GA4 goal events, steps on the way to the outcome), what got the
// product (store installs, release downloads) and who keeps using it (custom
// metrics). Without any of those it says what to connect instead of guessing.
const GOT = { installs: 'Chrome Web Store', downloads: 'GitHub files, not people', stars: 'GitHub stars gained' };
const hasHistory = (x) => x.previous !== null && x.previous !== undefined;

export function Results({ site, range, n = '5', title = 'What it led to', more = true }) {
  const products = useAsync(() => api.get('/products').catch(() => null), []);
  const product = products.data?.products?.find((p) => p.siteId === site.id);
  // A product carries the store/repo numbers, but its site may not have one: the
  // site's own goals (.sitelens.yml, or the events it sends) still say what the
  // period led to, so read those instead of dropping the section.
  const out = useAsync(() => {
    if (!products.data) return null;
    const url = product ? `/outcomes/${product.id}` : `/sites/${site.id}/outcomes`;
    return api.get(`${url}${qs({ range })}`).catch(() => null);
  }, [products.data, product?.id, site.id, range]);
  const metrics = useAsync(() => api.get(`/sites/${site.id}/metrics${qs({ range })}`).catch(() => ({ metrics: [] })), [site.id, range]);
  if (!products.data || (!out.data && out.loading)) return <section class="card card-plain"><Loading height={160} /></section>;
  const all = out.data?.goals?.list || [];
  const outcomesHref = `#/site/${site.id}/outcomes?range=${range}`;

  // On the site: the outcome first, then the steps that lead to it, biggest first.
  const onSite = all.filter((g) => g.source === 'event' || g.source === 'page')
    .sort((a, b) => (b.role === 'outcome') - (a.role === 'outcome') || b.count - a.count);
  const got = all.filter((g) => GOT[g.source] && g.role === 'outcome')
    .sort((a, b) => hasHistory(b) - hasHistory(a));
  const usage = (metrics.data?.metrics || []).map((m) => ({
    id: m.id,
    label: m.label.replace(/[\s·]+$/, ''),
    count: m.error ? null : m.total,
    previous: m.previous,
    note: m.error ? m.error.message : m.summary === 'average' ? 'average a day' : 'in this period',
  }));
  const nothing = onSite.length === 0 && got.length === 0 && usage.length === 0;

  return (
    <section class="card card-plain" aria-label="What it led to">
      <SectionHead n={n} title={title} more={more ? { href: outcomesHref, label: 'Outcomes' } : null} />
      <div class="nx-outcomes">
        {nothing ? (
          <a class="nx-callout nx-okind-empty" href={outcomesHref}>
            <Icon name="target" size={14} />
            <span>No outcome yet. Pick the events that mean someone got what they came for (a sign-up, a purchase, a download), and this shows what the period led to.</span>
          </a>
        ) : (
          <>
            {onSite.length > 0 && (
              <OutcomeKind icon="target" title="On the site" note="Visitors, from GA4" href={outcomesHref}
                items={onSite.map((g) => ({ id: g.id, label: g.label, count: g.unavailable ? null : g.count, previous: g.previous, note: g.unavailable || (g.role === 'step' ? 'on the way' : '') }))} />
            )}
            {got.length > 0 && (
              <OutcomeKind icon="download" title="Got the product" note="Counted outside the site" href={outcomesHref}
                items={got.map((g) => ({ id: g.id, label: g.label, count: g.unavailable ? null : g.count, previous: g.previous, note: g.unavailable || GOT[g.source] }))} />
            )}
            {usage.length > 0 ? (
              <OutcomeKind icon="users" title="Kept using it" note="Custom metrics" href="#/account?tab=metrics" items={usage} />
            ) : (
              <a class="nx-callout nx-okind-empty" href="#/account?tab=metrics">
                <Icon name="database" size={14} />
                <span>A download isn’t a user. Connect the app’s own numbers (launches, weekly active users, uninstalls) as custom metrics, and this shows who stays.</span>
              </a>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// One kind of outcome: its headline number large, the rest as short rows.
function OutcomeKind({ icon, title, note, href, items }) {
  const [lead, ...rest] = items;
  return (
    <a class="nx-okind" href={href}>
      <div class="nx-label-sm"><Icon name={icon} size={12} /> {title}<span class="nx-okind-src">{note}</span></div>
      <div class="nx-okind-lead">
        <b>{amount(lead.count)}</b>
        <span>{lead.label}{lead.note && <span class="muted small"> · {lead.note}</span>}</span>
        <Shift item={lead} />
      </div>
      {rest.length > 0 && (
        <ul class="nx-okind-rows">
          {rest.map((x) => (
            <li key={x.id}>
              <span class="nx-path">{x.label}{x.note && <span class="muted small"> · {x.note}</span>}</span>
              <span class="nx-num">{amount(x.count)}</span>
              <Shift item={x} />
            </li>
          ))}
        </ul>
      )}
    </a>
  );
}

const amount = (v) => (v === null || v === undefined ? '–' : v < 10 && v % 1 ? v.toFixed(1) : fmt(v));
const Shift = ({ item }) => (item.count === null ? <span /> : hasHistory(item) ? <Change value={item.count} previous={item.previous} /> : <span class="muted small">no history</span>);

// A change against the period before. From almost nothing, the starting
// number says more than a percentage does ("from 1", not "up 12200%").
export function Change({ value, previous }) {
  if (!previous) return value ? <span class="good small">new</span> : <span class="muted">–</span>;
  if (previous * 4 < value) return <span class="good small">from {fmt(previous)}</span>;
  const p = Math.round((value / previous - 1) * 100);
  if (!p) return <span class="muted small">same</span>;
  return <span class={`${p > 0 ? 'good' : 'bad'} small`}>{p > 0 ? '↑' : '↓'} {Math.abs(p)}%</span>;
}

export function SectionHead({ n, title, more }) {
  return (
    <div class="nx-section-head">
      <h2 class="nx-h2">{n && <span class="nx-step" aria-hidden="true">{n}</span>}{title}</h2>
      {more && <a class="nx-more" href={more.href}>{more.label} <Icon name="chevron" size={12} /></a>}
    </div>
  );
}
