// A page in the new layout: a title, an optional line under it, actions on the
// right, and (for pages opened from another) a link back to it: the desktop app
// has no back button.
export function Page({ title, sub, actions, back, children }) {
  return (
    <div class="nx-page">
      <header class="nx-head">
        <div>
          {back && <a class="nx-back" href={back.href}>← {back.label}</a>}
          <h1>{title}</h1>
          {sub && <p class="nx-sub">{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
