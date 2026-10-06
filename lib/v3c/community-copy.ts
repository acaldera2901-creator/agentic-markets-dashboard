// lib/v3c/community-copy.ts (#REDESIGN-V3C · filone pages, parte community)
// Copy v3c di /leaderboard, /invite, /community e della cornice di /privacy,
// /terms, /profilo. EN è la fonte, IT è completa; le altre nove lingue
// ricadono sull'inglese (F10). Lessico: estimate · probability · record ·
// points. Mai hit-rate, ROI, tip, guaranteed. ≤22 parole per elemento.
import { v3cLang, type V3cLang } from "./copy";

export type CommunityLang = V3cLang;

const EN = {
  lb: {
    tab: "Leaderboard · members",
    title: "Members' table",
    metaStrong: "10 points per won bet",
    metaRest: "updates after each settlement · opt in from your settings",
    rank: "#",
    player: "Member",
    points: "Points",
    record: "Won / total",
    sport: "Sport",
    podium: "Top three",
    yourRank: "Your position",
    notListed: "You are not on the table yet.",
    notOptedIn: "Enable the leaderboard in your settings to appear on the table.",
    loading: "Loading the table…",
    error: "The table could not load.",
    retry: "Retry",
    emptyTitle: "No ranking yet.",
    emptyHint: "The table fills in after bets settle. Members choose to appear; nobody is listed by default.",
    note: "Points count members' own settled bets. They say nothing about our estimates; the record does that.",
    recordLink: "See the record",
    pts: (n: number) => `${n} pts`,
    unit: "pts",
  },
  inv: {
    tab: "Invite · your link",
    title: "Invite a friend",
    metaStrong: "One link per account",
    metaRest: "rewards come from the server, as they are granted",
    intro: "Share your link: every friend who signs up and pays brings you closer to the next reward.",
    codeLabel: "Choose your creator code",
    placeholder: "YOURCODE",
    hint: "2–20 characters: letters, numbers, - _ · cannot be changed once claimed",
    claimBtn: "Claim code",
    claimBusy: "Claiming…",
    errTaken: "Code already taken. Pick another.",
    errInvalid: "Invalid code: 2–20 characters, letters, numbers, - _.",
    errGeneric: "Temporary error, try again.",
    yourCode: "Your code",
    linkLabel: "Your invite link",
    copy: "Copy link",
    copied: "Copied",
    signups: "Sign-ups with your code",
    paying: "Paying friends",
    kpiConv: "Conversion",
    kpiEarned: "Pro days earned",
    zeroState: "No sign-ups yet. Send the link above to people who already ask you about prices.",
    statsErr: "Stats unavailable right now.",
    retry: "Retry",
    pending: "on its way",
    loading: "Loading…",
    friendGets: (d: number) => `Anyone who signs up with your link gets ${d} free days of Pro.`,
    rewardsTitle: "Your rewards",
    progress: (n: number, k: number) => `${n === 1 ? "1 paying friend" : `${n} paying friends`} · ${k} to the next reward`,
    progressDone: (n: number) => `${n} paying friends · all rewards unlocked`,
    tierAt: (n: number) => `at ${n} friends`,
    rewardDays: (d: number) => `+${d} days of Pro`,
    rewardRoom: "Private Telegram room",
    nextUp: (r: string, n: number) => `Next: ${r} · at ${n} paying friends`,
    note: "Creator option: revenue on your sign-ups only if we enable it on your code. Write to us to ask.",
    promo: "The launch discount applies to anyone who signs up, invited or not. It is not a perk of your link.",
    signInTitle: "Sign in to get your invite link",
    signInBody: "Your code and its numbers belong to your account.",
    signIn: "Sign in",
  },
  cm: {
    tab: "Community · creator slips",
    title: "Creator slips",
    metaStrong: "Built by members",
    metaRest: "each leg carries the model's own probability, unchanged",
    create: "Build yours",
    loading: "Loading…",
    loadError: "The slips could not load.",
    retry: "Retry",
    emptyTitle: "No slips published yet.",
    emptySub: "Be the first: build one in the probability view and share it.",
    open: "Open slip",
    gateNoneTitle: "Creator slips are part of Pro",
    gateNoneSub: "Matches are visible to everyone. Legs and probabilities open with Pro.",
    gatePartial: "Your plan opens some slips. Pro opens every one.",
    seePlans: "See Pro",
    lockedLine: "Legs and probability open with Pro",
    combined: "Combined",
    legs: (n: number) => (n === 1 ? "1 leg" : `${n} legs`),
    responsible: "18+ · analysis, not advice",
    locale: "en-GB",
  },
  legal: {
    title: "Legal",
    privacyTab: "Legal · privacy",
    termsTab: "Legal · terms",
    note: "The full text, below.",
  },
  profile: {
    tab: "Account · profile",
    title: "Your profile",
  },
};

export type CommunityCopy = typeof EN;

const IT: CommunityCopy = {
  lb: {
    tab: "Classifica · membri",
    title: "La classifica dei membri",
    metaStrong: "10 punti per scommessa vinta",
    metaRest: "si aggiorna a ogni settlement · si entra dalle impostazioni",
    rank: "#",
    player: "Membro",
    points: "Punti",
    record: "Vinte / totali",
    sport: "Sport",
    podium: "I primi tre",
    yourRank: "La tua posizione",
    notListed: "Non sei ancora in classifica.",
    notOptedIn: "Attiva la classifica nelle impostazioni per comparire.",
    loading: "Carico la classifica…",
    error: "La classifica non si è caricata.",
    retry: "Riprova",
    emptyTitle: "Ancora nessuna classifica.",
    emptyHint: "La classifica si riempie dopo il settlement. Ci compare solo chi lo sceglie.",
    note: "I punti contano le scommesse dei membri. Non dicono nulla delle nostre stime: per quello c'è il registro.",
    recordLink: "Apri il registro",
    pts: (n: number) => `${n} pt`,
    unit: "pt",
  },
  inv: {
    tab: "Invita · il tuo link",
    title: "Invita un amico",
    metaStrong: "Un link per account",
    metaRest: "i premi arrivano dal server, quando sono concessi",
    intro: "Condividi il tuo link: ogni amico che si iscrive e paga ti avvicina al premio successivo.",
    codeLabel: "Scegli il tuo codice creator",
    placeholder: "ILTUOCODICE",
    hint: "2–20 caratteri: lettere, numeri, - _ · una volta scelto non si cambia",
    claimBtn: "Riserva il codice",
    claimBusy: "Riservo…",
    errTaken: "Codice già preso: scegline un altro.",
    errInvalid: "Codice non valido: 2–20 caratteri, lettere, numeri, - _.",
    errGeneric: "Errore momentaneo, riprova.",
    yourCode: "Il tuo codice",
    linkLabel: "Il tuo link di invito",
    copy: "Copia link",
    copied: "Copiato",
    signups: "Iscritti col tuo codice",
    paying: "Amici paganti",
    kpiConv: "Conversione",
    kpiEarned: "Giorni Pro ottenuti",
    zeroState: "Ancora nessun iscritto. Manda il link a chi ti chiede già dei prezzi.",
    statsErr: "Statistiche non disponibili al momento.",
    retry: "Riprova",
    pending: "in arrivo",
    loading: "Carico…",
    friendGets: (d: number) => `Chi si iscrive col tuo link riceve ${d} giorni di Pro gratis.`,
    rewardsTitle: "I tuoi premi",
    progress: (n: number, k: number) => `${n === 1 ? "1 amico pagante" : `${n} amici paganti`} · ${k} al prossimo premio`,
    progressDone: (n: number) => `${n} amici paganti · tutti i premi sbloccati`,
    tierAt: (n: number) => `a ${n} amici`,
    rewardDays: (d: number) => `+${d} giorni di Pro`,
    rewardRoom: "Stanza Telegram riservata",
    nextUp: (r: string, n: number) => `Prossimo: ${r} · a ${n} amici paganti`,
    note: "Opzione creator: revenue sui tuoi iscritti solo se la attiviamo sul tuo codice. Scrivici per chiederla.",
    promo: "Lo sconto di lancio vale per chiunque si iscriva, con o senza invito: non è un vantaggio del tuo link.",
    signInTitle: "Accedi per avere il tuo link di invito",
    signInBody: "Il codice e i suoi numeri appartengono al tuo account.",
    signIn: "Accedi",
  },
  cm: {
    tab: "Community · schedine creator",
    title: "Schedine dei creator",
    metaStrong: "Costruite dai membri",
    metaRest: "ogni selezione porta la probabilità del modello, invariata",
    create: "Crea la tua",
    loading: "Carico…",
    loadError: "Le schedine non si sono caricate.",
    retry: "Riprova",
    emptyTitle: "Nessuna schedina pubblicata.",
    emptySub: "Sii il primo: costruiscila nella vista probabilità e condividila.",
    open: "Apri la schedina",
    gateNoneTitle: "Le schedine dei creator sono in Pro",
    gateNoneSub: "Le partite le vedono tutti. Selezioni e probabilità si aprono con Pro.",
    gatePartial: "Il tuo piano apre alcune schedine. Pro le apre tutte.",
    seePlans: "Vedi Pro",
    lockedLine: "Selezioni e probabilità si aprono con Pro",
    combined: "Combinata",
    legs: (n: number) => (n === 1 ? "1 selezione" : `${n} selezioni`),
    responsible: "18+ · analisi, non consigli",
    locale: "it-IT",
  },
  legal: {
    title: "Note legali",
    privacyTab: "Note legali · privacy",
    termsTab: "Note legali · termini",
    note: "Il testo completo, qui sotto, in inglese.",
  },
  profile: {
    tab: "Account · profilo",
    title: "Il tuo profilo",
  },
};

