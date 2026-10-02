// #SPLIT-0201 — le diciture accanto alla cifra del track record, in un posto
// solo (KPI dello storico, paywall, card del track record, home). La cifra in
// testa e' quella del MODELLO; il totale con le quote del partner si dichiara
// sotto, e la riga comincia da «Totale» perche' non si legga come il dato del
// partner da solo.

export type TrackRecordLang = "it" | "en" | "es" | "fr" | "ru";

const pickLang = <T,>(lang: string, v: Record<TrackRecordLang, T>): T =>
  v[(lang in v ? lang : "en") as TrackRecordLang];

/** «Totale con le quote di mercato del partner: X% su N pick». */
export function partnerTotalLine(lang: string, total: { winRate: string; n: number }): string {
  const { winRate: x, n } = total;
  return pickLang(lang, {
    it: `Totale con le quote di mercato del partner: ${x} su ${n} pick`,
    en: `Total including the partner's market prices: ${x} on ${n} picks`,
    es: `Total con las cuotas de mercado del socio: ${x} en ${n} picks`,
    fr: `Total avec les cotes de marché du partenaire : ${x} sur ${n} picks`,
    ru: `Итого с рыночными котировками партнёра: ${x} на ${n} пиков`,
  });
}

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
