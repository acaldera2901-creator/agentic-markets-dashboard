// lib/classic/invite-copy.ts — #CLASSIC-INVITE-1014 · la tab Invita a flag acceso.
//
// Le cinque lingue del desk, come plans-copy (en it es fr ru). Tre gruppi:
//   common — link, accesso, stati: valgono in entrambe le versioni;
//   v1     — il programma ATTUALE a giorni PRO (NEXT_PUBLIC_AFFILIATE_V2 spento):
//            nessuna cifra in denaro, nessuna commissione, nessuna moneta;
//   v2     — l'ANTEPRIMA del programma affiliati v2 (flag acceso, solo Preview):
//            20% primo acquisto, 7% rinnovi dal 2° mese, USDT su Polygon, soglia
//            50 $, payout mensile manuale, hold 60 giorni, storno 120 giorni.
//            Fonte dei termini: artifacts/affiliate-v2/00-PROPOSAL-FINALE.md e
//            PROPOSAL-crypto-payout.md (decisioni di Andrea 30/09 e 07/10). Il
//            backend v2 NON esiste: ogni importo mostrato con questi testi è un
//            esempio, e il banner `previewTitle` lo dice.
// Guardie in invite-copy.test.ts: parità di chiavi e segnaposto, lessico vietato
// (niente «guadagna X», niente urgenza), v1 senza denaro, v2 con il rischio detto.
//
// Segnaposto: {d} giorni o data, {n} numero, {k} quanti mancano, {r} premio.

export const INVITE_LANGS = ["en", "it", "es", "fr", "ru"] as const;
export type InviteLang = (typeof INVITE_LANGS)[number];

export type InviteCommon = {
  headline: string;
  linkTitle: string;
  yourCode: string;
  copy: string;
  copied: string;
  copyFail: string;
  codeLabel: string;
  placeholder: string;
  hint: string;
  claimBtn: string;
  claimBusy: string;
  errTaken: string;
  errInvalid: string;
  errGeneric: string;
  loading: string;
  statsErr: string;
  retry: string;
  anonTitle: string;
  anonBody: string;
  anonCreate: string;
  anonSignIn: string;
  howTitle: string;
  step1T: string;
  step1B: string;
  kSignups: string;
  kPaying: string;
  kConv: string;
  zeroState: string;
};

export type InviteV1 = {
  lede: string;
  friendGets: string;
  step2T: string;
  step2B: string;
  step3T: string;
  step3B: string;
  kpiTitle: string;
  kEarnedDays: string;
  rewardsTitle: string;
  progress: string;
  progressDone: string;
  tierAt: string;
  rewardDays: string;
  rewardRoom: string;
  nextUp: string;
  pending: string;
  note: string;
  promo: string;
};

export type InviteV2 = {
  lede: string;
  previewTitle: string;
  previewBody: string;
  sample: string;
  step2T: string;
  step2B: string;
  step3T: string;
  step3B: string;
  kpiTitle: string;
  kClicks: string;
  kClicksNote: string;
  kRealNote: string;
  ledgerTitle: string;
  lPending: string;
  lPendingNote: string;
  lPayable: string;
  lPayableNote: string;
  lPaid: string;
  lPaidNote: string;
  walletTitle: string;
  walletNet: string;
  walletLabel: string;
  walletPh: string;
  walletState: string;
  walletSave: string;
  walletWarn: string;
  walletCycle: string;
  histTitle: string;
  hUser: string;
  hEvent: string;
  hDate: string;
  hBase: string;
  hAmount: string;
  hState: string;
  evFirst: string;
  evRenew: string;
  stHold: string;
  stPayable: string;
  stPaid: string;
  stVoid: string;
  rulesTitle: string;
  rule1: string;
  rule2: string;
  rule3: string;
  rule4: string;
  rule5: string;
  rule6: string;
  rule7: string;
  termsDraft: string;
  termsSite: string;
};

export type InviteCopy = { common: InviteCommon; v1: InviteV1; v2: InviteV2 };

