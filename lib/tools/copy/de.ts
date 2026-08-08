// lib/tools/copy/de.ts (#TOOLS-HUB-0805)
// Deutsch. Lokale Keywords: „Quotenrechner“, „Value-Rechner“, „Kelly-Formel“,
// „Buchmacher-Marge“.

import type { ToolsCopy } from "./types";

const de: ToolsCopy = {
  hub: {
    metaTitle: "Kostenlose Wett-Tools — Quoten, EV, Kelly und Marge | BetRedge",
    metaDescription:
      "Fünf kostenlose Rechner: Quoten in jedes Format umrechnen, Buchmacher-Marge entfernen, Erwartungswert berechnen und den Einsatz mit Kelly bestimmen. Ohne Anmeldung.",
    h1: "Kostenlose Wett-Tools",
    lede:
      "Die fünf Rechnungen, die vor jeder Wette anstehen: Quoten umgerechnet, Marge entfernt, Einsatz bestimmt. Kostenlos, ohne Konto.",
    cardCta: "Tool öffnen",
    intro: [
      "Jede Wette ist ein Vergleich zwischen einem Preis und einer Wahrscheinlichkeit. Diese fünf Rechner führen diesen Vergleich sauber durch: sie übersetzen Quoten zwischen den Formaten, entfernen die Marge des Buchmachers und legen die faire Linie frei, verwandeln eine Wahrscheinlichkeitsschätzung in einen Erwartungswert und bestimmen den Einsatz so, dass eine Verlustserie die Bankroll nicht beendet.",
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
  },
};

export default de;
