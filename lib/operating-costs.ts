// Operating costs for BetRedge — single source of truth for the admin dashboard.
// Fixed monthly costs in EUR. EDIT THESE with the real figures; they feed the
// "Finanze" panel (monthly burn rate + net vs revenue) in /admin.
//
// To add/remove a cost: edit the array below. No DB, no deploy gymnastics —
// just commit the new numbers.

export type OperatingCost = {
  label: string;
  category: "infra" | "ai" | "data" | "domain" | "other";
  monthly_eur: number;
};

export const OPERATING_COSTS: OperatingCost[] = [
  { label: "Claude (abbonamento)", category: "ai", monthly_eur: 22 },
  { label: "Vercel", category: "infra", monthly_eur: 0 }, // Hobby=0; Pro=~20 — aggiorna se passi a Pro
  { label: "Supabase", category: "infra", monthly_eur: 0 }, // company project — aggiorna se a carico tuo
  { label: "API-Football / RapidAPI", category: "data", monthly_eur: 0 }, // aggiorna col piano reale
  { label: "Odds API", category: "data", monthly_eur: 0 },
  { label: "Football-Data.org", category: "data", monthly_eur: 0 },
  { label: "Dominio", category: "domain", monthly_eur: 0 },
];

export function monthlyBurnEur(): number {
  return OPERATING_COSTS.reduce((sum, c) => sum + c.monthly_eur, 0);
}
