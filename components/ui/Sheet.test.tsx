import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("non rende nulla se chiuso", () => {
    const { container } = render(<Sheet open={false} onClose={() => {}}>x</Sheet>);
    expect(container).toBeEmptyDOMElement();
  });
  it("rende i children e ruolo dialog se aperto", () => {
    render(<Sheet open onClose={() => {}} title="Dettaglio">contenuto</Sheet>);
    expect(screen.getByRole("dialog", { name: "Dettaglio" })).toBeInTheDocument();
    expect(screen.getByText("contenuto")).toBeInTheDocument();
  });
  it("chiude su Escape", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}>x</Sheet>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("chiude su click backdrop ma non su click interno", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}><button>dentro</button></Sheet>);
    await userEvent.click(screen.getByText("dentro"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
