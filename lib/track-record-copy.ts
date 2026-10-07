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

// #COPY-LEDGER-1007 — la nota sul cambio di popolazione del track record.
// Con LEDGER_SEALED_GRADING acceso (#LEDGER-SIGILLATA-1007) il numero conta,
// dalla data dichiarata, solo le pick sigillate prima del calcio d'inizio e le
// grada su quella pick. Condizione FTC: chi legge la percentuale deve sapere che
// prima e dopo quella data non e' la stessa popolazione. La nota NON e' mai
// accesa a mano: compare solo se la risposta di /api/v2/history porta
// `stats.sealed_grading.from`, cioe' se il server ha il flag acceso con una data
// valida (sealedGradingConfig, fail-closed). La data viene da li', non dal testo.

type SealedStats = { sealed_grading?: { from?: string | null } | null } | null | undefined;

/** L'ISO di LEDGER_SEALED_FROM dichiarato dal server; null = nota spenta. */
export function sealedCohortFrom(stats: SealedStats | string): string | null {
  const from = typeof stats === "string" ? stats : stats?.sealed_grading?.from;
  if (typeof from !== "string" || !from.trim()) return null;
  return Number.isFinite(new Date(from).getTime()) ? from : null;
}

// La data si legge in UTC: e' la data del cutover dichiarato (00:00Z), non
// quella dell'orologio di chi guarda. L'italiano resta numerico come nel testo
// approvato; le altre lingue a mese esteso, cosi' 26/10 e 10/26 non si confondono.
const DATE_FMT: Record<Lang, [string, Intl.DateTimeFormatOptions]> = {
  it: ["it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }],
  en: ["en-GB", { day: "numeric", month: "long", year: "numeric" }],
  es: ["es-ES", { day: "numeric", month: "long", year: "numeric" }],
  fr: ["fr-FR", { day: "numeric", month: "long", year: "numeric" }],
  ru: ["ru-RU", { day: "numeric", month: "long", year: "numeric" }],
};

const SEALED_NOTE: Record<Lang, (date: string) => string> = {
  it: (d) => `Dal ${d} il track record conta solo le pick registrate prima del calcio d'inizio e le valuta su quella pick. Le pick mostrate senza registrazione, quasi tutte sotto soglia, non entrano più nel conteggio: per questo la percentuale non è confrontabile con il periodo precedente.`,
  en: (d) => `From ${d}, the track record only counts picks recorded before kick-off and grades them on that pick. Picks shown without being recorded, almost all below the threshold, are no longer counted: for this reason the percentage is not comparable with the previous period.`,
  es: (d) => `Desde el ${d}, el track record solo cuenta las picks registradas antes del inicio del partido y las evalúa sobre esa pick. Las picks mostradas sin registro, casi todas por debajo del umbral, ya no entran en el recuento: por eso el porcentaje no es comparable con el periodo anterior.`,
  fr: (d) => `À partir du ${d}, le track record ne compte que les picks enregistrés avant le coup d'envoi et les évalue sur ce pick. Les picks affichés sans enregistrement, presque tous sous le seuil, n'entrent plus dans le décompte : c'est pourquoi le pourcentage n'est pas comparable avec la période précédente.`,
  ru: (d) => `С ${d} track record учитывает только пики, зарегистрированные до начала матча, и оценивает их по этому пику. Пики, показанные без регистрации, почти все ниже порога, больше не входят в подсчёт: поэтому процент нельзя сравнивать с предыдущим периодом.`,
};

/** La nota nella lingua, o null se il grading sigillato non e' attivo. */
export function sealedPopulationNote(lang: string, stats: SealedStats | string): string | null {
  const from = sealedCohortFrom(stats);
  if (!from) return null;
  const l = (lang in SEALED_NOTE ? lang : "en") as Lang;
  const [locale, opts] = DATE_FMT[l];
  const date = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(from));
  return SEALED_NOTE[l](date);
}
