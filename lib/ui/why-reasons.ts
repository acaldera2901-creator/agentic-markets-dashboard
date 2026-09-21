// lib/ui/why-reasons.ts — #RESTYLING-0921
//
// «Why the model likes this pick»: da 3 a 5 motivazioni, una riga ciascuna,
// OGNUNA derivata da un campo che esiste davvero nella riga servita.
//
// Il prodotto aveva già una prosa (`buildFootballWhy`, due-quattro frasi), ma
// il brief chiede una LISTA: si scandisce, e ogni voce porta la sua etichetta,
// quindi si vede da cosa nasce. La prosa resta dov'è, sulla card in griglia.
//
// Regola: se il campo manca, la riga NON esiste. Nessuna voce di riempimento,
// nessun «dati non disponibili» — una lista di tre motivi veri vale più di una
// di cinque in cui due dicono che non si sa. È la stessa regola per cui una
// fascia vuota della lobby non si rende.

export type WhyReason = {
  /** Etichetta breve: dice DA DOVE viene la riga (Form, Goals, xG, Market…). */
  label: string;
  text: string;
};

export type WhyLang = "it" | "en";

const L = <T,>(lang: WhyLang, v: { it: T; en: T }): T => v[lang];

export type FormCounts = { w: number; d: number; l: number };

/** «WWDLL» o i conteggi del Mondiale → conteggi. Restituisce null se non c'è
 *  nulla da contare: una forma vuota non è una forma di zero partite. */
export function formCounts(f?: string | Partial<FormCounts> | null): FormCounts | null {
  if (!f) return null;
  if (typeof f === "string") {
    if (!f.trim()) return null;
    return {
      w: (f.match(/W/gi) || []).length,
      d: (f.match(/D/gi) || []).length,
      l: (f.match(/L/gi) || []).length,
    };
  }
  if (typeof f === "object" && (f.w != null || f.d != null || f.l != null)) {
    const c = { w: f.w ?? 0, d: f.d ?? 0, l: f.l ?? 0 };
    return c.w + c.d + c.l > 0 ? c : null;
  }
  return null;
}

const fmt1 = (n: number) => n.toFixed(1);

export type FootballWhyInput = {
  home: string;
  away: string;
  formHome?: string | Partial<FormCounts> | null;
  formAway?: string | Partial<FormCounts> | null;
  xgHome?: number | null;
  xgaHome?: number | null;
  xgAway?: number | null;
  xgaAway?: number | null;
  expectedGoals?: number | null;
  goalsBandLow?: number | null;
  goalsBandHigh?: number | null;
  matchesHome?: number | null;
  matchesAway?: number | null;
  /** Perché la riga non porta una pick, quando non la porta. */
  reliability?: "insufficient_data" | "cross_competition" | null;
  topScorer?: { name: string; pScores: number } | null;
  marketPct?: number | null;
  modelPct?: number | null;
};

