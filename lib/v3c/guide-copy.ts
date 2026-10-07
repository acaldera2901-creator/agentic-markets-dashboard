// lib/v3c/guide-copy.ts (#REDESIGN-V3C fixui) — le stringhe nuove dell'orientamento:
// la riga «cos'è BetRedge» sotto la data della home (QA A1 / UX-AUDIT #1) con la
// partita d'esempio, il pannello «How to read this page» (UX-AUDIT #2, §5: nove voci,
// stesso testo ovunque), la nota del fuso (QA M2: un fuso, dichiarato una volta per
// vista) e la voce «More» della barra in basso. EN è la fonte, IT approvata dal
// UX-AUDIT, le altre nove seguono docs/redesign/i18n-glossary.md. ≤ 22 parole
// per elemento; le voci del glossario ≤ 12 parole come chiede l'audit.
// Lessico: book's chance · estimate · gap (in points) · sealed · record. Mai
// «predictions», «picks», promesse di vincita. Il tennis non ha una stima sigillata.
import { v3cLang, type V3cLang } from "./copy";

export type GlossaryKey = "odds" | "market" | "estimate" | "gap" | "sealed" | "record" | "brier" | "best" | "tennis";
export const GLOSSARY_KEYS: readonly GlossaryKey[] = ["odds", "market", "estimate", "gap", "sealed", "record", "brier", "best", "tennis"];

const EN = {
  hero: {
    what: "Is this price fair? We turn odds into probabilities, put our estimate beside them and keep every result.",
    exampleToday: "Today, for example",
    exampleNext: "Coming up, for example",
    odds: (label: string, price: string) => `${label} at ${price}`,
    market: (p: string) => `book’s chance ${p}%`,
    estimate: (p: string) => `our estimate ${p}%`,
    gap: (g: string) => `gap ${g} pts`,
    open: "Open the match",
  },
  glossary: {
    title: "How to read this page",
    close: "Close",
    info: (term: string) => `What is “${term}”?`,
    method: "The full method",
    terms: {
      odds: ["Odds", "The book’s price; 2.00 pays twice your stake."],
      market: ["Book’s chance (market %)", "The odds as a probability, with the book’s cut removed."],
      estimate: ["Estimate", "Our number: 70% the market, 30% our model, in football."],
      gap: ["Gap (points)", "Our estimate minus the book’s chance. Under 1.5: in line."],
      sealed: ["Sealed", "Saved before kick-off with its time; can’t be edited."],
      record: ["Record", "Every sealed estimate and how it ended, won and lost."],
      brier: ["Brier", "Accuracy score: lower is better. Ours sits next to the market’s."],
      best: ["Best price", "Highest odds among the books we read live."],
      tennis: ["Tennis", "Mostly the market’s chance; 10% our Elo where fresh, never sealed."],
    } as Record<GlossaryKey, [string, string]>,
  },
  tz: (abbr: string) => `Times in your time zone (${abbr})`,
  more: { label: "More", title: "More pages and language" },
};

export type GuideCopy = typeof EN;

const IT: GuideCopy = {
  hero: {
    what: "Questa quota è giusta? Trasformiamo le quote in probabilità, ci mettiamo accanto la nostra stima e conserviamo ogni esito.",
    exampleToday: "Oggi, per esempio",
    exampleNext: "In arrivo, per esempio",
    odds: (label, price) => `${label} a ${price}`,
    market: (p) => `probabilità del book ${p}%`,
    estimate: (p) => `nostra stima ${p}%`,
    gap: (g) => `gap ${g} punti`,
    open: "Apri la partita",
  },
  glossary: {
    title: "Come leggere questa pagina",
    close: "Chiudi",
    info: (term) => `Che cos’è «${term}»?`,
    method: "Il metodo completo",
    terms: {
      odds: ["Quota", "Il prezzo del book; 2,00 paga il doppio della puntata."],
      market: ["Probabilità del book (mercato %)", "La quota come probabilità, tolto il margine del book."],
      estimate: ["Stima", "Il nostro numero: 70% mercato, 30% modello, nel calcio."],
      gap: ["Gap (punti)", "Stima meno probabilità del book. Sotto 1,5: in linea."],
      sealed: ["Sigillata", "Salvata prima del calcio d’inizio, con l’ora; non modificabile."],
      record: ["Registro", "Ogni stima sigillata e com’è finita, vinte e perse."],
      brier: ["Brier", "Punteggio di precisione: più basso è meglio. Accanto, quello del mercato."],
      best: ["Miglior prezzo", "La quota più alta fra i book che leggiamo in diretta."],
      tennis: ["Tennis", "Soprattutto la probabilità del mercato; 10% nostro Elo dove è recente, mai sigillata."],
    },
  },
  tz: (abbr) => `Orari nel tuo fuso (${abbr})`,
  more: { label: "Altro", title: "Altre pagine e lingua" },
};

