"use client";
// components/tools/ToolCalculator.tsx (#TOOLS-HUB-0805)
// Unico punto d'ingresso dei calcolatori: le pagine passano lo slug e il testo,
// e non sanno quale componente giri sotto.

import type { ToolSlug } from "@/lib/tools/registry";
import type { ToolCopy } from "@/lib/tools/copy";
import { OddsConverter } from "./OddsConverter";
import { MarginCalculator } from "./MarginCalculator";
import { EvCalculator } from "./EvCalculator";
import { KellyCalculator } from "./KellyCalculator";
import { ProbabilityCalculator } from "./ProbabilityCalculator";
import { ArbitrageCalculator } from "./ArbitrageCalculator";
import { ParlayCalculator } from "./ParlayCalculator";
import { RoiCalculator } from "./RoiCalculator";
import { YieldCalculator } from "./YieldCalculator";
import { StakeCalculator } from "./StakeCalculator";
import { BankrollCalculator } from "./BankrollCalculator";

export function ToolCalculator({
  slug,
  copy,
  dash,
}: {
  slug: ToolSlug;
  copy: ToolCopy;
  dash: string;
}) {
  switch (slug) {
    case "odds-converter":
      return <OddsConverter copy={copy} dash={dash} />;
    case "margin-calculator":
      return <MarginCalculator copy={copy} dash={dash} />;
    case "ev-calculator":
      return <EvCalculator copy={copy} dash={dash} />;
    case "kelly-criterion":
      return <KellyCalculator copy={copy} dash={dash} />;
    case "probability-calculator":
      return <ProbabilityCalculator copy={copy} dash={dash} />;
    case "arbitrage-calculator":
      return <ArbitrageCalculator copy={copy} dash={dash} />;
    case "parlay-calculator":
      return <ParlayCalculator copy={copy} dash={dash} />;
    case "roi-calculator":
      return <RoiCalculator copy={copy} dash={dash} />;
    case "yield-calculator":
      return <YieldCalculator copy={copy} dash={dash} />;
    case "stake-calculator":
      return <StakeCalculator copy={copy} dash={dash} />;
    case "bankroll-calculator":
      return <BankrollCalculator copy={copy} dash={dash} />;
  }
}
