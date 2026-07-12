# Go-Live Readiness — nuova UX BetRedge · PROPOSAL / Checklist

**Data:** 2026-07-12 · **Autore:** Andrea via Claude Code · **Stato:** PROPOSAL — da approvare per-passo (Andrea; alcuni gate Michele/legale/Tommy)

"Go-live" della nuova UX = accendere `NEXT_PUBLIC_UX_NEW` in produzione e far sostituire alla nuova app (`/oggi`+`/risultati`+`/profilo`) il monolite `/app`. È **deploy prod + tocca DB/auth + irreversibile-ish**: ogni passo è gated. Questo doc è la sequenza esatta + i blocker + il rollback.

## Stato del ridisegno (fatto)
SP0 ✅#142 · SP1 ✅#143 · SP2 ✅#144 (merged) — SP3 ✅#145 · SP4 ✅#146 · SP5 ✅#147 (PR aperte). SP6 (notifiche) e SP7 (cleanup) da fare. Tutto dietro flag → **zero impatto sull'app attuale finché il flag è off**.

---

## FASE 1 — Integrazione dei rami (io, poi tuo APPROVE per il merge su main)
I 3 PR aperti partono tutti da `main` e si sovrappongono (`PickCard.tsx`, `FeedScreen.tsx`, `pick-view-model.ts`) → vanno **riconciliati**, non mergiati alla cieca.
1. Creo un **branch di integrazione** `integration/new-ux` che unisce SP3+SP4+SP5 e risolve:
   - `PickCard`/`PickCardExpanded`: il `onUpgrade` di SP3 (paywall) + lo stato settled di SP4 sullo stesso componente.
   - `FeedScreen`: provider SP3 (Auth/Paywall) + Sheet scheda SP2 + risultati SP4.
   - `ProfileScreen` (SP5): l'anonimo usa le **Signup/LoginSheet di SP3** invece del link `/app`.
   - `SportIcon` (SP0) vs `app/components/sport-icon.tsx` (monolite): resta coesistenza fino a SP7.
2. Suite verde + tsc + build + **visual check** dell'app integrata (loggato Pro/base + anonimo).
3. **Gate:** presento l'integrazione come PR unica; **APPROVE tuo** per il merge su main (= deploy prod, ma con flag ancora **off** → nessun cambiamento visibile).

## FASE 2 — SP6 (opzionale al go-live)
Notifiche "il pick di oggi è pronto" + PWA. **Decisione:** (a) rimandare SP6 a dopo il go-live (consigliato: non blocca), oppure (b) predisporre l'infra push ora. Serve comunque da te: **chiavi VAPID** + servizio push. Scrivo il piano SP6 a parte; non blocca la Fase 3.

## FASE 3 — Blocker NON miei (da chiudere prima di accendere il flag in prod)
Questi valgono per il go-live del **prodotto**, non solo della UI. Li elenco perché nulla vada perso — **non li posso chiudere io**:
- ⛔️ **Legale / consenso (SP3):** review `legale-compliance` su +18/ToS — in particolare la **persistenza del consenso per gli account legacy** (gap GDPR I1) + wording/retention. Il consenso server-side **vale già in prod appena SP3 è deployato**.
- ⛔️ **Qualificazione gambling (rischio #1 go-live):** decisione legale/business su gioco d'azzardo (vedi memoria `project_gambling_qualification`). Precede il go-live pubblico.
- ⛔️ **Audit go-live** (`project_golive_audit_0709`, 2026-07-09): verificare che i BLOCKER siano chiusi (Stripe/RLS `profiles`/…) contro lo stato attuale.
- ⛔️ **Drift migration:** risposta di **Tommy** in council (baseline A vs repair B) + bonifica, così un futuro `db push` non rompe il DB condiviso. La migration consenso è già applicata; il drift è igiene pre-go-live.
- ⛔️ **Generosità free** (`showcaseAllowance`): decisione tu/Michele su quanto vede l'anonimo/free (oggi anon=0/free=1) — impatta conversione.

## FASE 4 — Go-live (deploy prod, gated APPROVE per-passo)
Ordine obbligatorio, uno alla volta con tuo OK:
1. **Migration già applicata** (consenso) ✔ — nessuna azione.
2. **Merge integrazione su main**, flag **off** in prod → verifica che l'app attuale sia invariata.
3. **SP7 cleanup**: swap `/app` → nuova app dietro flag; dead-code del monolite rimosso man mano; affiliate "Piazza scommessa" nella scheda + checkout casual in `features/` (portati dal monolite).
4. **Flip del flag** `NEXT_PUBLIC_UX_NEW=1` in prod (Vercel env) → **PROPOSAL + APPROVE dedicato** (è IL momento go-live).
5. **Canary/verifica post-deploy:** smoke test loggato+anonimo su prod (feed, scheda, risultati, profilo, signup con consenso, upgrade), console/error rate, Sentry/log.

## Rollback
- Il flag è la **safety net**: `NEXT_PUBLIC_UX_NEW=0` (o rimozione env) → si torna istantaneamente al monolite `/app`, senza redeploy di codice.
- Le rotte `/oggi`/`/risultati`/`/profilo` tornano 404 (notFound) con flag off.
- La migration consenso è additiva (colonne nullable) → nessun rollback DB necessario; se serve, drop delle 2 colonne (vuote).
- Deploy: mai push ravvicinati su main (Vercel annulla intermedi); fetch prima, verifica dopo.

## Cosa faccio ora (senza gate) e cosa aspetta te
- **Ora (io):** Fase 1 (branch integrazione + riconciliazione + verifica) e piano SP6. Presento l'integrazione come PR.
- **Aspetta il tuo OK:** ogni merge su main, il flip del flag, SP7 su prod.
- **Aspetta altri:** legale (consenso+gambling), Tommy (drift), audit blocker.
