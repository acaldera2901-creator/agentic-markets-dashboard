# PROPOSAL — «News at hh:mm»: note partita dai fatti di FotMob, riscritte da noi

**Stato:** PROPOSAL, NON eseguita. Nessuna tabella creata, nessuno scraper scritto o avviato.
**Serve:** `APPROVE` di Andrea (tocca DB di produzione + un job esterno). Revisione di `legale-compliance` sul testo pubblicato prima dell'interruttore ON.
**Filone:** redesign v3c · pages (#REDESIGN-V3C F9). Owner esecuzione: programmatore-andrea.

## Cosa esiste già (e resta così)
- `/blog` a flag acceso è «News» v3c (`app/v3c/blog`): lista delle guide pubblicate (`blog_posts`, `status='published'`) + un riquadro «News at hh:mm» che dice onestamente «Not live yet». `/blog/[slug]`, canonical, JSON-LD Article e sitemap invariati.
- Questa proposta riempie quel riquadro. Senza APPROVE il riquadro resta com'è.

## Approccio scelto
1. **Fonte:** solo il feed RSS pubblico `https://www.fotmob.com/topnews/feed?format=rss`. **Mai** `/api/*` di FotMob, mai pagine HTML, mai immagini.
2. **Frequenza:** un fetch ogni ~30 minuti (cron), con `If-Modified-Since`/`ETag`; backoff a 2 h dopo 3 errori.
3. **User-agent identificabile:** `BetRedgeNewsBot/1.0 (+https://www.betredge.com/about; info@betredge.com)`. Rispetto di `robots.txt` controllato a ogni giro: se il feed viene escluso, il job si ferma da solo e scrive il motivo.
4. **Cosa si prende:** dal singolo item solo i **fatti** (chi, cosa, quando: squadre/giocatori, evento, data) + titolo e link originale per la citazione. **Non** si salva né si pubblica: immagine, sottotitolo, corpo, nessuna frase copiata.
5. **Riscrittura reale:** un testo nostro di ≤ 22 parole costruito dai fatti estratti, legato quando possibile a una partita della board (`match_id`) e all'ora del fatto («hh:mm UTC»). Un controllo meccanico rifiuta la nota se condivide una sequenza di ≥ 6 parole consecutive col titolo originale o se contiene parole del lessico vietato (guaranteed, lock, sure win…). Mai pronostici nelle note.
6. **Fonte e link sempre visibili:** «Source: FotMob ↗» con `rel="nofollow noopener"` su ogni nota.
7. **Interruttore:** variabile `NEWS_NOTES_ENABLED` (server). Spenta = il job non gira e la pagina mostra «Not live yet» come oggi. Accesa solo dopo revisione legale.

## COSA CAMBIERÀ ESATTAMENTE
| Oggetto | Prima | Dopo |
|---|---|---|
| DB (Supabase prod) | — | tabella nuova `news_notes` (vedi DDL) + RLS: lettura pubblica solo `status='published'`, scrittura solo service role |
| Job | — | `scripts/news/fotmob_rss.ts` (o route cron `/api/cron/news-notes` con `CRON_SECRET`) ogni 30 min |
| Env | — | `NEWS_NOTES_ENABLED` (default assente = spento) |
| UI | riquadro «Not live yet» in `components/v3c/pages/News.tsx` | le ultime 5 note pubblicate, con ora, fonte e link; vuoto → testo di oggi |

```sql
create table public.news_notes (
  id            bigserial primary key,
  source        text not null default 'fotmob_rss',
  source_guid   text not null unique,          -- guid/link dell'item, per non duplicare
  source_url    text not null,                 -- link mostrato come fonte
  source_title  text not null,                 -- solo per il controllo anti-copia, MAI mostrato
  happened_at   timestamptz not null,          -- pubDate dell'item
  facts         jsonb not null,                -- {teams:[], players:[], event:"…"}
  note_en       text not null check (char_length(note_en) <= 200),
  note_it       text,
  match_id      text,                          -- id della board, se legata a una partita
  status        text not null default 'draft' check (status in ('draft','published','rejected')),
  created_at    timestamptz not null default now()
);
alter table public.news_notes enable row level security;
create policy news_notes_read on public.news_notes for select using (status = 'published');
create index news_notes_pub_idx on public.news_notes (status, happened_at desc);
```

## Rollback
- Immediato: `NEWS_NOTES_ENABLED` spenta → job fermo, UI torna a «Not live yet» senza deploy della pagina (la UI legge l'env lato server).
- Totale: `drop table public.news_notes;` (nessuna FK la referenzia) + rimozione del cron.

## Blast radius
Una tabella nuova e isolata, nessuna modifica a tabelle esistenti, nessuna scrittura su `blog_posts`, `pick_ledger`, pagamenti. Un errore del job non tocca la board: il riquadro mostra l'ultimo stato buono o il testo di oggi.

## Piano di verifica
1. Test unitari: parser RSS su fixture reale salvata, controllo anti-copia (6-gram), lessico vietato, ≤ 22 parole.
2. Dry-run in preview con `status='draft'` per 48 h: confronto a mano di 20 note con l'item sorgente (fatti giusti, nessuna frase ripresa).
3. Log del job: richieste/ora ≤ 2–3, status 200/304, UA corretto.
4. Solo dopo: revisione legale → `published` → `NEWS_NOTES_ENABLED=1` in preview, mai prima in produzione.

## Rischi aperti (da decidere prima dell'APPROVE)
- Termini d'uso di FotMob sul riuso del feed: da leggere e citare nella revisione legale; se vietano l'uso commerciale, la proposta cade.
- Per l'Italia (Decreto Dignità) le note devono restare informazione sportiva, senza quote né link a operatori accanto.