const DE: CommunityCopy = {
  lb: {
    tab: "Rangliste · Mitglieder",
    title: "Tabelle der Mitglieder",
    metaStrong: "10 Punkte pro gewonnener Wette",
    metaRest: "aktualisiert nach jeder Abrechnung · Teilnahme in deinen Einstellungen",
    rank: "#",
    player: "Mitglied",
    points: "Punkte",
    record: "Gewonnen / gesamt",
    sport: "Sport",
    podium: "Top drei",
    yourRank: "Deine Position",
    notListed: "Du stehst noch nicht in der Tabelle.",
    notOptedIn: "Aktiviere die Rangliste in deinen Einstellungen, um in der Tabelle zu erscheinen.",
    loading: "Tabelle wird geladen…",
    error: "Die Tabelle konnte nicht geladen werden.",
    retry: "Erneut versuchen",
    emptyTitle: "Noch keine Rangliste.",
    emptyHint: "Die Tabelle füllt sich, wenn Wetten abgerechnet sind. Mitglieder entscheiden selbst; standardmäßig steht niemand drin.",
    note: "Punkte zählen die eigenen abgerechneten Wetten der Mitglieder. Über unsere Schätzungen sagen sie nichts; das tut das Register.",
    recordLink: "Register ansehen",
    pts: (n: number) => `${n} Pkt.`,
    unit: "Pkt.",
  },
  inv: {
    tab: "Einladen · dein Link",
    title: "Lade einen Freund ein",
    metaStrong: "Ein Link pro Konto",
    metaRest: "Belohnungen kommen vom Server, sobald sie vergeben sind",
    intro: "Teile deinen Link: Jeder Freund, der sich anmeldet und zahlt, bringt dich der nächsten Belohnung näher.",
    codeLabel: "Wähl deinen Creator-Code",
    placeholder: "DEINCODE",
    hint: "2–20 Zeichen: Buchstaben, Zahlen, - _ · nach dem Sichern nicht änderbar",
    claimBtn: "Code sichern",
    claimBusy: "Wird gesichert…",
    errTaken: "Code schon vergeben. Wähl einen anderen.",
    errInvalid: "Ungültiger Code: 2–20 Zeichen, Buchstaben, Zahlen, - _.",
    errGeneric: "Vorübergehender Fehler, versuch es noch einmal.",
    yourCode: "Dein Code",
    linkLabel: "Dein Einladungslink",
    copy: "Link kopieren",
    copied: "Kopiert",
    signups: "Anmeldungen mit deinem Code",
    paying: "Zahlende Freunde",
    kpiConv: "Conversion",
    kpiEarned: "Verdiente Pro-Tage",
    zeroState: "Noch keine Anmeldungen. Schick den Link oben an Leute, die dich schon nach Quoten fragen.",
    statsErr: "Statistiken gerade nicht verfügbar.",
    retry: "Erneut versuchen",
    pending: "unterwegs",
    loading: "Wird geladen…",
    friendGets: (d: number) => `Wer sich mit deinem Link anmeldet, bekommt ${d} kostenlose Tage Pro.`, // REVIEW-NATIVE
    rewardsTitle: "Deine Belohnungen",
    progress: (n: number, k: number) => `${n === 1 ? "1 zahlender Freund" : `${n} zahlende Freunde`} · noch ${k} bis zur nächsten Belohnung`,
    progressDone: (n: number) => `${n} zahlende Freunde · alle Belohnungen freigeschaltet`,
    tierAt: (n: number) => `bei ${n} Freunden`,
    rewardDays: (d: number) => `+${d} Tage Pro`,
    rewardRoom: "Privater Telegram-Raum",
    nextUp: (r: string, n: number) => `Nächste: ${r} · bei ${n} zahlenden Freunden`,
    note: "Creator-Option: Umsatzbeteiligung an deinen Anmeldungen nur, wenn wir sie für deinen Code aktivieren. Schreib uns.", // REVIEW-NATIVE
    promo: "Der Startrabatt gilt für alle, die sich anmelden, eingeladen oder nicht. Er ist kein Vorteil deines Links.", // REVIEW-NATIVE
    signInTitle: "Melde dich an, um deinen Einladungslink zu bekommen",
    signInBody: "Dein Code und seine Zahlen gehören zu deinem Konto.",
    signIn: "Anmelden",
  },
  cm: {
    tab: "Community · Creator-Scheine",
    title: "Creator-Scheine",
    metaStrong: "Von Mitgliedern gebaut",
    metaRest: "jede Auswahl trägt die eigene Wahrscheinlichkeit des Modells, unverändert",
    create: "Bau deinen",
    loading: "Wird geladen…",
    loadError: "Die Scheine konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    emptyTitle: "Noch keine Scheine veröffentlicht.",
    emptySub: "Sei der Erste: Bau einen in der Wahrscheinlichkeitsansicht und teile ihn.",
    open: "Schein öffnen",
    gateNoneTitle: "Creator-Scheine sind Teil von Pro", // REVIEW-NATIVE
    gateNoneSub: "Die Spiele sieht jeder. Auswahlen und Wahrscheinlichkeiten öffnen sich mit Pro.", // REVIEW-NATIVE
    gatePartial: "Dein Plan öffnet einige Scheine. Pro öffnet alle.", // REVIEW-NATIVE
    seePlans: "Pro ansehen", // REVIEW-NATIVE
    lockedLine: "Auswahlen und Wahrscheinlichkeit öffnen sich mit Pro", // REVIEW-NATIVE
    combined: "Kombiniert",
    legs: (n: number) => (n === 1 ? "1 Auswahl" : `${n} Auswahlen`),
    responsible: "18+ · Analyse, keine Beratung", // REVIEW-NATIVE
    locale: "de-DE",
  },
  legal: {
    title: "Rechtliches", // REVIEW-NATIVE
    privacyTab: "Rechtliches · Datenschutz", // REVIEW-NATIVE
    termsTab: "Rechtliches · AGB", // REVIEW-NATIVE
    note: "Der vollständige Text, unten.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Konto · Profil",
    title: "Dein Profil",
  },
};

