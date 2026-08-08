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
  },
};

export default tr;
