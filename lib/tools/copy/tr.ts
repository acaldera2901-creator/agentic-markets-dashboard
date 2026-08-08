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
      takeaway:
        "Her oran, kılık değiştirmiş bir olasılıktır. Önce çevir, sonra tartış: 2.50, bahis şirketinin sana %40 dediği anlamına gelir.",
      example: {
        title: "Tek fiyat, her format",
        rows: [
          { label: "Sen yazarsın", value: "2.50" },
          { label: "Amerikan", value: "+150" },
          { label: "Kesirli", value: "3/2" },
          { label: "Hong Kong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Zımni olasılık", value: "%40,00" },
        ],
        note:
          "Birini değiştir, diğerleri onu izler. Yuvarlamaya dikkat: bilinen −110 ondalıkta 1.9091'dir ve %52,38 ima eder, ekranda görünen 1.91 ise %52,36 — hiçbir şey gibi görünüp önemli olan bir fark, çünkü avantaj puanın onda birlerinde oynanır.",
      },
      explainerTitle: "Bir fiyatı her formatta okumak",
      explainer: [
        "**Oran, başka kılıkta bir olasılıktır.** Ondalık oran — Avrupa standardı — yatırılan birim başına toplam dönüşü verir: 2.50, riske edilen her 1 için bahis dahil 2.50 öder. Kesirli oran kârı bildirir: 3/2, riske edilen iki birime karşılık üç birim kâr, yani aynı 2.50. Amerikan oranı 100 yatırınca ne kazandığını (+150) ya da 100 kazanmak için ne riske etmen gerektiğini (−110) söyler. Hong Kong, Malay ve Indonesian Asya formatlarıdır ve önemlidirler, çünkü en keskin fiyatlar sıklıkla oradadır.",
        "Okumaya değer sayı son sıradaki. **Zımni olasılık, 1 bölü ondalık orandır** ve kendi tahmininle doğrudan karşılaştırabileceğin tek sayıdır: farklı gösterimlerdeki iki oranı karşılaştırmak, iki olasılığı karşılaştırmaktan kolay değildir. Bu aracın senin için kaldıramayacağı bir sınır: **zımni olasılık hâlâ bahis şirketinin marjını içerir**, yani bir piyasadaki tüm sonuçları topla ve %100'ü geçersin. Piyasanın fiyatlanmış görüşü yerine dürüst görüşünü istiyorsan marj hesaplayıcısından geçir.",
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
      takeaway:
        "Marj, bir görüşe sahip olma hakkı için ödediğin bedeldir. İki şirket, aynı maç — ve fark, paradır.",
      example: {
        title: "Aynı maç, iki şirket",
        rows: [
          { label: "Eğlence odaklı şirket", value: "1.90 / 1.90 · marj %5,26" },
          { label: "Keskin şirket", value: "1.98 / 1.98 · marj %1,01" },
          { label: "Adil çizgi, ikisi de", value: "2.00 / 2.00 · her biri %50" },
          { label: "Gerçek %50'de EV'in", value: "bahis başına −%5'e karşı −%1" },
        ],
        note:
          "Aynı görüş, aynı maç. 100'ü iki yüz kez yatırmak ilk şirkette 1.000, ikincisinde 200 maliyet çıkarır: sekiz kuruşluk fiyat farkı bir sezonda 800 eder. Bahsin en ucuz avantajıdır ve hiçbir model gerektirmez.",
      },
      explainerTitle: "Marj, bahsin fiyatıdır",
      explainer: [
        "**Adil bir iki sonuçlu piyasa her iki tarafı 2.00 fiyatlar.** Zımni olasılıklar %50 ve %50, toplamı tam %100 ve hiçbir tarafın avantajı yok. Gerçek piyasalar 1.90 ve 1.90 fiyatlanır: bu zımni olasılıklar her biri %52,63, toplamı %105,26 ve **fazladan 5,26 puan bahis şirketinin marjıdır** — overround. Hangi tarafı oynarsan oyna onu ödüyorsun. Marjlar piyasaya göre çok değişir: keskin şirketlerin ana çizgileri %2'nin altına iner, buna karşılık şampiyonluk ve oyuncu piyasaları rutin olarak %8 ve üzerini taşır, çünkü şirketler fiyatlarının orada en az sınandığını bilir.",
        "Marjı çıkarmak adil çizgiyi, no-vig çizgisini verir. Bu hesaplayıcı bunu oranlı yapar — her zımni olasılık toplamlarına bölünür, böylece yeniden tam %100 olurlar — ve **o adil çizgi her +EV kararının referansıdır**: bir bahsin beklenen değeri ancak senin olasılığın adil olanı geçerse pozitiftir, sadece fiyatlananı geçmesi yetmez. Açık bir sınır: gerçek şirketler düşük olasılıklı sonuçlara daha fazla marj yükler, dolayısıyla belirgin favorili bir piyasada bu yöntem favoriyi biraz düşük gösterir. Dengeli ana çizgilerde sapma küçüktür; piyango tarzı şampiyonluk bahislerinde adil çizgi bir tahmindir.",
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
      takeaway:
        "Piyasadan daha iyi tahmin etmen gerekmiyor: yalnızca en keskin şirketten daha yavaş bir şirket bulman gerekiyor.",
      example: {
        title: "Olasılığı keskin bir şirketten ödünç almak",
        rows: [
          { label: "Keskin şirket, iki taraf", value: "1.95 / 1.95" },
          { label: "Adil olasılık, marj çıkarılmış", value: "%50,00" },
          { label: "Başabaş fiyatı", value: "2.00" },
          { label: "Senin şirketin verdiği", value: "2.10" },
          { label: "100 bahiste EV", value: "+5,00 (+%5)" },
        ],
        note:
          "Hiçbir görüş gerekmedi: keskin çizgi olasılığı verdi, senin şirketin ise adil değeri 2.00 olan sonucu 2.10 fiyatladı. Keskin fiyatları 1.90/1.90 yap, adil olasılık yine %50 kalır — marjı çıkarmanın anlamı tam budur: cevap, komisyonla birlikte kaymaz.",
      },
      explainerTitle: "Beklenen değer gerçekte ne söyler",
      explainer: [
        "**Beklenen değer, sonsuz kez tekrarlayabileceğin bir bahsin ortalama sonucudur.** İki girdi, hiç görüş yok: sunulan fiyat ve sonuca verdiğin olasılık. Bir takımın zamanın %55'inde kazandığını düşünüyorsan ve biri 2.00 veriyorsa hesap hemen çıkar — %55 bir birim kazanır, %45 kaybedersin, yani yatırılan birim başına 0,10 birim. Bu %10 avantajdır ve +EV bundan fazlasını ifade etmez.",
        "**Olasılık, neredeyse herkesin sessizce kaybettiği yerdir.** 5 puanlık bir hata %4 avantajı %1 kayba çevirir ve göz kararı tahminler bundan çok daha fazla sapar. Bu yüzden bu hesaplayıcının ikinci modu var: içgüdüne güvenmek yerine keskin bir şirkette iki tarafı al, marjı çıkar ve çıkan adil olasılığı kullan. Sonucu bir oran gibi oku, vaat gibi değil — %4 avantaj tek bahiste hiçbir şey getirmez, ancak yüzlerce bahiste ve olasılık doğruysa görünür. İşte bu yüzden bahis miktarı avantaj kadar önemlidir.",
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
      takeaway:
        "Kelly, bahsi avantaja göre ölçekler, inancına göre değil — ve neredeyse herkes onun söylediğinden bilinçli olarak daha az oynamalı.",
      example: {
        title: "1.000 kasa ile bunun anlamı",
        rows: [
          { label: "Kasa", value: "1.000" },
          { label: "Fiyat · olasılığın", value: "2.00 · 55%" },
          { label: "Avantaj", value: "+10%" },
          { label: "Tam Kelly", value: "10% → bahis başına 100" },
          { label: "Yarım Kelly", value: "5% → bahis başına 50" },
        ],
        note:
          "Üst üste beş kayıp — bu fiyatta 54 dizide bir — tam Kelly'de 590 bırakır ve 1.000'e dönmek için +%69 gerekir. Aynı seri yarım Kelly'de 774 bırakır, +%29 yeter. Aynı avantaj, aynı bahisler, yarısı kadar çukur.",
      },
      explainerTitle: "Kötü serinin bitiremeyeceği bir miktar seçmek",
      explainer: [
        "Kelly kriteri, beklenen değerin atladığı soruyu yanıtlar: elinde avantaj varken gerçekte ne kadar riske etmeli? Az oynarsan gerçek bir avantaj anlam taşıyacak kadar hızlı bileşiklenmez. Çok oynarsan matematik aleyhine döner: yarıya inen bir kasa geri dönmek için %100 artış ister, yani fazla büyük miktarlar her tek bahis lehte olsa bile büyümeyi yok eder. En uygun oran, avantajın net orana bölümüdür ve **inançla değil avantajla ölçeklenir**: 2.00 fiyatta %10 avantaj kasanın %10'unu, aynı avantaj 5.00 fiyatta yalnızca %2,5'ini ister.",
        "**Tam Kelly'yi neredeyse kimse oynamamalı**, çünkü formül olasılığının tam doğru olduğunu varsayar ve hiçbir zaman doğru değildir. Ona olduğundan büyük bir avantaj ver, gerçekte sahip olduğun avantaj için fazla büyük bir miktarı gönülle önerir: ortalamada haklıyken bir kasayı kaybetmenin en hızlı yolu. Yarım Kelly teorik büyümenin dörtte birinden vazgeçer ve oynaklığı yaklaşık yarıya indirir; gerçek modellere sahip birçok profesyonel çeyrek Kelly kullanır. Fiyat avantaj sunmuyorsa doğru miktar sıfırdır: negatif Kelly oranı bahsin diğer tarafta olduğunu gösterir, bu tarafta daha az oynamak anlamına gelmez.",
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
      takeaway:
        "Ayaklar çarpılır, bahis şirketinin payı da onlarla birlikte. 1.80'lik dörtlü kombine, %9,5'lik bir olay ister.",
      example: {
        title: "Dörtlü kombine gerçekte neye mal olur",
        rows: [
          { label: "Dört ayak", value: "her biri 1.80 · %55,56" },
          { label: "Birleşik oran", value: "10.50" },
          { label: "Birleşik olasılık", value: "%9,53" },
          { label: "Ayak başına marj", value: "%5" },
          { label: "Kombinede marj", value: "%21,6" },
        ],
        note:
          "Oran, ne istediğini görene kadar cömert görünür: %9,5'lik bir olay. Ve şirketin payı dört kez bileşiklendi — 1,05⁴ − 1 = %21,6 — yani aynı dört seçim sana tek bahsin marjının dört katına mal olur. Aynı maçtan ilişkili ayaklar başka bir konudur: çarpmak onları düşük gösterir ve şirketler aynı maç kombinelerini tam bu yüzden ayrı fiyatlar.",
      },
      explainerTitle: "Önce olasılık, sonra fiyat",
      explainer: [
        "**Her fiyat, olasılık hakkında bir iddiadır** ve çevrim tek bir bölmedir: %40, 2.50 fiyatıdır; 2.50 ise %40 olasılıktır. Bu çevrimi bahisten önce yapmak soruyu «bu bahsi sevdim mi?» olmaktan çıkarıp «bu, zamanın %40'ından fazlasında oluyor mu?» hâline getirir — yanılabileceğin bir soru. Fiyat tarafından okunduğunda aynı sayı **başabaş olasılığıdır**: bahsin nötr olması için bir sonucun taşıması gereken en düşük şans. 1.75 %57,1 ister; 1.50 %66,7 ister; 15.00 yalnızca %6,7 — uzun oranların ucuz görünmesinin ve şirketlerin marjı oraya yüklemesinin nedeni bu.",
        "**Kombinelerde olasılık sezgiye ters düşer.** Bağımsız ayaklar çarpılır: her birini %50 gördüğün üç bahis birlikte %12,5 eder, yarıya yakın rahatlatıcı bir şey değil. %60'lık dört ayak %12,96 verir. Birleşik oran da aynı şekilde çarpılır ve tuzak buradadır — sayı büyürken şans küçülür, marj da onunla bileşiklenir. Alttaki varsayımı unutma: burada çarpılıyor, yani bağımsızlık kabul ediliyor. Aynı maçtan iki sonuç ilişkilidir ve orada gerçek olasılık farklıdır, genellikle çarpımdan yüksek.",
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

    "arbitrage-calculator": {
      metaTitle: "Arbitraj Hesaplayıcı — bahsi bürolar arasında bölmek | BetRedge",
      metaDescription:
        "Ücretsiz arbitraj hesaplayıcı: her sonuç için farklı bürolardaki en iyi oranı gir; örtük olasılıkların toplamını, bahsin nasıl bölüneceğini ve kârı gör — ya da kâr olmadığını.",
      h1: "Arbitraj hesaplayıcı",
      lede:
        "Her sonuç için mevcut en iyi oranı gir ve iki büronun birlikte marj bırakıp bırakmadığını gör — bırakıyorsa bahsi nasıl böleceğini de.",
      labels: {
        inputTitle: "Her sonuçta en iyi oran",
        outcome: "Sonuç",
        addOutcome: "Sonuç ekle",
        removeOutcome: "Kaldır",
        total: "Toplam bahis",
        resultTitle: "Nasıl bölünür",
        profit: "Kâr",
        impliedSum: "Örtük olasılıkların toplamı",
        stakeOn: "Sonuca yatırılan",
        guaranteedReturn: "Her sonuçta dönen tutar",
        verdictArb:
          "Oranlar %100'ün altında toplanıyor: böyle bölündüğünde her sonuç aynı tutarı geri veriyor.",
        verdictNoArb:
          "Oranlar %100'ün üzerinde toplanıyor, yani burada arbitraj yok — hangi sonuç gelirse gelsin her bölüşüm bu marjı kaybeder.",
        hint: "Her sonuç için tek oran, her biri o tarafta en çok ödeyen büroda. Ondalık virgülü kabul eder: 2,10, 2.10 gibi çalışır.",
      },
      takeaway:
        "Arbitraj bir tahmin değildir. Kimin kazanacağını bilmeni asla istemez; iki büronun kendi marjlarından daha fazla ayrışmasını ister.",
      example: {
        title: "İki büro, bölünecek 1.000",
        rows: [
          { label: "Oranlar, tarafa bir büro", value: "2.10 · 2.10" },
          { label: "Örtük olasılıkların toplamı", value: "%95,24" },
          { label: "Her tarafa, 1.000 üzerinden", value: "500 · 500" },
          { label: "Her sonuçta dönen tutar", value: "1.050" },
          { label: "Kâr", value: "+50 (+%5,00)" },
        ],
        note:
          "Aynı pazar tek büroda 1.90/1.90 fiyatlandığında toplam %105,26 olur ve nasıl bölersen böl −%5,00 geri verir. İki çizgi arasında maçla ilgili hiçbir şey değişmedi: bütün fark hangi büronun hangi tarafta daha çok ödediğinde ve oranlar hâlâ açıkken ikisinde de bakiyeli hesabın olup olmadığında.",
      },
      explainerTitle: "İki büro yeterince ayrıştığında",
      explainer: [
        "**Her oranın tersini topla, bütün pazarı tek bir sayıda tutuyorsun.** Tek bir büroda bu sayı her zaman %100'ü geçer — orada tutan şey marjdır. Ama bir tarafın en iyi oranı ile diğerinin en iyi oranı sık sık farklı bürolarda durur ve birleştirildiğinde toplam %100'ün altına düşebilir. Koşulun tamamı bu: **örtük olasılıkların toplamı 1'in altında kalmalı**. Toplam bahsi bu örtük olasılıklarla orantılı böl; her sonuç aynı tutarı geri verir, yani geri aldığın şey maçın sonucuna bağlı olmaktan çıkar. İki tane 2.10 oranı %95,24 toplar ve 1.000'lik bahsin her tarafına 500, maç nasıl biterse bitsin 1.050 döndürür.",
        "**Pratikte bu, aritmetiğin ima ettiğinden çok daha seyrek kapanır ve gerekçeler formülden daha ağır basar.** Oranlar hareket eder: yakaladığın açık genellikle geriden gelen büronun kendini toparlamasıdır ve ilk ayakla ikinci ayak arasındaki saniyelerde kaybolabilir — elinde, değeri için değil korunmak için seçilmiş bir oranda, sıradan ve korumasız bir bahis kalır. Bahis limitleri tam da açığın en geniş olduğu yerde sıkar; kâğıt üzerindeki %5 çoğu zaman binin değil kırk birimin %5'idir. Ve **bürolar bunu sistemli yapan hesapları kısıtlar**: önce düşük limitler, sonra reddedilen bahisler ve kapatmalar. Birkaç büroda bekleyen sermayeyi ve aralarındaki kur farkını da ekle; arbitraj bir makineden çok, ince bir marjı kazımanın yavaş ve operasyonel olarak yorucu bir yolu gibi okunur.",
      ],
      faq: [
        {
          q: "Her büroda hesap açmam gerekir mi?",
          a: "Evet. Arbitraj yalnızca o belirli oranları veren belirli bürolar arasında vardır; dolayısıyla oranlar hareket etmeden önce her birinde bakiyeli hesap gerekir. Birkaç şirkete dağılmış ve zamanın çoğunda bekleyen bu sermaye, neredeyse hiçbir hesaplayıcının göstermediği maliyettir.",
        },
        {
          q: "İkinci oran ben yatırmadan önce değişirse ne olur?",
          a: "Elinde ilk ayak tek başına kalır: değeri için değil korunmak için seçilmiş bir oranda sıradan bir bahis. Hareket etmesi en muhtemel tarafı önce oyna ve korumasız kalmayı bir kaza değil, riskin parçası olarak gör.",
        },
        {
          q: "Bürolar arbitraj oynayanları neden kısıtlar?",
          a: "Çünkü marjları eğlence amaçlı müşterilerin dengeli akışından beslenir ve her zaman yalnızca bir tarafın en iyi oranını alan bir hesap onlar için saf maliyettir. Kısıtlamalar hesap kapatılmadan çok önce, sessizce düşen bahis limitleri olarak gelir.",
        },
        {
          q: "Arbitraj bahsi yasal mı?",
          a: "Faaliyetin kendisi yasaldır: ilan edilmiş oranlarda sıradan bahisler yapıyorsun. Yasaklayabilecek olan, arbitraj saydığı bahisleri kısıtlama, reddetme veya iptal etme hakkını genellikle saklı tutan büronun kendi kural ve koşullarıdır. Yasal olmak ile izin verilmiş olmak aynı şey değildir.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Kombine Kupon Hesaplayıcı — birleşik oran, gerçek olasılık ve bileşik marj | BetRedge",
      metaDescription:
        "Ücretsiz kombine hesaplayıcı: her ayağı gir, birleşik oranı, kuponun gerçekte istediği olasılığı ve şirketin marjının ayak ayak nasıl bileşiklendiğini gör.",
      h1: "Kombine kupon hesaplayıcı",
      lede:
        "Eklediğin her ayak oranı çarpar — ve onunla birlikte şirketin aldığı payı da çarpar. Kupon yatmadan önce iki sayı da burada.",
      labels: {
        inputTitle: "Ayaklar",
        leg: "Ayak",
        addLeg: "Ayak ekle",
        removeLeg: "Çıkar",
        marginPerLeg: "Ayak başına şirket marjı (%)",
        resultTitle: "Kombine ne değerde",
        combinedOdds: "Birleşik oran",
        impliedProb: "Tutma olasılığı",
        compoundMargin: "Bileşik marj",
        verdict:
          "Çarpmak, ayakların bağımsız olduğunu varsayar. Aynı maçtan iki seçim bağımsız değildir: gerçek olasılıkları genelde çarpımdan yüksektir, şirketler de bu yüzden aynı maç kombinelerini kendi modelleriyle fiyatlar.",
        hint: "Ayak başına bir ondalık oran, en fazla sekiz. Ayak marjı sayı olarak girilir: 5, %5 demektir — dar bir iki yönlü pazarın tuttuğu paya yakın.",
      },
      takeaway:
        "Şirketin aldığı pay ayaklar boyunca toplanmaz, bileşiklenir — 1.80 oranlı dört ayak neredeyse başa baş dört bahis gibi görünür ve %9,53 olasılıklı tek bir olaydır.",
      example: {
        title: "1.80 oranlı dört ayak, %9,53 olasılıklı tek bahis",
        rows: [
          { label: "Ayaklar", value: "4 × 1.80" },
          { label: "Birleşik oran", value: "10.50" },
          { label: "Tutma olasılığı", value: "%9,53" },
          { label: "Ayak başına marj", value: "%5" },
          { label: "Bileşik marj", value: "%21,55" },
        ],
        note:
          "Tek başına her ayak, kimsenin üzerinde durmadığı bahistir: %55,56 örtük olasılık, kazanınca 1.80. Zincirlendiğinde dördü birlikte %9,53 olasılıklı bir olay ister — ve şirketin her ayakta tuttuğu %5, kuponda 1,05⁴ − 1 = %21,55 olur. Bahse kaybetmenin yeni yollarından başka bir şey eklenmedi: oran yükseldi çünkü olasılık düştü.",
      },
      explainerTitle: "Oran neden olasılıktan hızlı büyür",
      explainer: [
        "**Kombine, birkaç bahis değil, kaybetmenin birkaç yolu olan tek bir bahistir.** Birleşik oran ayakların çarpımıdır — 1.80 dört kez alındığında 10.4976 eder — olasılık ise olasılıkların çarpımıdır ve aritmetiğin dostluğu tam orada biter: tek tek neredeyse başa baş diyeceğin dört seçim birlikte %9,53 verir. Marj da aynı şekilde davranır ve bu, neredeyse kimsenin hesaba katmadığı kısımdır. Ayak ayak toplanmaz, **bileşiklenir**: dört ayağın her birinde %5 tutan bir şirket kuponda 1,05⁴ − 1 = %21,55 tutar; sekiz ayakta aynı ayak başına %5 artık %47,75 olmuştur. Ödeme cömert görünür çünkü olasılık çöktü, kimse aynı riske daha fazla ödediği için değil.",
        "**Kombineler bahsin en çok tanıtılan ürünü ve müşteri için en elverişsiz olanıdır**; bu iki cümle aynı olgunun iki yüzüdür: bileşik marj ne kadar büyükse, şirket o kupona oran artışı, iade sigortası ve reklam için o kadar çok harcayabilir. Bir ayaktaki ince avantaj, üç ayak daha marjla çarpılmaya dayanmaz — aynı seçimler tekli oynandığında marjı birer kez öder, dörtlü kombine onu dört kez öder. Bir de çarpmanın varsaydığı şey kalır: **ayakların bağımsızlığı**. Aynı maçtan iki seçim ilişkilidir, dolayısıyla orada çarpmak yanlış hesaptır: ev sahibinin kazanması ile onun santrforunun gol atması genelde birlikte gelir, yani ikilinin olasılığı çarpımın söylediğinden yüksektir; birbirini neredeyse dışlayan ayaklar ise çok daha az değerlidir. Şirketler bu yüzden aynı maç kombinelerini teklilerden kurmana izin vermek yerine kendi modelleriyle kurar — ve bu hesaplayıcı da bu yüzden farklı maçlardan ayaklarda dürüsttür.",
      ],
      faq: [
        {
          q: "Aynı maç kombineleri için geçerli mi?",
          a: "Tam olarak değil. Burada çarpma yapılır ve çarpmak ayakların bağımsız olduğunu varsayar. Aynı maçın sonuçları birlikte hareket eder, yani ikilinin gerçek olasılığı farklıdır — sıklıkla çarpımdan yüksek. Şirketler bu pazarları tam bu yüzden teklilerden değil, kendi modelleriyle fiyatlar.",
        },
        {
          q: "Birleşik olasılık neden bu kadar düşük?",
          a: "Çünkü olasılıklar ortalanmaz, çarpılır. %55,56 oranındaki dört ayak %9,53 verir: eklediğin her ayak tüm kuponu daha olanaksız kılar, makul seçimlerden oluşan bir zincir hızla olanaksız bir bahse döner. Oran buna göre yükselir ve oranla birlikte birikmiş marj da yükselir.",
        },
        {
          q: "Bileşik marj tam olarak nedir?",
          a: "Her ayak onu çarptıktan sonra şirkete kalan pay. Tek bir ayağın sana kaça geldiğini gir — dar bir iki yönlü pazarda yaklaşık %5 — hesaplayıcı onu bileşikler: bir artı marj, ayak sayısı kuvvetine, eksi bir. %5 ile dört ayak %21,55, sekiz ayak %47,75 eder.",
        },
        {
          q: "Dört tekli mi, bir dörtlü kombine mi?",
          a: "Avantajla oynayan için dört tekli: aynı dört seçim marjı çarpmak yerine birer kez öder ve yanlış bir ayak tüm kupon yerine tek bir bahse mal olur. Kombine varyans satın alır — büyük bir ödemenin küçük şansı — ve bu varyansın fiyatı bileşik marjdır.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "Bahis ROI hesaplayıcı — sermayenin getirisi | BetRedge",
      metaDescription:
        "Ücretsiz bahis ROI hesaplayıcı: sermaye ve kârı gir, sermayenin getirisini, dönem sonu sermayeyi ve aynı kârın neden %4 yield olduğunu gör.",
      h1: "ROI hesaplayıcı",
      lede:
        "Sermayenin bir dönemde ne kazandırdığı — ve aynı 400 kârın burada neden %40 ROI, diğer sayfada neden %4 yield olduğu.",
      labels: {
        inputTitle: "Sermaye ve sonuç",
        capital: "Sermaye",
        profit: "Kâr",
        resultTitle: "Bu sermayenin getirisi",
        roi: "ROI",
        endingCapital: "Dönem sonu sermaye",
        hint: "Kâr net girilir ve negatif olabilir: -250 zararla kapanan bir dönemdir. Sermaye, riske attığın kasadır; oynadığın toplam tutar değil.",
        verdict:
          "ROI tamamen paydaya bağlıdır, o yüzden paydayı açıkça söyle: 1.000 kasada 400 kâr %40 eder, aynı 400 kâr 10.000 hacim üzerinde %4 yield eder. İkisi de arkasındaki dönem ve bahis sayısı olmadan pek bir şey anlatmaz.",
      },
      takeaway:
        "ROI kasanın ne kazandırdığını söyler. Stratejinin iyi olup olmadığını söylemez, çünkü aynı %40 hem 200 bahisten hem de şanslı bir cumartesiden gelebilir.",
      example: {
        title: "1.000 kasada 400 kâr",
        rows: [
          { label: "Sermaye", value: "1.000" },
          { label: "Dönem kârı", value: "+400" },
          { label: "ROI", value: "%+40,00" },
          { label: "Dönem sonu sermaye", value: "1.400" },
          { label: "Aynı 400, 10.000 hacim üzerinde", value: "yield %+4,00" },
        ],
        note:
          "İki yüzde de tek ve aynı sonucu anlatıyor. Kasada %+40,00 seviyesine gelmek 50 birimlik 200 bahis aldı — 10.000 hacim, sermayenin on katı — ve o hacmin %4,00 kadarı yine aynı 400. Kasayı on kez değil iki kez çevirirsen %40 ROI'nin arkasındaki yield %20 olmak zorunda kalır ki bunu neredeyse kimse sürdüremez.",
      },
      explainerTitle: "Riske atılan paraya göre ölçülen kâr",
      explainer: [
        "**ROI, kârın riske attığın paraya bölünmesidir** ve bütün zorluk bu cümlenin ikinci yarısında saklıdır. Sezonu 400 önde kapatan 1.000 birimlik bir kasa %40,00 getirmiştir ve bu sayı, aynı 1.000 ile yapabileceğin her şeyle dürüstçe karşılaştırılabilir. Anlatamadığı şey bahislerin kendisidir. %40 getiri; kaç bahis gerektiğini, ne kadar sürede olduğunu, yolda bakiyenin sıfıra ne kadar yaklaştığını söylemez — ve tekrar edip etmeyeceğine karar veren tam olarak bu üç şeydir. Bu yüzden **sayıyı söylemeden önce paydayı açıkça belirt**: başlangıç kasası, ortalama bakiye ve toplam yatırım aynı bahis kümesinden üç ayrı yüzde üretir ve en gösterişli olan her zaman en küçüğüdür.",
        "**Aynı 400 kâr hem %40 ROI hem de %4 yield'dir** ve hangisini elinde tuttuğunu bilmek iki sayfanın değerinin neredeyse tamamıdır. ROI sermayeye göre ölçer, yield hacme göre — yani yatırılan her stake'in toplamına. Örneğimiz buraya 50 birimlik 200 bahisle geldi, yani kasadan 10.000 geçti: sermayenin on katı ve bunun %4,00 kadarı tam olarak o 400. **Bu çarpan iki sayı arasındaki köprünün tamamıdır** ve ROI'nin tek başına çok oynayanı kayırmasının sebebidir. 1.000 kasayı %4 yield ile on kez çeviren de, iki kez %20 yield ile çeviren de %40 bildirir; ikisinden yalnızca biri tekrarlanabilir. Bahis başına kaliteyi yield hesaplayıcıda ölçersin; ROI'yi gerçekten işe yaradığı yer için sakla: o paranın getirisini alternatiflerle karşılaştırmak.",
      ],
      faq: [
        {
          q: "ROI ile yield arasındaki fark nedir?",
          a: "ROI kârı sermayeye böler, yield ise hacme — yani tüm stake'lerin toplamına. Aynı 400 kâr, 1.000 kasanın %40,00 kadarı ve 10.000 hacmin %4,00 kadarıdır. ROI paranın ne kazandırdığını, yield bahislerin ne kadar iyi olduğunu söyler; aralarındaki oran ise kasayı kaç kez çevirdiğindir.",
        },
        {
          q: "Paydaya hangi sermayeyi yazmalıyım?",
          a: "Açıkça söyleyip sonra sabit tutabildiğini — genelde başlangıç kasası. Zirve bakiye, ortalama bakiye ve toplam yatırım aynı bahislerden farklı yüzdeler üretir, yani sayı ancak tanımının yanında bir anlam taşır. Dönem ortasında para ekleyip paydayı yeniden bildirmemek, bir ROI'yi şişirmenin en yaygın yoludur.",
        },
        {
          q: "%40 ROI iyi mi?",
          a: "Döneme ve bahis sayısına bağlı. Bir sezon ve 200 bahis üzerinde güçlü ama makul bir sonuçtur. Aynı %40 yirmi bahiste, şansın kendi başına ürettiği aralığın rahatça içinde kalır; bir haftada %40 ise genelde stake'lerin kasaya göre büyük olduğunu, avantajın büyük olduğunu değil, gösterir.",
        },
        {
          q: "ROI negatif olabilir mi?",
          a: "Evet ve hesaplayıcı bunu saklamak yerine gösterir: 1.000 kasada 250 zarar %-25,00 eder. Toparlanma simetrik değildir — %-25 sonrasında başa dönmek için kalanın %+33,33 kadarına ihtiyaç duyarsın — ve bu yüzden düşüş, getiri kadar dikkat hak eder.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Bahis yield hesaplayıcı — oynanan tutar başına kâr | BetRedge",
      metaDescription:
        "Ücretsiz yield hesaplayıcı: bahis sayısı, ortalama stake ve kârı gir; hacmi ve yield değerini gör — ve sayının anlam kazanması için kaç bahis gerektiğini öğren.",
      h1: "Yield hesaplayıcı",
      lede:
        "Kârın kasana değil, oynadığın her şeye göre ölçümü — parası farklı iki bahisçiyi karşılaştıran tek sayı.",
      labels: {
        inputTitle: "Bahisler, stake ve sonuç",
        bets: "Bahis sayısı",
        avgStake: "Ortalama stake",
        profit: "Kâr",
        resultTitle: "Hacme göre yield",
        turnover: "Toplam hacim",
        yieldPercent: "Yield",
        hint: "Hacmi biz hesaplıyoruz: bahis sayısı × ortalama stake. Her bahsin stake'ini say, aynı anda riskte olan parayı değil. Kâr net girilir ve negatif olabilir.",
        verdictNoise:
          "Bin bahsin altında bu sayı büyük ölçüde gürültüdür. 2.00 oranında sabit stake ile yield'in bir standart sapması 200 bahiste 7,07 puan, 1.000 bahiste hâlâ 3,16 puandır: onu bir aralık gibi oku, sonuç gibi değil.",
        verdictVolume:
          "Bin bahsi geçtikten sonra sayı bilgi taşımaya başlar, ama 2.00 oranında bir standart sapma yine 3,16 puan civarındadır — aynı hacimde %+4 ile %+7 iki farklı beceri seviyesi değildir.",
      },
      takeaway:
        "Yield, bahisçileri karşılaştıran ölçüdür: 10.000 hacim üzerinde %4, yirmi bahiste toplanmış %40 ROI'den daha değerlidir.",
      example: {
        title: "50 birimlik 200 bahis, 400 kâr",
        rows: [
          { label: "Bahis sayısı", value: "200" },
          { label: "Ortalama stake", value: "50" },
          { label: "Toplam hacim", value: "10.000" },
          { label: "Kâr", value: "+400" },
          { label: "Yield", value: "%+4,00" },
          { label: "Aynı 400, 1.000 kasada", value: "ROI %+40,00" },
        ],
        note:
          "Tek bir sonuç, aynı derecede dürüst iki yüzde: bahis şirketinden geçen 10.000'in %4,00 kadarı ve hiç riske girmiş olan 1.000'in %40,00 kadarı. Aradaki mesafe yalnızca kasanın on kez çevrilmesidir. Örneklem ise iki sayıdan da ağır basar: 200 bahiste yield'in bir standart sapması 7,07 puandır, yani bu %+4,00 yazı tura serisinin kendi başına ürettiği aralığın içinde kalır.",
      },
      explainerTitle: "İki bahisçiyi karşılaştıran sayı",
      explainer: [
        "**Yield, kârın hacme bölünmesidir** — yatırılan her stake'in toplamına, hesaptaki bakiyeye değil. Bahisçilerin birbirine söylediği sayı olmasının nedeni tam olarak paradan bağımsız olmasıdır: stake 5 de olsa 500 de olsa %4, %4'tür. **Herkesin yanlış girdiği veri paydadır** ve hata her zaman aynı yöne gider. Hacim, her bahsin stake'ini yatırıldığı anda sayar; yani 50 birimlik 200 bahis 10.000 eder, aynı anda yalnızca 50 riskte olsa bile, ve bu bahislerin döndüğü 1.000 kasa, bölünecek sayı değildir. Bu yüzden bu sayfa bahis sayısı ile ortalama stake'i ister ve hacmi gözünün önünde hesaplar. Aynı kârı sermayeye göre ölçersen ROI elde edersin: ROI hesaplayıcı karşılaştırmanın diğer yarısını tutar; orada 400 kâr, 1.000 kasanın %40,00 kadarı ve 10.000 hacmin %4,00 kadarıdır.",
        "**Yaklaşık %5'in üzerinde, ciddi hacimde sürdürülen bir yield nadirdir.** Var olduğu yerde genelde limitleri düşük yumuşak pazarlarda yaşar ve stake büyüdükçe incelir, çünkü onu mümkün kılan oranlar sert vurulmaya dayanmaz. Bunun çok üzerindeki uzun vadeli her rakamı kısa örneklem, yumuşak niş ya da farklı bir hacim tanımı olarak ele al. Ve **birkaç yüz bahsin altında sayı sonuç değil gürültüdür**: 2.00 oranında sabit stake ile yield'in bir standart sapması, bir bölü bahis sayısının kareköküdür — 200 bahiste 7,07 puan, 1.000 bahiste 3,16 puan, 2.500 bahiste 2,00 puan. %+4 bir yield, sıfırdan iki standart sapma uzağa ancak 2.500 bahis civarında ulaşır. Yüksek oranlarda salınım daha da geniştir: 3.00'te aynı 200 bahis 10 puanlık bir standart sapma taşır. Yirmi kazanılan bahsin dürüst okuması da budur: ölçülmüş bir avantaj değil, ayırt etmeye yetmeyecek kadar kısa bir örneklem.",
      ],
      faq: [
        {
          q: "Toplam hacmimi nasıl hesaplarım?",
          a: "Kazandığın ya da kaybettiğin her bahsin stake'ini toplayarak. 50 birimlik 200 bahis 10.000 hacim eder, arkasındaki kasa yalnızca 1.000 olsa bile. Net tutarı ya da bakiyeyi kullanma: hacim, bahis şirketinden geçen paradır ve bahis başına bir kez sayılır.",
        },
        {
          q: "%5 yield iyi mi?",
          a: "Binlerce bahis boyunca sürdürüldüyse evet — gerçek limitlere dayanabilenin üst sınırına yakındır. Çok daha yüksek değerler genelde yumuşak pazarlardan, kısa örneklemden ya da promosyon değerinden gelir ve stake yükseldikçe düşer, çünkü onları üreten oranlar kapatılır veya limitlenir.",
        },
        {
          q: "Yield'imin anlam kazanması için kaç bahis gerekir?",
          a: "Çoğu kişinin sandığından fazlası. 2.00 oranında sabit stake ile yield'in bir standart sapması 200 bahiste 7,07 puan, 1.000 bahiste 3,16 ve 2.500 bahiste 2,00 puandır; yani %+4 sıfırdan iki standart sapma uzağa ancak 2.500 bahis civarında ulaşır. Birkaç yüzün altında sayıyı aralık say.",
        },
        {
          q: "Stake'lerim çok değişiyorsa?",
          a: "O zaman bahis sayısı × ortalama stake yalnızca bir yaklaşımdır ve kazançlar büyük stake'lere denk geldiğinde seni kayırır. Gerçek stake'leri topla ve kârı bu toplama böl. Birim ile oynuyorsan birimleri say: oynanan birim başına yield aynı sayıdır ve dürüst tutmak daha kolaydır.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Bahis miktarı hesaplayıcı — hedef kâr için gereken miktar | BetRedge",
      metaDescription:
        "Ücretsiz bahis miktarı hesaplayıcı: oranı ve istediğin kârı gir, gereken miktarı, toplam dönüşü ve bu tek bahsin kasanın ne kadarını bağladığını gör.",
      h1: "Bahis miktarı hesaplayıcı",
      lede:
        "Bir hedef kârın belirli bir oranda istediği miktar — ve kasanın sessizce bağladığı payı.",
      labels: {
        inputTitle: "Oran ve hedef",
        odds: "Oran",
        targetProfit: "Hedef kâr",
        bankroll: "Kasa",
        resultTitle: "Bu hedefin maliyeti",
        stakeNeeded: "Gereken miktar",
        totalReturn: "Toplam dönüş",
        bankrollShare: "Kasanın payı",
        hint: "Miktarı yüzdeye çeviren şey kasadır: kasa olmadan miktar, yanında hiçbir şey olmayan bir sayıdır. Oranı ondalık yaz — 2.50, +150 değil.",
        verdictModest:
          "Bu miktar, bildirilen kasanın %5'inden azını bağlıyor; on maçlık bir kayıp serisi onu bitirmez. Oranla birlikte oku, tek başına değil: aynı hedef daha kısa bir oranda çok daha büyük bir bahis ister.",
        verdictHeavy:
          "Bu miktar, bildirilen kasanın %5'inden fazlasını tek bir sonuca bağlıyor. Bu ölçekte on maçlık bir kayıp serisi — 2.00 civarı oranlarda olağandır — kasanın yarısından fazlasını alır; bahsi yazmadan önce sayıyı kasa hesaplayıcısında kontrol et.",
      },
      takeaway:
        "İstediğin kârdan yola çıkmak, fazla oynamanın en hızlı yoludur: işe yarar soru ne kadar kazanmak istediğim değil, ne kadar kaybetmeyi kaldırabileceğimdir.",
      example: {
        title: "2.50 oranda 100 kâr istemek",
        rows: [
          { label: "Oran", value: "2.50" },
          { label: "Hedef kâr", value: "100" },
          { label: "Gereken miktar", value: "66,67" },
          { label: "Toplam dönüş", value: "166,67" },
          { label: "1.000 kasanın payı", value: "%6,67" },
        ],
        note:
          "Aynı 100, 5.00 oranda 25,00 ve 1.25 oranda 400,00 tutuyor — hedef yerinde durdu, oran değişti. Ve 1.000 kasada 66,67, sonucu %44 olasılıkla gören birinin tam Kelly miktarıdır; 2.50 ise %40'ta başa baş gelir. Yani istek, içinde +%10 avantaj değerinde bir olasılık tahmini taşıyor, sadece söylenmemiş.",
      },
      explainerTitle: "Kendi seçtiğin bir sayıdan geriye doğru hesaplamak",
      explainer: [
        "Aritmetik kolay olan yarısı. Bir bahis, miktarı artı miktar × (oran − 1) döndürür, dolayısıyla **bir hedefin istediği miktar, hedefin orana eksi bire bölümüdür** — 2.50 oranda 100 için 66,67 gerekir ve kupon 166,67 olarak döner. Bu sayfayı okumaya değer kılan ikinci etki: **oran kısaldıkça aynı istek daha büyük bir bahis ister**. O 100, 5.00 oranda 25,00, 2.50 oranda 66,67, 2.00 oranda 100,00 ve 1.25 oranda 400,00 tutar. Bu dört satır arasında fikrin hiç değişmedi, riske attığın para on altı kat oynadı. Hesaplayıcının aslında ihtiyaç duymadığı kasayı sormasının nedeni bu: 66,67 sayısı, ayırdığın her şeyin %6,67'si olduğunu bilene kadar ne büyüktür ne küçüktür.",
        "**İstediğin kârdan yola çıkmak, fazla büyük bir miktara giden en kısa yoldur** ve belirli bir biçimde bozulur. İlk bahsi kaybet, hedef onu kapatmak için sessizce büyür: 66,67 gittikten sonra yine 100 istemek, 166,67 istemek demektir; bu da 2.00 oranda 166,67 miktar gerektirir ve o da giderse sıradaki istek 1.70 oranda 476,19 olur. Üç bahis sonra, ilk 100'ü kazanmak için 1.000 kasanın 709,52'si riske girmiştir ve oran her seferinde kısalmıştır, çünkü kısa oranlar daha güvenli görünür. **Bahis, tam da onu oynama gerekçesi zayıflarken büyür.** Bu hesabın dürüst sürümü ters yönde çalışır: ne kaybedebileceğinden ne oynayabileceğine — yani Kelly kriteri hesaplayıcısı. Orada ölçü, seçtiğin bir sayıdan değil, ölçülmüş bir avantajdan gelir. Bizim sayımız da rastlantı değil: 1.000 üzerinden 66,67, 2.50 oranda %44'e inanan birine tam Kelly'nin önerdiği miktardır, oranın ima ettiği %40'a karşı. O %44'ü savunmayacaksan, miktar hiçbir zaman bahisle ilgili değildi.",
      ],
      faq: [
        {
          q: "Hedef kâr için miktar nasıl hesaplanır?",
          a: "İstediğin kârı orana eksi bire böl. 2.50 oranda oynanan birim başına net dönüş 1,50'dir, yani 100 kâr için 100 / 1,50 = 66,67 miktar gerekir ve toplam 166,67 öder. 2.00 oranda net dönüş 1,00 olduğu için orada miktar ile hedef aynı sayıdır.",
        },
        {
          q: "Hesaplayıcı neden kasamı soruyor?",
          a: "Çünkü miktar tek başına hiçbir şey söylemez. 66,67 bir bahisçi için yuvarlama hatası, bir başkası için hesabın üçte biridir; hangisi olduğuna karar veren şey kasanın payıdır — burada %6,67. Alanı boş bırak, miktar yine çalışır; yüzde bir çizgiye döner, bu da dürüsttür, çünkü o varsayım bizim değil senin.",
        },
        {
          q: "Bunu mu, Kelly kriterini mi kullanmalıyım?",
          a: "Bunu bir isteği fiyatlamak, Kelly'yi bir bahsi boyutlandırmak için kullan. Bu sayfa senin seçtiğin bir sayıdan başlar ve maliyetini bulur; Kelly kriteri hesaplayıcısı ölçtüğün bir avantajdan başlar ve kasanın ne taşıyabileceğini bulur. İkisi çeliştiğinde, olasılık tahminine hiç bakmamış olanı bırak.",
        },
        {
          q: "Kaybı daha büyük miktarla kovalamak hiç doğru mudur?",
          a: "Bu aritmetikle değil. Her telafi isteği bir öncekinden büyüktür ve genellikle daha kısa bir orana yazılır, çünkü kısa oranlar güvenli görünür; böylece miktar büyürken avantaj küçülür. Kasa kuralları tam bu yüzden var: sıradaki miktarı son sonuçtan bağımsız kılmak. Birimi kasanın yüzdesi olarak sabitle, dizi kaçamaz.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Kasa hesaplayıcı — birim, düşüş ve iflasa kalan kayıp sayısı | BetRedge",
      metaDescription:
        "Ücretsiz kasa hesaplayıcı: kasayı ve birimi belirle, bahis başına miktarı, bir kayıp serisinin maliyetini, bıraktığı düşüşü ve kasanın kaç kaybı taşıdığını gör.",
      h1: "Kasa hesaplayıcı",
      lede:
        "Yüzdeyle tanımlı bir birimin gerçekte ne kadarını bağladığı: bahis başına miktar, kayıp serisinin maliyeti ve kasanın kaç üst üste kaybı kaldırdığı.",
      labels: {
        inputTitle: "Kasa ve kural",
        bankroll: "Kasa",
        unitPercent: "Birim (%)",
        losingStreak: "Kayıp serisi",
        resultTitle: "Bu kuralın maliyeti",
        unit: "Bahis başına miktar",
        streakLoss: "Serinin maliyeti",
        drawdown: "Düşüş",
        betsToRuin: "İflasa kalan kayıp",
        hint: "Yüzdeleri sayı olarak yaz: 2, bahis başına kasanın %2'si demektir. Kayıp serisi bahis sayısıdır, yani yalnızca tam sayı — atlatmak istediğin kötü seridir, bir tahmin değil.",
        verdictSafe:
          "Birim başına %5 ve altında, bildirdiğin seri kasayı hâlâ çalışır durumda bırakır. On maçlık bir seri, eşit oranlarda 1.000 bahis içinde oyuncuların %38,54'üne uğrar; yalnızca ona denk gelmezsen ayakta kalan bir plan, plan değildir.",
        verdictAggressive:
          "Birim başına %5'in üzerinde olağan kötü seri hesabı bitirir: on kayıp kasanın yarısını ya da daha fazlasını alır ve yarıdan geri dönmek için +%100,00 gerekir. On maçlık seri 1.000 bahis içinde oyuncuların %38,54'üne geldiğine göre, bu ona denk gelmemeye oynamaktır.",
      },
      takeaway:
        "Birim yüzdesi bir tercih değil. En kötü kayıp serisinin, sen oyundan çıkmadan önce ne kadar uzun olabileceğine dair verdiğin karardır.",
      example: {
        title: "2.000 kasa, bahis başına %2",
        rows: [
          { label: "Kasa", value: "2.000" },
          { label: "Birim", value: "%2" },
          { label: "Bahis başına miktar", value: "40,00" },
          { label: "Üst üste on kayıp", value: "400,00" },
          { label: "Düşüş", value: "%20,00" },
          { label: "İflasa kalan kayıp", value: "50" },
        ],
        note:
          "Bu %20,00'lik çukur, 2.000'e dönmek için kalanın üzerine +%25,00 ister. Birimi %5'e çıkar, aynı on kayıp 1.000 tutar — geri dönmek için +%100,00 gerektiren %50,00'lik bir düşüş, ve kasa 50 değil 20 üst üste kaybı taşır. Kuralda üç puan, atlatılabilen seride yarıdan fazla kısalma.",
      },
      explainerTitle: "Ne kadar uzun bir kötü seriyi atlattığına karar veren kural",
      explainer: [
        "**Birim, kasanın bir yüzdesidir, bir tutar değil** ve fark ancak işler kötü gittiğinde görünür. Sonsuza kadar sabit 40 oyna; 1.000'e düşmüş bir kasa artık %2 değil %4 oynuyordur: kural tam gevşemesi gerektiği anda sıkışır. Birimi güncel bakiyeye göre yeniden hesapla, her kayıp sıradaki miktarı küçültür — kötü serinin işi bitirmesini engelleyen şey budur. Altındaki asimetri, meselenin tamamıdır: **%20 kaybetmek geri dönmek için +%25,00, %50 kaybetmek +%100,00, %80 kaybetmek +%400,00 ister.** Bu çiftlerin ikinci yarısında ilk yarısıyla simetrik hiçbir şey yok ve hiçbir avantaj +%400,00'lük bir toparlanmayı umut yerine plan yapacak kadar büyük değil. 2.000 kasa %2 ile bahis başına 40 oynar, üst üste on kaybı 400,00 karşılığında yutar ve −%20,00 ile çıkar — o miktarın kaldırabildiği 50 üst üste kaybın onunu kullanarak.",
        "**2.00 civarı oranlarda on maçlık kayıp serisi olağandır, şanssızlık değil** ve bunu gösteren sayı şudur. Eşit oranlarda tek bir on maçlık dizinin olasılığı %0,098 — 1.024'te bir — ve bir sezonun kaç dizi barındırdığını saymadan bu asla gibi okunur. 1.000 bahiste en az bir kez on ya da daha uzun bir kayıp serisine denk gelme olasılığı **%38,54**; avantajı olmayan birinin zamanın %47,62'sinde kazandığı 2.10 oranında ise **%52,31** — yazı turadan daha olası. 500 bahiste aynı iki sayı %21,45 ve %30,73 olur ve eşit oranlı 1.000 bahiste beklenecek en uzun seri yaklaşık ondur, çünkü bahis sayısının iki tabanındaki logaritmasıyla büyür. Yani seri dağılımın kuyruğu değil, tam ortası; dolayısıyla **birimin %5'in üzerinde olması, olağan duruma denk gelmemeye oynamaktır**: %5'te bu on kayıp kasanın yarısını, %10'da tamamını alır. Avantaj varsayılmak yerine ölçülmüşse, Kelly kriteri hesaplayıcısı birimi doğrudan avantajdan çıkarır — onun verdiği sayıyı bir tavan, bu sayfayı da altındaki taban olarak oku.",
      ],
      faq: [
        {
          q: "Hangi birim büyüklüğünü kullanmalıyım?",
          a: "Sabit miktarla oynamada bahis başına kasanın yüzde biri ile ikisi arası alışılmış aralıktır; yüzde beşin üzerinde olağan kötü seri hesabı kapatan bir olaya dönüşür. Dürüst seçim tersten yapılır: atlatmak istediğin kayıp serisine karar ver, bu hesaplayıcının verdiği düşüşü oku ve ondan sonra aynı şekilde oynamaya devam eder miydin diye sor.",
        },
        {
          q: "İflasa kalan kayıp neden tam sayı?",
          a: "Çünkü bahis sayar ve bahsin kesri bahis değildir. 1.000 kasa %3 ile 30 birim verir, bu da 33 kayıp ve üçte bir eder — cevap aşağı yuvarlanmış 33'tür, çünkü kasa bir sonrakini tam olarak karşılamaz. Yukarı yuvarlamak, karşılığı olmayan bir bahsi vaat etmek olurdu.",
        },
        {
          q: "Üst üste on kayıp gerçekten normal mi?",
          a: "Evet ve aritmetik yakın bile değil. Eşit oranlarda tek bir on kayıp dizisi %0,098'lik bir olaydır, ama 1.000 bahiste yeterince dizi vardır ve en az birine denk gelme olasılığı %38,54 olur; avantajı olmayan birinin %47,62 kazandığı 2.10 oranında bu %52,31'e çıkar. Şaşırmak yerine ona göre planla.",
        },
        {
          q: "Bunu mu, Kelly kriterini mi kullanmalıyım?",
          a: "Ölçülmüş bir avantajın yokken bunu kullan, yani çoğu zaman: yüzdeyle tanımlı birim olasılık tahmini istemez ve en kötü durumu önceden bilinir. Kelly kriteri hesaplayıcısı, bir olasılığı savunabildiğin anda doğru araçtır ve genellikle sabit %2'den fazlasını önerir. Onun cevabını tavan, sabit kuralı taban saymak ikisini de dürüst tutar.",
        },
      ],
    },
  },
};

export default tr;
