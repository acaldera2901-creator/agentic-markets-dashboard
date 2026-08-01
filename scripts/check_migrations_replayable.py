"""#MIGRATION-REPLAY-0801 — le migration di supabase/migrations sono ri-eseguibili?

PERCHÉ SERVE. Il registro delle migration remoto e i file locali hanno divergito
(#MIGRATION-DRIFT-0801: 29 versioni remote senza file, `supabase db push` aborta
prima di applicare qualsiasi cosa). Una delle vie per riconciliare è quella che
suggerisce il CLI: dichiarare `reverted` le versioni fantasma e lasciare che il
push ri-applichi i file locali da capo. Quella via è sicura SE E SOLO SE ogni
migration può girare due volte senza fare danni — e "senza danni" ha DUE facce,
non una:

  A. NON DEVE ERRORE. `CREATE TABLE` senza `IF NOT EXISTS`, `ADD CONSTRAINT`
     senza un `DROP ... IF EXISTS` prima, `CREATE POLICY` non guardata: la
     seconda esecuzione fallisce e il push si ferma a metà.
  B. NON DEVE TOCCARE I DATI. Questa è quella insidiosa, e me l'ero persa alla
     prima passata: un `UPDATE`, un `DELETE`, un `DROP COLUMN` o un `TRUNCATE`
     in una migration NON dà errore alla seconda esecuzione — la esegue, e la
     esegue su dati di produzione che nel frattempo sono cambiati. Un backfill
     scritto per una tabella vuota, ri-applicato su una tabella viva, riscrive
     righe reali senza lamentarsi.

Un grep riga-per-riga non basta a rispondere: le guardie stanno spesso in uno
statement SEPARATO (`DROP CONSTRAINT IF EXISTS` una riga sopra l'ADD) o dentro un
blocco `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_policies ...)`. Con un grep
ingenuo il 2026-08-01 avevo contato quattro file "non ri-eseguibili" che invece
sono tutti guardati. Questo script ragiona per STATEMENT e tiene conto delle
guardie dichiarate altrove nello stesso file.

Uso:  python scripts/check_migrations_replayable.py [--dir supabase/migrations]
Exit: 0 se tutte le migration sono ri-eseguibili, 1 se ce n'è almeno una che non
lo è (con file, riga e statement).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# ── A. statement che ERRORANO alla seconda esecuzione se non guardati ─────────
# (pattern, descrizione, regex che rende lo statement sicuro DA SOLO)
CREATE_GUARDED = re.compile(r"\bIF\s+NOT\s+EXISTS\b", re.I)

RULES_ERROR = [
    (re.compile(r"^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)", re.I), "CREATE TABLE senza IF NOT EXISTS"),
    (re.compile(r"^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS|CONCURRENTLY\s+IF\s+NOT\s+EXISTS)", re.I), "CREATE INDEX senza IF NOT EXISTS"),
    (re.compile(r"^\s*CREATE\s+TYPE\b", re.I), "CREATE TYPE (non ammette IF NOT EXISTS: serve un DO block)"),
    (re.compile(r"^\s*CREATE\s+SCHEMA\s+(?!IF\s+NOT\s+EXISTS)", re.I), "CREATE SCHEMA senza IF NOT EXISTS"),
    (re.compile(r"\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)", re.I), "ADD COLUMN senza IF NOT EXISTS"),
    (re.compile(r"\bALTER\s+TYPE\s+.*\bADD\s+VALUE\s+(?!IF\s+NOT\s+EXISTS)", re.I | re.S), "ALTER TYPE ADD VALUE senza IF NOT EXISTS"),
]

# Statement che errorano ma la cui guardia sta tipicamente in un ALTRO statement
# dello stesso file: si accetta se il file contiene il DROP corrispondente con
# IF EXISTS, oppure se lo statement e' dentro un DO block con un controllo su un
# catalogo di sistema (pg_policies / pg_constraint / pg_trigger / information_schema).
RULES_ERROR_FILE_GUARD = [
    (re.compile(r"\bADD\s+CONSTRAINT\s+([A-Za-z0-9_\"]+)", re.I), "ADD CONSTRAINT", "DROP CONSTRAINT IF EXISTS"),
    (re.compile(r"^\s*CREATE\s+POLICY\s+(\"[^\"]+\"|[A-Za-z0-9_]+)", re.I), "CREATE POLICY", "DROP POLICY IF EXISTS"),
    (re.compile(r"^\s*CREATE\s+TRIGGER\s+([A-Za-z0-9_\"]+)", re.I), "CREATE TRIGGER", "DROP TRIGGER IF EXISTS"),
]

CATALOG_GUARD = re.compile(
    r"IF\s+NOT\s+EXISTS\s*\(\s*SELECT[^)]*(pg_policies|pg_constraint|pg_trigger|pg_indexes|information_schema)",
    re.I | re.S,
)

# ── B. statement che MUTANO DATI: non errorano, e proprio per questo pesano ───
# ALLOWLIST — backfill one-shot già revisionati. Chiave = "<file>::<oggetto>", e
# ogni voce deve dire PERCHÉ un replay è innocuo. Stesso patto dell'ALLOWLIST di
# lib/sql-guard.test.ts: si ri-audita prima di aggiungere una riga, non dopo.
# Un backfill è ammesso qui SOLO se la sua WHERE lo pinna alla popolazione
# originale (tipicamente `created_at < '<data della migration>'`), perché in quel
# caso la seconda esecuzione non trova righe: non è "poco dannoso", è nullo.
REVIEWED_ONE_SHOT = {
    "20260610170000_profiles_activation.sql::UPDATE": (
        "backfill attivazione pinnato a created_at < 2026-06-10 (#MIGRATION-REPLAY-0801): "
        "senza il pin un replay attiverebbe gli account con password e senza click sul link, "
        "cioe' scavalcherebbe il gate di #AUDIT HIGH-3"
    ),
    "20260724120000_plan_source.sql::UPDATE": (
        "backfill plan_source pinnato a created_at < 2026-07-24 (#MIGRATION-REPLAY-0801): "
        "l'ELSE 'paygate' era vero solo prima del rail carta Shopify"
    ),
}

RULES_DATA = [
    (re.compile(r"^\s*UPDATE\s+", re.I), "UPDATE su dati esistenti"),
    (re.compile(r"^\s*DELETE\s+FROM\s+", re.I), "DELETE"),
    (re.compile(r"^\s*TRUNCATE\b", re.I), "TRUNCATE"),
    (re.compile(r"\bDROP\s+COLUMN\b", re.I), "DROP COLUMN"),
    (re.compile(r"^\s*DROP\s+TABLE\b", re.I), "DROP TABLE"),
    (re.compile(r"^\s*INSERT\s+INTO\s+", re.I), "INSERT"),
]
INSERT_SAFE = re.compile(r"\bON\s+CONFLICT\b", re.I)


def strip_comments(sql: str) -> str:
    """Via i commenti di riga e di blocco: un ALTER TABLE citato in un commento di
    rollback non e' uno statement (ce ne sono, in questo repo)."""
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return "\n".join(re.sub(r"--.*$", "", line) for line in sql.split("\n"))


