// lib/social-links.test.ts (#TG-TOOLS-CTA)

import { describe, it, expect } from "vitest";
import { SOCIAL } from "./social-links";

describe("SOCIAL", () => {
  it("il canale Telegram è un link con username, non un invito", () => {
    // `t.me/+HASH` è revocabile, non indicizzabile, e sembra un gruppo privato:
    // se rientra di nascosto qui, tutta la distribuzione punta a un link fragile.
    expect(SOCIAL.telegram).toBe("https://t.me/betredge");
    expect(SOCIAL.telegram).not.toContain("/+");
  });

  it("ogni link è https e assoluto", () => {
    for (const [key, url] of Object.entries(SOCIAL)) {
      expect(url.startsWith("https://"), key).toBe(true);
    }
  });
});
