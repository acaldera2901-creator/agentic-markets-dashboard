# Kit di apertura profili social — BetRedge

TikTok · YouTube · Discord. Preparato dall'Art Director il **2026-08-10**. Deck Maven, item 07-08-09-10.
Tutto ciò che si poteva fare senza l'identità di Andrea è fatto. Quello che resta a lui è in §5.

---

## 1. ⚠️ LEGGERE PRIMA: il vincolo di piattaforma

Nessuna delle tre piattaforme vieta un profilo che pubblica probabilità di modello. **Ma su due delle tre il contenuto è limitato in modo che cambia il piano**, e su una c'è un rischio di rimozione che oggi è aperto.

**YouTube — ammesso, ma age-restricted, e i link possono far chiudere il canale.**
Fonte primaria: [Illegal or regulated goods or services policies](https://support.google.com/youtube/answer/9229611?hl=en).
- Age-restricted 18+: «Content that facilitates access to, promotes, or depicts online gambling … **including content from certified sites**».
- **Non consentito** (≠ age-restricted): «Facilitating access to an online gambling or sports betting site that is not certified» e «Promising the viewer guaranteed returns».
- Il rischio concreto per noi **non è il modello, sono i link**: BetRedge ha 8 partner affiliati LIVE. Un link in descrizione a un book non Google-certified sta nella lista dei *vietati*.
- **Aperto e non risolvibile da me:** linkare `betredge.com`, che ospita `/partners` con link affiliati, è accesso indiretto — la policy vieta «facilitate access to». È la stessa domanda di `project_gambling_qualification` (rischio #1 del go-live). **Va sciolta dall'avvocato prima di pubblicare.**

**TikTok — organico ammesso 18+, promozione a pagamento di fatto chiusa.**
- Ads: «Gambling ads are only allowed in specified markets where gambling is legal and when all local certifications and requirements are met» ([policy ads](https://ads.tiktok.com/help/article/tiktok-ads-policy-gambling-and-games)). Serve una licenza di gambling — che BetRedge, che si vuole qualificare come *non*-gambling, non avrà. Le due posizioni sono in tensione: **non si può insieme dire "non siamo gambling" e certificarsi come gambling advertiser.**
- Organico: contenuto su gambling «restricted (18 years and older)» ([Community Guidelines](https://www.tiktok.com/community-guidelines/en/regulated-commercial-activities)). ⚠️ **Evidenza parziale, dichiarata**: la pagina è una SPA che non si è resa né via WebFetch (2 tentativi, troncata) né via curl (2,5 MB, zero occorrenze di "gambl"). Questo viene dagli snippet della pagina ufficiale, non dal testo integrale.
- **La domanda che decide se TikTok vale la fatica è ancora aperta:** se il contenuto age-restricted sia eleggibile alla For You feed. Se non lo è, TikTok perde il suo unico motore di crescita. → costa 1 WebFetch in una prossima sessione, o una verifica dalla app.

**Discord — nessun divieto di piattaforma.** Il costo è altrove: §4.

**Conseguenza operativa:** l'age-restriction non è burocrazia, è una **tassa sulla distribuzione** su YouTube e TikTok. Un piano di crescita che assume reach piena su queste due è sbagliato in partenza. Dettaglio e citazioni: [Allegato A](annex-a-platform-policy.md).

---

## 2. Handle — esito reale dei controlli

Metodo: `docs/social/check-handles.sh`, rieseguibile. **Non ho usato gli status code**: il controllo con un handle inventato ha mostrato che tutte tre le piattaforme rispondono uguale a un nome inesistente (TikTok 200, YouTube 302, Discord 301) — lo status non discrimina. Ho usato marker di contenuto, ognuno validato con un controllo positivo *e* uno negativo.

| Piattaforma | Handle | Esito | Evidenza |
|---|---|---|---|
| TikTok | `@betredge` | 🔴 **PRESO** | `statusCode:0` + `uniqueId:betredge` + `followerCount:3` |
| TikTok | `@betr.edge` | 🟢 **libero** | `statusCode:10221` (= utente inesistente) |
| TikTok | `@betredgeai` | 🟢 libero | `statusCode:10221` |
| YouTube | `@betredge` | 🟢 **libero** | 404 · controllo positivo: `@MrBeast`/`@Google` → 200 con contenuto |
| YouTube | `@betredgeai` | 🟢 libero | 404 |
| YouTube | `@betredgeofficial` | 🟢 libero | 404 |
| Discord | `discord.gg/betredge` | 🟢 libero | API `invites`: `Unknown Invite 10006` · controllo positivo: `/python`, `/discord-developers` → JSON |
| Discord | `discord.gg/betr-edge` | 🟢 libero | `10006` |
| Discord | `discord.gg/betredgeai` | 🟢 libero | `10006` |

**Preferenze:**
- **TikTok: 1) `@betr.edge` 2) `@betredgeai` 3) `@betredge.official`** — `@betredge` è occupato da un account con 3 follower. `@betr.edge` è anche identico all'handle Instagram: coerenza migliore del nome che abbiamo perso.
- **YouTube: 1) `@betredge` 2) `@betredgeai` 3) `@betredgeofficial`** — il primo è libero, si prende quello.
- **Discord:** l'URL personalizzato **non è riservabile**: richiede Boost Livello 3 (14 boost) e resta libero per chiunque fino a quel momento. Non c'è modo di prenotarlo.

