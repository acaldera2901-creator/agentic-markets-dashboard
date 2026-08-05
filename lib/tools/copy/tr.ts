// lib/tools/copy/tr.ts (#TOOLS-HUB-0805)
// Türkçe. Yerel aramalar: "oran çevirici", "beklenen değer hesaplama",
// "Kelly kriteri", "bahis şirketi marjı".

import type { ToolsCopy } from "./types";

const tr: ToolsCopy = {
  hub: {
    metaTitle: "Ücretsiz bahis araçları — oran, EV, Kelly ve marj | BetRedge",
    metaDescription:
      "Beş ücretsiz hesaplayıcı: oranları her formata çevir, bahis şirketinin marjını çıkar, beklenen değeri hesapla ve Kelly ile bahis miktarını belirle. Kayıt gerekmez.",
    h1: "Ücretsiz bahis araçları",
    lede:
      "Bahis öncesi yapılan beş hesap: oranlar çevrilmiş, marj çıkarılmış, miktar belirlenmiş. Ücretsiz, hesap açmadan.",
    cardCta: "Aracı aç",
    intro: [
      "Her bahis, bir fiyat ile bir olasılığın karşılaştırmasıdır. Bu beş hesaplayıcı o karşılaştırmayı düzgün yapar: oranları formatlar arasında çevirir, bahis şirketinin marjını çıkarıp adil çizgiyi görünür kılar, bir olasılık tahminini beklenen değere dönüştürür ve kayıp serisinin kasayı bitirmemesi için bahis miktarını ölçekler.",
      "Tamamı tarayıcında çalışır: hiçbir şey gönderilmez, hiçbir şey saklanmaz ve açılacak bir hesap yoktur. Tek başına kullan ya da modelimizin her maç için zaten yayımladığını doğrulamak için kullan.",
    ],
  },

  common: {
    backLabel: "Ana sayfa",
    ctaTitle: "Bu hesapları her maç için biz yapıyoruz",
    ctaBody:
      "Hesaplayıcılar tek bir fiyatla çalışır. BetRedge piyasayı sürekli tarar, marjı çıkarır, model olasılığıyla karşılaştırır ve ikisinin ayrıştığı yeri gösterir — futbol ve tenis, gün boyu güncel.",
    ctaButton: "Bugünün panosuna bak",
    otherTools: "Diğer ücretsiz araçlar",
    langLabel: "Dil",
    free: "Ücretsiz",
    faqTitle: "Sorular",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Oran çevirici — ondalık, kesirli, Amerikan ve zımni olasılık | BetRedge",
      metaDescription:
        "Ücretsiz oran çevirici: fiyatı herhangi bir formatta yaz — ondalık, kesirli, Amerikan, Hong Kong, Malay veya Indonesian — ve diğer tüm formatlarda oku.",
      h1: "Oran çevirici",
      lede:
        "Bir fiyatı tek formatta yaz, diğer tüm formatlarda oku — bahis şirketinin ima ettiği olasılıkla birlikte.",
      labels: {
        inputTitle: "Fiyatın",
        oddsInput: "Oran",
        formatSelect: "Format",
        resultTitle: "Aynı fiyat, her formatta",
        decimal: "Ondalık",
        american: "Amerikan",
        fractional: "Kesirli",
        hongkong: "Hong Kong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Zımni olasılık",
        hint: "Ondalık virgülü de kabul eder: 2,50 ile 2.50 aynıdır.",
      },
      formulaTitle: "Çevirme nasıl işler",
      formula: [
        "ondalık = 1 + (Amerikan / 100)          Amerikan pozitifse",
        "ondalık = 1 + (100 / |Amerikan|)        Amerikan negatifse",
        "ondalık = 1 + (pay / payda)             kesirli oranlar için",
        "zımni olasılık = 1 / ondalık",
      ],
      explainerTitle: "Bir fiyatı her formatta okumak",
      explainer: [
        "Oran, başka kılıkta bir olasılıktır. Ondalık oran — Avrupa standardı — yatırılan birim başına toplam dönüşü verir: 2.50, riske edilen her 1 için bahis dahil 2.50 döner. Kesirli oran, İngiliz at yarışlarında hâlâ yaygın, dönüş yerine kârı bildirir: 3/2, riske edilen iki birime karşılık üç birim kâr demektir, yani aynı 2.50 ondalık. Amerikan oranı 100 yatırınca ne kazandığını (+150) ya da 100 kazanmak için ne riske etmen gerektiğini (−110) söyler. Hong Kong, Malay ve Indonesian ise Asya piyasalarının formatlarıdır ve önemlidirler, çünkü en keskin fiyatlar sıklıkla oradadır.",
        "Okumaya değer sayı son sıradaki: zımni olasılık, yani 1 bölü ondalık oran. 2.50 fiyatı %40 ima eder. 1.91 fiyatı — bilinen −110 — %52,38 ima eder. Bu, bahis şirketinin beyan ettiği şanstır ve kendi tahmininle doğrudan karşılaştırabileceğin tek sayıdır. Farklı formatlardaki iki oranı karşılaştırmak, iki olasılığı karşılaştırmaktan kolay değildir: önce çevir, sonra tartış.",
        "Bu çeviricinin senin için kaldıramayacağı bir sınır var: zımni olasılık hâlâ bahis şirketinin marjını içerir. Bir piyasadaki tüm sonuçların zımni olasılıklarını topla, %100'ü aşarsın — bu fazlalık marjdır ve o olasılıkların her birini şişirir. Piyasanın fiyatlanmış görüşü yerine dürüst görüşünü istiyorsan, piyasayı marj hesaplayıcısından geçir ve döndürdüğü adil olasılıkları kullan.",
      ],
      faq: [
        {
          q: "Hangi formatta çalışmak daha iyi?",
          a: "Aksi bir neden yoksa ondalıkta. Ondalık oranları çarpmak kombine bahsin fiyatını doğrudan verir, 1'i orana bölmek zımni olasılığı verir — her ikisi de kesirli ya da Amerikan gösterimde zahmetlidir.",
        },
        {
          q: "−110 neden 1,909090… çıkıyor?",
          a: "Çünkü 100/110 devirli bir ondalıktır. İki haneye yuvarlanınca 1.91 olur, bahis şirketleri bunu gösterir; ancak çevirici içeride tam hassasiyeti korur ki hesap zinciri kaymasın.",
        },
        {
          q: "Malay ve Indonesian oranların farkı nedir?",
          a: "Birbirinin aynadaki görüntüsüdürler. Malay 2.00 altında pozitif, üstünde negatiftir; Indonesian 2.00 üstünde pozitif, altında negatiftir. Aynı fiyatı ifade eder ve aynı ondalığa dönüşürler.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Marj hesaplayıcı — overround, ödeme oranı ve adil oranlar | BetRedge",
      metaDescription:
        "Ücretsiz marj hesaplayıcı: bir piyasadaki tüm sonuçların oranlarını gir; bahis şirketinin marjını, ödeme yüzdesini ve marjsız adil oranları öğren.",
      h1: "Marj hesaplayıcı",
      lede:
        "Bir piyasadaki tüm fiyatları gir ve bahis şirketinin ne aldığını gör — altında duran adil çizgiyle birlikte.",
      labels: {
        inputTitle: "Piyasa",
        outcome: "Sonuç",
        addOutcome: "Sonuç ekle",
        removeOutcome: "Kaldır",
        resultTitle: "Bahis şirketi ne alıyor",
        margin: "Bahis şirketi marjı",
        payout: "Ödeme oranı",
        fairOddsTitle: "Adil çizgi, marj çıkarılmış",
        fairOdds: "Adil oran",
        fairProbability: "Adil olasılık",
        impliedProbability: "Zımni olasılık",
        hint: "Üç sonuçlu piyasalar için bir sonuç ekle, şampiyonluk piyasaları için daha fazla.",
      },
      formulaTitle: "Marj nasıl hesaplanır",
      formula: [
        "overround = Σ (1 / oranᵢ)",
        "marj = overround − 1",
        "ödeme oranı = 1 / overround",
        "adil olasılıkᵢ = (1 / oranᵢ) / overround",
        "adil oranᵢ = 1 / adil olasılıkᵢ",
      ],
      explainerTitle: "Marj, bahsin fiyatıdır",
      explainer: [
        "Adil bir iki sonuçlu piyasa her iki tarafı 2.00 fiyatlar: zımni olasılıklar %50 ve %50, toplamı tam %100 ve hiçbir tarafın avantajı yok. Gerçek piyasalar 1.91 ve 1.91 fiyatlanır. Bu zımni olasılıklar her biri %52,38, toplamı %104,76 ve fazladan 4,76 puan bahis şirketinin marjıdır — overround. Hangi tarafı oynarsan oyna onu ödüyorsun.",
        "Marj, nerede bahis yapılacağına karar vermek için en yararlı sayıdır. Aynı maçın %5 marjla ve %2 marjla fiyatlanması aynı bahis değildir: daha sıkı şirket, birebir aynı görüşle sana yaklaşık üç puan beklenen değer bırakır. Marjlar piyasaya göre büyük ölçüde değişir: keskin şirketlerin ana çizgileri %2'nin altına inebilir, buna karşılık şampiyonluk, oyuncu ve özel bahisler rutin olarak %8 ve üzerini taşır — çünkü şirketler fiyatlarının orada en az sınandığını bilir.",
        "Marjı çıkarmak adil çizgiyi, yani no-vig çizgisini verir. Bu hesaplayıcı bunu oranlı yapar: her zımni olasılık toplamlarına bölünür, böylece yeniden tam %100 olurlar ve adil oranlar bunların tersidir. Bu çizgi, piyasanın dürüst tahminine en yakın şeydir ve EV hesaplayıcısının referans noktasıdır: bir bahsin beklenen değeri ancak senin olasılığın adil olasılığı aşarsa pozitiftir; yalnızca fiyatlanmış olanı aşması yetmez.",
        "Açıkça belirtilen bir sınır: oranlı çıkarma marjı sonuçlara eşit dağıtır, gerçek şirketler bunu yapmaz. Marjın fazlasını düşük olasılıklı sonuçlara yükler, çünkü eğlence amaçlı para orada toplanır. Belirgin bir favori ile uzak bir sürprizin olduğu piyasada bu yöntem favorinin gerçek şansını biraz düşük gösterir. Ana çizgilerde sapma küçüktür; piyango tarzı şampiyonluk bahislerinde adil çizgiyi bir ölçüm değil, tahmin olarak gör.",
      ],
      faq: [
        {
          q: "Hangi marj kabul edilebilir?",
          a: "Futbol ve teniste ana çizgilerde %3'ün altı keskin, %4–5 eğlence odaklı bir şirkette normal, %7'nin üstü ise bir görüşe sahip olma hakkı için çok ödemek demek. Karar vermeden önce aynı piyasayı birkaç şirkette karşılaştır.",
        },
        {
          q: "Ödeme oranı marjla aynı şey mi?",
          a: "Aynı sayının iki okunuşu. %5,26 marj, %95 ödeme oranına karşılık gelir: şirket piyasanın tamamında yatırılan her 100 birimin 95'ini geri vermeyi bekler. Ödeme oranı karşılaştırma için daha kullanışlıdır.",
        },
        {
          q: "Adil olasılıklar neden tam %100 topluyor?",
          a: "Çünkü marjı çıkarmanın tanımı budur. Fiyatlanmış olanlar %100'ü aşar; her birini bu toplama bölmek onları bire ölçekler — tutarlı bir olasılık kümesinin yapması gereken tam olarak budur.",
        },
        {
          q: "Üç sonuçlu veya şampiyonluk piyasalarında işe yarar mı?",
          a: "Evet — piyasada kaç sonuç varsa o kadar ekle. Matematik her sonuç sayısı için aynıdır, yeter ki hepsini gir. Bir tanesini dışarıda bırakmak marjı düşük gösterir.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "Beklenen değer (EV) hesaplayıcı — adil çizgiyle veya onsuz | BetRedge",
      metaDescription:
        "Ücretsiz beklenen değer hesaplayıcı: oran, olasılık ve bahis miktarını gir; EV'yi para ve yüzde olarak al veya adil olasılığı keskin bir şirketin çizgisinden türet.",
      h1: "Beklenen değer hesaplayıcı",
      lede:
        "Bir bahsin ortalama değeri: kendi olasılığından ya da keskin bir şirketin marjı çıkarılmış çizgisinden.",
      labels: {
        inputTitle: "Bahis",
        modeTitle: "Olasılık nereden geliyor",
        modeManual: "Kendi tahminim",
        modeSharp: "Keskin bir şirketten",
        yourOdds: "Fiyatın",
        yourProbability: "Olasılığın (%)",
        sharpOddsA: "Keskin fiyat, senin taraf",
        sharpOddsB: "Keskin fiyat, diğer taraf",
        derivedProbability: "Adil olasılık, marj çıkarılmış",
        stake: "Bahis miktarı",
        resultTitle: "Bahsin değeri",
        ev: "Beklenen değer",
        fairOdds: "Başabaş fiyatı",
        edge: "Avantaj",
        positive: "Bu fiyatta beklenen değer pozitif.",
        negative: "Bu fiyatta beklenen değer negatif.",
        neutral: "Başabaş: fiyat olasılıkla tam olarak örtüşüyor.",
        hint: "Yüzdeleri sayı olarak yaz: 55, %55 demektir.",
      },
      formulaTitle: "Beklenen değer nasıl hesaplanır",
      formula: [
        "EV = p × (oran − 1) × miktar − (1 − p) × miktar",
        "   = (p × oran − 1) × miktar",
        "avantaj = p × oran − 1",
        "başabaş fiyatı = 1 / p",
      ],
      explainerTitle: "Beklenen değer gerçekte ne söyler",
      explainer: [
        "Beklenen değer, bir bahsi sınırsız sayıda tekrarlayabilseydin elde edeceğin ortalama sonuçtur. İki girdisi var, görüşü yok: sana sunulan fiyat ve sonuca verdiğin olasılık. Bir takımın zamanın %55'inde kazandığını düşünüyorsan ve biri 2.00 veriyorsa hesap hemen çıkar: %55 bir birim kazanır, %45 kaybedersin, yani yatırılan birim başına ortalama 0,10 birim kazanırsın. Bu %10 avantajdır ve +EV tam olarak bunu ifade eder.",
        "Her şeyi belirleyen sayı olasılıktır ve çoğu bahisçi sessizce tam orada kaybeder. Tahminde 5 puanlık bir hata, %4 avantajı %1 kayba çevirmeye yeter; göz kararı yapılan tahminler ise rutin olarak 5 puandan fazla sapar. Bu hesaplayıcının ikinci modu bu yüzden var: içgüdüne güvenmek yerine keskin bir şirkette her iki tarafın fiyatını al, marjı çıkar ve çıkan adil olasılığı kullan. Artık piyasadan daha zeki olup olmadığını değil, oynadığın şirketin en keskin şirketten daha yavaş olup olmadığını soruyorsun.",
        "EV'yi bir oran gibi oku, bir vaat gibi değil. %4 beklenen değerli bir bahis tek seferde hiçbir şey getirmez: kazanır ya da kaybeder. O %4 ancak yüzlerce bağımsız bahis boyunca ve olasılık doğruysa ortaya çıkar. Kısa vadede varyans avantajdan çok daha büyüktür; tam bu yüzden bahis miktarı avantajın kendisi kadar önemlidir — Kelly kriterinin işi budur.",
      ],
      faq: [
        {
          q: "Güvenebileceğim bir olasılığı nasıl bulurum?",
          a: "Verilerle kurulmuş bir modelden ya da piyasanın kendisinden. Keskin bir şirketin adil çizgisi — marjı çıkarılmış fiyatları — yalnızca sezgiyle aşılması zor bir ölçüttür ve ücretsiz bakılabilir.",
        },
        {
          q: "Pozitif EV'li bir bahis iyi bir bahis midir?",
          a: "Gerekli ama yeterli koşul değil. Bahis miktarı kasaya göre çok büyükse, avantaj tahmin hatanın içinde kalıyorsa ya da piyasa maç öncesi aleyhine hareket ediyorsa bahis pozitif beklenen değerli olsa da yanlış olabilir.",
        },
        {
          q: "Neden keskin piyasanın iki tarafı isteniyor?",
          a: "Çünkü tek bir fiyattan marj çıkarılamaz. Marj yalnızca tüm sonuçların zımni olasılıkları toplandığında görünür: adil olasılığı hesaplanabilir kılan ikinci fiyattır.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Kelly kriteri hesaplayıcı — avantaj ve kasaya göre en uygun miktar | BetRedge",
      metaDescription:
        "Ücretsiz Kelly kriteri hesaplayıcı: oran, olasılık ve kasayı gir; uzun vadeli büyümeyi en yükseğe çıkaran miktarı öğren — tam, yarım veya çeyrek Kelly.",
      h1: "Kelly kriteri hesaplayıcı",
      lede:
        "Uzun vadede kasayı en hızlı büyüten miktar — ve neden çoğu kişinin bilinçli olarak daha az oynaması gerektiği.",
      labels: {
        inputTitle: "Bahis ve kasa",
        odds: "Fiyat",
        probability: "Olasılığın (%)",
        bankroll: "Kasa",
        fractionTitle: "Kelly oranı",
        fractionFull: "Tam",
        fractionHalf: "Yarım",
        fractionQuarter: "Çeyrek",
        resultTitle: "Önerilen miktar",
        stake: "Bahis miktarı",
        stakePercent: "Kasanın oranı",
        edge: "Avantaj",
        fullKelly: "Tam Kelly",
        growth: "Bahis başına beklenen büyüme",
        noEdge: "Bu fiyatta avantaj yok — en uygun miktar sıfır.",
        hint: "Yüzdeleri sayı olarak yaz: 55, %55 demektir.",
      },
      formulaTitle: "Kelly miktarı nasıl hesaplanır",
      formula: [
        "b = oran − 1",
        "f* = (p × b − (1 − p)) / b = (p × oran − 1) / b",
        "miktar = kasa × f* × oran",
        "beklenen büyüme = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Kötü serinin bitiremeyeceği bir miktar seçmek",
      explainer: [
        "Kelly kriteri, beklenen değerin atladığı bir soruyu yanıtlar: elinde avantaj varken gerçekte ne kadar riske etmeli? Az oynarsan gerçek bir avantaj anlam taşıyacak kadar hızlı bileşiklenmez. Çok oynarsan matematik aleyhine döner: yarıya inen bir kasa geri dönmek için %100 artış ister, yani büyük miktarlar her tek bahis lehte olsa bile büyümeyi yok eder. Kelly, uzun vadeli büyüme hızını en yükseğe çıkaran oranı bulur ve bu oran avantajın net orana bölümüdür.",
        "Sonuç avantajla ölçeklenir, inançla değil. 2.00 fiyatta %10 avantaj kasanın %10'unu ister; aynı avantaj 5.00 fiyatta yalnızca %2,5 ister, çünkü daha uzun fiyat daha uzun kayıp serileri ve daha engebeli bir yol demektir. Formül, harfi harfine izlenmese bile bu yüzden yararlıdır: fiyat ile avantajın birlikte miktarı belirlediğini, güçlü bir hissin ise girdi olmadığını söyler.",
        "Tam Kelly'yi neredeyse kimse oynamamalı. Formül olasılığının tam doğru olduğunu varsayar, hiçbir zaman değildir. Ona olduğundan büyük bir avantaj ver, gerçekte sahip olduğun avantaj için fazla büyük bir miktarı gönülle önerir: ortalamada haklıyken bir kasayı kaybetmenin en hızlı yolu. Yarım Kelly teorik büyümenin dörtte birinden vazgeçer ve oynaklığı yaklaşık yarıya indirir; gerçek modellere sahip birçok profesyonel fiilen çeyrek Kelly kullanır. Olasılıkların veriden değil sezgiden geliyorsa çeyrek Kelly ihtiyat değil, gerçekçiliktir.",
        "Fiyat avantaj sunmuyorsa doğru miktar sıfırdır ve bu hesaplayıcı bunu söyler; tavsiye kılığında negatif bir sayı döndürmez. Negatif Kelly oranı, o fiyattan bulabilirsen bahsin diğer tarafının oynanabilir olduğunu gösterir: bu tarafta daha az oynamak anlamına asla gelmez.",
      ],
      faq: [
        {
          q: "Tam, yarım yoksa çeyrek Kelly?",
          a: "Neredeyse herkes için yarım veya çeyrek. Tam yalnızca olasılık tahmini tam doğruysa en uygundur; tahmin hatası miktar fazla olduğunda, az olduğunda sağladığından çok daha fazla zarar verir. Kesirli Kelly bir miktar büyümeyi ayakta kalmaya çevirir.",
        },
        {
          q: "Bahis başına beklenen büyüme nedir?",
          a: "O miktarla yapılan tek bir bahis için kasanın ortalama logaritmik büyümesi. Tasarımı gereği küçüktür — 0,005 değeri bahis başına yaklaşık yarım puan bileşik büyümeye denk gelir — ve Kelly'nin en yükseğe çıkardığı büyüklüktür.",
        },
        {
          q: "Aynı anda birkaç bahsim varsa?",
          a: "Tek bahis Kelly'si, bahisler paralel ilerlerken ve özellikle ilişkiliyken fazla oynatır. Pratik kural: toplamı eşzamanlı pozisyonlara böl ve ilişkili bahisleri tek bahis gibi ele al.",
        },
        {
          q: "Avantajım olduğunu düşünürken neden sıfır gösteriyor?",
          a: "Çünkü girdiğin fiyatta olasılığın başabaş noktasını geçmiyor. Fiyatı 1 bölü olasılığınla karşılaştır: fiyat daha düşükse oynanacak avantaj yoktur.",
        },
      ],
      caveat:
        "Kelly kriteri uzun vadeli büyümeyi en yükseğe çıkarır, rahatlığı değil. Doğru miktarda bile %30 ve üzeri düşüşler olağandır ve formül olasılık tahmininin isabetli olduğunu varsayar: iyimserse Kelly sistematik olarak fazla oynatır ve kasa kaybedilebilir. İhtiyacın olan parayla asla oynama.",
    },

    "probability-calculator": {
      metaTitle: "Olasılık hesaplayıcı — oran, başabaş ve kombine | BetRedge",
      metaDescription:
        "Bahis için ücretsiz olasılık hesaplayıcı: olasılık ile oranı birbirine çevir, bir fiyatın istediği başabaş olasılığını bul ve kombine ayaklarını birleştir.",
      h1: "Olasılık hesaplayıcı",
      lede:
        "Olasılıkları fiyata ve fiyatları olasılığa çevir, bir fiyatın senden ne istediğini gör ve kombinenin gerçek değerini öğren.",
      labels: {
        inputTitle: "Olasılık ve fiyat",
        modeTitle: "Elinde ne var?",
        modeProbability: "Bir olasılık",
        modeOdds: "Bir fiyat",
        probability: "Olasılık (%)",
        odds: "Ondalık oran",
        breakEven: "Başabaş olasılığı",
        fairOdds: "Adil fiyat",
        parlayTitle: "Kombine",
        leg: "Ayak",
        addLeg: "Ayak ekle",
        removeLeg: "Kaldır",
        parlayProbability: "Birleşik olasılık",
        parlayOdds: "Birleşik oran",
        resultTitle: "Sonuçlar",
        hint: "Bir fiyat ve onun başabaş olasılığı, iki taraftan okunan aynı sayıdır.",
      },
      formulaTitle: "Olasılıklar nasıl hesaplanır",
      formula: [
        "oran = 1 / olasılık",
        "olasılık = 1 / oran",
        "başabaş olasılığı = 1 / oran",
        "kombine olasılığı = p₁ × p₂ × … × pₙ",
        "kombine oranı = oran₁ × oran₂ × … × oranₙ",
      ],
      explainerTitle: "Önce olasılık, sonra fiyat",
      explainer: [
        "Her fiyat olasılık hakkında bir iddiadır ve ikisi arasındaki çevrim tek bir bölmedir: %40 olasılık 2.50 fiyat, 2.50 fiyat ise %40 olasılıktır. Bu çevrimi bahisten önce yapmak soruyu «bu bahsi sevdim mi?» olmaktan çıkarıp «bu sonucun zamanın %40'ından fazlasında gerçekleştiğini düşünüyor muyum?» hâline getirir — hakkında yanılabileceğin, dolayısıyla sorulmaya değer bir soru.",
        "Aynı sayı, fiyat tarafından okunduğunda başabaş olasılığıdır: bahsin nötr olması için bir sonucun taşıması gereken en düşük şans. 1.75 fiyatı %57,1 ister. 1.50 fiyatı %66,7 ister. Uzun fiyatlar çok az ister — 15.00 yalnızca %6,7 — bu yüzden ucuz görünürler ve bu yüzden şirketler marjı oraya yüklerler. Başabaş olasılığı bir bahsin dürüst testidir: sonucun bunu aştığını savunamıyorsan fiyat cömert değil, doğrudur.",
        "Kombinelerde olasılık sezgiye ters düşer. Bağımsız ayaklar çarpılır: her birini %50 gördüğün üç bahis birlikte %12,5 eder, yarıya yakın rahatlatıcı bir şey etmez. %60'lık dört ayak %12,96 verir. Birleşik oran da aynı şekilde çarpılır ve tuzak buradadır: 15.00'lık bir kombine, %6,7'lik bir olay istediğini ve şirket marjının her ayağa uygulanıp sonra bileşiklendiğini fark edene kadar fırsat gibi görünür. Her ayağı %5 marjlı dört ayaklı bir kombine neredeyse %21 toplam marj taşır.",
        "Akılda tutulacak bir varsayım: bu hesaplayıcı çarpar, yani ayakların bağımsız olduğunu kabul eder. Aynı maçtan iki sonuç — bir takımın kazanması ve forvetinin gol atması — ilişkilidir ve olasılıklarını çarpmak ikisinin birlikte gelme şansını düşük gösterir. Aynı maç kombinelerini şirketler tam bu yüzden ayrı fiyatlar: o ilişkiyi hesaplamak zordur. Buradaki sayıyı bir yanıt değil, alt sınır olarak gör.",
      ],
      faq: [
        {
          q: "Başabaş olasılığı nedir?",
          a: "O fiyattan yapılan bir bahsin uzun vadede nötr olması için bir sonucun taşıması gereken şans. 1 bölü ondalık orana eşittir ve bahsin anlamlı olması için kendi tahmininin aşması gereken eşiktir.",
        },
        {
          q: "Kombinemin olasılığı neden bu kadar düşük?",
          a: "Çünkü olasılıklar çarpılır. Eklenen her ayak bütünü daha az olası kılar ve makul ayaklardan oluşan bir zincir hızla olası olmayan bir bahse dönüşür. Oran buna göre yükselir ama biriken marj da yükselir.",
        },
        {
          q: "Aynı maç kombineleri için geçerli mi?",
          a: "Tam olarak değil. Çarpmak ayakların bağımsız olduğunu varsayar, aynı maçtaki sonuçlar ise genellikle bağımsız değildir. İlişkili ayaklarda gerçek olasılık farklıdır — sıklıkla çarpımdan yüksek — ve şirketler bu piyasaları bu yüzden ayrı fiyatlar.",
        },
        {
          q: "Bir fiyatın zımni olasılığı gerçek olasılık mıdır?",
          a: "Değil. İçinde hâlâ şirketin marjı vardır, dolayısıyla piyasanın dürüst tahmininden sistematik olarak yüksektir. Kendi sayınla karşılaştırmadan önce marj hesaplayıcısıyla çıkar.",
        },
      ],
    },
  },
};

export default tr;