const DE: GuideCopy = {
  hero: {
    what: "Ist diese Quote fair? Wir machen aus Quoten Wahrscheinlichkeiten, stellen unsere Schätzung daneben und behalten jedes Ergebnis.",
    exampleToday: "Heute zum Beispiel",
    exampleNext: "Demnächst zum Beispiel",
    odds: (label, price) => `${label} zu ${price}`,
    market: (p) => `Chance laut Buchmacher ${p}%`,
    estimate: (p) => `unsere Schätzung ${p}%`,
    gap: (g) => `Abstand ${g} Pkt.`,
    open: "Spiel öffnen",
  },
  glossary: {
    title: "So liest du diese Seite",
    close: "Schließen",
    info: (term) => `Was heißt „${term}“?`,
    method: "Die ganze Methode",
    terms: {
      odds: ["Quote", "Der Preis des Buchmachers; 2,00 zahlt das Doppelte deines Einsatzes."],
      market: ["Chance laut Buchmacher (Markt-%)", "Die Quote als Wahrscheinlichkeit, ohne die Marge des Buchmachers."],
      estimate: ["Schätzung", "Unsere Zahl: 70% Markt, 30% unser Modell, im Fußball."],
      gap: ["Abstand (Punkte)", "Unsere Schätzung minus die Chance laut Buchmacher. Unter 1,5: im Rahmen."],
      sealed: ["Versiegelt", "Vor dem Anstoß mit Uhrzeit gespeichert; nicht änderbar."],
      record: ["Register", "Jede versiegelte Schätzung und wie sie ausging, gewonnen und verloren."],
      brier: ["Brier", "Genauigkeitswert: niedriger ist besser. Unserer steht neben dem des Markts."],
      best: ["Beste Quote", "Die höchste Quote unter den Buchmachern, die wir live lesen."],
      tennis: ["Tennis", "Vor allem die Chance des Markts; 10% unser Elo, wo frisch, nie versiegelt."],
    },
  },
  tz: (abbr) => `Zeiten in deiner Zeitzone (${abbr})`,
  more: { label: "Mehr", title: "Weitere Seiten und Sprache" },
};

const ES: GuideCopy = {
  hero: {
    what: "¿Es justa esta cuota? Convertimos las cuotas en probabilidades, ponemos nuestra estimación al lado y guardamos cada resultado.",
    exampleToday: "Hoy, por ejemplo",
    exampleNext: "Próximamente, por ejemplo",
    odds: (label, price) => `${label} a ${price}`,
    market: (p) => `probabilidad de la casa ${p}%`,
    estimate: (p) => `nuestra estimación ${p}%`,
    gap: (g) => `diferencia ${g} pts`,
    open: "Abrir el partido",
  },
  glossary: {
    title: "Cómo leer esta página",
    close: "Cerrar",
    info: (term) => `¿Qué es «${term}»?`,
    method: "El método completo",
    terms: {
      odds: ["Cuota", "El precio de la casa; 2,00 paga el doble de tu apuesta."],
      market: ["Probabilidad de la casa (% de mercado)", "La cuota como probabilidad, sin el margen de la casa."],
      estimate: ["Estimación", "Nuestro número: 70% mercado, 30% nuestro modelo, en fútbol."],
      gap: ["Diferencia (puntos)", "Nuestra estimación menos la probabilidad de la casa. Bajo 1,5: en línea."],
      sealed: ["Sellado", "Guardado antes del inicio, con su hora; no se puede editar."],
      record: ["Registro", "Cada estimación sellada y cómo acabó, ganadas y perdidas."],
      brier: ["Brier", "Puntuación de precisión: cuanto más baja, mejor. La nuestra junto a la del mercado."],
      best: ["Mejor cuota", "La cuota más alta entre las casas que leemos en directo."],
      tennis: ["Tenis", "Sobre todo la probabilidad del mercado; 10% nuestro Elo si es reciente, nunca sellado."],
    },
  },
  tz: (abbr) => `Horas en tu zona horaria (${abbr})`,
  more: { label: "Más", title: "Más páginas e idioma" },
};

