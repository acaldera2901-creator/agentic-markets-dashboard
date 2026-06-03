# Design — Logica Piani & Monetizzazione (Agentic Markets)
**Data:** 2026-06-03 · **Owner:** Andrea · **Stato:** design approvato (pre-implementazione)

## Contesto & obiettivo
Oggi le predizioni sono dietro un gate "tutto-o-niente": `requireAccess` restituisce 403 a chi non ha piano `base`/`premium`, quindi la homepage pubblica non può mostrare un board "popolato ma blurrato", e un utente loggato senza piano attivo non vede nulla. Vogliamo:
1. **Pubblico (sloggato):** board popolato ma con numeri **blurrati** + CTA registrazione.
2. **Rivelazione progressiva** per stato/piano.
3. Esperienza **molto coinvolgente** (gamification) e **doppio motore di revenue**: abbonamenti + **affiliazione** ai bookmaker/casino.
4. **Niente paper trading**: solo dati e risultati reali; track record = accuratezza reale del modello (no claim di "edge/profitto sul mercato", coerente col fatto provato che non battiamo la chiusura Pinnacle sul 1X2).

Valore onesto venduto: **probabilità calibrate + insight** (track record reale, ECE <1% misurato), non "edge sul bookmaker".

## Modello scelto
- **Paywall = Reveal** (blur sui numeri; tutti vedono QUALI match e che esiste una predizione).
- **Affiliate-first + 2 pacchetti forti**: core gratis e coinvolgente monetizzato via affiliazione; Base/Premium come upsell power-user.
- **Quote reali** dai **bookmaker affiliati** (la quota mostrata è quella del partner dove mandiamo l'utente col bonus).

## La scala a 4 stati

| Contenuto | Pubblico | Free (registrato) | Base | Premium |
|---|---|---|---|---|
| Lista match (squadre/torneo/orario) | ✅ popolata | ✅ | ✅ | ✅ |
| Probabilità + pick | 🔒 blur | 🔒 blur (tranne PotD) | ✅ tutti | ✅ tutti |
| Pick of the Day svelato | 1 teaser blur-off | ✅ 1/giorno | ✅ | ✅ |
| Insight breve | ❌ | sul PotD | ✅ | ✅ |
| Insight avanzato (xG/form/fattori) | ❌ | ❌ | ❌ | ✅ |
| Track record reale (hit-rate, calibrazione) | preview | ✅ | ✅ | ✅ |
| Alert push/Telegram | ❌ | ❌ | ✅ | ✅ prioritari |
| Analytics / value board esclusivo | ❌ | ❌ | ❌ | ✅ |
| Bonus & quote bookmaker (affiliazione) | ✅ banner | ✅ su pick svelati | ✅ | ✅ + aggregatore "miglior bonus" |
| Gamification (streak/leaderboard/missioni) | preview | ✅ | ✅ | ✅ + VIP |

## Affiliazione
- Ci registriamo come affiliati ai bookmaker → link di tracking unici. Revenue: **CPA** (~$20-50/depositante), **RevShare** (25-45% net loss a vita) o **Hybrid**.
- Ogni pick svelato porta una CTA *"Quota X su [Bookmaker] · prendi il bonus →"* col link affiliato. Il **bonus** è l'offerta del partner messa in vetrina.
- Le **quote** mostrate provengono dai feed/widget dei bookmaker affiliati (coerenza: quota = dove mandiamo l'utente).
- Premium: **aggregatore dei migliori bonus** del momento.
- Disclosure affiliazione obbligatoria.

## Gamification
Streak giornaliera (apri + svela il PotD), leaderboard di accuratezza, missioni giornaliere ("segui 3 pick"), badge, notifiche sui pick ad alta confidenza, celebrazione vittorie. Loop di ritorno quotidiano centrato sul PotD gratuito.

## Compliance (parte del fatto bene, non opzionale)
18+ ovunque · messaggi di **gioco responsabile** · **disclosure affiliazione** · solo bookmaker **licenziati** nel mercato dell'utente. Dettaglio demandato all'agente legale-compliance prima del go-live commerciale.

## Architettura tecnica (unità isolate)

1. **Plan resolution (`lib/auth.ts`)** — stati: `anonymous` (no cookie), `free`, `pending_payment`, `base`, `premium`, `admin_full`. Risolto sempre dal DB (`profiles`).
2. **Projection layer (`lib/access-projection.ts`, nuovo o esteso da `applyAccessControl`)** — funzione pura `project(row, state) -> Partial<row>` che restituisce i campi consentiti per stato. **Sostituisce il modello 403**: gli endpoint di lettura predizioni tornano sempre **200** con la proiezione per stato (anonymous/free = dati base + flag `locked: true` sui campi blurrati). I 403 restano solo per scritture/azioni privilegiate.
3. **API predizioni (`/api/v2/predictions`, `/api/tennis`)** — non più `requireAccess` hard-deny per la lettura: risolvono lo stato e applicano `project`. Aggiungono il flag `locked` per pilotare il blur lato frontend.
4. **Pick of the Day** — selezione deterministica giornaliera (es. match a più alta confidenza del giorno) marcato `pick_of_day=true`; svelato per free+.
5. **Affiliate layer (`lib/affiliate.ts`, nuovo)** — mappa bookmaker→link tracking + bonus corrente; arricchisce i pick svelati con `affiliate: {bookmaker, odds, bonus, url}`. Quote dai partner.
6. **Gamification layer** — streak/leaderboard/missioni su tabelle dedicate (`user_streaks`, `leaderboard` già esiste). Fuori dallo scope minimo del primo plan se troppo grande → decomporre.
7. **Frontend (`app/page.tsx`)** — rendering blur sui campi `locked`, CTA registrazione/upgrade, sezione bonus, PotD in evidenza, elementi gamification.

## No-paper / track record
Le predizioni restano stime oneste del modello (niente edge inventato), ma il **track record** mostrato è l'accuratezza **reale** su esiti reali (hit-rate, calibrazione, breakdown per sport/lega). Niente portfolio paper. Il flag interno `is_paper` resta solo come marcatore "nessuna quota di mercato propria", non come messaggio di prodotto.

## Fuori scope (di questo spec)
- Prezzi dei pacchetti (commerciale → Maven).
- Flusso di pagamento (già esistente: crypto USDT + attivazione manuale).
- Scelta dei bookmaker partner specifici e firma dei contratti affiliazione (Andrea/Maven).
- Implementazione completa della gamification avanzata (può diventare un sub-progetto separato).

## Open items (decisioni/azioni esterne)
- **Quote reali**: dipendono dai partner affiliati scelti → integrazione feed/widget quando i partner sono definiti. Fino ad allora i pick svelati mostrano prob+pick+bonus generico, quota "da partner".
- **Firma affiliazioni**: Andrea/Maven selezionano i bookmaker e ottengono i link.
- **Account Andrea**: portare il profilo a `premium`/`admin_full` per test reali.

## Definizione di "fatto" (per la fase implementativa)
- Pubblico/free ricevono 200 con proiezione corretta (board popolato + `locked`), verificato live.
- Base/premium vedono i campi attesi; nessun downgrade via cookie (plan dal DB).
- Tennis + football appaiono per gli stati corretti.
- Nessun claim di edge/profitto; disclaimer 18+/gioco responsabile presenti.
- Test su `project()` per ogni stato (TDD).
