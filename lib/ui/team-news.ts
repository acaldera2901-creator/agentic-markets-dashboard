// lib/ui/team-news.ts — #INFORTUNI-1001
//
// Un array vuoto di infortuni NON è «zero assenti»: è la fonte che non dice
// nulla. Misurato nell'audit infortuni del 01/10: su tutte le righe di
// nazionali (UNL, CNL, amichevoli, Mondiale) il dato arriva come `[]` perché la
// fonte non segnala mai nessuno, e il Pro leggeva «Nessuna assenza segnalata»
// — un'affermazione che non sapevamo fare. Qui si decide una cosa sola: c'è un
// dato di fonte (almeno un nome) oppure no. Senza nomi, per il Pro il blocco
// esiste ma vuoto (il componente scrive «assenze non disponibili»); per il
// non-Pro resta `null`, che la scheda legge come «dietro Pro».
import type { MdsTeamNews } from "@/components/MatchDetailSheet";

function names(list: readonly string[] | null | undefined): string[] {
  return (list ?? []).filter((x) => typeof x === "string" && x.trim().length > 0);
}

export function buildTeamNews(args: {
  injHome: readonly string[] | null | undefined;
  injAway: readonly string[] | null | undefined;
  homeName: string;
  awayName: string;
  isPremium: boolean | undefined;
}): MdsTeamNews | null {
  const home = names(args.injHome);
  const away = names(args.injAway);
  if (home.length === 0 && away.length === 0 && !args.isPremium) return null;
  return { home: { name: args.homeName, items: home }, away: { name: args.awayName, items: away } };
}
