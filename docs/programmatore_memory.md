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

## API caching trap (CRITICO, verificato 2026-06-06)
- `/api/v2/predictions` proietta per sessione (`lib/access-projection.ts`) MA rispondeva `Cache-Control: public, s-maxage=120` → la CDN Vercel cachea UNA proiezione sotto la chiave-URL e la serve a tutti: un loggato vede il board anonimo, o un anonimo vede i pick sbloccati. `force-dynamic` NON basta (riguarda solo il render, non l'header CDN).
- Fix: header condizionale — `public, s-maxage` SOLO per `state==="anonymous"` (l'unica proiezione identica tra richieste), altrimenti `private, no-store`. Aggiunto `Vary: Cookie`. Stesso pattern da applicare a qualsiasi route che proietta per sessione.
- DATABASE_URL in `.env` è in forma SQLAlchemy `postgresql+asyncpg://...`; asyncpg vuole `postgresql://` → strip del `+asyncpg` negli script standalone.

## Access projection — gerarchia piani
- `PREMIUM_FIELDS` (nome storico fuorviante) è in realtà "paid-tier": concesso a base+premium+admin. Per campi STRETTAMENTE premium (es. `enrichment` = Deep Analysis) usare il nuovo set `PREMIUM_ONLY_FIELDS` gated su `premium`/`admin_full`. La home gate la Deep Analysis su `isPremium` (solo premium), non base → coerenza.

## World Cup enrichment (2026-06-06)
- Le WC paper rows ora portano `explanation` ricca (forma W-D-L+gol dal CSV nazionali, lambda Poisson, venue/squad se presenti) + colonna `enrichment` JSONB (migration `005_unified_enrichment.sql`). Builder puro in `core/world_cup_explanation.py` (fail-soft: fonte mancante → campo null/omesso, mai inventato). Writer live in `agents/model.py` la costruisce dal `world_cup_context`; backfill `scripts/backfill_wc_enrichment.py` legge squad/infortuni dal DB.
- Le probs WC NON sono colonne: stanno in `notes` JSON (`{p_home,p_draw,p_away}`). Per esporle al client serve `notes` in REVEAL_FIELDS, parse client-side. `confidence_score` è già un intero in percento (non moltiplicare ×100 — bug vecchio in WcBoard).
- Travel/timezone richiedono `host_city` che le righe storiche non hanno → venue null (onesto). `injured_count` negli snapshot squad attuali è 0 → liste infortuni vuote.

## Supabase
- Progetto AZIENDALE prod: `izscgffubtakzvwxchqt` (eu-west-1 pooler). Progetto PERSONALE morto da dismettere: `xcgvfrsrcphzfctfyukz` (entro ~28/06). In codice live resta solo in docs/plan (non config).
- Tutto l'accesso server usa `service_role` (BYPASSRLS). RLS on profiles; grant anon revocati su tabelle prodotto. `council_*` resta NO-RLS (Block C aperto).
- CI `.github/workflows/supabase-migrations.yml` → `supabase link --project-ref izscgffubtakzvwxchqt`. Secrets GH: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
- Secrets Vercel CRON_SECRET/RESEARCH_SECRET sono "sensitive" → non rileggibili dal CLI dopo il set.

## Dashboard home cards — campi reali (verificato 2026-06-06, #021)
- **Football enrichment** (`PredictionEnrichment` in app/page.tsx, popolato da `app/api/predictions/route.ts`): oltre a xg/xga/pi/injuries/weather ci sono anche `npxg_home/away`, `ppda_home/away` (PPDA: più basso = pressing più intenso), `form_home/away` (stringa W/D/L). I primi due erano REALI nel payload ma MANCAVANO dal tipo TS della home → aggiunti.
- **Tennis** (`TennisMatch`, da `app/api/tennis/route.ts`): `h2h_p1_wins/h2h_p2_wins` reali ed esposti (da `tp.h2h_p1_wins/p2_wins`, sorgente `core/tennis_features.py`).
- **World Cup** card (WcBoard, da `/api/v2/predictions` proiettato): le odds 3-vie REALI stanno SOLO in `notes` JSON (`odds_home/odds_draw/odds_away`, + `bookmaker`) e ESCLUSIVAMENTE su righe con market matchato (vedi `core/supabase_client.py:wc_prediction_to_unified_row` → ramo `has_market`). `edge_percent` reale solo su righe `signal_type='signal'` promosse (paper → edge_percent=None, paid-tier gated). `world_cup_stage` NON è proiettato al client (non in PUBLIC_FIELDS) → in UI usare `league` come descrittore, mai inventare lo stage.
- ProbBar (football) accetta prop `odds` ma NON la renderizza (prop vestigiale). Riusata nella card tennis per parità di stile.
- Settings: rimosso blocco "Risk profile" (UI + copy IT/EN + locals orfani). Il campo `risk` su `ClientProfile` e il default a signup restano (dati persistiti, fuori scope). Email ora read-only/disabled con nota supporto.
