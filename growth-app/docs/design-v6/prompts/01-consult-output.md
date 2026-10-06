1. **[Alta] · La gerarchia rende tutto ugualmente importante.** Negli screenshot 1–5, incassi, freschezza quote e KPI inesistenti ricevono lo stesso contenitore. Steve deve costruirsi la priorità leggendo decine di schede. **Farei:** una fascia iniziale con massimo quattro indicatori decisionali; sotto, righe compatte per le metriche di supporto. I KPI mancanti diventano una lista «Misure bloccate», con impatto e collegamento al gap. WAA e attivazione restano visibili come blocchi decisionali anche quando mancano.

2. **[Alta] · Il primo schermo parla del database, non della giornata.** Nello screenshot 1, header, banner, legenda e avviso precedono qualsiasi lettura operativa. Manca una risposta immediata a «cosa è cambiato». **Farei:** apertura «Da controllare oggi», con massimo tre righe: cambiamento, confronto, limite di interpretazione. Esempio: «Traffico oggi poco interpretabile: 649/702 page view senza paese; 31 stimate probabilmente umane». Timestamp e modalità di lettura diventano una riga di servizio.

3. **[Alta] · I caveat sono documentazione infilata nei componenti.** Nello screenshot 2, la spiegazione delle page view umane determina l’altezza dell’intera riga. Steve deve attraversare lo stesso testo ogni mattina. **Farei:** ogni metrica mostra valore, confronto e una sola limitazione decisiva. Un pulsante «Definizione e limiti» apre un pannello laterale con criterio, esclusioni, finestra e dipendenze. I problemi che invalidano la lettura restano sempre esposti; le definizioni stabili si consultano su richiesta.

4. **[Alta] · “MISURATO” sembra una certificazione di affidabilità.** Negli screenshot 1–2, le 702 page view hanno il badge verde nonostante il 92% senza paese. Inoltre PROXY e STIMATO condividono il codice arancione e STIMATO manca dalla legenda iniziale. **Farei:** separare *origine del numero* e *limite attuale*. «Contato» descrive il metodo; «Copertura sessioni 3%» espone il problema. Cinque stati con nomi e simboli distinti, definiti nel punto C. Nessun significato affidato soltanto al colore.

5. **[Alta] · MANCA consuma lo spazio di un risultato.** Negli screenshot 4–5, MRR, ARPU, uptime e tracking occupano grandi schede quasi vuote. Steve scorre un inventario delle assenze per trovare informazioni utilizzabili. **Farei:** righe «MRR · Non disponibile · importi non normalizzati · G03», apribili sul relativo blocco di lavoro. Per WAA e attivazione, una riga persistente in apertura chiarisce che quelle decisioni sono bloccate. Mai zero; mai sparizione silenziosa della metrica.

6. **[Alta] · Le anomalie sono evidenti ma non gestibili.** L’avviso dello screenshot 1 e le ripetizioni gialle dello screenshot 3 non distinguono un problema attuale da un episodio storico. Gli scostamenti in σ richiedono interpretazione, soprattutto con basi piccole. **Farei:** una coda «Da verificare» con metrica, data, osservato, riferimento, impatto e stato della verifica. Nella tabella, un contatore apre gli episodi; formula e σ stanno nel dettaglio. «Senza paese» resta un problema di qualità da indagare, senza attribuirne automaticamente la causa a bot.

7. **[Alta] · Le finestre mescolano significati temporali diversi.** Negli screenshot 3–5 convivono giorni interi, finestra selezionata, cumulato, istantanea e ultimi 20.000 pronostici. Il selettore globale suggerisce un controllo più uniforme di quello reale. **Farei:** accanto al selettore, intervallo e confronto espliciti. «Oggi, fino alle 13:10 · vs ieri fino alle 13:10»; 7/30 giorni confrontati con periodi equivalenti. Se quel confronto non è disponibile, dichiararlo. Istantanee e cumulati vanno in gruppi etichettati separatamente. Con basi piccole, mostrare delta assoluto e numerosità, senza percentuali enfatiche.

8. **[Alta] · Il funnel promette una sequenza che i dati non dimostrano.** Nello screenshot 1, quattro step collegano sessioni, eventi, profili e ordini; 8 signup dopo 6 visitatori sembrano un errore. La nota arriva dopo l’interpretazione sbagliata. **Farei:** titolo «Conteggi delle fasi · unità diverse, utenti non collegati», quattro colonne senza frecce né percentuali di conversione. Un funnel con conversioni richiede una popolazione coerente e passaggi collegabili. La limitazione deve stare nel titolo, non a fondo scheda.

