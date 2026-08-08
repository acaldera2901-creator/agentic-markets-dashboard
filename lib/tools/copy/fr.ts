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
      takeaway:
        "Toute cote est une probabilité déguisée. Convertissez d'abord, discutez ensuite : 2.50 signifie que le bookmaker vous annonce 40 %.",
      example: {
        title: "Une cote, tous les formats",
        rows: [
          { label: "Vous saisissez", value: "2.50" },
          { label: "Américaine", value: "+150" },
          { label: "Fractionnaire", value: "3/2" },
          { label: "Hong Kong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Probabilité implicite", value: "40,00 %" },
        ],
        note:
          "Changez-en une et les autres suivent. Attention à l'arrondi : la fameuse −110 vaut 1.9091 en décimal et implique 52,38 %, tandis qu'un 1.91 affiché implique 52,36 % — un écart qui semble nul et qui compte, parce que l'avantage se joue au dixième de point.",
      },
      explainerTitle: "Lire un prix dans n'importe quel format",
      explainer: [
        "**Une cote est une probabilité habillée autrement.** La décimale — standard européen — donne le retour total par unité misée : 2.50 rend 2.50 pour chaque 1 risqué, mise comprise. La fractionnaire indique le bénéfice : 3/2, c'est trois unités de bénéfice pour deux risquées, soit la même 2.50. L'américaine dit combien vous gagnez en misant 100 (+150) ou combien risquer pour gagner 100 (−110). Hong Kong, Malay et Indonesian sont les formats asiatiques, et ils comptent car les prix les plus affûtés s'y trouvent souvent.",
        "Le nombre qui mérite lecture est le dernier. **La probabilité implicite est 1 divisé par la cote décimale**, et c'est le seul chiffre comparable directement à votre estimation : deux cotes en notations différentes ne se comparent pas plus facilement que deux probabilités. Une limite que cet outil ne peut pas lever : **la probabilité implicite contient encore la marge du bookmaker**, donc additionnez tous les résultats d'un marché et vous dépasserez 100 %. Pour l'avis honnête du marché plutôt que son avis tarifé, passez-le au calculateur de marge.",
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
      takeaway:
        "La marge, c'est ce que vous payez pour le droit d'avoir une opinion. Deux bookmakers, le même match, et la différence est de l'argent.",
      example: {
        title: "Le même match chez deux bookmakers",
        rows: [
          { label: "Bookmaker généraliste", value: "1.90 / 1.90 · marge 5,26 %" },
          { label: "Bookmaker sharp", value: "1.98 / 1.98 · marge 1,01 %" },
          { label: "Ligne juste, les deux", value: "2.00 / 2.00 · 50 % chacun" },
          { label: "Votre EV sur un vrai 50 %", value: "−5 % contre −1 % par pari" },
        ],
        note:
          "Opinion identique, match identique. Miser 100 deux cents fois coûte 1 000 chez le premier et 200 chez le second : les huit centimes d'écart de cote font 800 sur une saison. C'est l'avantage le moins cher des paris, et il ne demande aucun modèle.",
      },
      explainerTitle: "La marge est le prix du pari",
      explainer: [
        "**Un marché à deux issues équitable cote les deux côtés à 2.00.** Les probabilités implicites valent 50 % et 50 %, totalisent exactement 100 %, et aucun côté n'a d'avantage. Les marchés réels sont cotés 1.90 et 1.90 : ces implicites valent 52,63 % chacune, totalisent 105,26 %, et **les 5,26 points en excès sont la marge du bookmaker** — l'overround. Quel que soit le côté joué, vous la payez. Les marges varient beaucoup : les lignes principales des bookmakers sharp descendent sous 2 %, tandis que les paris vainqueur et les marchés joueurs atteignent couramment 8 % ou plus, là où les bookmakers savent leurs prix les moins contrôlés.",
        "Retirer la marge donne la ligne juste, la no-vig. Ce calculateur le fait proportionnellement — chaque implicite divisée par leur somme, elles totalisent donc à nouveau 100 % — et **cette ligne juste est la référence de toute décision +EV** : un pari n'a une valeur espérée positive que si votre probabilité dépasse la juste, pas simplement celle affichée. Une limite assumée : les bookmakers réels chargent davantage les issues improbables, donc sur un marché avec un grand favori cette méthode le sous-estime un peu. Sur des lignes équilibrées la distorsion est faible ; sur les vainqueurs à long terme, traitez la ligne juste comme une estimation.",
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
      takeaway:
        "Vous n'avez pas besoin de deviner mieux que le marché : seulement de trouver un bookmaker plus lent que le plus sharp.",
      example: {
        title: "Emprunter la probabilité à un bookmaker sharp",
        rows: [
          { label: "Bookmaker sharp, deux côtés", value: "1.95 / 1.95" },
          { label: "Probabilité juste, marge retirée", value: "50,00 %" },
          { label: "Prix d'équilibre", value: "2.00" },
          { label: "Votre bookmaker propose", value: "2.10" },
          { label: "EV sur 100 misés", value: "+5,00 (+5 %)" },
        ],
        note:
          "Aucune opinion nécessaire : la ligne sharp a fourni la probabilité, et votre bookmaker a coté le même résultat à 2.10 là où 2.00 était juste. Passez les cotes sharp à 1.90/1.90 et la probabilité juste reste 50 % — c'est tout l'intérêt de retirer la marge : la réponse ne bouge pas avec le vig.",
      },
      explainerTitle: "Ce que dit vraiment la valeur espérée",
      explainer: [
        "**La valeur espérée est le résultat moyen d'un pari que vous pourriez répéter à l'infini.** Deux entrées, aucune opinion : le prix proposé et la probabilité que vous donnez au résultat. Vous pensez qu'une équipe gagne 55 % du temps et on vous offre 2.00, le calcul est immédiat — 55 % du temps vous gagnez une unité, 45 % vous la perdez, donc 0,10 unité par unité misée. C'est un avantage de 10 %, et c'est tout ce que veut dire +EV.",
        "**La probabilité est l'endroit où presque tout le monde perd en silence.** Une erreur de 5 points transforme un avantage de 4 % en perte de 1 %, et les estimations à l'œil se trompent de bien plus. D'où le second mode de ce calculateur : au lieu de vous fier à votre instinct, prenez les deux côtés chez un bookmaker sharp, retirez la marge et utilisez la probabilité juste obtenue. Lisez le résultat comme un taux, pas une promesse — un avantage de 4 % ne rend rien sur un pari isolé, il n'apparaît qu'au fil de centaines, et seulement si la probabilité était juste. C'est pourquoi la taille de la mise compte autant que l'avantage.",
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
      takeaway:
        "Kelly dimensionne la mise sur l'avantage, pas sur votre conviction — et presque tout le monde devrait miser délibérément moins que ce qu'il indique.",
      example: {
        title: "Ce que cela donne avec 1 000 de bankroll",
        rows: [
          { label: "Bankroll", value: "1 000" },
          { label: "Cote · votre probabilité", value: "2.00 · 55%" },
          { label: "Avantage", value: "+10%" },
          { label: "Kelly complet", value: "10% → 100 par pari" },
          { label: "Demi-Kelly", value: "5% → 50 par pari" },
        ],
        note:
          "Cinq défaites d'affilée — une séquence sur 54 à cette cote — laissent 590 en Kelly complet, et il faudra +69% pour revenir à 1 000. La même série en demi-Kelly laisse 774, et +29% suffisent. Même avantage, mêmes paris, moitié du trou.",
      },
      explainerTitle: "Dimensionner la mise pour que la mauvaise série ne l'achève pas",
      explainer: [
        "Le critère de Kelly répond à ce que la valeur espérée ignore : avec un avantage donné, combien risquer réellement ? Misez trop peu et un avantage réel se capitalise trop lentement pour compter. Misez trop et les mathématiques se retournent contre vous : une bankroll divisée par deux a besoin de +100 % pour revenir à son point de départ, donc des mises trop grandes détruisent la croissance même quand chaque pari est favorable. La fraction optimale est l'avantage divisé par la cote nette, et **elle suit l'avantage, pas la conviction** : 10 % d'avantage à 2.00 demande 10 % de la bankroll, le même avantage à 5.00 n'en demande que 2,5 %.",
        "**Presque personne ne devrait jouer Kelly complet**, car la formule suppose votre probabilité exacte et elle ne l'est jamais. Donnez-lui un avantage surestimé et elle recommandera volontiers une mise trop grande pour l'avantage réel : le moyen le plus rapide de perdre une bankroll tout en ayant raison en moyenne. Le demi-Kelly abandonne un quart de la croissance théorique et réduit la volatilité de près de moitié ; le quart de Kelly est ce qu'utilisent beaucoup de professionnels avec de vrais modèles. Et quand le prix n'offre aucun avantage, la mise correcte est zéro : une fraction de Kelly négative signifie que le pari est de l'autre côté, jamais qu'il faut miser moins sur celui-ci.",
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
      takeaway:
        "Les sélections se multiplient, et la marge du bookmaker avec elles. Un quadruple à 1.80 exige un événement à 9,5 %.",
      example: {
        title: "Ce que coûte vraiment un quadruple",
        rows: [
          { label: "Quatre sélections à", value: "1.80 chacune · 55,56 %" },
          { label: "Cote combinée", value: "10.50" },
          { label: "Probabilité combinée", value: "9,53 %" },
          { label: "Marge par sélection", value: "5 %" },
          { label: "Marge sur le combiné", value: "21,6 %" },
        ],
        note:
          "Le prix paraît généreux jusqu'à ce qu'on voie ce qu'il exige : un événement à 9,5 %. Et la marge du bookmaker s'est composée quatre fois — 1,05⁴ − 1 = 21,6 % — donc les mêmes quatre sélections vous coûtent quatre fois la marge d'un pari simple. Les sélections corrélées d'un même match sont autre chose : multiplier les sous-estime, et c'est précisément pourquoi les bookmakers cotent à part les combinés d'un même match.",
      },
      explainerTitle: "La probabilité d'abord, le prix ensuite",
      explainer: [
        "**Tout prix est une affirmation sur la probabilité**, et la conversion est une division : 40 % est un prix de 2.50, et 2.50 est une probabilité de 40 %. Faire cette conversion avant de miser change la question de « est-ce que j'aime ce pari ? » à « est-ce que cela arrive plus de 40 % du temps ? » — une question sur laquelle on peut se tromper. Lu du côté du prix, le même nombre est la **probabilité d'équilibre** : la chance minimale qu'un résultat doit avoir pour que le pari soit neutre. 1.75 exige 57,1 % ; 1.50 exige 66,7 % ; 15.00 ne demande que 6,7 %, et voilà pourquoi les longues cotes semblent bon marché et pourquoi les bookmakers y chargent leur marge.",
        "**Les combinés sont l'endroit où la probabilité devient contre-intuitive.** Les sélections indépendantes se multiplient : trois paris estimés à 50 % chacun donnent 12,5 %, et non quelque chose de rassurant près de la moitié. Quatre sélections à 60 % donnent 12,96 %. La cote combinée se multiplie pareil, et c'est le piège — le nombre grossit tandis que la chance rétrécit, et la marge se compose avec elle. Gardez l'hypothèse en tête : ici on multiplie, donc on suppose les sélections indépendantes. Deux résultats d'un même match sont corrélés, et là la probabilité réelle diffère, généralement supérieure au produit.",
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

    "arbitrage-calculator": {
      metaTitle: "Calculateur d'arbitrage — répartir une mise entre bookmakers | BetRedge",
      metaDescription:
        "Calculateur d'arbitrage gratuit : saisis la meilleure cote de chaque issue chez des books différents pour voir la somme des implicites, la répartition de la mise et le profit — ou son absence.",
      h1: "Calculateur d'arbitrage",
      lede:
        "Saisis la meilleure cote disponible sur chaque issue et vois si deux books réunis laissent une marge — et comment répartir la mise si c'est le cas.",
      labels: {
        inputTitle: "Meilleure cote sur chaque issue",
        outcome: "Issue",
        addOutcome: "Ajouter une issue",
        removeOutcome: "Retirer",
        total: "Mise totale",
        resultTitle: "Comment la répartir",
        profit: "Profit",
        impliedSum: "Somme des probabilités implicites",
        stakeOn: "Mise sur l'issue",
        guaranteedReturn: "Retour sur chaque issue",
        verdictArb:
          "Les cotes totalisent moins de 100 % : répartie ainsi, chaque issue rend la même somme.",
        verdictNoArb:
          "Les cotes totalisent plus de 100 %, il n'y a donc pas d'arbitrage ici — toute répartition perd cette marge, quelle que soit l'issue.",
        hint: "Une cote par issue, chacune chez le book qui paie le plus de ce côté. Le décimal accepte la virgule : 2,10 vaut 2.10.",
      },
      takeaway:
        "L'arbitrage n'est pas une prédiction. Il ne demande jamais d'avoir raison sur le vainqueur : il demande à deux books de diverger plus que leurs propres marges.",
      example: {
        title: "Deux books, 1 000 à répartir",
        rows: [
          { label: "Cotes, un book par côté", value: "2.10 · 2.10" },
          { label: "Somme des probabilités implicites", value: "95,24 %" },
          { label: "Mise de chaque côté, sur 1 000", value: "500 · 500" },
          { label: "Retour sur chaque issue", value: "1 050" },
          { label: "Profit", value: "+50 (+5,00 %)" },
        ],
        note:
          "Le même marché coté 1.90/1.90 chez un seul book totalise 105,26 % et rend −5,00 % quelle que soit la répartition. Rien du match n'a changé entre les deux lignes : toute la différence tient à quel book paie le plus de quel côté, et au fait d'avoir des comptes approvisionnés chez les deux pendant que les cotes étaient encore affichées.",
      },
      explainerTitle: "Quand deux books divergent assez",
      explainer: [
        "**Additionne un divisé par chaque cote et tu tiens tout le marché dans un seul nombre.** Chez un book unique ce nombre dépasse toujours 100 % : c'est la marge qui l'y maintient. Mais la meilleure cote d'un côté et la meilleure de l'autre se trouvent souvent chez des books différents, et en les combinant la somme peut passer sous 100 %. C'est toute la condition : **les probabilités implicites doivent totaliser moins de 1**. Répartis la mise totale au prorata de ces implicites et chaque issue rend la même somme, donc ce que tu récupères cesse de dépendre du résultat. Deux cotes de 2.10 totalisent 95,24 %, et 500 de chaque côté d'une mise de 1 000 rendent 1 050 quoi qu'il arrive.",
        "**En pratique cela se referme bien moins souvent que l'arithmétique ne le suggère, et les raisons comptent plus que la formule.** Les cotes bougent : l'écart repéré est le plus souvent le book le plus lent qui se met à jour, et il peut disparaître dans les secondes entre la première jambe et la seconde, te laissant un pari ordinaire et non couvert à une cote choisie pour couvrir et non pour sa valeur. Les limites de mise serrent précisément là où l'écart est le plus large : une marge de 5 % sur le papier est souvent une marge de 5 % sur quarante unités et non sur mille. Et **les books restreignent les comptes qui en font un système** : d'abord des limites plus basses, ensuite des paris refusés et des fermetures. Ajoute le capital immobilisé chez plusieurs books et le change entre devises, et l'arbitrage ressemble moins à une machine qu'à une façon lente et lourde en logistique de gratter une marge mince.",
      ],
      faq: [
        {
          q: "Faut-il un compte chez chaque bookmaker ?",
          a: "Oui. Un arbitrage n'existe qu'entre les books précis qui affichent ces cotes précises, il faut donc des comptes approvisionnés chez chacun avant que les cotes bougent. Ce capital, réparti sur plusieurs books et immobile la plupart du temps, est le coût que presque aucun calculateur ne montre.",
        },
        {
          q: "Que se passe-t-il si la seconde cote bouge avant que je la joue ?",
          a: "Il te reste la première jambe seule : un pari ordinaire, à une cote choisie pour couvrir et non pour sa valeur. Place d'abord la jambe la plus susceptible de bouger, et considère le fait de rester à découvert comme une partie du risque, pas comme un accident.",
        },
        {
          q: "Pourquoi les books restreignent-ils les arbitrageurs ?",
          a: "Parce que leur marge vit du flux équilibré des clients récréatifs, et un compte qui ne prend jamais que la meilleure cote d'un côté n'est pour eux qu'un coût. Les restrictions arrivent discrètement sous forme de limites de mise plus basses, bien avant la fermeture du compte.",
        },
        {
          q: "L'arbitrage sportif est-il légal ?",
          a: "L'activité en elle-même est légale : tu places des paris ordinaires à des cotes publiées. Ce qui peut l'interdire, ce sont les conditions du book, qui se réservent en général le droit de limiter, refuser ou annuler les paris qu'il juge relever de l'arbitrage. Légal et autorisé ne sont pas la même chose.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Calculateur de paris combinés — cote combinée, probabilité réelle et marge composée | BetRedge",
      metaDescription:
        "Calculateur de combinés gratuit : saisissez chaque sélection pour obtenir la cote combinée, la probabilité que le pari exige vraiment et la marge du bookmaker composée.",
      h1: "Calculateur de paris combinés",
      lede:
        "Chaque sélection ajoutée multiplie la cote — et multiplie avec elle la part que garde le bookmaker. Voici les deux nombres avant de miser.",
      labels: {
        inputTitle: "Les sélections",
        leg: "Sélection",
        addLeg: "Ajouter une sélection",
        removeLeg: "Retirer",
        marginPerLeg: "Marge du bookmaker par sélection (%)",
        resultTitle: "Ce que vaut le combiné",
        combinedOdds: "Cote combinée",
        impliedProb: "Probabilité que ça passe",
        compoundMargin: "Marge composée",
        verdict:
          "Multiplier suppose des sélections indépendantes. Deux choix du même match ne le sont pas : leur probabilité réelle est en général plus élevée que le produit, et c'est pourquoi les bookmakers cotent les combinés d'un même match avec leur propre modèle.",
        hint: "Une cote décimale par sélection, jusqu'à huit. La marge par sélection s'écrit en nombre : 5 signifie 5 %, à peu près ce que garde un marché à deux issues serré.",
      },
      takeaway:
        "La part du bookmaker ne s'additionne pas d'une sélection à l'autre, elle se compose — quatre sélections à 1.80 ressemblent à quatre paris presque équilibrés et forment un seul événement à 9,53 %.",
      example: {
        title: "Quatre sélections à 1.80, un pari à 9,53 %",
        rows: [
          { label: "Sélections", value: "4 × 1.80" },
          { label: "Cote combinée", value: "10.50" },
          { label: "Probabilité que ça passe", value: "9,53 %" },
          { label: "Marge par sélection", value: "5 %" },
          { label: "Marge composée", value: "21,55 %" },
        ],
        note:
          "Prise seule, chaque sélection est le pari sur lequel personne ne s'arrête : 55,56 % implicite, 1.80 à gagner. Enchaînées, les quatre exigent un événement à 9,53 % — et les 5 % que le bookmaker garde sur chaque sélection deviennent 1,05⁴ − 1 = 21,55 % sur le combiné. Rien n'a été ajouté au pari, sinon des façons de le perdre : la cote a monté parce que la chance a baissé.",
      },
      explainerTitle: "Pourquoi la cote monte plus vite que la chance",
      explainer: [
        "**Un combiné est un seul pari avec plusieurs façons de perdre, pas plusieurs paris.** La cote combinée est le produit des sélections — 1.80 pris quatre fois donne 10.4976 — et la probabilité est le produit des probabilités : c'est là que l'arithmétique cesse d'être aimable, puisque quatre choix que vous jugeriez presque équilibrés donnent 9,53 %. La marge se comporte pareil, et c'est la partie que presque personne ne compte. Elle ne s'additionne pas sélection par sélection, elle se **compose** : un bookmaker qui garde 5 % sur chacune de quatre sélections garde 1,05⁴ − 1 = 21,55 % sur le combiné, et à huit sélections ces mêmes 5 % sont devenus 47,75 %. Le gain paraît généreux parce que la chance s'est effondrée, pas parce qu'on vous paie davantage pour le même risque.",
        "**Le combiné est le produit le plus poussé du pari sportif et le moins favorable au client**, et ce sont deux faces du même fait : plus la marge composée est grande, plus un bookmaker peut se permettre de booster, d'assurer et de faire la publicité de ce ticket. Un avantage mince sur une sélection ne survit pas à la multiplication par trois autres sélections de marge — les mêmes choix joués en simple paient la marge une fois chacun, le quadruple la paie quatre fois. Reste ce que la multiplication suppose : **que les sélections sont indépendantes**. Deux choix du même match sont corrélés, donc multiplier est le mauvais calcul : une victoire à domicile et le but de son attaquant arrivent souvent ensemble, la paire est donc plus probable que ne le dit le produit, tandis que des sélections qui coexistent mal valent bien moins. C'est pourquoi les bookmakers construisent les combinés d'un même match avec leur propre modèle au lieu de vous laisser les assembler depuis les simples — et pourquoi ce calculateur est honnête sur des sélections de matchs différents.",
      ],
      faq: [
        {
          q: "Est-ce valable pour les combinés d'un même match ?",
          a: "Pas exactement. Ici on multiplie, et multiplier suppose des sélections indépendantes. Les issues d'un même match bougent ensemble, donc la probabilité réelle de la paire est différente — souvent plus élevée que le produit — et c'est pourquoi les bookmakers cotent ces marchés avec leur propre modèle plutôt qu'à partir des simples.",
        },
        {
          q: "Pourquoi la probabilité combinée est-elle si faible ?",
          a: "Parce que les probabilités se multiplient au lieu de faire une moyenne. Quatre sélections à 55,56 % donnent 9,53 % : chaque sélection ajoutée rend le pari entier moins probable, si bien qu'une chaîne de choix plausibles devient vite un pari improbable. La cote monte pour compenser, et la marge accumulée monte avec elle.",
        },
        {
          q: "Qu'est-ce que la marge composée exactement ?",
          a: "La part du bookmaker après que chaque sélection l'a multipliée. Saisissez ce que coûte une sélection — environ 5 % sur un marché à deux issues serré — et le calculateur la compose : un plus la marge, élevé au nombre de sélections, moins un. Quatre sélections à 5 % coûtent 21,55 %, huit sélections 47,75 %.",
        },
        {
          q: "Vaut-il mieux quatre simples qu'un quadruple ?",
          a: "Pour qui parie sur un avantage, oui : les mêmes quatre choix en simple paient la marge une fois chacun au lieu de la multiplier, et une sélection ratée coûte un pari et non tout le ticket. Le combiné achète de la variance — une petite chance de gros gain — et le prix de cette variance est la marge composée.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "Calculateur de ROI paris — rendement de votre bankroll | BetRedge",
      metaDescription:
        "Calculateur de ROI gratuit pour les paris : entrez capital et profit pour obtenir le rendement de la bankroll, le capital final et pourquoi le même profit fait 4 % de yield.",
      h1: "Calculateur de ROI",
      lede:
        "Ce que la bankroll a rapporté sur une période — et pourquoi le même profit de 400 donne un ROI de 40 % ici et un yield de 4 % sur l'autre page.",
      labels: {
        inputTitle: "Capital et résultat",
        capital: "Capital",
        profit: "Profit",
        resultTitle: "Rendement de ce capital",
        roi: "ROI",
        endingCapital: "Capital final",
        hint: "Le profit s'entre net et peut être négatif : -250 est une période perdante. Le capital est la bankroll mise en risque, pas le total misé.",
        verdict:
          "Le ROI dépend entièrement du dénominateur, donc déclarez-le : 400 sur une bankroll de 1 000 font 40 %, ce même 400 sur 10 000 misés fait un yield de 4 %. Aucun des deux chiffres ne dit grand-chose sans la période et le nombre de paris derrière.",
      },
      takeaway:
        "Le ROI dit ce que la bankroll a rapporté. Il ne dit pas si la stratégie est bonne, car le même 40 % peut venir de 200 paris ou d'un samedi chanceux.",
      example: {
        title: "400 de profit sur une bankroll de 1 000",
        rows: [
          { label: "Capital", value: "1 000" },
          { label: "Profit de la période", value: "+400" },
          { label: "ROI", value: "+40,00 %" },
          { label: "Capital final", value: "1 400" },
          { label: "Le même 400 sur 10 000 misés", value: "yield +4,00 %" },
        ],
        note:
          "Les deux pourcentages décrivent un seul et même résultat. Atteindre +40,00 % sur la bankroll a demandé 200 paris de 50 — 10 000 de volume misé, dix fois le capital — et 4,00 % de ce volume, c'est le même 400. Faites tourner la bankroll deux fois au lieu de dix et le yield derrière un ROI de 40 % devrait être de 20 %, ce que presque personne ne tient.",
      },
      explainerTitle: "Le profit mesuré sur l'argent en risque",
      explainer: [
        "**Le ROI, c'est le profit divisé par l'argent mis en risque**, et toute la difficulté tient dans la seconde moitié de la phrase. Une bankroll de 1 000 qui finit la saison avec 400 de plus a rendu 40,00 %, et ce chiffre se compare honnêtement à tout ce que vous auriez pu faire d'autre avec ces 1 000. Ce qu'il ne décrit pas, ce sont les paris. Un rendement de 40 % ne dit ni combien de paris il a fallu, ni sur combien de temps, ni à quel point le solde s'est approché de zéro en route — et ce sont les trois choses qui décident si cela se reproduira. Donc **déclarez le dénominateur avant d'annoncer le chiffre** : bankroll de départ, solde moyen et total déposé donnent trois pourcentages différents pour un jeu de paris identique, et le plus flatteur est toujours le plus petit.",
        "**Le même 400 de profit est un ROI de 40 % et un yield de 4 % en même temps**, et savoir lequel vous tenez fait presque toute la valeur des deux pages. Le ROI se mesure sur le capital, le yield sur le volume misé — la somme de chaque mise placée. Notre exemple y est arrivé avec 200 paris de 50, donc 10 000 sont passés par la bankroll : dix fois le capital, et 4,00 % de ce volume font ce même 400. **Ce multiplicateur est tout le pont entre les deux nombres**, et c'est pourquoi le ROI seul flatte celui qui joue beaucoup. Faire tourner 1 000 dix fois avec un yield de 4 % ou deux fois avec un yield de 20 % donne 40 % dans les deux cas, et un seul des deux est reproductible. La qualité par pari se mesure sur le calculateur de yield ; gardez le ROI pour ce à quoi il sert vraiment : comparer ce que cet argent a rapporté face aux alternatives.",
      ],
      faq: [
        {
          q: "Quelle est la différence entre ROI et yield ?",
          a: "Le ROI divise le profit par le capital, le yield le divise par le volume misé — la somme de toutes les mises. Le même 400 de profit fait 40,00 % d'une bankroll de 1 000 et 4,00 % de 10 000 misés. Le ROI dit ce que l'argent a rapporté, le yield dit si les paris étaient bons, et le rapport entre les deux est le nombre de fois où la bankroll a tourné.",
        },
        {
          q: "Quel capital utiliser comme dénominateur ?",
          a: "Celui que vous savez déclarer puis garder fixe : la bankroll de départ, en général. Solde maximum, solde moyen et total déposé produisent des pourcentages différents à partir des mêmes paris, donc le chiffre ne veut dire quelque chose qu'à côté de sa définition. Recharger le compte en cours de période sans redéclarer le dénominateur est la façon la plus courante de gonfler un ROI.",
        },
        {
          q: "Un ROI de 40 % est-il bon ?",
          a: "Cela dépend de la période et du nombre de paris. Sur une saison et 200 paris, c'est un résultat fort mais plausible. Le même 40 % sur vingt paris tient largement dans l'intervalle que le hasard produit seul, et 40 % en une semaine signifie d'habitude que les mises étaient grosses par rapport à la bankroll, pas que l'avantage l'était.",
        },
        {
          q: "Le ROI peut-il être négatif ?",
          a: "Oui, et le calculateur l'affiche au lieu de le cacher : une perte de 250 sur une bankroll de 1 000 fait -25,00 %. La récupération n'est pas symétrique — après -25 % il faut +33,33 % sur ce qui reste pour revenir à l'équilibre — et c'est pourquoi le drawdown mérite autant d'attention que le rendement.",
        },
      ],
    },
  },
};

export default fr;
