import { SportIcon } from "@/components/ui";

export type Destination = "oggi" | "risultati" | "profilo";

const ITEMS: { key: Destination; label: string; href: string }[] = [
  { key: "oggi", label: "Oggi", href: "/oggi" },
  { key: "risultati", label: "Risultati", href: "/risultati" },
  { key: "profilo", label: "Profilo", href: "/profilo" },
];

export function BottomNav({ active }: { active: Destination }) {
  return (
    <nav style={{
      position: "sticky", bottom: 0, display: "flex", gap: 4,
      background: "var(--am-bar)", borderTop: "1px solid var(--am-line)", padding: "8px 8px",
    }}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <a key={it.key} href={it.href} aria-current={on ? "page" : undefined}
            style={{
              flex: 1, textAlign: "center", textDecoration: "none",
              fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600,
              color: on ? "var(--am-coral)" : "var(--am-muted)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0",
            }}>
            <SportIcon sport={it.key === "oggi" ? "football" : "generic"} size={18} />
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}