const FR: GuideCopy = {
  hero: {
    what: "Cette cote est-elle juste ? Nous transformons les cotes en probabilités, plaçons notre estimation à côté et gardons chaque résultat.",
    exampleToday: "Aujourd’hui, par exemple",
    exampleNext: "Bientôt, par exemple",
    odds: (label, price) => `${label} à ${price}`,
    market: (p) => `chance selon le bookmaker ${p} %`,
    estimate: (p) => `notre estimation ${p} %`,
    gap: (g) => `écart ${g} pts`,
    open: "Ouvrir le match",
  },
  glossary: {
    title: "Comment lire cette page",
    close: "Fermer",
    info: (term) => `Que signifie « ${term} » ?`,
    method: "La méthode complète",
    terms: {
      odds: ["Cote", "Le prix du bookmaker ; 2,00 paie deux fois votre mise."],
      market: ["Chance selon le bookmaker (% du marché)", "La cote en probabilité, marge du bookmaker retirée."],
      estimate: ["Estimation", "Notre chiffre : 70 % marché, 30 % notre modèle, au football."],
      gap: ["Écart (points)", "Notre estimation moins la chance du bookmaker. Sous 1,5 : en ligne."],
      sealed: ["Scellé", "Enregistré avant le coup d’envoi, avec l’heure ; non modifiable."],
      record: ["Registre", "Chaque estimation scellée et son issue, gagnées et perdues."],
      brier: ["Brier", "Score de précision : plus bas, c’est mieux. Le nôtre à côté de celui du marché."],
      best: ["Meilleure cote", "La cote la plus haute parmi les bookmakers lus en direct."],
      tennis: ["Tennis", "Surtout la chance du marché ; 10 % notre Elo s’il est récent, jamais scellé."],
    },
  },
  tz: (abbr) => `Heures dans votre fuseau (${abbr})`,
  more: { label: "Plus", title: "Autres pages et langue" },
};

const NL: GuideCopy = {
  hero: {
    what: "Is deze odd eerlijk? We maken van odds kansen, zetten onze schatting ernaast en bewaren elke uitslag.",
    exampleToday: "Vandaag bijvoorbeeld",
    exampleNext: "Binnenkort bijvoorbeeld",
    odds: (label, price) => `${label} op ${price}`,
    market: (p) => `kans volgens bookmaker ${p}%`,
    estimate: (p) => `onze schatting ${p}%`,
    gap: (g) => `verschil ${g} ptn`,
    open: "Open de wedstrijd",
  },
  glossary: {
    title: "Zo lees je deze pagina",
    close: "Sluiten",
    info: (term) => `Wat is ‘${term}’?`,
    method: "De volledige methode",
    terms: {
      odds: ["Odds", "De prijs van de bookmaker; 2,00 betaalt twee keer je inzet."],
      market: ["Kans volgens bookmaker (markt-%)", "De odds als kans, zonder de marge van de bookmaker."],
      estimate: ["Schatting", "Ons getal: 70% markt, 30% ons model, bij voetbal."],
      gap: ["Verschil (punten)", "Onze schatting min de kans volgens de bookmaker. Onder 1,5: in lijn."],
      sealed: ["Verzegeld", "Voor de aftrap opgeslagen met tijd; niet te wijzigen."],
      record: ["Register", "Elke verzegelde schatting en hoe die afliep, gewonnen en verloren."],
      brier: ["Brier", "Nauwkeurigheidsscore: lager is beter. De onze naast die van de markt."],
      best: ["Beste odds", "De hoogste odds bij de bookmakers die we live lezen."],
      tennis: ["Tennis", "Vooral de kans van de markt; 10% onze Elo waar vers, nooit verzegeld."],
    },
  },
  tz: (abbr) => `Tijden in je tijdzone (${abbr})`,
  more: { label: "Meer", title: "Meer pagina’s en taal" },
};

