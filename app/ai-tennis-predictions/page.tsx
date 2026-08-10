// #SEO-PACK-0810 (brief 06, build 2): pillar UK "ai tennis predictions".
// Regole dure dal pack: answer-first, zero link bookmaker, zero numeri di
// performance (regime ASA tipster: nessun hit rate/ROI finché non c'è firma
// legale), niente em-dash, ogni claim scopato alla sua evidenza, sezione
// "cosa sbaglia il modello" obbligatoria. Monetizzazione = solo prodotto.
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "AI Tennis Predictions: Probabilities, Not Tips | BetRedge",
  description: "How a multi-agent AI model turns tennis matches into calibrated probabilities: surfaces, serve data, and what the model gets wrong.",
  alternates: { canonical: "/ai-tennis-predictions" },
};

const FAQ: Array<[string, string]> = [
  [
    "What does an AI tennis prediction actually give you?",
    "A probability for each player winning the match, a confidence band around that number, and the factors that moved it: recent form, surface record, serve and return data, and market movement. It is a calibrated estimate, not a tip.",
  ],
  [
    "Are AI tennis predictions guaranteed to win?",
    "No. BetRedge publishes probabilities, not guarantees. A 70 percent probability is expected to lose roughly three times in ten. The value is in knowing whether a price is fair, not in a promised outcome.",
  ],
  [
    "Why is tennis easier to model than football?",
    "Tennis has no draws, no team-selection noise, and long individual histories. Two players, one winner, and rich point-by-point data make the probability estimate cleaner than in an eleven-a-side sport.",
  ],
  [
    "Where can I see today's tennis predictions?",
    "The live board shows every covered match with the model's current probabilities. New predictions are produced as tournaments progress through the week.",
  ],
];

export default function AiTennisPredictionsPage() {
  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      <JsonLd data={breadcrumbJsonLd([["AI Tennis Predictions", "/ai-tennis-predictions"]])} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <main className="mx-auto max-w-3xl px-6 py-12" style={{ lineHeight: 1.7 }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--am-coral, #f97316)" }}>Tennis</p>
        <h1 className="text-3xl font-bold mt-2 mb-6" style={{ color: "var(--am-text)" }}>
          AI tennis predictions: what the model outputs, and how to read it
        </h1>

        <p className="mb-4">
          For every covered tennis match, the BetRedge model outputs a probability for each player
          winning, a confidence band around that number, and the specific factors that moved it.
          That is the whole product: a calibrated number you can compare against a bookmaker&apos;s
          implied price to judge whether the odds are fair. It is not a tip, and it is not a
          guarantee.
        </p>
        <p className="mb-4">
          You can see the current board on the{" "}
          <Link href="/predictions?sport=tennis" style={{ color: "var(--am-text)", textDecoration: "underline" }}>
            live tennis predictions page
          </Link>
          . The rest of this page explains how those numbers are produced, why tennis suits this
          kind of modelling unusually well, and where the model struggles. We think you should
          read the failure modes before you read anything else.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          Why tennis is more modellable than football
        </h2>
        <p className="mb-4">
          Tennis gives a statistical model four structural advantages that football does not.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>No draws.</strong> Every match has exactly
          two outcomes. A football model spreads its probability across three results, and the
          draw is notoriously the hardest of the three to price. In tennis the question is
          binary, which makes both the estimate and its calibration cleaner.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>No team-selection noise.</strong> A football
          prediction can be invalidated an hour before kickoff by a rotated squad. In tennis the
          player who is ranked is the player who walks on court. Injuries and withdrawals exist,
          but there is no manager deciding to rest half the lineup.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Long individual histories.</strong> A tour
          professional plays dozens of matches a year, every one of them recorded point by point.
          Head-to-head records, serve percentages, return games won, tiebreak records: the input
          data is deep, individual, and directly attributable to the person playing, not to a
          squad that changes every season.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Serve and return splits.</strong> Tennis
          scoring is built from service games, so a model can estimate hold and break
          probabilities separately and compose them into set and match probabilities. That
          bottom-up structure is checkable at every level, which is not true of a football
          scoreline.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          Surfaces change the answer
        </h2>
        <p className="mb-4">
          The same two players can be meaningfully different propositions on clay, grass, and hard
          court. Clay lengthens rallies and rewards defensive movement, grass shortens points and
          amplifies big serving, and hard courts sit in between. The model keeps surface-specific
          form and career records as separate inputs rather than blending everything into one
          rating, because a player&apos;s clay results say little about a grass match in June.
        </p>
        <p className="mb-4">
          This is also where naive models go wrong most often: a headline ranking is a
          surface-blended average. When the model&apos;s number disagrees sharply with what the
          rankings suggest, the surface split is the most common reason, and the explanation
          shown with each prediction will say so.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          What the model gets wrong
        </h2>
        <p className="mb-4">
          We publish this section on purpose. A probability product that cannot name its own
          failure modes is asking you to trust it blindly, and blind trust is the opposite of
          what a calibrated number is for.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Retirements and mid-match injuries.</strong>{" "}
          The model prices the match as played to completion. A retirement resolves it in a way
          no pre-match probability can anticipate.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Undisclosed fitness.</strong> A player
          carrying a problem into the match looks, in the data, exactly like a healthy player
          until the points start. Late market moves sometimes know more than the model does, and
          the model watches the market partly for that reason.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>First-round upsets and returning players.</strong>{" "}
          A player coming back from a long absence has stale data. Early tournament rounds and
          post-injury comebacks are where the confidence band is widest, and the honest answer in
          some of those matches is that there is no clear favourite. When that happens the board
          says so instead of manufacturing a pick.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          How to use a probability without fooling yourself
        </h2>
        <p className="mb-4">
          Convert the odds you are looking at into an implied probability (divide 1 by the
          decimal odds), then compare it with the model&apos;s number. If a bookmaker&apos;s price
          implies 55 percent and the model says 62 percent, the model believes the price is
          generous. If the model says 48 percent, the price is short. That comparison, repeated
          with discipline, is the entire rational use of this product.
        </p>
        <p className="mb-4">
          Remember what a probability means in practice: a 70 percent favourite is expected to
          lose about three times in ten. A short losing run proves nothing about the model, and a
          short winning run proves nothing either. Judge it over a sample, not over a weekend.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          Frequently asked questions
        </h2>
        {FAQ.map(([q, a]) => (
          <div key={q} className="mb-5">
            <h3 className="font-bold mb-1" style={{ color: "var(--am-text)" }}>{q}</h3>
            <p>{a}</p>
          </div>
        ))}

        <p className="mt-10 mb-2 text-sm">
          18+. Gamble responsibly. Probabilities are estimates, not guarantees, and no outcome is
          ever certain. If gambling stops being fun, help is available at{" "}
          <a href="https://www.begambleaware.org" rel="nofollow noopener" style={{ textDecoration: "underline" }}>BeGambleAware</a>.
        </p>
        <p className="mt-6">
          <Link href="/predictions?sport=tennis" className="underline" style={{ color: "var(--am-text)" }}>
            See today&apos;s tennis board
          </Link>
        </p>
      </main>
    </div>
  );
}
