#!/bin/zsh
# Round 15 (2026-09-24) — icone NAV (top + bottom bar mobile) nello stesso linguaggio elettrico del round 14 (tool-*).
# Motivo: Andrea su mobile — "vedo icone stilizzate non nel nostro stile" (bottom bar = SVG flat round 3; nav top = argilla round 5/6).
# Regole gptimg (lezioni round 4/14): SEMPRE -r, una alla volta (mai in parallelo), </dev/null quando non c'è TTY.
# STYLE2 = identico a am-restyling-0921/docs/reference/round14/prompts-round14.sh — NON si reinventa.
STYLE2="PNG with fully transparent background (alpha channel), 1:1 square. A single 3D icon in a strict house style, matching a set of energetic sports-tech banners: a bold sculptural object made of glossy royal-blue (#2A5BFF) material with deep-navy (#0C1741) shadow faces and crisp electric light-blue (#7FC4FF) light running along its edges, wrapped by a few THIN crackling electric-blue energy arcs and a tight burst of fine glowing particles, plus exactly ONE SMALL accent detail in vivid lime (#C8FF3D) that glows softly (the lime must cover less than 15 percent of the object). Dramatic stadium-broadcast lighting, cinematic rim light, high contrast, clean and sharp render. Camera: consistent three-quarter view from front-top-left. Simple bold silhouette readable at 32px; the object fills about 70% of the frame and the energy effects stay tight around it (no wide haze, no smoke). Transparent background: no backdrop, no ground plane, no shadow plane, no text, no letters, no numbers, no logos, no brand marks."

# 7 soggetti distinti. Home/Live/Tools sono UNO per tutto il sito: lo stesso master alimenta nav-* (top) e bottomnav-* (bottom bar),
# così la stessa voce ha la stessa icona ovunque (derive-nav-icons.py fa la copia).
cd "$(dirname "$0")/src-icons" || exit 1
gen() { [ -s "$2" ] && { echo "skip $2"; return; }; gptimg -r "$STYLE2 Subject: $1" "$2" </dev/null; }

gen "a chunky house with a steep pitched roof, thick walls and one plain rounded door on the front face; only the small door is the lime accent; electric arcs trace the roof ridge." home.png
gen "a chunky broadcast/live signal: one small solid sphere at the bottom-left with two thick concentric quarter-ring arcs radiating up-right from it, like a bold wifi/radio symbol; only the small sphere is the lime accent; electric arcs run along the rings." live.png
gen "a chunky classic soccer ball with raised pentagon and hexagon panels in royal-blue and deep-navy; only ONE single pentagon panel near the top is the lime accent, every other panel stays blue or navy; electric arcs orbit the ball." football.png
gen "a chunky tennis racket seen at three-quarter view, thick oval head with a simple string grid and a short thick handle, with one small tennis ball floating just beside the head; only the small ball is the lime accent; electric arcs run around the racket head." tennis.png
gen "a chunky adjustable wrench (spanner) lying diagonally with a wide open jaw at the top and a thick handle; only the small round adjustment screw at the jaw is the lime accent; electric arcs run along the handle." tools.png
gen "a chunky bookmark ribbon tag standing upright, a thick vertical rectangle with a V-notch cut into its bottom edge; only one small round dot near its top is the lime accent; electric arcs trace its outline." watchlist.png
gen "a chunky user profile bust: a smooth round head floating above wide rounded shoulders, no facial features; only the thin collar line at the neck is the lime accent; electric arcs run around the shoulders." profile.png
