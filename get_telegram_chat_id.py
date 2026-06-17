"""
Esegui questo script DOPO aver mandato /start al tuo bot su Telegram.
Stampa il tuo chat_id da copiare nel .env
"""
import httpx, os, sys

# #SEC: il token NON va hardcodato nel repo. Leggi da env (es. export TELEGRAM_BOT_TOKEN=...).
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
if not TOKEN:
    print("❌ TELEGRAM_BOT_TOKEN non impostata. Esporta la variabile (vedi .env / @BotFather) e riprova.")
    sys.exit(1)

r = httpx.get(f"https://api.telegram.org/bot{TOKEN}/getMe", timeout=10)
if r.status_code != 200:
    print(f"❌ Token non valido ({r.status_code}): {r.json()}")
    print("\nVai su @BotFather → /mybots → seleziona il bot → API Token → ricopia il token")
    sys.exit(1)

bot = r.json()["result"]
print(f"✅ Bot trovato: @{bot['username']} ({bot['first_name']})\n")

r2 = httpx.get(f"https://api.telegram.org/bot{TOKEN}/getUpdates", timeout=10)
updates = r2.json().get("result", [])
if not updates:
    print("❌ Nessun messaggio trovato.")
    print("→ Apri Telegram, cerca il tuo bot e manda /start, poi riesegui questo script.")
    sys.exit(1)

chat_id = updates[-1]["message"]["chat"]["id"]
username = updates[-1]["message"]["chat"].get("username", "—")
print(f"✅ Chat ID trovato: {chat_id}  (@{username})")
print(f"\nCopia nel .env:\n  TELEGRAM_CHAT_ID={chat_id}")
