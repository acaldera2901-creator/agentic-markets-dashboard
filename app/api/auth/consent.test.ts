import { describe, it, expect } from "vitest";
import { assertConsent, ConsentError } from "./consent";

describe("assertConsent", () => {
  it("passa se age+tos true", () => {
    expect(() => assertConsent({ age_confirmed: true, tos_accepted: true })).not.toThrow();
  });
  it("throw se manca age", () => {
    expect(() => assertConsent({ tos_accepted: true })).toThrow(ConsentError);
  });
  it("throw se manca tos", () => {
    expect(() => assertConsent({ age_confirmed: true })).toThrow(ConsentError);
  });
  it("throw se non booleani true", () => {
    expect(() => assertConsent({ age_confirmed: "1", tos_accepted: 1 } as never)).toThrow(ConsentError);
  });
});
