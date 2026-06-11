// Unisce base + path opzionale preservando la query string della base.
// La baseUrl può già contenere il codice affiliato come query (?c=ABC).
export function joinUrl(base: string, path?: string): string {
  if (!path) return base;
  const q = base.indexOf("?");
  const origin = q === -1 ? base : base.slice(0, q);
  const query = q === -1 ? "" : base.slice(q); // include "?"
  const left = origin.replace(/\/+$/, "");
  const right = path.replace(/^\/+/, "");
  return `${left}/${right}${query}`;
}