const ES: CommunityCopy = {
  lb: {
    tab: "Clasificación · miembros",
    title: "Tabla de miembros",
    metaStrong: "10 puntos por apuesta acertada",
    metaRest: "se actualiza tras cada liquidación · actívala en tus ajustes",
    rank: "#",
    player: "Miembro",
    points: "Puntos",
    record: "Acertadas / total",
    sport: "Deporte",
    podium: "Los tres primeros",
    yourRank: "Tu posición",
    notListed: "Aún no estás en la tabla.",
    notOptedIn: "Activa la clasificación en tus ajustes para aparecer en la tabla.",
    loading: "Cargando la tabla…",
    error: "No se ha podido cargar la tabla.",
    retry: "Reintentar",
    emptyTitle: "Aún no hay clasificación.",
    emptyHint: "La tabla se llena cuando se liquidan las apuestas. Los miembros eligen aparecer; nadie sale por defecto.",
    note: "Los puntos cuentan las apuestas liquidadas de los propios miembros. No dicen nada de nuestras estimaciones; eso lo hace el registro.",
    recordLink: "Ver el registro",
    pts: (n: number) => `${n} pts`,
    unit: "pts",
  },
  inv: {
    tab: "Invitar · tu enlace",
    title: "Invita a un amigo",
    metaStrong: "Un enlace por cuenta",
    metaRest: "las recompensas vienen del servidor, a medida que se conceden",
    intro: "Comparte tu enlace: cada amigo que se registra y paga te acerca a la siguiente recompensa.", // REVIEW-NATIVE
    codeLabel: "Elige tu código de creador",
    placeholder: "TUCODIGO",
    hint: "2–20 caracteres: letras, números, - _ · no se puede cambiar una vez reclamado",
    claimBtn: "Reclamar código",
    claimBusy: "Reclamando…",
    errTaken: "Código ya en uso. Elige otro.",
    errInvalid: "Código no válido: 2–20 caracteres, letras, números, - _.",
    errGeneric: "Error temporal, inténtalo de nuevo.",
    yourCode: "Tu código",
    linkLabel: "Tu enlace de invitación",
    copy: "Copiar enlace",
    copied: "Copiado",
    signups: "Registros con tu código",
    paying: "Amigos que pagan", // REVIEW-NATIVE
    kpiConv: "Conversión",
    kpiEarned: "Días de Pro ganados", // REVIEW-NATIVE
    zeroState: "Aún no hay registros. Envía el enlace de arriba a quienes ya te preguntan por cuotas.",
    statsErr: "Estadísticas no disponibles ahora mismo.",
    retry: "Reintentar",
    pending: "en camino",
    loading: "Cargando…",
    friendGets: (d: number) => `Quien se registre con tu enlace recibe ${d} días gratis de Pro.`, // REVIEW-NATIVE
    rewardsTitle: "Tus recompensas",
    progress: (n: number, k: number) => `${n === 1 ? "1 amigo que paga" : `${n} amigos que pagan`} · ${k} para la siguiente recompensa`, // REVIEW-NATIVE
    progressDone: (n: number) => `${n} amigos que pagan · todas las recompensas desbloqueadas`, // REVIEW-NATIVE
    tierAt: (n: number) => `con ${n} amigos`,
    rewardDays: (d: number) => `+${d} días de Pro`, // REVIEW-NATIVE
    rewardRoom: "Sala privada de Telegram",
    nextUp: (r: string, n: number) => `Siguiente: ${r} · con ${n} amigos que pagan`,
    note: "Opción de creador: ingresos por tus registros solo si la activamos en tu código. Escríbenos para pedirlo.", // REVIEW-NATIVE
    promo: "El descuento de lanzamiento vale para cualquiera que se registre, invitado o no. No es una ventaja de tu enlace.", // REVIEW-NATIVE
    signInTitle: "Inicia sesión para obtener tu enlace de invitación",
    signInBody: "Tu código y sus números pertenecen a tu cuenta.",
    signIn: "Iniciar sesión",
  },
  cm: {
    tab: "Comunidad · boletos de creadores",
    title: "Boletos de creadores",
    metaStrong: "Creados por miembros",
    metaRest: "cada selección lleva la probabilidad del propio modelo, sin cambios",
    create: "Crea el tuyo",
    loading: "Cargando…",
    loadError: "No se han podido cargar los boletos.",
    retry: "Reintentar",
    emptyTitle: "Aún no hay boletos publicados.",
    emptySub: "Sé el primero: crea uno en la vista de probabilidad y compártelo.",
    open: "Abrir boleto",
    gateNoneTitle: "Los boletos de creadores son parte de Pro", // REVIEW-NATIVE
    gateNoneSub: "Los partidos los ve todo el mundo. Selecciones y probabilidades se abren con Pro.", // REVIEW-NATIVE
    gatePartial: "Tu plan abre algunos boletos. Pro los abre todos.", // REVIEW-NATIVE
    seePlans: "Ver Pro", // REVIEW-NATIVE
    lockedLine: "Selecciones y probabilidad se abren con Pro", // REVIEW-NATIVE
    combined: "Combinada",
    legs: (n: number) => (n === 1 ? "1 selección" : `${n} selecciones`),
    responsible: "18+ · análisis, no consejos", // REVIEW-NATIVE
    locale: "es-ES",
  },
  legal: {
    title: "Legal", // REVIEW-NATIVE
    privacyTab: "Legal · privacidad", // REVIEW-NATIVE
    termsTab: "Legal · términos", // REVIEW-NATIVE
    note: "El texto completo, abajo.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Cuenta · perfil",
    title: "Tu perfil",
  },
};

