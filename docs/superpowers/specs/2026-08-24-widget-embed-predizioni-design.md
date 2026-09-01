# Widget embeddabile — predizioni BetRedge su siti terzi

**Data:** 2026-08-24 · **Tag:** `#WIDGET-EMBED-0824` · **Origine:** chiamata Andrea–Sergio
**Obiettivo:** un widget che siti terzi incollano in una riga e che porta traffico attribuito a BetRedge.

## Successo (verificabile)

1. Uno `<script>` incollato su una pagina servita da **un'altra origin** renderizza N predizioni reali, si auto-dimensiona e non eredita né rompe il CSS ospite.
2. Un click sulla CTA arriva su betredge.com con il `ref` del partner nell'URL (il rail referral esistente lo persiste).
3. Un partner **non** in allowlist non può ottenere la versione aperta modificando l'HTML dello snippet.
4. Il resto del sito resta non-incorporabile (`X-Frame-Options: SAMEORIGIN` invariato fuori da `/embed`).

## Architettura

Tre pezzi, nessuna modifica al board o alle API servite.

### 1. `public/widget.js` — il tag del partner (~2 KB, nessuna dipendenza)

```html
<script src="https://betredge.com/widget.js" async
        data-ref="SERGIO" data-sport="tennis" data-limit="4"
        data-lang="it" data-theme="auto"></script>
```

Responsabilità: leggere i `data-*` dal proprio tag (`document.currentScript`), inserire un
`<iframe>` subito dopo di sé, passare l'hostname ospite in query, ricevere l'altezza via
`postMessage` e applicarla. Niente altro: nessun global, nessun CSS iniettato nell'ospite,
nessuna lettura di cookie o storage del sito ospite.

Difese: `postMessage` accettato **solo** se `event.source === iframe.contentWindow` e
`event.origin` è l'origin dell'embed; altezza clampata (120–2000 px); il tag può comparire
più volte nella stessa pagina (nessuno stato condiviso).

### 2. `app/embed/route.ts` — la pagina del widget

Route handler che ritorna **HTML puro** (niente React, niente bundle client, CSS inline):
il widget si carica su siti di terzi, il peso e l'isolamento contano più del riuso dei
componenti. Interattività limitata a link e a un `<script>` inline di ~10 righe che notifica
l'altezza al parent.

Query: `?ref=&sport=&limit=&lang=&theme=&host=`.

Header **solo su questo path**: nessun `X-Frame-Options`, CSP con `frame-ancestors *`.
`next.config.ts` esclude `/embed` dalla regola globale con una source negativa, così la
deroga è una riga leggibile e testabile invece di una sovrascrittura implicita.
Cache: `public, s-maxage=120, stale-while-revalidate=60` — la risposta non dipende da
sessione (nessun cookie letto), quindi è share-cacheable senza il rischio descritto in
`app/api/v2/predictions/route.ts`.

### 3. `lib/embed-feed.ts` — i dati

Query dedicata sui ~10 campi mostrati (niente enrichment/goalscorer/soft: payload ~10×
più leggero). **Non duplica le decisioni di prodotto**: riusa `PREDICTION_WINDOW_DAYS`,
`showcaseRanking`/`compareShowcase` e `projectPrediction` di `lib/access-projection`, così
widget e board non possono divergere su quale sia il pick né su cosa è sbloccato.
Stessi filtri di sicurezza del board: `is_demo = FALSE`, `is_historical = FALSE`,
`published_at IS NOT NULL`, finestra di pubblicazione, 150 minuti di coda in-play.

## Le due versioni

| Versione | Chi la vede | Proiezione |
|---|---|---|
| **teaser** (default) | chiunque | `free`: top-1 per sport scoperta, le altre con partita/orario/competizione + pick oscurato e CTA |
| **aperta** | partner in allowlist | `premium`: tutte le pick visibili |

**La versione la decide il server**, dal `ref` confrontato con `EMBED_FULL_REFS`
(lista di codici, env var). `data-mode` nell'HTML non esiste di proposito: se esistesse,
chiunque copiasse lo snippet otterrebbe il prodotto gratis cambiando un attributo.
Ref assente, malformato o sconosciuto → teaser, sempre.

*Scorciatoia intenzionale:* allowlist in env var invece che in tabella. Limite: va fatto un
redeploy per aggiungere un partner. Upgrade quando i partner superano ~10 → tabella
`embed_partners` (ref, mode, domini consentiti, attivo).

Il `ref` è validato con la **stessa regex del register e di `/r/[code]`**
(`/^[A-Z0-9_-]{2,20}$/`): non valido → nessun ref, mai troncato in silenzio.

## Attribuzione e misura

CTA → `https://betredge.com/?ref=CODICE&utm_source=widget&utm_medium=embed&utm_campaign=<host>`.
Si linka la home e **non** `/r/CODICE` perché quel redirect ricostruisce l'URL e conserva
solo `ref`, buttando via gli utm.

Due eventi nuovi nell'allowlist di `app/api/track/route.ts`: `widget_view`, `widget_click`,
con `meta.host` e `meta.ref` → si misura quale sito converte, non solo il canale.
`host` arriva dal client ed è quindi dichiarato, non certificato: va bene per analytics
(vale già per ogni altro evento di quell'endpoint), non per decidere accessi.

## Contenuto e compliance

- Nessun claim di performance nel widget (niente percentuali di vincita, niente "battiamo
  il mercato"): il perimetro FTC vale qui come sulle card.
- 18+ e "solo a scopo informativo" visibili nel widget, non in un tooltip.
- Le probabilità mostrate sono quelle servite dall'API, arrotondate una sola volta: mai
  due numeri che sommano a 101%.
- Nessun cookie, nessuno storage, nessun fingerprint sul sito ospite → niente consenso
  cookie da chiedere all'ospite.
- **La pubblicazione ai partner resta gated** su Andrea/legale: il perimetro gambling
  (`project_gambling_qualification`) è il rischio #1 aperto e un widget distribuisce il
  contenuto in giurisdizioni ignote.

## Test

Unit (vitest, `lib/`+`app/`):
- teaser sblocca **esattamente** una riga per sport; aperta le sblocca tutte;
- un `ref` fuori allowlist non ottiene la versione aperta (test di sicurezza);
- `ref` malformato → nessun ref nella CTA;
- righe `is_demo`/`is_historical`/non pubblicate mai servite;
- CTA contiene ref + utm; nessun claim vietato nell'HTML generato;
- `widget.js`: parsing dei `data-*`, URL costruito, resize applicato solo dal source giusto.

Header: `/embed` senza `X-Frame-Options` e con `frame-ancestors *`; un path qualsiasi
non-embed conserva `SAMEORIGIN`.

Verifica reale (obbligatoria prima di dire "fatto"): pagina di prova servita da
`http://localhost:8001` contro l'app su `:3000` — screenshot desktop e 390px, click che
porta il ref giusto.

## Fuori scope

Personalizzazione grafica per partner (colori/logo ospite), widget "singola partita",
statistiche per partner in dashboard, versione AMP.
