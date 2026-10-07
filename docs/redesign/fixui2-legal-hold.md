# Pagine v3c in attesa del legale (fixui2 · QA-REPORT-2 N5, M9) — 07/10/2026

Da far vedere a **legale-compliance** prima del lancio. Nulla qui è deciso: il filone interfaccia ha solo tolto
queste pagine dall'indice e dalla sitemap **a flag acceso**, senza cambiarne la logica.

## N5 · tre pagine con rischio
| Pagina | Cosa dice oggi | Rischio | Cosa è stato fatto (solo v3c, flag ON) |
|---|---|---|---|
| `/leaderboard` | «10 points per won bet»: classifica e status legati alle giocate vinte | Decreto Dignità (pubblicità indiretta del gioco), DSA art. 25 (gamification/status) | `robots: noindex, nofollow`; non era in sitemap; nessun link interno v3c |
| `/invite` | «Every friend who signs up and pays brings you closer to the next reward» | Premi referral legati a un pagamento: incentivo; DSA art. 25 | `robots: noindex, nofollow`; non era in sitemap; nessun link interno v3c |
| `/community` | Schedine dei creator; prima «Legs and probabilities open with Pro» + «See Pro» | Paywall in Fase 0 (Pro non è in vendita); schedine multiple = accumulatori | `robots: noindex, nofollow`; **fuori dalla sitemap** a flag acceso; gate neutro «Creator slips · preview», niente «See Pro», niente «open with Pro» |

- File: `app/v3c/{leaderboard,invite,community}/page.tsx` (metadata `robots`), `app/sitemap.ts` (filtro solo con
  `NEXT_PUBLIC_REDESIGN=1`), `components/v3c/community/Community.tsx`, `lib/v3c/fixui2-copy.ts`.
- **A flag spento nulla cambia**: le pagine di oggi (`app/leaderboard`, `app/invite`, `app/community`) e la sitemap
  restano identiche (test: `app/sitemap.test.ts`, `app/v3c/v3c-pages-routes.test.tsx`).
- Le pagine restano raggiungibili per URL diretto (servono ai clienti esistenti). Per toglierle del tutto (410 o
  redirect) serve la decisione del legale: è un cambio di prodotto, non di interfaccia.
- Domande per il legale: (1) la classifica a punti per giocata vinta può restare per i soli iscritti? (2) i premi
  referral legati al pagamento vanno tolti o riscritti? (3) le schedine dei creator sono contenuto promozionale?

## M9 · tracciamento prima del consenso (solo documentazione)
QA-2 ha visto `page_view` partire prima della scelta sui cookie **e anche dopo «Decline»**, e `partner_click` con
`partner_id:"FortunePlay"` (il nome, non l'id). Per indicazione di Andrea (parere legale) **il tracciamento non è
stato toccato** in questo giro. Da decidere con legale-compliance: base giuridica di `page_view` senza consenso
(analytics first-party aggregato?) o blocco fino al consenso; poi il fix è di `fixdata`/programmatore, non UI.
