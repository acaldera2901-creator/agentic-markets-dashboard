#!/usr/bin/env python3
"""
Human-like browser tester for Agentic Markets dashboard.
Navigates every tab, clicks every interactive element, and reports issues.

Usage:
    python3 scripts/human_tester.py [URL]
    python3 scripts/human_tester.py http://localhost:3000
    python3 scripts/human_tester.py https://agentic-markets.vercel.app

Requires: pip install playwright && python -m playwright install chromium
"""

import asyncio
import json
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from playwright.async_api import async_playwright, Page, Browser, ConsoleMessage
except ImportError:
    print("Playwright not found. Installing...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.async_api import async_playwright, Page, Browser, ConsoleMessage


BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
SCREENSHOTS_DIR = Path(__file__).parent.parent / "data" / "tester_screenshots"
REPORT_PATH = Path(__file__).parent.parent / "data" / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


@dataclass
class Finding:
    severity: str   # "error" | "warning" | "info"
    tab: str
    message: str
    detail: str = ""


@dataclass
class TestReport:
    url: str
    started_at: str
    finished_at: str = ""
    findings: list[Finding] = field(default_factory=list)
    tabs_tested: list[str] = field(default_factory=list)
    console_errors: list[str] = field(default_factory=list)
    network_errors: list[str] = field(default_factory=list)
    screenshots: list[str] = field(default_factory=list)

    def add(self, severity: str, tab: str, message: str, detail: str = ""):
        self.findings.append(Finding(severity, tab, message, detail))
        icon = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}.get(severity, "·")
        print(f"  {icon} [{tab}] {message}" + (f" — {detail}" if detail else ""))

    def summary(self) -> str:
        errors = sum(1 for f in self.findings if f.severity == "error")
        warnings = sum(1 for f in self.findings if f.severity == "warning")
        infos = sum(1 for f in self.findings if f.severity == "info")
        return f"{errors} errors · {warnings} warnings · {infos} info"


report = TestReport(url=BASE_URL, started_at=datetime.now().isoformat())
console_errors: list[str] = []
network_errors: list[str] = []


def on_console(msg: ConsoleMessage):
    if msg.type in ("error", "warning"):
        text = f"[{msg.type.upper()}] {msg.text}"
        console_errors.append(text)


def on_request_failed(request):
    network_errors.append(f"{request.method} {request.url} — {request.failure}")


async def screenshot(page: Page, name: str) -> str:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    path = str(SCREENSHOTS_DIR / f"{name}.png")
    await page.screenshot(path=path, full_page=False)
    report.screenshots.append(path)
    return path


async def human_delay(ms: int = 500):
    """Simulate human reading time."""
    await asyncio.sleep(ms / 1000)


async def wait_for_content(page: Page, timeout: int = 5000):
    """Wait for the page to settle."""
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        pass
    await human_delay(300)


async def check_element_visible(page: Page, selector: str, description: str, tab: str) -> bool:
    try:
        el = page.locator(selector).first
        if await el.is_visible(timeout=3000):
            return True
        report.add("warning", tab, f"Element not visible: {description}", selector)
        return False
    except Exception as e:
        report.add("warning", tab, f"Element missing: {description}", str(e)[:80])
        return False


async def check_no_empty_text(page: Page, selector: str, description: str, tab: str) -> bool:
    """Check that an element contains non-empty, non-placeholder text."""
    try:
        el = page.locator(selector).first
        text = (await el.inner_text(timeout=2000)).strip()
        bad_phrases = ["undefined", "null", "NaN", "Left Column", "Right Column",
                       "Operator Placement", "Partner Slot", "Bottom Operator",
                       "Top Sponsor Slot", "placeholder"]
        for bad in bad_phrases:
            if bad.lower() in text.lower():
                report.add("warning", tab, f"Placeholder text visible in {description}", f"'{text[:60]}'")
                return False
        if not text:
            report.add("warning", tab, f"Empty text in {description}", selector)
            return False
        return True
    except Exception:
        return True  # Element absent — OK if not expected


async def click_tab(page: Page, tab_text: str) -> bool:
    """Click a nav rail button by its label."""
    try:
        btn = page.locator(".rail-item", has_text=tab_text).first
        if not await btn.is_visible(timeout=3000):
            report.add("error", tab_text, "Tab button not found in nav rail")
            return False
        await btn.click()
        await human_delay(800)
        await wait_for_content(page, 3000)
        return True
    except Exception as e:
        report.add("error", tab_text, "Failed to click tab", str(e)[:80])
        return False


# ── Individual tab tests ─────────────────────────────────────────────────────

