// lib/v3c/fixui2-copy.ts (#REDESIGN-V3C fixui2) — the strings of the third UI round (QA-REPORT-2:
// B3 N1 N4 N5 N6 N8), in the 11 languages. A file of its own so the parallel data filone (fixdata2)
// and this one never edit the same dictionary. Terms from docs/redesign/i18n-glossary.md; checked
// by lib/v3c/i18n-parity.test.ts. // REVIEW-NATIVE (seal and members wording: legal-adjacent)
import { v3cLang, type V3cLang } from "./copy";

export type Fixui2Copy = {
  /** B3: the one discreet link to today's sign-in flow (footer only, Fase 0) */
  existingMembers: string;
  existingMembersTitle: string;
  /** N4: the price check opens on the visitor's prices, not on a price no book offers */
  enterPrice: string;
  emptyPrices: string;
  /** N6: ?m= of a match the price check cannot open */
  notListed: string;
  /** N8: a ledger row written after kick-off is not a pre-match seal */
  loggedLabel: string;
  loggedWhy: (time: string) => string;
  loggedTitle: string;
  loggedBody: (time: string) => string;
  /** N1: the bench of the home without a real match it may use */
  benchSample: string;
  /** N5: /community in Fase 0 is a neutral preview, no paywall */
  cmPreviewTitle: string;
  cmPreviewSub: string;
  cmLockedLine: string;
};

const EN: Fixui2Copy = {
  existingMembers: "Existing members",
  existingMembersTitle: "Sign in on the current site",
  enterPrice: "Enter the price you see",
  emptyPrices: "Type the prices from your book: the margin and the probabilities appear here.",
  notListed: "This match is not in the price check: it has started or has no prices yet.",
  loggedLabel: "logged",
  loggedWhy: (t) => `Entered the public ledger on ${t}, after kick-off: not a pre-match seal.`,
  loggedTitle: "Logged after kick-off",
  loggedBody: (t) => `This row entered the public ledger on ${t}, after the start: it is not a pre-match seal.`,
  benchSample: "Example numbers, not a real match: no match on today’s board fits the example yet.",
  cmPreviewTitle: "Creator slips · preview",
  cmPreviewSub: "Matches are visible to everyone. Legs and probabilities are not shown in this preview.",
  cmLockedLine: "Preview: legs and probability not shown",
};

const IT: Fixui2Copy = {
  existingMembers: "Utenti già registrati",
  existingMembersTitle: "Accedi sul sito attuale",
  enterPrice: "Scrivi il prezzo che vedi",
  emptyPrices: "Scrivi i prezzi del tuo book: margine e probabilità compaiono qui.",
  notListed: "Questa partita non è nel controllo prezzo: è iniziata o non ha ancora prezzi.",
  loggedLabel: "registrato",
  loggedWhy: (t) => `Entrata nel registro pubblico il ${t}, dopo il fischio d’inizio: non è un sigillo pre-partita.`,
  loggedTitle: "Registrata dopo il fischio d’inizio",
  loggedBody: (t) => `Questa riga è entrata nel registro pubblico il ${t}, dopo l’inizio: non è un sigillo pre-partita.`,
  benchSample: "Numeri d’esempio, non una partita vera: nessuna partita della board di oggi si presta ancora all’esempio.",
  cmPreviewTitle: "Schedine dei creator · anteprima",
  cmPreviewSub: "Le partite sono visibili a tutti. Selezioni e probabilità non compaiono in questa anteprima.",
  cmLockedLine: "Anteprima: selezioni e probabilità non mostrate",
};

const DE: Fixui2Copy = {
  existingMembers: "Bestehende Mitglieder",
  existingMembersTitle: "Auf der aktuellen Seite anmelden",
  enterPrice: "Gib die Quote ein, die du siehst",
  emptyPrices: "Gib die Quoten deines Buchmachers ein: Marge und Wahrscheinlichkeiten erscheinen hier.",
  notListed: "Dieses Spiel ist nicht im Quoten-Check: Es hat begonnen oder hat noch keine Quoten.",
  loggedLabel: "erfasst",
  loggedWhy: (t) => `Am ${t} ins öffentliche Register eingetragen, nach dem Anstoß: kein Siegel vor dem Spiel.`,
  loggedTitle: "Nach dem Anstoß erfasst",
  loggedBody: (t) => `Diese Zeile kam am ${t} ins öffentliche Register, nach dem Start: kein Siegel vor dem Spiel.`,
  benchSample: "Beispielzahlen, kein echtes Spiel: Noch passt kein Spiel des heutigen Boards zum Beispiel.",
  cmPreviewTitle: "Creator-Scheine · Vorschau",
  cmPreviewSub: "Die Spiele sieht jeder. Auswahlen und Wahrscheinlichkeiten zeigt diese Vorschau nicht.",
  cmLockedLine: "Vorschau: Auswahlen und Wahrscheinlichkeit nicht gezeigt",
};

