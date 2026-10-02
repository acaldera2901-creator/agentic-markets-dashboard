// #SPLIT-0201 — le diciture accanto alla cifra del track record, in un posto
// solo (KPI dello storico, paywall, card del track record, home). La cifra in
// testa e' quella del MODELLO, e l'etichetta dice che cosa misura.

export type TrackRecordLang = "it" | "en" | "es" | "fr" | "ru";

const pickLang = <T,>(lang: string, v: Record<TrackRecordLang, T>): T =>
  v[(lang in v ? lang : "en") as TrackRecordLang];

/** L'etichetta della cifra del modello: che cosa misura e su quante pick. */
export function ourPredictionsLabel(lang: string, n: number): string {
  return pickLang(lang, {
    it: `hit rate delle nostre predizioni · ${n} pick concluse`,
    en: `hit rate of our predictions · ${n} settled picks`,
    es: `hit rate de nuestras predicciones · ${n} picks cerradas`,
    fr: `hit rate de nos prédictions · ${n} picks réglés`,
    ru: `hit rate наших прогнозов · ${n} закрытых пиков`,
  });
}
