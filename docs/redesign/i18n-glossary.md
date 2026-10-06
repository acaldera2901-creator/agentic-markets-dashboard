# Redesign v3c · F10 — glossario unico delle 11 lingue

Fonte di verità dei termini fissi per tradurre la copy v3c (`lib/v3c/*copy*.ts`, `lib/i18n/v3c-tools/*`,
`lib/v3c/home-faq.ts`, `components/v3c/States.tsx`). EN è la fonte, IT è approvata. Le scelte delle altre
nove lingue seguono la terminologia scommesse locale **e** i termini già pubblicati sul sito nelle stesse
lingue (`lib/tools/copy/<lang>.ts`, hub tool #TOOLS-HUB-0805): stessa parola per «board», «quota»,
«margine» che il visitatore vede già. Portoghese = **europeo** (pt-PT: «registo», «equipa»), come il resto del sito.

Regole che valgono in ogni lingua:
- **Restano invariati:** numeri, `pp`, `EV`, `Kelly`, `70/30`, `Brier`, `18+`, `Free`, `Pro`, `BetRedge`, i nomi dei partner/book, i segnaposto `{x}` e gli argomenti delle funzioni.
- **«price»** nel senso di quota decimale (2.15) = la parola locale per quota. **«market %»** = probabilità di mercato.
- **«edge»** non si usa mai come profitto: dove EN dice edge nel senso di stima − mercato si traduce come **gap**.
- **Vietati in ogni lingua** (e i loro equivalenti): guaranteed, sure win, lock, easy money, «battiamo il mercato», ROI/CLV/hit-rate come promessa, qualsiasi promessa di vincita.
- Helpline e leggi nazionali: **non si inventano**, restano i placeholder/link esistenti.
- Stringhe legali e di prezzo: commento `// REVIEW-NATIVE` (revisione di madrelingua/avvocato prima del lancio).

| EN | IT (approvato) | DE | ES | FR | NL | PL | PT (pt-PT) | RU | SV | TR |
|---|---|---|---|---|---|---|---|---|---|---|
| market | mercato | Markt | mercado | marché | markt | rynek | mercado | рынок | marknad | piyasa |
| market % (margin removed) | mercato % (margine tolto) | Markt-% (ohne Marge) | % de mercado (sin margen) | % du marché (marge retirée) | markt-% (zonder marge) | % rynku (bez marży) | % de mercado (sem margem) | % рынка (без маржи) | marknads-% (utan marginal) | piyasa %'si (marj hariç) |
| estimate | stima | Schätzung | estimación | estimation | schatting | szacunek | estimativa | оценка | uppskattning | tahmin |
| gap | gap | Abstand | diferencia | écart | verschil | różnica | diferença | разрыв | skillnad | fark |
| points (pp) | punti (pp) | Punkte (pp) | puntos (pp) | points (pp) | punten (pp) | pkt (pp) | pontos (pp) | п.п. → resta `pp` | punkter (pp) | puan (pp) |
| sealed / seal | sigillato / sigillo | versiegelt / Siegel | sellado / sello | scellé / sceau | verzegeld / zegel | zapieczętowany / pieczęć | selado / selo | зафиксирован / печать | förseglad / sigill | mühürlü / mühür |
| record (ledger) | registro | Register | registro | registre | register | rejestr | registo | реестр | register | kayıt defteri |
| receipt | ricevuta | Beleg | comprobante | justificatif | bewijs | potwierdzenie | comprovativo | квитанция | kvitto | makbuz |
| edge (= gap, mai profitto) | gap | Abstand | diferencia | écart | verschil | różnica | diferença | разрыв | skillnad | fark |
| price (odds) | prezzo / quota | Quote | cuota | cote | odds | kurs | odd | коэффициент | odds | oran |
| best price | miglior prezzo | beste Quote | mejor cuota | meilleure cote | beste odds | najlepszy kurs | melhor odd | лучший коэффициент | bästa odds | en iyi oran |
| odds on site | quota sul sito | Quote auf der Seite | cuota en su web | cote sur le site | odds op de site | kurs na stronie | odd no site | коэффициент на сайте | odds på sajten | oran sitede |
| book / bookmaker | book | Buchmacher | casa de apuestas | bookmaker | bookmaker | bukmacher | casa de apostas | букмекер | spelbolag | bahis sitesi |
| connected books | book connessi | verbundene Buchmacher | casas conectadas | bookmakers connectés | gekoppelde bookmakers | połączeni bukmacherzy | casas ligadas | подключённые букмекеры | anslutna spelbolag | bağlı bahis siteleri |
| margin | margine | Marge | margen | marge | marge | marża | margem | маржа | marginal | marj |
| model | modello | Modell | modelo | modèle | model | model | modelo | модель | modell | model |
| blend 70/30 | blend 70/30 | Mix 70/30 | mezcla 70/30 | mélange 70/30 | mix 70/30 | mieszanka 70/30 | combinação 70/30 | смесь 70/30 | mix 70/30 | 70/30 karışım |
| Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro | Free / Pro |
| board | board | Board | tablero | tableau | board | tablica | board | панель | board | pano |
| tool | strumento | Tool | herramienta | outil | tool | narzędzie | ferramenta | инструмент | verktyg | araç |
| price check | controllo prezzo | Quoten-Check | comprobar cuota | vérifier la cote | odds-check | sprawdź kurs | verificar odd | проверка коэффициента | oddskoll | oran kontrolü |
| line movement | movimento della linea | Quotenverlauf | movimiento de cuotas | mouvement des cotes | oddsbeweging | ruch kursów | movimento das odds | движение коэффициентов | oddsrörelse | oran hareketi |
| calibration | calibrazione | Kalibrierung | calibración | calibration | kalibratie | kalibracja | calibração | калибровка | kalibrering | kalibrasyon |
| Brier (score) | Brier | Brier-Score | puntuación Brier | score de Brier | Brier-score | wynik Briera | pontuação Brier | оценка Брайера → `Brier` | Brier-poäng | Brier skoru |
| kick-off | fischio d'inizio | Anstoß | inicio | coup d'envoi | aftrap | początek | início | начало | avspark | başlama |
| affiliate link | link affiliato | Affiliate-Link | enlace de afiliado | lien affilié | affiliatelink | link afiliacyjny | link de afiliado | партнёрская ссылка | affiliatelänk | ortaklık bağlantısı |
| not advice | analisi, non consigli | Analyse, keine Beratung | análisis, no consejos | analyse, pas des conseils | analyse, geen advies | analiza, nie porady | análise, não conselhos | анализ, не советы | analys, inga råd | analiz, tavsiye değil |
| estimate, not advice | stima, non consiglio | Schätzung, keine Empfehlung | estimación, no consejo | estimation, pas un conseil | schatting, geen advies | szacunek, nie porada | estimativa, não conselho | оценка, не совет | uppskattning, inget råd | tahmin, tavsiye değil |
| 18+ | 18+ | 18+ | 18+ | 18+ | 18+ | 18+ | 18+ | 18+ | 18+ | 18+ |
| responsible gambling | gioco responsabile | verantwortungsvolles Spielen | juego responsable | jeu responsable | verantwoord spelen | odpowiedzialna gra | jogo responsável | ответственная игра | ansvarsfullt spelande | sorumlu oyun |
| play responsibly | gioca responsabilmente | Spiel verantwortungsvoll | juega con responsabilidad | jouez de manière responsable | speel verantwoord | graj odpowiedzialnie | jogue com responsabilidade | играйте ответственно | spela ansvarsfullt | sorumlu oyna |
| football / tennis | calcio / tennis | Fußball / Tennis | fútbol / tenis | football / tennis | voetbal / tennis | piłka nożna / tenis | futebol / ténis | футбол / теннис | fotboll / tennis | futbol / tenis |
| draw | pareggio | Unentschieden | empate | match nul | gelijkspel | remis | empate | ничья | oavgjort | beraberlik |
| live | live | Live | en directo | en direct | live | na żywo | ao vivo | в эфире / live | live | canlı |
| bankroll | bankroll | Bankroll | bankroll | bankroll | bankroll | bankroll | banca | банкролл | bankrulle | kasa |

Note per lingua:
- **DE** — «Sie» no: il sito usa il «du» (vedi `lib/i18n/locales/de.ts`). Sostantivi composti corti per stare nelle colonne.
- **Registro** come negli hub tool già pubblicati (`lib/tools/copy/<lang>.ts`): ES «tú», PT «tu», NL «je», SV «du», PL «ty», TR «sen»; **FR «vous»** e **RU «вы»** (forma di cortesia, come lì).
- **RU / PL** — plurali veri (1 / 2–4 / 5+ e le eccezioni 11–14) dove l'EN distingue singolare/plurale.
- **TR** — suffissi attaccati ai numeri con apostrofo (`70%'i`) solo dove serve; altrimenti frase che li evita.

## Stato F10 (06/10/2026, branch `betredge/v3c-i18n`)
- Tradotte le 9 lingue (de es fr nl pl pt ru sv tr) su tutti i dizionari v3c: copy, match, record, pages, community, FAQ home, stati (404/500/vuoto), tool. Parità meccanica in `lib/v3c/i18n-parity.test.ts`.
- `// REVIEW-NATIVE` su ogni stringa legale e di prezzo (855 marcature): da far rivedere a madrelingua/avvocato **prima del lancio**.
- Scelte da confermare per prime: «Guaranteed profit» dell'arbitraggio reso ovunque come «profitto in ogni esito» (l'EN e l'IT dicono ancora «guaranteed/garantito»: decidere se allineare anche loro); «longer/shorter» del prezzo reso come quota più alta/bassa o probabilità più bassa/alta a seconda della lingua; diritto di recesso 14 giorni (pt «livre resolução»).
- Resta in inglese (fuori dai dizionari, da fare): gli esempi del banco/tool (`previewInput` in `lib/v3c/tools.ts`: «at», «on», «bets», «none»; anche in IT), il giorno «Tue» nelle tabelle tool, l'`aria-label` del nastro (`describeScale`), il sigillo grafico «SEALED BEFORE KICK-OFF · PUBLIC LEDGER», il banner cookie del sito, i nomi delle fonti di correzione (`Corrections.tsx`).
- Preesistente (anche EN/IT): a 390 px le etichette lunghe dei tre input tool vanno in ellissi (`.v3c-lab` overflow hidden); il grafico settimanale del record scorre in orizzontale.
