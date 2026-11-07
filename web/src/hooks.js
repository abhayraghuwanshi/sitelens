import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { onPending, onRefreshed } from './api.js';

// Hash routes: #/ · #/settings · #/site/<id>/<view>?k=v
export function parseHash(hash = location.hash) {
  const [path, search = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: new URLSearchParams(search) };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path) {
  location.hash = path;
}

// Same route with one query param set (or removed when empty), so views stay linkable.
export function withParam(key, value, hash = location.hash) {
  const [path, search = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(search);
  if (value) params.set(key, value);
  else params.delete(key);
  const text = params.toString();
  return `${path || '/'}${text ? `?${text}` : ''}`;
}

// Loads `fn` whenever `deps` change; stale responses are dropped. When the
// server has fresher numbers than it first answered with, loads again quietly.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const seq = useRef(0);
  const run = useCallback((options) => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => fn(options))
      .then(
        (data) => id === seq.current && setState({ loading: false, data, error: null }),
        (error) => id === seq.current && setState({ loading: false, data: null, error }),
      );
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  useEffect(() => onRefreshed(() => {
    const id = ++seq.current;
    // Keep what's shown (and any error) if the quiet load fails.
    Promise.resolve()
      .then(() => fn())
      .then((data) => id === seq.current && setState({ loading: false, data, error: null }), () => {});
  }), [run]);
  return { ...state, reload: run };
}

// True while API reads are in flight, after a short delay so quick ones don't flash.
export function useLoading(delay = 200) {
  const [count, setCount] = useState(0);
  const [shown, setShown] = useState(false);
  useEffect(() => onPending(setCount), []);
  useEffect(() => {
    if (!count) return setShown(false);
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [count > 0]);
  return { busy: count > 0, shown };
}

export function usePersistent(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`studio:${key}`);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(`studio:${key}`, JSON.stringify(resolved));
        } catch {
          /* storage unavailable: keep in memory */
        }
        return resolved;
      });
    },
    [key],
  );
  return [value, update];
}

export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
