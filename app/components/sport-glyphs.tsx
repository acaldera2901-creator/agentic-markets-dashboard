// app/components/sport-glyphs.tsx
// Sprite SVG dei glifi sport custom (sleek-coral). Stile: line-art geometrica,
// stroke 1.5, round join, UNA forma in coral per glifo. Montare una volta in cima
// al layout; usare via <svg className="..."><use href="#g-ball"/></svg>.
// Fonte di verità: docs/design-craft/mockups/redesign-direction-v2.html
export function SportGlyphSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="g-ball" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.4 15.4 9.9 14.1 13.9 9.9 13.9 8.6 9.9Z" fill="var(--am-coral)" stroke="var(--am-coral)" />
            <path d="M12 3v4.4M15.4 9.9l3.7-1.4M14.1 13.9l2.4 3.4M9.9 13.9l-2.4 3.4M8.6 9.9 4.9 8.5" />
          </g>
        </symbol>
        <symbol id="g-pitch" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="14" rx="1.5" />
            <path d="M12 5v14" /><circle cx="12" cy="12" r="2.6" />
            <path d="M3 8.6h2.8v6.8H3M21 8.6h-2.8v6.8H21" />
            <circle cx="12" cy="12" r="0.7" fill="var(--am-coral)" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-racket" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <ellipse cx="9.5" cy="8.2" rx="5.5" ry="6.2" />
            <path d="M12.7 12.9 21 21.2" /><path d="M11 14l-1.2 1.2" />
            <g stroke="var(--am-coral)" strokeWidth="1"><path d="M6.4 5.2v6.4M9.5 4.1v8.5M12.6 5.6v5.6M5.1 8.2h8.8M5 10.6h9" /></g>
          </g>
        </symbol>
        <symbol id="g-tball" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M5 6.5c3.4 2 3.4 9 0 11M19 6.5c-3.4 2-3.4 9 0 11" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-grass" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M4 20v-8M4 12c0-2.4 1.6-4 3.4-4M12 20V8" />
            <path d="M12 8c0-2.6 1.8-4.4 3.8-4.4" stroke="var(--am-coral)" /><path d="M12 20V8" stroke="var(--am-coral)" />
            <path d="M20 20v-7M20 13c0-2.2-1.4-3.6-3-3.6" />
            <path d="M3 20h18" strokeWidth="1.5" />
          </g>
        </symbol>
        <symbol id="g-court" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M3 20 7 5h10l4 15Z" /><path d="M5.3 12.5h13.4" /><path d="M6.6 8h10.8" />
            <path d="M12 8v9" /><path d="M5.3 20h13.4" stroke="var(--am-coral)" strokeDasharray="1.4 1.4" />
          </g>
        </symbol>
        <symbol id="g-trophy" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
            <path d="M7 5.5H4.2V7A2.8 2.8 0 0 0 7 9.8M17 5.5h2.8V7A2.8 2.8 0 0 1 17 9.8" />
            <path d="M12 13v3.2M9 20h6M9.6 20l.5-3.8h3.8l.5 3.8" />
            <circle cx="12" cy="6.4" r="1.7" fill="var(--am-coral)" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-desk" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M4 20V10M9.3 20V5M14.6 20v-7" />
            <path d="M20 20V8" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-history" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5A8 8 0 1 1 4 13" /><path d="M4 4v3.5h3.5" /><path d="M12 8v4.4l3 1.8" stroke="var(--am-coral)" /></g></symbol>
        <symbol id="g-rank" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20v-6M12 20V8M19 20v-9" stroke="var(--am-coral)" /><path d="M3 20h18" /></g></symbol>
        <symbol id="g-builder" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.4" /><rect x="13" y="13" width="7" height="7" rx="1.4" stroke="var(--am-coral)" /><path d="M11 7.5h4.5a2 2 0 0 1 2 2V13" /></g></symbol>
        <symbol id="g-pick" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 14.3 9l5.7.3-4.4 3.8 1.5 5.6L12 15.8 6.9 18.7l1.5-5.6L4 9.3 9.7 9Z" stroke="var(--am-coral)" /></g></symbol>
        <symbol id="g-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6Z" fill="currentColor" /></symbol>
        <symbol id="g-acct" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.5" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></g></symbol>
        <symbol id="g-search" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></g></symbol>
        <symbol id="g-ticket" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a1.6 1.6 0 0 0 0 3v2A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-2a1.6 1.6 0 0 0 0-3Z" /><path d="M9 9.5h6M9 12.5h4" stroke="var(--am-coral)" /></g></symbol>
        {/* g-invite — referral: persona + coral "+" (Invita/Invite). */}
        <symbol id="g-invite" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.3" /><path d="M3.5 20c0-3.3 2.6-5.4 5.5-5.4s5.5 2.1 5.5 5.4" /><path d="M18.5 8.5v5M21 11h-5" stroke="var(--am-coral)" /></g></symbol>
        {/* g-plans — tier/livelli impilati, top coral (Piani/Plans). */}
        <symbol id="g-plans" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 20.5 7.4 12 11.6 3.5 7.4Z" stroke="var(--am-coral)" /><path d="M4 12l8 4 8-4M4 16.4l8 4 8-4" /></g></symbol>
      </defs>
    </svg>
  );
}