const ES: Fixui2Copy = {
  existingMembers: "Miembros actuales",
  existingMembersTitle: "Inicia sesión en el sitio actual",
  enterPrice: "Escribe la cuota que ves",
  emptyPrices: "Escribe las cuotas de tu casa de apuestas: el margen y las probabilidades aparecen aquí.",
  notListed: "Este partido no está en la comprobación de cuotas: ha empezado o aún no tiene cuotas.",
  loggedLabel: "registrado",
  loggedWhy: (t) => `Entró en el registro público el ${t}, después del inicio: no es un sello previo al partido.`,
  loggedTitle: "Registrado después del inicio",
  loggedBody: (t) => `Esta fila entró en el registro público el ${t}, después del inicio: no es un sello previo al partido.`,
  benchSample: "Números de ejemplo, no un partido real: ningún partido del tablero de hoy sirve aún para el ejemplo.",
  cmPreviewTitle: "Boletos de creadores · vista previa",
  cmPreviewSub: "Los partidos los ve todo el mundo. Las selecciones y probabilidades no aparecen en esta vista previa.",
  cmLockedLine: "Vista previa: selecciones y probabilidad no mostradas",
};

const FR: Fixui2Copy = {
  existingMembers: "Membres existants",
  existingMembersTitle: "Se connecter sur le site actuel",
  enterPrice: "Saisissez la cote que vous voyez",
  emptyPrices: "Saisissez les cotes de votre bookmaker : la marge et les probabilités s’affichent ici.",
  notListed: "Ce match n’est pas dans la vérification des cotes : il a commencé ou n’a pas encore de cotes.",
  loggedLabel: "enregistré",
  loggedWhy: (t) => `Entré au registre public le ${t}, après le coup d’envoi : ce n’est pas un sceau d’avant-match.`,
  loggedTitle: "Enregistré après le coup d’envoi",
  loggedBody: (t) => `Cette ligne est entrée au registre public le ${t}, après le début : ce n’est pas un sceau d’avant-match.`,
  benchSample: "Chiffres d’exemple, pas un vrai match : aucun match du tableau du jour ne convient encore à l’exemple.",
  cmPreviewTitle: "Tickets des créateurs · aperçu",
  cmPreviewSub: "Les matchs sont visibles par tous. Sélections et probabilités ne figurent pas dans cet aperçu.",
  cmLockedLine: "Aperçu : sélections et probabilité non affichées",
};

const NL: Fixui2Copy = {
  existingMembers: "Bestaande leden",
  existingMembersTitle: "Inloggen op de huidige site",
  enterPrice: "Vul de odds in die je ziet",
  emptyPrices: "Vul de odds van je bookmaker in: de marge en de kansen verschijnen hier.",
  notListed: "Deze wedstrijd staat niet in de odds-check: hij is begonnen of heeft nog geen odds.",
  loggedLabel: "vastgelegd",
  loggedWhy: (t) => `Op ${t} in het openbare register gekomen, na de aftrap: geen zegel van vóór de wedstrijd.`,
  loggedTitle: "Vastgelegd na de aftrap",
  loggedBody: (t) => `Deze rij kwam op ${t} in het openbare register, na de start: geen zegel van vóór de wedstrijd.`,
  benchSample: "Voorbeeldcijfers, geen echte wedstrijd: nog geen wedstrijd van het board van vandaag past bij het voorbeeld.",
  cmPreviewTitle: "Creator-slips · preview",
  cmPreviewSub: "Wedstrijden ziet iedereen. Selecties en kansen staan niet in deze preview.",
  cmLockedLine: "Preview: selecties en kans niet getoond",
};

const PL: Fixui2Copy = {
  existingMembers: "Obecni członkowie",
  existingMembersTitle: "Zaloguj się na obecnej stronie",
  enterPrice: "Wpisz kurs, który widzisz",
  emptyPrices: "Wpisz kursy swojego bukmachera: marża i prawdopodobieństwa pojawią się tutaj.",
  notListed: "Tego meczu nie ma w sprawdzaniu kursu: już się zaczął albo nie ma jeszcze kursów.",
  loggedLabel: "zapisany",
  loggedWhy: (t) => `Trafił do publicznego rejestru ${t}, po początku meczu: to nie jest pieczęć przedmeczowa.`,
  loggedTitle: "Zapisany po początku meczu",
  loggedBody: (t) => `Ten wiersz trafił do publicznego rejestru ${t}, po starcie: to nie jest pieczęć przedmeczowa.`,
  benchSample: "Przykładowe liczby, nie prawdziwy mecz: żaden mecz z dzisiejszej tablicy nie pasuje jeszcze do przykładu.",
  cmPreviewTitle: "Kupony twórców · podgląd",
  cmPreviewSub: "Mecze widzi każdy. Nogi i prawdopodobieństwa nie są pokazane w tym podglądzie.",
  cmLockedLine: "Podgląd: nogi i prawdopodobieństwo niepokazane",
};

