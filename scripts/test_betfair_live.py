"""
Test connessione Betfair live — non piazza scommesse.
Controlla: login, account funds, developer app keys, stampa ssoid per il demo tool.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from config.settings import settings

LOGIN_URL = "https://identitysso.betfair.it/api/login"
ACCOUNT_URL = "https://api.betfair.com/exchange/account/rest/v1.0"


def login() -> str:
    resp = requests.post(
        LOGIN_URL,
        data={"username": settings.BETFAIR_USERNAME, "password": settings.BETFAIR_PASSWORD},
        headers={
            "X-Application": settings.BETFAIR_APP_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        timeout=15,
    )
    body = resp.json()
    if body.get("status") != "SUCCESS":
        raise RuntimeError(f"Login fallito: {body.get('error')}")
    return body["token"]


def account_call(endpoint: str, ssoid: str) -> dict:
    resp = requests.post(
        f"{ACCOUNT_URL}/{endpoint}/",
        headers={
            "X-Authentication": ssoid,
            "X-Application": settings.BETFAIR_APP_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    print("=" * 55)
    print("  Betfair Live Connection Test")
    print("=" * 55)

    print(f"\n[1] App Key: {settings.BETFAIR_APP_KEY[:8]}...")
    print(f"    Username: {settings.BETFAIR_USERNAME}")

    print("\n[2] Login...")
    try:
        ssoid = login()
        print(f"    ✅ Session Token: {ssoid[:20]}...")
        print(f"\n    ─── COPIA QUESTO PER IL DEMO TOOL ───")
        print(f"    ssoid: {ssoid}")
        print(f"    ─────────────────────────────────────")
    except Exception as e:
        print(f"    ❌ Login fallito: {e}")
        return

    print("\n[3] Account Funds...")
    try:
        funds = account_call("getAccountFunds", ssoid)
        available = funds.get("availableToBetBalance", 0)
        exposure = funds.get("exposure", 0)
        print(f"    ✅ Available: €{available:.2f}")
        print(f"    ✅ Exposure:  €{exposure:.2f}")
    except Exception as e:
        print(f"    ❌ Errore: {e}")

    print("\n[4] Developer App Keys...")
    try:
        resp = requests.post(
            f"{ACCOUNT_URL}/getDeveloperAppKeys/",
            headers={
                "X-Authentication": ssoid,
                "X-Application": settings.BETFAIR_APP_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={},
            timeout=15,
        )
        apps = resp.json()
        for app in apps:
            print(f"    App: {app.get('appName')} (ID: {app.get('appId')})")
            for sub in app.get("appVersions", []):
                active = sub.get("active", False)
                status = "✅ ACTIVE" if active else "❌ inactive"
                key_display = sub.get("applicationKey", "")[:12] + "..."
                print(f"      - {key_display}  |  delay={sub.get('allowedDelayedBettingAccess')}  |  live={sub.get('allowedLiveBettingAccess')}  |  {status}")
    except Exception as e:
        print(f"    ❌ Errore: {e}")

    print("\n[5] Place Orders permission (dry check)...")
    try:
        resp = requests.post(
            "https://api.betfair.com/exchange/betting/rest/v1.0/listCurrentOrders/",
            headers={
                "X-Authentication": ssoid,
                "X-Application": settings.BETFAIR_APP_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={},
            timeout=15,
        )
        if resp.status_code == 200:
            orders = resp.json()
            count = len(orders.get("currentOrders", []))
            print(f"    ✅ Exchange API raggiungibile — {count} ordini aperti")
        else:
            print(f"    ❌ HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"    ❌ Errore: {e}")

    print("\n" + "=" * 55)
    print("  Risultato: se tutti ✅, sei PRONTO per andare live")
    print("  con la delay key corrente.")
    print("=" * 55)


if __name__ == "__main__":
    main()
