import { describe, it, expect } from "vitest";
import { sourceFromSearch } from "./attribution";

describe("sourceFromSearch — registrare da dove arriva chi arriva", () => {
  it("legge src e ref", () => {
    expect(sourceFromSearch("?src=tg-free&ref=TG3")).toEqual({ src: "tg-free", ref: "TG3" });
  });

  it("senza parametri non inventa niente", () => {
    expect(sourceFromSearch("")).toEqual({});
    expect(sourceFromSearch("?a=b")).toEqual({});
  });

  it("ignora gli altri parametri", () => {
    expect(sourceFromSearch("?utm_campaign=x&src=tg-seal")).toEqual({ src: "tg-seal" });
  });

  it("ripulisce: e' testo che arriva dall'URL, non entra grezzo a DB", () => {
    expect(sourceFromSearch("?src=<script>alert(1)</script>")).toEqual({ src: "scriptalert1script" });
  });

  it("taglia i valori lunghi", () => {
    expect(sourceFromSearch(`?src=${"a".repeat(200)}`).src).toHaveLength(40);
  });

  it("un valore che si svuota dopo la pulizia non si registra", () => {
    expect(sourceFromSearch("?src=%20%20")).toEqual({});
    expect(sourceFromSearch("?src=@@@")).toEqual({});
  });

  it("i marcatori veri dei canali passano interi", () => {
    for (const v of ["tg-free", "tg-seal", "tg-slate"]) {
      expect(sourceFromSearch(`?src=${v}`).src).toBe(v);
    }
  });
});
