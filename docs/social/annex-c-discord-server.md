# Allegato C — Server Discord: struttura operativa

## C.0 — Prima della struttura: due verità scomode

**1. Il server è un impegno di personale permanente, non un lancio.** Un server pubblico attorno alle scommesse attrae, in modo prevedibile e continuo: venditori di pronostici che lavorano in DM, spam affiliato, truffe da "partita truccata", minorenni, e membri che vengono truffati *dentro casa nostra*. Ogni giorno che il server è aperto, qualcuno deve guardarlo. Il team è **due persone**: Andrea e Michele. Due persone non coprono un server pubblico — non di notte, e soprattutto non nel weekend, che è quando si giocano le partite ed è il picco di traffico. Non esiste una configurazione che elimini questo costo; le mitigazioni in C.4 lo riducono.

**2. Il danno peggiore non è lo spam, è la contaminazione del posizionamento.** BetRedge sta cercando di qualificarsi come **non**-gambling (`project_gambling_qualification`, rischio #1 del go-live). Un server dove i membri si scambiano pronostici e link a book è esattamente l'evidenza che un regolatore userebbe per dire il contrario. Lo staff non dà mai un pronostico in chat.

**Raccomandazione mia come AD: il server va aperto per ultimo**, dopo che il billing è reale, e **non** come canale di crescita. Le ragioni sono in C.3.

## C.1 — Struttura dei canali

Deliberatamente minima. Un server con venti canali vuoti sembra morto e moltiplica la superficie da moderare. Si aprono canali quando c'è traffico che li chiede, non prima. Gli sport sono **solo calcio e tennis** perché sono gli unici coperti dal modello oggi.

```
▾ START
   #benvenuto              sola lettura · regole + gate 18+
   #annunci                sola lettura · solo staff
   #come-funziona           sola lettura · cos'è una probabilità calibrata

▾ SPORT
   #calcio                 discussione
   #tennis                 discussione

▾ MODELLO
   #model-vs-mercato       sola lettura · feed del bot: modello vs prezzo
   #risultati              sola lettura · track record, comprese le perdite

▾ COMMUNITY
   #off-topic
   #feedback

▾ STAFF (privato)
   #mod-log                audit log + AutoMod
   #escalation             casi che salgono ad Andrea
```

Canali PRO (`#pro-lounge`, `#pro-early-feed`): **da NON creare al lancio.** Vedi C.3.

`#risultati` include le perdite. Un track record che mostra solo le vittorie è il tell numero uno del tipster, ed è la cosa da cui vogliamo distinguerci.

## C.2 — Ruoli e permessi

| Ruolo | Chi | Permessi chiave |
|---|---|---|
| `@everyone` | tutti | leggere START; **nessun** invio messaggi, **nessun** allega file, **nessun** link esterno, **nessun** invito |
| `@Verificato` | ha passato il gate 18+ | scrivere in SPORT e COMMUNITY; niente link, niente file |
| `@PRO` | abbonato pagante | + accesso ai canali PRO (quando esisteranno) |
| `@Mod` | Andrea, Michele | gestione messaggi, timeout, kick, vede #mod-log |
| `@Admin` | solo Andrea | gestione server, ruoli, ban |
| `@BetRedge Bot` | il bot | invio in #model-vs-mercato e #risultati, assegnazione ruoli |

Regole di permessi che vanno impostate esplicitamente perché i default di Discord sono troppo generosi:

- **Livello di verifica del server: Alto** (email verificata + 5 minuti di iscrizione).
- **Nessun membro può creare inviti.** Toglie `Create Invite` a `@everyone`.
- **Nessun link e nessun allegato per i non-verificati.** È il singolo filtro che blocca più spam.
- **`Mention @everyone` solo a `@Mod`.**
- Canali `sola lettura` = revocare `Send Messages` a `@everyone`, non contare sull'onore.

## C.3 — Come il pagante ottiene il ruolo PRO (il punto che non va nascosto)

**Discord non sa chi ha pagato.** Non esiste un interruttore: il collegamento fra un abbonamento BetRedge e un ruolo Discord è software che va scritto.

### Opzione A — manuale (giorno 1)
Il pagante scrive in un canale `#verifica` con l'email del suo account BetRedge; un mod la incrocia col backoffice e assegna `@PRO` a mano.

- Funziona subito, zero codice.
- Non scala oltre qualche decina di richieste, e crea una coda con un'attesa che il cliente pagante percepisce.
- **Difetto che lo squalifica: non esiste la revoca.** Se l'abbonamento scade, nessuno se ne accorge e `@PRO` resta per sempre. In manuale, PRO diventa gratis con un ritardo. Questo non è un dettaglio: è il motivo per cui l'opzione A non è una soluzione ma un tampone.

### Opzione B — automatica (il bersaglio)
1. Nella dashboard BetRedge un pulsante **"Collega Discord"** avvia un OAuth2 con scope `identify` (+ `guilds.join`).
2. Il backend salva `discord_user_id` sull'utente.
3. Il bot riconcilia lo stato dell'abbonamento e assegna o **rimuove** `@PRO`.
4. La riconciliazione gira **su webhook** (pagamento, disdetta, insoluto) **e** con una passata notturna che raccoglie le scadenze che il webhook ha perso.

Costo: una app Discord + bot, un redirect OAuth2, una colonna in tabella, un job di riconciliazione, e la gestione del caso "utente cambia account Discord". È un progetto, non una spunta.

### Il vincolo che decide la sequenza
L'opzione B si appoggia a un billing che **oggi non è operativo**: Stripe è fermo su Tommy, e `project_payments_golive_state` aspetta ancora **un** pagamento reale end-to-end. Non si costruisce il gating PRO sopra una fondazione che non c'è.

**Quindi: al lancio il server apre senza canali PRO.** Meglio un server senza area PRO che clienti paganti che non riescono ad avere il ruolo che hanno comprato — quello è un ticket di rimborso, non un beneficio.

## C.4 — Regole del server (testo per #benvenuto)

```
BetRedge — regole

1. Solo 18+. Se hai meno di 18 anni, questo server non è per te.
2. Qui si discutono probabilità di modello e prezzi di mercato.
   Niente pronostici garantiti, niente "partita sicura".
3. Vietato vendere pronostici, abbonamenti o sistemi. In chat e in DM.
   Chi lo fa viene bannato senza avviso.
4. Vietati i link a sportsbook, i link affiliati e i codici referral.
5. Non accettare DM da chi si spaccia per lo staff. Lo staff non ti
   scrive mai per primo e non ti chiede mai soldi né credenziali.
6. Niente contenuto di modello ricondiviso fuori dal server.
7. Nessun messaggio qui è un consiglio di scommessa.
   Se il gioco smette di essere un divertimento: [ente di supporto del tuo Paese]

Segnala allo staff con @Mod o in #feedback.
```

La regola 5 esiste perché il truffatore-in-DM che si finge staff è lo schema più comune nei server di betting, e il danno ricade sul nostro nome.

## C.5 — Mitigazioni di moderazione (riducono il costo, non lo azzerano)

- **AutoMod** su: parole bloccate (`fixed match`, `partita truccata`, `pronostici garantiti`, `DM me`), filtro link, filtro spam, menzioni di massa.
- **Slowmode** 30s sui canali sport, 10s su off-topic. Alza a 120s durante le partite.
- **Niente DM tra membri non-verificati**: Discord non lo impone lato server, quindi va scritto in regola 5 e ripetuto in `#annunci`.
- **Log di audit conservati** e letti — un log che nessuno apre non è moderazione.
- **Percorso di escalation scritto**: chi decide un ban, in quanto tempo, e dove si registra.
- **Copertura dichiarata onestamente ai membri**: se il server è presidiato 9-19 nei giorni lavorativi, si scrive in `#benvenuto`. Un server che promette presidio e non lo ha è peggio di uno che dichiara i suoi orari.

## C.6 — Gate di Boost: gli asset che non si possono applicare il giorno 1

Discord mette dietro i Boost proprio gli elementi di identità visiva. Da sapere prima di stupirsi che manchino:

| Elemento | Serve | Costo reale |
|---|---|---|
| Icona server 512×512 | niente | applicabile subito |
| **Invito splash** 1920×1080 | Boost **Livello 1** | 2 boost |
| **Banner server** 960×540 | Boost **Livello 2** | 7 boost |
| **URL personalizzato** `discord.gg/betredge` | Boost **Livello 3** | 14 boost |

Gli asset per splash e banner sono già prodotti e nel repo, ma restano inattivi finché il server non ha i boost. **L'URL `discord.gg/betredge` non è riservabile**: è libero oggi (verificato), ma resta libero per chiunque fino al Livello 3. Non c'è modo di prenotarlo.
