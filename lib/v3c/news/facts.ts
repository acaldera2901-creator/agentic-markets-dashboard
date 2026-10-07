// lib/v3c/news/facts.ts (#REDESIGN-V3C newswatch) — the mechanical fact barrier.
// Deterministic, no model, no network. Every number, score, time, date word and
// proper name in OUR note (EN and IT) must be present in the original text we
// were given (headline + teaser, + body when the source gives one); and a note
// that attributes a goal, a record, a quote, a cause, a venue, an injury, a
// transfer or a sacking needs the original to speak of the same kind of thing.
// Measured 07/10: 2 of 5 notes added facts («Ellis scored the goal», «matched
// Kane's record for England caps») that length/lexicon/anti-copy could not see.
//
// Direction of errors: a false positive drops a true note (cost: one note);
// a false negative publishes an invented fact. So unknown names are refused,
// and the alias list only widens what counts as «the same name».
import type { NoteText } from "./rewrite";

/** lower case, accents off, curly quotes straight */
export const fold = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase();

// ─── names: IT/EN forms of the same thing (folded; values are the canonical form) ──
// One canonical spelling per thing, applied to the note AND the original, so
// «Repubblica Ceca» in the note matches «Czechia» or «Czech Republic» in the source.
const CANON: Record<string, string> = {
  // countries (IT → EN; EN variants → one form)
  "stati uniti": "united states", usa: "united states", usmnt: "united states", "u.s": "united states", "united states of america": "united states",
  inghilterra: "england", "repubblica ceca": "czechia", cechia: "czechia", "czech republic": "czechia",
  croazia: "croatia", spagna: "spain", francia: "france", germania: "germany", italia: "italy", portogallo: "portugal",
  "paesi bassi": "netherlands", olanda: "netherlands", holland: "netherlands", belgio: "belgium", svizzera: "switzerland",
  scozia: "scotland", galles: "wales", irlanda: "ireland", "irlanda del nord": "northern ireland", danimarca: "denmark",
  svezia: "sweden", norvegia: "norway", finlandia: "finland", islanda: "iceland", polonia: "poland", ungheria: "hungary",
  turchia: "turkey", turkiye: "turkey", grecia: "greece", ucraina: "ukraine", russia: "russia", slovacchia: "slovakia",
  brasile: "brazil", messico: "mexico", giappone: "japan", "corea del sud": "south korea", marocco: "morocco",
  egitto: "egypt", camerun: "cameroon", "costa d'avorio": "ivory coast", "cote d'ivoire": "ivory coast",
  "arabia saudita": "saudi arabia", "nuova zelanda": "new zealand", sudafrica: "south africa", cile: "chile", peru: "peru",
  giamaica: "jamaica", algeria: "algeria", tunisia: "tunisia", cina: "china",
  // cities and grounds people translate
  fiume: "rijeka", monaco: "munich", "monaco di baviera": "munich", londra: "london", lisbona: "lisbon", siviglia: "seville",
  stadio: "stadium", estadio: "stadium", stade: "stadium", stadion: "stadium",
  // competitions
  mondiale: "world cup", mondiali: "world cup", "coppa del mondo": "world cup", "coppa america": "copa america",
  "lega delle nazioni": "nations league", europei: "euro", "campionato europeo": "euro",
  // clubs written two ways
  "bayern monaco": "bayern munich", "inter milan": "inter", internazionale: "inter", "man utd": "manchester united",
  "man united": "manchester united", "man city": "manchester city", psg: "paris saint germain",
  "paris saint-germain": "paris saint germain",
  // days and months (temporal: must be in the original too, see TEMPORAL)
  lunedi: "monday", martedi: "tuesday", mercoledi: "wednesday", giovedi: "thursday", venerdi: "friday", sabato: "saturday", domenica: "sunday",
  gennaio: "january", febbraio: "february", marzo: "march", aprile: "april", maggio: "may", giugno: "june", luglio: "july",
  agosto: "august", settembre: "september", ottobre: "october", novembre: "november", dicembre: "december",
  jan: "january", feb: "february", aug: "august", sept: "september", sep: "september", oct: "october", nov: "november", dec: "december",
};
const TEMPORAL = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december",
]);