const PL: GuideCopy = {
  hero: {
    what: "Czy ten kurs jest uczciwy? Zamieniamy kursy na prawdopodobieństwa, stawiamy obok nasz szacunek i zachowujemy każdy wynik.",
    exampleToday: "Dziś na przykład",
    exampleNext: "Wkrótce na przykład",
    odds: (label, price) => `${label} po ${price}`,
    market: (p) => `szansa wg bukmachera ${p}%`,
    estimate: (p) => `nasz szacunek ${p}%`,
    gap: (g) => `różnica ${g} pkt`,
    open: "Otwórz mecz",
  },
  glossary: {
    title: "Jak czytać tę stronę",
    close: "Zamknij",
    info: (term) => `Co oznacza „${term}”?`,
    method: "Pełna metoda",
    terms: {
      odds: ["Kurs", "Cena bukmachera; 2,00 wypłaca dwukrotność stawki."],
      market: ["Szansa wg bukmachera (% rynku)", "Kurs jako prawdopodobieństwo, bez marży bukmachera."],
      estimate: ["Szacunek", "Nasza liczba: 70% rynek, 30% nasz model, w piłce nożnej."],
      gap: ["Różnica (punkty)", "Nasz szacunek minus szansa wg bukmachera. Poniżej 1,5: w normie."],
      sealed: ["Zapieczętowany", "Zapisany przed początkiem meczu, z godziną; nie do zmiany."],
      record: ["Rejestr", "Każdy zapieczętowany szacunek i jak się skończył, wygrane i przegrane."],
      brier: ["Brier", "Wynik trafności: im niższy, tym lepiej. Nasz obok wyniku rynku."],
      best: ["Najlepszy kurs", "Najwyższy kurs u bukmacherów, których czytamy na żywo."],
      tennis: ["Tenis", "Głównie szansa rynku; 10% nasze Elo, gdy świeże, nigdy nie pieczętowane."],
    },
  },
  tz: (abbr) => `Godziny w twojej strefie (${abbr})`,
  more: { label: "Więcej", title: "Więcej stron i język" },
};

const PT: GuideCopy = {
  hero: {
    what: "Esta odd é justa? Transformamos odds em probabilidades, pomos a nossa estimativa ao lado e guardamos cada resultado.",
    exampleToday: "Hoje, por exemplo",
    exampleNext: "Em breve, por exemplo",
    odds: (label, price) => `${label} a ${price}`,
    market: (p) => `probabilidade da casa ${p}%`,
    estimate: (p) => `a nossa estimativa ${p}%`,
    gap: (g) => `diferença ${g} pts`,
    open: "Abrir o jogo",
  },
  glossary: {
    title: "Como ler esta página",
    close: "Fechar",
    info: (term) => `O que é «${term}»?`,
    method: "O método completo",
    terms: {
      odds: ["Odd", "O preço da casa; 2,00 paga o dobro da tua aposta."],
      market: ["Probabilidade da casa (% de mercado)", "A odd como probabilidade, sem a margem da casa."],
      estimate: ["Estimativa", "O nosso número: 70% mercado, 30% o nosso modelo, no futebol."],
      gap: ["Diferença (pontos)", "A nossa estimativa menos a probabilidade da casa. Abaixo de 1,5: em linha."],
      sealed: ["Selado", "Guardado antes do início, com a hora; não pode ser editado."],
      record: ["Registo", "Cada estimativa selada e como acabou, ganhas e perdidas."],
      brier: ["Brier", "Pontuação de precisão: mais baixa é melhor. A nossa ao lado da do mercado."],
      best: ["Melhor odd", "A odd mais alta entre as casas que lemos ao vivo."],
      tennis: ["Ténis", "Sobretudo a probabilidade do mercado; 10% o nosso Elo quando recente, nunca selado."],
    },
  },
  tz: (abbr) => `Horas no teu fuso horário (${abbr})`,
  more: { label: "Mais", title: "Mais páginas e idioma" },
};

const RU: GuideCopy = {
  hero: {
    what: "Справедлив ли этот коэффициент? Мы переводим коэффициенты в вероятности, ставим рядом нашу оценку и сохраняем каждый результат.",
    exampleToday: "Сегодня, например",
    exampleNext: "Скоро, например",
    odds: (label, price) => `${label} по ${price}`,
    market: (p) => `шанс по букмекеру ${p}%`,
    estimate: (p) => `наша оценка ${p}%`,
    gap: (g) => `разрыв ${g} п.п.`,
    open: "Открыть матч",
  },
  glossary: {
    title: "Как читать эту страницу",
    close: "Закрыть",
    info: (term) => `Что значит «${term}»?`,
    method: "Метод целиком",
    terms: {
      odds: ["Коэффициент", "Цена букмекера; 2,00 возвращает удвоенную ставку."],
      market: ["Шанс по букмекеру (% рынка)", "Коэффициент как вероятность, без маржи букмекера."],
      estimate: ["Оценка", "Наше число: 70% рынок, 30% наша модель, в футболе."],
      gap: ["Разрыв (пункты)", "Наша оценка минус шанс по букмекеру. Меньше 1,5: в пределах рынка."],
      sealed: ["Зафиксирован", "Сохранён до начала матча со временем; изменить нельзя."],
      record: ["Реестр", "Каждая зафиксированная оценка и чем она закончилась, выигрыши и проигрыши."],
      brier: ["Brier", "Показатель точности: чем ниже, тем лучше. Наш рядом с рыночным."],
      best: ["Лучший коэффициент", "Самый высокий коэффициент среди букмекеров, которых мы читаем вживую."],
      tennis: ["Теннис", "В основном шанс рынка; 10% наш Elo, если свежий, никогда не фиксируется."],
    },
  },
  tz: (abbr) => `Время в вашем часовом поясе (${abbr})`,
  more: { label: "Ещё", title: "Другие страницы и язык" },
};

