# STEP 0 legale — Shopify per BetRedge: GO / NO-GO

- **Data:** 2026-07-24 · **Prodotto:** BetRedge (Agentic Markets)
- **Perimetro:** solo migrazione strato commerce su Shopify + Shopify Payments
- **⚠️ Disclaimer:** analisi di compliance operativa, **non parere legale**. I punti [AVVOCATO] vanno confermati da un legale (gaming/payments) prima del go-live. Le policy Shopify/Stripe cambiano senza preavviso: ricontrollare i testi il giorno dell'apertura merchant.

## Verdetto: **GO-CONDIZIONATO**

Shopify AUP + Shopify Payments Terms **non vietano** di per sé la vendita in abbonamento di un prodotto di predizioni/dati sportivi: la clausola gambling della lista operativa (Stripe, incorporata via Shopify Payments Terms §B5) — *"sports forecasting or odds-making **with a monetary or material prize**"* — **non colpisce** BetRedge finché resta VIA A (nessuna puntata, nessun payout, nessun premio). Non è NO-GO.

**Il gate reale non è il gambling ma la clausola *get-rich-quick*** (Stripe: servizi che "promise big rewards"/"quick and easy money"). Le claim vive tipo "battiamo il mercato / beat the market / edge medio +X% / ROI" ci cadono dentro (anche rischio FTC). Vanno rimosse prima di aprire il merchant.

## Condizioni BLOCCANTI (tutte, prima dell'onboarding Shopify)

- [ ] **C1 — Scrub copy get-rich-quick.** Rimuovere ovunque "battiamo il mercato / beat the market / edge medio +X% / ROI / guadagna / value bet". Include banner Creator Picks + EdgeCard dormiente (`project_track_record_ui`). Verifica: grep sul sito, zero occorrenze.
- [ ] **C2 — Isolare i bookmaker dal perimetro Shopify.** Nessun link/logo/deep-link bookmaker (Stake/Roobet/FortunePlay/YBets/BetScore/slotsbonus) su pagina prodotto, checkout, ricevute, email Shopify. Restano solo su betredge.com fuori dal commerce.
- [ ] **C3 — Descrizione prodotto + categoria merchant** = "data/analytics SaaS, non-gambling"; disclaimer "non è scommesse, non gestisce/paga vincite" sulla pagina prodotto.
- [ ] **C4 — Track record come accuratezza descrittiva passata** + disclaimer "no promessa di risultati/guadagni".
- [ ] **C5 — ToS/Privacy/Refund allineati** + ragione sociale reale nel governing law (`project_terms_of_service`); click-to-cancel + ricevute (Sufio) attivi.
- [ ] **C6 — Nessuna feature che gestisca denaro su esiti** (invariante VIA A). Se si aggiunge wallet/puntata/premio → ricade nel divieto, si rifà lo STEP 0.

## Condizioni raccomandate (riducono reserve/freeze fondi)

- [ ] R1 — Billing descriptor riconoscibile ("BETREDGE SUBSCRIPTION") + email conferma addebito.
- [ ] R2 — PayGate acceso in parallelo (grandfather) come backup fondi.
- [ ] R3 — Monitorare il chargeback rate; se sale, aspettarsi rolling reserve (fino a ~120gg).

## Da confermare da avvocato [AVVOCATO] prima di chiudere lo STEP 0

1. Che il posizionamento "data/analytics non-gambling" regga nella **giurisdizione dell'entità merchant** e nei mercati di vendita (specie **US** → rischio #1 FTC, `project_us_pivot`; IT → Decreto Dignità se si vende a utenti IT).
2. Disponibilità di **Shopify Payments nel paese dell'entità** + requisiti onboarding.
3. Review finale claim track record vs FTC substantiation.
4. Che gli affiliate bookmaker su betredge.com (fuori Shopify) non creino "facilitazione" per il merchant.

## Documentazione da preparare per l'onboarding

1. One-pager business "data/analytics SaaS, non-gambling" (modello: probabilità calibrate, nessuna gestione fondi).
2. ToS aggiornati (posizionamento non-gambling, no garanzia risultati, gioco responsabile, refund/cancellation, governing law con ragione sociale reale).
3. Privacy policy (GDPR/CCPA per mercato).
4. Screenshot prodotto ripulito dalle claim vietate.
5. Prova click-to-cancel funzionante.

## Fonti (verificate 2026-07-24)

- Shopify Payments Terms of Service (US) §B5 — https://www.shopify.com/legal/terms-payments-us
- Shopify Acceptable Use Policy — https://www.shopify.com/legal/aup · Terms of Service §3 — https://www.shopify.com/legal/terms
- Stripe Prohibited and Restricted Businesses (lista operativa via B5) — https://stripe.com/en-us/legal/restricted-businesses
- PayPal Acceptable Use Policy — https://www.paypal.com/us/legalhub/acceptableuse-full