⚠️ La disponibilità è fotografata al 2026-08-10 e **decade**. Rilanciare lo script il giorno della creazione.

---

## 3. Naming e bio — EN + IT

Testo pronto da incollare in [Allegato B](annex-b-copy.md). Ogni campo **misurato**, non stimato: il più vicino al limite è la bio TikTok (67/80 = 84%). I limiti di caratteri vengono dalla conoscenza delle piattaforme e **non sono verificati in questa sessione** (il tetto di 6 WebFetch è andato sul vincolo gambling, che aveva priorità); mitigazione: ogni testo sta ben sotto, così passa anche se il limite reale è più stretto.

Il claim ammesso è **la probabilità calibrata da un modello affiancata al prezzo di mercato**, mai il profitto. Le descrizioni lunghe portano una riga esplicita *"Cosa NON facciamo: promettere vincite, garantire rendimenti o dire che battiamo il mercato"* — la qualifica sta nello stesso quadro del claim, non in un footer.

---

## 4. Discord — struttura, e il costo che porta con sé

Documento operativo completo (canali, permessi, regole, AutoMod): [Allegato C](annex-c-discord-server.md). I due punti che non devono passare inosservati:

**Il server è un impegno di personale permanente, non un lancio.** Un server pubblico sulle scommesse attrae in modo prevedibile venditori di pronostici in DM, spam affiliato, truffe da "partita truccata", minorenni, e membri truffati dentro casa nostra. Il team è **due persone**, senza copertura notturna né nel weekend — che è il picco, perché è quando si gioca. Nessuna configurazione elimina questo costo.

**Come il pagante ottiene `@PRO`:** Discord non sa chi ha pagato. Serve un OAuth2 "Collega Discord" nella dashboard + un bot che riconcilia l'abbonamento e **rimuove** il ruolo alla scadenza (webhook + passata notturna). L'alternativa manuale — un mod incrocia l'email col backoffice — **non ha revoca**: PRO diventa gratis appena scade. E l'opzione automatica si appoggia a un billing che oggi non è operativo (`project_payments_golive_state`: manca ancora **un** pagamento reale end-to-end).
→ **Al lancio il server apre senza canali PRO.** Meglio nessuna area PRO che clienti paganti senza il ruolo che hanno comprato.

---

## 5. Cosa deve fare Andrea a mano

Non delegabile perché richiede il suo numero, la sua identità e l'accettazione dei ToS come titolare.