const FR: CommunityCopy = {
  lb: {
    tab: "Classement · membres",
    title: "Le tableau des membres",
    metaStrong: "10 points par pari gagné",
    metaRest: "mis à jour après chaque règlement · activez-le dans vos paramètres",
    rank: "#",
    player: "Membre",
    points: "Points",
    record: "Gagnés / total",
    sport: "Sport",
    podium: "Le podium",
    yourRank: "Votre position",
    notListed: "Vous n’êtes pas encore au classement.",
    notOptedIn: "Activez le classement dans vos paramètres pour y apparaître.",
    loading: "Chargement du classement…",
    error: "Le classement n’a pas pu se charger.",
    retry: "Réessayer",
    emptyTitle: "Pas encore de classement.",
    emptyHint: "Le classement se remplit après le règlement des paris. Les membres choisissent d’apparaître ; personne n’y figure par défaut.",
    note: "Les points comptent les paris réglés des membres. Ils ne disent rien de nos estimations ; c’est le rôle du registre.",
    recordLink: "Voir le registre",
    pts: (n: number) => `${n} pts`,
    unit: "pts",
  },
  inv: {
    tab: "Inviter · votre lien",
    title: "Invitez un ami",
    metaStrong: "Un lien par compte",
    metaRest: "les récompenses viennent du serveur, à mesure qu’elles sont accordées",
    intro: "Partagez votre lien : chaque ami qui s’inscrit et paie vous rapproche de la prochaine récompense.", // REVIEW-NATIVE
    codeLabel: "Choisissez votre code créateur",
    placeholder: "VOTRECODE",
    hint: "2 à 20 caractères : lettres, chiffres, - _ · non modifiable une fois réservé",
    claimBtn: "Réserver le code",
    claimBusy: "Réservation…",
    errTaken: "Code déjà pris. Choisissez-en un autre.",
    errInvalid: "Code invalide : 2 à 20 caractères, lettres, chiffres, - _.",
    errGeneric: "Erreur temporaire, réessayez.",
    yourCode: "Votre code",
    linkLabel: "Votre lien d’invitation",
    copy: "Copier le lien",
    copied: "Copié",
    signups: "Inscriptions avec votre code",
    paying: "Amis payants", // REVIEW-NATIVE
    kpiConv: "Conversion",
    kpiEarned: "Jours Pro gagnés", // REVIEW-NATIVE
    zeroState: "Pas encore d’inscription. Envoyez le lien ci-dessus aux personnes qui vous parlent déjà de cotes.",
    statsErr: "Statistiques indisponibles pour le moment.",
    retry: "Réessayer",
    pending: "en cours",
    loading: "Chargement…",
    friendGets: (d: number) => `Toute personne qui s’inscrit avec votre lien reçoit ${d} jours de Pro offerts.`, // REVIEW-NATIVE
    rewardsTitle: "Vos récompenses",
    progress: (n: number, k: number) => `${n === 1 ? "1 ami payant" : `${n} amis payants`} · encore ${k} pour la prochaine récompense`, // REVIEW-NATIVE
    progressDone: (n: number) => `${n} amis payants · toutes les récompenses débloquées`, // REVIEW-NATIVE
    tierAt: (n: number) => `à ${n} amis`,
    rewardDays: (d: number) => `+${d} jours de Pro`, // REVIEW-NATIVE
    rewardRoom: "Salon Telegram privé",
    nextUp: (r: string, n: number) => `Prochaine : ${r} · à ${n} amis payants`, // REVIEW-NATIVE
    note: "Option créateur : revenus sur vos inscriptions uniquement si nous l’activons sur votre code. Écrivez-nous pour la demander.", // REVIEW-NATIVE
    promo: "La remise de lancement s’applique à toute personne qui s’inscrit, invitée ou non. Ce n’est pas un avantage de votre lien.", // REVIEW-NATIVE
    signInTitle: "Connectez-vous pour obtenir votre lien d’invitation",
    signInBody: "Votre code et ses chiffres appartiennent à votre compte.",
    signIn: "Se connecter",
  },
  cm: {
    tab: "Communauté · combinés de créateurs",
    title: "Combinés de créateurs",
    metaStrong: "Construits par les membres",
    metaRest: "chaque sélection garde la probabilité propre du modèle, inchangée",
    create: "Construisez le vôtre",
    loading: "Chargement…",
    loadError: "Les combinés n’ont pas pu se charger.",
    retry: "Réessayer",
    emptyTitle: "Aucun combiné publié pour l’instant.",
    emptySub: "Soyez le premier : construisez-en un dans la vue des probabilités et partagez-le.",
    open: "Ouvrir le combiné",
    gateNoneTitle: "Les combinés de créateurs font partie de Pro", // REVIEW-NATIVE
    gateNoneSub: "Les matchs sont visibles par tous. Sélections et probabilités s’ouvrent avec Pro.", // REVIEW-NATIVE
    gatePartial: "Votre formule ouvre certains combinés. Pro les ouvre tous.", // REVIEW-NATIVE
    seePlans: "Voir Pro", // REVIEW-NATIVE
    lockedLine: "Sélections et probabilité s’ouvrent avec Pro", // REVIEW-NATIVE
    combined: "Combiné",
    legs: (n: number) => (n === 1 ? "1 sélection" : `${n} sélections`),
    responsible: "18+ · analyse, pas des conseils", // REVIEW-NATIVE
    locale: "fr-FR",
  },
  legal: {
    title: "Mentions légales", // REVIEW-NATIVE
    privacyTab: "Mentions légales · confidentialité", // REVIEW-NATIVE
    termsTab: "Mentions légales · conditions", // REVIEW-NATIVE
    note: "Le texte complet, ci-dessous.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Compte · profil",
    title: "Votre profil",
  },
};

const NL: CommunityCopy = {
  lb: {
    tab: "Ranglijst · leden",
    title: "Ledenklassement",
    metaStrong: "10 punten per gewonnen wed",
    metaRest: "bijgewerkt na elke afrekening · aanmelden via je instellingen",
    rank: "#",
    player: "Lid",
    points: "Punten",
    record: "Gewonnen / totaal",
    sport: "Sport",
    podium: "Top drie",
    yourRank: "Jouw positie",
    notListed: "Je staat nog niet in het klassement.",
    notOptedIn: "Zet de ranglijst aan in je instellingen om in het klassement te verschijnen.",
    loading: "Klassement laden…",
    error: "Het klassement kon niet laden.",
    retry: "Opnieuw",
    emptyTitle: "Nog geen ranglijst.",
    emptyHint: "Het klassement vult zich zodra weddenschappen zijn afgerekend. Leden kiezen zelf of ze verschijnen; standaard staat niemand erin.",
    note: "Punten tellen de eigen afgerekende weddenschappen van leden. Ze zeggen niets over onze schattingen; dat doet het register.",
    recordLink: "Bekijk het register",
    pts: (n: number) => `${n} ptn`,
    unit: "ptn",
  },
  inv: {
    tab: "Uitnodigen · jouw link",
    title: "Nodig een vriend uit",
    metaStrong: "Eén link per account",
    metaRest: "beloningen komen van de server, zodra ze worden toegekend",
    intro: "Deel je link: elke vriend die zich aanmeldt en betaalt brengt je dichter bij de volgende beloning.", // REVIEW-NATIVE
    codeLabel: "Kies je creatorcode",
    placeholder: "JOUWCODE",
    hint: "2–20 tekens: letters, cijfers, - _ · niet te wijzigen na claimen",
    claimBtn: "Code claimen",
    claimBusy: "Bezig met claimen…",
    errTaken: "Code al in gebruik. Kies een andere.",
    errInvalid: "Ongeldige code: 2–20 tekens, letters, cijfers, - _.",
    errGeneric: "Tijdelijke fout, probeer het opnieuw.",
    yourCode: "Jouw code",
    linkLabel: "Jouw uitnodigingslink",
    copy: "Link kopiëren",
    copied: "Gekopieerd",
    signups: "Aanmeldingen met jouw code",
    paying: "Betalende vrienden", // REVIEW-NATIVE
    kpiConv: "Conversie",
    kpiEarned: "Verdiende Pro-dagen", // REVIEW-NATIVE
    zeroState: "Nog geen aanmeldingen. Stuur de link hierboven naar mensen die je al naar odds vragen.",
    statsErr: "Statistieken nu niet beschikbaar.",
    retry: "Opnieuw",
    pending: "onderweg",
    loading: "Laden…",
    friendGets: (d: number) => `Wie zich met jouw link aanmeldt, krijgt ${d} gratis dagen Pro.`, // REVIEW-NATIVE
    rewardsTitle: "Jouw beloningen",
    progress: (n: number, k: number) => `${n === 1 ? "1 betalende vriend" : `${n} betalende vrienden`} · nog ${k} tot de volgende beloning`, // REVIEW-NATIVE
    progressDone: (n: number) => `${n} betalende vrienden · alle beloningen ontgrendeld`, // REVIEW-NATIVE
    tierAt: (n: number) => `bij ${n} vrienden`,
    rewardDays: (d: number) => `+${d} dagen Pro`, // REVIEW-NATIVE
    rewardRoom: "Privé Telegram-groep",
    nextUp: (r: string, n: number) => `Volgende: ${r} · bij ${n} betalende vrienden`, // REVIEW-NATIVE
    note: "Creatoroptie: inkomsten op jouw aanmeldingen alleen als we dat voor jouw code aanzetten. Stuur ons een bericht om het te vragen.", // REVIEW-NATIVE
    promo: "De lanceringskorting geldt voor iedereen die zich aanmeldt, uitgenodigd of niet. Het is geen voordeel van jouw link.", // REVIEW-NATIVE
    signInTitle: "Log in om je uitnodigingslink te krijgen",
    signInBody: "Je code en de cijfers ervan horen bij je account.",
    signIn: "Inloggen",
  },
  cm: {
    tab: "Community · creator-slips",
    title: "Creator-slips",
    metaStrong: "Gemaakt door leden",
    metaRest: "elke selectie draagt de eigen kans van het model, onveranderd",
    create: "Maak de jouwe",
    loading: "Laden…",
    loadError: "De slips konden niet laden.",
    retry: "Opnieuw",
    emptyTitle: "Nog geen slips gepubliceerd.",
    emptySub: "Wees de eerste: maak er een in de kansweergave en deel hem.",
    open: "Slip openen",
    gateNoneTitle: "Creator-slips horen bij Pro", // REVIEW-NATIVE
    gateNoneSub: "Wedstrijden ziet iedereen. Selecties en kansen openen met Pro.", // REVIEW-NATIVE
    gatePartial: "Jouw abonnement opent een deel van de slips. Pro opent ze allemaal.", // REVIEW-NATIVE
    seePlans: "Bekijk Pro", // REVIEW-NATIVE
    lockedLine: "Selecties en kans openen met Pro", // REVIEW-NATIVE
    combined: "Gecombineerd",
    legs: (n: number) => (n === 1 ? "1 selectie" : `${n} selecties`),
    responsible: "18+ · analyse, geen advies", // REVIEW-NATIVE
    locale: "nl-NL",
  },
  legal: {
    title: "Juridisch", // REVIEW-NATIVE
    privacyTab: "Juridisch · privacy", // REVIEW-NATIVE
    termsTab: "Juridisch · voorwaarden", // REVIEW-NATIVE
    note: "De volledige tekst, hieronder.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Account · profiel",
    title: "Jouw profiel",
  },
};