export const INVITE_COPY: Record<InviteLang, InviteCopy> = {
  en: {
    common: {
      headline: "Bring BetRedge to the people who already ask you for picks.",
      linkTitle: "Your link",
      yourCode: "Code",
      copy: "Copy link",
      copied: "Copied",
      copyFail: "Select the link and copy it",
      codeLabel: "Choose your code",
      placeholder: "YOURCODE",
      hint: "2–20 characters: letters, numbers, - _. It can’t be changed later.",
      claimBtn: "Claim code",
      claimBusy: "Claiming…",
      errTaken: "That code is taken. Pick another.",
      errInvalid: "Invalid code: 2–20 characters, letters, numbers, - _.",
      errGeneric: "Something went wrong. Try again.",
      loading: "Loading your link…",
      statsErr: "Your numbers can’t be read right now. Your link still works.",
      retry: "Try again",
      anonTitle: "Sign in or create an account to get your link.",
      anonBody: "The link belongs to your account: that’s how a sign-up is counted to you.",
      anonCreate: "Create account",
      anonSignIn: "Sign in",
      howTitle: "How it works",
      step1T: "Share your link",
      step1B: "Send it to the people who already ask you for picks. Whoever signs up through it is counted to you.",
      kSignups: "Sign-ups",
      kPaying: "Paying",
      kConv: "Conversion",
      zeroState: "No sign-ups yet. Send the link above to someone who already asks you about tonight’s games.",
    },
    v1: {
      lede: "Every friend who signs up through your link and pays brings you closer to free days of PRO.",
      friendGets: "Whoever signs up through your link gets {d} free days of PRO.",
      step2T: "A friend signs up and pays",
      step2B: "Sign-ups and paying friends are counted on your code.",
      step3T: "You unlock PRO days",
      step3B: "At each threshold below. Days are added to your account once granted.",
      kpiTitle: "Your sign-ups",
      kEarnedDays: "PRO days granted",
      rewardsTitle: "Your rewards",
      progress: "{n} paying · {k} to the next reward",
      progressDone: "{n} paying · every reward unlocked",
      tierAt: "at {n} friends",
      rewardDays: "+{d} days of PRO",
      rewardRoom: "Private Telegram room",
      nextUp: "Next: {r}, at {n} paying friends",
      pending: "being granted",
      note: "Creators: revenue on your sign-ups’ subscriptions is enabled only on request, code by code. Write to us.",
      promo: "The −50% launch promo on the first purchase applies to anyone who signs up, invited or not. It isn’t a perk of your link.",
    },
    v2: {
      lede: "You get 20% of their first purchase and 7% of every renewal from the second month, paid monthly in USDT on Polygon once your balance reaches $50.",
      previewTitle: "Preview — program coming soon, sample data",
      previewBody: "The commission program isn’t live. Every amount marked “Sample” is an example, not yours. Until launch your link runs the current PRO-days program.",
      sample: "Sample",
      step2T: "They subscribe: 20%",
      step2B: "Of their first purchase, net of VAT, refunds and fees.",
      step3T: "They renew: 7%",
      step3B: "Of every renewal from the second month, for as long as they stay subscribed.",
      kpiTitle: "From click to renewal",
      kClicks: "Clicks",
      kClicksNote: "Counted from launch",
      kRealNote: "Sign-ups and paying are real, from your code.",
      ledgerTitle: "Commissions",
      lPending: "On hold",
      lPendingNote: "Each commission waits 60 days before it matures.",
      lPayable: "Matured",
      lPayableNote: "Paid once it reaches $50. Below that it carries over.",
      lPaid: "Paid",
      lPaidNote: "Sent to your wallet, with the transaction on Polygon.",
      walletTitle: "Payout wallet",
      walletNet: "USDT on Polygon",
      walletLabel: "Polygon address",
      walletPh: "0x…",
      walletState: "No wallet saved. This field opens when the program starts: nothing typed here is collected.",
      walletSave: "Save wallet",
      walletWarn: "Polygon only. An exchange address that doesn’t accept USDT on Polygon loses the funds — check before you paste.",
      walletCycle: "Payouts are sent by hand once a month, when your matured balance is $50 or more.",
      histTitle: "Commission history",
      hUser: "Who",
      hEvent: "Event",
      hDate: "Date",
      hBase: "Base",
      hAmount: "Commission",
      hState: "State",
      evFirst: "First purchase · 20%",
      evRenew: "Renewal {n} · 7%",
      stHold: "On hold",
      stPayable: "Matured",
      stPaid: "Paid",
      stVoid: "Reversed",
      rulesTitle: "The rules, short",
      rule1: "20% of the first purchase and 7% of renewals from the second month, always on the net amount: no VAT, refunds or fees.",
      rule2: "Every commission waits 60 days before it matures, to cover refunds and chargebacks.",
      rule3: "If a purchase is refunded or disputed within 120 days, its commission is reversed, even if already paid: it comes off your next balance.",
      rule4: "Payouts in USDT on Polygon, once a month, by hand, from $50 matured.",
      rule5: "Nothing is guaranteed: what you get depends on who subscribes through you and how long they stay.",
      rule6: "Say you earn a commission before anyone clicks (#ad). Never promise wins, never target under-18s.",
      rule7: "You can leave whenever you want. Commissions already matured stay yours.",
      termsDraft: "Program terms: being drafted, published before launch",
      termsSite: "Site terms",
    },
  },
  it: {
    common: {
      headline: "Porta BetRedge a chi ti chiede già i pronostici.",
      linkTitle: "Il tuo link",
      yourCode: "Codice",
      copy: "Copia link",
      copied: "Copiato",
      copyFail: "Seleziona il link e copialo",
      codeLabel: "Scegli il tuo codice",
      placeholder: "ILTUOCODICE",
      hint: "2–20 caratteri: lettere, numeri, - _. Una volta scelto non si cambia.",
      claimBtn: "Riserva il codice",
      claimBusy: "Riservo…",
      errTaken: "Codice già preso. Scegline un altro.",
      errInvalid: "Codice non valido: 2–20 caratteri, lettere, numeri, - _.",
      errGeneric: "Qualcosa non è andato. Riprova.",
      loading: "Carico il tuo link…",
      statsErr: "I tuoi numeri ora non si leggono. Il link funziona comunque.",
      retry: "Riprova",
      anonTitle: "Accedi o registrati per avere il tuo link.",
      anonBody: "Il link è legato al tuo account: è così che un iscritto viene contato a te.",
      anonCreate: "Registrati",
      anonSignIn: "Accedi",
      howTitle: "Come funziona",
      step1T: "Condividi il link",
      step1B: "Mandalo a chi ti chiede già i pronostici. Chi si iscrive da lì viene contato a te.",
      kSignups: "Iscritti",
      kPaying: "Paganti",
      kConv: "Conversione",
      zeroState: "Ancora nessun iscritto. Manda il link qui sopra a chi ti chiede già delle partite di stasera.",
    },
    v1: {
      lede: "Ogni amico che si iscrive dal tuo link e paga ti avvicina a giorni di PRO gratis.",
      friendGets: "Chi si iscrive dal tuo link riceve {d} giorni di PRO gratis.",
      step2T: "Un amico si iscrive e paga",
      step2B: "Iscritti e amici paganti si contano sul tuo codice.",
      step3T: "Sblocchi giorni di PRO",
      step3B: "A ogni soglia qui sotto. I giorni entrano nel tuo account appena concessi.",
      kpiTitle: "I tuoi iscritti",
      kEarnedDays: "Giorni PRO concessi",
      rewardsTitle: "I tuoi premi",
      progress: "{n} paganti · {k} al prossimo premio",
      progressDone: "{n} paganti · tutti i premi sbloccati",
      tierAt: "a {n} amici",
      rewardDays: "+{d} giorni di PRO",
      rewardRoom: "Stanza Telegram riservata",
      nextUp: "Prossimo: {r}, a {n} amici paganti",
      pending: "in concessione",
      note: "Creator: la revenue sugli abbonamenti dei tuoi iscritti si attiva solo su richiesta, codice per codice. Scrivici.",
      promo: "La promo di lancio −50% sul primo acquisto vale per chiunque si iscriva, con o senza invito. Non è un vantaggio del tuo link.",
    },
    v2: {
      lede: "Ricevi il 20% del loro primo acquisto e il 7% di ogni rinnovo dal secondo mese, pagati una volta al mese in USDT su Polygon quando il saldo arriva a 50 $.",
      previewTitle: "Anteprima — programma in arrivo, dati di esempio",
      previewBody: "Il programma a commissione non è attivo. Ogni importo segnato «Esempio» è un esempio, non è tuo. Fino al lancio il tuo link usa il programma attuale a giorni di PRO.",
      sample: "Esempio",
      step2T: "Si abbonano: 20%",
      step2B: "Del loro primo acquisto, al netto di IVA, rimborsi e commissioni.",
      step3T: "Rinnovano: 7%",
      step3B: "Di ogni rinnovo dal secondo mese, finché restano abbonati.",
      kpiTitle: "Dal click al rinnovo",
      kClicks: "Click",
      kClicksNote: "Contati dal lancio",
      kRealNote: "Iscritti e paganti sono reali, dal tuo codice.",
      ledgerTitle: "Commissioni",
      lPending: "In attesa",
      lPendingNote: "Ogni commissione aspetta 60 giorni prima di maturare.",
      lPayable: "Maturato",
      lPayableNote: "Si paga quando arriva a 50 $. Sotto, passa al mese dopo.",
      lPaid: "Pagato",
      lPaidNote: "Inviato al tuo wallet, con la transazione su Polygon.",
      walletTitle: "Wallet per i pagamenti",
      walletNet: "USDT su Polygon",
      walletLabel: "Indirizzo Polygon",
      walletPh: "0x…",
      walletState: "Nessun wallet salvato. Il campo si apre con il programma: niente di quello che scrivi qui viene raccolto.",
      walletSave: "Salva wallet",
      walletWarn: "Solo Polygon. Un indirizzo di exchange che non accetta USDT su Polygon perde i fondi: controlla prima di incollarlo.",
      walletCycle: "I pagamenti partono a mano una volta al mese, quando il maturato è di almeno 50 $.",
      histTitle: "Storico commissioni",
      hUser: "Chi",
      hEvent: "Evento",
      hDate: "Data",
      hBase: "Base",
      hAmount: "Commissione",
      hState: "Stato",
      evFirst: "Primo acquisto · 20%",
      evRenew: "Rinnovo {n} · 7%",
      stHold: "In attesa",
      stPayable: "Maturata",
      stPaid: "Pagata",
      stVoid: "Stornata",
      rulesTitle: "Le regole, in breve",
      rule1: "20% del primo acquisto e 7% dei rinnovi dal secondo mese, sempre sull’importo netto: niente IVA, rimborsi o commissioni.",
      rule2: "Ogni commissione aspetta 60 giorni prima di maturare, per coprire rimborsi e chargeback.",
      rule3: "Se un acquisto viene rimborsato o contestato entro 120 giorni, la sua commissione si storna, anche se già pagata: si scala dal saldo successivo.",
      rule4: "Pagamenti in USDT su Polygon, una volta al mese, a mano, da 50 $ maturati.",
      rule5: "Nessuna garanzia: quanto ricevi dipende da chi si abbona tramite te e da quanto resta.",
      rule6: "Dichiara la commissione prima del click (#adv). Mai promettere vincite, mai rivolgersi a minori di 18 anni.",
      rule7: "Puoi uscire quando vuoi. Le commissioni già maturate restano tue.",
      termsDraft: "Termini del programma: in preparazione, pubblicati prima del lancio",
      termsSite: "Termini del sito",
    },
  },
  es: {
    common: {
      headline: "Lleva BetRedge a quien ya te pide pronósticos.",
      linkTitle: "Tu link",
      yourCode: "Código",
      copy: "Copiar link",
      copied: "Copiado",
      copyFail: "Selecciona el link y cópialo",
      codeLabel: "Elige tu código",
      placeholder: "TUCODIGO",
      hint: "2–20 caracteres: letras, números, - _. No se puede cambiar después.",
      claimBtn: "Reservar código",
      claimBusy: "Reservando…",
      errTaken: "Ese código ya está ocupado. Elige otro.",
      errInvalid: "Código no válido: 2–20 caracteres, letras, números, - _.",
      errGeneric: "Algo ha fallado. Inténtalo de nuevo.",
      loading: "Cargando tu link…",
      statsErr: "Ahora no se pueden leer tus números. Tu link funciona igual.",
      retry: "Reintentar",
      anonTitle: "Inicia sesión o crea una cuenta para tener tu link.",
      anonBody: "El link va con tu cuenta: así se te cuenta cada registro.",
      anonCreate: "Crear cuenta",
      anonSignIn: "Iniciar sesión",
      howTitle: "Cómo funciona",
      step1T: "Comparte tu link",
      step1B: "Envíalo a quien ya te pide pronósticos. Quien se registra desde ahí se te cuenta a ti.",
      kSignups: "Registros",
      kPaying: "Pagan",
      kConv: "Conversión",
      zeroState: "Aún no hay registros. Manda el link de arriba a quien ya te pregunta por los partidos de esta noche.",
    },
    v1: {
      lede: "Cada amigo que se registra desde tu link y paga te acerca a días de PRO gratis.",
      friendGets: "Quien se registra desde tu link recibe {d} días de PRO gratis.",
      step2T: "Un amigo se registra y paga",
      step2B: "Registros y amigos que pagan se cuentan en tu código.",
      step3T: "Desbloqueas días de PRO",
      step3B: "En cada umbral de abajo. Los días entran en tu cuenta en cuanto se conceden.",
      kpiTitle: "Tus registros",
      kEarnedDays: "Días PRO concedidos",
      rewardsTitle: "Tus premios",
      progress: "{n} pagan · {k} para el próximo premio",
      progressDone: "{n} pagan · todos los premios desbloqueados",
      tierAt: "con {n} amigos",
      rewardDays: "+{d} días de PRO",
      rewardRoom: "Sala privada de Telegram",
      nextUp: "Siguiente: {r}, con {n} amigos que pagan",
      pending: "en concesión",
      note: "Creators: la revenue sobre las suscripciones de tus registros se activa solo a petición, código por código. Escríbenos.",
      promo: "La promo de lanzamiento −50% en la primera compra vale para cualquiera que se registre, con o sin invitación. No es una ventaja de tu link.",
    },
    v2: {
      lede: "Recibes el 20% de su primera compra y el 7% de cada renovación desde el segundo mes, pagados una vez al mes en USDT en Polygon cuando tu saldo llega a 50 $.",
      previewTitle: "Vista previa — programa en camino, datos de ejemplo",
      previewBody: "El programa de comisiones no está activo. Cada importe marcado «Ejemplo» es un ejemplo, no es tuyo. Hasta el lanzamiento tu link usa el programa actual de días de PRO.",
      sample: "Ejemplo",
      step2T: "Se suscriben: 20%",
      step2B: "De su primera compra, sin IVA, reembolsos ni comisiones.",
      step3T: "Renuevan: 7%",
      step3B: "De cada renovación desde el segundo mes, mientras sigan suscritos.",
      kpiTitle: "Del clic a la renovación",
      kClicks: "Clics",
      kClicksNote: "Se cuentan desde el lanzamiento",
      kRealNote: "Registros y pagos son reales, de tu código.",
      ledgerTitle: "Comisiones",
      lPending: "En espera",
      lPendingNote: "Cada comisión espera 60 días antes de madurar.",
      lPayable: "Madurado",
      lPayableNote: "Se paga al llegar a 50 $. Por debajo, pasa al mes siguiente.",
      lPaid: "Pagado",
      lPaidNote: "Enviado a tu wallet, con la transacción en Polygon.",
      walletTitle: "Wallet de pagos",
      walletNet: "USDT en Polygon",
      walletLabel: "Dirección Polygon",
      walletPh: "0x…",
      walletState: "Ningún wallet guardado. El campo se abre con el programa: nada de lo que escribas aquí se recoge.",
      walletSave: "Guardar wallet",
      walletWarn: "Solo Polygon. Una dirección de exchange que no acepta USDT en Polygon pierde los fondos: compruébalo antes de pegarla.",
      walletCycle: "Los pagos se envían a mano una vez al mes, cuando lo madurado es de al menos 50 $.",
      histTitle: "Historial de comisiones",
      hUser: "Quién",
      hEvent: "Evento",
      hDate: "Fecha",
      hBase: "Base",
      hAmount: "Comisión",
      hState: "Estado",
      evFirst: "Primera compra · 20%",
      evRenew: "Renovación {n} · 7%",
      stHold: "En espera",
      stPayable: "Madurada",
      stPaid: "Pagada",
      stVoid: "Anulada",
      rulesTitle: "Las reglas, en breve",
      rule1: "20% de la primera compra y 7% de las renovaciones desde el segundo mes, siempre sobre el importe neto: sin IVA, reembolsos ni comisiones.",
      rule2: "Cada comisión espera 60 días antes de madurar, para cubrir reembolsos y contracargos.",
      rule3: "Si una compra se reembolsa o se disputa en 120 días, su comisión se anula, aunque ya esté pagada: se descuenta del saldo siguiente.",
      rule4: "Pagos en USDT en Polygon, una vez al mes, a mano, desde 50 $ madurados.",
      rule5: "Nada está asegurado: lo que recibes depende de quién se suscribe a través de ti y de cuánto tiempo sigue.",
      rule6: "Declara la comisión antes del clic (#publi). Nunca prometas ganancias en apuestas, nunca te dirijas a menores de 18.",
      rule7: "Puedes salir cuando quieras. Las comisiones ya maduradas siguen siendo tuyas.",
      termsDraft: "Términos del programa: en preparación, publicados antes del lanzamiento",
      termsSite: "Términos del sitio",
    },
  },
  fr: {
    common: {
      headline: "Faites découvrir BetRedge à ceux qui vous demandent déjà des pronostics.",
      linkTitle: "Votre lien",
      yourCode: "Code",
      copy: "Copier le lien",
      copied: "Copié",
      copyFail: "Sélectionnez le lien et copiez-le",
      codeLabel: "Choisissez votre code",
      placeholder: "VOTRECODE",
      hint: "2–20 caractères : lettres, chiffres, - _. Définitif une fois réservé.",
      claimBtn: "Réserver le code",
      claimBusy: "Réservation…",
      errTaken: "Ce code est déjà pris. Choisissez-en un autre.",
      errInvalid: "Code invalide : 2–20 caractères, lettres, chiffres, - _.",
      errGeneric: "Un problème est survenu. Réessayez.",
      loading: "Chargement de votre lien…",
      statsErr: "Vos chiffres sont illisibles pour le moment. Votre lien fonctionne quand même.",
      retry: "Réessayer",
      anonTitle: "Connectez-vous ou créez un compte pour obtenir votre lien.",
      anonBody: "Le lien est rattaché à votre compte : c’est ainsi qu’une inscription vous est attribuée.",
      anonCreate: "Créer un compte",
      anonSignIn: "Se connecter",
      howTitle: "Comment ça marche",
      step1T: "Partagez votre lien",
      step1B: "Envoyez-le à ceux qui vous demandent déjà des pronostics. Toute inscription via ce lien vous est attribuée.",
      kSignups: "Inscriptions",
      kPaying: "Payants",
      kConv: "Conversion",
      zeroState: "Aucune inscription pour l’instant. Envoyez le lien ci-dessus à qui vous parle déjà des matchs de ce soir.",
    },
    v1: {
      lede: "Chaque ami qui s’inscrit via votre lien et paie vous rapproche de jours de PRO offerts.",
      friendGets: "Toute personne inscrite via votre lien reçoit {d} jours de PRO offerts.",
      step2T: "Un ami s’inscrit et paie",
      step2B: "Inscriptions et amis payants sont comptés sur votre code.",
      step3T: "Vous débloquez des jours de PRO",
      step3B: "À chaque palier ci-dessous. Les jours arrivent sur votre compte dès qu’ils sont accordés.",
      kpiTitle: "Vos inscriptions",
      kEarnedDays: "Jours PRO accordés",
      rewardsTitle: "Vos récompenses",
      progress: "{n} payants · {k} avant la prochaine récompense",
      progressDone: "{n} payants · toutes les récompenses débloquées",
      tierAt: "à {n} amis",
      rewardDays: "+{d} jours de PRO",
      rewardRoom: "Salon Telegram privé",
      nextUp: "Suivant : {r}, à {n} amis payants",
      pending: "en cours d’attribution",
      note: "Créateurs : la revenue sur les abonnements de vos inscrits s’active uniquement sur demande, code par code. Écrivez-nous.",
      promo: "La promo de lancement −50% sur le premier achat vaut pour toute personne qui s’inscrit, invitée ou non. Ce n’est pas un avantage de votre lien.",
    },
    v2: {
      lede: "Vous recevez 20% de leur premier achat et 7% de chaque renouvellement dès le deuxième mois, versés une fois par mois en USDT sur Polygon dès que votre solde atteint 50 $.",
      previewTitle: "Aperçu — programme à venir, données d’exemple",
      previewBody: "Le programme à commission n’est pas actif. Chaque montant marqué « Exemple » est un exemple, pas le vôtre. Jusqu’au lancement, votre lien suit le programme actuel à jours de PRO.",
      sample: "Exemple",
      step2T: "Ils s’abonnent : 20%",
      step2B: "De leur premier achat, hors TVA, remboursements et frais.",
      step3T: "Ils renouvellent : 7%",
      step3B: "De chaque renouvellement dès le deuxième mois, tant qu’ils restent abonnés.",
      kpiTitle: "Du clic au renouvellement",
      kClicks: "Clics",
      kClicksNote: "Comptés dès le lancement",
      kRealNote: "Inscriptions et payants sont réels, issus de votre code.",
      ledgerTitle: "Commissions",
      lPending: "En attente",
      lPendingNote: "Chaque commission attend 60 jours avant d’être acquise.",
      lPayable: "Acquis",
      lPayableNote: "Versé dès 50 $. En dessous, reporté au mois suivant.",
      lPaid: "Versé",
      lPaidNote: "Envoyé sur votre wallet, avec la transaction sur Polygon.",
      walletTitle: "Wallet de paiement",
      walletNet: "USDT sur Polygon",
      walletLabel: "Adresse Polygon",
      walletPh: "0x…",
      walletState: "Aucun wallet enregistré. Ce champ s’ouvre avec le programme : rien de ce que vous tapez ici n’est collecté.",
      walletSave: "Enregistrer le wallet",
      walletWarn: "Polygon uniquement. Une adresse d’exchange qui n’accepte pas l’USDT sur Polygon perd les fonds : vérifiez avant de la coller.",
      walletCycle: "Les versements partent à la main une fois par mois, quand votre solde acquis atteint au moins 50 $.",
      histTitle: "Historique des commissions",
      hUser: "Qui",
      hEvent: "Événement",
      hDate: "Date",
      hBase: "Base",
      hAmount: "Commission",
      hState: "État",
      evFirst: "Premier achat · 20%",
      evRenew: "Renouvellement {n} · 7%",
      stHold: "En attente",
      stPayable: "Acquise",
      stPaid: "Versée",
      stVoid: "Annulée",
      rulesTitle: "Les règles, en bref",
      rule1: "20% du premier achat et 7% des renouvellements dès le deuxième mois, toujours sur le montant net : hors TVA, remboursements et frais.",
      rule2: "Chaque commission attend 60 jours avant d’être acquise, pour couvrir remboursements et rétrofacturations.",
      rule3: "Si un achat est remboursé ou contesté sous 120 jours, sa commission est annulée, même déjà versée : elle est déduite du solde suivant.",
      rule4: "Versements en USDT sur Polygon, une fois par mois, à la main, dès 50 $ acquis.",
      rule5: "Rien n’est assuré : ce que vous recevez dépend de qui s’abonne via vous et combien de temps il reste.",
      rule6: "Annoncez la commission avant le clic (#pub). Ne promettez jamais de gains aux paris, ne visez jamais les moins de 18 ans.",
      rule7: "Vous pouvez partir quand vous voulez. Les commissions déjà acquises restent à vous.",
      termsDraft: "Conditions du programme : en préparation, publiées avant le lancement",
      termsSite: "Conditions du site",
    },
  },
  ru: {
    common: {
      headline: "Расскажите о BetRedge тем, кто уже спрашивает у вас прогнозы.",
      linkTitle: "Ваша ссылка",
      yourCode: "Код",
      copy: "Скопировать ссылку",
      copied: "Скопировано",
      copyFail: "Выделите ссылку и скопируйте",
      codeLabel: "Выберите код",
      placeholder: "YOURCODE",
      hint: "2–20 символов: латинские буквы, цифры, - _. Изменить потом нельзя.",
      claimBtn: "Занять код",
      claimBusy: "Резервирую…",
      errTaken: "Код уже занят. Выберите другой.",
      errInvalid: "Неверный код: 2–20 символов, буквы, цифры, - _.",
      errGeneric: "Что-то пошло не так. Попробуйте ещё раз.",
      loading: "Загружаю вашу ссылку…",
      statsErr: "Сейчас не удаётся прочитать ваши цифры. Ссылка всё равно работает.",
      retry: "Повторить",
      anonTitle: "Войдите или создайте аккаунт, чтобы получить ссылку.",
      anonBody: "Ссылка привязана к аккаунту: так регистрация засчитывается вам.",
      anonCreate: "Создать аккаунт",
      anonSignIn: "Войти",
      howTitle: "Как это работает",
      step1T: "Поделитесь ссылкой",
      step1B: "Отправьте её тем, кто уже спрашивает у вас прогнозы. Каждая регистрация по ней засчитывается вам.",
      kSignups: "Регистрации",
      kPaying: "Оплатили",
      kConv: "Конверсия",
      zeroState: "Регистраций пока нет. Отправьте ссылку выше тому, кто уже спрашивает вас о сегодняшних матчах.",
    },
    v1: {
      lede: "Каждый друг, который зарегистрируется по вашей ссылке и оплатит, приближает вас к бесплатным дням PRO.",
      friendGets: "Каждый, кто зарегистрируется по вашей ссылке, получает {d} дней PRO бесплатно.",
      step2T: "Друг регистрируется и платит",
      step2B: "Регистрации и оплатившие друзья считаются по вашему коду.",
      step3T: "Вы открываете дни PRO",
      step3B: "На каждом пороге ниже. Дни добавляются в аккаунт сразу после начисления.",
      kpiTitle: "Ваши регистрации",
      kEarnedDays: "Начислено дней PRO",
      rewardsTitle: "Ваши награды",
      progress: "Оплатили: {n} · до следующей награды: {k}",
      progressDone: "Оплатили: {n} · все награды открыты",
      tierAt: "при {n} друзьях",
      rewardDays: "+{d} дней PRO",
      rewardRoom: "Закрытая комната в Telegram",
      nextUp: "Далее: {r}, при {n} оплативших друзьях",
      pending: "начисляется",
      note: "Креаторам: revenue с подписок ваших регистраций включается только по запросу, для каждого кода отдельно. Напишите нам.",
      promo: "Промо запуска −50% на первую покупку получает любой, кто зарегистрируется, — с приглашением или без. Это не преимущество вашей ссылки.",
    },
    v2: {
      lede: "Вы получаете 20% их первой покупки и 7% каждого продления со второго месяца — раз в месяц, в USDT в сети Polygon, когда баланс достигает 50 $.",
      previewTitle: "Предпросмотр — программа скоро, данные для примера",
      previewBody: "Программа с комиссией не запущена. Каждая сумма с пометкой «Пример» — пример, а не ваши деньги. До запуска ваша ссылка работает по текущей программе с днями PRO.",
      sample: "Пример",
      step2T: "Оформляют подписку: 20%",
      step2B: "С их первой покупки, без НДС, возвратов и комиссий.",
      step3T: "Продлевают: 7%",
      step3B: "С каждого продления со второго месяца, пока подписка активна.",
      kpiTitle: "От клика до продления",
      kClicks: "Клики",
      kClicksNote: "Считаются с запуска",
      kRealNote: "Регистрации и оплаты — реальные, по вашему коду.",
      ledgerTitle: "Комиссии",
      lPending: "В ожидании",
      lPendingNote: "Каждая комиссия ждёт 60 дней, прежде чем станет доступной.",
      lPayable: "Доступно",
      lPayableNote: "Выплачивается от 50 $. Меньше — переносится на следующий месяц.",
      lPaid: "Выплачено",
      lPaidNote: "Отправлено на ваш кошелёк, с транзакцией в Polygon.",
      walletTitle: "Кошелёк для выплат",
      walletNet: "USDT в Polygon",
      walletLabel: "Адрес Polygon",
      walletPh: "0x…",
      walletState: "Кошелёк не сохранён. Поле откроется с запуском программы: ничего из введённого здесь не собирается.",
      walletSave: "Сохранить кошелёк",
      walletWarn: "Только Polygon. Адрес биржи, который не принимает USDT в Polygon, теряет средства — проверьте перед вставкой.",
      walletCycle: "Выплаты отправляются вручную раз в месяц, когда доступный баланс не меньше 50 $.",
      histTitle: "История комиссий",
      hUser: "Кто",
      hEvent: "Событие",
      hDate: "Дата",
      hBase: "База",
      hAmount: "Комиссия",
      hState: "Статус",
      evFirst: "Первая покупка · 20%",
      evRenew: "Продление {n} · 7%",
      stHold: "В ожидании",
      stPayable: "Доступна",
      stPaid: "Выплачена",
      stVoid: "Отменена",
      rulesTitle: "Правила коротко",
      rule1: "20% первой покупки и 7% продлений со второго месяца, всегда от чистой суммы: без НДС, возвратов и комиссий.",
      rule2: "Каждая комиссия ждёт 60 дней, чтобы покрыть возвраты и чарджбэки.",
      rule3: "Если покупку вернули или оспорили в течение 120 дней, комиссия отменяется, даже уже выплаченная: она вычитается из следующего баланса.",
      rule4: "Выплаты в USDT в Polygon, раз в месяц, вручную, от 50 $ доступного баланса.",
      rule5: "Ничего не обещано: сумма зависит от того, кто оформит подписку через вас и как долго её сохранит.",
      rule6: "Сообщайте о комиссии до клика (#реклама). Никогда не обещайте выигрыши, никогда не обращайтесь к лицам младше 18.",
      rule7: "Выйти можно когда угодно. Уже доступные комиссии остаются вашими.",
      termsDraft: "Условия программы: готовятся, будут опубликованы до запуска",
      termsSite: "Условия сайта",
    },
  },
};

