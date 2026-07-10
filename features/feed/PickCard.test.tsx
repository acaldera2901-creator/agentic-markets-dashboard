import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickCard } from "./PickCard";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM> = {}): PickCardVM => ({
  id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-10T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55,
  confidenceScore: 78, why: "Inter in gran forma.", hasValue: true, locked: false, ...o,
});

describe("PickCard", () => {
  it("mostra la decisione e la sicurezza", () => {
    render(<PickCard pick={vm()} />);
    expect(screen.getByText("Vince l'Inter")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
  it("stato eroe espone data-hero", () => {
    const { container } = render(<PickCard pick={vm()} pickOfDay />);
    expect(container.querySelector('[data-hero="true"]')).toBeInTheDocument();
  });
  it("click su 'Perché' chiama onOpen con l'id", async () => {
    const onOpen = vi.fn();
    render(<PickCard pick={vm()} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /perché/i }));
    expect(onOpen).toHaveBeenCalledWith("1");
  });
  it("stato bloccato: mostra 'Prova Pro' e non la decisione in chiaro", () => {
    render(<PickCard pick={vm({ locked: true })} />);
    expect(screen.getByRole("button", { name: /prova pro/i })).toBeInTheDocument();
  });
});