const PL: CommunityCopy = {
  lb: {
    tab: "Ranking · członkowie",
    title: "Tabela członków",
    metaStrong: "10 pkt za każdy wygrany zakład",
    metaRest: "aktualizacja po każdym rozliczeniu · włącz w ustawieniach",
    rank: "#",
    player: "Członek",
    points: "Punkty",
    record: "Wygrane / wszystkie",
    sport: "Sport",
    podium: "Pierwsza trójka",
    yourRank: "Twoja pozycja",
    notListed: "Nie ma cię jeszcze w tabeli.",
    notOptedIn: "Włącz ranking w ustawieniach, by pojawić się w tabeli.",
    loading: "Wczytywanie tabeli…",
    error: "Nie udało się wczytać tabeli.",
    retry: "Ponów",
    emptyTitle: "Jeszcze brak rankingu.",
    emptyHint: "Tabela zapełnia się po rozliczeniu zakładów. Członkowie sami decydują o udziale; domyślnie nikt nie jest widoczny.",
    note: "Punkty liczą rozliczone zakłady samych członków. Nie mówią nic o naszych szacunkach; od tego jest rejestr.",
    recordLink: "Zobacz rejestr",
    pts: (n: number) => `${n} pkt`,
    unit: "pkt",
  },
  inv: {
    tab: "Zaproszenie · twój link",
    title: "Zaproś znajomego",
    metaStrong: "Jeden link na konto",
    metaRest: "nagrody przychodzą z serwera, gdy zostaną przyznane",
    intro: "Udostępnij swój link: każdy znajomy, który się zarejestruje i zapłaci, przybliża cię do następnej nagrody.", // REVIEW-NATIVE
    codeLabel: "Wybierz swój kod twórcy",
    placeholder: "TWOJKOD",
    hint: "2–20 znaków: litery, cyfry, - _ · po zajęciu nie można go zmienić",
    claimBtn: "Zajmij kod",
    claimBusy: "Zajmowanie…",
    errTaken: "Kod jest już zajęty. Wybierz inny.",
    errInvalid: "Nieprawidłowy kod: 2–20 znaków, litery, cyfry, - _.",
    errGeneric: "Chwilowy błąd, spróbuj ponownie.",
    yourCode: "Twój kod",
    linkLabel: "Twój link z zaproszeniem",
    copy: "Kopiuj link",
    copied: "Skopiowano",
    signups: "Rejestracje z twoim kodem",
    paying: "Płacący znajomi",
    kpiConv: "Konwersja",
    kpiEarned: "Zdobyte dni Pro",
    zeroState: "Jeszcze brak rejestracji. Wyślij link powyżej osobom, które już pytają cię o kursy.",
    statsErr: "Statystyki chwilowo niedostępne.",
    retry: "Ponów",
    pending: "w drodze",
    loading: "Wczytywanie…",
    friendGets: (d: number) => `Każdy, kto zarejestruje się z twojego linku, dostaje ${d === 1 ? `${d} darmowy dzień` : `${d} darmowych dni`} Pro.`, // REVIEW-NATIVE
    rewardsTitle: "Twoje nagrody",
    progress: (n: number, k: number) => `${n === 1 ? "1 płacący znajomy" : `${n} płacących znajomych`} · do następnej nagrody: ${k}`,
    progressDone: (n: number) => `${n} płacących znajomych · wszystkie nagrody odblokowane`,
    tierAt: (n: number) => `przy ${n} znajomych`,
    rewardDays: (d: number) => `+${d} ${d === 1 ? "dzień" : "dni"} Pro`,
    rewardRoom: "Prywatny pokój na Telegramie",
    nextUp: (r: string, n: number) => `Następna: ${r} · przy ${n} płacących znajomych`,
    note: "Opcja dla twórców: przychód z twoich rejestracji tylko, jeśli włączymy ją dla twojego kodu. Napisz do nas.", // REVIEW-NATIVE
    promo: "Zniżka startowa obejmuje każdego, kto się zarejestruje, z zaproszeniem lub bez. To nie bonus twojego linku.", // REVIEW-NATIVE
    signInTitle: "Zaloguj się, by dostać link z zaproszeniem",
    signInBody: "Twój kod i jego liczby należą do twojego konta.",
    signIn: "Zaloguj się",
  },
  cm: {
    tab: "Społeczność · kupony twórców",
    title: "Kupony twórców",
    metaStrong: "Tworzone przez członków",
    metaRest: "każda noga ma własne prawdopodobieństwo modelu, bez zmian",
    create: "Zbuduj swój",
    loading: "Wczytywanie…",
    loadError: "Nie udało się wczytać kuponów.",
    retry: "Ponów",
    emptyTitle: "Nie opublikowano jeszcze kuponów.",
    emptySub: "Bądź pierwszy: zbuduj kupon w widoku prawdopodobieństw i udostępnij go.",
    open: "Otwórz kupon",
    gateNoneTitle: "Kupony twórców są częścią Pro", // REVIEW-NATIVE
    gateNoneSub: "Mecze widzi każdy. Nogi i prawdopodobieństwa otwierają się z Pro.", // REVIEW-NATIVE
    gatePartial: "Twój plan otwiera część kuponów. Pro otwiera wszystkie.", // REVIEW-NATIVE
    seePlans: "Zobacz Pro", // REVIEW-NATIVE
    lockedLine: "Nogi i prawdopodobieństwo otwierają się z Pro", // REVIEW-NATIVE
    combined: "Łącznie",
    legs: (n: number) => (n === 1 ? "1 noga" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} nogi` : `${n} nóg`),
    responsible: "18+ · analiza, nie porady", // REVIEW-NATIVE
    locale: "pl-PL",
  },
  legal: {
    title: "Informacje prawne", // REVIEW-NATIVE
    privacyTab: "Informacje prawne · prywatność", // REVIEW-NATIVE
    termsTab: "Informacje prawne · regulamin", // REVIEW-NATIVE
    note: "Pełny tekst poniżej.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Konto · profil",
    title: "Twój profil",
  },
};

const PT: CommunityCopy = {
  lb: {
    tab: "Classificação · membros",
    title: "Tabela dos membros",
    metaStrong: "10 pontos por aposta ganha",
    metaRest: "atualiza após cada liquidação · ativa-a nas tuas definições",
    rank: "#",
    player: "Membro",
    points: "Pontos",
    record: "Ganhas / total",
    sport: "Desporto",
    podium: "Os três primeiros",
    yourRank: "A tua posição",
    notListed: "Ainda não estás na tabela.",
    notOptedIn: "Ativa a classificação nas tuas definições para apareceres na tabela.",
    loading: "A carregar a tabela…",
    error: "A tabela não carregou.",
    retry: "Tentar de novo",
    emptyTitle: "Ainda sem classificação.",
    emptyHint: "A tabela enche-se depois de as apostas serem liquidadas. Os membros escolhem aparecer; ninguém é listado por defeito.",
    note: "Os pontos contam as apostas liquidadas dos próprios membros. Não dizem nada sobre as nossas estimativas; isso é o registo.",
    recordLink: "Ver o registo",
    pts: (n: number) => `${n} pts`,
    unit: "pts",
  },
  inv: {
    tab: "Convidar · o teu link",
    title: "Convida um amigo",
    metaStrong: "Um link por conta",
    metaRest: "as recompensas vêm do servidor, à medida que são atribuídas",
    intro: "Partilha o teu link: cada amigo que se regista e paga aproxima-te da próxima recompensa.",
    codeLabel: "Escolhe o teu código de criador",
    placeholder: "OTEUCODIGO",
    hint: "2–20 caracteres: letras, números, - _ · não pode ser alterado depois de reclamado",
    claimBtn: "Reclamar código",
    claimBusy: "A reclamar…",
    errTaken: "Código já usado. Escolhe outro.",
    errInvalid: "Código inválido: 2–20 caracteres, letras, números, - _.",
    errGeneric: "Erro temporário, tenta de novo.",
    yourCode: "O teu código",
    linkLabel: "O teu link de convite",
    copy: "Copiar link",
    copied: "Copiado",
    signups: "Registos com o teu código",
    paying: "Amigos que pagam",
    kpiConv: "Conversão",
    kpiEarned: "Dias de Pro ganhos",
    zeroState: "Ainda sem registos. Envia o link acima a quem já te pergunta sobre odds.",
    statsErr: "Estatísticas indisponíveis neste momento.",
    retry: "Tentar de novo",
    pending: "a caminho",
    loading: "A carregar…",
    friendGets: (d: number) => `Quem se registar com o teu link recebe ${d} dias grátis de Pro.`, // REVIEW-NATIVE
    rewardsTitle: "As tuas recompensas",
    progress: (n: number, k: number) => `${n === 1 ? "1 amigo que paga" : `${n} amigos que pagam`} · faltam ${k} para a próxima recompensa`,
    progressDone: (n: number) => `${n} amigos que pagam · todas as recompensas desbloqueadas`,
    tierAt: (n: number) => `aos ${n} amigos`,
    rewardDays: (d: number) => `+${d} dias de Pro`,
    rewardRoom: "Sala privada no Telegram",
    nextUp: (r: string, n: number) => `A seguir: ${r} · aos ${n} amigos que pagam`,
    note: "Opção criador: receitas sobre os teus registos só se a ativarmos no teu código. Escreve-nos para pedir.", // REVIEW-NATIVE
    promo: "O desconto de lançamento aplica-se a quem se registar, convidado ou não. Não é uma vantagem do teu link.", // REVIEW-NATIVE
    signInTitle: "Entra para obter o teu link de convite",
    signInBody: "O teu código e os seus números pertencem à tua conta.",
    signIn: "Entrar",
  },
  cm: {
    tab: "Comunidade · boletins de criadores",
    title: "Boletins de criadores",
    metaStrong: "Feitos por membros",
    metaRest: "cada seleção leva a probabilidade do próprio modelo, sem alterações",
    create: "Cria o teu",
    loading: "A carregar…",
    loadError: "Os boletins não carregaram.",
    retry: "Tentar de novo",
    emptyTitle: "Ainda não há boletins publicados.",
    emptySub: "Sê o primeiro: cria um na vista de probabilidades e partilha-o.",
    open: "Abrir boletim",
    gateNoneTitle: "Os boletins de criadores fazem parte do Pro", // REVIEW-NATIVE
    gateNoneSub: "Os jogos são visíveis para todos. Seleções e probabilidades abrem com o Pro.", // REVIEW-NATIVE
    gatePartial: "O teu plano abre alguns boletins. O Pro abre todos.", // REVIEW-NATIVE
    seePlans: "Ver o Pro", // REVIEW-NATIVE
    lockedLine: "Seleções e probabilidade abrem com o Pro", // REVIEW-NATIVE
    combined: "Combinada",
    legs: (n: number) => (n === 1 ? "1 seleção" : `${n} seleções`),
    responsible: "18+ · análise, não conselhos", // REVIEW-NATIVE
    locale: "pt-PT",
  },
  legal: {
    title: "Legal", // REVIEW-NATIVE
    privacyTab: "Legal · privacidade", // REVIEW-NATIVE
    termsTab: "Legal · termos", // REVIEW-NATIVE
    note: "O texto completo, abaixo.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Conta · perfil",
    title: "O teu perfil",
  },
};

const RU: CommunityCopy = {
  lb: {
    tab: "Рейтинг · участники",
    title: "Таблица участников",
    metaStrong: "10 очков за выигранную ставку",
    metaRest: "обновляется после каждого расчёта · участие включается в настройках",
    rank: "#",
    player: "Участник",
    points: "Очки",
    record: "Выиграно / всего",
    sport: "Спорт",
    podium: "Тройка лучших",
    yourRank: "Ваше место",
    notListed: "Вас пока нет в таблице.",
    notOptedIn: "Включите рейтинг в настройках, чтобы появиться в таблице.",
    loading: "Загружаем таблицу…",
    error: "Таблица не загрузилась.",
    retry: "Повторить",
    emptyTitle: "Рейтинга пока нет.",
    emptyHint: "Таблица заполняется после расчёта ставок. Участники сами решают, показываться ли; по умолчанию никого нет.",
    note: "Очки считают собственные рассчитанные ставки участников. О наших оценках они ничего не говорят — для этого есть реестр.",
    recordLink: "Смотреть реестр",
    pts: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "очко" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "очка" : "очков"}`,
    unit: "очк.",
  },
  inv: {
    tab: "Приглашение · ваша ссылка",
    title: "Пригласите друга",
    metaStrong: "Одна ссылка на аккаунт",
    metaRest: "награды начисляет сервер, по мере их выдачи",
    intro: "Поделитесь ссылкой: каждый друг, который зарегистрируется и оплатит, приближает вас к следующей награде.", // REVIEW-NATIVE
    codeLabel: "Выберите код автора",
    placeholder: "YOURCODE",
    hint: "2–20 символов: буквы, цифры, - _ · после получения изменить нельзя",
    claimBtn: "Получить код",
    claimBusy: "Получаем…",
    errTaken: "Код уже занят. Выберите другой.",
    errInvalid: "Неверный код: 2–20 символов, буквы, цифры, - _.",
    errGeneric: "Временная ошибка, попробуйте ещё раз.",
    yourCode: "Ваш код",
    linkLabel: "Ваша ссылка-приглашение",
    copy: "Скопировать ссылку",
    copied: "Скопировано",
    signups: "Регистрации по вашему коду",
    paying: "Платящие друзья", // REVIEW-NATIVE
    kpiConv: "Конверсия",
    kpiEarned: "Заработано дней Pro", // REVIEW-NATIVE
    zeroState: "Регистраций пока нет. Отправьте ссылку тем, кто уже спрашивает вас о коэффициентах.",
    statsErr: "Статистика сейчас недоступна.",
    retry: "Повторить",
    pending: "в пути",
    loading: "Загрузка…",
    friendGets: (d) => `Каждый, кто зарегистрируется по вашей ссылке, получит Pro бесплатно на ${d} ${d % 10 === 1 && d % 100 !== 11 ? "день" : d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 10 || d % 100 >= 20) ? "дня" : "дней"}.`, // REVIEW-NATIVE
    rewardsTitle: "Ваши награды",
    progress: (n, k) => `${n === 1 ? "1 платящий друг" : `${n} ${n % 10 === 1 && n % 100 !== 11 ? "платящий друг" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "платящих друга" : "платящих друзей"}`} · до следующей награды: ${k}`, // REVIEW-NATIVE
    progressDone: (n) => `Платящих друзей: ${n} · все награды открыты`, // REVIEW-NATIVE
    tierAt: (n) => `при ${n} ${n % 10 === 1 && n % 100 !== 11 ? "друге" : "друзьях"}`,
    rewardDays: (d) => `+${d} ${d % 10 === 1 && d % 100 !== 11 ? "день" : d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 10 || d % 100 >= 20) ? "дня" : "дней"} Pro`, // REVIEW-NATIVE
    rewardRoom: "Закрытая комната в Telegram",
    nextUp: (r, n) => `Далее: ${r} · при ${n} ${n % 10 === 1 && n % 100 !== 11 ? "платящем друге" : "платящих друзьях"}`,
    note: "Опция для авторов: доход с ваших регистраций — только если мы включим её для вашего кода. Напишите нам.", // REVIEW-NATIVE
    promo: "Стартовая скидка действует для всех, кто регистрируется, по приглашению или без. Это не бонус вашей ссылки.", // REVIEW-NATIVE
    signInTitle: "Войдите, чтобы получить ссылку-приглашение",
    signInBody: "Ваш код и его цифры привязаны к вашему аккаунту.",
    signIn: "Войти",
  },
  cm: {
    tab: "Сообщество · купоны авторов",
    title: "Купоны авторов",
    metaStrong: "Собраны участниками",
    metaRest: "у каждого события — вероятность самой модели, без изменений",
    create: "Собрать свой",
    loading: "Загрузка…",
    loadError: "Купоны не загрузились.",
    retry: "Повторить",
    emptyTitle: "Опубликованных купонов пока нет.",
    emptySub: "Будьте первым: соберите купон в вероятностном виде и поделитесь им.",
    open: "Открыть купон",
    gateNoneTitle: "Купоны авторов входят в Pro", // REVIEW-NATIVE
    gateNoneSub: "Матчи видны всем. События и вероятности открываются с Pro.", // REVIEW-NATIVE
    gatePartial: "Ваш тариф открывает часть купонов. Pro открывает все.", // REVIEW-NATIVE
    seePlans: "Смотреть Pro", // REVIEW-NATIVE
    lockedLine: "События и вероятность открываются с Pro", // REVIEW-NATIVE
    combined: "Итого",
    legs: (n) => (n === 1 ? "1 событие" : `${n} ${n % 10 === 1 && n % 100 !== 11 ? "событие" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "события" : "событий"}`),
    responsible: "18+ · анализ, не советы", // REVIEW-NATIVE
    locale: "ru-RU",
  },
  legal: {
    title: "Правовая информация", // REVIEW-NATIVE
    privacyTab: "Правовая информация · конфиденциальность", // REVIEW-NATIVE
    termsTab: "Правовая информация · условия", // REVIEW-NATIVE
    note: "Полный текст — ниже.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Аккаунт · профиль",
    title: "Ваш профиль",
  },
};

