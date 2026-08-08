// components/tools/calculators.test.tsx (#TOOLS-HUB-0805)
// La matematica è già coperta da lib/betting-math.test.ts. Qui si verifica che i
// calcolatori la CHIAMINO bene: che l'input arrivi al posto giusto, che il
// risultato compaia, e che un campo vuoto o spazzatura non produca "NaN".

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCalculator } from "./ToolCalculator";
import { TOOL_SLUGS } from "@/lib/tools/registry";
import { getToolsCopy } from "@/lib/tools/copy";

const copy = getToolsCopy("en");

function mount(slug: (typeof TOOL_SLUGS)[number]) {
  return render(<ToolCalculator slug={slug} copy={copy.tools[slug]} dash={copy.common.invalid} />);
}

describe("tutti i calcolatori", () => {
  for (const slug of TOOL_SLUGS) {
    it(`${slug}: monta e non scrive mai NaN`, () => {
      const { container } = mount(slug);
      expect(container.textContent).not.toContain("NaN");
      expect(container.textContent).not.toContain("Infinity");
      expect(container.querySelector(".tl-calc")).toBeTruthy();
    });
  }
});

describe("odds converter", () => {
  it("2.50 diventa +150, 3/2 e 40%", async () => {
    const user = userEvent.setup();
    mount("odds-converter");
    const input = screen.getByLabelText("Odds");
    await user.clear(input);
    await user.type(input, "2.50");
    expect(screen.getByTestId("out-american").textContent).toBe("+150");
    expect(screen.getByTestId("out-fractional").textContent).toBe("3/2");
    expect(screen.getByTestId("out-implied").textContent).toBe("40.00%");
  });

  it("un input senza senso non produce numeri finti", async () => {
    const user = userEvent.setup();
    mount("odds-converter");
    const input = screen.getByLabelText("Odds");
    await user.clear(input);
    await user.type(input, "banana");
    expect(screen.getByTestId("out-american").textContent).toBe("—");
    expect(screen.getByTestId("out-implied").textContent).toBe("—");
  });
});

describe("margin calculator", () => {
  it("1.90/1.90 dà 5.26% di margine e quote eque 2.00", async () => {
    const user = userEvent.setup();
    mount("margin-calculator");
    const first = screen.getByLabelText("Outcome 1");
    const second = screen.getByLabelText("Outcome 2");
    await user.clear(first);
    await user.type(first, "1.90");
    await user.clear(second);
    await user.type(second, "1.90");
    expect(screen.getByTestId("out-margin").textContent).toBe("5.26%");
    expect(screen.getByTestId("out-payout").textContent).toBe("95.00%");
    expect(screen.getByTestId("out-fair-1").textContent).toBe("2.00");
  });

  it("aggiunge un terzo esito", async () => {
    const user = userEvent.setup();
    mount("margin-calculator");
    await user.click(screen.getByRole("button", { name: "Add outcome" }));
    expect(screen.getByLabelText("Outcome 3")).toBeTruthy();
  });
});

describe("ev calculator", () => {
  it("p=55% su quota 2.00 con stake 100 vale +10.00", async () => {
    const user = userEvent.setup();
    mount("ev-calculator");
    const odds = screen.getByLabelText("Your price");
    const prob = screen.getByLabelText("Your probability (%)");
    const stake = screen.getByLabelText("Stake");
    await user.clear(odds);
    await user.type(odds, "2.00");
    await user.clear(prob);
    await user.type(prob, "55");
    await user.clear(stake);
    await user.type(stake, "100");
    expect(screen.getByTestId("out-ev").textContent).toBe("+10.00");
    expect(screen.getByTestId("out-edge").textContent).toBe("+10.00%");
  });

  it("in modalità sharp deduce la probabilità togliendo il margine", async () => {
    const user = userEvent.setup();
    mount("ev-calculator");
    await user.click(screen.getByRole("button", { name: "From a sharp book" }));
    const a = screen.getByLabelText("Sharp price, your side");
    const b = screen.getByLabelText("Sharp price, other side");
    await user.clear(a);
    await user.type(a, "1.90");
    await user.clear(b);
    await user.type(b, "1.90");
    // 1.90/1.90 → probabilità equa 50%
    expect(screen.getByTestId("out-derived").textContent).toBe("50.00%");
  });
});

