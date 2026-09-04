// #PROMO-DEADLINE-0904 — il gemello CLIENT di `launchPromoActive()`
// (lib/paygate). Stesse DUE condizioni: flag ATTIVO **e** deadline reale non
// ancora passata. Esiste separato perché la funzione server legge
// `LAUNCH_PROMO_*`, che al browser non arrivano; al browser arriva la coppia
// `NEXT_PUBLIC_LAUNCH_PROMO_*`.
//
// Perché è un modulo e non tre `if` copiati: al 04/09, con la promo in
// scadenza alle 23:59Z, DUE punti dell'interfaccia gatavano la claim "-50%"
// sul SOLO flag, senza la deadline:
//   - il footnote del pannello Invita (app/app/page.tsx)
//   - la riga "invitato da" del modal di iscrizione (HomeAuthModal)
// Il banner di lancio controllava entrambe le condizioni e alla scadenza
// sparisce; il checkout server torna a prezzo pieno da solo. Quei due punti no:
// avrebbero continuato a promettere il -50% in 5 lingue finché qualcuno non
// avesse cambiato a mano la env e rifatto il deploy. Cioè esattamente il
// deceptive pricing che il commento accanto a quel codice diceva di prevenire.
//
// Regola: ogni claim di sconto nell'interfaccia passa DA QUI. Un secondo punto
// che rilegge `NEXT_PUBLIC_LAUNCH_PROMO_ENABLED` da solo è di nuovo il bug.
//
// NB: `process.env.NEXT_PUBLIC_*` va scritto come accesso letterale — è la
// forma che il bundler sostituisce a build time. Niente lookup dinamici.
export function launchPromoLive(now: number = Date.now()): boolean {
  if (process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED !== "true") return false;
  const raw = process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE;
  if (!raw) return false; // niente deadline reale = niente claim (A4 FTC)
  const t = new Date(raw).getTime();
  return Number.isFinite(t) && now < t;
}

// Scorciatoia accettata: `launchPromoLive()` si valuta al render, quindi una
// scheda RIMASTA APERTA a cavallo della scadenza continua a mostrare la claim
// finché non si ri-renderizza (il banner, che ha già un tick da 60s, invece
// sparisce). Il caso che conta — ogni caricamento di pagina dopo la scadenza —
// è coperto. Upgrade se servisse: un `useLaunchPromoLive()` con lo stesso
// intervallo da 60s del banner, e i due chiamanti diventano hook.
