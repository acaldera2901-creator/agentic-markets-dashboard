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
      formulaTitle: "Cómo funciona la conversión",
      formula: [
        "decimal = 1 + (americana / 100)            si la americana es positiva",
        "decimal = 1 + (100 / |americana|)          si la americana es negativa",
        "decimal = 1 + (numerador / denominador)    para las fraccionarias",
        "probabilidad implícita = 1 / decimal",
      ],
      explainerTitle: "Leer un precio en cualquier formato",
      explainer: [
        "Una cuota es una probabilidad vestida de otra manera. La decimal — el estándar europeo — indica el retorno total por unidad apostada: 2.50 devuelve 2.50 por cada 1 arriesgado, apuesta incluida. La fraccionaria, aún habitual en las carreras británicas, indica el beneficio y no el retorno: 3/2 significa tres unidades de beneficio por cada dos arriesgadas, es decir la misma 2.50 decimal. La americana dice cuánto ganas apostando 100 (+150) o cuánto debes arriesgar para ganar 100 (−110). Hong Kong, Malay e Indonesian son los formatos de los mercados asiáticos, y cuentan porque suele ser ahí donde están los precios más afilados.",
        "El número que merece la pena leer es el último: la probabilidad implícita, que es simplemente 1 dividido por la cuota decimal. Un precio de 2.50 implica el 40%. Uno de 1.91 — la conocida −110 — implica el 52,38%. Es la probabilidad que declara la casa, y es el único número que puedes comparar directamente con tu propia estimación. Dos cuotas en formatos distintos no son más fáciles de comparar que dos probabilidades: primero convierte, después discute.",
        "Un límite que este conversor no puede quitarte: la probabilidad implícita todavía contiene el margen de la casa. Suma las probabilidades implícitas de todos los resultados de un mercado y obtendrás más del 100% — ese exceso es el margen, e infla cada una de esas probabilidades. Si quieres la opinión honesta del mercado en lugar de la opinión con recargo, pasa el mercado por la calculadora de margen y usa las probabilidades justas que devuelve.",
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
      formulaTitle: "Cómo se calcula el margen",
      formula: [
        "overround = Σ (1 / cuotaᵢ)",
        "margen = overround − 1",
        "payout = 1 / overround",
        "probabilidad justaᵢ = (1 / cuotaᵢ) / overround",
        "cuota justaᵢ = 1 / probabilidad justaᵢ",
      ],
      explainerTitle: "El margen es el precio de la apuesta",
      explainer: [
        "Un mercado de dos vías justo cotiza ambos lados a 2.00: las probabilidades implícitas son 50% y 50%, suman exactamente 100% y ningún lado tiene ventaja. Los mercados reales se cotizan a 1.91 y 1.91. Esas probabilidades implícitas valen 52,38% cada una, suman 104,76%, y los 4,76 puntos porcentuales de exceso son el margen de la casa — el overround. Juegues el lado que juegues, lo estás pagando.",
        "El margen es el número más útil para decidir dónde apostar. El mismo partido con un margen del 5% y con un margen del 2% no es la misma apuesta: la casa más ajustada te está dejando unos tres puntos porcentuales de valor esperado con idénticas opiniones. Los márgenes varían mucho según el mercado: las líneas principales de las casas sharp pueden estar por debajo del 2%, mientras que los mercados a ganador, los de jugadores y las apuestas especiales llegan habitualmente al 8% o más, porque ahí las casas saben que sus precios se comprueban menos.",
        "Quitar el margen da la línea justa, la llamada no-vig. Esta calculadora lo hace de forma proporcional: cada probabilidad implícita se divide por su suma, así vuelven a sumar exactamente 100%, y las cuotas justas son sus recíprocos. Esa línea es lo más cercano a la estimación honesta del mercado, y es la referencia de la calculadora de EV: una apuesta solo tiene valor esperado positivo si tu probabilidad supera la justa, no simplemente la cotizada.",
        "Un límite declarado: el reparto proporcional distribuye el margen de forma uniforme entre los resultados, y las casas reales no lo hacen. Cargan más margen en los resultados improbables, porque ahí se concentra el dinero recreativo. En un mercado con un favorito claro y un outsider lejano, este método subestima algo la probabilidad real del favorito. En las líneas principales la distorsión es pequeña; en los mercados a ganador tipo lotería, trata la línea justa como una estimación, no como una medición.",
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
      formulaTitle: "Cómo se calcula el valor esperado",
      formula: [
        "EV = p × (cuota − 1) × stake − (1 − p) × stake",
        "   = (p × cuota − 1) × stake",
        "ventaja = p × cuota − 1",
        "precio de equilibrio = 1 / p",
      ],
      explainerTitle: "Qué dice realmente el valor esperado",
      explainer: [
        "El valor esperado es el resultado medio de una apuesta si pudieras repetirla un número ilimitado de veces. Tiene dos entradas y ninguna opinión: el precio que te ofrecen y la probabilidad que le das al resultado. Si crees que un equipo gana el 55% de las veces y alguien te ofrece 2.00, la cuenta es inmediata: el 55% de las veces ganas una unidad, el 45% la pierdes, así que de media ganas 0,10 unidades por unidad apostada. Es una ventaja del 10%, y eso es lo que significa +EV.",
        "El número que decide todo es la probabilidad, y ahí es donde la mayoría pierde en silencio. Un error de 5 puntos en la estimación basta para convertir una ventaja del 4% en una pérdida del 1%, y las estimaciones hechas a ojo fallan habitualmente mucho más de 5 puntos. Por eso existe el segundo modo de esta calculadora: en lugar de fiarte del instinto, toma el precio de los dos lados en una casa sharp, quita el margen y usa la probabilidad justa resultante. Ya no te preguntas si eres más listo que el mercado, sino si la casa donde juegas es más lenta que la casa más sharp.",
        "Lee el EV como una tasa, no como una promesa. Una apuesta con un 4% de valor esperado no devuelve nada en una ocasión concreta: gana o pierde. Ese 4% aparece solo a lo largo de cientos de apuestas independientes, y solo si la probabilidad era correcta. A corto plazo la varianza es mucho mayor que la ventaja, y precisamente por eso el tamaño del stake importa tanto como la ventaja: de eso se ocupa el criterio de Kelly.",
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
      formulaTitle: "Cómo se calcula el stake de Kelly",
      formula: [
        "b = cuota − 1",
        "f* = (p × b − (1 − p)) / b = (p × cuota − 1) / b",
        "stake = bankroll × f* × fracción",
        "crecimiento esperado = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Dimensionar la apuesta para que la mala racha no la termine",
      explainer: [
        "El criterio de Kelly responde a una pregunta que el valor esperado ignora: dada una ventaja, ¿cuánto arriesgar realmente? Apuesta demasiado poco y una ventaja real se capitaliza demasiado despacio para importar. Apuesta demasiado y las matemáticas se giran en contra: un bankroll que se reduce a la mitad necesita un +100% para recuperarse, así que los stakes grandes destruyen el crecimiento incluso cuando cada apuesta individual es favorable. Kelly encuentra la fracción que maximiza la tasa de crecimiento a largo plazo, y resulta ser la ventaja dividida por la cuota neta.",
        "El resultado escala con la ventaja, no con la confianza. Una ventaja del 10% a cuota 2.00 pide el 10% del bankroll; la misma ventaja a 5.00 pide solo el 2,5%, porque un precio más largo significa rachas negativas más largas y un camino más accidentado. Por eso la fórmula es útil incluso si nunca la sigues al pie de la letra: dice que precio y ventaja juntos deciden el stake, y que una fuerte sensación no es una entrada.",
        "Casi nadie debería apostar Kelly completo. La fórmula asume que tu probabilidad es exacta, y nunca lo es. Dale una ventaja sobrestimada y recomendará con entusiasmo un stake demasiado grande para la ventaja que tienes de verdad: la forma más rápida de perder un bankroll teniendo razón de media. El medio Kelly renuncia a una cuarta parte del crecimiento teórico y reduce la volatilidad casi a la mitad; el cuarto de Kelly es lo que muchos profesionales con modelos reales usan de hecho. Si tus probabilidades vienen del criterio y no de los datos, el cuarto de Kelly no es prudencia: es realismo.",
        "Cuando el precio no ofrece ventaja, el stake correcto es cero, y esta calculadora lo dice en lugar de devolver un número negativo disfrazado de consejo. Una fracción de Kelly negativa significa que la apuesta valdría en el otro lado, si la encuentras a ese precio: nunca significa apostar menos en este.",
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
      formulaTitle: "Cómo se calculan las probabilidades",
      formula: [
        "cuota = 1 / probabilidad",
        "probabilidad = 1 / cuota",
        "probabilidad de equilibrio = 1 / cuota",
        "probabilidad de la combinada = p₁ × p₂ × … × pₙ",
        "precio de la combinada = cuota₁ × cuota₂ × … × cuotaₙ",
      ],
      explainerTitle: "Primero la probabilidad, después el precio",
      explainer: [
        "Todo precio es una afirmación sobre la probabilidad, y la conversión entre ambos es una división: una probabilidad del 40% es un precio de 2.50, y un precio de 2.50 es una probabilidad del 40%. Hacer esa conversión antes de apostar cambia la pregunta de «¿me gusta esta apuesta?» a «¿creo que este resultado ocurre más del 40% de las veces?», que es una pregunta en la que se puede estar equivocado y por tanto una pregunta que merece hacerse.",
        "El mismo número, leído desde el lado del precio, es la probabilidad de equilibrio: la posibilidad mínima que necesita un resultado para que la apuesta sea neutra. Un precio de 1.75 exige el 57,1%. Uno de 1.50 exige el 66,7%. Los precios largos exigen muy poco — 15.00 pide solo el 6,7% — y por eso parecen baratos y por eso las casas cargan ahí su margen. La probabilidad de equilibrio es la prueba honesta de una apuesta: si no puedes argumentar que el resultado la supera, el precio no es generoso, es correcto.",
        "Las combinadas son donde la probabilidad se vuelve contraintuitiva. Las patas independientes se multiplican: tres apuestas que valoras al 50% cada una combinan al 12,5%, no a algo tranquilizadoramente cercano a la mitad. Cuatro patas al 60% dan 12,96%. El precio combinado se multiplica igual, y ahí está la trampa: una combinada a 15.00 parece una ganga hasta que notas que exige un evento del 6,7%, y que el margen de la casa se ha aplicado a cada pata y luego se ha compuesto. Una combinada de cuatro patas al 5% de margen cada una arrastra casi un 21% de margen total.",
        "Una suposición que hay que tener presente: esta calculadora multiplica, así que asume patas independientes. Dos resultados del mismo partido — que gane un equipo y que marque su delantero — están correlacionados, y multiplicar sus probabilidades subestima la probabilidad real de que ocurran ambos. Las combinadas del mismo partido las cotizan las casas por separado precisamente porque esa correlación es difícil de calcular: trata el número de aquí como un mínimo, no como una respuesta.",
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