describe("kelly calculator", () => {
  it("p=55% su 2.00 con bankroll 1000 chiede 100", async () => {
    const user = userEvent.setup();
    mount("kelly-criterion");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "2.00");
    await user.clear(screen.getByLabelText("Your probability (%)"));
    await user.type(screen.getByLabelText("Your probability (%)"), "55");
    await user.clear(screen.getByLabelText("Bankroll"));
    await user.type(screen.getByLabelText("Bankroll"), "1000");
    expect(screen.getByTestId("out-stake").textContent).toBe("100.00");
    expect(screen.getByTestId("out-stake-pct").textContent).toBe("10.00%");
  });

  it("il mezzo Kelly dimezza lo stake", async () => {
    const user = userEvent.setup();
    mount("kelly-criterion");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "2.00");
    await user.clear(screen.getByLabelText("Your probability (%)"));
    await user.type(screen.getByLabelText("Your probability (%)"), "55");
    await user.clear(screen.getByLabelText("Bankroll"));
    await user.type(screen.getByLabelText("Bankroll"), "1000");
    await user.click(screen.getByRole("button", { name: "Half" }));
    expect(screen.getByTestId("out-stake").textContent).toBe("50.00");
  });

  it("senza edge dice zero, non un numero negativo", async () => {
    const user = userEvent.setup();
    mount("kelly-criterion");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "2.00");
    await user.clear(screen.getByLabelText("Your probability (%)"));
    await user.type(screen.getByLabelText("Your probability (%)"), "40");
    await user.clear(screen.getByLabelText("Bankroll"));
    await user.type(screen.getByLabelText("Bankroll"), "1000");
    expect(screen.getByTestId("out-stake").textContent).toBe("0.00");
    expect(screen.getByText("No edge at this price — the optimal stake is zero.")).toBeTruthy();
  });
});

describe("probability calculator", () => {
  it("40% diventa una quota equa di 2.50", async () => {
    const user = userEvent.setup();
    mount("probability-calculator");
    const prob = screen.getByLabelText("Probability (%)");
    await user.clear(prob);
    await user.type(prob, "40");
    expect(screen.getByTestId("out-fair-odds").textContent).toBe("2.50");
  });

  it("una quota di 1.75 chiede il 57.14%", async () => {
    const user = userEvent.setup();
    mount("probability-calculator");
    await user.click(screen.getByRole("button", { name: "A price" }));
    const odds = screen.getByLabelText("Decimal odds");
    await user.clear(odds);
    await user.type(odds, "1.75");
    expect(screen.getByTestId("out-breakeven").textContent).toBe("57.14%");
  });

  it("tre gambe da 2.00 fanno 8.00 e 12.50%", async () => {
    const user = userEvent.setup();
    mount("probability-calculator");
    for (const n of [1, 2]) {
      const leg = screen.getByLabelText(`Leg ${n}`);
      await user.clear(leg);
      await user.type(leg, "2.00");
    }
    await user.click(screen.getByRole("button", { name: "Add leg" }));
    const third = screen.getByLabelText("Leg 3");
    await user.clear(third);
    await user.type(third, "2.00");
    expect(screen.getByTestId("out-parlay-odds").textContent).toBe("8.00");
    expect(screen.getByTestId("out-parlay-prob").textContent).toBe("12.50%");
  });
});

