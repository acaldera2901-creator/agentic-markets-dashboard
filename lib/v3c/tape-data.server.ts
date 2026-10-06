// lib/v3c/tape-data.server.ts (#REDESIGN-V3C fidelity) — i tape della board lato
// server: una lettura sola (partner_price_history delle ultime TAPE_HOURS ore
// per le partite che la pagina spedisce), poi il calcolo puro di tape.ts.
// Il tape è un complemento: se la lettura fallisce la board esce senza tape,
// mai con un tape inventato.
import { footballPairKey } from "./board";
import type { V3BoardMatch, V3BoardTennisMatch } from "./contracts";
import { fetchTapeHistory } from "./queries";
import { TAPE_HOURS, footballTape, tennisTape, type RowTape } from "./tape";
import { tennisPairKey } from "./tennis";

export async function boardTapes(matches: readonly V3BoardMatch[], tennis: readonly V3BoardTennisMatch[]): Promise<Record<string, RowTape>> {
  const fk = new Map<string, string>();
  const tk = new Map<string, string>();
  for (const m of matches) {
    const k = footballPairKey(m);
    if (k) fk.set(m.id, k);
  }
  for (const m of tennis) {
    const k = tennisPairKey({ id: m.id, player1: m.player1, player2: m.player2, kickoff: m.kickoff });
    if (k) tk.set(m.id, k);
  }
  const out: Record<string, RowTape> = {};
  try {
    const hist = await fetchTapeHistory([...fk.values(), ...tk.values()], TAPE_HOURS);
    for (const m of matches) {
      const tape = footballTape(m, hist.get(fk.get(m.id) ?? "") ?? []);
      if (tape) out[m.id] = tape;
    }
    for (const m of tennis) {
      const tape = tennisTape(m, hist.get(tk.get(m.id) ?? "") ?? []);
      if (tape) out[m.id] = tape;
    }
  } catch (e) {
    console.error("[v3c/tape]", String(e));
  }
  return out;
}
