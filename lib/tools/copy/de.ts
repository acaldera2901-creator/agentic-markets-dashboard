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
      formulaTitle: "So funktioniert die Umrechnung",
      formula: [
        "dezimal = 1 + (amerikanisch / 100)        wenn amerikanisch positiv ist",
        "dezimal = 1 + (100 / |amerikanisch|)      wenn amerikanisch negativ ist",
        "dezimal = 1 + (Zähler / Nenner)           für Bruchquoten",
        "implizite Wahrscheinlichkeit = 1 / dezimal",
      ],
      explainerTitle: "Einen Preis in jedem Format lesen",
      explainer: [
        "Eine Quote ist eine Wahrscheinlichkeit in anderer Kleidung. Die Dezimalquote — europäischer Standard — nennt die Gesamtrückzahlung pro Einheit Einsatz: 2.50 zahlt 2.50 für jede riskierte 1, Einsatz inklusive. Die Bruchquote, im britischen Rennsport weiter üblich, nennt den Gewinn statt der Rückzahlung: 3/2 bedeutet drei Einheiten Gewinn auf zwei riskierte, also dieselbe 2.50 dezimal. Die amerikanische Quote sagt, wie viel du auf 100 gewinnst (+150) oder wie viel du riskieren musst, um 100 zu gewinnen (−110). Hongkong, Malay und Indonesian sind die Formate der asiatischen Märkte, und sie zählen, weil dort häufig die schärfsten Preise stehen.",
        "Die Zahl, die zu lesen lohnt, ist die letzte: die implizite Wahrscheinlichkeit, also 1 geteilt durch die Dezimalquote. Ein Preis von 2.50 impliziert 40 %. Ein Preis von 1.91 — die bekannte −110 — impliziert 52,38 %. Das ist die vom Buchmacher genannte Chance, und es ist die einzige Zahl, die du direkt mit deiner eigenen Schätzung vergleichen kannst. Zwei Quoten in verschiedenen Formaten sind nicht leichter zu vergleichen als zwei Wahrscheinlichkeiten: erst umrechnen, dann diskutieren.",
        "Eine Grenze, die dieser Rechner nicht beseitigen kann: die implizite Wahrscheinlichkeit enthält weiterhin die Marge des Buchmachers. Addiere die impliziten Wahrscheinlichkeiten aller Ergebnisse eines Marktes und du liegst über 100 % — dieser Überschuss ist die Marge, und er bläht jede einzelne dieser Wahrscheinlichkeiten auf. Wer die ehrliche Markteinschätzung statt der bepreisten will, schickt den Markt durch den Margen-Rechner und nutzt die dort ausgegebenen fairen Wahrscheinlichkeiten.",
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
      formulaTitle: "So wird die Marge berechnet",
      formula: [
        "Overround = Σ (1 / Quoteᵢ)",
        "Marge = Overround − 1",
        "Auszahlungsquote = 1 / Overround",
        "faire Wahrscheinlichkeitᵢ = (1 / Quoteᵢ) / Overround",
        "faire Quoteᵢ = 1 / faire Wahrscheinlichkeitᵢ",
      ],
      explainerTitle: "Die Marge ist der Preis der Wette",
      explainer: [
        "Ein fairer Zwei-Wege-Markt bepreist beide Seiten mit 2.00: die impliziten Wahrscheinlichkeiten liegen bei 50 % und 50 %, summieren sich auf genau 100 %, und keine Seite hat einen Vorteil. Reale Märkte stehen bei 1.91 und 1.91. Diese impliziten Wahrscheinlichkeiten betragen je 52,38 %, summieren sich auf 104,76 %, und die überschüssigen 4,76 Prozentpunkte sind die Marge des Buchmachers — der Overround. Welche Seite du auch spielst, du zahlst sie.",
        "Die Marge ist die nützlichste Zahl für die Frage, wo man wettet. Dasselbe Spiel mit 5 % Marge und mit 2 % Marge ist nicht dieselbe Wette: der engere Buchmacher überlässt dir bei identischer Meinung rund drei Prozentpunkte Erwartungswert. Margen schwanken stark je Markt: Hauptlinien scharfer Buchmacher liegen teils unter 2 %, während Siegwetten, Spielermärkte und Spezialwetten regelmäßig 8 % und mehr tragen — dort wissen die Buchmacher ihre Preise am wenigsten geprüft.",
        "Das Entfernen der Marge ergibt die faire Linie, die sogenannte No-Vig-Linie. Dieser Rechner macht das proportional: jede implizite Wahrscheinlichkeit wird durch ihre Summe geteilt, dadurch summieren sie sich wieder auf genau 100 %, und die fairen Quoten sind deren Kehrwerte. Diese Linie kommt der ehrlichen Markteinschätzung am nächsten und ist der Bezugspunkt für den EV-Rechner: eine Wette hat nur dann positiven Erwartungswert, wenn deine Wahrscheinlichkeit die faire übersteigt — nicht bloß die bepreiste.",
        "Eine offen genannte Grenze: die proportionale Entfernung verteilt die Marge gleichmäßig über alle Ergebnisse, reale Buchmacher tun das nicht. Sie legen mehr Marge auf unwahrscheinliche Ergebnisse, weil sich dort das Freizeitgeld sammelt. In einem Markt mit klarem Favoriten und fernem Außenseiter unterschätzt diese Methode die echte Chance des Favoriten leicht. Bei Hauptlinien ist die Verzerrung klein; bei Lotterie-Siegwetten ist die faire Linie eine Schätzung, keine Messung.",
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
      formulaTitle: "So wird der Erwartungswert berechnet",
      formula: [
        "EV = p × (Quote − 1) × Einsatz − (1 − p) × Einsatz",
        "   = (p × Quote − 1) × Einsatz",
        "Vorteil = p × Quote − 1",
        "Break-even-Preis = 1 / p",
      ],
      explainerTitle: "Was der Erwartungswert wirklich sagt",
      explainer: [
        "Der Erwartungswert ist das durchschnittliche Ergebnis einer Wette, wenn man sie unbegrenzt oft spielen könnte. Er hat zwei Eingaben und keine Meinung: den angebotenen Preis und die Wahrscheinlichkeit, die du dem Ergebnis gibst. Wenn du glaubst, ein Team gewinnt in 55 % der Fälle, und jemand bietet 2.00, ist die Rechnung sofort da: in 55 % der Fälle gewinnst du eine Einheit, in 45 % verlierst du sie, im Durchschnitt also 0,10 Einheiten pro Einheit Einsatz. Das sind 10 % Vorteil, und genau das bedeutet +EV.",
        "Die Zahl, die alles entscheidet, ist die Wahrscheinlichkeit — und dort verlieren die meisten still. Ein Fehler von 5 Punkten in der Schätzung genügt, um aus 4 % Vorteil 1 % Verlust zu machen, und nach Gefühl gebildete Schätzungen liegen regelmäßig deutlich mehr als 5 Punkte daneben. Deshalb hat dieser Rechner einen zweiten Modus: statt dem Bauchgefühl zu trauen, nimm den Preis beider Seiten bei einem scharfen Buchmacher, entferne die Marge und nutze die resultierende faire Wahrscheinlichkeit. Die Frage ist dann nicht mehr, ob du klüger bist als der Markt, sondern ob dein Buchmacher langsamer ist als der schärfste.",
        "Lies den EV als Rate, nicht als Versprechen. Eine Wette mit 4 % Erwartungswert liefert im Einzelfall gar nichts: sie gewinnt oder verliert. Die 4 % zeigen sich erst über hunderte unabhängige Wetten, und nur wenn die Wahrscheinlichkeit stimmte. Kurzfristig ist die Varianz weit größer als der Vorteil, und genau darum zählt die Einsatzhöhe so viel wie der Vorteil selbst — dafür ist die Kelly-Formel da.",
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
      formulaTitle: "So wird der Kelly-Einsatz berechnet",
      formula: [
        "b = Quote − 1",
        "f* = (p × b − (1 − p)) / b = (p × Quote − 1) / b",
        "Einsatz = Bankroll × f* × Anteil",
        "erwartetes Wachstum = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Den Einsatz so wählen, dass die Verlustserie ihn nicht beendet",
      explainer: [
        "Die Kelly-Formel beantwortet eine Frage, die der Erwartungswert offenlässt: Wie viel soll man bei gegebenem Vorteil tatsächlich riskieren? Setzt man zu wenig, verzinst sich ein echter Vorteil zu langsam, um zu zählen. Setzt man zu viel, dreht sich die Mathematik gegen einen: eine halbierte Bankroll braucht +100 %, um zurückzukommen, große Einsätze zerstören also das Wachstum, selbst wenn jede einzelne Wette günstig ist. Kelly findet den Anteil, der die langfristige Wachstumsrate maximiert — es ist der Vorteil geteilt durch die Nettoquote.",
        "Das Ergebnis skaliert mit dem Vorteil, nicht mit der Überzeugung. 10 % Vorteil bei Quote 2.00 verlangen 10 % der Bankroll; derselbe Vorteil bei 5.00 nur 2,5 %, denn der längere Preis bedeutet längere Verlustserien und einen holprigeren Weg. Darum ist die Formel selbst dann nützlich, wenn man ihr nie genau folgt: sie sagt, dass Preis und Vorteil gemeinsam den Einsatz bestimmen — und dass ein starkes Gefühl keine Eingabe ist.",
        "Voll Kelly sollte fast niemand spielen. Die Formel setzt voraus, dass deine Wahrscheinlichkeit genau stimmt, und das tut sie nie. Gib ihr einen überschätzten Vorteil, und sie empfiehlt bereitwillig einen Einsatz, der für den tatsächlichen Vorteil zu groß ist — der schnellste Weg, eine Bankroll zu verlieren, obwohl man im Mittel richtig liegt. Halb Kelly verzichtet auf ein Viertel des theoretischen Wachstums und halbiert die Schwankung ungefähr; viertel Kelly nutzen viele Profis mit echten Modellen. Kommen deine Wahrscheinlichkeiten aus dem Urteil statt aus Daten, ist viertel Kelly keine Vorsicht, sondern Realismus.",
        "Bietet der Preis keinen Vorteil, ist der richtige Einsatz null — und dieser Rechner sagt das, statt eine negative Zahl als Ratschlag zu verkleiden. Ein negativer Kelly-Anteil heißt, die Wette wäre auf der anderen Seite zu spielen, falls du sie zu diesem Preis findest: er heißt nie, auf dieser Seite weniger zu setzen.",
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
      formulaTitle: "So werden die Wahrscheinlichkeiten berechnet",
      formula: [
        "Quote = 1 / Wahrscheinlichkeit",
        "Wahrscheinlichkeit = 1 / Quote",
        "Break-even-Wahrscheinlichkeit = 1 / Quote",
        "Wahrscheinlichkeit der Kombi = p₁ × p₂ × … × pₙ",
        "Quote der Kombi = Quote₁ × Quote₂ × … × Quoteₙ",
      ],
      explainerTitle: "Zuerst die Wahrscheinlichkeit, dann der Preis",
      explainer: [
        "Jeder Preis ist eine Behauptung über eine Wahrscheinlichkeit, und die Umrechnung ist eine Division: 40 % Wahrscheinlichkeit sind ein Preis von 2.50, und ein Preis von 2.50 sind 40 %. Diese Umrechnung vor der Wette zu machen verändert die Frage von „gefällt mir diese Wette?“ zu „glaube ich, dass dieses Ergebnis in mehr als 40 % der Fälle eintritt?“ — eine Frage, bei der man sich irren kann, und deshalb eine Frage, die sich lohnt.",
        "Dieselbe Zahl, von der Preisseite gelesen, ist die Break-even-Wahrscheinlichkeit: die Mindestchance, die ein Ergebnis braucht, damit die Wette neutral ist. Ein Preis von 1.75 verlangt 57,1 %. Ein Preis von 1.50 verlangt 66,7 %. Lange Preise verlangen sehr wenig — 15.00 nur 6,7 % — deshalb wirken sie günstig, und deshalb legen Buchmacher dort ihre Marge auf. Die Break-even-Wahrscheinlichkeit ist der ehrliche Test einer Wette: kannst du nicht begründen, dass das Ergebnis sie übertrifft, ist der Preis nicht großzügig, sondern korrekt.",
        "Bei Kombiwetten wird Wahrscheinlichkeit unintuitiv. Unabhängige Positionen multiplizieren sich: drei Wetten, die du je bei 50 % siehst, ergeben zusammen 12,5 % — nicht etwas beruhigend Halbes. Vier Positionen bei 60 % ergeben 12,96 %. Die kombinierte Quote multipliziert sich genauso, und darin liegt die Falle: eine Kombi zu 15.00 sieht nach einem Schnäppchen aus, bis man merkt, dass sie ein Ereignis mit 6,7 % verlangt und dass die Marge des Buchmachers auf jede Position gelegt und dann verzinst wurde. Vier Positionen mit je 5 % Marge tragen knapp 21 % Gesamtmarge.",
        "Eine Annahme, die man im Kopf behalten muss: dieser Rechner multipliziert, also setzt er Unabhängigkeit voraus. Zwei Ergebnisse desselben Spiels — Sieg eines Teams und Treffer seines Stürmers — sind korreliert, und das Multiplizieren unterschätzt die echte Chance, dass beide eintreten. Kombis innerhalb eines Spiels bepreisen Buchmacher gerade deshalb separat, weil diese Korrelation schwer zu berechnen ist: nimm die Zahl hier als Untergrenze, nicht als Antwort.",
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
  },
};

export default de;