export function footballWhyReasons(input: FootballWhyInput, lang: WhyLang = "en"): WhyReason[] {
  const out: WhyReason[] = [];

  // 1. Forma — il dato più leggibile, e non è Pro: lo vede ogni piano aperto.
  const fh = formCounts(input.formHome);
  const fa = formCounts(input.formAway);
  if (fh && fa) {
    const n = fh.w + fh.d + fh.l;
    out.push({
      label: L(lang, { it: "Forma", en: "Form" }),
      text: L(lang, {
        it: `Ultime ${n}: ${input.home} ${fh.w}V-${fh.d}N-${fh.l}P, ${input.away} ${fa.w}V-${fa.d}N-${fa.l}P.`,
        en: `Last ${n}: ${input.home} ${fh.w}W-${fh.d}D-${fh.l}L, ${input.away} ${fa.w}W-${fa.d}D-${fa.l}L.`,
      }),
    });
  }

  // 2. Qualità delle occasioni (xG) — Pro. Serve la coppia creato/concesso di
  //    almeno un lato, altrimenti è mezzo numero.
  if (input.xgHome != null && input.xgaHome != null && input.xgAway != null && input.xgaAway != null) {
    out.push({
      label: "xG",
      text: L(lang, {
        it: `${input.home} crea ${fmt1(input.xgHome)} xG e ne concede ${fmt1(input.xgaHome)}; ${input.away} ${fmt1(input.xgAway)} e ${fmt1(input.xgaAway)}.`,
        en: `${input.home} creates ${fmt1(input.xgHome)} xG and concedes ${fmt1(input.xgaHome)}; ${input.away} ${fmt1(input.xgAway)} and ${fmt1(input.xgaAway)}.`,
      }),
    });
  }

  // 3. Gol attesi, con la banda: il numero da solo fingerebbe una precisione
  //    che il modello non ha.
  if (input.expectedGoals != null) {
    const band = input.goalsBandLow != null && input.goalsBandHigh != null
      ? L(lang, { it: ` (banda ${fmt1(input.goalsBandLow)}–${fmt1(input.goalsBandHigh)})`, en: ` (band ${fmt1(input.goalsBandLow)}–${fmt1(input.goalsBandHigh)})` })
      : "";
    out.push({
      label: L(lang, { it: "Gol", en: "Goals" }),
      text: L(lang, {
        it: `Il modello attende ${fmt1(input.expectedGoals)} gol${band}.`,
        en: `The model expects ${fmt1(input.expectedGoals)} goals${band}.`,
      }),
    });
  }

  // 4. Marcatore di riferimento — Pro. Sotto il 15% non è un argomento.
  if (input.topScorer && input.topScorer.pScores >= 0.15) {
    const p = Math.round(input.topScorer.pScores * 100);
    out.push({
      label: L(lang, { it: "Marcatore", en: "Scorer" }),
      text: L(lang, {
        it: `${input.topScorer.name} segna nel ${p}% delle partite simili.`,
        en: `${input.topScorer.name} scores in ${p}% of comparable games.`,
      }),
    });
  }

  // 5. Quanto regge il campione, e il confronto col mercato. È la riga che può
  //    mentire, quindi dice sempre la verità meno comoda per prima.
  out.push(sampleAndMarket(input, lang));

  return out.slice(0, 5);
}

function sampleAndMarket(input: FootballWhyInput, lang: WhyLang): WhyReason {
  const label = L(lang, { it: "Affidabilità", en: "Reliability" });
  if (input.reliability === "insufficient_data") {
    return { label, text: L(lang, {
      it: "Poche partite a disposizione per queste squadre: la lettura è provvisoria.",
      en: "Few matches available for these sides: the read is provisional.",
    }) };
  }
  if (input.reliability === "cross_competition") {
    return { label, text: L(lang, {
      it: "Squadre di campionati diversi: il pool del modello non è su una scala sola.",
      en: "Sides from different leagues: the model's pool is not on a single scale.",
    }) };
  }
  const mh = input.matchesHome, ma = input.matchesAway;
  const small = (mh != null && mh < 10) || (ma != null && ma < 10);
  const sample = mh != null && ma != null
    ? L(lang, { it: `${mh} e ${ma} partite nel campione`, en: `${mh} and ${ma} matches in the sample` })
    : null;

  if (input.marketPct == null) {
    return { label, text: [
      sample,
      L(lang, {
        it: "nessun prezzo di mercato: questa è una stima del modello, non un edge",
        en: "no market price: this is a model estimate, not an edge",
      }),
    ].filter(Boolean).join(" — ") + "." };
  }

  const gap = input.modelPct != null ? input.modelPct - input.marketPct : null;
  const market = gap == null
    ? L(lang, { it: "il mercato prezza questa partita", en: "the market prices this game" })
    : gap > 0
      ? L(lang, {
          it: `il mercato dà ${Math.round(input.marketPct)}%, il modello ${Math.round(input.modelPct!)}%`,
          en: `the market says ${Math.round(input.marketPct)}%, the model ${Math.round(input.modelPct!)}%`,
        })
      : L(lang, {
          it: `il mercato è più alto del modello (${Math.round(input.marketPct)}% contro ${Math.round(input.modelPct!)}%)`,
          en: `the market is above the model (${Math.round(input.marketPct)}% vs ${Math.round(input.modelPct!)}%)`,
        });

  const caveat = small ? L(lang, { it: " Campione piccolo: da prendere con cautela.", en: " Small sample: treat with care." }) : "";
  return { label, text: [sample, market].filter(Boolean).join(" — ") + "." + caveat };
}

export type TennisWhyInput = {
  p1: string;
  p2: string;
  surface?: string | null;
  eloP1?: number | null;
  eloP2?: number | null;
  surfaceMatchesP1?: number | null;
  surfaceMatchesP2?: number | null;
  serveFormP1?: number | null;
  serveFormP2?: number | null;
  returnFormP1?: number | null;
  returnFormP2?: number | null;
  h2hP1?: number | null;
  h2hP2?: number | null;
  restDaysP1?: number | null;
  restDaysP2?: number | null;
  marketPct?: number | null;
  modelPct?: number | null;
};

