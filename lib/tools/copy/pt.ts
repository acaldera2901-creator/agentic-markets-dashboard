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
  },
};

export default pt;
