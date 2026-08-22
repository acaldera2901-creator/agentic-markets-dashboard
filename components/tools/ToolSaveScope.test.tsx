// components/tools/ToolSaveScope.test.tsx — #TOOLS-SAVE-0810
// Il salvataggio legge e riscrive lo stato dei calcolatori dal DOM, senza che
// nessuno dei loro undici file venga toccato (vedi la nota in
// lib/tools/save-state.ts). Il prezzo di quella scelta è che dipende dal markup
// di parts.tsx: questo file è la rete che la rende sicura. Se qualcuno cambia
// Field o Segmented, qui diventa rosso — non in produzione su 121 pagine.
//
// Due cose separate:
//  1. il round-trip cattura → sporca → ripristina su TUTTI e undici i tool;
//  2. il comportamento della riga: anonimo = link e ZERO rete, loggato = salva.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCalculator } from "./ToolCalculator";
import { ToolSaveScope } from "./ToolSaveScope";
import { TOOL_SLUGS, type ToolSlug } from "@/lib/tools/registry";
import { getToolsCopy } from "@/lib/tools/copy";
import {
  applyGroups,
  applyInputs,
  captureState,
  groupsMatch,
  summarizeCalc,
  type ToolSave,
} from "@/lib/tools/save-state";

const copy = getToolsCopy("en");
const PROFILE_KEY = "agentic-client-profile";

function mountScope(slug: ToolSlug) {
  return render(
    <ToolSaveScope slug={slug} copy={copy.common}>
      <ToolCalculator slug={slug} copy={copy.tools[slug]} dash={copy.common.invalid} />
    </ToolSaveScope>
  );
}

const calcOf = (container: HTMLElement): Element => {
  const el = container.querySelector(".tl-calc");
  if (!el) throw new Error("nessun .tl-calc montato");
  return el;
};

describe("cattura e ripristino dal DOM", () => {
  for (const slug of TOOL_SLUGS) {
    it(`${slug}: lo stato torna esattamente quello di prima`, async () => {
      const { container } = render(
        <ToolCalculator slug={slug} copy={copy.tools[slug]} dash={copy.common.invalid} />
      );
      const calc = calcOf(container);

      const before = captureState(calc);
      expect(before.inputs.length, "un calcolatore senza campi").toBeGreaterThan(0);
      const resultBefore = calc.querySelector(".tl-out.is-strong .tl-out-val")?.textContent;
      expect(resultBefore, "manca il readout in evidenza").toBeTruthy();

      // Sporca ogni campo con un valore diverso dai default e verifica che la
      // cattura veda ciò che l'utente vede.
      const dirty = { inputs: before.inputs.map(() => "1.23"), groups: before.groups };
      await act(async () => {
        applyInputs(calc, dirty);
      });
      expect(captureState(calc).inputs).toEqual(dirty.inputs);

      // Ripristina: campi identici E stesso risultato a schermo. Il readout è la
      // verifica vera — dice che il valore è arrivato allo stato di React e non
      // solo all'attributo value dell'input.
      await act(async () => {
        applyInputs(calc, before);
      });
      expect(captureState(calc)).toEqual(before);
      expect(calc.querySelector(".tl-out.is-strong .tl-out-val")?.textContent).toBe(resultBefore);
    });
  }

  it("i segmentati si ripremono, e groupsMatch smette di chiedere", async () => {
    // Il convertitore ha un segmentato (decimale/americana/frazionaria/implicita).
    const { container } = render(
      <ToolCalculator
        slug="odds-converter"
        copy={copy.tools["odds-converter"]}
        dash={copy.common.invalid}
      />
    );
    const calc = calcOf(container);
    const target = { ...captureState(calc), groups: [1] };
    expect(groupsMatch(calc, target)).toBe(false);
    await act(async () => {
      applyGroups(calc, target);
    });
    expect(groupsMatch(calc, target)).toBe(true);
    expect(captureState(calc).groups).toEqual([1]);
  });

  it("la sintesi del chip è il primo risultato in evidenza, non un id", () => {
    const { container } = render(
      <ToolCalculator
        slug="odds-converter"
        copy={copy.tools["odds-converter"]}
        dash={copy.common.invalid}
      />
    );
    // Il convertitore mette in evidenza DUE readout: il formato scelto e la
    // probabilità implicita. Vince il primo — "2.50 · Decimal" è ciò che uno
    // riconosce del proprio calcolo, e la regola resta una sola per undici tool.
    expect(summarizeCalc(calcOf(container))).toBe("2.50 · Decimal");
  });

  it("applyInputs rifiuta un numero di campi diverso invece di riempirne metà", async () => {
    const { container } = render(
      <ToolCalculator
        slug="kelly-criterion"
        copy={copy.tools["kelly-criterion"]}
        dash={copy.common.invalid}
      />
    );
    const calc = calcOf(container);
    const before = captureState(calc);
    expect(applyInputs(calc, { inputs: ["1", "2"], groups: [] })).toBe(false);
    expect(captureState(calc)).toEqual(before);
  });
});