export function tennisWhyReasons(input: TennisWhyInput, lang: WhyLang = "en"): WhyReason[] {
  const out: WhyReason[] = [];
  const pc = (v: number) => `${Math.round(v * 100)}%`;

  // 1. Elo sulla superficie: è il cuore del modello tennis.
  if (input.eloP1 != null && input.eloP2 != null) {
    const surf = input.surface ? ` ${L(lang, { it: "su", en: "on" })} ${input.surface.toLowerCase()}` : "";
    const diff = Math.round(Math.abs(input.eloP1 - input.eloP2));
    const lead = input.eloP1 >= input.eloP2 ? input.p1 : input.p2;
    out.push({
      label: `Elo${surf}`,
      text: L(lang, {
        it: `${Math.round(input.eloP1)} contro ${Math.round(input.eloP2)}: ${lead} avanti di ${diff} punti.`,
        en: `${Math.round(input.eloP1)} vs ${Math.round(input.eloP2)}: ${lead} ahead by ${diff} points.`,
      }),
    });
  }

  // 2. Quanto quell'Elo è affidabile: poche partite su quella superficie e il
  //    numero sopra vale meno. Si dice, non si nasconde.
  if (input.surfaceMatchesP1 != null && input.surfaceMatchesP2 != null) {
    const thin = input.surfaceMatchesP1 < 10 || input.surfaceMatchesP2 < 10;
    out.push({
      label: L(lang, { it: "Campione", en: "Sample" }),
      text: L(lang, {
        it: `${input.surfaceMatchesP1} e ${input.surfaceMatchesP2} partite su questa superficie.${thin ? " Campione sottile da un lato." : ""}`,
        en: `${input.surfaceMatchesP1} and ${input.surfaceMatchesP2} matches on this surface.${thin ? " Thin sample on one side." : ""}`,
      }),
    });
  }

  // 3. Servizio e risposta.
  if (input.serveFormP1 != null && input.serveFormP2 != null) {
    out.push({
      label: L(lang, { it: "Servizio", en: "Serve" }),
      text: L(lang, {
        it: `Punti tenuti al servizio: ${input.p1} ${pc(input.serveFormP1)}, ${input.p2} ${pc(input.serveFormP2)}.`,
        en: `Service points won: ${input.p1} ${pc(input.serveFormP1)}, ${input.p2} ${pc(input.serveFormP2)}.`,
      }),
    });
  }
  if (input.returnFormP1 != null && input.returnFormP2 != null) {
    out.push({
      label: L(lang, { it: "Risposta", en: "Return" }),
      text: L(lang, {
        it: `In risposta: ${input.p1} ${pc(input.returnFormP1)}, ${input.p2} ${pc(input.returnFormP2)}.`,
        en: `On return: ${input.p1} ${pc(input.returnFormP1)}, ${input.p2} ${pc(input.returnFormP2)}.`,
      }),
    });
  }

  // 4. Precedenti — solo se ce ne sono.
  if ((input.h2hP1 ?? 0) + (input.h2hP2 ?? 0) > 0) {
    out.push({
      label: "Head to head",
      text: L(lang, {
        it: `${input.p1} ${input.h2hP1 ?? 0} — ${input.h2hP2 ?? 0} ${input.p2} nei precedenti.`,
        en: `${input.p1} ${input.h2hP1 ?? 0} — ${input.h2hP2 ?? 0} ${input.p2} in previous meetings.`,
      }),
    });
  }

  // 5. Riposo — conta solo quando è squilibrato.
  if (input.restDaysP1 != null && input.restDaysP2 != null && Math.abs(input.restDaysP1 - input.restDaysP2) >= 2) {
    const fresher = input.restDaysP1 > input.restDaysP2 ? input.p1 : input.p2;
    out.push({
      label: L(lang, { it: "Riposo", en: "Rest" }),
      text: L(lang, {
        it: `${input.restDaysP1} e ${input.restDaysP2} giorni di riposo: ${fresher} arriva più fresco.`,
        en: `${input.restDaysP1} and ${input.restDaysP2} days of rest: ${fresher} arrives fresher.`,
      }),
    });
  }

  if (input.marketPct == null && out.length > 0) {
    out.push({
      label: L(lang, { it: "Mercato", en: "Market" }),
      text: L(lang, {
        it: "Nessun prezzo di mercato su questo lato: stima del modello, non un edge.",
        en: "No market price on this side: model estimate, not an edge.",
      }),
    });
  }

  return out.slice(0, 5);
}
