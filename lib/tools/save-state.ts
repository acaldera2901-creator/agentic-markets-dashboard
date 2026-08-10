// lib/tools/save-state.ts — #TOOLS-SAVE-0810
// Lo stato salvabile di un calcolatore, e come si legge/riscrive dal DOM.
//
// SCORCIATOIA DICHIARATA: lo stato si cattura leggendo il DOM del calcolatore
// (`input.tl-input` e il bottone premuto di ogni `.tl-seg`) invece di essere
// esposto dai singoli calcolatori. Il limite è che dipende dal markup di
// components/tools/parts.tsx — se Field/Segmented cambiano classe, questo si
// rompe. In cambio: undici calcolatori guadagnano il salvataggio senza che
// nessuno dei loro file venga toccato, e ToolCalculator/parts/registry restano
// intatti (sono condivisi da 121 pagine). Il round-trip è coperto da un test su
// TUTTI e undici i tool, quindi la rottura sarebbe rossa in CI e non in
// produzione. Percorso di upgrade, se un giorno serve di più (es. salvare anche
// stato che non è in un campo): ogni calcolatore espone il suo stato con un hook
// e questo file diventa solo il validatore.

/** Undici tool, dieci campi al massimo (Ev ne ha 5, la multipla fino a 9). */
export const MAX_INPUTS = 12;
export const MAX_INPUT_LEN = 24;
export const MAX_GROUPS = 6;
export const MAX_SUMMARY_LEN = 80;
/** Cinque per (utente, tool), FIFO: è un promemoria, non un archivio. */
export const MAX_SAVES_PER_TOOL = 5;

export type ToolSaveState = {
  /** Valori dei campi in ordine di DOM. La lunghezza è anche il NUMERO di
   *  campi: multipla e margine ne hanno un numero variabile. */
  inputs: string[];
  /** Per ogni gruppo segmentato, l'indice del bottone premuto (−1 = nessuno). */
  groups: number[];
};

export type ToolSave = {
  id: number;
  summary: string;
  state: ToolSaveState;
  created_at: string;
};

// ─────────────────────────── validazione (trust boundary) ───────────────────
// Il corpo della POST arriva da un browser: qui è l'unico punto in cui si
// decide che forma ha. Tutto ciò che non combacia è 400, non un salvataggio
// "quasi giusto" che poi rompe il restore.

/** Lo stato inviato dal client, o null se non è della forma attesa. */
export function parseSaveState(value: unknown): ToolSaveState | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as { inputs?: unknown; groups?: unknown };
  if (!Array.isArray(raw.inputs) || !Array.isArray(raw.groups)) return null;
  if (raw.inputs.length === 0 || raw.inputs.length > MAX_INPUTS) return null;
  if (raw.groups.length > MAX_GROUPS) return null;
  const inputs: string[] = [];
  for (const v of raw.inputs) {
    if (typeof v !== "string" || v.length > MAX_INPUT_LEN) return null;
    inputs.push(v);
  }
  const groups: number[] = [];
  for (const v of raw.groups) {
    // Indice di un bottone in un segmentato: intero piccolo. −1 = nessuno premuto.
    if (typeof v !== "number" || !Number.isInteger(v) || v < -1 || v > 31) return null;
    groups.push(v);
  }
  return { inputs, groups };
}

/** La sintesi mostrata sul chip, tagliata. Vuota o non-stringa → null. */
export function parseSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // \s comprende gli a-capo: una sintesi è una riga sola.
  const clean = value.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_LEN);
  return clean.length ? clean : null;
}

// ─────────────────────────── DOM: cattura e ripristino ──────────────────────

const inputsIn = (calc: Element): HTMLInputElement[] =>
  Array.from(calc.querySelectorAll<HTMLInputElement>("input.tl-input"));

const groupsIn = (calc: Element): HTMLElement[] =>
  Array.from(calc.querySelectorAll<HTMLElement>(".tl-seg"));

const buttonsIn = (group: Element): HTMLButtonElement[] =>
  Array.from(group.querySelectorAll<HTMLButtonElement>("button"));

