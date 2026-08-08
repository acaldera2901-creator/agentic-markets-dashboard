// lib/tools/copy/es.ts (#TOOLS-HUB-0805)
// Español. Keywords locales: "conversor de cuotas", "calculadora de valor
// esperado", "criterio de Kelly", "margen de la casa de apuestas".

import type { ToolsCopy } from "./types";

const es: ToolsCopy = {
  hub: {
    metaTitle: "Herramientas gratis de apuestas — cuotas, EV, Kelly y margen | BetRedge",
    metaDescription:
      "11 calculadoras gratuitas: convierte cuotas en cualquier formato, quita el margen de la casa, calcula el valor esperado, dimensiona la apuesta con Kelly, comprueba un arbitraje. Sin registro.",
    h1: "Herramientas gratuitas de apuestas",
    lede:
      "Los once cálculos que se hacen antes de apostar: cuotas convertidas, margen retirado, apuesta dimensionada, ROI medido. Gratis y sin cuenta.",
    cardCta: "Abrir la herramienta",
    intro: [
      "Toda apuesta es una comparación entre un precio y una probabilidad. Estas once calculadoras hacen esa comparación bien: traducen las cuotas entre formatos, quitan el margen de la casa para mostrar la línea justa, convierten una estimación de probabilidad en valor esperado, suman las patas de una combinada en una sola cuota, indican cuándo dos casas discrepan lo suficiente para cerrar un arbitraje, dimensionan la apuesta para que una mala racha no acabe con el bankroll y miden después lo que esas apuestas rindieron de verdad.",
      "Funcionan por completo en tu navegador: nada se envía, nada se guarda y no hay ninguna cuenta que crear. Úsalas por su cuenta, o úsalas para comprobar lo que nuestro modelo ya publica en cada partido.",
    ],
  },

  common: {
    backLabel: "Inicio",
    ctaTitle: "Estos números los calculamos en cada partido",
    ctaBody:
      "Las calculadoras trabajan con un precio a la vez. BetRedge escanea el mercado de forma continua, quita el margen, lo compara con la probabilidad del modelo y muestra dónde no coinciden — fútbol y tenis, actualizado todo el día.",
    ctaButton: "Ver el tablero de hoy",
    otherTools: "Otras herramientas gratuitas",
    langLabel: "Idioma",
    free: "Gratis",
    faqTitle: "Preguntas",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Conversor de cuotas — decimales, fraccionarias, americanas y probabilidad | BetRedge",
      metaDescription:
        "Conversor de cuotas gratuito: escribe un precio en cualquier formato — decimal, fraccionario, americano, Hong Kong, Malay o Indonesian — y léelo en todos los demás.",
      h1: "Conversor de cuotas",
      lede:
        "Escribe un precio en un formato y léelo en todos los demás, junto con la probabilidad que implica la casa.",
      labels: {
        inputTitle: "Tu precio",
        oddsInput: "Cuota",
        formatSelect: "Formato",
        resultTitle: "El mismo precio, en cada formato",
        decimal: "Decimal",
        american: "Americana",
        fractional: "Fraccionaria",
        hongkong: "Hong Kong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Probabilidad implícita",
        hint: "El decimal acepta también la coma: 2,50 vale igual que 2.50.",
      },
      takeaway:
        "Toda cuota es una probabilidad disfrazada. Primero convierte, después discute: 2.50 significa que la casa te está diciendo 40%.",
      example: {
        title: "Una cuota, todos los formatos",
        rows: [
          { label: "Tú escribes", value: "2.50" },
          { label: "Americana", value: "+150" },
          { label: "Fraccionaria", value: "3/2" },
          { label: "Hong Kong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Probabilidad implícita", value: "40.00%" },
        ],
        note:
          "Cambia una y las demás siguen. Ojo con el redondeo: la conocida −110 en decimal es 1.9091 e implica el 52,38%, mientras que un 1.91 mostrado en pantalla implica el 52,36% — una diferencia que parece nada y cuenta, porque la ventaja se juega en décimas de punto.",
      },
      explainerTitle: "Leer un precio en cualquier formato",
      explainer: [
        "**Una cuota es una probabilidad vestida de otra manera.** La decimal — el estándar europeo — da el retorno total por unidad apostada: 2.50 devuelve 2.50 por cada 1 arriesgado, apuesta incluida. La fraccionaria indica el beneficio: 3/2 son tres unidades de beneficio por cada dos arriesgadas, la misma 2.50. La americana dice cuánto ganas apostando 100 (+150) o cuánto debes arriesgar para ganar 100 (−110). Hong Kong, Malay e Indonesian son los formatos asiáticos, y cuentan porque ahí suelen estar los precios más afilados.",
        "El número que merece la pena leer es el último. **La probabilidad implícita es 1 dividido por la cuota decimal**, y es la única cifra que puedes comparar directamente con tu estimación: dos cuotas en notaciones distintas no son más fáciles de comparar que dos probabilidades. Un límite que esta herramienta no puede quitarte: **la probabilidad implícita todavía contiene el margen de la casa**, así que suma todos los resultados de un mercado y pasarás del 100%. Para la opinión honesta del mercado en vez de la opinión con recargo, pásala por la calculadora de margen.",
      ],
      faq: [
        {
          q: "¿En qué formato conviene trabajar?",
          a: "En decimal, salvo que haya un motivo para no hacerlo. Multiplicar cuotas decimales da directamente el precio de una combinada, y dividir 1 por la cuota da la probabilidad implícita: dos operaciones incómodas en notación fraccionaria o americana.",
        },
        {
          q: "¿Por qué −110 sale como 1,909090…?",
          a: "Porque 100/110 es un decimal periódico. Redondeado a dos cifras es 1.91, que es lo que muestran las casas, pero el conversor mantiene la precisión completa por dentro para que una cadena de cálculos no acumule error.",
        },
        {
          q: "¿Qué diferencia hay entre cuotas Malay e Indonesian?",
          a: "Son espejo una de la otra. Las Malay son positivas por debajo de 2.00 y negativas por encima; las Indonesian son positivas por encima de 2.00 y negativas por debajo. Expresan el mismo precio y convierten a la misma decimal.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Calculadora de margen — overround, payout y cuotas justas sin margen | BetRedge",
      metaDescription:
        "Calculadora de margen gratuita: introduce las cuotas de todos los resultados y obtén el margen de la casa, el porcentaje de payout y las cuotas justas sin recargo.",
      h1: "Calculadora de margen",
      lede:
        "Introduce todos los precios de un mercado y ve cuánto se queda la casa — más la línea justa que hay debajo.",
      labels: {
        inputTitle: "El mercado",
        outcome: "Resultado",
        addOutcome: "Añadir resultado",
        removeOutcome: "Quitar",
        resultTitle: "Lo que está cobrando la casa",
        margin: "Margen de la casa",
        payout: "Payout",
        fairOddsTitle: "Línea justa, margen retirado",
        fairOdds: "Cuota justa",
        fairProbability: "Probabilidad justa",
        impliedProbability: "Probabilidad implícita",
        hint: "Añade un resultado para mercados de tres vías, o más para los mercados a ganador.",
      },
      takeaway:
        "El margen es lo que pagas por el derecho a tener una opinión. Dos casas, el mismo partido, y la diferencia es dinero.",
      example: {
        title: "El mismo partido en dos casas",
        rows: [
          { label: "Casa generalista", value: "1.90 / 1.90 · margen 5,26%" },
          { label: "Casa sharp", value: "1.98 / 1.98 · margen 1,01%" },
          { label: "Línea justa, ambas", value: "2.00 / 2.00 · 50% cada uno" },
          { label: "Tu EV en un 50% real", value: "−5% frente a −1% por apuesta" },
        ],
        note:
          "Opinión idéntica, partido idéntico. Apostar 100 doscientas veces cuesta 1.000 en la primera casa y 200 en la segunda: los ocho céntimos de diferencia de cuota son 800 a lo largo de una temporada. Es la ventaja más barata que existe en las apuestas y no requiere ningún modelo.",
      },
      explainerTitle: "El margen es el precio de la apuesta",
      explainer: [
        "**Un mercado de dos vías justo cotiza ambos lados a 2.00.** Las probabilidades implícitas son 50% y 50%, suman exactamente 100%, y ningún lado tiene ventaja. Los mercados reales se cotizan a 1.90 y 1.90: esas implícitas valen 52,63% cada una, suman 105,26%, y **los 5,26 puntos de exceso son el margen de la casa** — el overround. Juegues el lado que juegues, lo estás pagando. Los márgenes varían mucho por mercado: las líneas principales de las casas sharp bajan del 2%, mientras que los mercados a ganador y de jugadores llegan habitualmente al 8% o más, porque ahí las casas saben que sus precios se comprueban menos.",
        "Quitar el margen da la línea justa, la no-vig. Esta calculadora lo hace en proporción — cada implícita dividida por su suma, así vuelven a sumar exactamente 100% — y **esa línea justa es la referencia de toda decisión +EV**: una apuesta solo tiene valor esperado positivo si tu probabilidad supera la justa, no simplemente la cotizada. Un límite declarado: las casas reales cargan más margen en los resultados improbables, así que en un mercado con un favorito claro este método lo subestima algo. En líneas equilibradas la distorsión es pequeña; en mercados a ganador tipo lotería, trata la línea justa como una estimación.",
      ],
      faq: [
        {
          q: "¿Qué margen es aceptable?",
          a: "En las líneas principales de fútbol y tenis, por debajo del 3% es sharp, entre 4% y 5% es normal en una casa generalista, y por encima del 7% estás pagando mucho por el derecho a tener una opinión. Compara el mismo mercado en varias casas antes de decidir.",
        },
        {
          q: "¿Payout y margen son lo mismo?",
          a: "Son dos lecturas del mismo número. Un margen del 5,26% equivale a un payout del 95%: la casa espera devolver 95 de cada 100 apostados en todo el mercado. El payout es el número más cómodo para comparar casas.",
        },
        {
          q: "¿Por qué las probabilidades justas suman exactamente 100%?",
          a: "Porque eso es la definición de quitar el margen. Las cotizadas suman más de 100%; al dividir cada una por ese total se reescalan hasta sumar uno, que es lo que debe hacer un conjunto coherente de probabilidades.",
        },
        {
          q: "¿Sirve para mercados de tres vías o a ganador?",
          a: "Sí: añade tantos resultados como tenga el mercado. Las matemáticas son idénticas para cualquier número de resultados, siempre que los introduzcas todos. Dejar uno fuera subestima el margen.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "Calculadora de valor esperado (EV) — con o sin línea justa | BetRedge",
      metaDescription:
        "Calculadora de valor esperado gratuita: introduce precio, probabilidad y stake para obtener el EV en moneda y en porcentaje, o dedúcelo de la línea de una casa sharp.",
      h1: "Calculadora de valor esperado",
      lede:
        "Cuánto vale una apuesta de media: desde tu propia probabilidad, o desde la línea de una casa sharp sin margen.",
      labels: {
        inputTitle: "La apuesta",
        modeTitle: "De dónde viene la probabilidad",
        modeManual: "Mi estimación",
        modeSharp: "De una casa sharp",
        yourOdds: "Tu precio",
        yourProbability: "Tu probabilidad (%)",
        sharpOddsA: "Precio sharp, tu lado",
        sharpOddsB: "Precio sharp, el otro lado",
        derivedProbability: "Probabilidad justa, margen retirado",
        stake: "Stake",
        resultTitle: "Lo que vale la apuesta",
        ev: "Valor esperado",
        fairOdds: "Precio de equilibrio",
        edge: "Ventaja",
        positive: "Valor esperado positivo a este precio.",
        negative: "Valor esperado negativo a este precio.",
        neutral: "Equilibrio: el precio coincide exactamente con la probabilidad.",
        hint: "Los porcentajes se escriben como números: 55 significa 55%.",
      },
      takeaway:
        "No necesitas adivinar mejor que el mercado: solo encontrar una casa más lenta que la más sharp.",
      example: {
        title: "Tomar prestada la probabilidad de una casa sharp",
        rows: [
          { label: "Casa sharp, ambos lados", value: "1.95 / 1.95" },
          { label: "Probabilidad justa, sin margen", value: "50,00%" },
          { label: "Precio de equilibrio", value: "2.00" },
          { label: "Tu casa ofrece", value: "2.10" },
          { label: "EV sobre 100 apostados", value: "+5,00 (+5%)" },
        ],
        note:
          "No hizo falta ninguna opinión: la línea sharp aportó la probabilidad, y tu casa cotizó el mismo resultado a 2.10 donde lo justo era 2.00. Mueve las cuotas sharp a 1.90/1.90 y la probabilidad justa sigue siendo el 50% — ese es el sentido de quitar el margen: la respuesta no se mueve con el recargo.",
      },
      explainerTitle: "Qué dice realmente el valor esperado",
      explainer: [
        "**El valor esperado es el resultado medio de una apuesta que pudieras repetir para siempre.** Dos entradas, ninguna opinión: el precio ofrecido y la probabilidad que das al resultado. Crees que un equipo gana el 55% de las veces y alguien ofrece 2.00, y la cuenta es inmediata — el 55% de las veces ganas una unidad, el 45% la pierdes, así que ganas 0,10 unidades por unidad apostada. Es una ventaja del 10%, y eso es todo lo que significa +EV.",
        "**La probabilidad es donde casi todos pierden en silencio.** Un error de 5 puntos convierte una ventaja del 4% en una pérdida del 1%, y las estimaciones a ojo fallan mucho más de 5 puntos. De ahí el segundo modo de esta calculadora: en vez de fiarte del instinto, toma los dos lados en una casa sharp, quita el margen y usa la probabilidad justa resultante. Lee el resultado como una tasa, no como una promesa — una ventaja del 4% no devuelve nada en una apuesta concreta, aparece solo a lo largo de cientos, y solo si la probabilidad era correcta. Por eso el tamaño del stake importa tanto como la ventaja.",
      ],
      faq: [
        {
          q: "¿Cómo consigo una probabilidad fiable?",
          a: "De un modelo construido con datos, o del propio mercado. La línea justa de una casa sharp — sus precios sin margen — es una referencia difícil de superar solo con criterio, y se puede consultar gratis.",
        },
        {
          q: "¿Una apuesta con EV positivo es una buena apuesta?",
          a: "Es una condición necesaria, no suficiente. Puede tener valor esperado positivo y seguir siendo un error si el stake es demasiado grande para el bankroll, si la ventaja cae dentro de tu error de estimación o si el mercado se mueve en contra antes del inicio.",
        },
        {
          q: "¿Por qué pide los dos lados del mercado sharp?",
          a: "Porque el margen no se puede quitar de un solo precio. Solo es visible al sumar las probabilidades implícitas de todos los resultados: es el segundo precio el que hace calculable la probabilidad justa.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Calculadora del criterio de Kelly — stake óptimo según ventaja y bankroll | BetRedge",
      metaDescription:
        "Calculadora del criterio de Kelly gratuita: introduce precio, probabilidad y bankroll para el stake que maximiza el crecimiento a largo plazo — Kelly completo, medio o cuarto.",
      h1: "Calculadora del criterio de Kelly",
      lede:
        "El stake que hace crecer más rápido un bankroll a largo plazo — y por qué casi todos deberían apostar menos de lo que dice.",
      labels: {
        inputTitle: "La apuesta y el bankroll",
        odds: "Precio",
        probability: "Tu probabilidad (%)",
        bankroll: "Bankroll",
        fractionTitle: "Fracción de Kelly",
        fractionFull: "Completo",
        fractionHalf: "Medio",
        fractionQuarter: "Cuarto",
        resultTitle: "Stake recomendado",
        stake: "Stake",
        stakePercent: "Parte del bankroll",
        edge: "Ventaja",
        fullKelly: "Kelly completo",
        growth: "Crecimiento esperado por apuesta",
        noEdge: "No hay ventaja a este precio: el stake óptimo es cero.",
        hint: "Los porcentajes se escriben como números: 55 significa 55%.",
      },
      takeaway:
        "Kelly dimensiona la apuesta según la ventaja, no según tu confianza — y casi todos deberían apostar deliberadamente menos de lo que dice.",
      example: {
        title: "Qué significa con 1.000 de bankroll",
        rows: [
          { label: "Bankroll", value: "1.000" },
          { label: "Cuota · tu probabilidad", value: "2.00 · 55%" },
          { label: "Ventaja", value: "+10%" },
          { label: "Kelly completo", value: "10% → 100 por apuesta" },
          { label: "Medio Kelly", value: "5% → 50 por apuesta" },
        ],
        note:
          "Cinco derrotas seguidas — una secuencia de cada 54 a esta cuota — dejan 590 con Kelly completo, y hará falta un +69% para volver a 1.000. La misma racha a medio Kelly deja 774, y basta un +29%. Misma ventaja, mismas apuestas, la mitad del agujero.",
      },
      explainerTitle: "Dimensionar la apuesta para que la mala racha no la termine",
      explainer: [
        "El criterio de Kelly responde a lo que el valor esperado ignora: dada una ventaja, ¿cuánto arriesgar realmente? Apuesta demasiado poco y una ventaja real se capitaliza demasiado despacio para importar. Apuesta demasiado y las matemáticas se giran en contra: un bankroll que se reduce a la mitad necesita un +100% para recuperarse, así que los stakes excesivos destruyen el crecimiento incluso cuando cada apuesta es favorable. La fracción óptima es la ventaja dividida por la cuota neta, y **escala con la ventaja, no con la confianza**: un 10% de ventaja a 2.00 pide el 10% del bankroll, la misma ventaja a 5.00 pide solo el 2,5%.",
        "**Casi nadie debería apostar Kelly completo**, porque la fórmula asume que tu probabilidad es exacta y nunca lo es. Dale una ventaja sobrestimada y recomendará con entusiasmo un stake demasiado grande para la ventaja que tienes de verdad: la forma más rápida de perder un bankroll teniendo razón de media. El medio Kelly renuncia a una cuarta parte del crecimiento teórico y reduce la volatilidad casi a la mitad; el cuarto de Kelly es lo que usan muchos profesionales con modelos reales. Y cuando el precio no ofrece ventaja, el stake correcto es cero: una fracción de Kelly negativa significa que la apuesta va en el otro lado, no que debas apostar menos en esta.",
      ],
      faq: [
        {
          q: "¿Kelly completo, medio o cuarto?",
          a: "Medio o cuarto para casi todo el mundo. El completo solo es óptimo si tu estimación de probabilidad es exacta, y el error de estimación hace mucho más daño por exceso de stake del que ayuda por defecto. El Kelly fraccionario cambia algo de crecimiento por mucha supervivencia.",
        },
        {
          q: "¿Qué es el crecimiento esperado por apuesta?",
          a: "El crecimiento logarítmico medio del bankroll para una apuesta a ese stake. Es pequeño por construcción — un valor de 0,005 equivale a medio punto porcentual de crecimiento compuesto por apuesta — y es la cantidad que Kelly maximiza.",
        },
        {
          q: "¿Y si tengo varias apuestas a la vez?",
          a: "El Kelly de apuesta única sobreapuesta cuando las apuestas corren en paralelo, sobre todo si están correlacionadas. Como regla práctica, reparte el total entre las posiciones simultáneas y trata las apuestas correlacionadas como una sola.",
        },
        {
          q: "¿Por qué muestra cero si creo que tengo ventaja?",
          a: "Porque al precio introducido tu probabilidad no supera el punto de equilibrio. Compara el precio con 1 dividido por tu probabilidad: si el precio es más bajo, no hay ventaja que apostar.",
        },
      ],
      caveat:
        "El criterio de Kelly maximiza el crecimiento a largo plazo, no la tranquilidad. Incluso con el stake correcto, caídas del 30% o más son normales, y la fórmula asume que tu estimación de probabilidad es precisa: si es optimista, Kelly apostará sistemáticamente de más y el bankroll puede perderse. Nunca apuestes dinero que necesitas.",
    },

    "probability-calculator": {
      metaTitle: "Calculadora de probabilidad — cuotas, equilibrio y combinadas | BetRedge",
      metaDescription:
        "Calculadora de probabilidad gratuita para apuestas: convierte probabilidad y cuota, halla la probabilidad de equilibrio que exige un precio y combina las patas de una combinada.",
      h1: "Calculadora de probabilidad",
      lede:
        "Convierte probabilidades en precios y al revés, mira qué te exige un precio y descubre cuánto vale de verdad una combinada.",
      labels: {
        inputTitle: "Probabilidad y precio",
        modeTitle: "¿Qué tienes?",
        modeProbability: "Una probabilidad",
        modeOdds: "Un precio",
        probability: "Probabilidad (%)",
        odds: "Cuota decimal",
        breakEven: "Probabilidad de equilibrio",
        fairOdds: "Precio justo",
        parlayTitle: "Combinada",
        leg: "Pata",
        addLeg: "Añadir pata",
        removeLeg: "Quitar",
        parlayProbability: "Probabilidad combinada",
        parlayOdds: "Precio combinado",
        resultTitle: "Resultados",
        hint: "Un precio y su probabilidad de equilibrio son el mismo número leído desde lados opuestos.",
      },
      takeaway:
        "Las patas se multiplican, y con ellas el recargo de la casa. Una combinada de cuatro a 1.80 exige un evento del 9,5%.",
      example: {
        title: "Lo que cuesta de verdad una combinada de cuatro",
        rows: [
          { label: "Cuatro patas a", value: "1.80 cada una · 55,56%" },
          { label: "Precio combinado", value: "10.50" },
          { label: "Probabilidad combinada", value: "9,53%" },
          { label: "Margen por pata", value: "5%" },
          { label: "Margen en la combinada", value: "21,6%" },
        ],
        note:
          "El precio parece generoso hasta que ves lo que exige: un evento del 9,5%. Y el recargo de la casa se compuso cuatro veces — 1,05⁴ − 1 = 21,6% — así que las mismas cuatro selecciones te cuestan cuatro veces el margen de una sola. Las patas correlacionadas del mismo partido son otra cosa: multiplicar las subestima, y por eso las casas cotizan aparte las combinadas del mismo partido.",
      },
      explainerTitle: "Primero la probabilidad, después el precio",
      explainer: [
        "**Todo precio es una afirmación sobre la probabilidad**, y la conversión es una división: el 40% es un precio de 2.50, y 2.50 es una probabilidad del 40%. Hacer esa conversión antes de apostar cambia la pregunta de «¿me gusta esta apuesta?» a «¿ocurre esto más del 40% de las veces?» — una pregunta en la que puedes estar equivocado. Leído desde el precio, el mismo número es la **probabilidad de equilibrio**: la posibilidad mínima que necesita un resultado para que la apuesta sea neutra. 1.75 exige el 57,1%; 1.50 exige el 66,7%; 15.00 pide solo el 6,7%, y por eso los precios largos parecen baratos y por eso las casas cargan ahí su margen.",
        "**Las combinadas son donde la probabilidad se vuelve contraintuitiva.** Las patas independientes se multiplican: tres apuestas que valoras al 50% combinan al 12,5%, no a algo tranquilizadoramente cercano a la mitad. Cuatro patas al 60% dan 12,96%. El precio combinado se multiplica igual, y ahí está la trampa — el número se hace grande mientras la posibilidad se hace pequeña, y el margen se compone con ella. Ten presente la suposición de fondo: aquí se multiplica, así que se asumen patas independientes. Dos resultados del mismo partido están correlacionados, y ahí la probabilidad real es distinta, normalmente mayor que el producto.",
      ],
      faq: [
        {
          q: "¿Qué es la probabilidad de equilibrio?",
          a: "La posibilidad que debe tener un resultado para que una apuesta a ese precio sea neutra a largo plazo. Es 1 dividido por la cuota decimal, y es el listón que tu estimación tiene que superar para que la apuesta tenga sentido.",
        },
        {
          q: "¿Por qué la probabilidad de mi combinada es tan baja?",
          a: "Porque las probabilidades se multiplican. Cada pata añadida hace el conjunto menos probable, y una cadena de patas plausibles se convierte rápido en una apuesta improbable. El precio sube en consecuencia, pero también sube el margen acumulado.",
        },
        {
          q: "¿Sirve para combinadas del mismo partido?",
          a: "No exactamente. Multiplicar asume patas independientes, y los resultados dentro de un mismo partido normalmente no lo son. Con patas correlacionadas la probabilidad real es distinta — a menudo mayor que el producto — y por eso las casas cotizan esos mercados aparte.",
        },
        {
          q: "¿La probabilidad implícita de un precio es la probabilidad real?",
          a: "No. Todavía contiene el margen de la casa, así que es sistemáticamente mayor que la estimación honesta del mercado. Usa la calculadora de margen para quitarlo antes de compararla con tu número.",
        },
      ],
    },

    "arbitrage-calculator": {
      metaTitle: "Calculadora de arbitraje — repartir la apuesta entre casas | BetRedge",
      metaDescription:
        "Calculadora de arbitraje gratuita: introduce la mejor cuota de cada resultado en casas distintas y verás la suma de las implícitas, cómo repartir la apuesta y el beneficio, o que no lo hay.",
      h1: "Calculadora de arbitraje",
      lede:
        "Introduce la mejor cuota disponible en cada resultado y comprueba si dos casas juntas dejan margen — y cómo repartir la apuesta si lo dejan.",
      labels: {
        inputTitle: "Mejor cuota de cada resultado",
        outcome: "Resultado",
        addOutcome: "Añadir resultado",
        removeOutcome: "Quitar",
        total: "Apuesta total",
        resultTitle: "Cómo repartirla",
        profit: "Beneficio",
        impliedSum: "Suma de probabilidades implícitas",
        stakeOn: "Apuesta al resultado",
        guaranteedReturn: "Retorno en cada resultado",
        verdictArb:
          "Las cuotas suman menos del 100%: repartida así, cada resultado devuelve la misma cantidad.",
        verdictNoArb:
          "Las cuotas suman más del 100%, así que aquí no hay arbitraje — cualquier reparto pierde ese margen, salga lo que salga.",
        hint: "Una cuota por resultado, cada una de la casa que más paga en ese lado. El decimal acepta coma: 2,10 vale como 2.10.",
      },
      takeaway:
        "El arbitraje no es una predicción. Nunca te pide acertar quién gana: pide que dos casas discrepen más de lo que valen sus propios márgenes.",
      example: {
        title: "Dos casas, 1.000 para repartir",
        rows: [
          { label: "Cuotas, una casa por lado", value: "2.10 · 2.10" },
          { label: "Suma de probabilidades implícitas", value: "95,24%" },
          { label: "Apuesta a cada lado, sobre 1.000", value: "500 · 500" },
          { label: "Retorno en cada resultado", value: "1.050" },
          { label: "Beneficio", value: "+50 (+5,00%)" },
        ],
        note:
          "El mismo mercado a 1.90/1.90 dentro de una sola casa suma 105,26% y devuelve −5,00% como lo repartas. Entre las dos líneas no ha cambiado nada del partido: la diferencia está entera en qué casa paga más en qué lado, y en tener cuentas con saldo en ambas mientras las cuotas seguían publicadas.",
      },
      explainerTitle: "Cuando dos casas discrepan lo suficiente",
      explainer: [
        "**Suma uno dividido por cada cuota y tienes el mercado entero en un solo número.** Dentro de una casa ese número siempre pasa del 100%: el margen es lo que lo mantiene ahí. Pero la mejor cuota de un lado y la mejor del otro suelen estar en casas distintas, y al combinarlas la suma puede caer por debajo del 100%. Esa es toda la condición: **las probabilidades implícitas tienen que sumar menos de 1**. Reparte la apuesta total en proporción a esas implícitas y cada resultado devuelve lo mismo, así que lo que recuperas deja de depender del marcador. Dos cuotas de 2.10 suman 95,24%, y 500 en cada lado de una apuesta de 1.000 devuelven 1.050 pase lo que pase.",
        "**En la práctica esto se cierra mucho menos de lo que sugiere la aritmética, y los motivos importan más que la fórmula.** Las cuotas se mueven: la diferencia que has visto suele ser la casa más lenta poniéndose al día, y puede desaparecer en los segundos entre la primera pata y la segunda, dejándote una apuesta normal y descubierta a una cuota elegida para cubrirte y no por su valor. Los límites de apuesta aprietan justo donde la diferencia es mayor, así que un 5% sobre el papel suele ser un 5% sobre cuarenta unidades y no sobre mil. Y **las casas restringen las cuentas de quien lo hace de forma sistemática**: primero límites más bajos, luego apuestas rechazadas y cierres. Suma el capital aparcado en varias casas y el cambio de divisa entre ellas, y el arbitraje se parece menos a una máquina y más a una manera lenta y operativamente exigente de raspar un margen fino.",
      ],
      faq: [
        {
          q: "¿Necesito cuenta en todas las casas?",
          a: "Sí. El arbitraje existe solo entre las casas concretas que publican esas cuotas concretas, así que necesitas cuentas con saldo en cada una antes de que las cuotas se muevan. Ese capital, repartido en varias casas y parado la mayor parte del tiempo, es el coste que casi ninguna calculadora enseña.",
        },
        {
          q: "¿Qué pasa si la segunda cuota se mueve antes de apostarla?",
          a: "Te quedas con la primera pata sola: una apuesta corriente, a una cuota elegida para cubrirte y no por su valor. Coloca primero la pata con más probabilidad de moverse, y trata el quedarte descubierto como parte del riesgo, no como un accidente.",
        },
        {
          q: "¿Por qué las casas restringen a quien hace arbitraje?",
          a: "Porque su margen vive del flujo equilibrado de clientes recreativos, y una cuenta que solo toma la mejor cuota de un lado es puro coste para ellas. Las restricciones llegan en silencio como límites de apuesta más bajos, mucho antes del cierre de la cuenta.",
        },
        {
          q: "¿Es legal el arbitraje deportivo?",
          a: "La actividad en sí es legal: estás haciendo apuestas normales a cuotas publicadas. Lo que puede prohibirlo son los términos de la casa, que suelen reservarse el derecho a limitar, rechazar o anular las apuestas que consideren arbitraje. Legal y permitido no son lo mismo.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Calculadora de combinadas — cuota combinada, probabilidad real y margen compuesto | BetRedge",
      metaDescription:
        "Calculadora de combinadas gratis: introduce cada pata y obtén la cuota combinada, la probabilidad que el boleto necesita de verdad y cómo se compone el margen de la casa.",
      h1: "Calculadora de combinadas",
      lede:
        "Cada pata que añades multiplica la cuota — y multiplica con ella la parte que se queda la casa. Aquí están los dos números antes de apostar.",
      labels: {
        inputTitle: "Las patas",
        leg: "Pata",
        addLeg: "Añadir pata",
        removeLeg: "Quitar",
        marginPerLeg: "Margen de la casa por pata (%)",
        resultTitle: "Lo que vale la combinada",
        combinedOdds: "Cuota combinada",
        impliedProb: "Probabilidad de que entre",
        compoundMargin: "Margen compuesto",
        verdict:
          "Multiplicar asume que las patas son independientes. Dos selecciones del mismo partido no lo son: su probabilidad real suele ser mayor que el producto, y por eso las casas cotizan las combinadas del mismo partido con un modelo propio.",
        hint: "Una cuota decimal por pata, hasta ocho. El margen por pata se escribe como número: 5 significa 5%, más o menos lo que retiene un mercado a dos salidas ajustado.",
      },
      takeaway:
        "La parte que retiene la casa no se suma entre las patas, se compone — cuatro patas a 1.80 parecen cuatro apuestas casi igualadas y son un único evento del 9,53%.",
      example: {
        title: "Cuatro patas a 1.80, una apuesta del 9,53%",
        rows: [
          { label: "Patas", value: "4 × 1.80" },
          { label: "Cuota combinada", value: "10.50" },
          { label: "Probabilidad de que entre", value: "9,53%" },
          { label: "Margen por pata", value: "5%" },
          { label: "Margen compuesto", value: "21,55%" },
        ],
        note:
          "Por separado, cada pata es la apuesta que nadie se para a pensar: 55,56% implícito, 1.80 de premio. Encadenadas, las cuatro exigen un evento del 9,53% — y el 5% que la casa retiene en cada pata se convierte en 1,05⁴ − 1 = 21,55% sobre la combinada. A la apuesta no se le añadió nada salvo más formas de perderla: la cuota subió porque la probabilidad bajó.",
      },
      explainerTitle: "Por qué la cuota crece más rápido que la probabilidad",
      explainer: [
        "**Una combinada es una sola apuesta con varias formas de perder, no varias apuestas.** La cuota combinada es el producto de las patas — 1.80 cuatro veces da 10.4976 — y la probabilidad es el producto de las probabilidades, y ahí la aritmética deja de ser amable: cuatro selecciones que llamarías casi igualadas suman 9,53%. El margen se comporta igual, y esa es la parte que casi nadie cuenta. No se suma pata por pata, se **compone**: una casa que retiene el 5% en cada una de cuatro patas retiene 1,05⁴ − 1 = 21,55% sobre la combinada, y con ocho patas ese mismo 5% por pata ya es 47,75%. El premio parece generoso porque la probabilidad se hundió, no porque alguien pague más por el mismo riesgo.",
        "**Las combinadas son el producto más promocionado de las apuestas y el menos favorable para el cliente**, y son el mismo hecho visto por los dos lados: cuanto mayor es el margen compuesto, más puede permitirse una casa mejorar, asegurar y anunciar ese boleto. Una ventaja fina en una pata no sobrevive a ser multiplicada por tres patas más de margen — las mismas selecciones como simples pagan el margen una vez cada una, la cuádruple lo paga cuatro veces. Y queda lo que la multiplicación asume: **que las patas son independientes**. Dos selecciones del mismo partido están correlacionadas, así que multiplicar es la cuenta equivocada: la victoria local y el gol de su delantero tienden a llegar juntas, de modo que la pareja es más probable de lo que dice el producto, mientras que patas que apenas conviven valen mucho menos. Por eso las casas construyen las combinadas del mismo partido con su propio modelo en lugar de dejar que las montes desde las simples — y por eso esta calculadora es honesta con patas de partidos distintos.",
      ],
      faq: [
        {
          q: "¿Sirve para combinadas del mismo partido?",
          a: "No exactamente. Aquí se multiplica, y multiplicar asume patas independientes. Los resultados dentro de un mismo partido se mueven juntos, así que la probabilidad real de la pareja es distinta — a menudo mayor que el producto — y por eso las casas cotizan esos mercados con su propio modelo y no desde las simples.",
        },
        {
          q: "¿Por qué la probabilidad combinada es tan baja?",
          a: "Porque las probabilidades se multiplican, no se promedian. Cuatro patas al 55,56% dan 9,53%: cada pata que añades hace menos probable el boleto entero, así que una cadena de selecciones plausibles se convierte rápido en una apuesta improbable. La cuota sube para compensar, y con la cuota sube el margen acumulado.",
        },
        {
          q: "¿Qué es exactamente el margen compuesto?",
          a: "La parte que retiene la casa después de que cada pata la haya multiplicado. Introduce lo que te cuesta una pata — alrededor del 5% en un mercado a dos salidas ajustado — y la calculadora la compone: uno más el margen, elevado al número de patas, menos uno. Cuatro patas al 5% cuestan 21,55%, ocho patas 47,75%.",
        },
        {
          q: "¿Son mejores cuatro simples que una cuádruple?",
          a: "Para quien apuesta con ventaja, sí: las mismas cuatro selecciones como simples pagan el margen una vez cada una en lugar de multiplicarlo, y una pata fallada cuesta una apuesta y no el boleto entero. La combinada compra varianza — poca probabilidad de un premio grande — y el precio de esa varianza es el margen compuesto.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "Calculadora de ROI para apuestas — retorno sobre el capital | BetRedge",
      metaDescription:
        "Calculadora de ROI gratuita para apuestas: introduce capital y beneficio para ver el retorno del bankroll, el capital final y por qué el mismo beneficio es un yield del 4%.",
      h1: "Calculadora de ROI",
      lede:
        "Lo que rindió el bankroll en un periodo — y por qué el mismo beneficio de 400 aquí es un ROI del 40% y en la otra página un yield del 4%.",
      labels: {
        inputTitle: "Capital y resultado",
        capital: "Capital",
        profit: "Beneficio",
        resultTitle: "Retorno sobre ese capital",
        roi: "ROI",
        endingCapital: "Capital final",
        hint: "El beneficio va neto y puede ser negativo: -250 es un periodo en pérdidas. El capital es el bankroll que pusiste en riesgo, no el total apostado.",
        verdict:
          "El ROI depende por completo del denominador, así que decláralo: 400 sobre un bankroll de 1.000 es el 40%, ese mismo 400 sobre 10.000 apostados es un yield del 4%. Ninguna de las dos cifras dice mucho sin el periodo y el número de apuestas que hay detrás.",
      },
      takeaway:
        "El ROI dice lo que rindió el bankroll. No dice si la estrategia es buena, porque el mismo 40% puede venir de 200 apuestas o de un sábado afortunado.",
      example: {
        title: "400 de beneficio sobre un bankroll de 1.000",
        rows: [
          { label: "Capital", value: "1.000" },
          { label: "Beneficio del periodo", value: "+400" },
          { label: "ROI", value: "+40,00%" },
          { label: "Capital final", value: "1.400" },
          { label: "El mismo 400 sobre 10.000 apostados", value: "yield +4,00%" },
        ],
        note:
          "Los dos porcentajes describen un único resultado idéntico. Llegar al +40,00% del bankroll costó 200 apuestas de 50 — 10.000 de volumen apostado, diez veces el capital — y el 4,00% de ese volumen es ese mismo 400. Gira el bankroll dos veces en lugar de diez y el yield detrás de un ROI del 40% tendría que ser del 20%, algo que casi nadie sostiene.",
      },
      explainerTitle: "El beneficio medido sobre el dinero en riesgo",
      explainer: [
        "**El ROI es el beneficio dividido por el dinero que pusiste en riesgo**, y toda la dificultad está en la segunda mitad de la frase. Un bankroll de 1.000 que termina la temporada 400 arriba rindió el 40,00%, y esa cifra se puede comparar honestamente con cualquier otra cosa que hubieras hecho con esos 1.000. Lo que no puede describir son las apuestas. Un retorno del 40% no dice cuántas apuestas hicieron falta, en cuánto tiempo, ni cuánto se acercó el saldo a cero por el camino — y esas son las tres cosas que deciden si vuelve a pasar. Así que **declara el denominador antes de citar el número**: bankroll inicial, saldo medio y total depositado dan tres porcentajes distintos con el mismo conjunto de apuestas, y el que queda mejor siempre es el más pequeño.",
        "**El mismo 400 de beneficio es un ROI del 40% y un yield del 4% a la vez**, y saber cuál tienes en la mano es casi todo el valor de las dos páginas. El ROI mide contra el capital, el yield contra el volumen apostado — la suma de cada stake colocado. Nuestro ejemplo llegó ahí con 200 apuestas de 50, así que pasaron 10.000 por el bankroll: diez veces el capital, y el 4,00% de esa cifra es ese 400. **Ese multiplicador es todo el puente entre los dos números**, y explica por qué el ROI solo favorece a quien apuesta mucho. Quien gira un bankroll de 1.000 diez veces con un yield del 4% y quien lo gira dos veces con un yield del 20% declaran los dos un 40%, y solo uno de los dos es repetible. La calidad por apuesta se mide en la calculadora de yield; el ROI guárdalo para lo que sirve de verdad: comparar lo que rindió ese dinero frente a las alternativas.",
      ],
      faq: [
        {
          q: "¿Qué diferencia hay entre ROI y yield?",
          a: "El ROI divide el beneficio por el capital, el yield lo divide por el volumen apostado — la suma de todos los stakes. El mismo 400 de beneficio es el 40,00% de un bankroll de 1.000 y el 4,00% de 10.000 apostados. El ROI dice lo que rindió el dinero, el yield lo buenas que eran las apuestas, y la razón entre ambos es cuántas veces giraste el bankroll.",
        },
        {
          q: "¿Qué capital debo usar como denominador?",
          a: "El que puedas declarar y luego mantener fijo: normalmente el bankroll inicial. Saldo máximo, saldo medio y total depositado producen porcentajes distintos con las mismas apuestas, así que la cifra solo significa algo junto a su definición. Recargar la cuenta a mitad del periodo sin volver a declarar el denominador es la forma más común de inflar un ROI.",
        },
        {
          q: "¿Un ROI del 40% es bueno?",
          a: "Depende del periodo y del número de apuestas. Con una temporada y 200 apuestas es un resultado fuerte pero plausible. Ese mismo 40% en veinte apuestas cae de lleno en el rango que produce el azar por sí solo, y un 40% en una semana suele significar que los stakes eran grandes respecto al bankroll, no que la ventaja lo fuera.",
        },
        {
          q: "¿El ROI puede ser negativo?",
          a: "Sí, y la calculadora lo muestra en lugar de esconderlo: una pérdida de 250 sobre un bankroll de 1.000 es -25,00%. La recuperación no es simétrica — tras un -25% necesitas un +33,33% sobre lo que queda para volver al punto de partida — y por eso el drawdown merece tanta atención como el retorno.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Calculadora de yield para apuestas — beneficio sobre lo apostado | BetRedge",
      metaDescription:
        "Calculadora de yield gratuita: introduce número de apuestas, stake medio y beneficio para obtener el volumen apostado y el yield — y cuántas apuestas hacen falta para que signifique algo.",
      h1: "Calculadora de yield",
      lede:
        "El beneficio medido sobre todo lo que has apostado, no sobre tu bankroll — la única cifra que compara a dos apostantes con dinero distinto.",
      labels: {
        inputTitle: "Apuestas, stake y resultado",
        bets: "Número de apuestas",
        avgStake: "Stake medio",
        profit: "Beneficio",
        resultTitle: "Yield sobre lo apostado",
        turnover: "Volumen apostado",
        yieldPercent: "Yield",
        hint: "El volumen lo calculamos nosotros: apuestas × stake medio. Cuenta el stake de cada apuesta, no el dinero expuesto a la vez. El beneficio va neto y puede ser negativo.",
        verdictNoise:
          "Por debajo de mil apuestas esta cifra es sobre todo ruido. Con stake plano a 2.00, una desviación típica del yield son 7,07 puntos en 200 apuestas y aún 3,16 en 1.000: léela como un rango, no como un resultado.",
        verdictVolume:
          "Pasadas las mil apuestas la cifra empieza a llevar información, pero una desviación típica sigue siendo unos 3,16 puntos a 2.00 — un +4% y un +7% sobre el mismo volumen no son dos niveles de habilidad distintos.",
      },
      takeaway:
        "El yield es la métrica que compara apostantes: un 4% sobre 10.000 apostados vale más que un ROI del 40% conseguido en veinte apuestas.",
      example: {
        title: "200 apuestas de 50, 400 de beneficio",
        rows: [
          { label: "Número de apuestas", value: "200" },
          { label: "Stake medio", value: "50" },
          { label: "Volumen apostado", value: "10.000" },
          { label: "Beneficio", value: "+400" },
          { label: "Yield", value: "+4,00%" },
          { label: "El mismo 400 sobre un bankroll de 1.000", value: "ROI +40,00%" },
        ],
        note:
          "Un único resultado, dos porcentajes igual de honestos: el 4,00% de los 10.000 que pasaron por la casa, el 40,00% de los 1.000 que estuvieron en riesgo. La distancia entre ambos son solo las diez veces que giró el bankroll. Y la muestra importa más que las dos cifras: en 200 apuestas una desviación típica del yield son 7,07 puntos, así que este +4,00% cae dentro del rango que produce sola una serie de caras y cruces.",
      },
      explainerTitle: "La cifra que compara a dos apostantes",
      explainer: [
        "**El yield es el beneficio dividido por el volumen apostado** — la suma de cada stake colocado, no el saldo de la cuenta. Es la cifra que los apostantes se citan entre ellos precisamente porque no depende de cuánto dinero tienen: el 4% es el 4% con stakes de 5 o de 500. **El dato que todos equivocan es el denominador**, y lo equivocan siempre en la misma dirección. El volumen cuenta el stake de cada apuesta en el momento de colocarla, así que 200 apuestas de 50 son 10.000 aunque en un instante dado solo hubiera 50 expuestos, y los 1.000 de bankroll por los que esas apuestas se reciclaron no son el número por el que dividir. Por eso esta página pide el número de apuestas y el stake medio y calcula el volumen delante de ti. Mide el mismo beneficio contra el capital y obtienes el ROI: la calculadora de ROI guarda la otra mitad de la comparación, donde 400 de beneficio son el 40,00% de un bankroll de 1.000 y el 4,00% de 10.000 apostados.",
        "**Un yield por encima del 5% aproximado, sostenido sobre volumen serio, es raro.** Donde existe vive en mercados blandos con límites bajos, y se estrecha cuando crecen los stakes, porque los precios que lo permitían no sobreviven a que los golpeen fuerte. Cualquier cifra de largo plazo muy por encima hay que tratarla como muestra corta, nicho blando o una definición distinta de volumen. Y **por debajo de unos cientos de apuestas el número es ruido, no un resultado**: con stake plano a 2.00 una desviación típica del yield es uno dividido por la raíz del número de apuestas — 7,07 puntos en 200, 3,16 en 1.000 y 2,00 en 2.500. Un +4% de yield solo alcanza dos desviaciones típicas desde cero alrededor de las 2.500 apuestas. Con precios más altos las oscilaciones son mayores: a 3.00 las mismas 200 apuestas llevan una desviación de 10 puntos. Y esa es la lectura honesta de veinte apuestas ganadas: no una ventaja medida, solo una muestra demasiado corta para distinguir.",
      ],
      faq: [
        {
          q: "¿Cómo calculo mi volumen apostado?",
          a: "Sumando el stake de cada apuesta colocada, ganada o perdida. 200 apuestas de 50 son 10.000 de volumen, aunque el bankroll detrás fuera solo 1.000. No uses el neto ni el saldo: el volumen es el dinero que pasó por la casa, contado una vez por apuesta.",
        },
        {
          q: "¿Un yield del 5% es bueno?",
          a: "Sostenido sobre miles de apuestas sí, y está cerca del techo de lo que sobrevive a límites reales. Los yields muy superiores suelen venir de mercados blandos, de una muestra corta o de valor promocional, y tienden a caer cuando los stakes suben, porque los precios que los producían se agotan o se limitan.",
        },
        {
          q: "¿Cuántas apuestas necesito para que mi yield signifique algo?",
          a: "Más de las que casi nadie supone. Con stake plano a 2.00 una desviación típica del yield son 7,07 puntos en 200 apuestas, 3,16 en 1.000 y 2,00 en 2.500, así que un +4% solo llega a dos desviaciones desde cero cerca de las 2.500 apuestas. Por debajo de unos cientos, trátalo como un rango.",
        },
        {
          q: "¿Y si mis stakes varían mucho?",
          a: "Entonces apuestas × stake medio es solo una aproximación, y te favorece cuando las victorias cayeron en los stakes grandes. Suma los stakes reales y divide el beneficio por ese total. Si apuestas en unidades, cuenta las unidades: el yield por unidad apostada es la misma cifra y es más fácil mantenerla honesta.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Calculadora de stake — la apuesta para un beneficio objetivo | BetRedge",
      metaDescription:
        "Calculadora de stake gratuita: introduce el precio y el beneficio que quieres y verás el stake necesario, el retorno total y qué parte del bankroll compromete esa apuesta.",
      h1: "Calculadora de stake",
      lede:
        "El stake que exige un beneficio objetivo a un precio dado — y la parte del bankroll que compromete sin decírtelo.",
      labels: {
        inputTitle: "Precio y objetivo",
        odds: "Precio",
        targetProfit: "Beneficio objetivo",
        bankroll: "Bankroll",
        resultTitle: "Lo que cuesta ese objetivo",
        stakeNeeded: "Stake necesario",
        totalReturn: "Retorno total",
        bankrollShare: "Parte del bankroll",
        hint: "El bankroll es lo que convierte el stake en un porcentaje: sin él, el stake es un número sin nada al lado. El precio va en decimal — 2.50, no +150.",
        verdictModest:
          "Este stake compromete menos del 5% del bankroll declarado, y una racha de diez derrotas no acabaría con él. Léelo junto al precio, no solo: el mismo objetivo a un precio más corto pide una apuesta mucho mayor.",
        verdictHeavy:
          "Este stake compromete más del 5% del bankroll declarado en un solo resultado. A ese tamaño una racha de diez derrotas — normal a precios cercanos a 2.00 — se lleva más de la mitad, así que comprueba el número en la calculadora de bankroll antes de apostar.",
      },
      takeaway:
        "Partir del beneficio que quieres es la vía más rápida para apostar demasiado: la pregunta útil no es cuánto quiero ganar, sino cuánto puedo permitirme perder.",
      example: {
        title: "Querer 100 de beneficio a 2.50",
        rows: [
          { label: "Precio", value: "2.50" },
          { label: "Beneficio objetivo", value: "100" },
          { label: "Stake necesario", value: "66,67" },
          { label: "Retorno total", value: "166,67" },
          { label: "Parte de un bankroll de 1.000", value: "6,67%" },
        ],
        note:
          "Ese mismo 100 cuesta 25,00 a 5.00 y 400,00 a 1.25 — el objetivo no se movió, se movió el precio. Y 66,67 sobre un bankroll de 1.000 es exactamente el Kelly completo de quien cree que el resultado ocurre el 44% de las veces, cuando 2.50 empata al 40%. El deseo ya contiene una estimación de probabilidad con una ventaja del +10%, solo que sin declarar.",
      },
      explainerTitle: "Razonar hacia atrás desde un número que elegiste tú",
      explainer: [
        "La aritmética es la mitad fácil. Una apuesta devuelve el stake más stake × (precio − 1), así que **el stake que exige un objetivo es el objetivo dividido por el precio menos uno** — 100 a 2.50 pide 66,67, y el boleto vuelve como 166,67. Lo que hace útil esta página es el segundo efecto: **cuanto más corto el precio, mayor la apuesta que exige el mismo deseo**. Ese 100 cuesta 25,00 a 5.00, 66,67 a 2.50, 100,00 a 2.00 y 400,00 a 1.25. Entre esas cuatro líneas tu opinión no cambió nada, y el dinero en riesgo se movió dieciséis veces. Por eso la calculadora pide un bankroll que en rigor no necesita: 66,67 no es grande ni pequeño hasta que sabes que es el 6,67% de todo lo que has apartado.",
        "**Razonar desde el beneficio que quieres es el camino más rápido a un stake demasiado grande**, y falla de una forma concreta. Pierdes la primera y el objetivo crece en silencio para cubrirla: querer otros 100 después de dejar 66,67 significa pedir 166,67, que a 2.00 exige un stake de 166,67, y si también cae, la petición siguiente es 476,19 a 1.70. Tres apuestas después, 709,52 de un bankroll de 1.000 han quedado expuestos para ganar los 100 iniciales, y el precio se acortó cada vez porque los precios cortos parecen más seguros. **La apuesta crece justo cuando el motivo para hacerla se debilita.** La versión honesta de este cálculo va al revés, de lo que puedes perder a lo que puedes apostar, y es la calculadora del criterio de Kelly: allí el tamaño nace de una ventaja medida, no de una cifra que elegiste. Y nuestro número tampoco es casualidad — 66,67 sobre 1.000 es exactamente lo que el Kelly completo recomienda a 2.50 a quien cree en el 44%, frente al 40% que implica el precio. Si no defenderías ese 44%, el stake nunca fue sobre la apuesta.",
      ],
      faq: [
        {
          q: "¿Cómo se calcula el stake para un beneficio objetivo?",
          a: "Divide el beneficio que quieres por el precio menos uno. A 2.50 el retorno neto por unidad apostada es 1,50, así que 100 de beneficio piden 100 / 1,50 = 66,67 de stake y pagan 166,67 en total. A 2.00 el retorno neto es 1,00, y por eso allí el stake y el objetivo son el mismo número.",
        },
        {
          q: "¿Por qué la calculadora pide mi bankroll?",
          a: "Porque el stake por sí solo no dice nada. 66,67 es un error de redondeo para un apostante y un tercio de la cuenta para otro, y la cifra que decide cuál de los dos es la parte del bankroll — aquí el 6,67%. Deja el campo vacío y el stake sigue funcionando; el porcentaje pasa a ser un guion, que es honesto, porque esa suposición es tuya y no nuestra.",
        },
        {
          q: "¿Uso esta o el criterio de Kelly?",
          a: "Usa esta para ponerle precio a un deseo y Kelly para dimensionar una apuesta. Esta página parte de un número que elegiste y calcula lo que cuesta; la calculadora del criterio de Kelly parte de una ventaja que has medido y calcula lo que el bankroll puede soportar. Cuando las dos no coinciden, la que hay que descartar es la que no consultó tu estimación de probabilidad.",
        },
        {
          q: "¿Perseguir una pérdida con un stake mayor tiene sentido alguna vez?",
          a: "No con esta aritmética. Cada petición de recuperación es mayor que la anterior, y suele colocarse a un precio más corto porque los precios cortos parecen más seguros, así que el stake crece mientras la ventaja se encoge. Las reglas de bankroll existen para que el próximo stake sea independiente del último resultado: fija la unidad como porcentaje del bankroll y la secuencia no puede desbocarse.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Calculadora de bankroll — unidad, drawdown y derrotas hasta la ruina | BetRedge",
      metaDescription:
        "Calculadora de bankroll gratuita: fija la banca y la unidad y verás el stake por apuesta, lo que cuesta una mala racha, el drawdown que deja y cuántas derrotas cubre.",
      h1: "Calculadora de bankroll",
      lede:
        "Lo que compromete de verdad una unidad en porcentaje: el stake por apuesta, el coste de una mala racha y cuántas derrotas seguidas sobrevive la banca.",
      labels: {
        inputTitle: "Banca y regla",
        bankroll: "Bankroll",
        unitPercent: "Unidad (%)",
        losingStreak: "Mala racha",
        resultTitle: "Lo que cuesta la regla",
        unit: "Stake por apuesta",
        streakLoss: "Coste de la racha",
        drawdown: "Drawdown",
        betsToRuin: "Derrotas hasta la ruina",
        hint: "Los porcentajes se escriben como números: 2 significa el 2% del bankroll por apuesta. La mala racha es un recuento de apuestas, así que solo números enteros — es la racha que quieres sobrevivir, no una predicción.",
        verdictSafe:
          "Al 5% por unidad o por debajo, la racha que has declarado deja el bankroll todavía operativo. Una racha de diez alcanza al 38,54% de los apostantes en 1.000 apuestas a cuota par, así que un plan que solo aguanta si no la encuentras no es un plan.",
        verdictAggressive:
          "Por encima del 5% por unidad la mala racha normal acaba con la cuenta: diez derrotas se llevan la mitad del bankroll o más, y desde la mitad haría falta un +100,00% para volver. Como una racha de diez llega en 1.000 apuestas al 38,54% de los apostantes, esto es apostar a no encontrarla.",
      },
      takeaway:
        "El porcentaje por unidad no es una preferencia. Es tu decisión sobre cuánto puede durar la peor mala racha antes de que estés fuera del juego.",
      example: {
        title: "Una banca de 2.000 al 2% por apuesta",
        rows: [
          { label: "Bankroll", value: "2.000" },
          { label: "Unidad", value: "2%" },
          { label: "Stake por apuesta", value: "40,00" },
          { label: "Diez derrotas seguidas", value: "400,00" },
          { label: "Drawdown", value: "20,00%" },
          { label: "Derrotas hasta la ruina", value: "50" },
        ],
        note:
          "Ese agujero del 20,00% pide un +25,00% sobre lo que queda para volver a 2.000. Sube la unidad al 5% y esas mismas diez derrotas cuestan 1.000 — un drawdown del 50,00% que exige un +100,00% para recuperarse, con la banca cubriendo 20 derrotas seguidas en vez de 50. Tres puntos de regla, y la racha que sobrevives se reduce a menos de la mitad.",
      },
      explainerTitle: "La regla que decide cuánta mala racha sobrevives",
      explainer: [
        "**Una unidad es un porcentaje del bankroll, no una cantidad**, y la diferencia solo aparece cuando las cosas van mal. Apuesta 40 fijos para siempre y una banca caída a 1.000 está apostando el 4% en lugar del 2%: la regla se aprieta justo cuando debería aflojarse. Recalcula la unidad sobre el saldo actual y cada derrota hace más pequeño el stake siguiente, y eso es lo que impide que una mala racha termine el trabajo. La asimetría de fondo es toda la razón para preocuparse — **perder el 20% exige un +25,00% para recuperarse, perder el 50% exige un +100,00% y perder el 80% exige un +400,00%.** En la segunda mitad de esos pares no hay nada simétrico con la primera, y ninguna ventaja es lo bastante grande para convertir un +400,00% en un plan en vez de una esperanza. Una banca de 2.000 al 2% apuesta 40 por jugada, absorbe diez derrotas seguidas por 400,00 y sale con un −20,00% — habiendo usado diez de las 50 derrotas consecutivas que ese stake puede sobrevivir.",
        "**Una racha de diez derrotas a cuotas cercanas a 2.00 es normal, no mala suerte**, y este es el número que lo demuestra. A cuota par una sola secuencia de diez tiene una probabilidad del 0,098% — una entre 1.024 — que se lee como nunca hasta que cuentas cuántas secuencias contiene una temporada. En 1.000 apuestas la probabilidad de encontrar al menos una racha de diez o más es **38,54%**; a 2.10, donde quien no tiene ventaja gana el 47,62% de las veces, es **52,31%** — mejor que lanzar una moneda. En 500 apuestas esas dos cifras son 21,45% y 30,73%, y la racha más larga que esperar en 1.000 apuestas a cuota par es de unas diez, porque crece con el logaritmo en base dos del número de apuestas. La racha no es la cola de la distribución, es su centro, así que **una unidad por encima del 5% es apostar a no encontrar el caso ordinario**: al 5% esas diez derrotas se llevan la mitad de la banca, al 10% se la llevan entera. Cuando la ventaja está medida y no supuesta, la calculadora del criterio de Kelly dimensiona la unidad desde la ventaja misma — lee ese número como un techo y esta página como el suelo debajo.",
      ],
      faq: [
        {
          q: "¿Qué tamaño de unidad debo usar?",
          a: "Entre el uno y el dos por ciento del bankroll por apuesta es el rango habitual del stake plano, y por encima del cinco por ciento la mala racha normal se convierte en un evento que cierra la cuenta. La forma honesta de elegir es al revés: decide la mala racha que quieres sobrevivir, lee el drawdown que te da esta calculadora y pregúntate si después seguirías apostando igual.",
        },
        {
          q: "¿Por qué las derrotas hasta la ruina son un número entero?",
          a: "Porque cuentan apuestas, y una fracción de apuesta no es una apuesta. Una banca de 1.000 al 3% da una unidad de 30, es decir 33 derrotas y un tercio — así que la respuesta es 33, redondeada a la baja, porque la banca ya no cubre la siguiente completa. Redondear al alza prometería una apuesta para la que el dinero no existe.",
        },
        {
          q: "¿Diez derrotas seguidas son de verdad normales?",
          a: "Sí, y la aritmética no está ni cerca. Una sola secuencia de diez derrotas a cuota par es un evento del 0,098%, pero en 1.000 apuestas hay secuencias suficientes para que la probabilidad de encontrar al menos una sea 38,54%, que sube al 52,31% a 2.10, donde quien no tiene ventaja gana el 47,62% de las veces. Planifícala en vez de que te sorprenda.",
        },
        {
          q: "¿Uso esta o el criterio de Kelly?",
          a: "Usa esta cuando no tengas una ventaja medida, que es casi siempre: una unidad en porcentaje no pide estimaciones de probabilidad y su peor caso se conoce por adelantado. La calculadora del criterio de Kelly es la herramienta correcta cuando puedes defender una probabilidad, y suele recomendar más que un 2% plano. Tratar su respuesta como techo y la regla plana como suelo mantiene honestas a las dos.",
        },
      ],
    },
  },
};

export default es;
