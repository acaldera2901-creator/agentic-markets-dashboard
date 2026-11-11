// lib/signup-tracking.ts — #G2-TRACKING-1110
// Geo e sessione della registrazione, letti lato server. Gli header geo li
// imposta la piattaforma (Vercel), non il client; il session_id invece arriva
// dal body ed è un trust boundary: solo [a-z0-9], max 64.
// Nessun IP salvato: solo paese/regione/città già risolti da Vercel.

export type SignupGeo = { country: string | null; region: string | null; city: string | null };

function clean(v: string | null, max: number, re: RegExp): string | null {
  if (!v) return null;
  // Troppo lungo = scartato, non troncato: "XYZ" non deve diventare "XY".
  const s = v.trim();
  return s && s.length <= max && re.test(s) ? s : null;
}

export function signupGeo(req: Request): SignupGeo {
  const h = req.headers;
  const country = clean(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"), 2, /^[A-Za-z]{2}$/);
  const region = clean(h.get("x-vercel-ip-country-region"), 8, /^[A-Za-z0-9-]{1,8}$/);
  let city: string | null = h.get("x-vercel-ip-city");
  if (city) {
    try { city = decodeURIComponent(city); } catch { city = null; }
  }
  return {
    country: country ? country.toUpperCase() : null,
    region: region ? region.toUpperCase() : null,
    // Lettere di qualunque alfabeto, spazi, apostrofi, punti e trattini.
    city: clean(city, 80, /^[\p{L}\p{M}' .-]+$/u),
  };
}

export function signupSessionId(input: unknown): string | null {
  return typeof input === "string" && /^[a-z0-9]{6,64}$/.test(input) ? input : null;
}