export function captureState(calc: Element): ToolSaveState {
  return {
    inputs: inputsIn(calc).map((el) => el.value.slice(0, MAX_INPUT_LEN)),
    groups: groupsIn(calc).map((g) =>
      buttonsIn(g).findIndex((b) => b.getAttribute("aria-pressed") === "true")
    ),
  };
}

/** La riga del chip: il readout in evidenza è la RISPOSTA del calcolatore, ed è
 *  quello che uno si ricorda del proprio calcolo. */
export function summarizeCalc(calc: Element): string {
  const strong = calc.querySelector(".tl-out.is-strong");
  const value = strong?.querySelector(".tl-out-val")?.textContent?.trim() ?? "";
  const label = strong?.querySelector(".tl-out-lab")?.textContent?.trim() ?? "";
  const parts = [value, label].filter(Boolean);
  return parseSummary(parts.join(" · ")) ?? "—";
}

/** Un input controllato da React non si aggiorna scrivendo `.value`: il valore
 *  va scritto col setter nativo e poi annunciato con un evento `input`, che è
 *  quello su cui React monta onChange. Senza il setter nativo React non vede il
 *  cambiamento e al render successivo rimette il valore vecchio. */
function setInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Quante righe mancano (positivo) o sono in eccesso (negativo) perché il
 *  calcolatore abbia lo stesso numero di campi del salvataggio. Multipla e
 *  margine hanno un numero variabile di gambe: se non si pareggia prima, un
 *  salvataggio da 6 gambe ricaricato su una pagina da 4 riempirebbe 4 campi e
 *  mostrerebbe un risultato SBAGLIATO senza dirlo. */
export function rowDelta(calc: Element, state: ToolSaveState): number {
  return state.inputs.length - inputsIn(calc).length;
}

/** Aggiunge o togli UNA riga cliccando i bottoni del calcolatore stesso.
 *  Torna false se il calcolatore non ha il bottone che servirebbe. */
export function stepRows(calc: Element, delta: number): boolean {
  const btn =
    delta > 0
      ? calc.querySelector<HTMLButtonElement>("button.tl-btn")
      : buttonsIn(calc).filter((b) => b.classList.contains("tl-btn-ghost")).pop();
  if (!btn || btn.disabled) return false;
  btn.click();
  return true;
}

/** I segmentati sono già nella posizione salvata? Indice −1, gruppo assente o
 *  indice fuori scala contano come "a posto": non ci si accanisce su un markup
 *  che non è quello del salvataggio, si evita solo di ripristinare a metà. */
export function groupsMatch(calc: Element, state: ToolSaveState): boolean {
  const groups = groupsIn(calc);
  return state.groups.every((idx, gi) => {
    const group = groups[gi];
    if (idx < 0 || !group) return true;
    const btn = buttonsIn(group)[idx];
    return !btn || btn.getAttribute("aria-pressed") === "true";
  });
}

/** Ripreme i segmentati. Va fatto PRIMA dei campi e in un commit separato:
 *  il segmentato di EV cambia i campi stessi (manuale = 3, sharp = 4), e quello
 *  del probability calculator scambia il campo probabilità col campo quota. Se
 *  si scrivessero i valori nello stesso giro, l'evento `input` arriverebbe
 *  all'onChange ANCORA VECCHIO — il valore finirebbe nella variabile sbagliata. */
export function applyGroups(calc: Element, state: ToolSaveState): void {
  const groups = groupsIn(calc);
  state.groups.forEach((idx, gi) => {
    const group = groups[gi];
    if (idx < 0 || !group) return;
    const btn = buttonsIn(group)[idx];
    if (btn && btn.getAttribute("aria-pressed") !== "true") btn.click();
  });
}

/** Riempie i campi. Da chiamare solo con i segmentati già a posto e rowDelta a
 *  zero: torna false senza toccare niente se il numero di campi non combacia. */
export function applyInputs(calc: Element, state: ToolSaveState): boolean {
  const fields = inputsIn(calc);
  if (fields.length !== state.inputs.length) return false;
  fields.forEach((el, i) => setInputValue(el, state.inputs[i]));
  return true;
}