const SV: CommunityCopy = {
  lb: {
    tab: "Topplista · medlemmar",
    title: "Medlemmarnas tabell",
    metaStrong: "10 poäng per vunnet spel",
    metaRest: "uppdateras efter varje avräkning · slå på det i dina inställningar",
    rank: "#",
    player: "Medlem",
    points: "Poäng",
    record: "Vunna / totalt",
    sport: "Sport",
    podium: "Topp tre",
    yourRank: "Din placering",
    notListed: "Du finns inte i tabellen än.",
    notOptedIn: "Slå på topplistan i dina inställningar för att synas i tabellen.",
    loading: "Laddar tabellen…",
    error: "Tabellen kunde inte laddas.",
    retry: "Försök igen",
    emptyTitle: "Ingen rankning än.",
    emptyHint: "Tabellen fylls när spel avräknas. Medlemmar väljer själva att synas; ingen listas automatiskt.",
    note: "Poängen räknar medlemmarnas egna avräknade spel. De säger ingenting om våra uppskattningar; det gör registret.",
    recordLink: "Se registret",
    pts: (n: number) => `${n} p`,
    unit: "p",
  },
  inv: {
    tab: "Bjud in · din länk",
    title: "Bjud in en vän",
    metaStrong: "En länk per konto",
    metaRest: "belöningar kommer från servern, när de beviljas",
    intro: "Dela din länk: varje vän som registrerar sig och betalar för dig närmare nästa belöning.", // REVIEW-NATIVE
    codeLabel: "Välj din kreatörskod",
    placeholder: "DINKOD",
    hint: "2–20 tecken: bokstäver, siffror, - _ · kan inte ändras när den väl tagits",
    claimBtn: "Ta koden",
    claimBusy: "Tar koden…",
    errTaken: "Koden är redan tagen. Välj en annan.",
    errInvalid: "Ogiltig kod: 2–20 tecken, bokstäver, siffror, - _.",
    errGeneric: "Tillfälligt fel, försök igen.",
    yourCode: "Din kod",
    linkLabel: "Din inbjudningslänk",
    copy: "Kopiera länk",
    copied: "Kopierad",
    signups: "Registreringar med din kod",
    paying: "Betalande vänner", // REVIEW-NATIVE
    kpiConv: "Konvertering",
    kpiEarned: "Intjänade Pro-dagar", // REVIEW-NATIVE
    zeroState: "Inga registreringar än. Skicka länken ovan till folk som redan frågar dig om odds.",
    statsErr: "Statistiken är inte tillgänglig just nu.",
    retry: "Försök igen",
    pending: "på väg",
    loading: "Laddar…",
    friendGets: (d: number) => `Den som registrerar sig via din länk får ${d} gratisdagar med Pro.`, // REVIEW-NATIVE
    rewardsTitle: "Dina belöningar",
    progress: (n: number, k: number) => `${n === 1 ? "1 betalande vän" : `${n} betalande vänner`} · ${k} kvar till nästa belöning`, // REVIEW-NATIVE
    progressDone: (n: number) => `${n} betalande vänner · alla belöningar upplåsta`, // REVIEW-NATIVE
    tierAt: (n: number) => `vid ${n} vänner`,
    rewardDays: (d: number) => `+${d} dagar med Pro`, // REVIEW-NATIVE
    rewardRoom: "Privat Telegram-rum",
    nextUp: (r: string, n: number) => `Nästa: ${r} · vid ${n} betalande vänner`, // REVIEW-NATIVE
    note: "Kreatörsalternativ: intäkter på dina registreringar bara om vi aktiverar det för din kod. Skriv till oss och fråga.", // REVIEW-NATIVE
    promo: "Lanseringsrabatten gäller alla som registrerar sig, inbjudna eller inte. Den är ingen förmån för din länk.", // REVIEW-NATIVE
    signInTitle: "Logga in för att få din inbjudningslänk",
    signInBody: "Din kod och dess siffror hör till ditt konto.",
    signIn: "Logga in",
  },
  cm: {
    tab: "Community · kreatörskuponger",
    title: "Kreatörskuponger",
    metaStrong: "Byggda av medlemmar",
    metaRest: "varje del bär modellens egen sannolikhet, oförändrad",
    create: "Bygg din egen",
    loading: "Laddar…",
    loadError: "Kupongerna kunde inte laddas.",
    retry: "Försök igen",
    emptyTitle: "Inga kuponger publicerade än.",
    emptySub: "Bli först: bygg en i sannolikhetsvyn och dela den.",
    open: "Öppna kupong",
    gateNoneTitle: "Kreatörskuponger ingår i Pro", // REVIEW-NATIVE
    gateNoneSub: "Matcherna syns för alla. Delar och sannolikheter öppnas med Pro.", // REVIEW-NATIVE
    gatePartial: "Ditt abonnemang öppnar vissa kuponger. Pro öppnar alla.", // REVIEW-NATIVE
    seePlans: "Se Pro", // REVIEW-NATIVE
    lockedLine: "Delar och sannolikhet öppnas med Pro", // REVIEW-NATIVE
    combined: "Kombinerat",
    legs: (n: number) => (n === 1 ? "1 del" : `${n} delar`),
    responsible: "18+ · analys, inga råd", // REVIEW-NATIVE
    locale: "sv-SE",
  },
  legal: {
    title: "Juridik", // REVIEW-NATIVE
    privacyTab: "Juridik · integritet", // REVIEW-NATIVE
    termsTab: "Juridik · villkor", // REVIEW-NATIVE
    note: "Hela texten, nedan.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Konto · profil",
    title: "Din profil",
  },
};

