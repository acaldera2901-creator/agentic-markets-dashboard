import { describe, it, expect } from "vitest";
import { mapLimit, EXTERNAL_FETCH_LIMIT } from "./map-limit";

describe("#COVERAGE-0812-FANOUT mapLimit", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("non supera mai il tetto di concorrenza", async () => {
    let inFlight = 0, peak = 0;
    await mapLimit(Array.from({ length: 33 }, (_, i) => i), 6, async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBe(6); // e lo satura: non serializza per sbaglio
  });

  it("preserva l'ordine dell'input anche con durate diverse", async () => {
    const res = await mapLimit([50, 5, 30, 1, 20], 3, async (ms, i) => {
      await sleep(ms);
      return i;
    });
    expect(res).toEqual([0, 1, 2, 3, 4]);
  });

  it("una richiesta lenta non blocca le altre della finestra", async () => {
    // Con batch rigidi 5 item da 20ms + 1 da 100ms a tetto 2 costerebbero molto
    // piu' del pescaggio a domanda. Verifica il comportamento, non il tempo:
    // il worker libero deve andare avanti mentre il lento e' ancora appeso.
    const order: number[] = [];
    await mapLimit([100, 10, 10, 10], 2, async (ms, i) => {
      await sleep(ms);
      order.push(i);
    });
    expect(order[order.length - 1]).toBe(0); // il lento chiude per ultimo
    expect(order.slice(0, 3).sort()).toEqual([1, 2, 3]);
  });

  it("lista vuota e tetto piu' grande della lista", async () => {
    expect(await mapLimit([], 6, async () => 1)).toEqual([]);
    expect(await mapLimit([1, 2], 99, async (n) => n * 2)).toEqual([2, 4]);
  });

  it("tetto invalido e' un errore, non un silenzio", async () => {
    await expect(mapLimit([1], 0, async (n) => n)).rejects.toThrow(/limit/);
  });

  it("il tetto dichiarato sta sotto la soglia dove ESPN ha rallentato (25)", () => {
    expect(EXTERNAL_FETCH_LIMIT).toBeLessThan(25);
    expect(EXTERNAL_FETCH_LIMIT).toBeGreaterThan(1);
  });
});
