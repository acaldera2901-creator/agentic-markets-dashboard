// lib/classic/copy.ts — #CLASSIC-CARD-1008 · le parole nuove della scheda Slab, in 11 lingue.
//
// Le lingue sono le 11 del sito (en, it + le 9 di lib/i18n/locales). Il desk oggi
// ne espone 5 (en it es fr ru): le altre sei sono pronte per quando il selettore
// le aprirà. Codice sconosciuto → inglese (fallback dichiarato, `classicCopy`).
// Parità controllata da copy.test.ts: ogni lingua ha ogni chiave, nessuna vuota.
//
// Lessico: niente «edge», «value», «tips», «lock», «guaranteed». Lo scarto si
// chiama scarto (gap) e si scrive col segno; il nostro numero si chiama «stima»
// perché è 30% modello + 70% mercato, e lo diciamo.

export const CLASSIC_LANGS = ["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "sv", "ru"] as const;
export type ClassicLang = (typeof CLASSIC_LANGS)[number];

export type ClassicCopy = {
  ourEstimate: string;
  ourModel: string;
  market: string;
  /** {m} = % modello, {k} = % mercato */
  blendInfo: string;
  infoLabel: string;
  marketOnly: string;
  marketOnlyNote: string;
  marketOnlyTennisNote: string;
  partnerMarketNote: string;
  modelOnly: string;
  modelOnlyNote: string;
  protectedTag: string;
  protectedNote: string;
  eloBased: string;
  /** {e} = % Elo, {k} = % mercato */
  eloNote: string;
  /** {n} = punti */
  gapAbove: string;
  gapBelow: string;
  inLine: string;
  oddsOnPartnerSite: string;
  /** {book} */
  betAt: string;
  ad: string;
  bestPrices: string;
  bestPrice: string;
  noPartnerPrice: string;
  pricesRemoved: string;
  /** {t} = ora */
  kickoffAt: string;
  /** {tz} = sigla del fuso */
  tzNote: string;
  whereDiffers: string;
  whereDiffersHint: string;
  draw: string;
  // #CLASSIC-FIX1-1008
  noPrice: string;
  noPriceNote: string;
  noPriceTennisNote: string;
  partnerMarket: string;
  partnerMarketInfo: string;
  marketOnlyFarNote: string;
};

const en: ClassicCopy = {
  ourEstimate: "Our estimate",
  ourModel: "Our model",
  market: "Market",
  blendInfo: "Our estimate = {m}% model + {k}% market",
  infoLabel: "How this number is made",
  marketOnly: "Market only",
  marketOnlyNote: "Our model is more than 25 points from the market, so we show the market.",
  marketOnlyTennisNote: "No fresh Elo on the ATP/WTA main tour: we show the market.",
  partnerMarketNote: "Partner price with the margin removed.",
  modelOnly: "Model only",
  modelOnlyNote: "No market price stored with this reading: our model alone, no gap.",
  protectedTag: "Protected · no value signal",
  protectedNote: "Our model sits 15–25 points from the market: no value signal.",
  eloBased: "Elo-based, not sealed",
  eloNote: "Estimate = {e}% our Elo + {k}% market.",
  gapAbove: "+{n} pts above the market",
  gapBelow: "−{n} pts below the market",
  inLine: "In line with the market",
  oddsOnPartnerSite: "Odds on partner site",
  betAt: "Bet at {book}",
  ad: "AD · 18+",
  bestPrices: "Best prices",
  bestPrice: "Best price",
  noPartnerPrice: "No partner price",
  pricesRemoved: "Prices removed at the start",
  kickoffAt: "Kick-off {t}",
  tzNote: "All times {tz}",
  whereDiffers: "Where our estimate differs most",
  whereDiffersHint: "Matches yet to start where our estimate and the market disagree, within our 15-point protection. A reading, not a recommendation.",
  draw: "Draw",
  noPrice: "No price yet",
  noPriceNote: "No number yet: no market price matches this pick, and our model reading is too old to show alone.",
  noPriceTennisNote: "No number yet: no market price for this match, and we never show our tennis Elo without one.",
  partnerMarket: "Market from partner prices",
  partnerMarketInfo: "Our model alone (no stored market to blend), read against a market rebuilt from partner prices: each book de-vigged, then averaged.",
  marketOnlyFarNote: "Our number's fair price is more than 25% from the best partner price, so we show the market.",
};

const it: ClassicCopy = {
  ourEstimate: "La nostra stima",
  ourModel: "Il nostro modello",
  market: "Mercato",
  blendInfo: "La nostra stima = {m}% modello + {k}% mercato",
  infoLabel: "Come nasce questo numero",
  marketOnly: "Solo mercato",
  marketOnlyNote: "Il nostro modello è a più di 25 punti dal mercato, quindi mostriamo il mercato.",
  marketOnlyTennisNote: "Nessun Elo recente sul circuito ATP/WTA: mostriamo il mercato.",
  partnerMarketNote: "Quota del partner, senza margine.",
  modelOnly: "Solo modello",
  modelOnlyNote: "Nessun prezzo di mercato registrato con questa lettura: solo il nostro modello, nessuno scarto.",
  protectedTag: "Protetta · nessun segnale di valore",
  protectedNote: "Il nostro modello è a 15–25 punti dal mercato: nessun segnale di valore.",
  eloBased: "Basata sull'Elo, non sigillata",
  eloNote: "Stima = {e}% nostro Elo + {k}% mercato.",
  gapAbove: "+{n} punti sopra il mercato",
  gapBelow: "−{n} punti sotto il mercato",
  inLine: "In linea con il mercato",
  oddsOnPartnerSite: "Quote sul sito del partner",
  betAt: "Scommetti su {book}",
  ad: "PUBBL. · 18+",
  bestPrices: "Prezzi migliori",
  bestPrice: "Prezzo migliore",
  noPartnerPrice: "Nessun prezzo partner",
  pricesRemoved: "Prezzi tolti all'inizio",
  kickoffAt: "Inizio {t}",
  tzNote: "Orari in {tz}",
  whereDiffers: "Dove la nostra stima si discosta di più",
  whereDiffersHint: "Partite non ancora iniziate in cui la nostra stima e il mercato non coincidono, entro la protezione dei 15 punti. Una lettura, non un consiglio.",
  draw: "Pareggio",
  noPrice: "Nessun prezzo per ora",
  noPriceNote: "Nessun numero per ora: nessun prezzo di mercato corrisponde a questa pick e la lettura del modello è troppo vecchia.",
  noPriceTennisNote: "Nessun numero per ora: nessun prezzo di mercato per questa partita, e il nostro Elo del tennis non si mostra mai senza.",
  partnerMarket: "Mercato dai prezzi dei partner",
  partnerMarketInfo: "Solo il nostro modello (nessun mercato registrato da fondere), letto contro un mercato ricostruito dai prezzi dei partner: margine tolto per book, poi media.",
  marketOnlyFarNote: "Il prezzo equo del nostro numero dista più del 25% dal miglior prezzo partner: mostriamo il mercato.",
};

const es: ClassicCopy = {
  ourEstimate: "Nuestra estimación",
  ourModel: "Nuestro modelo",
  market: "Mercado",
  blendInfo: "Nuestra estimación = {m}% modelo + {k}% mercado",
  infoLabel: "Cómo se calcula este número",
  marketOnly: "Solo mercado",
  marketOnlyNote: "Nuestro modelo está a más de 25 puntos del mercado, así que mostramos el mercado.",
  marketOnlyTennisNote: "Sin Elo reciente en el circuito ATP/WTA: mostramos el mercado.",
  partnerMarketNote: "Cuota del socio, sin margen.",
  modelOnly: "Solo modelo",
  modelOnlyNote: "Sin precio de mercado registrado con esta lectura: solo nuestro modelo, sin diferencia.",
  protectedTag: "Protegida · sin señal de valor",
  protectedNote: "Nuestro modelo está a 15–25 puntos del mercado: sin señal de valor.",
  eloBased: "Basada en Elo, no sellada",
  eloNote: "Estimación = {e}% nuestro Elo + {k}% mercado.",
  gapAbove: "+{n} pts por encima del mercado",
  gapBelow: "−{n} pts por debajo del mercado",
  inLine: "En línea con el mercado",
  oddsOnPartnerSite: "Cuotas en la web del socio",
  betAt: "Apuesta en {book}",
  ad: "PUBLI · 18+",
  bestPrices: "Mejores precios",
  bestPrice: "Mejor precio",
  noPartnerPrice: "Sin precio de socio",
  pricesRemoved: "Precios retirados al inicio",
  kickoffAt: "Inicio {t}",
  tzNote: "Horas en {tz}",
  whereDiffers: "Donde nuestra estimación más se aleja",
  whereDiffersHint: "Partidos por empezar en los que nuestra estimación y el mercado no coinciden, dentro de nuestra protección de 15 puntos. Una lectura, no una recomendación.",
  draw: "Empate",
  noPrice: "Aún sin precio",
  noPriceNote: "Aún sin número: ningún precio de mercado corresponde a este pick y la lectura del modelo es demasiado antigua para mostrarla sola.",
  noPriceTennisNote: "Aún sin número: no hay precio de mercado para este partido y nunca mostramos nuestro Elo de tenis sin él.",
  partnerMarket: "Mercado según precios de socios",
  partnerMarketInfo: "Solo nuestro modelo (sin mercado guardado con el que mezclar), frente a un mercado reconstruido con precios de socios: margen quitado por casa, luego promedio.",
  marketOnlyFarNote: "El precio justo de nuestro número está a más del 25% del mejor precio de socio: mostramos el mercado.",
};

const fr: ClassicCopy = {
  ourEstimate: "Notre estimation",
  ourModel: "Notre modèle",
  market: "Marché",
  blendInfo: "Notre estimation = {m} % modèle + {k} % marché",
  infoLabel: "Comment ce chiffre est calculé",
  marketOnly: "Marché seul",
  marketOnlyNote: "Notre modèle est à plus de 25 points du marché : nous affichons le marché.",
  marketOnlyTennisNote: "Pas d'Elo récent sur le circuit ATP/WTA : nous affichons le marché.",
  partnerMarketNote: "Cote du partenaire, sans marge.",
  modelOnly: "Modèle seul",
  modelOnlyNote: "Pas de prix de marché enregistré avec cette lecture : notre modèle seul, sans écart.",
  protectedTag: "Protégée · aucun signal de valeur",
  protectedNote: "Notre modèle est à 15–25 points du marché : aucun signal de valeur.",
  eloBased: "Basée sur l'Elo, non scellée",
  eloNote: "Estimation = {e} % notre Elo + {k} % marché.",
  gapAbove: "+{n} pts au-dessus du marché",
  gapBelow: "−{n} pts sous le marché",
  inLine: "En ligne avec le marché",
  oddsOnPartnerSite: "Cotes sur le site du partenaire",
  betAt: "Parier sur {book}",
  ad: "PUB · 18+",
  bestPrices: "Meilleurs prix",
  bestPrice: "Meilleur prix",
  noPartnerPrice: "Pas de prix partenaire",
  pricesRemoved: "Prix retirés au coup d'envoi",
  kickoffAt: "Coup d'envoi {t}",
  tzNote: "Heures en {tz}",
  whereDiffers: "Là où notre estimation s'écarte le plus",
  whereDiffersHint: "Matchs à venir où notre estimation et le marché divergent, dans notre protection de 15 points. Une lecture, pas une recommandation.",
  draw: "Match nul",
  noPrice: "Pas encore de prix",
  noPriceNote: "Pas encore de chiffre : aucun prix de marché ne correspond à ce pick, et la lecture du modèle est trop ancienne.",
  noPriceTennisNote: "Pas encore de chiffre : aucun prix de marché pour ce match, et notre Elo tennis n'est jamais affiché sans lui.",
  partnerMarket: "Marché issu des prix partenaires",
  partnerMarketInfo: "Notre modèle seul (aucun marché enregistré à mélanger), lu face à un marché reconstruit à partir des prix partenaires : marge retirée par bookmaker, puis moyenne.",
  marketOnlyFarNote: "Le prix juste de notre chiffre est à plus de 25 % du meilleur prix partenaire : nous affichons le marché.",
};

const de: ClassicCopy = {
  ourEstimate: "Unsere Schätzung",
  ourModel: "Unser Modell",
  market: "Markt",
  blendInfo: "Unsere Schätzung = {m} % Modell + {k} % Markt",
  infoLabel: "Wie diese Zahl entsteht",
  marketOnly: "Nur Markt",
  marketOnlyNote: "Unser Modell liegt mehr als 25 Punkte vom Markt entfernt, daher zeigen wir den Markt.",
  marketOnlyTennisNote: "Kein aktuelles Elo auf der ATP/WTA-Tour: Wir zeigen den Markt.",
  partnerMarketNote: "Partnerquote ohne Marge.",
  modelOnly: "Nur Modell",
  modelOnlyNote: "Kein Marktpreis zu dieser Einschätzung gespeichert: nur unser Modell, keine Abweichung.",
  protectedTag: "Geschützt · kein Value-Signal",
  protectedNote: "Unser Modell liegt 15–25 Punkte vom Markt entfernt: kein Value-Signal.",
  eloBased: "Elo-basiert, nicht versiegelt",
  eloNote: "Schätzung = {e} % unser Elo + {k} % Markt.",
  gapAbove: "+{n} Pkt. über dem Markt",
  gapBelow: "−{n} Pkt. unter dem Markt",
  inLine: "Im Einklang mit dem Markt",
  oddsOnPartnerSite: "Quoten auf der Partnerseite",
  betAt: "Wetten bei {book}",
  ad: "ANZEIGE · 18+",
  bestPrices: "Beste Preise",
  bestPrice: "Bester Preis",
  noPartnerPrice: "Kein Partnerpreis",
  pricesRemoved: "Preise zum Anpfiff entfernt",
  kickoffAt: "Anpfiff {t}",
  tzNote: "Alle Zeiten {tz}",
  whereDiffers: "Wo unsere Schätzung am stärksten abweicht",
  whereDiffersHint: "Noch nicht begonnene Spiele, bei denen unsere Schätzung und der Markt auseinanderliegen, innerhalb unseres 15-Punkte-Schutzes. Eine Einordnung, keine Empfehlung.",
  draw: "Unentschieden",
  noPrice: "Noch kein Preis",
  noPriceNote: "Noch keine Zahl: Kein Marktpreis passt zu diesem Pick, und unsere Modell-Einschätzung ist zu alt, um allein zu stehen.",
  noPriceTennisNote: "Noch keine Zahl: kein Marktpreis für dieses Match, und unser Tennis-Elo erscheint nie ohne einen.",
  partnerMarket: "Markt aus Partnerpreisen",
  partnerMarketInfo: "Nur unser Modell (kein gespeicherter Markt zum Mischen), gelesen gegen einen aus Partnerpreisen gebauten Markt: Marge je Buchmacher entfernt, dann gemittelt.",
  marketOnlyFarNote: "Der faire Preis unserer Zahl liegt mehr als 25 % vom besten Partnerpreis entfernt: Wir zeigen den Markt.",
};

const pt: ClassicCopy = {
  ourEstimate: "A nossa estimativa",
  ourModel: "O nosso modelo",
  market: "Mercado",
  blendInfo: "A nossa estimativa = {m}% modelo + {k}% mercado",
  infoLabel: "Como este número é calculado",
  marketOnly: "Só mercado",
  marketOnlyNote: "O nosso modelo está a mais de 25 pontos do mercado, por isso mostramos o mercado.",
  marketOnlyTennisNote: "Sem Elo recente no circuito ATP/WTA: mostramos o mercado.",
  partnerMarketNote: "Odd do parceiro, sem margem.",
  modelOnly: "Só modelo",
  modelOnlyNote: "Sem preço de mercado registado com esta leitura: só o nosso modelo, sem diferença.",
  protectedTag: "Protegida · sem sinal de valor",
  protectedNote: "O nosso modelo está a 15–25 pontos do mercado: sem sinal de valor.",
  eloBased: "Baseada em Elo, não selada",
  eloNote: "Estimativa = {e}% o nosso Elo + {k}% mercado.",
  gapAbove: "+{n} pts acima do mercado",
  gapBelow: "−{n} pts abaixo do mercado",
  inLine: "Em linha com o mercado",
  oddsOnPartnerSite: "Odds no site do parceiro",
  betAt: "Apostar na {book}",
  ad: "PUB · 18+",
  bestPrices: "Melhores preços",
  bestPrice: "Melhor preço",
  noPartnerPrice: "Sem preço de parceiro",
  pricesRemoved: "Preços retirados no início",
  kickoffAt: "Início {t}",
  tzNote: "Horas em {tz}",
  whereDiffers: "Onde a nossa estimativa mais se afasta",
  whereDiffersHint: "Jogos por começar em que a nossa estimativa e o mercado divergem, dentro da nossa proteção de 15 pontos. Uma leitura, não uma recomendação.",
  draw: "Empate",
  noPrice: "Ainda sem preço",
  noPriceNote: "Ainda sem número: nenhum preço de mercado corresponde a este pick e a leitura do modelo é antiga demais para aparecer sozinha.",
  noPriceTennisNote: "Ainda sem número: não há preço de mercado para este jogo, e nunca mostramos o nosso Elo de ténis sem ele.",
  partnerMarket: "Mercado a partir de preços de parceiros",
  partnerMarketInfo: "Só o nosso modelo (sem mercado registado para combinar), lido contra um mercado refeito com preços de parceiros: margem retirada por casa, depois média.",
  marketOnlyFarNote: "O preço justo do nosso número está a mais de 25% do melhor preço de parceiro: mostramos o mercado.",
};

const nl: ClassicCopy = {
  ourEstimate: "Onze schatting",
  ourModel: "Ons model",
  market: "Markt",
  blendInfo: "Onze schatting = {m}% model + {k}% markt",
  infoLabel: "Hoe dit getal ontstaat",
  marketOnly: "Alleen markt",
  marketOnlyNote: "Ons model zit meer dan 25 punten van de markt, dus tonen we de markt.",
  marketOnlyTennisNote: "Geen recente Elo op de ATP/WTA-tour: we tonen de markt.",
  partnerMarketNote: "Partnerquotering zonder marge.",
  modelOnly: "Alleen model",
  modelOnlyNote: "Geen marktprijs opgeslagen bij deze lezing: alleen ons model, geen verschil.",
  protectedTag: "Beschermd · geen waardesignaal",
  protectedNote: "Ons model zit 15–25 punten van de markt: geen waardesignaal.",
  eloBased: "Op Elo gebaseerd, niet verzegeld",
  eloNote: "Schatting = {e}% onze Elo + {k}% markt.",
  gapAbove: "+{n} ptn boven de markt",
  gapBelow: "−{n} ptn onder de markt",
  inLine: "In lijn met de markt",
  oddsOnPartnerSite: "Odds op de partnersite",
  betAt: "Wed bij {book}",
  ad: "ADV · 18+",
  bestPrices: "Beste prijzen",
  bestPrice: "Beste prijs",
  noPartnerPrice: "Geen partnerprijs",
  pricesRemoved: "Prijzen verwijderd bij de start",
  kickoffAt: "Aftrap {t}",
  tzNote: "Alle tijden {tz}",
  whereDiffers: "Waar onze schatting het meest afwijkt",
  whereDiffersHint: "Nog niet begonnen wedstrijden waarin onze schatting en de markt verschillen, binnen onze bescherming van 15 punten. Een lezing, geen advies.",
  draw: "Gelijkspel",
  noPrice: "Nog geen prijs",
  noPriceNote: "Nog geen getal: geen marktprijs past bij deze pick, en onze modellezing is te oud om alleen te tonen.",
  noPriceTennisNote: "Nog geen getal: geen marktprijs voor deze wedstrijd, en ons tennis-Elo tonen we nooit zonder.",
  partnerMarket: "Markt uit partnerprijzen",
  partnerMarketInfo: "Alleen ons model (geen opgeslagen markt om mee te mengen), gelezen tegen een markt opgebouwd uit partnerprijzen: marge per bookmaker eraf, dan gemiddeld.",
  marketOnlyFarNote: "De faire prijs van ons getal ligt meer dan 25% van de beste partnerprijs: we tonen de markt.",
};

const pl: ClassicCopy = {
  ourEstimate: "Nasze oszacowanie",
  ourModel: "Nasz model",
  market: "Rynek",
  blendInfo: "Nasze oszacowanie = {m}% model + {k}% rynek",
  infoLabel: "Jak powstaje ta liczba",
  marketOnly: "Tylko rynek",
  marketOnlyNote: "Nasz model jest ponad 25 punktów od rynku, więc pokazujemy rynek.",
  marketOnlyTennisNote: "Brak świeżego Elo w głównym cyklu ATP/WTA: pokazujemy rynek.",
  partnerMarketNote: "Kurs partnera bez marży.",
  modelOnly: "Tylko model",
  modelOnlyNote: "Brak ceny rynkowej zapisanej z tym odczytem: tylko nasz model, bez różnicy.",
  protectedTag: "Chronione · bez sygnału wartości",
  protectedNote: "Nasz model jest 15–25 punktów od rynku: bez sygnału wartości.",
  eloBased: "Na podstawie Elo, niezapieczętowane",
  eloNote: "Oszacowanie = {e}% nasze Elo + {k}% rynek.",
  gapAbove: "+{n} pkt powyżej rynku",
  gapBelow: "−{n} pkt poniżej rynku",
  inLine: "Zgodnie z rynkiem",
  oddsOnPartnerSite: "Kursy na stronie partnera",
  betAt: "Postaw w {book}",
  ad: "REKLAMA · 18+",
  bestPrices: "Najlepsze ceny",
  bestPrice: "Najlepsza cena",
  noPartnerPrice: "Brak ceny partnera",
  pricesRemoved: "Ceny usunięte na starcie",
  kickoffAt: "Start {t}",
  tzNote: "Wszystkie godziny {tz}",
  whereDiffers: "Gdzie nasze oszacowanie najbardziej się różni",
  whereDiffersHint: "Mecze przed startem, w których nasze oszacowanie i rynek się różnią, w granicach naszej 15-punktowej ochrony. Odczyt, nie rekomendacja.",
  draw: "Remis",
  noPrice: "Jeszcze bez ceny",
  noPriceNote: "Jeszcze bez liczby: żadna cena rynkowa nie pasuje do tego typu, a odczyt modelu jest zbyt stary, by stać sam.",
  noPriceTennisNote: "Jeszcze bez liczby: brak ceny rynkowej dla tego meczu, a naszego Elo tenisowego nigdy nie pokazujemy bez niej.",
  partnerMarket: "Rynek z cen partnerów",
  partnerMarketInfo: "Tylko nasz model (brak zapisanego rynku do połączenia), czytany wobec rynku odtworzonego z cen partnerów: marża usunięta dla każdego bukmachera, potem średnia.",
  marketOnlyFarNote: "Uczciwa cena naszej liczby różni się o ponad 25% od najlepszej ceny partnera: pokazujemy rynek.",
};

const tr: ClassicCopy = {
  ourEstimate: "Tahminimiz",
  ourModel: "Modelimiz",
  market: "Piyasa",
  blendInfo: "Tahminimiz = %{m} model + %{k} piyasa",
  infoLabel: "Bu sayı nasıl oluşuyor",
  marketOnly: "Yalnızca piyasa",
  marketOnlyNote: "Modelimiz piyasadan 25 puandan fazla uzakta, bu yüzden piyasayı gösteriyoruz.",
  marketOnlyTennisNote: "ATP/WTA ana turunda güncel Elo yok: piyasayı gösteriyoruz.",
  partnerMarketNote: "Marjı çıkarılmış partner oranı.",
  modelOnly: "Yalnızca model",
  modelOnlyNote: "Bu okumayla kaydedilmiş piyasa fiyatı yok: yalnızca modelimiz, fark yok.",
  protectedTag: "Korumalı · değer sinyali yok",
  protectedNote: "Modelimiz piyasadan 15–25 puan uzakta: değer sinyali yok.",
  eloBased: "Elo tabanlı, mühürlenmemiş",
  eloNote: "Tahmin = %{e} Elo'muz + %{k} piyasa.",
  gapAbove: "Piyasanın +{n} puan üstünde",
  gapBelow: "Piyasanın −{n} puan altında",
  inLine: "Piyasayla uyumlu",
  oddsOnPartnerSite: "Oranlar partner sitesinde",
  betAt: "{book} ile bahis yap",
  ad: "REKLAM · 18+",
  bestPrices: "En iyi fiyatlar",
  bestPrice: "En iyi fiyat",
  noPartnerPrice: "Partner fiyatı yok",
  pricesRemoved: "Fiyatlar başlangıçta kaldırıldı",
  kickoffAt: "Başlama {t}",
  tzNote: "Tüm saatler {tz}",
  whereDiffers: "Tahminimizin en çok ayrıştığı yerler",
  whereDiffersHint: "Tahminimizle piyasanın ayrıştığı, henüz başlamamış maçlar; 15 puanlık korumamızın içinde. Bir okuma, tavsiye değil.",
  draw: "Beraberlik",
  noPrice: "Henüz fiyat yok",
  noPriceNote: "Henüz sayı yok: bu seçimle eşleşen piyasa fiyatı yok ve model okumamız tek başına gösterilemeyecek kadar eski.",
  noPriceTennisNote: "Henüz sayı yok: bu maç için piyasa fiyatı yok ve tenis Elo'muzu asla fiyatsız göstermiyoruz.",
  partnerMarket: "Partner fiyatlarından piyasa",
  partnerMarketInfo: "Yalnızca modelimiz (karıştırılacak kayıtlı piyasa yok), partner fiyatlarından yeniden kurulan piyasaya karşı okunur: her sitenin marjı çıkarılır, sonra ortalama alınır.",
  marketOnlyFarNote: "Sayımızın adil fiyatı en iyi partner fiyatından %25'ten fazla uzak: piyasayı gösteriyoruz.",
};

const sv: ClassicCopy = {
  ourEstimate: "Vår uppskattning",
  ourModel: "Vår modell",
  market: "Marknad",
  blendInfo: "Vår uppskattning = {m} % modell + {k} % marknad",
  infoLabel: "Hur siffran tas fram",
  marketOnly: "Endast marknad",
  marketOnlyNote: "Vår modell ligger mer än 25 punkter från marknaden, så vi visar marknaden.",
  marketOnlyTennisNote: "Ingen färsk Elo på ATP/WTA-touren: vi visar marknaden.",
  partnerMarketNote: "Partnerns odds utan marginal.",
  modelOnly: "Endast modell",
  modelOnlyNote: "Inget marknadspris sparat med den här läsningen: bara vår modell, ingen skillnad.",
  protectedTag: "Skyddad · ingen värdesignal",
  protectedNote: "Vår modell ligger 15–25 punkter från marknaden: ingen värdesignal.",
  eloBased: "Elo-baserad, inte förseglad",
  eloNote: "Uppskattning = {e} % vår Elo + {k} % marknad.",
  gapAbove: "+{n} p över marknaden",
  gapBelow: "−{n} p under marknaden",
  inLine: "I linje med marknaden",
  oddsOnPartnerSite: "Odds på partnerns sajt",
  betAt: "Spela hos {book}",
  ad: "ANNONS · 18+",
  bestPrices: "Bästa priser",
  bestPrice: "Bästa pris",
  noPartnerPrice: "Inget partnerpris",
  pricesRemoved: "Priser borttagna vid start",
  kickoffAt: "Avspark {t}",
  tzNote: "Alla tider {tz}",
  whereDiffers: "Där vår uppskattning skiljer sig mest",
  whereDiffersHint: "Matcher som inte har börjat där vår uppskattning och marknaden skiljer sig åt, inom vårt skydd på 15 punkter. En läsning, inte en rekommendation.",
  draw: "Oavgjort",
  noPrice: "Inget pris än",
  noPriceNote: "Ingen siffra än: inget marknadspris matchar det här spelet, och vår modelläsning är för gammal för att stå ensam.",
  noPriceTennisNote: "Ingen siffra än: inget marknadspris för matchen, och vår tennis-Elo visas aldrig utan ett.",
  partnerMarket: "Marknad från partnerpriser",
  partnerMarketInfo: "Bara vår modell (ingen sparad marknad att blanda), läst mot en marknad byggd av partnerpriser: marginalen borttagen per spelbolag, sedan medelvärde.",
  marketOnlyFarNote: "Vår siffras rättvisa pris ligger mer än 25 % från bästa partnerpriset: vi visar marknaden.",
};

const ru: ClassicCopy = {
  ourEstimate: "Наша оценка",
  ourModel: "Наша модель",
  market: "Рынок",
  blendInfo: "Наша оценка = {m}% модель + {k}% рынок",
  infoLabel: "Как получено это число",
  marketOnly: "Только рынок",
  marketOnlyNote: "Наша модель расходится с рынком более чем на 25 пунктов, поэтому показываем рынок.",
  marketOnlyTennisNote: "Нет свежего Elo в основном туре ATP/WTA: показываем рынок.",
  partnerMarketNote: "Котировка партнёра без маржи.",
  modelOnly: "Только модель",
  modelOnlyNote: "С этим прогнозом не сохранена рыночная цена: только наша модель, без разницы.",
  protectedTag: "Защита · без сигнала ценности",
  protectedNote: "Наша модель расходится с рынком на 15–25 пунктов: без сигнала ценности.",
  eloBased: "На основе Elo, не зафиксировано",
  eloNote: "Оценка = {e}% наш Elo + {k}% рынок.",
  gapAbove: "+{n} п. выше рынка",
  gapBelow: "−{n} п. ниже рынка",
  inLine: "На уровне рынка",
  oddsOnPartnerSite: "Коэффициенты на сайте партнёра",
  betAt: "Ставка в {book}",
  ad: "РЕКЛАМА · 18+",
  bestPrices: "Лучшие цены",
  bestPrice: "Лучшая цена",
  noPartnerPrice: "Нет цены партнёра",
  pricesRemoved: "Цены сняты к началу",
  kickoffAt: "Начало {t}",
  tzNote: "Всё время — {tz}",
  whereDiffers: "Где наша оценка расходится сильнее всего",
  whereDiffersHint: "Матчи до начала, где наша оценка и рынок расходятся, в пределах нашей защиты в 15 пунктов. Чтение, а не рекомендация.",
  draw: "Ничья",
  noPrice: "Цены пока нет",
  noPriceNote: "Числа пока нет: ни одна рыночная цена не подходит к этому выбору, а показание модели слишком старое, чтобы стоять отдельно.",
  noPriceTennisNote: "Числа пока нет: для этого матча нет рыночной цены, а наш теннисный Elo без неё мы не показываем.",
  partnerMarket: "Рынок по ценам партнёров",
  partnerMarketInfo: "Только наша модель (нет сохранённого рынка для смешивания) против рынка, собранного из цен партнёров: маржа снята у каждой конторы, затем среднее.",
  marketOnlyFarNote: "Справедливая цена нашего числа отличается от лучшей цены партнёра более чем на 25%: показываем рынок.",
};

export const CLASSIC_COPY: Record<ClassicLang, ClassicCopy> = { en, it, es, fr, de, pt, nl, pl, tr, sv, ru };

/** Il copy della lingua; codice sconosciuto → inglese. */
export function classicCopy(lang: string | null | undefined): ClassicCopy {
  const k = (lang ?? "en").slice(0, 2).toLowerCase() as ClassicLang;
  return CLASSIC_COPY[k] ?? CLASSIC_COPY.en;
}

/** «{n}» e simili. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
