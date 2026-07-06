# OPS — Tawk.to go-live (chat supporto) · #CHAT-PROXY-VPN

Stato: **codice pronto e in `main`** (`components/LiveChat.tsx` con proxy + fallback
mailto; Worker in `infra/cloudflare/tawk-proxy-worker.js`). Resta **solo operativo**
(DNS/Cloudflare/env/dashboard Tawk) → tocca prod: **APPROVE `ch_deploy_gate`** e
gran parte è **lane Tommy** (zona `betredge.com` è sua; Andrea non ha il registrar).

## Cosa è già a posto (codice)
- `LiveChat.tsx`: se `NEXT_PUBLIC_TAWK_PROXY_HOST` è settato, carica il widget dal
  proxio; **fallback** bottone "Contattaci" (mailto info@betredge.com) dopo 6s se
  Tawk non fa `onLoad` (VPN che bloccano *.tawk.to) → supporto **mai invisibile**.
- CSP in `next.config.ts`: `*.tawk.to` già whitelistati (attualmente Report-Only).
- `.env.example`: aggiunta la voce `NEXT_PUBLIC_TAWK_PROXY_HOST` (doc).

## Checklist go-live (da eseguire — Tommy salvo dove indicato)
1. **DNS** (zona `betredge.com`): record A `chat` → IP arbitrario (es. `192.0.2.1`),
   **Proxied** (nuvola arancione ON). Non tocca apex/www/email.
2. **Cloudflare Workers**: nuovo Worker `tawk-proxy` col codice di
   `infra/cloudflare/tawk-proxy-worker.js`.
3. **Route** del Worker: `chat.betredge.com/*` (zona `betredge.com`).
4. **Test** proxy:
   `https://chat.betredge.com/__tk/embed.tawk.to/6a3ac896707bc21d4a185b17/1jrqpv3j1`
   → deve dare 200 + content-type javascript (lo script embed di Tawk).
5. **Vercel** (prod, team `betredge`): env `NEXT_PUBLIC_TAWK_PROXY_HOST=chat.betredge.com`
   → **redeploy**. (Andrea può fare questo step.)
6. **Dashboard Tawk.to** (Property → Settings → domini consentiti): whitelist
   `betredge.com` **e** `chat.betredge.com`. (loose-end storico "whitelist betredge.com in Tawk".)

## Verifica (obbligatoria, da loggato su prod)
- Con **VPN anti-tracker attiva** (NordVPN Threat Protection / Proton NetShield /
  AdGuard): il launcher della chat appare e apre la conversazione.
- Aprire una chat di test e confermare che arrivi nel dashboard Tawk.
- ⚠️ Se in DevTools/Network restano chiamate a `*.tawk.to` (il minified potrebbe
  costruire host dinamicamente) → alcune sfuggono alla riscrittura: annotare il
  pattern e aggiungerlo alla riscrittura nel Worker. Il fallback mailto copre
  intanto il caso peggiore.

## Rollback istantaneo
Rimuovi env `NEXT_PUBLIC_TAWK_PROXY_HOST` + redeploy → il widget torna a caricare
da `embed.tawk.to`. Worker/DNS restano innocui (proxa solo `*.tawk.to`, non open-proxy).
