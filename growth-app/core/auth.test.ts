import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "./auth";

const basic = (user: string, pass: string) => "Basic " + btoa(`${user}:${pass}`);
const PW = "correct-horse-battery";

describe("shared-password gate", () => {
  it("is locked when no password (or a short one) is configured", async () => {
    expect(await checkBasicAuth(basic("steve", "x"), undefined)).toBe("missing-config");
    expect(await checkBasicAuth(basic("steve", "short"), "short")).toBe("missing-config");
  });

  it("accepts the right password with any username", async () => {
    expect(await checkBasicAuth(basic("steve", PW), PW)).toBe("ok");
    expect(await checkBasicAuth(basic("", PW), PW)).toBe("ok");
  });

  it("denies wrong, missing or malformed credentials", async () => {
    expect(await checkBasicAuth(basic("steve", PW + "x"), PW)).toBe("denied");
    expect(await checkBasicAuth(null, PW)).toBe("denied");
    expect(await checkBasicAuth("Bearer abc", PW)).toBe("denied");
    expect(await checkBasicAuth("Basic !!!notbase64", PW)).toBe("denied");
    expect(await checkBasicAuth("Basic " + btoa("nocolon"), PW)).toBe("denied");
  });
});
