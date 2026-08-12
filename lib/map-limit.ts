// #COVERAGE-0812-FANOUT — fan-out con un tetto di concorrenza.
//
// PERCHE' ESISTE. /api/predictions faceva `Promise.all(codes.map(...))` su OGNI
// lega, per quattro sorgenti in parallelo (fixture, quote, xG, api-football).
// Con 18 codici passava; il batch del 12/08 lo ha portato a 33 e si e' rotto in
// modo INVISIBILE: The Odds API throttla una parte delle richieste simultanee,
// fetchOdds fa `if (!r.ok) return []` senza loggare, e il gate quality-first
// ("estiva senza quote reali -> non servita") scarta OGNI fixture di quella lega.
// Risultato misurato sul run delle 20:02 del 12/08: 5 leghe su 15 assenti dal
// board (ARG, GRE, MLS, NED, POR) con storico, fixture e quote tutti sani, e
// nessun errore da nessuna parte. Stessa firma dell'incidente #ODDS-KEYS-PARITY-0730,
// causa diversa.
//
// Lo stesso effetto e' stato MISURATO direttamente su ESPN lo stesso giorno: 25
// scoreboard in parallelo = 5,71s totali con tre slug fermi a 5,71s mentre gli
// altri stavano sotto il secondo.
//
// Non e' una coda sofisticata: e' un tetto. Le richieste partono a finestre di
// `limit`, l'ordine dei risultati resta quello dell'input.
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (limit < 1) throw new Error("mapLimit: limit deve essere >= 1");
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    // Ogni worker pesca l'indice successivo finche' ce ne sono: nessun batch
    // rigido, quindi una richiesta lenta non blocca le altre della sua finestra.
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// Tetto per le sorgenti esterne del ciclo predizioni. 6 sta sotto la soglia dove
// ESPN ha iniziato a rallentare nella misura del 12/08 e lascia margine agli
// altri tre fan-out che girano nello stesso istante.
export const EXTERNAL_FETCH_LIMIT = 6;