async def test_bets_tab(page: Page):
    tab = "Bets"
    print(f"\n  → Testing {tab} tab...")

    # Check for auth gate or prediction content
    auth_gate = page.locator(".bets-auth-gate").first
    if await auth_gate.is_visible(timeout=2000):
        report.add("info", tab, "Auth gate shown (not logged in) — expected for public user")
        # Check the gate has proper content
        await check_element_visible(page, ".bets-auth-gate h3", "Auth gate title", tab)
        await check_element_visible(page, ".btn-primary", "Register button", tab)
    else:
        # Logged in: check predictions content
        board = page.locator(".sportsbook-board, .unified-bets-view, .sports-predictions").first
        if not await board.is_visible(timeout=2000):
            report.add("warning", tab, "Neither auth gate nor predictions board visible")

    # Check for demo data banner
    fallback_banner = page.locator("text=Demo data").or_(page.locator("text=Dati demo")).first
    if await fallback_banner.is_visible(timeout=1000):
        report.add("info", tab, "Fallback/demo data banner visible — DB empty, expected in off-season")

    # Check KPIs in header
    kpi_strip = page.locator(".book-head-kpis").first
    if await kpi_strip.is_visible(timeout=2000):
        kpi_text = await kpi_strip.inner_text()
        if "eventi" not in kpi_text.lower() and "events" not in kpi_text.lower():
            report.add("warning", tab, "KPI strip looks empty", kpi_text[:60])

    await screenshot(page, "01_bets_tab")


async def test_history_tab(page: Page):
    tab = "Storico"
    print(f"\n  → Testing {tab}/History tab...")

    ok = await click_tab(page, "Storico")
    if not ok:
        ok = await click_tab(page, "History")
    if not ok:
        report.add("error", tab, "History tab button not found in nav")
        return

    # Check history content renders
    history_container = page.locator(".history-tab, .history-view").first
    if not await history_container.is_visible(timeout=3000):
        # Try looking for any meaningful content
        heading = page.locator("h2, h3").filter(has_text="histor").or_(
            page.locator("h2, h3").filter(has_text="Storic")
        ).first
        if not await heading.is_visible(timeout=2000):
            report.add("warning", tab, "History tab content not visible or no history data")
        else:
            report.add("info", tab, "History tab renders with heading")
    else:
        report.add("info", tab, "History tab container visible")

    await screenshot(page, "02_history_tab")


async def test_partners_tab(page: Page):
    tab = "Partner"
    print(f"\n  → Testing {tab} tab...")

    ok = await click_tab(page, "Partner")
    if not ok:
        report.add("error", tab, "Partner tab button not found in nav")
        return

    # Check partner cards render
    partner_cards = page.locator(".glass-card").all()
    cards = await partner_cards
    if len(cards) == 0:
        report.add("warning", tab, "No partner cards visible")
    else:
        report.add("info", tab, f"{len(cards)} partner card(s) visible")

    # Check no placeholder URL visible
    visit_btn = page.locator("a[href]").filter(has_text="Visit").first
    if await visit_btn.is_visible(timeout=1000):
        href = await visit_btn.get_attribute("href")
        if not href or href in ("null", "#", ""):
            report.add("warning", tab, "Partner visit button has invalid/null href", f"href={href}")

    # "Link in arrivo" or "Link coming soon" is OK — check it says that, not broken link
    coming_soon = page.locator("text=Link in arrivo").or_(page.locator("text=Link coming soon")).first
    if await coming_soon.is_visible(timeout=1000):
        report.add("info", tab, "Partner URL placeholder shows 'Link coming soon' — acceptable")

    # Check no embarrassing placeholder text
    for bad_text in ["url: null", "undefined", "Partner Principale"]:
        el = page.locator(f"text={bad_text}").first
        if await el.is_visible(timeout=500):
            report.add("warning", tab, f"Unwanted text visible: '{bad_text}'")

    await screenshot(page, "03_partners_tab")


async def test_client_area_tab(page: Page):
    tab = "Client Area"
    print(f"\n  → Testing {tab} tab...")

    ok = await click_tab(page, "Client Area")
    if not ok:
        report.add("error", tab, "Client Area tab not found in nav")
        return

    # Auth gate or client dashboard?
    login_gate = page.locator(".pre-access-wall, .locked-gate, .bets-auth-gate").first
    if await login_gate.is_visible(timeout=2000):
        report.add("info", tab, "Auth gate shown — not logged in")
    else:
        report.add("info", tab, "Client area content visible (logged in state)")

    await screenshot(page, "04_client_area_tab")


async def test_settings_tab(page: Page):
    tab = "Impostazioni"
    print(f"\n  → Testing {tab}/Settings tab...")

    ok = await click_tab(page, "Impostazioni")
    if not ok:
        ok = await click_tab(page, "Settings")
    if not ok:
        report.add("error", tab, "Settings tab not found")
        return

    await screenshot(page, "05_settings_tab")
    report.add("info", tab, "Settings tab navigated successfully")


