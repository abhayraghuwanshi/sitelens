// A page in the new layout: a title, an optional line under it, actions on the right.
export function Page({ title, sub, actions, children }) {
  return (
    <div class="nx-page">
      <header class="nx-head">
        <div>
          <h1>{title}</h1>
          {sub && <p class="nx-sub">{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
