// lib/pick-language.ts — #GEO-LANG-0821
//
// La lingua la dice il BROWSER, non un servizio di terzi.
//
// Prima si chiamava `https://ipapi.co/json/` dal browser al primo accesso e si
// leggeva il campo `languages`. Tre difetti in una riga:
//  1. VA IN QUOTA: misurato in produzione un 429 su /leaderboard, quindi il
//     rilevamento falliva in silenzio e restava l'inglese comunque;
//  2. MANDA L'IP DEL VISITATORE A UN TERZO alla prima visita, prima di qualsiasi
//     consenso — per un dato che il browser ci dà gratis;
//  3. È MENO ACCURATO: la geolocalizzazione indovina il paese, non la lingua. Un
//     italiano che tiene il browser in inglese vuole l'inglese, e `navigator.
//     languages` è la sua preferenza DICHIARATA.
//
// Funzione pura, così è testabile senza browser né rete.

/** Prima preferenza del browser fra quelle che l'app parla; `en` se nessuna. */
export function pickLanguage(preferite: readonly string[], parlate: readonly string[]): string {
  for (const raw of preferite) {
    const base = (raw || "").split("-")[0]?.trim().toLowerCase();
    if (base && parlate.includes(base)) return base;
  }
  return "en";
}
