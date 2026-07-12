export function parseFinalScore(notes: string | null): string | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed?.final_score === "string" ? parsed.final_score : null;
  } catch {
    return null;
  }
}
