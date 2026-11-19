import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

// A report's tab row (Section.jsx). Pages that draw their own header (Journeys,
// Outcomes) still show their section's tabs under it.
export const SectionTabs = createContext(null);

// A page: a title, an optional line under it, actions on the right, and (for
// pages opened from another) a link back to it: the desktop app has no back button.
export function Page({ title, sub, actions, back, children }) {
  const tabs = useContext(SectionTabs);
  return (
    <div class="nx-page">
      <header class="nx-head">
        <div>
          {back && <a class="nx-back" href={back.href}>← {back.label}</a>}
          <h1>{title}</h1>
          {sub && <p class="nx-sub">{sub}</p>}
        </div>
        {actions && <div class="nx-head-r">{actions}</div>}
      </header>
      {tabs}
      {children}
    </div>
  );
}
