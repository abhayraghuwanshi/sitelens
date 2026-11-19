import { Page } from './Page.jsx';
import { AlertsPage } from './Alerts.jsx';
import { TodosPage } from '../components/Todos.jsx';
import { hrefFor } from './nav.js';

// Inbox: what is waiting on you, for one site or every site. Alerts (what
// moved) and to-dos (changes to make) in one place, with a tab for each.
const TABS = [['all', 'All'], ['alerts', 'Alerts'], ['todos', 'To-dos']];

export function Inbox({ site, sites, tab: wanted, counts }) {
  const tab = TABS.some(([k]) => k === wanted) ? wanted : 'all';
  const scope = site ? site.id : 'all';
  const count = (k) => (k === 'alerts' ? counts.alerts : k === 'todos' ? counts.todos : counts.alerts + counts.todos);
  return (
    <Page title="Inbox" sub={site ? `What is waiting on you for ${site.label}` : 'What is waiting on you, on every site'}
>
      <nav class="tabs nx-tabs-row" aria-label="Inbox">
        {TABS.map(([k, l]) => (
          <a key={k} class={k === tab ? 'active' : undefined} href={hrefFor(scope, 'inbox', k === 'all' ? '' : k)} aria-current={k === tab ? 'page' : undefined}>
            {l}{count(k) ? <span class="nx-tab-count">{count(k)}</span> : null}
          </a>
        ))}
      </nav>
      {tab !== 'todos' && (
        <section class="nx-inbox-part" aria-label="Alerts">
          {tab === 'all' && <h2 class="nx-h2 nx-h2-gap">Alerts</h2>}
          <AlertsPage key={scope} site={site} sites={sites} />
        </section>
      )}
      {tab !== 'alerts' && (
        <section class="nx-inbox-part" aria-label="To-dos">
          {tab === 'all' && <h2 class="nx-h2 nx-h2-gap">To-dos</h2>}
          <TodosPage key={scope} site={site} sites={sites} />
        </section>
      )}
    </Page>
  );
}
