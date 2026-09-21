import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WatchlistButton } from "./WatchlistButton";

describe("WatchlistButton", () => {
  it("espone lo stato con aria-pressed e cambia label", () => {
    const { rerender } = render(<WatchlistButton saved={false} onToggle={() => {}} />);
    const btn = screen.getByRole("button", { name: /save to watchlist/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    rerender(<WatchlistButton saved onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: /remove from watchlist/i })).toHaveAttribute("aria-pressed", "true");
  });
  it("chiama onToggle al click", () => {
    const onToggle = vi.fn();
    render(<WatchlistButton saved={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