const PT: Fixui2Copy = {
  existingMembers: "Membros atuais",
  existingMembersTitle: "Iniciar sessão no site atual",
  enterPrice: "Escreve a odd que vês",
  emptyPrices: "Escreve as odds da tua casa de apostas: a margem e as probabilidades aparecem aqui.",
  notListed: "Este jogo não está na verificação de odds: já começou ou ainda não tem odds.",
  loggedLabel: "registado",
  loggedWhy: (t) => `Entrou no registo público a ${t}, depois do início: não é um selo pré-jogo.`,
  loggedTitle: "Registado depois do início",
  loggedBody: (t) => `Esta linha entrou no registo público a ${t}, depois do início: não é um selo pré-jogo.`,
  benchSample: "Números de exemplo, não um jogo real: nenhum jogo do board de hoje serve ainda para o exemplo.",
  cmPreviewTitle: "Boletins dos criadores · pré-visualização",
  cmPreviewSub: "Os jogos são visíveis para todos. Seleções e probabilidades não aparecem nesta pré-visualização.",
  cmLockedLine: "Pré-visualização: seleções e probabilidade não mostradas",
};

const RU: Fixui2Copy = {
  existingMembers: "Уже зарегистрированы",
  existingMembersTitle: "Войти на текущем сайте",
  enterPrice: "Введите коэффициент, который видите",
  emptyPrices: "Введите коэффициенты вашего букмекера: маржа и вероятности появятся здесь.",
  notListed: "Этого матча нет в проверке коэффициента: он уже начался или у него ещё нет коэффициентов.",
  loggedLabel: "записано",
  loggedWhy: (t) => `Внесено в публичный реестр ${t}, после начала: это не печать до матча.`,
  loggedTitle: "Записано после начала",
  loggedBody: (t) => `Эта строка попала в публичный реестр ${t}, после начала: это не печать до матча.`,
  benchSample: "Условные числа, не реальный матч: ни один матч сегодняшней панели пока не подходит для примера.",
  cmPreviewTitle: "Купоны авторов · предпросмотр",
  cmPreviewSub: "Матчи видны всем. Выборы и вероятности в этом предпросмотре не показаны.",
  cmLockedLine: "Предпросмотр: выборы и вероятность не показаны",
};

const SV: Fixui2Copy = {
  existingMembers: "Befintliga medlemmar",
  existingMembersTitle: "Logga in på nuvarande sajt",
  enterPrice: "Skriv in oddset du ser",
  emptyPrices: "Skriv in ditt spelbolags odds: marginalen och sannolikheterna visas här.",
  notListed: "Den här matchen finns inte i oddskollen: den har startat eller har inga odds än.",
  loggedLabel: "registrerad",
  loggedWhy: (t) => `Kom in i det offentliga registret ${t}, efter avspark: inte ett sigill före matchen.`,
  loggedTitle: "Registrerad efter avspark",
  loggedBody: (t) => `Raden kom in i det offentliga registret ${t}, efter start: inte ett sigill före matchen.`,
  benchSample: "Exempelsiffror, ingen riktig match: ingen match på dagens board passar exemplet än.",
  cmPreviewTitle: "Skaparnas kuponger · förhandsvisning",
  cmPreviewSub: "Matcherna syns för alla. Val och sannolikheter visas inte i den här förhandsvisningen.",
  cmLockedLine: "Förhandsvisning: val och sannolikhet visas inte",
};

const TR: Fixui2Copy = {
  existingMembers: "Mevcut üyeler",
  existingMembersTitle: "Mevcut sitede giriş yap",
  enterPrice: "Gördüğün oranı yaz",
  emptyPrices: "Bahis sitenin oranlarını yaz: marj ve olasılıklar burada görünür.",
  notListed: "Bu maç oran kontrolünde yok: başladı ya da henüz oranı yok.",
  loggedLabel: "kaydedildi",
  loggedWhy: (t) => `Herkese açık kayıt defterine ${t} tarihinde, başlamadan sonra girdi: maç öncesi mühür değil.`,
  loggedTitle: "Başlamadan sonra kaydedildi",
  loggedBody: (t) => `Bu satır kayıt defterine ${t} tarihinde, başlangıçtan sonra girdi: maç öncesi mühür değil.`,
  benchSample: "Örnek rakamlar, gerçek maç değil: bugünkü panodaki hiçbir maç henüz örneğe uymuyor.",
  cmPreviewTitle: "Yaratıcı kuponları · önizleme",
  cmPreviewSub: "Maçları herkes görür. Seçimler ve olasılıklar bu önizlemede gösterilmez.",
  cmLockedLine: "Önizleme: seçimler ve olasılık gösterilmiyor",
};

export const FIXUI2_COPY: Record<V3cLang, Fixui2Copy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function fixui2CopyFor(lang: string | null | undefined): Fixui2Copy {
  return FIXUI2_COPY[v3cLang(lang)];
}
