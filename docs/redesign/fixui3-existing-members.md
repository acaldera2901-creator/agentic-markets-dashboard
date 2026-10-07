# «Existing members» tolto dal v3c (fixui3 · B3, Fase 0)

**Decisione di Andrea (07/10/2026, quarto giro):** nel v3c nessun link porta all'accesso o al checkout del
sito di oggi finché la migrazione base→Pro e il testo legacy non sono corretti.

## Perché
- Il link «Existing members» stava nel piè di 377 pagine e portava a `/plans?auth=login`, cioè alla Dashboard
  di oggi. Lì l'utente legge «Free, Base or Pro» e **«START WITH BASE $14.99/month · Card or crypto ·
  auto-renewing»** (QA-REPORT-3, B3, scatto `existing-members-plans-1440`): un prezzo cliccabile per un piano
  che nel redesign non esiste più. Contraddice `/pricing` («Nothing to buy yet») e la Fase 0 («nessun prezzo
  cliccabile»).
- In Fase 0 nel v3c non c'è niente di riservato: board, record, tool, price check, news sono aperti a tutti.
  Il link non portava a nulla che servisse, solo al vecchio listino.

## Cosa è cambiato
| Dove | Prima | Dopo |
|---|---|---|
| `components/v3c/Chrome.tsx` (piè, tutte le pagine v3c) | `BetRedge · Terms · Existing members` → `/plans?auth=login` | `BetRedge · Terms`; tolta anche la chiave `ROUTES.signIn` |
| `components/v3c/community/Invite.tsx` (`/invite`, 401) | «Sign in to get your invite link» + bottone «Sign in» → `/plans?auth=login` | «Account: coming with Pro.» / «Nothing on BetRedge needs an account today.», nessun link |
| `app/v3c/profilo/page.tsx` (L1) | 404 senza `NEXT_PUBLIC_UX_NEW=1` | stessa frase neutra + «Read the Pro preview» → `/pricing`; `noindex` |

Non toccati: il login e la Dashboard (`app/app/page.tsx`), `/plans` a flag spento, `lib/v3c/checkout-link.ts`
(le costanti restano, nessun componente v3c le usa più), le chiavi di copy `existingMembers*`
(`lib/v3c/fixui2-copy.ts`) e `signIn*` (`lib/v3c/community-copy.ts`), tenute tradotte nelle 11 lingue per il
ripristino.

**Test di regressione:** `components/v3c/fixui3.test.tsx` → «B3»: piè e barra in 11 lingue senza `/plans?`,
`auth=` o `checkout=`; nessun file in `components/v3c` o `app/v3c` scrive `/plans?` o importa
`SIGN_IN_HREF` / `PRO_CHECKOUT_HREF` / `FREE_SIGNUP_HREF`. Aggiornati `fixui2.test.tsx` e
`community/community.test.tsx`.

## Come ripristinarlo (quando la migrazione è fatta)
Precondizioni, tutte vere e verificate su preview, non dichiarate:
1. `/plans?auth=login` (o l'accesso che lo sostituisce) non mostra più Base né «$14.99», né «crypto-only»: solo
   Free e Pro, con il prezzo di `lib/commercial-plan.ts`, e i clienti `base` risultano Pro senza cambio prezzo.
2. Il testo legacy della Dashboard (modale di accesso, tab Piani) è allineato a Free/Pro.
3. Esiste qualcosa dietro un account che valga il link (altrimenti resta tolto).

Poi:
1. `components/v3c/Chrome.tsx`: rimettere in `ROUTES` `signIn: SIGN_IN_HREF` e nel piè, dopo i Termini,
   `· <a href={ROUTES.signIn} rel="nofollow" title={fixui2CopyFor(locale).existingMembersTitle}
   data-v3c="existing-members">{fixui2CopyFor(locale).existingMembers}</a>` (import di `fixui2CopyFor`).
2. `components/v3c/community/Invite.tsx`: nello stato `signin` tornare a `c.signInTitle` / `c.signInBody` + il
   bottone verso `SIGN_IN_HREF`.
3. Invertire le asserzioni di `fixui3.test.tsx` «B3» (il link c'è, una volta, verso la nuova URL) e di
   `fixui2.test.tsx` / `community.test.tsx`.
4. Ricontrollare con uno scatto la pagina di destinazione a 1440 e 390: nessun prezzo di un piano che non esiste.
