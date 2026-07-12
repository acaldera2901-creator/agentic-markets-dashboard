// Server-side +18/ToS consent gate for register. The client already blocks
// submission without both checkboxes, but that's advisory only — a direct
// API call could skip it. This makes the gate authoritative.
export class ConsentError extends Error {
  constructor() {
    super("consent_required");
    this.name = "ConsentError";
  }
}

export function assertConsent(body: { age_confirmed?: unknown; tos_accepted?: unknown }): void {
  if (body.age_confirmed !== true || body.tos_accepted !== true) {
    throw new ConsentError();
  }
}
