"use client";

// Toggle anno riusabile, stato locale per-scheda (default deciso dal chiamante).
export function YearToggle({
  value,
  onChange,
}: {
  value: "2026" | "2025";
  onChange: (y: "2026" | "2025") => void;
}) {
  return (
    <div className="tr-seg" role="group" aria-label="Anno">
      {(["2026", "2025"] as const).map((y) => (
        <button
          key={y}
          className={value === y ? "on" : ""}
          aria-pressed={value === y}
          onClick={() => onChange(y)}
        >
          {y}
        </button>
      ))}
    </div>
  );
}