const TR: CommunityCopy = {
  lb: {
    tab: "Sıralama · üyeler",
    title: "Üye tablosu",
    metaStrong: "Kazanılan bahis başına 10 puan",
    metaRest: "her sonuçlanmadan sonra güncellenir · ayarlarından katıl",
    rank: "#",
    player: "Üye",
    points: "Puan",
    record: "Kazanılan / toplam",
    sport: "Spor",
    podium: "İlk üç",
    yourRank: "Senin sıran",
    notListed: "Henüz tabloda değilsin.",
    notOptedIn: "Tabloda görünmek için ayarlarından sıralamayı etkinleştir.",
    loading: "Tablo yükleniyor…",
    error: "Tablo yüklenemedi.",
    retry: "Tekrar dene",
    emptyTitle: "Henüz sıralama yok.",
    emptyHint: "Tablo bahisler sonuçlandıkça dolar. Üyeler görünmeyi kendileri seçer; varsayılan olarak kimse listelenmez.",
    note: "Puanlar üyelerin kendi sonuçlanan bahislerini sayar. Tahminlerimiz hakkında bir şey söylemez; onu kayıt defteri yapar.",
    recordLink: "Kayıt defterini gör",
    pts: (n: number) => `${n} puan`,
    unit: "puan",
  },
  inv: {
    tab: "Davet · bağlantın",
    title: "Bir arkadaşını davet et",
    metaStrong: "Hesap başına bir bağlantı",
    metaRest: "ödüller verildikçe sunucudan gelir",
    intro: "Bağlantını paylaş: kayıt olup ödeme yapan her arkadaş seni bir sonraki ödüle yaklaştırır.", // REVIEW-NATIVE
    codeLabel: "İçerik üretici kodunu seç",
    placeholder: "KODUN",
    hint: "2–20 karakter: harf, rakam, - _ · alındıktan sonra değiştirilemez",
    claimBtn: "Kodu al",
    claimBusy: "Alınıyor…",
    errTaken: "Kod zaten alınmış. Başka birini seç.",
    errInvalid: "Geçersiz kod: 2–20 karakter, harf, rakam, - _.",
    errGeneric: "Geçici hata, tekrar dene.",
    yourCode: "Kodun",
    linkLabel: "Davet bağlantın",
    copy: "Bağlantıyı kopyala",
    copied: "Kopyalandı",
    signups: "Kodunla kayıtlar",
    paying: "Ödeme yapan arkadaşlar",
    kpiConv: "Dönüşüm",
    kpiEarned: "Kazanılan Pro günleri",
    zeroState: "Henüz kayıt yok. Yukarıdaki bağlantıyı sana zaten oranları soran kişilere gönder.",
    statsErr: "İstatistikler şu an kullanılamıyor.",
    retry: "Tekrar dene",
    pending: "yolda",
    loading: "Yükleniyor…",
    friendGets: (d: number) => `Bağlantınla kayıt olan herkes ${d} gün ücretsiz Pro alır.`, // REVIEW-NATIVE
    rewardsTitle: "Ödüllerin",
    progress: (n: number, k: number) => `${n === 1 ? "1 ödeme yapan arkadaş" : `${n} ödeme yapan arkadaş`} · sonraki ödüle ${k}`,
    progressDone: (n: number) => `${n} ödeme yapan arkadaş · tüm ödüller açıldı`,
    tierAt: (n: number) => `${n} arkadaşta`,
    rewardDays: (d: number) => `+${d} gün Pro`,
    rewardRoom: "Özel Telegram odası",
    nextUp: (r: string, n: number) => `Sıradaki: ${r} · ${n} ödeme yapan arkadaşta`,
    note: "İçerik üretici seçeneği: kayıtlarından gelir, yalnızca kodunda etkinleştirirsek. Talep için bize yaz.", // REVIEW-NATIVE
    promo: "Lansman indirimi, davetli olsun olmasın kayıt olan herkese uygulanır. Bağlantına özel bir ayrıcalık değildir.", // REVIEW-NATIVE
    signInTitle: "Davet bağlantını almak için giriş yap",
    signInBody: "Kodun ve sayıları hesabına aittir.",
    signIn: "Giriş yap",
  },
  cm: {
    tab: "Topluluk · üretici kuponları",
    title: "Üretici kuponları",
    metaStrong: "Üyeler tarafından hazırlandı",
    metaRest: "her ayak modelin kendi olasılığını değiştirilmeden taşır",
    create: "Kendininkini hazırla",
    loading: "Yükleniyor…",
    loadError: "Kuponlar yüklenemedi.",
    retry: "Tekrar dene",
    emptyTitle: "Henüz yayınlanmış kupon yok.",
    emptySub: "İlk sen ol: olasılık görünümünde bir tane hazırla ve paylaş.",
    open: "Kuponu aç",
    gateNoneTitle: "Üretici kuponları Pro'nun parçasıdır", // REVIEW-NATIVE
    gateNoneSub: "Maçlar herkese görünür. Ayaklar ve olasılıklar Pro ile açılır.", // REVIEW-NATIVE
    gatePartial: "Planın bazı kuponları açar. Pro hepsini açar.", // REVIEW-NATIVE
    seePlans: "Pro'yu gör", // REVIEW-NATIVE
    lockedLine: "Ayaklar ve olasılık Pro ile açılır", // REVIEW-NATIVE
    combined: "Birleşik",
    legs: (n: number) => (n === 1 ? "1 ayak" : `${n} ayak`),
    responsible: "18+ · analiz, tavsiye değil", // REVIEW-NATIVE
    locale: "tr-TR",
  },
  legal: {
    title: "Yasal", // REVIEW-NATIVE
    privacyTab: "Yasal · gizlilik", // REVIEW-NATIVE
    termsTab: "Yasal · koşullar", // REVIEW-NATIVE
    note: "Tam metin aşağıda.", // REVIEW-NATIVE
  },
  profile: {
    tab: "Hesap · profil",
    title: "Profilin",
  },
};

const COMMUNITY_COPY: Record<CommunityLang, CommunityCopy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function communityCopyFor(lang: string): CommunityCopy {
  return COMMUNITY_COPY[v3cLang(lang)];
}
