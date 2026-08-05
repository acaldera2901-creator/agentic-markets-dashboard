// lib/tools/copy/pt.ts (#TOOLS-HUB-0805)
// Português. Keywords locais: "conversor de odds", "calculadora de valor
// esperado", "critério de Kelly", "margem da casa de apostas".

import type { ToolsCopy } from "./types";

const pt: ToolsCopy = {
  hub: {
    metaTitle: "Ferramentas grátis de apostas — odds, EV, Kelly e margem | BetRedge",
    metaDescription:
      "Cinco calculadoras gratuitas: converte odds em qualquer formato, remove a margem da casa, calcula o valor esperado e dimensiona a aposta com Kelly. Sem registo.",
    h1: "Ferramentas gratuitas de apostas",
    lede:
      "As cinco contas que se fazem antes de apostar: odds convertidas, margem removida, aposta dimensionada. Grátis, sem conta.",
    cardCta: "Abrir a ferramenta",
    intro: [
      "Toda aposta é uma comparação entre um preço e uma probabilidade. Estas cinco calculadoras fazem essa comparação como deve ser: traduzem as odds entre formatos, removem a margem da casa para expor a linha justa, transformam uma estimativa de probabilidade em valor esperado e dimensionam a aposta para que uma série negativa não acabe com a banca.",
      "Funcionam inteiramente no teu navegador: nada é enviado, nada é guardado e não há conta para criar. Usa-as sozinhas, ou usa-as para verificar o que o nosso modelo já publica em cada jogo.",
    ],
  },

  common: {
    backLabel: "Início",
    ctaTitle: "Estas contas fazemos em cada jogo",
    ctaBody:
      "As calculadoras tratam um preço de cada vez. A BetRedge analisa o mercado continuamente, remove a margem, compara com a probabilidade do modelo e mostra onde os dois discordam — futebol e tênis, atualizados todo o dia.",
    ctaButton: "Ver o board de hoje",
    otherTools: "Outras ferramentas gratuitas",
    langLabel: "Idioma",
    free: "Grátis",
    faqTitle: "Perguntas",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Conversor de odds — decimais, fracionárias, americanas e probabilidade | BetRedge",
      metaDescription:
        "Conversor de odds gratuito: escreve um preço em qualquer formato — decimal, fracionário, americano, Hong Kong, Malay ou Indonesian — e lê-o em todos os outros.",
      h1: "Conversor de odds",
      lede:
        "Escreve um preço num formato e lê-o em todos os outros, com a probabilidade que a casa está a declarar.",
      labels: {
        inputTitle: "O teu preço",
        oddsInput: "Odd",
        formatSelect: "Formato",
        resultTitle: "O mesmo preço, em cada formato",
        decimal: "Decimal",
        american: "Americana",
        fractional: "Fracionária",
        hongkong: "Hong Kong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Probabilidade implícita",
        hint: "O decimal também aceita vírgula: 2,50 vale como 2.50.",
      },
      formulaTitle: "Como funciona a conversão",
      formula: [
        "decimal = 1 + (americana / 100)            se a americana for positiva",
        "decimal = 1 + (100 / |americana|)          se a americana for negativa",
        "decimal = 1 + (numerador / denominador)    para as fracionárias",
        "probabilidade implícita = 1 / decimal",
      ],
      explainerTitle: "Ler um preço em qualquer formato",
      explainer: [
        "Uma odd é uma probabilidade vestida de outra forma. A decimal — padrão europeu — indica o retorno total por unidade apostada: 2.50 devolve 2.50 por cada 1 arriscado, aposta incluída. A fracionária, ainda comum nas corridas britânicas, indica o lucro e não o retorno: 3/2 significa três unidades de lucro por cada duas arriscadas, ou seja a mesma 2.50 decimal. A americana diz quanto ganhas apostando 100 (+150) ou quanto tens de arriscar para ganhar 100 (−110). Hong Kong, Malay e Indonesian são os formatos dos mercados asiáticos, e contam porque é muitas vezes lá que estão os preços mais afiados.",
        "O número que vale a pena ler é o último: a probabilidade implícita, que é simplesmente 1 dividido pela odd decimal. Um preço de 2.50 implica 40%. Um de 1.91 — a conhecida −110 — implica 52,38%. É a probabilidade que a casa declara, e é o único número que podes comparar diretamente com a tua própria estimativa. Duas odds em formatos diferentes não são mais fáceis de comparar do que duas probabilidades: primeiro converte, depois discute.",
        "Um limite que este conversor não consegue remover: a probabilidade implícita ainda contém a margem da casa. Soma as probabilidades implícitas de todos os resultados de um mercado e vais passar dos 100% — esse excesso é a margem, e inflaciona cada uma dessas probabilidades. Se queres a opinião honesta do mercado em vez da opinião com acréscimo, passa o mercado pela calculadora de margem e usa as probabilidades justas que devolve.",
      ],
      faq: [
        {
          q: "Em que formato convém trabalhar?",
          a: "Em decimal, salvo motivo em contrário. Multiplicar odds decimais dá diretamente o preço de uma múltipla, e dividir 1 pela odd dá a probabilidade implícita: duas operações incómodas em notação fracionária ou americana.",
        },
        {
          q: "Porque é que −110 dá 1,909090…?",
          a: "Porque 100/110 é uma dízima periódica. Arredondado a duas casas é 1.91, que é o que as casas mostram, mas o conversor mantém a precisão completa internamente para que uma cadeia de cálculos não acumule erro.",
        },
        {
          q: "Qual a diferença entre odds Malay e Indonesian?",
          a: "São espelhos uma da outra. As Malay são positivas abaixo de 2.00 e negativas acima; as Indonesian são positivas acima de 2.00 e negativas abaixo. Expressam o mesmo preço e convertem para a mesma decimal.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Calculadora de margem — overround, payout e odds justas sem margem | BetRedge",
      metaDescription:
        "Calculadora de margem gratuita: introduz as odds de todos os resultados e obtém a margem da casa, a percentagem de payout e as odds justas sem acréscimo.",
      h1: "Calculadora de margem",
      lede:
        "Introduz todos os preços de um mercado e vê quanto a casa retém — mais a linha justa que está por baixo.",
      labels: {
        inputTitle: "O mercado",
        outcome: "Resultado",
        addOutcome: "Adicionar resultado",
        removeOutcome: "Remover",
        resultTitle: "Quanto a casa está a cobrar",
        margin: "Margem da casa",
        payout: "Payout",
        fairOddsTitle: "Linha justa, margem removida",
        fairOdds: "Odd justa",
        fairProbability: "Probabilidade justa",
        impliedProbability: "Probabilidade implícita",
        hint: "Adiciona um resultado para mercados de três vias, ou mais para mercados de vencedor.",
      },
      formulaTitle: "Como se calcula a margem",
      formula: [
        "overround = Σ (1 / oddᵢ)",
        "margem = overround − 1",
        "payout = 1 / overround",
        "probabilidade justaᵢ = (1 / oddᵢ) / overround",
        "odd justaᵢ = 1 / probabilidade justaᵢ",
      ],
      explainerTitle: "A margem é o preço da aposta",
      explainer: [
        "Um mercado de duas vias justo cota ambos os lados a 2.00: as probabilidades implícitas são 50% e 50%, somam exatamente 100% e nenhum lado tem vantagem. Os mercados reais são cotados a 1.91 e 1.91. Essas probabilidades implícitas valem 52,38% cada, somam 104,76%, e os 4,76 pontos percentuais em excesso são a margem da casa — o overround. Qualquer que seja o lado que jogues, estás a pagá-la.",
        "A margem é o número mais útil para decidir onde apostar. O mesmo jogo com 5% de margem e com 2% de margem não é a mesma aposta: a casa mais apertada está a deixar-te cerca de três pontos percentuais de valor esperado com opiniões idênticas. As margens variam muito por mercado: as linhas principais das casas sharp podem ficar abaixo de 2%, enquanto vencedores, mercados de jogadores e apostas especiais chegam habitualmente a 8% ou mais, porque é aí que as casas sabem que os seus preços são menos testados.",
        "Remover a margem dá a linha justa, a chamada no-vig. Esta calculadora fá-lo proporcionalmente: cada probabilidade implícita é dividida pela sua soma, voltando a somar exatamente 100%, e as odds justas são os recíprocos. Essa linha é o mais próximo da estimativa honesta do mercado, e é a referência da calculadora de EV: uma aposta só tem valor esperado positivo se a tua probabilidade superar a justa, não simplesmente a cotada.",
        "Um limite declarado: a remoção proporcional distribui a margem de forma uniforme pelos resultados, e as casas reais não fazem isso. Carregam mais margem nos resultados improváveis, porque é aí que se concentra o dinheiro recreativo. Num mercado com um favorito claro e um azarão distante, este método subestima um pouco a probabilidade real do favorito. Nas linhas principais a distorção é pequena; nos vencedores tipo lotaria, trata a linha justa como estimativa, não como medição.",
      ],
      faq: [
        {
          q: "Que margem é aceitável?",
          a: "Nas linhas principais de futebol e tênis, abaixo de 3% é sharp, entre 4% e 5% é normal numa casa generalista, acima de 7% estás a pagar muito pelo direito de ter uma opinião. Compara o mesmo mercado em várias casas antes de decidir.",
        },
        {
          q: "Payout e margem são a mesma coisa?",
          a: "São duas leituras do mesmo número. Uma margem de 5,26% corresponde a um payout de 95%: a casa espera devolver 95 de cada 100 apostados em todo o mercado. O payout é o número mais prático para comparar casas.",
        },
        {
          q: "Porque as probabilidades justas somam exatamente 100%?",
          a: "Porque é essa a definição de remover a margem. As cotadas somam mais de 100%; dividindo cada uma por esse total, ficam reescaladas até somar um, que é o que um conjunto coerente de probabilidades tem de fazer.",
        },
        {
          q: "Serve para mercados de três vias ou de vencedor?",
          a: "Sim: adiciona tantos resultados quantos o mercado tiver. A matemática é idêntica para qualquer número de resultados, desde que introduzas todos. Deixar um de fora subestima a margem.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "Calculadora de valor esperado (EV) — com ou sem linha justa | BetRedge",
      metaDescription:
        "Calculadora de valor esperado gratuita: introduz preço, probabilidade e stake para obter o EV em moeda e em percentagem, ou deduz a probabilidade de uma casa sharp.",
      h1: "Calculadora de valor esperado",
      lede:
        "Quanto vale uma aposta em média: a partir da tua probabilidade, ou da linha de uma casa sharp sem margem.",
      labels: {
        inputTitle: "A aposta",
        modeTitle: "De onde vem a probabilidade",
        modeManual: "Estimativa minha",
        modeSharp: "De uma casa sharp",
        yourOdds: "O teu preço",
        yourProbability: "A tua probabilidade (%)",
        sharpOddsA: "Preço sharp, o teu lado",
        sharpOddsB: "Preço sharp, o outro lado",
        derivedProbability: "Probabilidade justa, margem removida",
        stake: "Stake",
        resultTitle: "Quanto vale a aposta",
        ev: "Valor esperado",
        fairOdds: "Preço de equilíbrio",
        edge: "Vantagem",
        positive: "Valor esperado positivo a este preço.",
        negative: "Valor esperado negativo a este preço.",
        neutral: "Equilíbrio: o preço corresponde exatamente à probabilidade.",
        hint: "As percentagens escrevem-se como números: 55 significa 55%.",
      },
      formulaTitle: "Como se calcula o valor esperado",
      formula: [
        "EV = p × (odd − 1) × stake − (1 − p) × stake",
        "   = (p × odd − 1) × stake",
        "vantagem = p × odd − 1",
        "preço de equilíbrio = 1 / p",
      ],
      explainerTitle: "O que o valor esperado diz de facto",
      explainer: [
        "O valor esperado é o resultado médio de uma aposta se a pudesses repetir um número ilimitado de vezes. Tem duas entradas e nenhuma opinião: o preço que te oferecem e a probabilidade que atribuis ao resultado. Se achas que uma equipa ganha 55% das vezes e alguém te oferece 2.00, a conta é imediata: 55% das vezes ganhas uma unidade, 45% perdes, portanto em média ganhas 0,10 unidades por unidade apostada. É uma vantagem de 10%, e é isso que significa +EV.",
        "O número que decide tudo é a probabilidade, e é aí que a maioria perde em silêncio. Um erro de 5 pontos na estimativa basta para transformar uma vantagem de 4% numa perda de 1%, e as estimativas feitas a olho erram habitualmente muito mais do que 5 pontos. É por isso que existe o segundo modo desta calculadora: em vez de confiar no instinto, toma o preço dos dois lados numa casa sharp, remove a margem e usa a probabilidade justa resultante. Já não estás a perguntar se és mais esperto que o mercado, mas se a casa onde jogas é mais lenta que a casa mais sharp.",
        "Lê o EV como uma taxa, não como uma promessa. Uma aposta com 4% de valor esperado não devolve nada numa ocasião concreta: ganha ou perde. Esses 4% aparecem apenas ao longo de centenas de apostas independentes, e só se a probabilidade estivesse certa. No curto prazo a variância é muito maior do que a vantagem, e é precisamente por isso que o tamanho do stake conta tanto como a vantagem: é a função do critério de Kelly.",
      ],
      faq: [
        {
          q: "Como obtenho uma probabilidade fiável?",
          a: "De um modelo construído com dados, ou do próprio mercado. A linha justa de uma casa sharp — os seus preços sem margem — é uma referência difícil de superar apenas com julgamento, e é consultável de graça.",
        },
        {
          q: "Uma aposta com EV positivo é uma boa aposta?",
          a: "É condição necessária, não suficiente. Pode ter valor esperado positivo e continuar a ser um erro se o stake for demasiado grande para a banca, se a vantagem estiver dentro do teu erro de estimativa ou se o mercado se mover contra antes do início.",
        },
        {
          q: "Porque pede os dois lados do mercado sharp?",
          a: "Porque a margem não se pode remover de um preço só. Só é visível somando as probabilidades implícitas de todos os resultados: é o segundo preço que torna a probabilidade justa calculável.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Calculadora do critério de Kelly — stake ótimo por vantagem e banca | BetRedge",
      metaDescription:
        "Calculadora do critério de Kelly gratuita: introduz preço, probabilidade e banca para o stake que maximiza o crescimento a longo prazo — Kelly completo, meio ou um quarto.",
      h1: "Calculadora do critério de Kelly",
      lede:
        "O stake que faz crescer mais depressa uma banca no longo prazo — e por que quase todos deveriam apostar menos do que ele indica.",
      labels: {
        inputTitle: "A aposta e a banca",
        odds: "Preço",
        probability: "A tua probabilidade (%)",
        bankroll: "Banca",
        fractionTitle: "Fração de Kelly",
        fractionFull: "Completo",
        fractionHalf: "Meio",
        fractionQuarter: "Um quarto",
        resultTitle: "Stake recomendado",
        stake: "Stake",
        stakePercent: "Parte da banca",
        edge: "Vantagem",
        fullKelly: "Kelly completo",
        growth: "Crescimento esperado por aposta",
        noEdge: "Sem vantagem a este preço: o stake ótimo é zero.",
        hint: "As percentagens escrevem-se como números: 55 significa 55%.",
      },
      formulaTitle: "Como se calcula o stake de Kelly",
      formula: [
        "b = odd − 1",
        "f* = (p × b − (1 − p)) / b = (p × odd − 1) / b",
        "stake = banca × f* × fração",
        "crescimento esperado = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Dimensionar a aposta para a má série não a encerrar",
      explainer: [
        "O critério de Kelly responde a uma pergunta que o valor esperado ignora: dada uma vantagem, quanto arriscar de facto? Aposta pouco demais e uma vantagem real capitaliza-se demasiado devagar para contar. Aposta demasiado e a matemática vira-se contra ti: uma banca que reduz a metade precisa de +100% para recuperar, portanto stakes grandes destroem o crescimento mesmo quando cada aposta individual é favorável. Kelly encontra a fração que maximiza a taxa de crescimento no longo prazo, e resulta ser a vantagem dividida pela odd líquida.",
        "O resultado escala com a vantagem, não com a convicção. Uma vantagem de 10% à odd 2.00 pede 10% da banca; a mesma vantagem a 5.00 pede apenas 2,5%, porque um preço mais longo significa séries negativas mais longas e um percurso mais acidentado. É por isso que a fórmula é útil mesmo para quem nunca a segue à letra: diz que preço e vantagem juntos decidem o stake, e que uma sensação forte não é uma entrada.",
        "Quase ninguém deveria jogar Kelly completo. A fórmula assume que a tua probabilidade é exata, e nunca é. Dá-lhe uma vantagem sobrestimada e recomendará com entusiasmo um stake demasiado grande para a vantagem que tens de verdade: a forma mais rápida de perder uma banca tendo razão em média. O meio Kelly abdica de um quarto do crescimento teórico e reduz a volatilidade quase a metade; um quarto de Kelly é o que muitos profissionais com modelos reais usam de facto. Se as tuas probabilidades vêm do julgamento e não dos dados, um quarto de Kelly não é prudência: é realismo.",
        "Quando o preço não oferece vantagem, o stake correto é zero, e esta calculadora di-lo em vez de devolver um número negativo disfarçado de conselho. Uma fração de Kelly negativa significa que a aposta valeria do outro lado, se a encontrares a esse preço: nunca significa apostar menos neste.",
      ],
      faq: [
        {
          q: "Kelly completo, meio ou um quarto?",
          a: "Meio ou um quarto para quase todos. O completo só é ótimo se a estimativa de probabilidade for exata, e o erro de estimativa faz muito mais dano por excesso de stake do que ajuda por defeito. O Kelly fracionário troca algum crescimento por muita sobrevivência.",
        },
        {
          q: "O que é o crescimento esperado por aposta?",
          a: "O crescimento logarítmico médio da banca para uma aposta a esse stake. É pequeno por construção — um valor de 0,005 equivale a meio ponto percentual de crescimento composto por aposta — e é a quantidade que Kelly maximiza.",
        },
        {
          q: "E se tenho várias apostas ao mesmo tempo?",
          a: "O Kelly de aposta única aposta demasiado quando as apostas correm em paralelo, sobretudo se estão correlacionadas. Como regra prática, divide o total pelas posições simultâneas e trata as apostas correlacionadas como uma só.",
        },
        {
          q: "Porque mostra zero se acho que tenho vantagem?",
          a: "Porque ao preço introduzido a tua probabilidade não passa o ponto de equilíbrio. Compara o preço com 1 dividido pela tua probabilidade: se o preço for mais baixo, não há vantagem para apostar.",
        },
      ],
      caveat:
        "O critério de Kelly maximiza o crescimento no longo prazo, não o conforto. Mesmo com o stake correto, quedas de 30% ou mais são normais, e a fórmula assume que a tua estimativa de probabilidade é precisa: se for otimista, Kelly apostará sistematicamente a mais e a banca pode ser perdida. Nunca apostes dinheiro de que precisas.",
    },

    "probability-calculator": {
      metaTitle: "Calculadora de probabilidade — odds, equilíbrio e múltiplas | BetRedge",
      metaDescription:
        "Calculadora de probabilidade gratuita para apostas: converte probabilidade e odd, encontra a probabilidade de equilíbrio que um preço exige e combina as pernas de uma múltipla.",
      h1: "Calculadora de probabilidade",
      lede:
        "Transforma probabilidades em preços e ao contrário, vê o que um preço te exige e descobre quanto vale realmente uma múltipla.",
      labels: {
        inputTitle: "Probabilidade e preço",
        modeTitle: "O que tens?",
        modeProbability: "Uma probabilidade",
        modeOdds: "Um preço",
        probability: "Probabilidade (%)",
        odds: "Odd decimal",
        breakEven: "Probabilidade de equilíbrio",
        fairOdds: "Preço justo",
        parlayTitle: "Múltipla",
        leg: "Perna",
        addLeg: "Adicionar perna",
        removeLeg: "Remover",
        parlayProbability: "Probabilidade combinada",
        parlayOdds: "Odd combinada",
        resultTitle: "Resultados",
        hint: "Um preço e a sua probabilidade de equilíbrio são o mesmo número lido dos dois lados.",
      },
      formulaTitle: "Como se calculam as probabilidades",
      formula: [
        "odd = 1 / probabilidade",
        "probabilidade = 1 / odd",
        "probabilidade de equilíbrio = 1 / odd",
        "probabilidade da múltipla = p₁ × p₂ × … × pₙ",
        "odd da múltipla = odd₁ × odd₂ × … × oddₙ",
      ],
      explainerTitle: "Primeiro a probabilidade, depois o preço",
      explainer: [
        "Todo preço é uma afirmação sobre probabilidade, e a conversão entre os dois é uma divisão: uma probabilidade de 40% é um preço de 2.50, e um preço de 2.50 é uma probabilidade de 40%. Fazer essa conversão antes de apostar muda a pergunta de «gosto desta aposta?» para «acho que este resultado acontece mais de 40% das vezes?», que é uma pergunta em que se pode estar errado e, por isso, uma pergunta que vale a pena fazer.",
        "O mesmo número, lido do lado do preço, é a probabilidade de equilíbrio: a possibilidade mínima que um resultado precisa para a aposta ser neutra. Um preço de 1.75 exige 57,1%. Um de 1.50 exige 66,7%. Os preços longos exigem muito pouco — 15.00 pede apenas 6,7% — e é por isso que parecem baratos e por isso que as casas carregam ali a margem. A probabilidade de equilíbrio é o teste honesto de uma aposta: se não consegues argumentar que o resultado a supera, o preço não é generoso, é correto.",
        "As múltiplas são onde a probabilidade se torna contraintuitiva. Pernas independentes multiplicam-se: três apostas que avalias a 50% cada combinam a 12,5%, não a algo tranquilizadoramente próximo de metade. Quatro pernas a 60% dão 12,96%. A odd combinada multiplica-se do mesmo modo, e aí está a armadilha: uma múltipla a 15.00 parece uma pechincha até notares que exige um evento de 6,7%, e que a margem da casa foi aplicada a cada perna e depois composta. Uma múltipla de quatro pernas com 5% de margem cada arrasta quase 21% de margem total.",
        "Uma suposição a ter presente: esta calculadora multiplica, portanto assume pernas independentes. Dois resultados do mesmo jogo — a vitória de uma equipa e o gol do seu atacante — são correlacionados, e multiplicar as suas probabilidades subestima a probabilidade real de ambos acontecerem. As múltiplas do mesmo jogo são cotadas à parte pelas casas precisamente porque essa correlação é difícil de calcular: trata o número aqui como um mínimo, não como uma resposta.",
      ],
      faq: [
        {
          q: "O que é a probabilidade de equilíbrio?",
          a: "A possibilidade que um resultado deve ter para uma aposta a esse preço ser neutra no longo prazo. É 1 dividido pela odd decimal, e é a fasquia que a tua estimativa tem de superar para a aposta fazer sentido.",
        },
        {
          q: "Porque a probabilidade da minha múltipla é tão baixa?",
          a: "Porque as probabilidades multiplicam-se. Cada perna adicionada torna o conjunto menos provável, e uma cadeia de pernas plausíveis torna-se rapidamente numa aposta improvável. A odd sobe em consequência, mas também sobe a margem acumulada.",
        },
        {
          q: "Serve para múltiplas do mesmo jogo?",
          a: "Não exatamente. Multiplicar assume pernas independentes, e os resultados dentro do mesmo jogo normalmente não são. Com pernas correlacionadas a probabilidade real é diferente — muitas vezes maior que o produto — e é por isso que as casas cotam esses mercados à parte.",
        },
        {
          q: "A probabilidade implícita de um preço é a probabilidade real?",
          a: "Não. Contém ainda a margem da casa, portanto é sistematicamente maior que a estimativa honesta do mercado. Usa a calculadora de margem para a remover antes de a comparares com o teu número.",
        },
      ],
    },
  },
};

export default pt;