const SV: GuideCopy = {
  hero: {
    what: "Är oddset rimligt? Vi gör odds till sannolikheter, ställer vår uppskattning bredvid och sparar varje resultat.",
    exampleToday: "I dag, till exempel",
    exampleNext: "Snart, till exempel",
    odds: (label, price) => `${label} till ${price}`,
    market: (p) => `spelbolagets chans ${p} %`,
    estimate: (p) => `vår uppskattning ${p} %`,
    gap: (g) => `skillnad ${g} p`,
    open: "Öppna matchen",
  },
  glossary: {
    title: "Så läser du sidan",
    close: "Stäng",
    info: (term) => `Vad betyder ”${term}”?`,
    method: "Hela metoden",
    terms: {
      odds: ["Odds", "Spelbolagets pris; 2,00 betalar dubbla insatsen."],
      market: ["Spelbolagets chans (marknads-%)", "Oddset som sannolikhet, utan spelbolagets marginal."],
      estimate: ["Uppskattning", "Vår siffra: 70 % marknad, 30 % vår modell, i fotboll."],
      gap: ["Skillnad (punkter)", "Vår uppskattning minus spelbolagets chans. Under 1,5: i linje."],
      sealed: ["Förseglad", "Sparad före avspark med tid; kan inte ändras."],
      record: ["Register", "Varje förseglad uppskattning och hur den slutade, vunna och förlorade."],
      brier: ["Brier", "Precisionsmått: lägre är bättre. Vårt står bredvid marknadens."],
      best: ["Bästa odds", "Högsta oddset bland spelbolagen vi läser live."],
      tennis: ["Tennis", "Mest marknadens chans; 10 % vår Elo när den är färsk, aldrig förseglad."],
    },
  },
  tz: (abbr) => `Tider i din tidszon (${abbr})`,
  more: { label: "Mer", title: "Fler sidor och språk" },
};

const TR: GuideCopy = {
  hero: {
    what: "Bu oran adil mi? Oranları olasılığa çeviriyor, yanına kendi tahminimizi koyuyor ve her sonucu saklıyoruz.",
    exampleToday: "Bugün, örneğin",
    exampleNext: "Yakında, örneğin",
    odds: (label, price) => `${label}: ${price}`,
    market: (p) => `sitenin şansı %${p}`,
    estimate: (p) => `tahminimiz %${p}`,
    gap: (g) => `fark ${g} puan`,
    open: "Maçı aç",
  },
  glossary: {
    title: "Bu sayfa nasıl okunur",
    close: "Kapat",
    info: (term) => `“${term}” ne demek?`,
    method: "Yöntemin tamamı",
    terms: {
      odds: ["Oran", "Bahis sitesinin fiyatı; 2,00 yatırdığının iki katını öder."],
      market: ["Sitenin şansı (piyasa %)", "Oranın olasılık hali, sitenin marjı çıkarılmış."],
      estimate: ["Tahmin", "Bizim sayımız: futbolda %70 piyasa, %30 modelimiz."],
      gap: ["Fark (puan)", "Tahminimiz eksi sitenin şansı. 1,5'in altı: çizgide."],
      sealed: ["Mühürlü", "Başlamadan önce saatiyle kaydedildi; değiştirilemez."],
      record: ["Kayıt defteri", "Her mühürlü tahmin ve nasıl bittiği, kazanılan ve kaybedilen."],
      brier: ["Brier", "Doğruluk puanı: düşük olan iyidir. Bizimki piyasanınkinin yanında."],
      best: ["En iyi oran", "Canlı okuduğumuz siteler arasındaki en yüksek oran."],
      tennis: ["Tenis", "Çoğunlukla piyasanın şansı; taze olduğunda %10 Elo'muz, asla mühürlenmez."],
    },
  },
  tz: (abbr) => `Saatler senin saat diliminde (${abbr})`,
  more: { label: "Daha fazla", title: "Diğer sayfalar ve dil" },
};

export const GUIDE_COPY: Record<V3cLang, GuideCopy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function guideCopyFor(lang: string | null | undefined): GuideCopy {
  return GUIDE_COPY[v3cLang(lang)];
}
