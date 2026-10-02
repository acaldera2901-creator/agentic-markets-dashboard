// #SPLIT-0201 — la riga sotto la cifra del track record: il TOTALE scomposto
// per fonte (il nostro modello / le quote di mercato del partner), in un posto
// solo per KPI dello storico, paywall, card del track record e home.

type Lang = "it" | "en" | "es" | "fr" | "ru";
type Part = { winRate: string | null; n: number };

const WORDS: Record<Lang, { model: string; partner: string; on: string; picks: string }> = {
  it: { model: "Modello", partner: "Quote di mercato del partner", on: "su", picks: "pick" },
  en: { model: "Model", partner: "Partner market prices", on: "on", picks: "picks" },
  es: { model: "Modelo", partner: "Cuotas de mercado del socio", on: "en", picks: "picks" },
  fr: { model: "Modèle", partner: "Cotes de marché du partenaire", on: "sur", picks: "picks" },
  ru: { model: "Модель", partner: "Рыночные котировки партнёра", on: "на", picks: "пиков" },
};

/** «Modello: A% su n1 · Quote di mercato del partner: B% su n2». Un blocco
 *  sotto il campione minimo dice solo quante pick ha (nessuna percentuale);
 *  il partner senza pick decise non compare. */
export function sourceBreakdownLine(lang: string, b: { model: Part; partner: Part }): string {
  const w = WORDS[(lang in WORDS ? lang : "en") as Lang];
  const sep = lang === "fr" ? " : " : ": ";
  const part = (label: string, p: Part) =>
    `${label}${sep}${p.winRate ? `${p.winRate} ${w.on} ${p.n}` : `${p.n} ${w.picks}`}`;
  const parts = [part(w.model, b.model)];
  if (b.partner.n > 0) parts.push(part(w.partner, b.partner));
  return parts.join(" · ");
}
