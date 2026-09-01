// lib/tools/copy/de.ts (#TOOLS-HUB-0805)
// Deutsch. Lokale Keywords: „Quotenrechner“, „Value-Rechner“, „Kelly-Formel“,
// „Buchmacher-Marge“.

import type { ToolsCopy } from "./types";

const de: ToolsCopy = {
  hub: {
    metaTitle: "Kostenlose Wett-Tools — Quoten, EV, Kelly und Marge | BetRedge",
    metaDescription:
      "11 kostenlose Rechner: Quoten in jedes Format umrechnen, Buchmacher-Marge entfernen, Erwartungswert berechnen, den Einsatz mit Kelly bestimmen, Arbitrage prüfen und die Rendite messen. Ohne Anmeldung.",
    h1: "Kostenlose Wett-Tools",
    lede:
      "Die elf Rechnungen, die vor jeder Wette anstehen: Quoten umgerechnet, Marge entfernt, Einsatz bestimmt, Rendite gemessen. Kostenlos, ohne Konto.",
    cardCta: "Tool öffnen",
    intro: [
      "Jede Wette ist ein Vergleich zwischen einem Preis und einer Wahrscheinlichkeit. Diese elf Rechner führen diesen Vergleich sauber durch: sie übersetzen Quoten zwischen den Formaten, entfernen die Marge des Buchmachers und legen die faire Linie frei, verwandeln eine Wahrscheinlichkeitsschätzung in einen Erwartungswert, fassen die Beine einer Kombiwette zu einer Quote zusammen, zeigen, wann zwei Buchmacher weit genug auseinanderliegen für eine Arbitrage, bestimmen den Einsatz so, dass eine Verlustserie die Bankroll nicht beendet, und messen hinterher, was diese Wetten wirklich gebracht haben.",
      "Alles läuft vollständig im Browser: nichts wird gesendet, nichts gespeichert, kein Konto nötig. Nutze sie für sich — oder nutze sie, um zu prüfen, was unser Modell zu jedem Spiel längst veröffentlicht.",
    ],
  },

  common: {
    backLabel: "Startseite",
    ctaTitle: "Diese Zahlen rechnen wir zu jedem Spiel",
    ctaBody:
      "Die Rechner behandeln einen Preis nach dem anderen. BetRedge scannt den Markt fortlaufend, entfernt die Marge, vergleicht mit der Modellwahrscheinlichkeit und zeigt, wo beide auseinandergehen — Fußball und Tennis, den ganzen Tag aktualisiert.",
    ctaButton: "Zum heutigen Board",
    otherTools: "Weitere kostenlose Tools",
    langLabel: "Sprache",
    free: "Gratis",
    faqTitle: "Fragen",
    invalid: "—",
    tgTitle: "Die Modellprognose des Tages, kostenlos auf Telegram",
    tgBody:
      "Ohne Konto, ohne E-Mail. Jeden Tag veröffentlichen wir das Spiel, bei dem unser Modell am stärksten vom Markt abweicht, 15 Minuten vor Beginn — und jede veröffentlichte Prognose rechnen wir ab, gewonnen oder verloren. Der Kanal ist auf Englisch.",
    tgButton: "Kanal öffnen",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Quotenrechner — dezimal, Bruch, amerikanisch und implizite Wahrscheinlichkeit | BetRedge",
      metaDescription:
        "Kostenloser Quotenrechner: gib einen Preis in einem beliebigen Format ein — dezimal, Bruch, amerikanisch, Hongkong, Malay, Indonesian — und lies ihn in allen anderen.",
      h1: "Quotenrechner",
      lede:
        "Gib einen Preis in einem Format ein und lies ihn in allen anderen — samt der Wahrscheinlichkeit, die der Buchmacher damit behauptet.",
      labels: {
        inputTitle: "Dein Preis",
        oddsInput: "Quote",
        formatSelect: "Format",
        resultTitle: "Derselbe Preis in jedem Format",
        decimal: "Dezimal",
        american: "Amerikanisch",
        fractional: "Bruch",
        hongkong: "Hongkong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Implizite Wahrscheinlichkeit",
        hint: "Dezimal akzeptiert auch das Komma: 2,50 gilt wie 2.50.",
      },
      takeaway:
        "Jede Quote ist eine verkleidete Wahrscheinlichkeit. Erst umrechnen, dann diskutieren: 2.50 heißt, der Buchmacher sagt dir 40 %.",
      example: {
        title: "Eine Quote, jedes Format",
        rows: [
          { label: "Du gibst ein", value: "2.50" },
          { label: "Amerikanisch", value: "+150" },
          { label: "Bruch", value: "3/2" },
          { label: "Hongkong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Implizite Wahrscheinlichkeit", value: "40,00 %" },
        ],
        note:
          "Ändere eine, und die anderen folgen. Achtung bei der Rundung: die bekannte −110 ist dezimal 1.9091 und impliziert 52,38 %, während eine angezeigte 1.91 nur 52,36 % impliziert — ein Unterschied, der wie nichts aussieht und zählt, denn der Vorteil entscheidet sich in Zehntelpunkten.",
      },
      explainerTitle: "Einen Preis in jedem Format lesen",
      explainer: [
        "**Eine Quote ist eine Wahrscheinlichkeit in anderer Kleidung.** Die Dezimalquote — europäischer Standard — nennt die Gesamtrückzahlung pro Einheit Einsatz: 2.50 zahlt 2.50 für jede riskierte 1, Einsatz inklusive. Die Bruchquote nennt den Gewinn: 3/2 sind drei Einheiten Gewinn auf zwei riskierte, dieselbe 2.50. Die amerikanische Quote sagt, wie viel du auf 100 gewinnst (+150) oder wie viel du riskieren musst, um 100 zu gewinnen (−110). Hongkong, Malay und Indonesian sind die asiatischen Formate, und sie zählen, weil dort oft die schärfsten Preise stehen.",
        "Die Zahl, die zu lesen lohnt, ist die letzte. **Die implizite Wahrscheinlichkeit ist 1 geteilt durch die Dezimalquote**, und sie ist die einzige Größe, die du direkt mit deiner eigenen Schätzung vergleichen kannst: zwei Quoten in verschiedenen Schreibweisen vergleichen sich nicht leichter als zwei Wahrscheinlichkeiten. Eine Grenze, die dieses Werkzeug nicht aufheben kann: **die implizite Wahrscheinlichkeit enthält weiter die Marge des Buchmachers**, addiere also alle Ergebnisse eines Marktes und du liegst über 100 %. Für die ehrliche Markteinschätzung statt der bepreisten schicke den Markt durch den Margen-Rechner.",
      ],
      faq: [
        {
          q: "In welchem Format sollte man rechnen?",
          a: "In dezimal, wenn nichts dagegen spricht. Multiplizierte Dezimalquoten ergeben direkt den Preis einer Kombiwette, und 1 geteilt durch die Quote ergibt die implizite Wahrscheinlichkeit — beides ist in Bruch- oder amerikanischer Notation unpraktisch.",
        },
        {
          q: "Warum wird aus −110 1,909090…?",
          a: "Weil 100/110 eine periodische Dezimalzahl ist. Auf zwei Stellen gerundet ergibt das 1.91, was jeder Buchmacher anzeigt, aber der Rechner behält intern die volle Genauigkeit, damit eine Kette von Rechenschritten nicht abdriftet.",
        },
        {
          q: "Was unterscheidet Malay- und Indonesian-Quoten?",
          a: "Sie sind Spiegelbilder. Malay-Quoten sind unter 2.00 positiv und darüber negativ; Indonesian-Quoten sind über 2.00 positiv und darunter negativ. Beide drücken denselben Preis aus und ergeben dieselbe Dezimalquote.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Margen-Rechner — Overround, Auszahlungsquote und faire Quoten | BetRedge",
      metaDescription:
        "Kostenloser Margen-Rechner: gib die Quoten aller Ergebnisse ein und erhalte die Buchmacher-Marge, die Auszahlungsquote sowie die fairen Quoten ohne Marge.",
      h1: "Margen-Rechner",
      lede:
        "Gib alle Preise eines Marktes ein und sieh, was der Buchmacher einbehält — und welche faire Linie darunter liegt.",
      labels: {
        inputTitle: "Der Markt",
        outcome: "Ergebnis",
        addOutcome: "Ergebnis hinzufügen",
        removeOutcome: "Entfernen",
        resultTitle: "Was der Buchmacher verlangt",
        margin: "Buchmacher-Marge",
        payout: "Auszahlungsquote",
        fairOddsTitle: "Faire Linie, Marge entfernt",
        fairOdds: "Faire Quote",
        fairProbability: "Faire Wahrscheinlichkeit",
        impliedProbability: "Implizite Wahrscheinlichkeit",
        hint: "Für Drei-Wege-Märkte ein Ergebnis hinzufügen, für Siegwetten entsprechend mehr.",
      },
      takeaway:
        "Die Marge ist der Preis für das Recht, eine Meinung zu haben. Zwei Buchmacher, dasselbe Spiel — und der Unterschied ist Geld.",
      example: {
        title: "Dasselbe Spiel bei zwei Buchmachern",
        rows: [
          { label: "Freizeit-Buchmacher", value: "1.90 / 1.90 · Marge 5,26 %" },
          { label: "Scharfer Buchmacher", value: "1.98 / 1.98 · Marge 1,01 %" },
          { label: "Faire Linie, beide", value: "2.00 / 2.00 · je 50 %" },
          { label: "Dein EV bei echten 50 %", value: "−5 % gegen −1 % pro Wette" },
        ],
        note:
          "Gleiche Meinung, gleiches Spiel. 100 zweihundertmal gesetzt kostet beim ersten Buchmacher 1.000 und beim zweiten 200: die acht Cent Quotenunterschied sind 800 über eine Saison. Das ist der billigste Vorteil im Wetten, und er braucht kein Modell.",
      },
      explainerTitle: "Die Marge ist der Preis der Wette",
      explainer: [
        "**Ein fairer Zwei-Wege-Markt bepreist beide Seiten mit 2.00.** Die impliziten Wahrscheinlichkeiten liegen bei 50 % und 50 %, summieren sich auf genau 100 %, und keine Seite hat einen Vorteil. Reale Märkte stehen bei 1.90 und 1.90: diese Impliziten betragen je 52,63 %, summieren sich auf 105,26 %, und **die überschüssigen 5,26 Punkte sind die Marge des Buchmachers** — der Overround. Welche Seite du auch spielst, du zahlst sie. Margen schwanken stark: Hauptlinien scharfer Buchmacher liegen unter 2 %, während Siegwetten und Spielermärkte regelmäßig 8 % und mehr tragen — dort wissen die Buchmacher ihre Preise am wenigsten geprüft.",
        "Das Entfernen der Marge ergibt die faire Linie, die No-Vig-Linie. Dieser Rechner macht das proportional — jede Implizite geteilt durch ihre Summe, sodass sie wieder genau 100 % ergeben — und **diese faire Linie ist der Bezugspunkt jeder +EV-Entscheidung**: eine Wette hat nur positiven Erwartungswert, wenn deine Wahrscheinlichkeit die faire übertrifft, nicht bloß die bepreiste. Eine offene Grenze: reale Buchmacher legen mehr Marge auf unwahrscheinliche Ergebnisse, in einem Markt mit klarem Favoriten unterschätzt diese Methode ihn also leicht. Bei ausgewogenen Linien ist die Verzerrung klein; bei Lotterie-Siegwetten ist die faire Linie eine Schätzung.",
      ],
      faq: [
        {
          q: "Welche Marge ist akzeptabel?",
          a: "Bei Hauptlinien in Fußball und Tennis gilt unter 3 % als scharf, 4–5 % als normal bei einem Freizeitbuchmacher, über 7 % zahlst du viel für das Recht, eine Meinung zu haben. Vergleiche denselben Markt bei mehreren Buchmachern.",
        },
        {
          q: "Sind Auszahlungsquote und Marge dasselbe?",
          a: "Zwei Lesarten derselben Zahl. Eine Marge von 5,26 % entspricht einer Auszahlungsquote von 95 %: der Buchmacher erwartet, über den gesamten Markt 95 von je 100 Einsatz zurückzugeben. Die Auszahlungsquote vergleicht sich leichter.",
        },
        {
          q: "Warum summieren sich die fairen Wahrscheinlichkeiten auf genau 100 %?",
          a: "Weil genau das die Entfernung der Marge bedeutet. Die bepreisten summieren sich auf mehr als 100 %; teilt man jede durch diese Summe, werden sie so skaliert, dass sie eins ergeben — was ein kohärenter Satz Wahrscheinlichkeiten tun muss.",
        },
        {
          q: "Funktioniert das bei Drei-Wege- oder Siegwetten-Märkten?",
          a: "Ja — füge so viele Ergebnisse hinzu, wie der Markt hat. Die Mathematik ist für jede Anzahl von Ergebnissen identisch, solange du alle eingibst. Lässt du eines weg, wird die Marge unterschätzt.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "EV-Rechner — Erwartungswert einer Wette, mit oder ohne faire Linie | BetRedge",
      metaDescription:
        "Kostenloser Erwartungswert-Rechner: gib Quote, Wahrscheinlichkeit und Einsatz ein und erhalte den EV in Währung und Prozent — oder leite die faire Wahrscheinlichkeit ab.",
      h1: "EV-Rechner",
      lede:
        "Was eine Wette im Durchschnitt wert ist: aus deiner eigenen Wahrscheinlichkeit oder aus der Linie eines scharfen Buchmachers ohne Marge.",
      labels: {
        inputTitle: "Die Wette",
        modeTitle: "Woher kommt die Wahrscheinlichkeit",
        modeManual: "Meine Schätzung",
        modeSharp: "Von einem scharfen Buchmacher",
        yourOdds: "Dein Preis",
        yourProbability: "Deine Wahrscheinlichkeit (%)",
        sharpOddsA: "Scharfer Preis, deine Seite",
        sharpOddsB: "Scharfer Preis, andere Seite",
        derivedProbability: "Faire Wahrscheinlichkeit, Marge entfernt",
        stake: "Einsatz",
        resultTitle: "Was die Wette wert ist",
        ev: "Erwartungswert",
        fairOdds: "Break-even-Preis",
        edge: "Vorteil",
        positive: "Positiver Erwartungswert zu diesem Preis.",
        negative: "Negativer Erwartungswert zu diesem Preis.",
        neutral: "Break-even: der Preis entspricht genau der Wahrscheinlichkeit.",
        hint: "Prozentwerte als Zahl eingeben: 55 bedeutet 55 %.",
      },
      takeaway:
        "Du musst den Markt nicht überlisten — nur einen Buchmacher finden, der langsamer ist als der schärfste.",
      example: {
        title: "Die Wahrscheinlichkeit von einem scharfen Buchmacher leihen",
        rows: [
          { label: "Scharfer Buchmacher, beide Seiten", value: "1.95 / 1.95" },
          { label: "Faire Wahrscheinlichkeit, Marge entfernt", value: "50,00 %" },
          { label: "Break-even-Preis", value: "2.00" },
          { label: "Dein Buchmacher bietet", value: "2.10" },
          { label: "EV auf 100 Einsatz", value: "+5,00 (+5 %)" },
        ],
        note:
          "Es war keine Meinung nötig: die scharfe Linie lieferte die Wahrscheinlichkeit, und dein Buchmacher bepreiste dasselbe Ergebnis mit 2.10, wo 2.00 fair war. Setze die scharfen Preise auf 1.90/1.90 und die faire Wahrscheinlichkeit bleibt 50 % — genau darum geht es beim Entfernen der Marge: die Antwort wandert nicht mit dem Vig.",
      },
      explainerTitle: "Was der Erwartungswert wirklich sagt",
      explainer: [
        "**Der Erwartungswert ist das durchschnittliche Ergebnis einer Wette, die du unbegrenzt wiederholen könntest.** Zwei Eingaben, keine Meinung: der angebotene Preis und die Wahrscheinlichkeit, die du dem Ergebnis gibst. Du glaubst, ein Team gewinnt in 55 % der Fälle, und jemand bietet 2.00 — die Rechnung ist sofort da: in 55 % gewinnst du eine Einheit, in 45 % verlierst du sie, also 0,10 Einheiten pro Einheit Einsatz. Das sind 10 % Vorteil, und mehr bedeutet +EV nicht.",
        "**Die Wahrscheinlichkeit ist die Stelle, an der fast alle still verlieren.** Ein Fehler von 5 Punkten macht aus 4 % Vorteil 1 % Verlust, und nach Gefühl gebildete Schätzungen liegen weit mehr daneben. Daher der zweite Modus dieses Rechners: statt dem Bauchgefühl zu trauen, nimm beide Seiten bei einem scharfen Buchmacher, entferne die Marge und nutze die faire Wahrscheinlichkeit, die dabei herauskommt. Lies das Ergebnis als Rate, nicht als Versprechen — 4 % Vorteil liefern bei einer einzelnen Wette nichts, sie zeigen sich erst über hunderte, und nur wenn die Wahrscheinlichkeit stimmte. Darum zählt die Einsatzhöhe so viel wie der Vorteil.",
      ],
      faq: [
        {
          q: "Wie komme ich zu einer belastbaren Wahrscheinlichkeit?",
          a: "Aus einem datenbasierten Modell oder aus dem Markt selbst. Die faire Linie eines scharfen Buchmachers — seine Preise ohne Marge — ist mit reinem Urteil schwer zu übertreffen und kostenlos einzusehen.",
        },
        {
          q: "Ist eine Wette mit positivem EV eine gute Wette?",
          a: "Notwendige, aber nicht hinreichende Bedingung. Sie kann positiven Erwartungswert haben und trotzdem falsch sein, wenn der Einsatz zu groß für die Bankroll ist, der Vorteil im Schätzfehler liegt oder der Markt vor Anpfiff gegen dich läuft.",
        },
        {
          q: "Warum werden beide Seiten des scharfen Marktes gebraucht?",
          a: "Weil sich aus einem einzelnen Preis keine Marge entfernen lässt. Sie wird erst sichtbar, wenn die impliziten Wahrscheinlichkeiten aller Ergebnisse addiert werden: der zweite Preis macht die faire Wahrscheinlichkeit berechenbar.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Kelly-Rechner — optimaler Einsatz aus Vorteil und Bankroll | BetRedge",
      metaDescription:
        "Kostenloser Kelly-Rechner: gib Quote, Wahrscheinlichkeit und Bankroll ein und erhalte den Einsatz, der langfristiges Wachstum maximiert — voll, halb oder viertel Kelly.",
      h1: "Kelly-Rechner",
      lede:
        "Der Einsatz, der eine Bankroll langfristig am schnellsten wachsen lässt — und warum die meisten bewusst weniger setzen sollten.",
      labels: {
        inputTitle: "Wette und Bankroll",
        odds: "Preis",
        probability: "Deine Wahrscheinlichkeit (%)",
        bankroll: "Bankroll",
        fractionTitle: "Kelly-Anteil",
        fractionFull: "Voll",
        fractionHalf: "Halb",
        fractionQuarter: "Viertel",
        resultTitle: "Empfohlener Einsatz",
        stake: "Einsatz",
        stakePercent: "Anteil der Bankroll",
        edge: "Vorteil",
        fullKelly: "Voller Kelly",
        growth: "Erwartetes Wachstum pro Wette",
        noEdge: "Kein Vorteil zu diesem Preis — der optimale Einsatz ist null.",
        hint: "Prozentwerte als Zahl eingeben: 55 bedeutet 55 %.",
      },
      takeaway:
        "Kelly bemisst den Einsatz am Vorteil, nicht an deiner Überzeugung — und fast alle sollten bewusst weniger setzen, als er sagt.",
      example: {
        title: "Was das mit 1.000 Bankroll bedeutet",
        rows: [
          { label: "Bankroll", value: "1.000" },
          { label: "Quote · deine Wahrscheinlichkeit", value: "2.00 · 55%" },
          { label: "Vorteil", value: "+10%" },
          { label: "Voller Kelly", value: "10% → 100 pro Wette" },
          { label: "Halber Kelly", value: "5% → 50 pro Wette" },
        ],
        note:
          "Fünf Niederlagen in Folge — bei dieser Quote eine Serie von 54 — lassen bei vollem Kelly 590 übrig, und es braucht +69%, um wieder auf 1.000 zu kommen. Dieselbe Serie bei halbem Kelly lässt 774, dafür genügen +29%. Gleicher Vorteil, gleiche Wetten, halbes Loch.",
      },
      explainerTitle: "Den Einsatz so wählen, dass die Verlustserie ihn nicht beendet",
      explainer: [
        "Die Kelly-Formel beantwortet, was der Erwartungswert offenlässt: Wie viel soll man bei gegebenem Vorteil tatsächlich riskieren? Setzt man zu wenig, verzinst sich ein echter Vorteil zu langsam, um zu zählen. Setzt man zu viel, dreht sich die Mathematik gegen einen: eine halbierte Bankroll braucht +100 %, um zurückzukommen, große Einsätze zerstören also das Wachstum selbst dann, wenn jede einzelne Wette günstig ist. Der optimale Anteil ist der Vorteil geteilt durch die Nettoquote, und **er skaliert mit dem Vorteil, nicht mit der Überzeugung**: 10 % Vorteil bei 2.00 verlangen 10 % der Bankroll, derselbe Vorteil bei 5.00 nur 2,5 %.",
        "**Voll Kelly sollte fast niemand spielen**, denn die Formel setzt voraus, dass deine Wahrscheinlichkeit genau stimmt — und das tut sie nie. Gib ihr einen überschätzten Vorteil, und sie empfiehlt bereitwillig einen Einsatz, der für den tatsächlichen Vorteil zu groß ist: der schnellste Weg, eine Bankroll zu verlieren, obwohl man im Mittel richtig liegt. Halb Kelly verzichtet auf ein Viertel des theoretischen Wachstums und halbiert die Schwankung ungefähr; viertel Kelly nutzen viele Profis mit echten Modellen. Und bietet der Preis keinen Vorteil, ist der richtige Einsatz null: ein negativer Kelly-Anteil heißt, die Wette gehört auf die andere Seite — nie, dass man hier weniger setzen soll.",
      ],
      faq: [
        {
          q: "Voll, halb oder viertel Kelly?",
          a: "Halb oder viertel für fast alle. Voll ist nur optimal, wenn die Wahrscheinlichkeitsschätzung genau stimmt, und Schätzfehler schaden bei zu hohem Einsatz deutlich mehr, als sie bei zu niedrigem helfen. Fraktionaler Kelly tauscht etwas Wachstum gegen viel Überlebensfähigkeit.",
        },
        {
          q: "Was ist das erwartete Wachstum pro Wette?",
          a: "Das durchschnittliche logarithmische Wachstum der Bankroll für eine Wette zu diesem Einsatz. Es ist konstruktionsbedingt klein — 0,005 entspricht etwa einem halben Prozentpunkt zusammengesetztem Wachstum pro Wette — und es ist die Größe, die Kelly maximiert.",
        },
        {
          q: "Und wenn mehrere Wetten gleichzeitig laufen?",
          a: "Einzelwetten-Kelly setzt zu viel, wenn Wetten parallel laufen, besonders bei Korrelation. Als Praxisregel: den Gesamtbetrag auf die gleichzeitigen Positionen aufteilen und korrelierte Wetten wie eine behandeln.",
        },
        {
          q: "Warum steht null, obwohl ich einen Vorteil sehe?",
          a: "Weil deine Wahrscheinlichkeit beim eingegebenen Preis den Break-even-Punkt nicht überschreitet. Vergleiche den Preis mit 1 geteilt durch deine Wahrscheinlichkeit: liegt der Preis darunter, gibt es keinen Vorteil zu setzen.",
        },
      ],
      caveat:
        "Die Kelly-Formel maximiert langfristiges Wachstum, nicht Bequemlichkeit. Auch beim korrekten Einsatz sind Rückgänge von 30 % und mehr gewöhnlich, und die Formel setzt eine genaue Wahrscheinlichkeitsschätzung voraus: ist sie optimistisch, setzt Kelly systematisch zu viel und die Bankroll kann verloren gehen. Setze niemals Geld, das du brauchst.",
    },

    "probability-calculator": {
      metaTitle: "Wahrscheinlichkeitsrechner — Quoten, Break-even und Kombiwetten | BetRedge",
      metaDescription:
        "Kostenloser Wahrscheinlichkeitsrechner für Wetten: Wahrscheinlichkeit und Quote umrechnen, die Break-even-Wahrscheinlichkeit eines Preises finden und Kombiwetten berechnen.",
      h1: "Wahrscheinlichkeitsrechner",
      lede:
        "Wahrscheinlichkeiten in Preise verwandeln und zurück, sehen was ein Preis von dir verlangt, und was eine Kombiwette wirklich wert ist.",
      labels: {
        inputTitle: "Wahrscheinlichkeit und Preis",
        modeTitle: "Was hast du?",
        modeProbability: "Eine Wahrscheinlichkeit",
        modeOdds: "Einen Preis",
        probability: "Wahrscheinlichkeit (%)",
        odds: "Dezimalquote",
        breakEven: "Break-even-Wahrscheinlichkeit",
        fairOdds: "Fairer Preis",
        parlayTitle: "Kombiwette",
        leg: "Position",
        addLeg: "Position hinzufügen",
        removeLeg: "Entfernen",
        parlayProbability: "Kombinierte Wahrscheinlichkeit",
        parlayOdds: "Kombinierte Quote",
        resultTitle: "Ergebnisse",
        hint: "Ein Preis und seine Break-even-Wahrscheinlichkeit sind dieselbe Zahl von zwei Seiten gelesen.",
      },
      takeaway:
        "Positionen multiplizieren sich — und die Marge des Buchmachers mit ihnen. Eine Vierfach-Kombi zu 1.80 verlangt ein Ereignis mit 9,5 %.",
      example: {
        title: "Was eine Vierfach-Kombi wirklich kostet",
        rows: [
          { label: "Vier Positionen zu", value: "je 1.80 · 55,56 %" },
          { label: "Kombinierte Quote", value: "10.50" },
          { label: "Kombinierte Wahrscheinlichkeit", value: "9,53 %" },
          { label: "Marge pro Position", value: "5 %" },
          { label: "Marge auf der Kombi", value: "21,6 %" },
        ],
        note:
          "Die Quote sieht großzügig aus, bis man merkt, was sie verlangt: ein Ereignis mit 9,5 %. Und die Marge des Buchmachers hat sich viermal verzinst — 1,05⁴ − 1 = 21,6 % — dieselben vier Positionen kosten dich also die vierfache Marge einer Einzelwette. Korrelierte Positionen aus einem Spiel sind etwas anderes: Multiplizieren unterschätzt sie, und genau deshalb bepreisen Buchmacher Kombis innerhalb eines Spiels separat.",
      },
      explainerTitle: "Zuerst die Wahrscheinlichkeit, dann der Preis",
      explainer: [
        "**Jeder Preis ist eine Behauptung über eine Wahrscheinlichkeit**, und die Umrechnung ist eine Division: 40 % sind ein Preis von 2.50, und 2.50 sind 40 %. Diese Umrechnung vor der Wette verändert die Frage von „gefällt mir diese Wette?“ zu „passiert das in mehr als 40 % der Fälle?“ — eine Frage, bei der man sich irren kann. Von der Preisseite gelesen ist dieselbe Zahl die **Break-even-Wahrscheinlichkeit**: die Mindestchance, die ein Ergebnis braucht, damit die Wette neutral ist. 1.75 verlangt 57,1 %; 1.50 verlangt 66,7 %; 15.00 nur 6,7 % — deshalb wirken lange Quoten billig und deshalb legen Buchmacher dort ihre Marge auf.",
        "**Bei Kombiwetten wird Wahrscheinlichkeit unintuitiv.** Unabhängige Positionen multiplizieren sich: drei Wetten, die du je bei 50 % siehst, ergeben zusammen 12,5 % — nicht etwas beruhigend Halbes. Vier Positionen bei 60 % ergeben 12,96 %. Die kombinierte Quote multipliziert sich genauso, und darin liegt die Falle: die Zahl wird groß, während die Chance klein wird, und die Marge verzinst sich mit. Behalte die Annahme im Kopf: hier wird multipliziert, also Unabhängigkeit vorausgesetzt. Zwei Ergebnisse desselben Spiels sind korreliert, und dort ist die echte Wahrscheinlichkeit anders, meist höher als das Produkt.",
      ],
      faq: [
        {
          q: "Was ist die Break-even-Wahrscheinlichkeit?",
          a: "Die Chance, die ein Ergebnis haben muss, damit eine Wette zu diesem Preis langfristig neutral ist. Sie ist 1 geteilt durch die Dezimalquote und die Hürde, die deine Schätzung überspringen muss, damit die Wette Sinn hat.",
        },
        {
          q: "Warum ist die Wahrscheinlichkeit meiner Kombi so niedrig?",
          a: "Weil Wahrscheinlichkeiten multipliziert werden. Jede zusätzliche Position macht das Ganze unwahrscheinlicher, und eine Kette plausibler Positionen wird schnell zu einer unwahrscheinlichen Wette. Die Quote steigt entsprechend — die aufsummierte Marge aber auch.",
        },
        {
          q: "Gilt das auch für Kombis innerhalb eines Spiels?",
          a: "Nicht genau. Multiplizieren setzt Unabhängigkeit voraus, und Ergebnisse eines Spiels sind es meist nicht. Bei korrelierten Positionen ist die echte Wahrscheinlichkeit anders — oft höher als das Produkt — weshalb Buchmacher diese Märkte separat bepreisen.",
        },
        {
          q: "Ist die implizite Wahrscheinlichkeit die echte Wahrscheinlichkeit?",
          a: "Nein. Sie enthält weiter die Marge des Buchmachers und liegt daher systematisch über der ehrlichen Markteinschätzung. Entferne sie mit dem Margen-Rechner, bevor du sie mit deiner eigenen Zahl vergleichst.",
        },
      ],
    },

    "arbitrage-calculator": {
      metaTitle: "Arbitrage-Rechner — Einsatz auf mehrere Buchmacher aufteilen | BetRedge",
      metaDescription:
        "Kostenloser Arbitrage-Rechner: die beste Quote je Ergebnis bei verschiedenen Buchmachern eingeben und Summe der Impliziten, Aufteilung des Einsatzes und Gewinn sehen — oder dass es keinen gibt.",
      h1: "Arbitrage-Rechner",
      lede:
        "Gib die beste verfügbare Quote je Ergebnis ein und sieh, ob zwei Buchmacher zusammen eine Marge übrig lassen — und wie der Einsatz dann aufzuteilen ist.",
      labels: {
        inputTitle: "Beste Quote je Ergebnis",
        outcome: "Ergebnis",
        addOutcome: "Ergebnis hinzufügen",
        removeOutcome: "Entfernen",
        total: "Gesamteinsatz",
        resultTitle: "So wird aufgeteilt",
        profit: "Gewinn",
        impliedSum: "Summe der impliziten Wahrscheinlichkeiten",
        stakeOn: "Einsatz auf Ergebnis",
        guaranteedReturn: "Rückfluss bei jedem Ergebnis",
        verdictArb:
          "Die Quoten summieren sich auf unter 100 %: so aufgeteilt zahlt jedes Ergebnis denselben Betrag zurück.",
        verdictNoArb:
          "Die Quoten summieren sich auf über 100 %, hier gibt es also keine Arbitrage — jede Aufteilung verliert diese Marge, egal welches Ergebnis kommt.",
        hint: "Eine Quote je Ergebnis, jeweils vom Buchmacher, der auf dieser Seite am meisten zahlt. Dezimal akzeptiert das Komma: 2,10 gilt wie 2.10.",
      },
      takeaway:
        "Arbitrage ist keine Prognose. Sie verlangt nie, beim Sieger richtig zu liegen — sie verlangt, dass zwei Buchmacher weiter auseinanderliegen als ihre eigenen Margen.",
      example: {
        title: "Zwei Buchmacher, 1.000 zum Aufteilen",
        rows: [
          { label: "Quoten, je ein Buchmacher", value: "2.10 · 2.10" },
          { label: "Summe der impliziten Wahrscheinlichkeiten", value: "95,24 %" },
          { label: "Einsatz je Seite, von 1.000", value: "500 · 500" },
          { label: "Rückfluss bei jedem Ergebnis", value: "1.050" },
          { label: "Gewinn", value: "+50 (+5,00 %)" },
        ],
        note:
          "Derselbe Markt zu 1.90/1.90 innerhalb eines Buchmachers summiert sich auf 105,26 % und gibt −5,00 % zurück, wie man auch aufteilt. Am Spiel hat sich zwischen den beiden Linien nichts geändert: der ganze Unterschied liegt darin, welcher Buchmacher auf welcher Seite mehr zahlt — und ob man bei beiden gedeckte Konten hatte, während die Quoten noch standen.",
      },
      explainerTitle: "Wenn zwei Buchmacher weit genug auseinanderliegen",
      explainer: [
        "**Addiere eins geteilt durch jede Quote, und du hältst den ganzen Markt in einer einzigen Zahl.** Innerhalb eines Buchmachers liegt diese Zahl immer über 100 % — die Marge hält sie dort. Aber die beste Quote der einen Seite und die beste der anderen stehen oft bei verschiedenen Buchmachern, und kombiniert kann die Summe unter 100 % fallen. Das ist die ganze Bedingung: **die impliziten Wahrscheinlichkeiten müssen zusammen unter 1 bleiben**. Teile den Gesamteinsatz im Verhältnis dieser Impliziten auf, und jedes Ergebnis zahlt denselben Betrag zurück — was du zurückbekommst, hängt damit nicht mehr am Resultat. Zwei Quoten von 2.10 summieren sich auf 95,24 %, und 500 auf jeder Seite eines Einsatzes von 1.000 bringen 1.050 zurück, wie das Spiel auch ausgeht.",
        "**In der Praxis schließt sich das deutlich seltener, als die Arithmetik vermuten lässt, und die Gründe zählen mehr als die Formel.** Quoten bewegen sich: die entdeckte Lücke ist meist der langsamere Buchmacher, der nachzieht, und sie kann in den Sekunden zwischen erster und zweiter Wette verschwinden — dann hältst du eine gewöhnliche, ungedeckte Wette zu einer Quote, die du zum Absichern und nicht wegen ihres Werts gewählt hast. Einsatzlimits greifen genau dort am härtesten, wo die Lücke am größten ist: 5 % auf dem Papier sind oft 5 % auf vierzig Einheiten und nicht auf tausend. Und **Buchmacher beschränken Konten, die das systematisch betreiben** — erst niedrigere Limits, später abgelehnte Wetten und Schließungen. Rechne das bei mehreren Buchmachern gebundene Kapital und den Währungsspread dazwischen hinzu, und Arbitrage liest sich weniger wie eine Maschine als wie ein langsamer, operativ aufwendiger Weg, eine dünne Marge abzuschaben.",
      ],
      faq: [
        {
          q: "Brauche ich ein Konto bei jedem Buchmacher?",
          a: "Ja. Eine Arbitrage existiert nur zwischen den konkreten Buchmachern, die diese konkreten Quoten stellen — es braucht also gedeckte Konten bei jedem von ihnen, bevor die Quoten sich bewegen. Dieses Kapital, auf mehrere Anbieter verteilt und meist ungenutzt, ist der Posten, den kaum ein Rechner zeigt.",
        },
        {
          q: "Was passiert, wenn die zweite Quote fällt, bevor ich sie spiele?",
          a: "Dann bleibt die erste Wette allein stehen: eine gewöhnliche Wette zu einer Quote, die zum Absichern und nicht wegen ihres Werts gewählt wurde. Setze die Seite zuerst, die sich am ehesten bewegt, und behandle das Ungedeckt-Bleiben als Teil des Risikos, nicht als Unfall.",
        },
        {
          q: "Warum beschränken Buchmacher Arbitrage-Spieler?",
          a: "Weil ihre Marge von ausgeglichenem Fluss der Freizeitkunden lebt und ein Konto, das immer nur die beste Quote einer Seite nimmt, für sie reiner Kostenposten ist. Beschränkungen kommen leise als niedrigere Einsatzlimits, lange vor der Kontoschließung.",
        },
        {
          q: "Ist Arbitrage-Wetten legal?",
          a: "Die Tätigkeit selbst ist legal: es sind gewöhnliche Wetten zu veröffentlichten Quoten. Verbieten können sie die AGB des Buchmachers, die sich meist das Recht vorbehalten, Wetten zu limitieren, abzulehnen oder zu annullieren, die sie als Arbitrage einordnen. Legal und erlaubt sind nicht dasselbe.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Kombiwetten-Rechner — kombinierte Quote, echte Wahrscheinlichkeit, zusammengesetzte Marge | BetRedge",
      metaDescription:
        "Kostenloser Kombiwetten-Rechner: jede Position eingeben und die kombinierte Quote, die tatsächlich nötige Wahrscheinlichkeit und die pro Position wachsende Marge sehen.",
      h1: "Kombiwetten-Rechner",
      lede:
        "Jede zusätzliche Position multipliziert die Quote — und multipliziert den Anteil des Buchmachers mit. Hier stehen beide Zahlen, bevor die Wette steht.",
      labels: {
        inputTitle: "Die Positionen",
        leg: "Position",
        addLeg: "Position hinzufügen",
        removeLeg: "Entfernen",
        marginPerLeg: "Marge des Buchmachers pro Position (%)",
        resultTitle: "Was die Kombi wert ist",
        combinedOdds: "Kombinierte Quote",
        impliedProb: "Wahrscheinlichkeit, dass sie durchgeht",
        compoundMargin: "Zusammengesetzte Marge",
        verdict:
          "Multiplizieren setzt unabhängige Positionen voraus. Zwei Tipps aus demselben Spiel sind es nicht: ihre echte Wahrscheinlichkeit liegt meist über dem Produkt, und deshalb bepreisen Buchmacher Kombis innerhalb eines Spiels mit einem eigenen Modell.",
        hint: "Eine Dezimalquote pro Position, bis zu acht. Die Marge pro Position kommt als Zahl hinein: 5 bedeutet 5 %, etwa so viel wie ein enger Zwei-Wege-Markt hält.",
      },
      takeaway:
        "Der Anteil des Buchmachers addiert sich nicht über die Positionen, er verzinst sich — vier Positionen zu 1.80 sehen wie vier fast ausgeglichene Wetten aus und sind ein einziges Ereignis mit 9,53 %.",
      example: {
        title: "Vier Positionen zu 1.80, eine Wette mit 9,53 %",
        rows: [
          { label: "Positionen", value: "4 × 1.80" },
          { label: "Kombinierte Quote", value: "10.50" },
          { label: "Wahrscheinlichkeit, dass sie durchgeht", value: "9,53 %" },
          { label: "Marge pro Position", value: "5 %" },
          { label: "Zusammengesetzte Marge", value: "21,55 %" },
        ],
        note:
          "Für sich genommen ist jede Position die Wette, über die niemand nachdenkt: 55,56 % implizit, 1.80 im Gewinnfall. Verkettet verlangen die vier ein Ereignis mit 9,53 % — und die 5 %, die der Buchmacher je Position hält, werden zu 1,05⁴ − 1 = 21,55 % auf der Kombi. Der Wette wurde nichts hinzugefügt außer weiteren Wegen, sie zu verlieren: die Quote stieg, weil die Chance fiel.",
      },
      explainerTitle: "Warum die Quote schneller wächst als die Chance",
      explainer: [
        "**Eine Kombi ist eine Wette mit mehreren Wegen zu verlieren, nicht mehrere Wetten.** Die kombinierte Quote ist das Produkt der Positionen — 1.80 viermal genommen ergibt 10.4976 — und die Wahrscheinlichkeit ist das Produkt der Wahrscheinlichkeiten. Genau dort hört die Arithmetik auf, freundlich zu sein: vier Tipps, die du einzeln fast ausgeglichen nennen würdest, ergeben 9,53 %. Die Marge verhält sich gleich, und das ist der Teil, den fast niemand einrechnet. Sie addiert sich nicht Position für Position, sie **verzinst sich**: ein Buchmacher, der bei jeder von vier Positionen 5 % hält, hält 1,05⁴ − 1 = 21,55 % auf der Kombi, und bei acht Positionen sind aus denselben 5 % je Position 47,75 % geworden. Die Auszahlung sieht großzügig aus, weil die Chance eingebrochen ist, nicht weil jemand mehr für dasselbe Risiko zahlt.",
        "**Kombiwetten sind das am stärksten bewerbene Produkt der Wettbranche und das für den Kunden ungünstigste**, und das ist ein und derselbe Sachverhalt von zwei Seiten: je größer die zusammengesetzte Marge, desto mehr kann sich ein Buchmacher Quotenboosts, Absicherungen und Werbung für diesen Schein leisten. Ein dünner Vorteil auf einer Position übersteht die Multiplikation mit drei weiteren Positionen Marge nicht — dieselben Tipps als Einzelwetten zahlen die Marge je einmal, die Vierfachkombi zahlt sie vierfach. Bleibt, was das Multiplizieren voraussetzt: **dass die Positionen unabhängig sind**. Zwei Tipps aus demselben Spiel sind korreliert, Multiplizieren ist dort also die falsche Rechnung: Heimsieg und Treffer des eigenen Stürmers treten oft gemeinsam auf, das Paar ist damit wahrscheinlicher als das Produkt sagt, während Positionen, die kaum zusammen bestehen können, deutlich weniger wert sind. Deshalb bauen Buchmacher Kombis innerhalb eines Spiels mit einem eigenen Modell, statt dich sie aus den Einzelwetten zusammensetzen zu lassen — und deshalb ist dieser Rechner bei Positionen aus verschiedenen Spielen ehrlich.",
      ],
      faq: [
        {
          q: "Gilt das auch für Kombis innerhalb eines Spiels?",
          a: "Nicht genau. Hier wird multipliziert, und Multiplizieren setzt unabhängige Positionen voraus. Ergebnisse innerhalb eines Spiels bewegen sich gemeinsam, die echte Wahrscheinlichkeit des Paares ist also anders — oft höher als das Produkt. Genau deshalb bepreisen Buchmacher diese Märkte mit einem eigenen Modell und nicht aus den Einzelwetten.",
        },
        {
          q: "Warum ist die kombinierte Wahrscheinlichkeit so niedrig?",
          a: "Weil Wahrscheinlichkeiten multipliziert und nicht gemittelt werden. Vier Positionen mit 55,56 % ergeben 9,53 %: jede zusätzliche Position macht die ganze Wette unwahrscheinlicher, und eine Kette plausibler Tipps wird schnell zu einer unwahrscheinlichen Wette. Die Quote steigt entsprechend, und mit ihr die angesammelte Marge.",
        },
        {
          q: "Was ist die zusammengesetzte Marge genau?",
          a: "Der Anteil des Buchmachers, nachdem ihn jede Position multipliziert hat. Gib ein, was eine Position kostet — rund 5 % bei einem engen Zwei-Wege-Markt — und der Rechner verzinst sie: eins plus Marge, hoch Anzahl der Positionen, minus eins. Vier Positionen zu 5 % kosten 21,55 %, acht Positionen 47,75 %.",
        },
        {
          q: "Sind vier Einzelwetten besser als eine Vierfachkombi?",
          a: "Für jeden, der auf einen Vorteil wettet, ja: dieselben vier Tipps als Einzelwetten zahlen die Marge je einmal statt sie zu multiplizieren, und eine falsche Position kostet eine Wette statt den ganzen Schein. Die Kombi kauft Varianz — eine kleine Chance auf einen großen Betrag — und der Preis dieser Varianz ist die zusammengesetzte Marge.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "ROI-Rechner für Wetten — Rendite auf die Bankroll | BetRedge",
      metaDescription:
        "Kostenloser ROI-Rechner für Wetten: Kapital und Gewinn eingeben und Rendite der Bankroll, Endkapital und den Grund lesen, warum derselbe Gewinn 4 % Yield ist.",
      h1: "ROI-Rechner",
      lede:
        "Was die Bankroll in einem Zeitraum gebracht hat — und warum derselbe Gewinn von 400 hier 40 % ROI und auf der anderen Seite 4 % Yield ist.",
      labels: {
        inputTitle: "Kapital und Ergebnis",
        capital: "Kapital",
        profit: "Gewinn",
        resultTitle: "Rendite auf dieses Kapital",
        roi: "ROI",
        endingCapital: "Kapital danach",
        hint: "Der Gewinn wird netto eingetragen und darf negativ sein: -250 ist ein Verlustzeitraum. Kapital ist die Bankroll im Risiko, nicht der gesamte Einsatz.",
        verdict:
          "Der ROI hängt vollständig vom Nenner ab, also nenne ihn: 400 auf einer Bankroll von 1.000 sind 40 %, dieselben 400 auf 10.000 Umsatz sind 4 % Yield. Keine der beiden Zahlen sagt viel ohne Zeitraum und Anzahl der Wetten dahinter.",
      },
      takeaway:
        "Der ROI sagt, was die Bankroll gebracht hat. Er sagt nicht, ob die Strategie gut ist, denn dieselben 40 % können aus 200 Wetten oder aus einem glücklichen Samstag kommen.",
      example: {
        title: "400 Gewinn auf einer Bankroll von 1.000",
        rows: [
          { label: "Kapital", value: "1.000" },
          { label: "Gewinn im Zeitraum", value: "+400" },
          { label: "ROI", value: "+40,00 %" },
          { label: "Kapital danach", value: "1.400" },
          { label: "Dieselben 400 auf 10.000 Umsatz", value: "Yield +4,00 %" },
        ],
        note:
          "Beide Prozentzahlen beschreiben ein einziges identisches Ergebnis. Für +40,00 % auf der Bankroll brauchte es 200 Wetten zu 50 — 10.000 Umsatz, zehnmal das Kapital — und 4,00 % dieses Umsatzes sind dieselben 400. Dreh die Bankroll zweimal statt zehnmal um, und der Yield hinter 40 % ROI müsste 20 % betragen, was fast niemand durchhält.",
      },
      explainerTitle: "Gewinn gemessen am Geld im Risiko",
      explainer: [
        "**Der ROI ist der Gewinn geteilt durch das Geld im Risiko**, und die ganze Schwierigkeit steckt in der zweiten Hälfte dieses Satzes. Eine Bankroll von 1.000, die eine Saison mit 400 Plus beendet, hat 40,00 % gebracht, und diese Zahl lässt sich ehrlich mit allem vergleichen, was du sonst mit denselben 1.000 gemacht hättest. Was sie nicht beschreiben kann, sind die Wetten. Eine Rendite von 40 % sagt nichts darüber, wie viele Wetten nötig waren, über welchen Zeitraum, oder wie nah der Kontostand unterwegs an der Null war — und genau das entscheidet, ob es wieder passiert. Also **nenne den Nenner, bevor du die Zahl nennst**: Start-Bankroll, mittlerer Kontostand und Summe der Einzahlungen ergeben drei verschiedene Prozentwerte aus einem identischen Satz Wetten, und der schmeichelhafteste ist immer der kleinste.",
        "**Dieselben 400 Gewinn sind gleichzeitig 40 % ROI und 4 % Yield**, und zu wissen, welche Zahl man in der Hand hält, ist fast der ganze Wert beider Seiten. Der ROI misst am Kapital, der Yield am Umsatz — der Summe aller platzierten Einsätze. Unser Beispiel kam mit 200 Wetten zu 50 dorthin, also liefen 10.000 durch die Bankroll: zehnmal das Kapital, und 4,00 % davon sind genau diese 400. **Dieser Multiplikator ist die ganze Brücke zwischen den beiden Zahlen**, und deshalb schmeichelt der ROI allein dem, der viel spielt. Wer 1.000 zehnmal mit 4 % Yield umdreht und wer sie zweimal mit 20 % Yield umdreht, melden beide 40 % — wiederholbar ist nur eines davon. Die Qualität pro Wette misst der Yield-Rechner; den ROI behalte für das, wofür er wirklich taugt: den Vergleich dieser Rendite mit den Alternativen.",
      ],
      faq: [
        {
          q: "Was ist der Unterschied zwischen ROI und Yield?",
          a: "Der ROI teilt den Gewinn durch das Kapital, der Yield durch den Umsatz — die Summe aller Einsätze. Dieselben 400 Gewinn sind 40,00 % einer Bankroll von 1.000 und 4,00 % von 10.000 Umsatz. Der ROI sagt, was das Geld gebracht hat, der Yield, wie gut die Wetten waren, und ihr Verhältnis ist die Zahl der Umdrehungen der Bankroll.",
        },
        {
          q: "Welches Kapital gehört in den Nenner?",
          a: "Das, das du benennen und dann festhalten kannst — üblich ist die Start-Bankroll. Höchststand, Durchschnittsstand und Summe der Einzahlungen ergeben aus denselben Wetten verschiedene Prozentwerte, die Zahl bedeutet also nur neben ihrer Definition etwas. Mitten im Zeitraum nachzuzahlen, ohne den Nenner neu zu nennen, ist der häufigste Weg zu einem aufgeblasenen ROI.",
        },
        {
          q: "Sind 40 % ROI gut?",
          a: "Das hängt vom Zeitraum und der Anzahl der Wetten ab. Über eine Saison und 200 Wetten ist es ein starkes, aber plausibles Ergebnis. Dieselben 40 % über zwanzig Wetten liegen bequem im Bereich, den der Zufall allein erzeugt, und 40 % in einer Woche heißt meist, dass die Einsätze im Verhältnis zur Bankroll groß waren, nicht der Vorteil.",
        },
        {
          q: "Kann der ROI negativ sein?",
          a: "Ja, und der Rechner zeigt es statt es zu verstecken: 250 Verlust auf einer Bankroll von 1.000 sind -25,00 %. Die Erholung ist nicht symmetrisch — nach -25 % braucht es +33,33 % auf den Rest, um wieder bei null zu sein — und deshalb verdient der Drawdown so viel Aufmerksamkeit wie die Rendite.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Yield-Rechner für Wetten — Gewinn pro Einsatz | BetRedge",
      metaDescription:
        "Kostenloser Yield-Rechner für Wetten: Anzahl der Wetten, mittleren Einsatz und Gewinn eingeben und Umsatz sowie Yield sehen — samt nötiger Anzahl Wetten.",
      h1: "Yield-Rechner",
      lede:
        "Gewinn gemessen an allem, was du eingesetzt hast, nicht an deiner Bankroll — die einzige Zahl, die zwei Wettende mit unterschiedlichem Geld vergleicht.",
      labels: {
        inputTitle: "Wetten, Einsatz und Ergebnis",
        bets: "Anzahl der Wetten",
        avgStake: "Mittlerer Einsatz",
        profit: "Gewinn",
        resultTitle: "Yield auf den Umsatz",
        turnover: "Umsatz",
        yieldPercent: "Yield",
        hint: "Den Umsatz rechnen wir aus: Wetten × mittlerer Einsatz. Zähle den Einsatz jeder Wette, nicht das Geld, das gleichzeitig im Risiko war. Der Gewinn wird netto eingetragen und darf negativ sein.",
        verdictNoise:
          "Unter tausend Wetten ist diese Zahl vor allem Rauschen. Bei flachen Einsätzen auf 2.00 beträgt eine Standardabweichung des Yields 7,07 Punkte über 200 Wetten und immer noch 3,16 über 1.000 — lies sie als Spanne, nicht als Ergebnis.",
        verdictVolume:
          "Jenseits von tausend Wetten trägt die Zahl Information, aber eine Standardabweichung liegt bei 2.00 noch bei etwa 3,16 Punkten — ein +4 % und ein +7 % über dasselbe Volumen sind nicht zwei verschiedene Können-Stufen.",
      },
      takeaway:
        "Der Yield ist die Zahl, die Wettende vergleicht: 4 % auf 10.000 Umsatz sind mehr wert als 40 % ROI, gesammelt über zwanzig Wetten.",
      example: {
        title: "200 Wetten zu 50, 400 Gewinn",
        rows: [
          { label: "Anzahl der Wetten", value: "200" },
          { label: "Mittlerer Einsatz", value: "50" },
          { label: "Umsatz", value: "10.000" },
          { label: "Gewinn", value: "+400" },
          { label: "Yield", value: "+4,00 %" },
          { label: "Dieselben 400 auf einer Bankroll von 1.000", value: "ROI +40,00 %" },
        ],
        note:
          "Ein Ergebnis, zwei gleichermaßen ehrliche Prozentzahlen: 4,00 % der 10.000, die durch den Buchmacher liefen, und 40,00 % der 1.000, die je im Risiko waren. Der Abstand dazwischen sind allein die zehn Umdrehungen der Bankroll. Und die Stichprobe zählt mehr als beide Zahlen — bei 200 Wetten beträgt eine Standardabweichung des Yields 7,07 Punkte, dieses +4,00 % liegt also im Bereich, den eine Münzwurfserie von selbst erzeugt.",
      },
      explainerTitle: "Die Zahl, die zwei Wettende vergleicht",
      explainer: [
        "**Der Yield ist der Gewinn geteilt durch den Umsatz** — die Summe aller platzierten Einsätze, nicht der Kontostand. Es ist die Zahl, die Wettende einander nennen, genau weil sie nicht davon abhängt, wie viel Geld sie haben: 4 % sind 4 %, ob die Einsätze 5 oder 500 betragen. **Der Wert, den alle falsch eintragen, ist der Nenner**, und der Fehler geht immer in dieselbe Richtung. Der Umsatz zählt den Einsatz jeder Wette in dem Moment, in dem sie platziert wird, also sind 200 Wetten zu 50 gleich 10.000, auch wenn nie mehr als 50 gleichzeitig im Risiko standen — und die Bankroll von 1.000, durch die diese Wetten liefen, ist nicht die Zahl, durch die man teilt. Deshalb fragt diese Seite nach Anzahl und mittlerem Einsatz und rechnet den Umsatz vor deinen Augen aus. Miss denselben Gewinn am Kapital, und du hast den ROI: der ROI-Rechner hält die andere Hälfte des Vergleichs, wo 400 Gewinn 40,00 % einer Bankroll von 1.000 und 4,00 % von 10.000 Umsatz sind.",
        "**Ein Yield über etwa 5 %, gehalten über ernstes Volumen, ist selten.** Wo er existiert, lebt er in weichen Märkten mit niedrigen Limits und schrumpft, sobald die Einsätze wachsen, weil die Quoten, die ihn erlaubten, es nicht überleben, hart getroffen zu werden. Jede Langfristzahl weit darüber behandelt man als kurze Stichprobe, weiche Nische oder andere Definition von Umsatz. Und **unter ein paar hundert Wetten ist die Zahl Rauschen, kein Ergebnis**: bei flachen Einsätzen auf 2.00 ist eine Standardabweichung des Yields eins geteilt durch die Wurzel der Wettenzahl — 7,07 Punkte über 200 Wetten, 3,16 über 1.000, 2,00 über 2.500. Ein +4 % Yield erreicht zwei Standardabweichungen über null erst bei rund 2.500 Wetten. Bei höheren Quoten schwankt es stärker: bei 3.00 tragen dieselben 200 Wetten eine Standardabweichung von 10 Punkten. Und das ist die ehrliche Lesart von zwanzig gewonnenen Wetten — kein gemessener Vorteil, nur eine zu kurze Stichprobe.",
      ],
      faq: [
        {
          q: "Wie ermittle ich meinen Umsatz?",
          a: "Indem du den Einsatz jeder platzierten Wette addierst, gewonnen oder verloren. 200 Wetten zu 50 sind 10.000 Umsatz, auch wenn die Bankroll dahinter nur 1.000 betrug. Nicht den Netto-Betrag und nicht den Kontostand nehmen: Umsatz ist das Geld, das durch den Buchmacher lief, einmal pro Wette gezählt.",
        },
        {
          q: "Sind 5 % Yield gut?",
          a: "Über tausende Wetten gehalten ja — das liegt nahe an der Obergrenze dessen, was echte Limits überlebt. Deutlich höhere Werte kommen meist aus weichen Märkten, einer kurzen Stichprobe oder Bonuswert und fallen, wenn die Einsätze steigen, weil die zugrunde liegenden Quoten weggenommen oder limitiert werden.",
        },
        {
          q: "Wie viele Wetten, bis mein Yield etwas bedeutet?",
          a: "Mehr als die meisten annehmen. Bei flachen Einsätzen auf 2.00 beträgt eine Standardabweichung des Yields 7,07 Punkte über 200 Wetten, 3,16 über 1.000 und 2,00 über 2.500 — ein +4 % erreicht zwei Standardabweichungen über null erst bei etwa 2.500 Wetten. Unter ein paar hundert Wetten ist es eine Spanne.",
        },
        {
          q: "Was, wenn meine Einsätze stark schwanken?",
          a: "Dann ist Wetten × mittlerer Einsatz nur eine Näherung, und sie schmeichelt dir, wenn die Treffer auf den großen Einsätzen lagen. Addiere die tatsächlichen Einsätze und teile den Gewinn durch diese Summe. Wenn du in Units spielst, zähle Units: der Yield pro eingesetzter Unit ist dieselbe Zahl und bleibt ehrlicher.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Einsatz-Rechner — der Einsatz für einen Zielgewinn | BetRedge",
      metaDescription:
        "Kostenloser Einsatz-Rechner: Quote und Zielgewinn eingeben und den nötigen Einsatz, den Gesamtrückfluss und den Anteil der Bankroll sehen, den diese Wette bindet.",
      h1: "Einsatz-Rechner",
      lede:
        "Der Einsatz, den ein Zielgewinn zu einer bestimmten Quote verlangt — und der Anteil der Bankroll, den er stillschweigend bindet.",
      labels: {
        inputTitle: "Quote und Ziel",
        odds: "Quote",
        targetProfit: "Zielgewinn",
        bankroll: "Bankroll",
        resultTitle: "Was dieses Ziel kostet",
        stakeNeeded: "Nötiger Einsatz",
        totalReturn: "Gesamtrückfluss",
        bankrollShare: "Anteil der Bankroll",
        hint: "Die Bankroll macht aus dem Einsatz erst einen Prozentwert: ohne sie ist der Einsatz eine Zahl ohne Bezug. Die Quote dezimal eingeben — 2.50, nicht +150.",
        verdictModest:
          "Dieser Einsatz bindet weniger als 5 % der angegebenen Bankroll, und eine Serie von zehn Niederlagen würde sie nicht beenden. Lies ihn neben der Quote, nicht allein: dasselbe Ziel zu einer kürzeren Quote verlangt eine viel größere Wette.",
        verdictHeavy:
          "Dieser Einsatz bindet mehr als 5 % der angegebenen Bankroll auf ein einziges Ergebnis. In dieser Größe nimmt eine Serie von zehn Niederlagen — bei Quoten um 2.00 völlig normal — mehr als die Hälfte davon, also prüfe die Zahl im Bankroll-Rechner, bevor du setzt.",
      },
      takeaway:
        "Vom gewünschten Gewinn auszugehen ist der schnellste Weg, zu viel zu setzen: Die nützliche Frage ist nicht, wie viel ich gewinnen will, sondern wie viel ich verlieren kann.",
      example: {
        title: "100 Gewinn wollen zu 2.50",
        rows: [
          { label: "Quote", value: "2.50" },
          { label: "Zielgewinn", value: "100" },
          { label: "Nötiger Einsatz", value: "66,67" },
          { label: "Gesamtrückfluss", value: "166,67" },
          { label: "Anteil einer Bankroll von 1.000", value: "6,67 %" },
        ],
        note:
          "Dieselben 100 kosten 25,00 zu 5.00 und 400,00 zu 1.25 — das Ziel hat sich nicht bewegt, nur die Quote. Und 66,67 auf einer Bankroll von 1.000 ist genau der volle Kelly für jemanden, der das Ergebnis mit 44 % ansetzt, während 2.50 bei 40 % break-even liegt. Der Wunsch enthält also längst eine Wahrscheinlichkeitsschätzung mit einem Vorteil von +10 %, nur eine unausgesprochene.",
      },
      explainerTitle: "Rückwärts rechnen von einer Zahl, die du gewählt hast",
      explainer: [
        "Die Arithmetik ist die leichte Hälfte. Eine Wette zahlt den Einsatz plus Einsatz × (Quote − 1) zurück, also ist **der Einsatz, den ein Ziel verlangt, das Ziel geteilt durch die Quote minus eins** — 100 zu 2.50 braucht 66,67, und der Schein kommt mit 166,67 zurück. Lesenswert macht diese Seite der zweite Effekt: **je kürzer die Quote, desto größer die Wette, die derselbe Wunsch verlangt**. Diese 100 kosten 25,00 zu 5.00, 66,67 zu 2.50, 100,00 zu 2.00 und 400,00 zu 1.25. Zwischen diesen vier Zeilen hat sich an deiner Meinung nichts geändert, und das Risikogeld hat sich um den Faktor sechzehn bewegt. Deshalb fragt der Rechner nach einer Bankroll, die er streng genommen nicht braucht: 66,67 ist weder groß noch klein, solange du nicht weißt, dass es 6,67 % von allem ist, was du zurückgelegt hast.",
        "**Vom gewünschten Gewinn her zu denken ist der kürzeste Weg zu einem zu großen Einsatz**, und es scheitert auf eine bestimmte Weise. Verliere die erste Wette, und das Ziel wächst still mit, um sie zu deckeln: nach 66,67 Verlust wieder 100 zu wollen heißt, 166,67 zu verlangen, was zu 2.00 einen Einsatz von 166,67 braucht — und fällt auch der, lautet die nächste Forderung 476,19 zu 1.70. Drei Wetten später sind 709,52 einer Bankroll von 1.000 im Feuer, um die ursprünglichen 100 zu gewinnen, und die Quoten wurden jedes Mal kürzer, weil kurze Quoten sicherer wirken. **Die Wette wird genau dann größer, wenn der Grund für sie schwächer wird.** Die ehrliche Fassung dieser Rechnung läuft umgekehrt, von dem, was du verlieren kannst, zu dem, was du setzen kannst, und das ist der Rechner zum Kelly-Kriterium: dort kommt die Größe aus einem gemessenen Vorteil, nicht aus einer selbst gewählten Zahl. Unsere Zahl ist auch kein Zufall — 66,67 auf 1.000 ist genau das, was der volle Kelly zu 2.50 jemandem empfiehlt, der an 44 % glaubt, gegen die 40 %, die die Quote impliziert. Wenn du diese 44 % nicht verteidigen würdest, ging es beim Einsatz nie um die Wette.",
      ],
      faq: [
        {
          q: "Wie berechnet man den Einsatz für einen Zielgewinn?",
          a: "Teile den gewünschten Gewinn durch die Quote minus eins. Zu 2.50 beträgt der Nettorückfluss pro Einsatzeinheit 1,50, also brauchen 100 Gewinn 100 / 1,50 = 66,67 Einsatz und zahlen 166,67 gesamt. Zu 2.00 ist der Nettorückfluss 1,00 — deshalb sind Einsatz und Ziel dort dieselbe Zahl.",
        },
        {
          q: "Warum fragt der Rechner nach meiner Bankroll?",
          a: "Weil der Einsatz allein nichts sagt. 66,67 ist für einen Rundungsfehler und für den anderen ein Drittel des Kontos, und was das entscheidet, ist der Anteil der Bankroll — hier 6,67 %. Lässt du das Feld leer, funktioniert der Einsatz weiter; der Anteil wird zum Gedankenstrich, und das ist ehrlich, denn diese Annahme gehört dir und nicht uns.",
        },
        {
          q: "Dieser Rechner oder das Kelly-Kriterium?",
          a: "Dieser, um einen Wunsch zu bepreisen, Kelly, um eine Wette zu dimensionieren. Diese Seite startet bei einer Zahl, die du gewählt hast, und rechnet die Kosten aus; der Rechner zum Kelly-Kriterium startet bei einem gemessenen Vorteil und rechnet aus, was die Bankroll tragen kann. Widersprechen sich beide, fällt der weg, der deine Wahrscheinlichkeitsschätzung nie gefragt hat.",
        },
        {
          q: "Ist es je richtig, einem Verlust mit höherem Einsatz nachzujagen?",
          a: "Nach dieser Arithmetik nicht. Jede Aufholforderung ist größer als die vorige und wird meist zu einer kürzeren Quote gesetzt, weil kurze Quoten sicherer wirken: der Einsatz wächst, während der Vorteil schrumpft. Bankroll-Regeln gibt es genau dafür, den nächsten Einsatz vom letzten Ergebnis zu entkoppeln — fixiere die Einheit als Anteil der Bankroll, und die Serie kann nicht davonlaufen.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Bankroll-Rechner — Einheit, Drawdown und Niederlagen bis zum Ruin | BetRedge",
      metaDescription:
        "Kostenloser Bankroll-Rechner: Bankroll und Einheit setzen und den Einsatz pro Wette, die Kosten einer Verlustserie, den Drawdown und die gedeckten Niederlagen sehen.",
      h1: "Bankroll-Rechner",
      lede:
        "Was eine prozentuale Einheit wirklich bindet: der Einsatz pro Wette, die Kosten einer Verlustserie und wie viele Niederlagen in Folge die Bankroll übersteht.",
      labels: {
        inputTitle: "Bankroll und Regel",
        bankroll: "Bankroll",
        unitPercent: "Einheit (%)",
        losingStreak: "Verlustserie",
        resultTitle: "Was die Regel kostet",
        unit: "Einsatz pro Wette",
        streakLoss: "Kosten der Serie",
        drawdown: "Drawdown",
        betsToRuin: "Niederlagen bis zum Ruin",
        hint: "Prozentwerte als Zahl eingeben: 2 bedeutet 2 % der Bankroll pro Wette. Die Verlustserie zählt Wetten, also nur ganze Zahlen — es ist die Serie, die du überstehen willst, keine Prognose.",
        verdictSafe:
          "Bei 5 % pro Einheit oder darunter lässt die angegebene Serie die Bankroll arbeitsfähig. Eine Serie von zehn erreicht 38,54 % der Wettenden innerhalb von 1.000 Wetten zu geraden Quoten — ein Plan, der nur hält, wenn du sie nie triffst, ist kein Plan.",
        verdictAggressive:
          "Über 5 % pro Einheit beendet die gewöhnliche Verlustserie das Konto: zehn Niederlagen nehmen die halbe Bankroll oder mehr, und aus der Hälfte bräuchte es +100,00 % zurück. Da eine Serie von zehn innerhalb von 1.000 Wetten 38,54 % der Wettenden trifft, ist das eine Wette darauf, sie nicht zu treffen.",
      },
      takeaway:
        "Der Prozentsatz pro Einheit ist keine Vorliebe. Er ist deine Entscheidung darüber, wie lang die schlimmste Verlustserie sein darf, bevor du aus dem Spiel bist.",
      example: {
        title: "Eine Bankroll von 2.000 bei 2 % pro Wette",
        rows: [
          { label: "Bankroll", value: "2.000" },
          { label: "Einheit", value: "2 %" },
          { label: "Einsatz pro Wette", value: "40,00" },
          { label: "Zehn Niederlagen in Folge", value: "400,00" },
          { label: "Drawdown", value: "20,00 %" },
          { label: "Niederlagen bis zum Ruin", value: "50" },
        ],
        note:
          "Dieses Loch von 20,00 % verlangt +25,00 % auf den Rest, um zurück auf 2.000 zu kommen. Stell die Einheit auf 5 % und dieselben zehn Niederlagen kosten 1.000 — ein Drawdown von 50,00 %, der +100,00 % zur Erholung braucht, während die Bankroll nur noch 20 Niederlagen in Folge deckt statt 50. Drei Punkte Regel, und die überstehbare Serie ist weniger als halb so lang.",
      },
      explainerTitle: "Die Regel entscheidet, wie lange Pechsträhne du überstehst",
      explainer: [
        "**Eine Einheit ist ein Prozentsatz der Bankroll, kein Betrag**, und der Unterschied zeigt sich erst, wenn es schlecht läuft. Setze für immer fixe 40, und eine auf 1.000 gefallene Bankroll setzt 4 % statt 2 %: die Regel zieht sich genau dann zu, wenn sie sich lockern sollte. Rechne die Einheit am aktuellen Stand neu, und jede Niederlage macht den nächsten Einsatz kleiner — genau das verhindert, dass eine Verlustserie die Arbeit vollendet. Die Asymmetrie darunter ist der ganze Grund, sich zu kümmern: **20 % Verlust brauchen +25,00 % zurück, 50 % brauchen +100,00 %, 80 % brauchen +400,00 %.** In der zweiten Hälfte dieser Paare ist nichts symmetrisch zur ersten, und kein Vorteil ist groß genug, um aus +400,00 % einen Plan statt einer Hoffnung zu machen. Eine Bankroll von 2.000 bei 2 % setzt 40 pro Wette, verkraftet zehn Niederlagen in Folge für 400,00 und kommt mit −20,00 % heraus — zehn der 50 aufeinanderfolgenden Niederlagen verbraucht, die dieser Einsatz aushält.",
        "**Eine Serie von zehn Niederlagen bei Quoten um 2.00 ist gewöhnlich, nicht Pech**, und diese Zahl zeigt es. Bei geraden Quoten hat eine einzelne Folge von zehn eine Wahrscheinlichkeit von 0,098 % — eine von 1.024 — was sich wie niemals liest, bis man zählt, wie viele Folgen eine Saison enthält. Über 1.000 Wetten ist die Chance, mindestens eine Serie von zehn oder länger zu treffen, **38,54 %**; bei 2.10, wo ein Wettender ohne Vorteil 47,62 % der Zeit gewinnt, sind es **52,31 %** — besser als ein Münzwurf. Über 500 Wetten lauten dieselben Zahlen 21,45 % und 30,73 %, und die längste zu erwartende Serie in 1.000 Wetten zu geraden Quoten liegt bei etwa zehn, weil sie mit dem Zweierlogarithmus der Wettenzahl wächst. Die Serie ist nicht der Rand der Verteilung, sondern ihre Mitte, also ist **eine Einheit über 5 % eine Wette darauf, den Normalfall nicht zu treffen**: bei 5 % nehmen diese zehn Niederlagen die halbe Bankroll, bei 10 % die ganze. Ist der Vorteil gemessen statt vermutet, bemisst der Rechner zum Kelly-Kriterium die Einheit am Vorteil selbst — lies dessen Zahl als Obergrenze und diese Seite als Boden darunter.",
      ],
      faq: [
        {
          q: "Welche Einheitsgröße soll ich nehmen?",
          a: "Ein bis zwei Prozent der Bankroll pro Wette ist der übliche Bereich für flaches Setzen, und über fünf Prozent wird die gewöhnliche Verlustserie zum kontobeendenden Ereignis. Ehrlich wählt man rückwärts: entscheide die Serie, die du überstehen willst, lies den Drawdown, den dieser Rechner ausgibt, und frage dich, ob du danach noch genauso weiterwetten würdest.",
        },
        {
          q: "Warum ist Niederlagen bis zum Ruin eine ganze Zahl?",
          a: "Weil sie Wetten zählt, und ein Bruchteil einer Wette keine ist. Eine Bankroll von 1.000 bei 3 % ergibt eine Einheit von 30, also 33 Niederlagen und ein Drittel — die Antwort lautet daher 33, abgerundet, weil die Bankroll die nächste nicht mehr voll deckt. Aufrunden würde eine Wette versprechen, für die das Geld nicht existiert.",
        },
        {
          q: "Sind zehn Niederlagen in Folge wirklich normal?",
          a: "Ja, und die Rechnung ist nicht einmal knapp. Eine einzelne Folge von zehn Niederlagen bei geraden Quoten ist ein 0,098-%-Ereignis, doch über 1.000 Wetten gibt es so viele Folgen, dass die Chance auf mindestens eine 38,54 % beträgt — bei 2.10, wo ein Wettender ohne Vorteil 47,62 % gewinnt, 52,31 %. Plane damit, statt überrascht zu werden.",
        },
        {
          q: "Dieser Rechner oder das Kelly-Kriterium?",
          a: "Dieser, wenn du keinen gemessenen Vorteil hast, also meistens: eine prozentuale Einheit braucht keine Wahrscheinlichkeitsschätzung, und ihr schlimmster Fall ist vorher bekannt. Der Rechner zum Kelly-Kriterium ist richtig, sobald du eine Wahrscheinlichkeit verteidigen kannst, und er empfiehlt meist mehr als flache 2 %. Seine Antwort als Decke und die flache Regel als Boden zu behandeln, hält beide ehrlich.",
        },
      ],
    },
  },
};

export default de;
