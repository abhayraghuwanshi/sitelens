// In-memory TTL cache that also de-duplicates concurrent requests for the same key.

export function createCache({ maxEntries = 500 } = {}) {
  const entries = new Map();

  return {
    async wrap(key, ttl, fresh, load) {
      const hit = entries.get(key);
      if (!fresh && hit && hit.expires > Date.now()) return hit.value;
      const value = load();
      entries.set(key, { value, expires: Date.now() + ttl });
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      try {
        return await value;
      } catch (err) {
        if (entries.get(key)?.value === value) entries.delete(key);
        throw err;
      }
    },
    clear(fragment = '') {
      for (const key of entries.keys()) if (!fragment || key.includes(fragment)) entries.delete(key);
    },
  };
}
