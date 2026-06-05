# Programmatore — Memory (Agentic Markets)

Pattern, decisioni tecniche e gotcha consolidati. Solo roba non ovvia.

## Infrastruttura repo
- **Repo GitHub vero = ROOT di `~/Desktop/agentic-markets`** → remote `agentic-markets-dashboard.git` (acaldera2901-creator). Due app Next: root (deployata, prj Vercel `agentic-markets`) e `dashboard-web/` (LEGACY, non lavorarci).
- **`.git` annidato in `dashboard-web/` è un repo DIVERGENTE con LO STESSO remote** (HEAD ec8c896 ≠ root 93b1526). Mai pushare da lì: un force-push distruggerebbe `main`. Da bonificare.
- Repo piccolo: pack ~395 KiB, ~1670 oggetti → operazioni di rewrite history sono rapide.

## launchd + TCC trap (CRITICO, verificato 2026-06-05)
- launchd NON può aprire StandardOut/ErrorPath dentro `~/Desktop` (e altre TCC-protected: Documents, Downloads) → spawn failure `EX_CONFIG` PRIMA che il processo parta. Ha ucciso il watchdog.
- Fix pattern (vedi `com.agentic-markets.watchdog.plist`): python diretto + `WorkingDirectory` + stdio → `~/Library/Logs/agentic-markets/`.
- **Job grandfathered**: i plist caricati PRIMA che TCC si stringesse continuano a girare anche con stdio su ~/Desktop (es. `com.agentic-markets.agents`, PID vivo). Ma al prossimo `launchctl unload/load` muoiono. Migrare stdio quando li tocchi.

## Secrets nei plist (debito noto)
- `com.agentic-markets.agents.plist` ha env-vars in chiaro: SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL (con pw `Agenticmagnetic!`), TELEGRAM_BOT_TOKEN, ODDS_API_KEY, API_FOOTBALL_KEY/RAPIDAPI_KEY, FOOTBALL_DATA_ORG_API_KEY.
- Secrets sparsi in 2+ posti: `~/Desktop/credenziali 1/agentic-markets-api-secrets.md` (CRON/RESEARCH) e `~/Desktop/sistema-andrea/agentic-markets/secrets/` (ADMIN). Da consolidare.

## Auth (Next root app)
- **Admin**: cookie `admin_token` contiene `ADMIN_SECRET` RAW. Consumatori: `app/api/admin/login/route.ts` (set), `middleware.ts` (compare `!==`), `lib/admin-auth.ts` `isAdminAuthorized` (`safeEqual`). ADMIN_SECRET su Vercel env + middleware Edge runtime.
- **Cliente**: sessione firmata via `lib/session.ts` (SESSION_COOKIE), plan SEMPRE risolto fresh dal DB in `lib/auth.ts` (mai dal cookie). Scadenza piano enforced a runtime (`effectivePlan`).
- Cookie read header-based (`lib/auth.ts readCookie`) per evitare breaking changes API `cookies()` in questo build Next.

## Supabase
- Progetto AZIENDALE prod: `izscgffubtakzvwxchqt` (eu-west-1 pooler). Progetto PERSONALE morto da dismettere: `xcgvfrsrcphzfctfyukz` (entro ~28/06). In codice live resta solo in docs/plan (non config).
- Tutto l'accesso server usa `service_role` (BYPASSRLS). RLS on profiles; grant anon revocati su tabelle prodotto. `council_*` resta NO-RLS (Block C aperto).
- CI `.github/workflows/supabase-migrations.yml` → `supabase link --project-ref izscgffubtakzvwxchqt`. Secrets GH: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
- Secrets Vercel CRON_SECRET/RESEARCH_SECRET sono "sensitive" → non rileggibili dal CLI dopo il set.