describe("arbitrage calculator", () => {
  it("2.10 e 2.10 su 1000 danno +5.00% e stake 500/500", async () => {
    const user = userEvent.setup();
    mount("arbitrage-calculator");
    for (const n of [1, 2]) {
      const leg = screen.getByLabelText(`Outcome ${n}`);
      await user.clear(leg);
      await user.type(leg, "2.10");
    }
    await user.clear(screen.getByLabelText("Total stake"));
    await user.type(screen.getByLabelText("Total stake"), "1000");
    expect(screen.getByTestId("out-arb-profit").textContent).toBe("+5.00%");
    expect(screen.getByTestId("out-arb-sum").textContent).toBe("95.24%");
    expect(screen.getByTestId("out-arb-stake-1").textContent).toBe("500.00");
    expect(screen.getByTestId("out-arb-stake-2").textContent).toBe("500.00");
    expect(screen.getByTestId("out-arb-return").textContent).toBe("1050.00");
  });

  it("1.90/1.90 dice che non c'è arbitraggio invece di mostrare un profitto finto", async () => {
    const user = userEvent.setup();
    mount("arbitrage-calculator");
    for (const n of [1, 2]) {
      const leg = screen.getByLabelText(`Outcome ${n}`);
      await user.clear(leg);
      await user.type(leg, "1.90");
    }
    // 1/1.9 + 1/1.9 = 20/19 = 105.26%; il reciproco è 19/20 = 0.95 esatto,
    // quindi la perdita è −5.00% e non −4.99%.
    expect(screen.getByTestId("out-arb-profit").textContent).toBe("-5.00%");
    expect(screen.getByTestId("out-arb-sum").textContent).toBe("105.26%");
  });

  it("le quote asimmetriche pareggiano il ritorno sbilanciando gli stake", async () => {
    const user = userEvent.setup();
    mount("arbitrage-calculator");
    const first = screen.getByLabelText("Outcome 1");
    await user.clear(first);
    await user.type(first, "3.00");
    const second = screen.getByLabelText("Outcome 2");
    await user.clear(second);
    await user.type(second, "1.60");
    expect(screen.getByTestId("out-arb-stake-1").textContent).toBe("347.83");
    expect(screen.getByTestId("out-arb-stake-2").textContent).toBe("652.17");
    expect(screen.getByTestId("out-arb-return").textContent).toBe("1043.48");
  });

  it("aggiunge e toglie un terzo esito", async () => {
    const user = userEvent.setup();
    mount("arbitrage-calculator");
    await user.click(screen.getByRole("button", { name: "Add outcome" }));
    expect(screen.getByLabelText("Outcome 3")).toBeTruthy();
    // Senza il "togli" un esito vuoto aggiunto per errore blocca il calcolatore
    // sul trattino per sempre: la via di ritorno fa parte del tool.
    await user.click(screen.getAllByRole("button", { name: "Remove" })[2]);
    expect(screen.queryByLabelText("Outcome 3")).toBeNull();
    expect(screen.getByTestId("out-arb-profit").textContent).toBe("+5.00%");
  });

  it("spazzatura in input non produce NaN", async () => {
    const user = userEvent.setup();
    mount("arbitrage-calculator");
    const leg = screen.getByLabelText("Outcome 1");
    await user.clear(leg);
    await user.type(leg, "banana");
    expect(screen.getByTestId("out-arb-profit").textContent).toBe("—");
    expect(screen.getByTestId("out-arb-stake-1").textContent).toBe("—");
    expect(screen.getByTestId("out-arb-return").textContent).toBe("—");
  });
});

describe("parlay calculator", () => {
  it("quattro gambe a 1.80 danno 10.50, 9.53% e un margine composto del 21.55%", () => {
    // I default SONO l'esempio lavorato della pagina: chi arriva vede subito i
    // numeri che poi legge spiegati sotto (1.80⁴ = 10.4976 → 10.50).
    mount("parlay-calculator");
    expect(screen.getByTestId("out-parlay-total").textContent).toBe("10.50");
    expect(screen.getByTestId("out-parlay-implied").textContent).toBe("9.53%");
    // 1.05⁴ − 1 = 21.55%: il margine si compone, non si somma (non è 20%).
    expect(screen.getByTestId("out-parlay-margin").textContent).toBe("21.55%");
  });

  it("una gamba vuota mostra il trattino, e il bottone togli la fa tornare al numero", async () => {
    const user = userEvent.setup();
    mount("parlay-calculator");
    await user.click(screen.getByRole("button", { name: "Add leg" }));
    expect(screen.getByLabelText("Leg 5")).toBeTruthy();
    expect(screen.getByTestId("out-parlay-total").textContent).toBe("—");
    // Senza il "togli", una gamba vuota aggiunta per errore bloccherebbe il
    // calcolatore sul trattino per sempre.
    await user.click(screen.getAllByRole("button", { name: "Remove" })[4]);
    expect(screen.queryByLabelText("Leg 5")).toBeNull();
    expect(screen.getByTestId("out-parlay-total").textContent).toBe("10.50");
  });

  it("togliendo una gamba il margine composto scende in modo moltiplicativo", async () => {
    const user = userEvent.setup();
    mount("parlay-calculator");
    await user.click(screen.getAllByRole("button", { name: "Remove" })[3]);
    // Tre gambe al 5%: 1.05³ − 1 = 15.76%, non 15.00%.
    expect(screen.getByTestId("out-parlay-total").textContent).toBe("5.83");
    expect(screen.getByTestId("out-parlay-margin").textContent).toBe("15.76%");
  });

  it("spazzatura in una gamba non produce NaN", async () => {
    const user = userEvent.setup();
    mount("parlay-calculator");
    const leg = screen.getByLabelText("Leg 1");
    await user.clear(leg);
    await user.type(leg, "banana");
    expect(screen.getByTestId("out-parlay-total").textContent).toBe("—");
    expect(screen.getByTestId("out-parlay-implied").textContent).toBe("—");
    expect(screen.getByTestId("out-parlay-margin").textContent).toBe("—");
  });
});

