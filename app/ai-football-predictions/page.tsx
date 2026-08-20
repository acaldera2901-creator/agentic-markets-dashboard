// #SEO-PACK-0810 (brief 06, build 3): pillar UK "ai football predictions".
// Sibling di /it/pronostici-calcio-intelligenza-artificiale (arriverà col
// locale routing): stessa struttura, scritto indipendente, hreflang reciproco
// quando il file 01 atterra. Stesse regole dure del pillar tennis: answer-first,
// zero link bookmaker, zero numeri di performance, niente em-dash.
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "AI Football Predictions: How the Model Reaches a Number | BetRedge",
  description: "Inside a multi-agent AI football model: the factors it weighs, how they combine into one probability, and what it gets wrong.",
  alternates: { canonical: "/ai-football-predictions" },
};

const FAQ: Array<[string, string]> = [
  [
    "How does an AI football prediction model work?",
    "Several specialist models each assess a fixture independently, covering recent form, expected goals, squad availability, and market movement. Their outputs are combined into one calibrated probability per outcome, and the page shows which factors moved the number.",
  ],
  [
    "Are AI football predictions accurate?",
    "They are calibrated rather than certain: a 60 percent probability should win about six times in ten over a large sample, and lose the other four. No model makes a single match predictable, and anyone claiming guaranteed wins is not describing a model.",
  ],
  [
    "What is the hardest outcome to predict in football?",
    "The draw. It is structurally the least likely of the three outcomes in most matches, its causes are diffuse, and it is where models and bookmakers disagree with reality most often. A model that is honest about the draw is honest about its limits.",
  ],
  [
    "Where can I see today's football predictions?",
    "The live board lists every covered fixture with the model's current probabilities, updated as new data arrives through the day.",
  ],
];

export default function AiFootballPredictionsPage() {
  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      <JsonLd data={breadcrumbJsonLd([["AI Football Predictions", "/ai-football-predictions"]])} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <main className="mx-auto max-w-3xl px-6 py-12" style={{ lineHeight: 1.7 }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--am-coral, #f97316)" }}>Football</p>
        <h1 className="text-3xl font-bold mt-2 mb-6" style={{ color: "var(--am-text)" }}>
          AI football predictions: how a model actually reaches a number
        </h1>

        <p className="mb-4">
          An AI football prediction, done properly, is one number per outcome: the probability of
          the home win, the draw, and the away win, adding up to 100 percent. BetRedge produces
          that number with a set of specialist models that each look at a fixture from a
          different angle, then combine into a single calibrated estimate. The board shows the
          number, a confidence score, and the reasoning in plain language.
        </p>
        <p className="mb-4">
          The current fixtures are on the{" "}
          <Link href="/predictions?sport=football" style={{ color: "var(--am-text)", textDecoration: "underline" }}>
            live football predictions board
          </Link>
          . This page explains what happens before a number appears there, in enough detail that
          you can judge the method instead of taking our word for it.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          The factors, in the order they matter
        </h2>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Team strength, estimated from goals.</strong>{" "}
          The backbone is a goals-based model: how many goals a team scores and concedes against
          opposition of known strength, updated match by match. Attack and defence are estimated
          separately, because a leaky defence and a blunt attack fail in different ways.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Expected goals, not just results.</strong>{" "}
          Results are noisy: a team can win while creating almost nothing. Expected goals (xG)
          measures the quality of chances created and conceded, which stabilises the strength
          estimate and catches teams whose results are about to catch up with their performances,
          in either direction.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Availability and context.</strong> Squad
          absences, congestion, and competition context move the number. A cup tie between sides
          from different divisions behaves differently from a league match, and friendlies are
          treated with extra caution because teams rotate and experiment in them.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>The market itself.</strong> Bookmaker odds
          embed information the raw data cannot see: late team news, money from informed bettors,
          weather. The model reads the market as one input among several. When our number and the
          market disagree sharply, that disagreement is flagged rather than hidden, because one
          of the two is wrong and it is not always the market.
        </p>
        <p className="mb-4">
          Each fixture&apos;s explanation names the factors that actually moved that match&apos;s
          number, so you never have to guess which of the above did the work.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          Why the model refuses to pick some matches
        </h2>
        <p className="mb-4">
          Not every fixture has a clear favourite, and a model that always produces a pick is
          overfitting to your desire for one. When the probabilities come out flat, the BetRedge
          board says there is no clear favourite and shows the probabilities anyway. A flat
          distribution is information: it tells you the match is genuinely open, which is exactly
          when short odds on either side are poor value.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          What the model gets wrong
        </h2>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>The draw.</strong> It is the hardest of the
          three outcomes for any model, ours included. Draws happen for diffuse reasons that
          resist measurement, and some leagues produce structurally more of them than others.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Rotation we cannot see coming.</strong>{" "}
          Lineups publish an hour before kickoff; the model prices earlier than that. A heavily
          rotated side invalidates part of the estimate, which is one reason cup competitions and
          friendlies carry wider confidence bands.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Newly promoted and rebuilt squads.</strong>{" "}
          A team with little recent top-flight data, or one that replaced half its squad in a
          transfer window, starts the season with stale inputs. Early-season numbers are wider
          and the explanations say so.
        </p>
        <p className="mb-4">
          <strong style={{ color: "var(--am-text)" }}>Derbies and high-variance fixtures.</strong>{" "}
          Some matches have historically resisted form-based prediction. The model knows which
          segments those are and widens its uncertainty there instead of pretending.
        </p>

        <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: "var(--am-text)" }}>
          Reading the number like an adult
        </h2>
        <p className="mb-4">
          Divide 1 by the decimal odds and you get the bookmaker&apos;s implied probability,
          margin included. Compare it with the model&apos;s number. The gap, not the pick, is the
          product: a 55 percent model probability against a price implying 45 percent is a
          different proposition from the same pick priced at 60. Over a long sample that
          discipline is what separates using probabilities from collecting tips.
        </p>
        <p className="mb-4">
          And keep the base fact in view: a 60 percent favourite loses four times in ten. That is
          not the model failing. That is what 60 percent means.
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
          <Link href="/predictions?sport=football" className="underline" style={{ color: "var(--am-text)" }}>
            See today&apos;s football board
          </Link>
        </p>
      </main>
    </div>
  );
}
