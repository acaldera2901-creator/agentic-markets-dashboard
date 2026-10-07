"use client";
// components/v3c/match/StartedNote.tsx (#REDESIGN-V3C fixdata2 N11) — the note of the match page's book
// section once the match has started. It reads the same /api/v3/live as the scoreboard in the header
// (first read from the server seed, then the same poll): with a score it no longer says «no live score yet».
import { fixdataCopyFor } from "@/lib/v3c/fixdata-copy";
import { fixdata2CopyFor } from "@/lib/v3c/fixdata2-copy";
import { startedNoteKind } from "@/lib/v3c/fixdata2";
import { liveCopyFor } from "@/lib/v3c/live-copy";
import { wantsLive } from "@/lib/v3c/live-view";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { useLiveSeed } from "../live/LiveBits";
import { useLiveScores, useMinuteNow } from "../live/useLiveScores";

const EPOCH = "1970-01-01T00:00:00Z";

export function StartedNote({ id, kickoff }: { id: string; kickoff: string }) {
  const lang = useV3cLang();
  const seed = useLiveSeed();
  const now = useMinuteNow(seed?.nowIso ?? EPOCH);
  const feed = useLiveScores(wantsLive(kickoff, now), () => null, liveCopyFor(lang), seed?.data ?? null);
  const kind = startedNoteKind(feed.items[id]);
  return (
    <p className="v3c-fine" data-started-note={kind}>
      {kind === "live" ? fixdata2CopyFor(lang).startedLive : fixdataCopyFor(lang).startedNote}
    </p>
  );
}
