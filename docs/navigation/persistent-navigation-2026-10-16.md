# Persistent public navigation

Retain the original sidebar and five primary destinations throughout public pages; logo returns to Home. Admin and embed surfaces are excluded. Classic-off behavior retains the existing chrome.

The root provider supplies a shared sidebar, placed inside the original ClassicLobby grid on Home. Other desk screens use SitePageNavigation around content only, below their existing header. Non-desk pages reuse the same grid and one auth-aware SiteTopbar. Account controls and authentication behavior remain owned by the existing pages. Native navigation resets local desk state; validated board/filter query parameters select the target lobby view. Counts come from the existing lobby data, with no invented counts on other pages.

## Proportions correction — 16 October

Removed the fixed viewport rail, root left padding, negative header margins and forced heights. Reuse classic-lobby.css without changing it: desktop rail 224px, 32px grid gap, items 40px high, 14px type, 8px 10px item padding, 12px 8px rail padding. DOM measurements on production and corrected local Home confirmed these dimensions, including the original rail x=60px and main x=316px. Sidebar height is content-driven (591.5px in the measured viewport), not stretched to the viewport bottom. Topbar height remains 61px on desktop.

Below the existing 1200px sidebar breakpoint, the full shared navigation is available in a horizontal scrolling row within page content. No extra fixed bottom strip. Existing bottom navigation and account sizing remain intact. Home and Tools document width matched the 390px mobile viewport. Isolate non-desk content backgrounds so their fixed scene layers do not cover the rail.

Verification: 201 tests in 21 files, including shared navigation, lobby URL filters, desk header placement and existing crypto checkout tests. TypeScript passed. Browser checked desktop Home and Tools, Tools→History, authentication return to Home, and mobile Home/Tools. Full desk ESLint reports three pre-existing errors (refs twice, set-state-in-effect once), confirmed identical on the prior commit; the changed navigation components have no lint errors. Local empty data does not certify backend freshness. No database or payment changes. Production release requires separate explicit approval under /Users/calde/AGENTS.md.

## Production approval and live banners
Andrea approved deployment after preserving the current live Football/Tennis banners. All four hero files (desktop/mobile for each sport) compared byte-for-byte with www.betredge.com and matched. Their contents remain unchanged; content-hash query versions refresh browser caches. No creative substitution.