/** Lingue senza traduzione propria → inglese (la stessa regola di plansCopy). */
export function inviteCopy(lang: string): InviteCopy {
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return (INVITE_LANGS as readonly string[]).includes(base) ? INVITE_COPY[base as InviteLang] : INVITE_COPY.en;
}

export function fillInvite(s: string, v: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in v ? String(v[k]) : `{${k}}`));
}

// ── #CLASSIC-INVITE-1014 — i dati di ESEMPIO dell'anteprima v2 ──────────────
// Il backend v2 (ledger, payout, wallet) non esiste: questi numeri non vengono
// da nessuna API e la UI li mostra SOLO accanto all'etichetta «Esempio»
// (common `sample`) e sotto il banner `previewTitle`. Le basi sono i prezzi
// pubblici (29,99 $ Pro mensile) e le commissioni ne sono il 20%
// / 7% arrotondato: un esempio coerente, non un dato.
export type SampleState = "hold" | "payable" | "paid" | "void";
export type SampleRow = {
  who: string;
  event: "first" | "renew";
  renewN?: number;
  date: string; // ISO, giorno
  base: number;
  amount: number;
  state: SampleState;
};

export const INVITE_SAMPLE = {
  pending: 41.98,
  payable: 23.39,
  paid: 60.0,
  threshold: 50,
  rows: [
    { who: "m•••@gmail.com", event: "first", date: "2026-10-09", base: 29.99, amount: 6.0, state: "hold" },
    { who: "l•••@proton.me", event: "renew", renewN: 2, date: "2026-10-02", base: 29.99, amount: 2.1, state: "hold" },
    { who: "g•••@outlook.it", event: "first", date: "2026-08-04", base: 29.99, amount: 6.0, state: "payable" },
    { who: "a•••@gmail.com", event: "first", date: "2026-07-21", base: 29.99, amount: 6.0, state: "void" },
    { who: "f•••@icloud.com", event: "renew", renewN: 3, date: "2026-07-12", base: 29.99, amount: 2.1, state: "paid" },
  ] as SampleRow[],
} as const;
