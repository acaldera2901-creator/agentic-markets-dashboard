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
      takeaway:
        "Toda odd é uma probabilidade disfarçada. Primeiro converte, depois discute: 2.50 significa que a casa te está a dizer 40%.",
      example: {
        title: "Uma odd, todos os formatos",
        rows: [
          { label: "Escreves", value: "2.50" },
          { label: "Americana", value: "+150" },
          { label: "Fracionária", value: "3/2" },
          { label: "Hong Kong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Probabilidade implícita", value: "40,00%" },
        ],
        note:
          "Muda uma e as outras seguem. Atenção ao arredondamento: a conhecida −110 em decimal é 1.9091 e implica 52,38%, enquanto um 1.91 mostrado no ecrã implica 52,36% — uma diferença que parece nada e conta, porque a vantagem joga-se em décimas de ponto.",
      },
      explainerTitle: "Ler um preço em qualquer formato",
      explainer: [
        "**Uma odd é uma probabilidade vestida de outra forma.** A decimal — padrão europeu — dá o retorno total por unidade apostada: 2.50 devolve 2.50 por cada 1 arriscado, aposta incluída. A fracionária indica o lucro: 3/2 são três unidades de lucro por cada duas arriscadas, a mesma 2.50. A americana diz quanto ganhas ao apostar 100 (+150) ou quanto tens de arriscar para ganhar 100 (−110). Hong Kong, Malay e Indonesian são os formatos asiáticos, e contam porque é lá que estão muitas vezes os preços mais afiados.",
        "O número que vale a pena ler é o último. **A probabilidade implícita é 1 dividido pela odd decimal**, e é a única que podes comparar diretamente com a tua estimativa: duas odds em notações diferentes não são mais fáceis de comparar do que duas probabilidades. Um limite que esta ferramenta não remove: **a probabilidade implícita ainda contém a margem da casa**, portanto soma todos os resultados de um mercado e passarás dos 100%. Para a opinião honesta do mercado em vez da opinião com acréscimo, passa-a pela calculadora de margem.",
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
      takeaway:
        "A margem é o que pagas pelo direito de ter uma opinião. Duas casas, o mesmo jogo, e a diferença é dinheiro.",
      example: {
        title: "O mesmo jogo em duas casas",
        rows: [
          { label: "Casa generalista", value: "1.90 / 1.90 · margem 5,26%" },
          { label: "Casa sharp", value: "1.98 / 1.98 · margem 1,01%" },
          { label: "Linha justa, ambas", value: "2.00 / 2.00 · 50% cada" },
          { label: "O teu EV num 50% real", value: "−5% contra −1% por aposta" },
        ],
        note:
          "Opinião idêntica, jogo idêntico. Apostar 100 duzentas vezes custa 1.000 na primeira casa e 200 na segunda: os oito cêntimos de diferença de odd são 800 ao longo de uma temporada. É a vantagem mais barata que existe nas apostas e não exige modelo nenhum.",
      },
      explainerTitle: "A margem é o preço da aposta",
      explainer: [
        "**Um mercado de duas vias justo cota ambos os lados a 2.00.** As probabilidades implícitas são 50% e 50%, somam exatamente 100%, e nenhum lado tem vantagem. Os mercados reais são cotados a 1.90 e 1.90: essas implícitas valem 52,63% cada, somam 105,26%, e **os 5,26 pontos em excesso são a margem da casa** — o overround. Qualquer lado que jogues, estás a pagá-la. As margens variam muito: as linhas principais das casas sharp ficam abaixo de 2%, enquanto vencedores e mercados de jogadores chegam habitualmente a 8% ou mais, porque é aí que as casas sabem que os seus preços são menos testados.",
        "Remover a margem dá a linha justa, a no-vig. Esta calculadora fá-lo em proporção — cada implícita dividida pela sua soma, voltando a somar exatamente 100% — e **essa linha justa é a referência de toda decisão +EV**: uma aposta só tem valor esperado positivo se a tua probabilidade superar a justa, não simplesmente a cotada. Um limite declarado: as casas reais carregam mais margem nos resultados improváveis, logo num mercado com favorito claro este método subestima-o um pouco. Em linhas equilibradas a distorção é pequena; em vencedores tipo lotaria, trata a linha justa como estimativa.",
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
      takeaway:
        "Não precisas de adivinhar melhor que o mercado: só de encontrar uma casa mais lenta do que a mais sharp.",
      example: {
        title: "Emprestar a probabilidade de uma casa sharp",
        rows: [
          { label: "Casa sharp, ambos os lados", value: "1.95 / 1.95" },
          { label: "Probabilidade justa, sem margem", value: "50,00%" },
          { label: "Preço de equilíbrio", value: "2.00" },
          { label: "A tua casa oferece", value: "2.10" },
          { label: "EV sobre 100 apostados", value: "+5,00 (+5%)" },
        ],
        note:
          "Não foi precisa opinião nenhuma: a linha sharp deu a probabilidade, e a tua casa cotou o mesmo resultado a 2.10 onde o justo era 2.00. Muda as odds sharp para 1.90/1.90 e a probabilidade justa continua 50% — é esse o sentido de remover a margem: a resposta não se move com o acréscimo.",
      },
      explainerTitle: "O que o valor esperado diz de facto",
      explainer: [
        "**O valor esperado é o resultado médio de uma aposta que pudesses repetir para sempre.** Duas entradas, nenhuma opinião: o preço oferecido e a probabilidade que dás ao resultado. Achas que uma equipa ganha 55% das vezes e alguém oferece 2.00, e a conta é imediata — 55% das vezes ganhas uma unidade, 45% perdes, portanto 0,10 unidades por unidade apostada. É uma vantagem de 10%, e é só isso que significa +EV.",
        "**A probabilidade é onde quase todos perdem em silêncio.** Um erro de 5 pontos transforma uma vantagem de 4% numa perda de 1%, e as estimativas a olho erram muito mais. Daí o segundo modo desta calculadora: em vez de confiar no instinto, toma ambos os lados numa casa sharp, remove a margem e usa a probabilidade justa resultante. Lê o resultado como uma taxa, não uma promessa — uma vantagem de 4% não devolve nada numa aposta isolada, aparece só ao longo de centenas, e só se a probabilidade estivesse certa. Por isso o tamanho do stake conta tanto como a vantagem.",
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
      takeaway:
        "Kelly dimensiona a aposta pela vantagem, não pela tua convicção — e quase todos deveriam apostar deliberadamente menos do que ele diz.",
      example: {
        title: "O que isso significa com 1.000 de banca",
        rows: [
          { label: "Banca", value: "1.000" },
          { label: "Odd · a tua probabilidade", value: "2.00 · 55%" },
          { label: "Vantagem", value: "+10%" },
          { label: "Kelly completo", value: "10% → 100 por aposta" },
          { label: "Meio Kelly", value: "5% → 50 por aposta" },
        ],
        note:
          "Cinco derrotas seguidas — uma sequência em cada 54 a esta odd — deixam 590 com Kelly completo, e será preciso +69% para voltar a 1.000. A mesma série a meio Kelly deixa 774, bastando +29%. Mesma vantagem, mesmas apostas, metade do buraco.",
      },
      explainerTitle: "Dimensionar a aposta para a má série não a encerrar",
      explainer: [
        "O critério de Kelly responde ao que o valor esperado ignora: dada uma vantagem, quanto arriscar de facto? Aposta pouco demais e uma vantagem real capitaliza-se demasiado devagar para contar. Aposta demasiado e a matemática vira-se contra ti: uma banca que reduz a metade precisa de +100% para recuperar, portanto stakes excessivos destroem o crescimento mesmo quando cada aposta é favorável. A fração ótima é a vantagem dividida pela odd líquida, e **escala com a vantagem, não com a convicção**: 10% de vantagem a 2.00 pede 10% da banca, a mesma vantagem a 5.00 pede apenas 2,5%.",
        "**Quase ninguém deveria jogar Kelly completo**, porque a fórmula assume que a tua probabilidade é exata e nunca é. Dá-lhe uma vantagem sobrestimada e recomendará com entusiasmo um stake demasiado grande para a vantagem que tens de verdade: a forma mais rápida de perder uma banca tendo razão em média. O meio Kelly abdica de um quarto do crescimento teórico e reduz a volatilidade quase a metade; um quarto de Kelly é o que usam muitos profissionais com modelos reais. E quando o preço não oferece vantagem, o stake correto é zero: uma fração de Kelly negativa significa que a aposta é do outro lado, nunca que deves apostar menos nesta.",
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
      takeaway:
        "As pernas multiplicam-se, e com elas o acréscimo da casa. Uma quádrupla a 1.80 exige um evento de 9,5%.",
      example: {
        title: "Quanto custa realmente uma quádrupla",
        rows: [
          { label: "Quatro pernas a", value: "1.80 cada · 55,56%" },
          { label: "Odd combinada", value: "10.50" },
          { label: "Probabilidade combinada", value: "9,53%" },
          { label: "Margem por perna", value: "5%" },
          { label: "Margem na múltipla", value: "21,6%" },
        ],
        note:
          "A odd parece generosa até vermos o que exige: um evento de 9,5%. E o acréscimo da casa compôs-se quatro vezes — 1,05⁴ − 1 = 21,6% — logo as mesmas quatro seleções custam quatro vezes a margem de uma simples. Pernas correlacionadas do mesmo jogo são outra coisa: multiplicar subestima-as, e é por isso que as casas cotam à parte as múltiplas do mesmo jogo.",
      },
      explainerTitle: "Primeiro a probabilidade, depois o preço",
      explainer: [
        "**Todo preço é uma afirmação sobre probabilidade**, e a conversão é uma divisão: 40% é um preço de 2.50, e 2.50 é uma probabilidade de 40%. Fazer essa conversão antes de apostar muda a pergunta de «gosto desta aposta?» para «isto acontece mais de 40% das vezes?» — uma pergunta na qual se pode estar errado. Lido do lado do preço, o mesmo número é a **probabilidade de equilíbrio**: a possibilidade mínima que um resultado precisa para a aposta ser neutra. 1.75 exige 57,1%; 1.50 exige 66,7%; 15.00 pede apenas 6,7%, e é por isso que as odds longas parecem baratas e que as casas carregam ali a margem.",
        "**As múltiplas são onde a probabilidade se torna contraintuitiva.** Pernas independentes multiplicam-se: três apostas que avalias a 50% combinam a 12,5%, não a algo tranquilizadoramente próximo de metade. Quatro pernas a 60% dão 12,96%. A odd combinada multiplica-se do mesmo modo, e aí está a armadilha — o número fica grande enquanto a possibilidade fica pequena, e a margem compõe-se com ela. Guarda a suposição de base: aqui multiplica-se, logo assume-se independência. Dois resultados do mesmo jogo são correlacionados, e aí a probabilidade real é diferente, normalmente maior que o produto.",
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

    "arbitrage-calculator": {
      metaTitle: "Calculadora de arbitragem — dividir a aposta entre casas | BetRedge",
      metaDescription:
        "Calculadora de arbitragem gratuita: introduz a melhor odd de cada resultado em casas diferentes e vê a soma das implícitas, como dividir a aposta e o lucro — ou que não existe nenhum.",
      h1: "Calculadora de arbitragem",
      lede:
        "Introduz a melhor odd disponível em cada resultado e vê se duas casas juntas deixam margem — e como dividir a aposta se deixarem.",
      labels: {
        inputTitle: "Melhor odd em cada resultado",
        outcome: "Resultado",
        addOutcome: "Adicionar resultado",
        removeOutcome: "Remover",
        total: "Aposta total",
        resultTitle: "Como dividir",
        profit: "Lucro",
        impliedSum: "Soma das probabilidades implícitas",
        stakeOn: "Aposta no resultado",
        guaranteedReturn: "Retorno em cada resultado",
        verdictArb:
          "As odds somam menos de 100%: dividida assim, cada resultado devolve a mesma quantia.",
        verdictNoArb:
          "As odds somam mais de 100%, portanto aqui não há arbitragem — qualquer divisão perde essa margem, saia o que sair.",
        hint: "Uma odd por resultado, cada uma da casa que paga mais nesse lado. O decimal aceita vírgula: 2,10 vale como 2.10.",
      },
      takeaway:
        "A arbitragem não é uma previsão. Nunca te pede para acertar em quem ganha: pede que duas casas discordem mais do que valem as margens delas.",
      example: {
        title: "Duas casas, 1.000 para dividir",
        rows: [
          { label: "Odds, uma casa por lado", value: "2.10 · 2.10" },
          { label: "Soma das probabilidades implícitas", value: "95,24%" },
          { label: "Aposta em cada lado, sobre 1.000", value: "500 · 500" },
          { label: "Retorno em cada resultado", value: "1.050" },
          { label: "Lucro", value: "+50 (+5,00%)" },
        ],
        note:
          "O mesmo mercado a 1.90/1.90 dentro de uma só casa soma 105,26% e devolve −5,00% qualquer que seja a divisão. Entre as duas linhas nada mudou no jogo: a diferença está toda em qual casa paga mais em qual lado, e em ter contas com saldo nas duas enquanto as odds ainda estavam expostas.",
      },
      explainerTitle: "Quando duas casas discordam o suficiente",
      explainer: [
        "**Soma um dividido por cada odd e tens o mercado inteiro num único número.** Dentro de uma casa esse número passa sempre dos 100% — é a margem que o mantém lá. Mas a melhor odd de um lado e a melhor do outro estão muitas vezes em casas diferentes, e ao combiná-las a soma pode cair abaixo dos 100%. É toda a condição: **as probabilidades implícitas têm de somar menos de 1**. Divide a aposta total na proporção dessas implícitas e cada resultado devolve a mesma quantia, portanto o que recuperas deixa de depender do marcador. Duas odds de 2.10 somam 95,24%, e 500 em cada lado de uma aposta de 1.000 devolvem 1.050 aconteça o que acontecer.",
        "**Na prática isto fecha muito menos vezes do que a aritmética sugere, e os motivos contam mais do que a fórmula.** As odds movem-se: a diferença que viste é normalmente a casa mais lenta a alinhar-se, e pode desaparecer nos segundos entre a primeira perna e a segunda, deixando-te uma aposta comum e descoberta a uma odd escolhida para cobrir e não pelo valor. Os limites de aposta apertam exactamente onde a diferença é maior, por isso 5% no papel é muitas vezes 5% sobre quarenta unidades e não sobre mil. E **as casas restringem as contas de quem faz isto de forma sistemática**: primeiro limites mais baixos, depois apostas recusadas e encerramentos. Junta o capital parado em várias casas e o câmbio entre moedas, e a arbitragem parece-se menos com uma máquina e mais com uma forma lenta e operacionalmente pesada de raspar uma margem fina.",
      ],
      faq: [
        {
          q: "Preciso de conta em todas as casas?",
          a: "Sim. Uma arbitragem só existe entre as casas concretas que expõem aquelas odds concretas, portanto são precisas contas com saldo em cada uma antes de as odds se moverem. Esse capital, espalhado por várias casas e parado a maior parte do tempo, é o custo que quase nenhuma calculadora mostra.",
        },
        {
          q: "O que acontece se a segunda odd se mover antes de eu apostar?",
          a: "Ficas com a primeira perna sozinha: uma aposta comum, a uma odd escolhida para cobrir e não pelo valor. Coloca primeiro a perna com maior probabilidade de se mover, e trata o ficar descoberto como parte do risco, não como um acidente.",
        },
        {
          q: "Porque é que as casas restringem quem faz arbitragem?",
          a: "Porque a margem delas vive do fluxo equilibrado dos clientes recreativos, e uma conta que só apanha a melhor odd de um lado é para elas puro custo. As restrições chegam em silêncio como limites de aposta mais baixos, muito antes do encerramento da conta.",
        },
        {
          q: "A arbitragem desportiva é legal?",
          a: "A actividade em si é legal: estás a fazer apostas comuns a odds publicadas. O que pode proibi-la são os termos da casa, que costumam reservar o direito de limitar, recusar ou anular apostas que considerem arbitragem. Legal e permitido não são a mesma coisa.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Calculadora de múltiplas — odd combinada, probabilidade real e margem composta | BetRedge",
      metaDescription:
        "Calculadora de múltiplas gratuita: insere cada perna e vê a odd combinada, a probabilidade que o boletim exige de facto e como a margem da casa se compõe perna a perna.",
      h1: "Calculadora de múltiplas",
      lede:
        "Cada perna que acrescentas multiplica a odd — e multiplica com ela a parte que fica para a casa. Aqui estão os dois números antes de apostar.",
      labels: {
        inputTitle: "As pernas",
        leg: "Perna",
        addLeg: "Adicionar perna",
        removeLeg: "Remover",
        marginPerLeg: "Margem da casa por perna (%)",
        resultTitle: "Quanto vale a múltipla",
        combinedOdds: "Odd combinada",
        impliedProb: "Probabilidade de entrar",
        compoundMargin: "Margem composta",
        verdict:
          "Multiplicar assume pernas independentes. Duas seleções do mesmo jogo não o são: a probabilidade real delas é normalmente maior do que o produto, e é por isso que as casas cotam múltiplas do mesmo jogo com um modelo próprio.",
        hint: "Uma odd decimal por perna, até oito. A margem por perna escreve-se como número: 5 significa 5%, aproximadamente o que retém um mercado de duas saídas apertado.",
      },
      takeaway:
        "A parte que a casa retém não se soma entre as pernas, compõe-se — quatro pernas a 1.80 parecem quatro apostas quase equilibradas e são um único evento de 9,53%.",
      example: {
        title: "Quatro pernas a 1.80, uma aposta de 9,53%",
        rows: [
          { label: "Pernas", value: "4 × 1.80" },
          { label: "Odd combinada", value: "10.50" },
          { label: "Probabilidade de entrar", value: "9,53%" },
          { label: "Margem por perna", value: "5%" },
          { label: "Margem composta", value: "21,55%" },
        ],
        note:
          "Isolada, cada perna é a aposta em que ninguém pensa duas vezes: 55,56% implícito, 1.80 a ganhar. Em cadeia, as quatro exigem um evento de 9,53% — e os 5% que a casa retém em cada perna tornam-se 1,05⁴ − 1 = 21,55% na múltipla. Nada foi acrescentado à aposta a não ser mais formas de a perder: a odd subiu porque a probabilidade desceu.",
      },
      explainerTitle: "Porque a odd cresce mais depressa do que a probabilidade",
      explainer: [
        "**Uma múltipla é uma aposta só com várias formas de perder, não várias apostas.** A odd combinada é o produto das pernas — 1.80 quatro vezes dá 10.4976 — e a probabilidade é o produto das probabilidades, e é aí que a aritmética deixa de ser simpática: quatro seleções que chamarias quase equilibradas dão 9,53%. A margem comporta-se da mesma maneira, e essa é a parte que quase ninguém conta. Não se soma perna a perna, **compõe-se**: uma casa que retém 5% em cada uma de quatro pernas retém 1,05⁴ − 1 = 21,55% na múltipla, e com oito pernas esses mesmos 5% por perna já são 47,75%. O prémio parece generoso porque a probabilidade caiu, não porque alguém pague mais pelo mesmo risco.",
        "**As múltiplas são o produto mais promovido das apostas e o menos favorável ao cliente**, e são o mesmo facto visto dos dois lados: quanto maior a margem composta, mais uma casa pode dar-se ao luxo de aumentar, segurar e publicitar aquele boletim. Uma vantagem fina numa perna não sobrevive a ser multiplicada por mais três pernas de margem — as mesmas seleções em simples pagam a margem uma vez cada, a quádrupla paga-a quatro vezes. Falta o que a multiplicação assume: **que as pernas são independentes**. Duas seleções do mesmo jogo estão correlacionadas, por isso multiplicar é a conta errada: a vitória em casa e o gol do seu ponta de lança tendem a chegar juntos, logo o par é mais provável do que o produto diz, enquanto pernas que dificilmente coexistem valem muito menos. É por isso que as casas constroem as múltiplas do mesmo jogo com um modelo próprio em vez de te deixarem montá-las a partir das simples — e é por isso que esta calculadora é honesta com pernas de jogos diferentes.",
      ],
      faq: [
        {
          q: "Serve para múltiplas do mesmo jogo?",
          a: "Não exatamente. Aqui multiplica-se, e multiplicar assume pernas independentes. Os resultados dentro do mesmo jogo movem-se juntos, portanto a probabilidade real do par é diferente — muitas vezes maior do que o produto — e é por isso que as casas cotam esses mercados com um modelo próprio e não a partir das simples.",
        },
        {
          q: "Porque é que a probabilidade combinada é tão baixa?",
          a: "Porque as probabilidades multiplicam-se em vez de fazerem média. Quatro pernas a 55,56% dão 9,53%: cada perna que acrescentas torna o boletim inteiro menos provável, logo uma cadeia de seleções plausíveis vira depressa uma aposta improvável. A odd sobe para compensar, e com ela sobe a margem acumulada.",
        },
        {
          q: "O que é exatamente a margem composta?",
          a: "A parte da casa depois de cada perna a ter multiplicado. Insere quanto te custa uma perna — cerca de 5% num mercado de duas saídas apertado — e a calculadora compõe-na: um mais a margem, elevado ao número de pernas, menos um. Quatro pernas a 5% custam 21,55%, oito pernas 47,75%.",
        },
        {
          q: "Quatro simples são melhores do que uma quádrupla?",
          a: "Para quem aposta com vantagem, sim: as mesmas quatro seleções em simples pagam a margem uma vez cada em vez de a multiplicarem, e uma perna errada custa uma aposta e não o boletim todo. A múltipla compra variância — uma pequena probabilidade de um retorno grande — e o preço dessa variância é a margem composta.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "Calculadora de ROI para apostas — retorno da banca | BetRedge",
      metaDescription:
        "Calculadora de ROI gratuita para apostas: insere capital e lucro para ver o retorno da banca, o capital final e porque o mesmo lucro é um yield de 4%.",
      h1: "Calculadora de ROI",
      lede:
        "O que a banca rendeu num período — e porque o mesmo lucro de 400 é aqui um ROI de 40% e na outra página um yield de 4%.",
      labels: {
        inputTitle: "Capital e resultado",
        capital: "Capital",
        profit: "Lucro",
        resultTitle: "Retorno sobre esse capital",
        roi: "ROI",
        endingCapital: "Capital final",
        hint: "O lucro entra líquido e pode ser negativo: -250 é um período de perdas. O capital é a banca que colocaste em risco, não o total apostado.",
        verdict:
          "O ROI depende inteiramente do denominador, por isso declara-o: 400 numa banca de 1.000 são 40%, os mesmos 400 sobre 10.000 apostados são um yield de 4%. Nenhum dos números diz muito sem o período e o número de apostas por trás.",
      },
      takeaway:
        "O ROI diz o que a banca rendeu. Não diz se a estratégia é boa, porque os mesmos 40% podem vir de 200 apostas ou de um sábado com sorte.",
      example: {
        title: "400 de lucro numa banca de 1.000",
        rows: [
          { label: "Capital", value: "1.000" },
          { label: "Lucro do período", value: "+400" },
          { label: "ROI", value: "+40,00%" },
          { label: "Capital final", value: "1.400" },
          { label: "Os mesmos 400 sobre 10.000 apostados", value: "yield +4,00%" },
        ],
        note:
          "As duas percentagens descrevem um único resultado idêntico. Chegar a +40,00% da banca exigiu 200 apostas de 50 — 10.000 de volume apostado, dez vezes o capital — e 4,00% desse volume são os mesmos 400. Roda a banca duas vezes em vez de dez e o yield por trás de um ROI de 40% teria de ser 20%, algo que quase ninguém sustenta.",
      },
      explainerTitle: "O lucro medido sobre o dinheiro em risco",
      explainer: [
        "**O ROI é o lucro dividido pelo dinheiro que colocaste em risco**, e toda a dificuldade está na segunda metade da frase. Uma banca de 1.000 que fecha a temporada com 400 a mais rendeu 40,00%, e esse número compara-se honestamente com qualquer outra coisa que tivesses feito com esses 1.000. O que não consegue descrever são as apostas. Um retorno de 40% não diz quantas apostas foram precisas, em quanto tempo, nem quão perto do zero o saldo passou pelo caminho — e são essas as três coisas que decidem se volta a acontecer. Por isso **declara o denominador antes de citar o número**: banca inicial, saldo médio e total depositado dão três percentagens diferentes a partir do mesmo conjunto de apostas, e a mais lisonjeira é sempre a mais pequena.",
        "**Os mesmos 400 de lucro são um ROI de 40% e um yield de 4% ao mesmo tempo**, e saber qual deles tens na mão é quase todo o valor das duas páginas. O ROI mede contra o capital, o yield contra o volume apostado — a soma de cada stake colocado. O nosso exemplo chegou lá com 200 apostas de 50, portanto passaram 10.000 pela banca: dez vezes o capital, e 4,00% desse volume são precisamente esses 400. **Esse multiplicador é toda a ponte entre os dois números**, e é a razão pela qual o ROI sozinho favorece quem joga muito. Quem roda uma banca de 1.000 dez vezes com um yield de 4% e quem a roda duas vezes com um yield de 20% declaram ambos 40%, e apenas um deles é repetível. A qualidade por aposta mede-se na calculadora de yield; guarda o ROI para aquilo em que é realmente útil: comparar o que aquele dinheiro rendeu face às alternativas.",
      ],
      faq: [
        {
          q: "Qual é a diferença entre ROI e yield?",
          a: "O ROI divide o lucro pelo capital, o yield divide-o pelo volume apostado — a soma de todos os stakes. Os mesmos 400 de lucro são 40,00% de uma banca de 1.000 e 4,00% de 10.000 apostados. O ROI diz o que o dinheiro rendeu, o yield diz se as apostas eram boas, e a razão entre os dois é quantas vezes rodaste a banca.",
        },
        {
          q: "Que capital devo usar como denominador?",
          a: "Aquele que consegues declarar e depois manter fixo — normalmente a banca inicial. Saldo máximo, saldo médio e total depositado produzem percentagens diferentes a partir das mesmas apostas, por isso o número só significa algo ao lado da sua definição. Reforçar a conta a meio do período sem redeclarar o denominador é a forma mais comum de inflacionar um ROI.",
        },
        {
          q: "Um ROI de 40% é bom?",
          a: "Depende do período e do número de apostas. Numa temporada com 200 apostas é um resultado forte mas plausível. Os mesmos 40% em vinte apostas ficam bem dentro do intervalo que o azar produz por si só, e 40% numa semana normalmente significa que os stakes eram grandes face à banca, não que a vantagem o era.",
        },
        {
          q: "O ROI pode ser negativo?",
          a: "Sim, e a calculadora mostra-o em vez de o esconder: uma perda de 250 numa banca de 1.000 é -25,00%. A recuperação não é simétrica — depois de -25% precisas de +33,33% sobre o que resta para voltar ao ponto de partida — e é por isso que o drawdown merece tanta atenção como o retorno.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Calculadora de yield para apostas — lucro sobre o volume | BetRedge",
      metaDescription:
        "Calculadora de yield gratuita: insere número de apostas, stake médio e lucro para obter o volume apostado e o yield — e quantas apostas são precisas para significar algo.",
      h1: "Calculadora de yield",
      lede:
        "O lucro medido sobre tudo o que apostaste, não sobre a tua banca — a única cifra que compara dois apostadores com dinheiro diferente.",
      labels: {
        inputTitle: "Apostas, stake e resultado",
        bets: "Número de apostas",
        avgStake: "Stake médio",
        profit: "Lucro",
        resultTitle: "Yield sobre o volume",
        turnover: "Volume apostado",
        yieldPercent: "Yield",
        hint: "O volume é calculado por nós: apostas × stake médio. Conta o stake de cada aposta, não o dinheiro exposto de uma vez. O lucro entra líquido e pode ser negativo.",
        verdictNoise:
          "Abaixo de mil apostas esta cifra é sobretudo ruído. Com stake plano a 2.00, um desvio-padrão do yield são 7,07 pontos em 200 apostas e ainda 3,16 em 1.000: lê-o como um intervalo, não como um resultado.",
        verdictVolume:
          "Passadas as mil apostas a cifra começa a transportar informação, mas um desvio-padrão continua a ser cerca de 3,16 pontos a 2.00 — um +4% e um +7% sobre o mesmo volume não são dois níveis de competência diferentes.",
      },
      takeaway:
        "O yield é a métrica que compara apostadores: 4% sobre 10.000 apostados vale mais do que um ROI de 40% obtido em vinte apostas.",
      example: {
        title: "200 apostas de 50, 400 de lucro",
        rows: [
          { label: "Número de apostas", value: "200" },
          { label: "Stake médio", value: "50" },
          { label: "Volume apostado", value: "10.000" },
          { label: "Lucro", value: "+400" },
          { label: "Yield", value: "+4,00%" },
          { label: "Os mesmos 400 numa banca de 1.000", value: "ROI +40,00%" },
        ],
        note:
          "Um resultado, duas percentagens igualmente honestas: 4,00% dos 10.000 que passaram pela casa, 40,00% dos 1.000 que estiveram em risco. A distância entre elas são apenas as dez vezes em que a banca rodou. E a amostra pesa mais do que as duas cifras: em 200 apostas um desvio-padrão do yield são 7,07 pontos, portanto este +4,00% cai dentro do intervalo que uma série de moeda ao ar produz sozinha.",
      },
      explainerTitle: "A cifra que compara dois apostadores",
      explainer: [
        "**O yield é o lucro dividido pelo volume apostado** — a soma de cada stake colocado, não o saldo da conta. É a cifra que os apostadores citam entre si precisamente porque não depende de quanto dinheiro têm: 4% é 4% com stakes de 5 ou de 500. **O dado que todos erram é o denominador**, e erram sempre na mesma direção. O volume conta o stake de cada aposta no momento em que é colocada, portanto 200 apostas de 50 são 10.000 mesmo que num instante só estivessem 50 expostos, e a banca de 1.000 por onde essas apostas circularam não é o número pelo qual dividir. É por isso que esta página pede o número de apostas e o stake médio e calcula o volume à tua frente. Mede o mesmo lucro contra o capital e obténs o ROI: a calculadora de ROI guarda a outra metade da comparação, onde 400 de lucro são 40,00% de uma banca de 1.000 e 4,00% de 10.000 apostados.",
        "**Um yield acima de cerca de 5%, sustentado em volume sério, é raro.** Onde existe, vive em mercados moles com limites baixos, e encolhe quando os stakes crescem, porque as odds que o permitiam não sobrevivem a ser atingidas com força. Qualquer cifra de longo prazo muito acima disso deve ser tratada como amostra curta, nicho mole ou uma definição diferente de volume. E **abaixo de algumas centenas de apostas o número é ruído, não um resultado**: com stake plano a 2.00 um desvio-padrão do yield é um dividido pela raiz do número de apostas — 7,07 pontos em 200, 3,16 em 1.000, 2,00 em 2.500. Um +4% de yield só chega a dois desvios-padrão acima de zero por volta das 2.500 apostas. Em odds mais altas a oscilação é maior: a 3.00 as mesmas 200 apostas carregam um desvio de 10 pontos. E é essa a leitura honesta de vinte apostas ganhas: não uma vantagem medida, só uma amostra demasiado curta.",
      ],
      faq: [
        {
          q: "Como calculo o meu volume apostado?",
          a: "Somando o stake de cada aposta colocada, ganha ou perdida. 200 apostas de 50 são 10.000 de volume, mesmo que a banca por trás fosse só 1.000. Não uses o líquido nem o saldo: o volume é o dinheiro que passou pela casa, contado uma vez por aposta.",
        },
        {
          q: "Um yield de 5% é bom?",
          a: "Sustentado ao longo de milhares de apostas, sim — está perto do topo do que sobrevive a limites reais. Yields muito acima disso vêm normalmente de mercados moles, de uma amostra curta ou de valor promocional, e tendem a cair quando os stakes sobem, porque as odds que os produziam são retiradas ou limitadas.",
        },
        {
          q: "Quantas apostas até o meu yield significar algo?",
          a: "Mais do que a maioria supõe. Com stake plano a 2.00 um desvio-padrão do yield são 7,07 pontos em 200 apostas, 3,16 em 1.000 e 2,00 em 2.500, logo um +4% só chega a dois desvios acima de zero perto das 2.500 apostas. Abaixo de algumas centenas, trata a cifra como um intervalo.",
        },
        {
          q: "E se os meus stakes variarem muito?",
          a: "Então apostas × stake médio é só uma aproximação, e favorece-te quando as vitórias caíram nos stakes grandes. Soma os stakes reais e divide o lucro por esse total. Se apostas em unidades, conta unidades: o yield por unidade apostada é a mesma cifra e é mais fácil de manter honesta.",
        },
      ],
    },
  },
};

export default pt;
