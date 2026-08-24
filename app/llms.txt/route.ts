// app/llms.txt/route.ts — #SEO-AEO-0825
// Sommario del sito in text/plain per i crawler dei modelli, nel formato di
// llmstxt.org: un H1, un blockquote di sintesi, sezioni di link.
// Le rotte NON sono riscritte a mano: vengono dallo stesso registro dei tool e
// dallo stesso DB del blog che alimentano app/sitemap.ts. Una lista parallela
// scritta a mano sarebbe la prima cosa a divergere.
import { TOOL_SLUGS, SITE_ORIGIN, hubPath, toolPath } from "@/lib/tools/registry";
import { getToolsCopy } from "@/lib/tools/copy";
import { listPublishedPosts } from "@/lib/blog";

// Stessa cadenza della sitemap: i post si pubblicano dal pannello admin, senza
// deploy, e un file congelato al build non li vedrebbe mai.
export const revalidate = 3600;

const abs = (path: string) => `${SITE_ORIGIN}${path}`;
const link = (label: string, path: string, note: string) => `- [${label}](${abs(path)}): ${note}`;

export async function GET(): Promise<Response> {
  const en = getToolsCopy("en");

  const lines: string[] = [
    "# BetRedge",
    "",
    "> Football and tennis predictions from a probability model. BetRedge publishes a calibrated",
    "> probability and the reasoning behind it for every match it covers, plus free calculators for",
    "> odds, expected value, staking and bankroll. It is an analytics product, not a bookmaker.",
    "",
    "BetRedge states probabilities, never a guaranteed outcome. Predictions are graded after the",
    "match and archived, so every published call stays checkable.",
    "",
    "## Predictions",
    "",
    link("Predictions", "/predictions", "the current board of football and tennis picks, with model probability and confidence"),
    link("Track record", "/history", "every settled prediction, graded and archived"),
    link("Weekly Pick", "/weekly-pick", "one accumulator a week, built from the model's highest-probability picks"),
    link("AI football predictions", "/ai-football-predictions", "how the football model works and what it covers"),
    link("AI tennis predictions", "/ai-tennis-predictions", "how the tennis model works and what it covers"),
    "",
    "## Free tools",
    "",
    link("Tools hub", "/tools", en.hub.lede),
    ...TOOL_SLUGS.map((slug) => link(en.tools[slug].h1, toolPath(slug, "en"), en.tools[slug].lede)),
    "",
    "## About",
    "",
    link("Plans and pricing", "/plans", "what each plan includes"),
    link("Community picks", "/community", "accumulators built by community creators with the Match Builder"),
    link("Partners", "/partners", "the platforms BetRedge works with; the list itself is geo-restricted"),
    link("Terms of Service", "/terms", "terms, and the legal entity behind the site"),
    link("Privacy Policy", "/privacy", "what data the site collects and why"),
    "",
    "## Other languages",
    "",
    "The free tools are published in 11 languages. English lives at the unprefixed path and is the",
    "canonical version; the others sit under a language prefix, and every page declares the full",
    "reciprocal set with hreflang.",
    "",
    link("Strumenti gratuiti (Italiano)", hubPath("it"), "gli stessi calcolatori in italiano"),
    link("Herramientas gratuitas (Español)", hubPath("es"), "las mismas calculadoras en español"),
    link("Outils gratuits (Français)", hubPath("fr"), "les mêmes calculateurs en français"),
  ];

  // Fail-soft come la sitemap: se il DB non risponde il file esce comunque con
  // tutto il resto, non un 500. Un llms.txt rotto vale meno di uno parziale.
  try {
    const posts = await listPublishedPosts(50);
    if (posts.length > 0) {
      lines.push("", "## Guides", "");
      for (const p of posts) {
        lines.push(link(p.title, `/blog/${p.slug}`, p.description ?? "guide"));
      }
    }
  } catch {
    /* nessuna sezione Guides */
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