/** Function words that start a sentence in EN or IT: capitalised, never a name. */
const STOP = new Set(
  (
    "the a an he she it they we i you his her their its this that these those there here both each all some no not but and or so as " +
    "in on at by for from of to with after before during while when despite following against over under into after since until " +
    "il lo la i gli le l un uno una e ed ha hanno ho è e' lui lei loro suo sua suoi sue nel nella nei negli nelle al alla ai agli alle " +
    "allo dal dalla dai dagli dalle del della dei degli delle dello sul sulla sui sugli sulle con per su da di tra fra dopo prima durante " +
    "questa questo questi queste quella quello ma come contro sono si non entrambe entrambi anche ancora poi mentre nonostante " +
    "terza terzo seconda secondo quarta quarto ultima ultimo nuova nuovo final last first new two three four five six seven eight nine ten " +
    "due tre quattro cinque sei sette otto nove dieci it's sette"
  ).split(" "),
);

// ─── numbers ───────────────────────────────────────────────────────────────────
// «one»/«un/una» are articles as often as numbers: not read. «primo/secondo/prima»
// mean «before»/«according to» too: not read. Source-only words widen support.
const NUM_EN: Record<string, string> = {
  two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", twenty: "20", hundred: "100",
  third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
};
const NUM_IT: Record<string, string> = {
  due: "2", tre: "3", quattro: "4", cinque: "5", sei: "6", sette: "7", otto: "8", nove: "9", dieci: "10", undici: "11", dodici: "12", venti: "20", cento: "100",
  terzo: "3", terza: "3", quarta: "4", quinto: "5", quinta: "5", sesto: "6", sesta: "6", settimo: "7", settima: "7", ottavo: "8", ottava: "8", nono: "9", nona: "9", decimo: "10", decima: "10",
  doppietta: "2", tripletta: "3",
};
/** Words in the ORIGINAL that state a number without writing it. */
const SOURCE_NUM_WORDS: Record<string, string> = { double: "2", brace: "2", pair: "2", "hat-trick": "3", hattrick: "3", treble: "3" };

// a trailing «.» or «,» ends the sentence; only «.5» / «,5» continue the number
const SCORE_RE = /(?<![\d.,:/])(\d{1,2})\s*[-–—]\s*(\d{1,2})(?!\d|[.,:/]\d)/g;
const TIME_RE = /(?<![\d.,])(\d{1,2})[:.](\d{2})(?!\d|[.,]\d)(?:\s*(?:am|pm|h))?/gi;
const NUMBER_RE = /(?<![\p{L}\d])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)/gu;

type Num = { scores: Set<string>; times: Set<string>; numbers: Set<string> };

const canonNumber = (raw: string): string => {
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return raw.replace(/[.,]/g, "");
  return raw.replace(",", ".").replace(/^0+(?=\d)/, "");
};

type Lang = "en" | "it" | "source";
const numWord = (w: string, lang: Lang): string | undefined =>
  lang === "en" ? NUM_EN[w] : lang === "it" ? NUM_IT[w] : (NUM_EN[w] ?? NUM_IT[w] ?? SOURCE_NUM_WORDS[w]);