async def test_assistance_tab(page: Page):
    tab = "Assistenza"
    print(f"\n  → Testing {tab}/Assistance tab...")

    ok = await click_tab(page, "Assistenza")
    if not ok:
        ok = await click_tab(page, "Assistance")
    if not ok:
        report.add("error", tab, "Assistance tab not found")
        return

    # Check for placeholder support chat
    placeholder_chat = page.locator("text=Support chat placeholder").first
    if await placeholder_chat.is_visible(timeout=1000):
        report.add("warning", tab, "Support chat still shows placeholder text")

    await screenshot(page, "06_assistance_tab")
    report.add("info", tab, "Assistance tab rendered")


async def test_faq_tab(page: Page):
    tab = "FAQ"
    print(f"\n  → Testing {tab} tab...")

    ok = await click_tab(page, "FAQ")
    if not ok:
        report.add("error", tab, "FAQ tab not found")
        return

    # Check for accordion items
    faq_items = page.locator("[class*='faq'], details, [role='region']").all()
    items = await faq_items
    if len(items) == 0:
        report.add("warning", tab, "No FAQ accordion items found")
    else:
        report.add("info", tab, f"FAQ section has {len(items)} item(s)")

    await screenshot(page, "07_faq_tab")


async def test_operators_tab(page: Page):
    tab = "Operatori"
    print(f"\n  → Testing {tab}/Operators tab...")

    ok = await click_tab(page, "Operatori")
    if not ok:
        ok = await click_tab(page, "Operators")
    if not ok:
        report.add("error", tab, "Operators tab not found")
        return

    await screenshot(page, "08_operators_tab")
    report.add("info", tab, "Operators tab rendered")


async def test_auth_modal(page: Page):
    tab = "Auth"
    print(f"\n  → Testing {tab} modal flow...")

    # Go back to bets tab first
    await click_tab(page, "Bets")

    # Try clicking Sign In
    sign_in_btn = page.locator("button", has_text="Sign In").or_(
        page.locator("button", has_text="Accedi")
    ).first
    if not await sign_in_btn.is_visible(timeout=2000):
        report.add("warning", tab, "Sign In button not visible (may be logged in)")
        return

    await sign_in_btn.click()
    await human_delay(600)

    # Check modal opened
    modal = page.locator("[class*='auth-modal'], [class*='modal'], [role='dialog']").first
    if await modal.is_visible(timeout=2000):
        report.add("info", tab, "Auth modal opens on Sign In click")

        # Check for email input
        email_input = page.locator("input[type='email'], input[inputmode='email']").first
        if await email_input.is_visible(timeout=1000):
            report.add("info", tab, "Email input present in modal")
        else:
            report.add("warning", tab, "No email input found in auth modal")

        # Close modal with Escape
        await page.keyboard.press("Escape")
        await human_delay(400)
    else:
        report.add("warning", tab, "Auth modal did not open after clicking Sign In")

    await screenshot(page, "09_auth_modal")


async def test_language_toggle(page: Page):
    tab = "Language"
    print(f"\n  → Testing language toggle...")

    lang_btn = page.locator(".lang-toggle").first
    if not await lang_btn.is_visible(timeout=2000):
        report.add("warning", tab, "Language toggle button not found")
        return

    initial_text = await lang_btn.inner_text()
    await lang_btn.click()
    await human_delay(400)
    new_text = await lang_btn.inner_text()

    if new_text == initial_text:
        report.add("warning", tab, "Language did not change after clicking toggle", f"Still: {new_text}")
    else:
        report.add("info", tab, f"Language toggled: {initial_text} → {new_text}")
        # Reset back
        await lang_btn.click()
        await human_delay(300)

    await screenshot(page, "10_language_toggle")


async def test_refresh_button(page: Page):
    tab = "Refresh"
    print(f"\n  → Testing refresh button...")

    await click_tab(page, "Bets")
    refresh_btn = page.locator(".rail-refresh").first
    if not await refresh_btn.is_visible(timeout=2000):
        report.add("warning", tab, "Refresh button not found in rail")
        return

    await refresh_btn.click()
    await human_delay(500)
    report.add("info", tab, "Refresh button is clickable")


async def test_page_structure(page: Page):
    tab = "Page"
    print(f"\n  → Testing page structure...")

    # Brand name
    brand = page.locator(".brand-name").first
    if await brand.is_visible(timeout=2000):
        text = await brand.inner_text()
        if "AgenticMarkets" not in text and "Agentic" not in text:
            report.add("warning", tab, "Brand name unexpected", text)
        else:
            report.add("info", tab, f"Brand: {text.strip()}")
    else:
        report.add("error", tab, "Brand name element not found")

    # Nav rail exists
    rail = page.locator(".sports-rail, .book-layout aside").first
    if not await rail.is_visible(timeout=2000):
        report.add("error", tab, "Navigation rail not found")
    else:
        # Count nav buttons
        nav_btns = await page.locator(".rail-item").all()
        count = len(nav_btns)
        if count < 7:
            report.add("warning", tab, f"Only {count} nav items visible — expected 8 (history/partners may be missing)")
        else:
            report.add("info", tab, f"Nav rail has {count} items")

    # No dev-placeholder texts
    for bad in ["Operator Placement", "Left Column", "Right Column", "Bottom Operator Banner",
                "Top Sponsor Slot", "Partner Slot · Operator"]:
        el = page.locator(f"text={bad}").first
        if await el.is_visible(timeout=300):
            report.add("warning", tab, f"Dev placeholder text still visible: '{bad}'")

    await screenshot(page, "00_page_structure")