describe("la riga «salva questo calcolo»", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("da anonimo è un link a registrarsi, e NON tocca la rete", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = mountScope("odds-converter");
    // L'attesa serve a dare all'effetto di mount la possibilità di sbagliare.
    await act(async () => {});

    const cta = screen.getByTestId("tool-save-cta");
    expect(cta).toHaveAttribute("href", "/app?auth=register");
    expect(cta.textContent).toBe(copy.common.saveCta);
    expect(screen.queryByTestId("tool-save")).toBeNull();
    expect(container.textContent).toContain(copy.common.saveHintAnon);
    // Il punto del vincolo: una pagina SEO non spende una richiesta per un
    // visitatore anonimo, che è la quasi totalità del traffico organico.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con un profilo locale ma la sessione scaduta (401) resta anonima", async () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ email: "a@b.it", plan: "free" }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "login required" }),
    }) as unknown as typeof fetch;

    mountScope("odds-converter");
    await act(async () => {});
    expect(screen.getByTestId("tool-save-cta")).toBeTruthy();
    expect(screen.queryByTestId("tool-save")).toBeNull();
  });

  it("da loggato mostra i salvataggi e ne ricarica uno con un clic", async () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ email: "a@b.it", plan: "free" }));
    const saved: ToolSave = {
      id: 7,
      summary: "1.50 · Decimal",
      state: { inputs: ["1.50"], groups: [0] },
      created_at: "2026-08-10T10:00:00Z",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ saves: [saved] }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    const { container } = mountScope("odds-converter");
    await waitFor(() => expect(screen.getByTestId("tool-save")).toBeTruthy());
    const chip = await screen.findByText(saved.summary);

    await user.click(chip);
    await waitFor(() =>
      expect(captureState(calcOf(container)).inputs).toEqual(saved.state.inputs)
    );
    // Ricaricato per davvero: 1.50 → 66.67% implicito.
    expect(screen.getByTestId("out-implied").textContent).toBe("66.67%");
  });

  it("il salvataggio manda lo stato catturato e la sintesi, e aggiorna la lista", async () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ email: "a@b.it", plan: "free" }));
    const fetchMock = vi
      .fn()
      // GET al mount: nessun salvataggio ancora.
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ saves: [] }) })
      // POST: la rotta risponde con la lista fresca (exec_sql non dà RETURNING).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          saves: [
            {
              id: 1,
              summary: "2.50 · Decimal",
              state: { inputs: ["2.50"], groups: [0] },
              created_at: "2026-08-10T10:00:00Z",
            },
          ],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    mountScope("odds-converter");
    await waitFor(() => expect(screen.getByTestId("tool-save")).toBeTruthy());
    await user.click(screen.getByTestId("tool-save"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/tools/saves");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.slug).toBe("odds-converter");
    expect(body.state.inputs).toEqual(["2.50"]);
    expect(body.summary).toBe("2.50 · Decimal");
    // La lista che torna dal server è quella che si vede.
    expect(await screen.findByText("2.50 · Decimal")).toBeTruthy();
  });

  it("un salvataggio fallito lo dice, e non lascia il bottone bloccato", async () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ email: "a@b.it", plan: "free" }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ saves: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "save failed" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    mountScope("odds-converter");
    await waitFor(() => expect(screen.getByTestId("tool-save")).toBeTruthy());
    await user.click(screen.getByTestId("tool-save"));

    expect(await screen.findByText(copy.common.saveError)).toBeTruthy();
    expect(screen.getByTestId("tool-save")).not.toBeDisabled();
  });
});

describe("ripristino su un calcolatore a righe variabili", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("la multipla si porta a sei gambe prima di riempirle", async () => {
    // Il caso che senza la macchina a stati mostrerebbe un risultato SBAGLIATO:
    // sei gambe salvate, calcolatore che ne monta quattro. Sei valori diversi,
    // così un ordine sbagliato si vedrebbe subito.
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ email: "a@b.it", plan: "free" }));
    const legs = ["1.50", "1.60", "1.70", "1.80", "1.90", "2.00"];
    const saved: ToolSave = {
      id: 3,
      summary: "27.91 · Combined odds",
      state: { inputs: [...legs, "5"], groups: [] },
      created_at: "2026-08-10T10:00:00Z",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ saves: [saved] }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    const { container } = mountScope("parlay-calculator");
    const calc = calcOf(container);
    // Default: quattro gambe + il margine per gamba.
    expect(captureState(calc).inputs).toHaveLength(5);

    await user.click(await screen.findByText(saved.summary));
    await waitFor(() =>
      expect(captureState(calcOf(container)).inputs).toEqual(saved.state.inputs)
    );
    // 1.5·1.6·1.7·1.8·1.9·2.0 = 27.9072 → 27.91 — il numero prova che i sei
    // valori sono finiti nelle gambe giuste e non spostati di una posizione.
    expect(screen.getByTestId("out-parlay-total").textContent).toBe("27.91");
  });

  it("il margine cresce di una riga quando il salvataggio ne ha una in più", async () => {
    const { container } = render(
      <ToolCalculator
        slug="margin-calculator"
        copy={copy.tools["margin-calculator"]}
        dash={copy.common.invalid}
      />
    );
    // Il default del margine è già a due esiti: qui si verifica il verso
    // opposto della macchina, cioè che si possa CRESCERE di una riga.
    const calc = calcOf(container);
    const start = captureState(calc).inputs.length;
    const { stepRows } = await import("@/lib/tools/save-state");
    await act(async () => {
      stepRows(calc, +1);
    });
    expect(captureState(calcOf(container)).inputs).toHaveLength(start + 1);
  });
});
