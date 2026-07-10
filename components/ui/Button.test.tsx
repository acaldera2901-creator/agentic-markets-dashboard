import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("rende il testo e gestisce il click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Perché</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Perché" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("espone la variante come data-attr", () => {
    render(<Button variant="primary">Vai</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "primary");
  });
  it("rispetta disabled", () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
