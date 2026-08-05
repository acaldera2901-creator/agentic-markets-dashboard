// lib/tools/copy/es.ts (#TOOLS-HUB-0805)
// Español. Keywords locales: "conversor de cuotas", "calculadora de valor
// esperado", "criterio de Kelly", "margen de la casa de apuestas".

import type { ToolsCopy } from "./types";

const es: ToolsCopy = {
  hub: {
    metaTitle: "Herramientas gratis de apuestas — cuotas, EV, Kelly y margen | BetRedge",
    metaDescription:
      "Cinco calculadoras gratuitas: convierte cuotas en cualquier formato, quita el margen de la casa, calcula el valor esperado y dimensiona la apuesta con Kelly. Sin registro.",
    h1: "Herramientas gratuitas de apuestas",
    lede:
      "Los cinco cálculos que se hacen antes de apostar: cuotas convertidas, margen retirado, apuesta dimensionada. Gratis y sin cuenta.",
    cardCta: "Abrir la herramienta",
    intro: [
      "Toda apuesta es una comparación entre un precio y una probabilidad. Estas cinco calculadoras hacen esa comparación bien: traducen las cuotas entre formatos, quitan el margen de la casa para mostrar la línea justa, convierten una estimación de probabilidad en valor esperado y dimensionan la apuesta para que una mala racha no acabe con el bankroll.",
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
  },
};

export default es;
