// lib/social-links.ts (#TG-TOOLS-CTA)
// Fonte unica dei link ai nostri canali. Il link al canale Telegram compare in
// tre punti (footer, hub dei tool, pagina di ogni tool): scritto tre volte
// invecchia in due.

export const SOCIAL = {
  instagram: "https://www.instagram.com/betr.edge/",
  x: "https://x.com/BetrEdge",
  facebook: "https://www.facebook.com/",
  /**
   * Canale Telegram pubblico, nella forma con lo username — NON un invito
   * `t.me/+HASH`.
   *
   * La differenza non è cosmetica: un invito è revocabile, non è indicizzabile,
   * e a chi lo apre sembra un gruppo privato. Fino al 2026-08-20 il canale era
   * privato e questo link non esisteva: nel footer l'icona Telegram era presente
   * ma **senza href**, in attesa. Un test fissa la forma con lo username, così
   * un invito non può rientrare di nascosto.
   */
  telegram: "https://t.me/betredge",
} as const;