9. **[Media] · Le fonti sono distribuite fra viste difficili da confrontare.** Nello screenshot 2, sessioni e ingressi per fonte sono tabelle separate; «nessuna fonte» domina senza chiarire subito quanto limiti l’analisi. **Farei:** una sezione «Canali» con tabella fonte/medium, ingressi, sessioni osservate e signup attribuiti, ciascuno con definizione e copertura. «Non attribuito» resta una riga esplicita; medium assente resta «Non registrato». Le colonne mantengono le proprie unità e non implicano un percorso individuale.

10. **[Media] · La navigazione non segue il lavoro.** Nello screenshot 1, «Lavoro →» è marginale; nello screenshot 7, quattro pill introducono una pagina lunghissima. **Farei:** navigazione persistente «Panoramica · Canali · Prodotto · Lavoro», con ancore per le sezioni. Ogni blocco di misura punta al gap preciso; ogni gap rimanda ai KPI interessati. Finestra e posizione si conservano tornando alla dashboard.

11. **[Alta] · Su mobile la prima informazione arriva troppo tardi.** Nello screenshot 6, quasi tutta l’altezza iniziale è occupata da contesto e avvisi; il funnel richiede già più schermate. **Farei:** header su due righe, aggiornamento compatto, avviso con sintesi visibile e dettaglio espandibile, conteggi delle fasi in righe etichetta/valore. Le tabelle diventano elenchi con valori allineati; il confronto storico completo si apre in una vista dedicata. La priorità deve rimanere leggibile senza scorrimento orizzontale.

12. **[Alta] · Il testo necessario è quello meno leggibile.** Negli screenshot 2–5, caveat e finestre usano corpi minuscoli e grigi deboli. Proprio le informazioni che evitano errori richiedono più sforzo. **Farei:** testo operativo almeno 14px, secondario 12–13px solo per metadati brevi; contrasto verificato almeno 4,5:1 per testo normale. Numeri tabulari, focus visibile, controlli touch comodi; anomalie e stati riconoscibili anche senza colore.

13. **[Alta] · /lavoro descrive il lavoro senza mostrarne l’avanzamento.** Lo screenshot 7 espone gap, owner suggeriti e stati «aperto»; dalla struttura descritta, backlog e memo restano più sotto. **Farei:** apertura «Questa settimana» con tre priorità, responsabile confermato, prossimo passo e scadenza. Poi viste «Gap · Esperimenti · Memo · Accessi», con stati e criteri di chiusura. Se gli aggiornamenti restano via repository, mostrare ultima revisione e collegamento al file preciso: niente controlli che simulino modifiche non salvabili.

**A · Tre cose da preservare**

- MANCA distinto da zero.
- Grezzo e stimato disponibili affiancati, con esclusioni verificabili.
- Definizioni, finestre e provenienza esplicite: cambia la collocazione, resta la sostanza.

**B · Home in cinque blocchi**

1. **Contesto:** finestra, confronto, aggiornamento e navigazione.
2. **Brief mattutino:** cambiamenti principali, anomalie attuali, decisioni bloccate.
3. **Percorso di crescita:** conteggi delle fasi, attivazione e WAA con disponibilità dichiarata.
4. **Diagnosi:** canali e andamento; dettaglio di revenue, retention e qualità prodotto.
5. **Azioni:** verifiche aperte, gap prioritari ed esperimenti, collegati a /lavoro.

**C · Sistema di stati**

| Nome | Icona/forma | Colore | Dove compare |
|---|---|---|---|
| Contato | `#`, badge rettangolare | Blu | Accanto al valore |
| Proxy | `≈`, badge rettangolare | Viola | Accanto al valore |
| Stimato | `~`, badge rettangolare | Ambra | Accanto al valore |
| Non disponibile | `—`, contorno tratteggiato | Grigio contrastato | Al posto del valore |
| Errore di lettura | `!` in ottagono | Rosso | Al posto del valore, con dettaglio |

Etichette sempre visibili; tinte e contrasti adattati al tema. Un triangolo con testo segnala separatamente copertura insufficiente o anomalie: il metodo di misura non certifica la qualità.