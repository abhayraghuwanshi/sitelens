export class ApiError extends Error {
  constructor(message, { status = 0, kind = '', hint = '', bytes = 0 } = {}) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.hint = hint;
    this.bytes = bytes;
  }
}

// GETs in flight, so the shell can show that new numbers are on their way.
let pending = 0;
const pendingListeners = new Set();
function addPending(n) {
  pending += n;
  for (const fn of pendingListeners) fn(pending);
}
export function onPending(fn) {
  pendingListeners.add(fn);
  fn(pending);
  return () => pendingListeners.delete(fn);
}

// The server answers from stored data while it fetches newer numbers, and says
// so (X-Studio-Stale). One follow-up per path waits for that fetch; then views
// load again quietly (useAsync), now from the fresh copy.
const following = new Map();
const refreshListeners = new Set();
let refreshTimer = 0;
export function onRefreshed(fn) {
  refreshListeners.add(fn);
  return () => refreshListeners.delete(fn);
}
function followUp(path) {
  if (following.has(path)) return;
  following.set(path, fetch(`/api${path}`, { headers: { 'X-Studio-Wait': '1' } })
    .then((res) => {
      // Still stale: the refresh failed (offline?); keep what's shown.
      if (!res.ok || res.headers.get('X-Studio-Stale') === '1') return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => refreshListeners.forEach((fn) => fn()), 50);
    })
    .catch(() => {})
    .finally(() => following.delete(path)));
}

async function request(method, path, body) {
  const counted = method === 'GET';
  if (counted) addPending(1);
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Studio': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    // Hosted: the session ended; the gateway's sign-in page takes it from here.
    if (res.status === 401 && data.kind === 'login') window.location.assign('/login');
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, { status: res.status, ...data });
    if (counted && res.headers.get('X-Studio-Stale') === '1') followUp(path);
    return data;
  } finally {
    if (counted) addPending(-1);
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  del: (path) => request('DELETE', path, {}),
};

export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) search.set(key, value === true ? '1' : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