async def test_api_endpoints(page: Page):
    """Check that API endpoints respond correctly."""
    tab = "API"
    print(f"\n  → Testing API endpoints...")

    endpoints = [
        "/api/predictions",
        "/api/data",
        "/api/tennis",
        "/api/health",
        "/api/history",
    ]
    for ep in endpoints:
        try:
            resp = await page.request.get(f"{BASE_URL}{ep}")
            status = resp.status
            if status == 200:
                body = await resp.json()
                report.add("info", tab, f"GET {ep} → 200", f"keys: {list(body.keys())[:4]}")
            elif status == 401:
                report.add("info", tab, f"GET {ep} → 401 (auth protected)")
            else:
                report.add("warning", tab, f"GET {ep} → {status}")
        except Exception as e:
            report.add("error", tab, f"GET {ep} failed", str(e)[:80])


# ── Main runner ──────────────────────────────────────────────────────────────

async def run():
    print(f"\n{'='*60}")
    print(f"  Agentic Markets — Human-Like Browser Tester")
    print(f"  URL: {BASE_URL}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="en-US",
        )
        page: Page = await ctx.new_page()
        page.on("console", on_console)
        page.on("requestfailed", on_request_failed)

        # ── Load the page ──
        print(f"  Loading {BASE_URL}...")
        try:
            resp = await page.goto(BASE_URL, timeout=30_000, wait_until="domcontentloaded")
            if resp and resp.status >= 400:
                report.add("error", "Load", f"Page returned HTTP {resp.status}")
                return
        except Exception as e:
            report.add("error", "Load", f"Failed to load page", str(e)[:100])
            return

        await wait_for_content(page, 8000)
        await human_delay(1000)
        print("  Page loaded.\n")

        # ── Tests ──
        await test_page_structure(page)
        await test_api_endpoints(page)
        await test_bets_tab(page)
        await test_history_tab(page)
        await test_partners_tab(page)
        await test_client_area_tab(page)
        await test_settings_tab(page)
        await test_assistance_tab(page)
        await test_faq_tab(page)
        await test_operators_tab(page)
        await test_auth_modal(page)
        await test_language_toggle(page)
        await test_refresh_button(page)

        # ── Collect console/network errors ──
        report.console_errors = console_errors[:]
        report.network_errors = network_errors[:]

        await browser.close()

    # ── Finalize report ──
    report.finished_at = datetime.now().isoformat()
    report.tabs_tested = ["Bets", "Storico", "Partner", "Client Area",
                          "Impostazioni", "Assistenza", "FAQ", "Operatori"]

    # Save report
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report_dict = {
        "url": report.url,
        "started_at": report.started_at,
        "finished_at": report.finished_at,
        "summary": report.summary(),
        "tabs_tested": report.tabs_tested,
        "findings": [{"severity": f.severity, "tab": f.tab, "message": f.message, "detail": f.detail} for f in report.findings],
        "console_errors": report.console_errors[:20],
        "network_errors": report.network_errors[:20],
        "screenshots": report.screenshots,
    }
    with open(REPORT_PATH, "w") as fh:
        json.dump(report_dict, fh, indent=2, ensure_ascii=False)

    # ── Print summary ──
    print(f"\n{'='*60}")
    print(f"  SUMMARY: {report.summary()}")
    print(f"\n  Errors:")
    for f in report.findings:
        if f.severity == "error":
            print(f"    ❌ [{f.tab}] {f.message}" + (f" — {f.detail}" if f.detail else ""))
    print(f"\n  Warnings:")
    for f in report.findings:
        if f.severity == "warning":
            print(f"    ⚠️  [{f.tab}] {f.message}" + (f" — {f.detail}" if f.detail else ""))

    if report.console_errors:
        print(f"\n  Console errors ({len(report.console_errors)}):")
        for e in report.console_errors[:5]:
            print(f"    • {e[:100]}")

    print(f"\n  Report saved → {REPORT_PATH}")
    print(f"  Screenshots  → {SCREENSHOTS_DIR}/")
    print(f"{'='*60}\n")

    return report_dict


if __name__ == "__main__":
    asyncio.run(run())
