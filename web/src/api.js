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
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, { status: res.status, ...data });
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