function numbersOf(text: string, lang: Lang): Num {
  const source = lang === "source";
  const out: Num = { scores: new Set(), times: new Set(), numbers: new Set() };
  let rest = text;
  rest = rest.replace(SCORE_RE, (_m, a: string, b: string) => {
    out.scores.add(`${Number(a)}-${Number(b)}`);
    if (source) out.numbers.add(String(Number(a))).add(String(Number(b)));
    return " ";
  });
  rest = rest.replace(TIME_RE, (_m, h: string, m: string) => {
    out.times.add(`${Number(h)}:${m}`);
    return " ";
  });
  for (const m of rest.matchAll(NUMBER_RE)) out.numbers.add(canonNumber(m[1]));
  for (const w of fold(rest).split(/[^\p{L}\p{N}'-]+/u)) {
    const n = numWord(w, lang);
    if (n) out.numbers.add(n);
  }
  return out;
}

// ─── tokens with case ──────────────────────────────────────────────────────────

type Tok = { f: string; cap: boolean; initial: boolean; temporal?: boolean };

/** IT elisions: «l'Argentina» → «Argentina» (the article is not a name). */
const ELISION = /^(l|d|dell|all|dall|nell|sull|coll|un|quest|quell|c|s|n|m|t|v)'(?=\p{L})/iu;

function tokens(text: string): Tok[] {
  const out: Tok[] = [];
  for (const sentence of text.split(/(?<=[.!?;:])\s+|\s+[—–-]\s+|\n+/)) {
    let first = true;
    for (const m of sentence.matchAll(/[\p{L}\p{N}]+(?:['’.][\p{L}]+)*(?:-[\p{L}\p{N}]+)*/gu)) {
      let raw = m[0].replace(/['’]s$/i, "").replace(/s['’]$/i, "s");
      let initial = first;
      first = false;
      const el = raw.match(ELISION);
      if (el) {
        raw = raw.slice(el[0].length);
        initial = false; // «L'Argentina»: the article was the first word
      }
      raw = raw.replace(/['’]/g, "'");
      for (const part of raw.split("-")) {
        if (!part) continue;
        out.push({ f: fold(part), cap: /^\p{Lu}/u.test(part), initial });
        initial = false;
      }
    }
  }
  return canonicalise(out);
}

const CANON_KEYS = Object.keys(CANON)
  .map((k) => k.split(" "))
  .sort((a, b) => b.length - a.length);

/** Longest alias first; a matched phrase becomes the canonical tokens. */
function canonicalise(ts: Tok[]): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < ts.length; ) {
    let hit: string[] | null = null;
    for (const k of CANON_KEYS) {
      if (i + k.length <= ts.length && k.every((w, j) => ts[i + j].f === w)) {
        hit = k;
        break;
      }
    }
    if (!hit) {
      out.push(ts[i]);
      i++;
      continue;
    }
    const span = ts.slice(i, i + hit.length);
    const canon = CANON[hit.join(" ")];
    const cap = span.some((t) => t.cap);
    for (const [j, w] of canon.split(" ").entries()) out.push({ f: w, cap, initial: j === 0 && span[0].initial, temporal: TEMPORAL.has(w) });
    i += hit.length;
  }
  for (const t of out) if (TEMPORAL.has(t.f)) t.temporal = true;
  return out;
}

// ─── claims that need the original to speak of the same thing ────────────────
// [what in the note triggers it, what in the original supports it] (folded text)
const CLAIMS: [string, RegExp, RegExp][] = [
  ["goal/scorer", /\b(scor\w*|goals?|netted|nets|segn\w*|gol|reti|rete|doppiett\w*|triplett\w*|hat.?trick|brace|marcator\w*)\b/, /\b(scor\w*|goals?|gol|net(s|ted)?|segn\w*|reti|rete|doppiett\w*|triplett\w*|hat.?trick|brace|double|treble|strike|struck|header)\b/],
  ["record", /\b(record\w*|primat\w*)\b/, /\b(record\w*|primat\w*)\b/],
  ["home/away", /\b(home|away|hosts?|hosted|hosting|in casa|trasferta|fuori casa|ospit\w*|padroni di casa)\b/, /\b(home|away|hosts?|hosted|hosting|in casa|trasferta|fuori casa|ospit\w*|padroni di casa)\b/],
  ["injury", /\b(injur\w*|infortun\w*|ruled out|sidelined)\b/, /\b(injur\w*|infortun\w*|ruled out|sidelined|casualty|knock)\b/],
  ["quote", /\b(said|says|say|told|tells|claim\w*|insist\w*|admit\w*|reveal\w*|explain\w*|prais\w*|laud\w*|hail\w*|dichiar\w*|detto|dice|afferm\w*|ammess\w*|ammett\w*|rivel\w*|sostien\w*|spieg\w*|elogi\w*|lod\w*)\b|["“”«»]/, /\b(said|says|say|told|tells|claim\w*|insist\w*|admit\w*|reveal\w*|explain\w*|prais\w*|laud\w*|hail\w*|statement|interview|dichiar\w*|detto|dice|afferm\w*|ammess\w*|ammett\w*|rivel\w*|sostien\w*|spieg\w*|elogi\w*|lod\w*)\b|["“”«»]|(^|\s)'[^']{3,}'/],
  ["cause", /\b(because|due to|caused|thanks to|as a result|a causa|perche|grazie a|per via|a seguito)\b/, /\b(because|due to|caused|thanks to|as a result|a causa|perche|grazie a|per via|a seguito)\b/],
  ["transfer", /\b(sign(s|ed|ing)?|transfer\w*|contract\w*|loan\w*|deal|fee|ingagg\w*|contratt\w*|prestit\w*|trasferiment\w*|acquist\w*|firm(a|ato|ano)|cession\w*)\b/, /\b(sign(s|ed|ing)?|transfer\w*|contract\w*|loan\w*|deal|fee|bid\w*|ingagg\w*|contratt\w*|prestit\w*|trasferiment\w*|acquist\w*|firm(a|ato|ano)|cession\w*)\b/],
  ["sacking", /\b(sack\w*|fired|dismiss\w*|esoner\w*|licenzi\w*|resign\w*|dimess\w*|dimission\w*)\b/, /\b(sack\w*|fired|dismiss\w*|esoner\w*|licenzi\w*|resign\w*|dimess\w*|dimission\w*|depart\w*|axed)\b/],
  ["when", /\b(yesterday|today|tonight|last night|tomorrow|ieri|oggi|stasera|stanotte|domani)\b/, /\b(yesterday|today|tonight|last night|tomorrow|ieri|oggi|stasera|stanotte|domani)\b/],
];

// ─── Italian: the article must agree with the country ────────────────────────
const IT_MASC_NOUNS = "benin|canada|brasile|belgio|portogallo|giappone|messico|marocco|senegal|camerun|galles|peru|cile|paraguay|uruguay|ecuador|qatar|egitto|ghana|togo|mali|niger|gabon|venezuela|kosovo|montenegro|lussemburgo|kazakistan|sudafrica|libano|honduras|panama|guatemala|salvador|burkina faso|congo|sudan|kenya|zambia|zimbabwe|mozambico|madagascar|bahrein|kuwait|oman|vietnam|pakistan|bangladesh|nepal";
const IT_FEM_NOUNS = "argentina|francia|germania|spagna|italia|inghilterra|scozia|irlanda|croazia|colombia|nigeria|serbia|svizzera|svezia|norvegia|danimarca|polonia|turchia|grecia|austria|ungheria|romania|bulgaria|slovenia|slovacchia|ucraina|russia|finlandia|islanda|albania|bosnia|macedonia|georgia|armenia|cechia|repubblica ceca|australia|tunisia|algeria|bolivia|giamaica|arabia saudita|corea del sud|cina|nuova zelanda|costa d'avorio|olanda";
const BAD_ARTICLE = [
  // feminine article before a masculine country: «la Benin», «della Benin»
  new RegExp(`\\b(la|della|alla|dalla|nella|sulla|colla)\\s+(${IT_MASC_NOUNS})\\b`),
  // masculine article before a feminine country: «il Argentina», «del Germania»
  new RegExp(`\\b(il|lo|del|dello|al|allo|dal|dallo|nel|nello|sul|sullo)\\s+(${IT_FEM_NOUNS})\\b`),
  // plural countries: «gli Stati Uniti», «i Paesi Bassi»
  /\b(la|il|lo|della|del|alla|al|dalla|dal|nella|nel)\s+(stati uniti|paesi bassi|emirati arabi uniti)\b/,
];

export function italianArticleError(it: NoteText): string | null {
  const t = fold(`${it.title}. ${it.body}`);
  for (const re of BAD_ARTICLE) {
    const m = t.match(re);
    if (m) return `it: article «${m[0]}»`;
  }
  return null;
}

// ─── the check ───────────────────────────────────────────────────────────────

export type FactSource = { title: string; text: string; body?: string };

export type FactReport = { ok: boolean; unsupported: string[] };

/** Every fact-bearing token of the note found in the original? Pure. */
export function checkFacts(note: { en: NoteText; it: NoteText }, src: FactSource): FactReport {
  const sourceText = [src.title, src.text, src.body ?? ""].join(". ");
  const sNum = numbersOf(sourceText, "source");
  const sTok = new Set(tokens(sourceText).map((t) => t.f));
  const sFold = fold(sourceText);
  const missing: string[] = [];
  const miss = (lang: string, what: string) => {
    const k = `${lang}: ${what}`;
    if (!missing.includes(k)) missing.push(k);
  };

  for (const [lang, t] of [["en", note.en], ["it", note.it]] as const) {
    const text = `${t.title}. ${t.body}`;
    const n = numbersOf(text, lang);
    for (const s of n.scores) {
      const [a, b] = s.split("-");
      if (!sNum.scores.has(s) && !sNum.scores.has(`${b}-${a}`)) miss(lang, `score ${s}`);
    }
    for (const x of n.times) if (!sNum.times.has(x)) miss(lang, `time ${x}`);
    for (const x of n.numbers) if (!sNum.numbers.has(x)) miss(lang, `number ${x}`);

    for (const tok of tokens(text)) {
      if (/\d/.test(tok.f) || numWord(tok.f, lang)) continue; // numbers are checked above
      const nameLike = tok.cap && !(tok.initial && STOP.has(tok.f));
      if (!nameLike && !tok.temporal) continue;
      if (!sTok.has(tok.f)) miss(lang, tok.temporal ? `date «${tok.f}»` : `name «${tok.f}»`);
    }

    const f = fold(text);
    for (const [label, inNote, inSource] of CLAIMS) if (inNote.test(f) && !inSource.test(sFold)) miss(lang, `${label} not in the original`);
  }
  const art = italianArticleError(note.it);
  if (art) missing.push(art);
  return { ok: missing.length === 0, unsupported: missing };
}
