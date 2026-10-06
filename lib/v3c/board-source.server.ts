// lib/v3c/board-source.server.ts (#REDESIGN-V3C polish) — la sorgente dei tool:
// la board VERA (getBoard, la stessa di /api/v3/board) e, solo se non risponde
// o non ha una partita di calcio con mercato, il SAMPLE dichiarato a schermo.
// Le pagine tool sono ISR (revalidate 300): i numeri hanno al più 5 minuti,
// e l'ora dei prezzi è scritta accanto.
import { getBoard } from "./board-data.server";
import { getBoardSource, liveBoardSource, type BoardSource } from "./board-source";

export async function toolBoardSource(now: Date = new Date()): Promise<BoardSource> {
  const b = await getBoard();
  return (b.ok ? liveBoardSource(b.data, now) : null) ?? getBoardSource();
}