1. **Prima di tutto: portare all'avvocato la domanda di §1** (link a `betredge.com` con `/partners` affiliato = "facilitating access" per YouTube?). Se la risposta è no, il canale YouTube parte con un rischio di chiusura noto. Questo viene **prima** della creazione degli account.
2. **Decidere se TikTok si apre adesso** o dopo aver verificato l'eleggibilità For You dei contenuti 18+.
3. **Creare gli account** con gli handle di §2 (rilanciare `check-handles.sh` lo stesso giorno).
4. **Impostare 18+** dove la piattaforma lo consente, a livello di account e non solo di contenuto.
5. **Caricare gli asset** di `assets/` (§6) e incollare bio e descrizioni dall'Allegato B.
6. **Decidere sul server Discord**: aprirlo ora accettando il carico di moderazione a due persone, o rinviarlo a dopo il billing. La mia raccomandazione come AD è **rinviarlo**.
7. **Se apre Discord:** designare chi modera e in quali orari, e scriverlo in `#benvenuto`.

---

## 6. Asset prodotti

In `docs/social/assets/`, alle dimensioni reali di ciascuna piattaforma. Identità riusata: mark e lockup ufficiali da `public/logos/betredge-logo-white.png`, **nessun marchio nuovo disegnato**. Token letti da `app/globals.css`: fondo `#0B0C0E`, accento `#23A559`, Hanken Grotesk + JetBrains Mono incorporati (nessun font fuori kit).

| File | Dimensione | Uso |
|---|---|---|
| `tiktok-avatar-800.png` | 800×800 | foto profilo TikTok (min. 200×200) |
| `youtube-avatar-800.png` | 800×800 | foto canale YouTube (consigliato 800×800) |
| `youtube-banner-2560x1440.png` | 2560×1440 | banner canale, contenuto entro la safe-area 1546×423 |
| `discord-icon-512.png` | 512×512 | icona server |
| `discord-banner-960x540.png` | 960×540 | banner server — **richiede Boost Livello 2** |
| `discord-invite-splash-1920x1080.png` | 1920×1080 | splash invito — **richiede Boost Livello 1** |
| `brand-mark-transparent.png` | 422×459 | mark isolato, fondo trasparente, riusabile |
| `proof-avatar-sizes.png` | prova | l'avatar nel ritaglio circolare a 32/40/48/98/160px |

Rigenerabili con `python3 docs/social/gen-assets.py`.

**Limite trovato e non nascosto:** in `proof-avatar-sizes.png` si vede che **sotto i 48px il mark diventa una macchia verde** — la freccia interna e le diagonali collassano. Da 64px in su regge bene. Il limite è del marchio, non della composizione, e per risolverlo servirebbe un mark semplificato per le dimensioni piccole: è un lavoro di brand, da assegnare al brand-visual-designer e da approvare Andrea. **Non l'ho inventato io adesso** — l'identità esistente non si tocca senza mandato.

---

## 7. Stato

`ad_ok` **dato** sugli asset: li ho guardati renderizzati, non sul brief. In prima passata avevo bocciato il banner per tre difetti reali (font fallback di sistema invece di Hanken; due righe verdi parallele; lockup ri-assemblato a mano invece di quello ufficiale) e li ho corretti prima di consegnare.

**Costruito ≠ Verificato:** i file esistono e sono corretti nelle dimensioni. Nessun account è stato creato, nessuna bio è pubblicata, nessun asset è stato caricato su una piattaforma. Il kit è pronto; l'apertura no, e dipende da §5.1.

**Correzione al mio stesso playbook, da propagare:** l'accento del brand è **`#23A559`**, non `#3DA268` come scritto nel corso AD. Il token in `app/globals.css` si chiama ancora `--am-coral` ma dopo il rebrand del 2026-06-22 contiene il verde. Chi genera asset fidandosi del playbook produce un verde sbagliato.
