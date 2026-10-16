# Persistent public navigation

Requested: retain the screenshot sidebar and five primary destinations throughout public pages; logo always returns to Home. Admin and embed surfaces are excluded. Classic-off behavior retains the existing chrome.

Root frame renders the shared sidebar; desk keeps its account controls and uses shared primary links. Other public pages receive one auth-aware SiteTopbar; nested legacy topbars suppress themselves through context. Native navigation intentionally resets local desk state, including clicking the logo while already on /. Sidebar board/filter query parameters are validated and applied after hydration. Lobby counts use the existing filtered data, not a second API fetch; other pages do not invent counts.

Desktop: persistent scrollable side rail. Mobile: persistent horizontally scrollable section bar and all five primary destinations, without document overflow at390px. Existing cookie and authentication behavior preserved. No database migration or payment code edits.

Verification:174 tests in20files,16local HTTP routes200, production webpack build and TypeScript passed; changed component lint has no errors (existing img warning). Browser checked Tools→Starting Soon, selected tab after hydration, logo→unfiltered Home, one header and11sidebar/5primary links on Partners, desktop1280/mobile390. Local tests do not certify backend data freshness. Production release requires the separate explicit approval in /Users/calde/AGENTS.md.
