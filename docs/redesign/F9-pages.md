# F9 · filone pages — News, Books, Pro, Metodo + leaderboard/community/invite, cornice legali

Branch `betredge/v3c-pages` (worktree `~/Desktop/01-BETREDGE/am-v3c-pages`), base `betredge/v3c-preview` 61669aae. Aggiornato 06/10/2026.

## Come si accende
Stesso schema di F3: a `NEXT_PUBLIC_REDESIGN=1` `next.config.ts` riscrive (beforeFiles, `lib/v3c/pages-routes.ts`) `/blog`, `/blog/:slug`, `/partners`, `/pricing`, `/how-it-works`, `/leaderboard`, `/community`, `/invite`, `/privacy`, `/terms`, `/profilo` verso `app/v3c/*`, e `/plans` → `/pricing` è un 308 (`lib/v3c/redirects.ts`; con `?checkout=` o `?auth=` `/plans` resta la Dashboard, così «Go Pro» apre il CheckoutModal di sempre). Le pagine di oggi non importano nulla del redesign.

**Flag spento = sito identico, misurato su build di produzione** (`next build` + `next start` del branch contro `am-v3c-preview`, stesso commit base): per 14 rotte (le 11 sopra + `/plans`, `/plans?checkout=premium`, `/predictions`) status, URL finale, `<head>` SEO, JSON-LD, DOM del body e fogli CSS caricati sono uguali; `sitemap.xml` e `robots.txt` hanno lo stesso md5; `/v3c/*` è 404.
Primo tentativo scartato: import dinamico dentro le pagine di oggi → il CSS v3c (≈58 KB) entrava comunque nella build a flag spento.

## Fatto
- `/blog` News: lista + riquadro «News at hh:mm» onesto («Not live yet»), `/blog/[slug]` nella cornice v3c con stessi Article/breadcrumb JSON-LD e `generateMetadata` (test).
- `/partners` Books: gate geo server-side (stessa lista di `/api/geo-books`), link affiliati reali da `lib/partners.ts` (`partnersFor`), `rel="nofollow sponsored"`, 18+, gioco responsabile, «No bonus shown» (il catalogo non ha bonus verificati), confronto quote dalla board. «Best» solo se un book è strettamente più alto: oggi FortunePlay e YBets (stessa piattaforma BetConstruct) coincidono quasi sempre.
- `/pricing` Free + Pro: prezzo da `lib/commercial-plan.ts`, annuale e metodi solo se il checkout li mostra, nessun countdown; Base sparito da UI e copy delle pagine nuove. Paywall «Unlock why the model disagrees» (`components/v3c/paywall/WhyPaywall.tsx`): #1 aperto, #2–3 chiusi senza blur, mai sotto |gap| 1.5 pp; montato in /pricing come esempio, pronto per la pagina partita.
- `/how-it-works` Metodo: blend 70/30, sigillo, gap, cosa non diciamo.
- leaderboard / community / invite in v3c con le stesse API; privacy/terms/profilo solo cornice (testo legale estratto in `PrivacyBody.tsx`/`TermsBody.tsx`, verbatim).

## Resta / decisioni che servono
1. **legale-compliance (06/10), bloccanti per il lancio pubblico, non per la preview chiusa:** (a) `GEO_BLOCKED_COUNTRIES` è vuoto: l'Italia vede i link affiliati se l'allowlist lo consente → Decreto Dignità art. 9; serve un blocco IT esplicito e una mappa licenze per paese (GB/FR/DE/ES/NL); (b) riga `pricing.withdrawal`: per un servizio digitale il recesso non decade, si paga il pro-rata → riscrivere dopo parere umano sulla qualifica di Pro; (c) `promo` (prezzo di riferimento Omnibus, prezzo di rinnovo), `metaRest` (tasse incluse?), effetto della disdetta; (d) helpline per paese oltre a BeGambleAware. Già applicate: `respTitle`, `freeLede`, sottotitolo Weekly Model Case.
2. Il testo dei Terms nomina ancora «Base and Pro»: va riscritto con la migrazione base→Pro (altro filone, PROPOSAL), non qui.
3. `/invite` da anonimo logga un 401 di `/api/referral/stats` in console: è lo stesso 401 che la Dashboard di oggi prende da `GET /api/auth`. Per azzerarlo serve un segnale di sessione lato client che oggi non esiste.
4. Lighthouse a11y: 96–100 ovunque; privacy/terms 96 (`link-in-text-block` del testo legale, invariato), leaderboard 98 (`heading-order`).
5. Sitemap a flag acceso: `/pricing` non è in `lib/seo/last-modified.generated.ts` → cade sul fallback `GENERATED_AT` finché non si rigenera (`npm run seo:lastmod`) dopo il merge.
6. **Trovato fuori filone:** le pagine tool di F5 (`app/tools/*`, `app/[lang]/tools/*`) usano l'import dinamico: a flag spento la build di preview carica comunque CSS/font v3c (Big Shoulders). Da sistemare in F5 con lo stesso schema a rewrite.
7. Le 9 lingue diverse da EN/IT sono in fallback inglese: chiavi in `docs/redesign/v3c-pages-i18n-keys.md` (F10).
8. Scraper FotMob: solo PROPOSAL `docs/v3c-news-proposal.md`, serve APPROVE.
9. Torre (`tests/test_cc_checks_platform.py`, percorsi): sonda `/plans` e si aspetta 200; a flag acceso in produzione diventa 308 → aggiornare la sonda al lancio.

## File condivisi toccati
`components/v3c/Chrome.tsx` (pro → `/pricing`, signIn → `/plans?auth=login`), `components/v3c/V3cChrome.tsx` (link Pro), `next.config.ts` (redirect + merge rewrite), `app/sitemap.ts` (`/pricing` a flag acceso), `app/app/page.tsx` (deep link `?checkout=premium` → CheckoutModal di sempre, attivo solo a flag acceso; checkout non modificato), `app/partners/layout.tsx` e `app/community/layout.tsx` (prosa SEO spostata in `seo.ts`, stesso testo), `lib/legal-entity.test.ts` (percorsi dei corpi legali).
