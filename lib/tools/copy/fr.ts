// lib/tools/copy/fr.ts (#TOOLS-HUB-0805)
// Français. Mots-clés locaux : « convertisseur de cotes », « calculateur de
// valeur espérée », « critère de Kelly », « marge du bookmaker ».

import type { ToolsCopy } from "./types";

const fr: ToolsCopy = {
  hub: {
    metaTitle: "Outils de paris gratuits — cotes, EV, Kelly et marge | BetRedge",
    metaDescription:
      "Cinq calculateurs gratuits : convertir les cotes dans tous les formats, retirer la marge du bookmaker, calculer la valeur espérée et dimensionner la mise avec Kelly. Sans inscription.",
    h1: "Outils de paris gratuits",
    lede:
      "Les cinq calculs à faire avant de miser : cotes converties, marge retirée, mise dimensionnée. Gratuit, sans compte.",
    cardCta: "Ouvrir l'outil",
    intro: [
      "Tout pari est une comparaison entre un prix et une probabilité. Ces cinq calculateurs font cette comparaison correctement : ils traduisent les cotes d'un format à l'autre, retirent la marge du bookmaker pour révéler la ligne juste, transforment une estimation de probabilité en valeur espérée et dimensionnent la mise pour qu'une mauvaise série ne vide pas la bankroll.",
      "Ils fonctionnent entièrement dans votre navigateur : rien n'est envoyé, rien n'est enregistré, aucun compte à créer. Utilisez-les seuls, ou utilisez-les pour vérifier ce que notre modèle publie déjà sur chaque match.",
    ],
  },

  common: {
    backLabel: "Accueil",
    ctaTitle: "Ces calculs, nous les faisons sur chaque match",
    ctaBody:
      "Les calculateurs traitent un prix à la fois. BetRedge scanne le marché en continu, retire la marge, compare à la probabilité du modèle et montre où les deux ne s'accordent pas — football et tennis, actualisés toute la journée.",
    ctaButton: "Voir le tableau du jour",
    otherTools: "Autres outils gratuits",
    langLabel: "Langue",
    free: "Gratuit",
    faqTitle: "Questions",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Convertisseur de cotes — décimales, fractionnaires, américaines, probabilité | BetRedge",
      metaDescription:
        "Convertisseur de cotes gratuit : saisissez un prix dans n'importe quel format — décimal, fractionnaire, américain, Hong Kong, Malay, Indonesian — et lisez-le dans tous les autres.",
      h1: "Convertisseur de cotes",
      lede:
        "Saisissez un prix dans un format et lisez-le dans tous les autres, avec la probabilité que le bookmaker annonce.",
      labels: {
        inputTitle: "Votre prix",
        oddsInput: "Cote",
        formatSelect: "Format",
        resultTitle: "Le même prix, dans chaque format",
        decimal: "Décimale",
        american: "Américaine",
        fractional: "Fractionnaire",
        hongkong: "Hong Kong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Probabilité implicite",
        hint: "Le décimal accepte aussi la virgule : 2,50 équivaut à 2.50.",
      },
      formulaTitle: "Comment fonctionne la conversion",
      formula: [
        "décimale = 1 + (américaine / 100)             si l'américaine est positive",
        "décimale = 1 + (100 / |américaine|)           si l'américaine est négative",
        "décimale = 1 + (numérateur / dénominateur)    pour les fractionnaires",
        "probabilité implicite = 1 / décimale",
      ],
      explainerTitle: "Lire un prix dans n'importe quel format",
      explainer: [
        "Une cote est une probabilité habillée autrement. La décimale — le standard européen — indique le retour total par unité misée : 2.50 rend 2.50 pour chaque 1 risqué, mise comprise. La fractionnaire, encore courante dans les courses britanniques, indique le bénéfice et non le retour : 3/2 signifie trois unités de bénéfice pour deux risquées, soit la même 2.50 décimale. L'américaine dit combien vous gagnez en misant 100 (+150) ou combien vous devez risquer pour gagner 100 (−110). Hong Kong, Malay et Indonesian sont les formats des marchés asiatiques, et ils comptent car c'est souvent là que se trouvent les prix les plus affûtés.",
        "Le nombre qui mérite d'être lu est le dernier : la probabilité implicite, c'est-à-dire 1 divisé par la cote décimale. Un prix de 2.50 implique 40 %. Un prix de 1.91 — la fameuse −110 — implique 52,38 %. C'est la probabilité annoncée par le bookmaker, et c'est le seul nombre que vous pouvez comparer directement à votre propre estimation. Deux cotes dans des formats différents ne sont pas plus faciles à comparer que deux probabilités : convertissez d'abord, discutez ensuite.",
        "Une limite que ce convertisseur ne peut pas retirer pour vous : la probabilité implicite contient encore la marge du bookmaker. Additionnez les probabilités implicites de tous les résultats d'un marché et vous dépasserez 100 % — cet excédent est la marge, et il gonfle chacune de ces probabilités. Si vous voulez l'avis honnête du marché plutôt que son avis tarifé, passez le marché par le calculateur de marge et utilisez les probabilités justes qu'il renvoie.",
      ],
      faq: [
        {
          q: "Dans quel format vaut-il mieux travailler ?",
          a: "En décimal, sauf raison contraire. Multiplier des cotes décimales donne directement le prix d'un combiné, et diviser 1 par la cote donne la probabilité implicite : deux opérations peu pratiques en notation fractionnaire ou américaine.",
        },
        {
          q: "Pourquoi −110 devient 1,909090… ?",
          a: "Parce que 100/110 est un décimal périodique. Arrondi à deux chiffres cela donne 1.91, ce que les bookmakers affichent, mais le convertisseur garde la précision complète en interne pour qu'une chaîne de calculs ne dérive pas.",
        },
        {
          q: "Quelle différence entre cotes Malay et Indonesian ?",
          a: "Elles sont l'image miroir l'une de l'autre. Les Malay sont positives sous 2.00 et négatives au-dessus ; les Indonesian sont positives au-dessus de 2.00 et négatives en dessous. Elles expriment le même prix et se convertissent vers la même décimale.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Calculateur de marge — overround, taux de retour et cotes justes | BetRedge",
      metaDescription:
        "Calculateur de marge gratuit : saisissez les cotes de tous les résultats et obtenez la marge du bookmaker, le taux de retour et les cotes justes sans marge.",
      h1: "Calculateur de marge",
      lede:
        "Saisissez tous les prix d'un marché et voyez ce que prend le bookmaker — ainsi que la ligne juste qui se cache dessous.",
      labels: {
        inputTitle: "Le marché",
        outcome: "Résultat",
        addOutcome: "Ajouter un résultat",
        removeOutcome: "Retirer",
        resultTitle: "Ce que facture le bookmaker",
        margin: "Marge du bookmaker",
        payout: "Taux de retour",
        fairOddsTitle: "Ligne juste, marge retirée",
        fairOdds: "Cote juste",
        fairProbability: "Probabilité juste",
        impliedProbability: "Probabilité implicite",
        hint: "Ajoutez un résultat pour les marchés à trois issues, ou plus pour les vainqueurs.",
      },
      formulaTitle: "Comment la marge est calculée",
      formula: [
        "overround = Σ (1 / coteᵢ)",
        "marge = overround − 1",
        "taux de retour = 1 / overround",
        "probabilité justeᵢ = (1 / coteᵢ) / overround",
        "cote justeᵢ = 1 / probabilité justeᵢ",
      ],
      explainerTitle: "La marge est le prix du pari",
      explainer: [
        "Un marché à deux issues équitable cote les deux côtés à 2.00 : les probabilités implicites sont de 50 % et 50 %, elles totalisent exactement 100 %, et aucun côté n'a d'avantage. Les marchés réels sont cotés 1.91 et 1.91. Ces probabilités implicites valent 52,38 % chacune, totalisent 104,76 %, et les 4,76 points de pourcentage en excès sont la marge du bookmaker — l'overround. Quel que soit le côté joué, vous la payez.",
        "La marge est le nombre le plus utile pour décider où parier. Le même match à 5 % de marge et à 2 % de marge n'est pas le même pari : le bookmaker le plus serré vous laisse environ trois points de valeur espérée à opinions identiques. Les marges varient énormément selon le marché : les lignes principales des bookmakers sharp peuvent descendre sous 2 %, tandis que les paris vainqueur, les marchés joueurs et les paris spéciaux atteignent couramment 8 % ou plus, car c'est là que les bookmakers savent leurs prix les moins contrôlés.",
        "Retirer la marge donne la ligne juste, dite no-vig. Ce calculateur le fait proportionnellement : chaque probabilité implicite est divisée par leur somme, elles totalisent donc à nouveau exactement 100 %, et les cotes justes en sont les inverses. Cette ligne est ce qui se rapproche le plus de l'estimation honnête du marché, et c'est la référence du calculateur d'EV : un pari n'a une valeur espérée positive que si votre probabilité dépasse la probabilité juste, pas simplement celle affichée.",
        "Une limite assumée : le retrait proportionnel répartit la marge uniformément entre les résultats, ce que les bookmakers réels ne font pas. Ils chargent davantage les résultats improbables, car c'est là que se concentre l'argent récréatif. Sur un marché avec un grand favori et un outsider lointain, cette méthode sous-estime un peu la vraie chance du favori. Sur les lignes principales la distorsion est faible ; sur les vainqueurs à long terme, traitez la ligne juste comme une estimation, pas comme une mesure.",
      ],
      faq: [
        {
          q: "Quelle marge est acceptable ?",
          a: "Sur les lignes principales de football et de tennis, sous 3 % c'est sharp, entre 4 et 5 % c'est normal chez un bookmaker généraliste, au-delà de 7 % vous payez cher le droit d'avoir une opinion. Comparez le même marché chez plusieurs bookmakers avant de décider.",
        },
        {
          q: "Taux de retour et marge, est-ce la même chose ?",
          a: "Ce sont deux lectures du même nombre. Une marge de 5,26 % correspond à un taux de retour de 95 % : le bookmaker prévoit de rendre 95 sur chaque 100 misés sur tout le marché. Le taux de retour est le plus pratique pour comparer.",
        },
        {
          q: "Pourquoi les probabilités justes totalisent exactement 100 % ?",
          a: "Parce que c'est la définition du retrait de la marge. Celles affichées dépassent 100 % ; en divisant chacune par ce total, on les remet à l'échelle jusqu'à totaliser un, ce que doit faire un ensemble cohérent de probabilités.",
        },
        {
          q: "Cela marche-t-il sur un marché à trois issues ou vainqueur ?",
          a: "Oui : ajoutez autant de résultats que le marché en compte. Les mathématiques sont identiques quel que soit le nombre de résultats, à condition de les saisir tous. En oublier un sous-estime la marge.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "Calculateur de valeur espérée (EV) — avec ou sans ligne juste | BetRedge",
      metaDescription:
        "Calculateur de valeur espérée gratuit : saisissez cote, probabilité et mise pour obtenir l'EV en devise et en pourcentage, ou déduisez-la de la ligne d'un bookmaker sharp.",
      h1: "Calculateur de valeur espérée",
      lede:
        "Ce que vaut un pari en moyenne : à partir de votre probabilité, ou de la ligne d'un bookmaker sharp sans marge.",
      labels: {
        inputTitle: "Le pari",
        modeTitle: "D'où vient la probabilité",
        modeManual: "Mon estimation",
        modeSharp: "D'un bookmaker sharp",
        yourOdds: "Votre prix",
        yourProbability: "Votre probabilité (%)",
        sharpOddsA: "Prix sharp, votre côté",
        sharpOddsB: "Prix sharp, l'autre côté",
        derivedProbability: "Probabilité juste, marge retirée",
        stake: "Mise",
        resultTitle: "Ce que vaut le pari",
        ev: "Valeur espérée",
        fairOdds: "Prix d'équilibre",
        edge: "Avantage",
        positive: "Valeur espérée positive à ce prix.",
        negative: "Valeur espérée négative à ce prix.",
        neutral: "Équilibre : le prix correspond exactement à la probabilité.",
        hint: "Les pourcentages s'écrivent en nombres : 55 signifie 55 %.",
      },
      formulaTitle: "Comment la valeur espérée est calculée",
      formula: [
        "EV = p × (cote − 1) × mise − (1 − p) × mise",
        "   = (p × cote − 1) × mise",
        "avantage = p × cote − 1",
        "prix d'équilibre = 1 / p",
      ],
      explainerTitle: "Ce que dit vraiment la valeur espérée",
      explainer: [
        "La valeur espérée est le résultat moyen d'un pari si vous pouviez le répéter un nombre illimité de fois. Elle a deux entrées et aucune opinion : le prix qu'on vous propose et la probabilité que vous accordez au résultat. Si vous pensez qu'une équipe gagne 55 % du temps et qu'on vous propose 2.00, le calcul est immédiat : 55 % du temps vous gagnez une unité, 45 % vous la perdez, donc en moyenne vous gagnez 0,10 unité par unité misée. C'est un avantage de 10 %, et c'est ce que signifie +EV.",
        "Le nombre qui décide de tout est la probabilité, et c'est là que la plupart des parieurs perdent en silence. Une erreur de 5 points dans l'estimation suffit à transformer un avantage de 4 % en une perte de 1 %, et les estimations faites à l'œil se trompent couramment de bien plus de 5 points. D'où le second mode de ce calculateur : au lieu de vous fier à votre instinct, prenez le prix des deux côtés chez un bookmaker sharp, retirez la marge et utilisez la probabilité juste obtenue. Vous ne demandez plus si vous êtes plus fin que le marché, mais si le bookmaker où vous jouez est plus lent que le plus sharp.",
        "Lisez l'EV comme un taux, pas comme une promesse. Un pari à 4 % de valeur espérée ne rend rien sur une occasion isolée : il gagne ou il perd. Ces 4 % n'apparaissent qu'au fil de centaines de paris indépendants, et seulement si la probabilité était juste. À court terme la variance dépasse largement l'avantage, et c'est précisément pourquoi la taille de la mise compte autant que l'avantage : c'est le rôle du critère de Kelly.",
      ],
      faq: [
        {
          q: "Comment obtenir une probabilité fiable ?",
          a: "D'un modèle construit sur des données, ou du marché lui-même. La ligne juste d'un bookmaker sharp — ses prix sans marge — est une référence difficile à battre au seul jugement, et elle est consultable gratuitement.",
        },
        {
          q: "Un pari à EV positive est-il un bon pari ?",
          a: "C'est une condition nécessaire, pas suffisante. Un pari peut avoir une valeur espérée positive et rester une erreur si la mise est trop grande pour la bankroll, si l'avantage tient dans votre marge d'erreur ou si le marché se retourne avant le coup d'envoi.",
        },
        {
          q: "Pourquoi les deux côtés du marché sharp sont-ils demandés ?",
          a: "Parce qu'on ne peut pas retirer une marge d'un seul prix. Elle n'est visible qu'en additionnant les probabilités implicites de tous les résultats : c'est le second prix qui rend la probabilité juste calculable.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Calculateur du critère de Kelly — mise optimale selon avantage et bankroll | BetRedge",
      metaDescription:
        "Calculateur du critère de Kelly gratuit : saisissez cote, probabilité et bankroll pour la mise qui maximise la croissance à long terme — Kelly complet, demi ou quart.",
      h1: "Calculateur du critère de Kelly",
      lede:
        "La mise qui fait croître une bankroll le plus vite à long terme — et pourquoi presque tout le monde devrait miser moins que ce qu'elle indique.",
      labels: {
        inputTitle: "Le pari et la bankroll",
        odds: "Prix",
        probability: "Votre probabilité (%)",
        bankroll: "Bankroll",
        fractionTitle: "Fraction de Kelly",
        fractionFull: "Complet",
        fractionHalf: "Demi",
        fractionQuarter: "Quart",
        resultTitle: "Mise recommandée",
        stake: "Mise",
        stakePercent: "Part de la bankroll",
        edge: "Avantage",
        fullKelly: "Kelly complet",
        growth: "Croissance espérée par pari",
        noEdge: "Aucun avantage à ce prix : la mise optimale est zéro.",
        hint: "Les pourcentages s'écrivent en nombres : 55 signifie 55 %.",
      },
      formulaTitle: "Comment la mise de Kelly est calculée",
      formula: [
        "b = cote − 1",
        "f* = (p × b − (1 − p)) / b = (p × cote − 1) / b",
        "mise = bankroll × f* × fraction",
        "croissance espérée = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Dimensionner la mise pour que la mauvaise série ne l'achève pas",
      explainer: [
        "Le critère de Kelly répond à une question que la valeur espérée ignore : avec un avantage donné, combien risquer réellement ? Misez trop peu et un avantage réel se capitalise trop lentement pour compter. Misez trop et les mathématiques se retournent contre vous : une bankroll divisée par deux a besoin de +100 % pour revenir à son point de départ, donc les grosses mises détruisent la croissance même quand chaque pari est favorable. Kelly trouve la fraction qui maximise le taux de croissance à long terme, et il s'avère que c'est l'avantage divisé par la cote nette.",
        "Le résultat suit l'avantage, pas la conviction. Un avantage de 10 % à la cote 2.00 demande 10 % de la bankroll ; le même avantage à 5.00 n'en demande que 2,5 %, car un prix plus long signifie des séries perdantes plus longues et un chemin plus accidenté. C'est pourquoi la formule reste utile même si vous ne la suivez jamais à la lettre : elle dit que prix et avantage décident ensemble de la mise, et qu'une forte intuition n'est pas une donnée d'entrée.",
        "Presque personne ne devrait jouer Kelly complet. La formule suppose votre probabilité exacte, et elle ne l'est jamais. Donnez-lui un avantage surestimé et elle recommandera volontiers une mise trop grande pour l'avantage réel : le moyen le plus rapide de perdre une bankroll tout en ayant raison en moyenne. Le demi-Kelly abandonne un quart de la croissance théorique et réduit la volatilité de près de moitié ; le quart de Kelly est ce que beaucoup de professionnels avec de vrais modèles utilisent réellement. Si vos probabilités viennent du jugement et non des données, le quart de Kelly n'est pas de la prudence : c'est du réalisme.",
        "Quand le prix n'offre aucun avantage, la mise correcte est zéro, et ce calculateur le dit au lieu de renvoyer un nombre négatif déguisé en conseil. Une fraction de Kelly négative signifie que le pari vaudrait de l'autre côté, si vous le trouvez à ce prix : jamais qu'il faut miser moins sur celui-ci.",
      ],
      faq: [
        {
          q: "Kelly complet, demi ou quart ?",
          a: "Demi ou quart pour presque tout le monde. Le complet n'est optimal que si votre estimation est exacte, et l'erreur d'estimation nuit beaucoup plus par excès de mise qu'elle n'aide par défaut. Le Kelly fractionnaire échange un peu de croissance contre beaucoup de survie.",
        },
        {
          q: "Qu'est-ce que la croissance espérée par pari ?",
          a: "La croissance logarithmique moyenne de la bankroll pour un pari à cette mise. Elle est petite par construction — une valeur de 0,005 vaut environ un demi-point de croissance composée par pari — et c'est la quantité que Kelly maximise.",
        },
        {
          q: "Et si j'ai plusieurs paris en même temps ?",
          a: "Le Kelly à pari unique surmise quand les paris courent en parallèle, surtout s'ils sont corrélés. En règle pratique, répartissez le total entre les positions simultanées et traitez les paris corrélés comme un seul.",
        },
        {
          q: "Pourquoi affiche-t-il zéro alors que je crois avoir un avantage ?",
          a: "Parce qu'au prix saisi votre probabilité ne franchit pas le point d'équilibre. Comparez le prix à 1 divisé par votre probabilité : si le prix est plus bas, il n'y a pas d'avantage à miser.",
        },
      ],
      caveat:
        "Le critère de Kelly maximise la croissance à long terme, pas le confort. Même à la mise correcte, des baisses de 30 % ou plus sont ordinaires, et la formule suppose votre estimation de probabilité exacte : si elle est optimiste, Kelly misera systématiquement trop et la bankroll peut être perdue. Ne misez jamais un argent dont vous avez besoin.",
    },

    "probability-calculator": {
      metaTitle: "Calculateur de probabilité — cotes, équilibre et combinés | BetRedge",
      metaDescription:
        "Calculateur de probabilité gratuit pour les paris : convertissez probabilité et cote, trouvez la probabilité d'équilibre exigée par un prix et combinez les sélections d'un combiné.",
      h1: "Calculateur de probabilité",
      lede:
        "Transformez les probabilités en prix et inversement, voyez ce qu'un prix exige de vous et découvrez ce que vaut vraiment un combiné.",
      labels: {
        inputTitle: "Probabilité et prix",
        modeTitle: "Qu'avez-vous ?",
        modeProbability: "Une probabilité",
        modeOdds: "Un prix",
        probability: "Probabilité (%)",
        odds: "Cote décimale",
        breakEven: "Probabilité d'équilibre",
        fairOdds: "Prix juste",
        parlayTitle: "Combiné",
        leg: "Sélection",
        addLeg: "Ajouter une sélection",
        removeLeg: "Retirer",
        parlayProbability: "Probabilité combinée",
        parlayOdds: "Cote combinée",
        resultTitle: "Résultats",
        hint: "Un prix et sa probabilité d'équilibre sont le même nombre lu des deux côtés.",
      },
      formulaTitle: "Comment les probabilités sont calculées",
      formula: [
        "cote = 1 / probabilité",
        "probabilité = 1 / cote",
        "probabilité d'équilibre = 1 / cote",
        "probabilité du combiné = p₁ × p₂ × … × pₙ",
        "cote du combiné = cote₁ × cote₂ × … × coteₙ",
      ],
      explainerTitle: "La probabilité d'abord, le prix ensuite",
      explainer: [
        "Tout prix est une affirmation sur la probabilité, et la conversion entre les deux est une division : une probabilité de 40 % est un prix de 2.50, et un prix de 2.50 est une probabilité de 40 %. Faire cette conversion avant de miser change la question de « est-ce que j'aime ce pari ? » à « est-ce que je pense que ce résultat arrive plus de 40 % du temps ? », question sur laquelle on peut réellement se tromper, et donc question qui mérite d'être posée.",
        "Le même nombre, lu du côté du prix, est la probabilité d'équilibre : la chance minimale qu'un résultat doit avoir pour que le pari soit neutre. Un prix de 1.75 exige 57,1 %. Un prix de 1.50 exige 66,7 %. Les prix longs exigent très peu — 15.00 ne demande que 6,7 % — et c'est pourquoi ils semblent bon marché et pourquoi les bookmakers y chargent leur marge. La probabilité d'équilibre est le test honnête d'un pari : si vous ne pouvez pas argumenter que le résultat la dépasse, le prix n'est pas généreux, il est correct.",
        "Les combinés sont l'endroit où la probabilité devient contre-intuitive. Les sélections indépendantes se multiplient : trois paris que vous estimez à 50 % chacun se combinent à 12,5 %, et non à quelque chose de rassurant proche de la moitié. Quatre sélections à 60 % donnent 12,96 %. La cote combinée se multiplie de la même façon, et c'est là le piège : un combiné à 15.00 ressemble à une aubaine jusqu'à ce qu'on remarque qu'il exige un événement à 6,7 %, et que la marge du bookmaker a été appliquée à chaque sélection puis composée. Un combiné de quatre sélections à 5 % de marge chacune porte près de 21 % de marge totale.",
        "Une hypothèse à garder en tête : ce calculateur multiplie, il suppose donc les sélections indépendantes. Deux résultats du même match — la victoire d'une équipe et le but de son attaquant — sont corrélés, et multiplier leurs probabilités sous-estime la vraie chance que les deux se produisent. Les combinés d'un même match sont cotés à part par les bookmakers précisément parce que cette corrélation est difficile à calculer : traitez le nombre affiché ici comme un minimum, pas comme une réponse.",
      ],
      faq: [
        {
          q: "Qu'est-ce que la probabilité d'équilibre ?",
          a: "La chance qu'un résultat doit avoir pour qu'un pari à ce prix soit neutre à long terme. Elle vaut 1 divisé par la cote décimale, et c'est la barre que votre estimation doit franchir pour que le pari ait du sens.",
        },
        {
          q: "Pourquoi la probabilité de mon combiné est-elle si basse ?",
          a: "Parce que les probabilités se multiplient. Chaque sélection ajoutée rend l'ensemble moins probable, et une chaîne de sélections plausibles devient vite un pari improbable. La cote monte en conséquence, mais la marge accumulée aussi.",
        },
        {
          q: "Cela marche-t-il pour les combinés d'un même match ?",
          a: "Pas exactement. La multiplication suppose des sélections indépendantes, et les résultats d'un même match ne le sont généralement pas. Avec des sélections corrélées la probabilité réelle diffère — souvent supérieure au produit — et c'est pourquoi les bookmakers cotent ces marchés à part.",
        },
        {
          q: "La probabilité implicite d'un prix est-elle la vraie probabilité ?",
          a: "Non. Elle contient encore la marge du bookmaker, elle est donc systématiquement supérieure à l'estimation honnête du marché. Utilisez le calculateur de marge pour la retirer avant de la comparer à votre nombre.",
        },
      ],
    },
  },
};

export default fr;