describe("roi calculator", () => {
  it("1000 di capitale e 400 di profitto danno +40.00% e cassa a 1400", () => {
    // I default SONO l'esempio lavorato della pagina: nessuna digitazione.
    mount("roi-calculator");
    expect(screen.getByTestId("out-roi").textContent).toBe("+40.00%");
    expect(screen.getByTestId("out-roi-ending").textContent).toBe("1400.00");
  });

  it("un periodo in perdita mostra il negativo, non il trattino", async () => {
    const user = userEvent.setup();
    mount("roi-calculator");
    const profit = screen.getByLabelText("Profit");
    await user.clear(profit);
    await user.type(profit, "-250");
    expect(screen.getByTestId("out-roi").textContent).toBe("-25.00%");
    expect(screen.getByTestId("out-roi-ending").textContent).toBe("750.00");
  });

  it("profitto zero è 0.00%, non un valore mancante", async () => {
    const user = userEvent.setup();
    mount("roi-calculator");
    const profit = screen.getByLabelText("Profit");
    await user.clear(profit);
    await user.type(profit, "0");
    expect(screen.getByTestId("out-roi").textContent).toBe("+0.00%");
  });

  it("capitale a zero o spazzatura non produce Infinity né NaN", async () => {
    const user = userEvent.setup();
    mount("roi-calculator");
    const capital = screen.getByLabelText("Capital");
    await user.clear(capital);
    await user.type(capital, "0");
    expect(screen.getByTestId("out-roi").textContent).toBe("—");
    await user.clear(capital);
    await user.type(capital, "banana");
    expect(screen.getByTestId("out-roi").textContent).toBe("—");
    expect(screen.getByTestId("out-roi-ending").textContent).toBe("—");
  });
});

describe("yield calculator", () => {
  it("200 scommesse da 50 con 400 di profitto danno turnover 10000 e +4.00%", () => {
    // I default SONO l'esempio lavorato: il turnover è derivato, non digitato.
    mount("yield-calculator");
    expect(screen.getByTestId("out-turnover").textContent).toBe("10000.00");
    expect(screen.getByTestId("out-yield").textContent).toBe("+4.00%");
  });

  it("lo stesso profitto su un turnover diverso dà uno yield diverso", async () => {
    const user = userEvent.setup();
    mount("yield-calculator");
    // 20 giocate da 50 = 1000 di turnover: lo stesso 400 diventa +40.00%, che è
    // il numero della pagina ROI. È il contrasto che le due pagine spiegano.
    const bets = screen.getByLabelText("Number of bets");
    await user.clear(bets);
    await user.type(bets, "20");
    expect(screen.getByTestId("out-turnover").textContent).toBe("1000.00");
    expect(screen.getByTestId("out-yield").textContent).toBe("+40.00%");
  });

  it("sotto il migliaio di giocate il verdetto avverte che è rumore", async () => {
    const user = userEvent.setup();
    const { container } = mount("yield-calculator");
    expect(container.querySelector(".tl-verdict")!.className).toContain("is-warn");
    const bets = screen.getByLabelText("Number of bets");
    await user.clear(bets);
    await user.type(bets, "2500");
    expect(container.querySelector(".tl-verdict")!.className).not.toContain("is-warn");
  });

  it("un periodo in perdita mostra lo yield negativo", async () => {
    const user = userEvent.setup();
    mount("yield-calculator");
    const profit = screen.getByLabelText("Profit");
    await user.clear(profit);
    await user.type(profit, "-300");
    expect(screen.getByTestId("out-yield").textContent).toBe("-3.00%");
  });

  it("spazzatura negli input non produce NaN né Infinity", async () => {
    const user = userEvent.setup();
    mount("yield-calculator");
    const stake = screen.getByLabelText("Average stake");
    await user.clear(stake);
    expect(screen.getByTestId("out-turnover").textContent).toBe("—");
    expect(screen.getByTestId("out-yield").textContent).toBe("—");
    await user.type(stake, "banana");
    expect(screen.getByTestId("out-yield").textContent).toBe("—");
  });
});