def statements_with_lines(sql: str) -> list[tuple[int, str]]:
    """Spezza per `;` tenendo la riga d'inizio. I blocchi DO $$ ... $$ restano
    interi: dentro ci sono `;` che non terminano lo statement esterno."""
    out: list[tuple[int, str]] = []
    buf: list[str] = []
    start = 1
    in_dollar = False
    for n, line in enumerate(sql.split("\n"), start=1):
        if not buf:
            start = n
        buf.append(line)
        dollars = line.count("$$")
        if dollars % 2 == 1:
            in_dollar = not in_dollar
        if not in_dollar and ";" in line:
            out.append((start, "\n".join(buf)))
            buf = []
    if buf and "".join(buf).strip():
        out.append((start, "\n".join(buf)))
    return out


def check_file(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8")
    sql = strip_comments(raw)
    problems: list[str] = []
    name = path.name

    for line_no, stmt in statements_with_lines(sql):
        flat = " ".join(stmt.split())
        if not flat:
            continue

        # A1 — guardia nello statement stesso
        for rx, desc in RULES_ERROR:
            if rx.search(stmt) and not CREATE_GUARDED.search(stmt):
                problems.append(f"{name}:{line_no} [errore-su-replay] {desc} → {flat[:90]}")

        # A2 — guardia altrove nel file (DROP IF EXISTS dello stesso oggetto, o DO block)
        for rx, desc, needed in RULES_ERROR_FILE_GUARD:
            m = rx.search(stmt)
            if not m:
                continue
            obj = m.group(1).strip('"')
            drop_rx = re.compile(re.escape(needed).replace(r"\ ", r"\s+") + r"\s+" + re.escape(obj), re.I)
            if drop_rx.search(sql) or CATALOG_GUARD.search(stmt):
                continue
            problems.append(f"{name}:{line_no} [errore-su-replay] {desc} '{obj}' senza {needed} ne' guardia su catalogo → {flat[:80]}")

        # B — mutazione di dati
        for rx, desc in RULES_DATA:
            if not rx.search(stmt):
                continue
            if desc == "INSERT" and INSERT_SAFE.search(stmt):
                continue
            verb = flat.split()[0].upper()
            if f"{name}::{verb}" in REVIEWED_ONE_SHOT:
                continue  # backfill one-shot revisionato: vedi REVIEWED_ONE_SHOT
            problems.append(f"{name}:{line_no} [muta-dati-su-replay] {desc} → {flat[:90]}")

    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="supabase/migrations")
    args = ap.parse_args()
    d = (REPO / args.dir) if not Path(args.dir).is_absolute() else Path(args.dir)
    files = sorted(d.glob("*.sql"))
    if not files:
        print(f"nessuna migration in {d}")
        return 2

    all_problems: list[str] = []
    for f in files:
        all_problems.extend(check_file(f))

    print(f"{len(files)} migration analizzate in {d}")
    if REVIEWED_ONE_SHOT:
        print(f"{len(REVIEWED_ONE_SHOT)} backfill one-shot in allowlist (pinnati alla popolazione originale):")
        for k, why in REVIEWED_ONE_SHOT.items():
            print(f"   · {k} — {why}")
    if not all_problems:
        print("✅ tutte ri-eseguibili: nessuno statement che erri o che tocchi dati alla seconda esecuzione")
        return 0
    err = [p for p in all_problems if "[errore-su-replay]" in p]
    dat = [p for p in all_problems if "[muta-dati-su-replay]" in p]
    if err:
        print(f"\n🔴 {len(err)} statement FALLIREBBERO alla seconda esecuzione:")
        for p in err:
            print("   " + p)
    if dat:
        print(f"\n🟠 {len(dat)} statement TOCCHEREBBERO DATI alla seconda esecuzione")
        print("   (non danno errore: e' il caso peggiore da diagnosticare)")
        for p in dat:
            print("   " + p)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
