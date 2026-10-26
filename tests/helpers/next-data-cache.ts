/** In-memory stand-in for Next's server Data Cache for route unit tests.
 * Each wrapped loader owns a cache, so vi.resetModules() creates a fresh store.
 * Arguments partition results; rejected reads are never persisted. */
export function mockUnstableCache<T, A extends unknown[]>(load: (...args: A) => Promise<T>) {
  const values = new Map<string, T>();
  return async (...args: A): Promise<T> => {
    const key = JSON.stringify(args);
    if (values.has(key)) return structuredClone(values.get(key)!);
    const value = await load(...args);
    values.set(key, structuredClone(value));
    return value;
  };
}
