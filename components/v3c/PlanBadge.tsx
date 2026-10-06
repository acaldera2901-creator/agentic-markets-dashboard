// components/v3c/PlanBadge.tsx (#REDESIGN-V3C polish) — le targhette Free/Pro del kit
// (redesign/brand/signature/badge-*.svg) rese in HTML: il testo nel font Archivo
// vero, il taglio obliquo in clip-path; Pro = la fascia in miniatura (navy + filo lime).
export function PlanBadge({ plan, label }: { plan: "free" | "pro"; label: string }) {
  return <span className={plan === "pro" ? "v3c-plan v3c-plan-pro" : "v3c-plan"}>{label}</span>;
}
