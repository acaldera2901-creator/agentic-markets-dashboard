import { describe, it, expect } from "vitest";
import { parseWatchlist, serializeWatchlist, toggleKey, WATCHLIST_CAP } from "./watchlist";

describe("parseWatchlist", () => {
  it("legge un array di chiavi", () => {
    expect(parseWatchlist('["football:1","tennis:2"]')).toEqual(["football:1", "tennis:2"]);
  });
  it("una watchlist rotta non deve impedire di aprire la Home", () => {
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("")).toEqual([]);
    expect(parseWatchlist("{non json")).toEqual([]);
    expect(parseWatchlist('{"a":1}')).toEqual([]);
    expect(parseWatchlist("[1,null,{},\"ok\"]")).toEqual(["ok"]);
  });
  it("deduplica e taglia al tetto", () => {
    expect(parseWatchlist('["a","a","b"]')).toEqual(["a", "b"]);
    const many = JSON.stringify(Array.from({ length: WATCHLIST_CAP + 10 }, (_, i) => `k${i}`));
    expect(parseWatchlist(many)).toHaveLength(WATCHLIST_CAP);
  });
});

describe("serializeWatchlist / toggleKey", () => {
  it("il round-trip conserva le chiavi", () => {
    expect(parseWatchlist(serializeWatchlist(["football:1", "tennis:2"]))).toEqual(["football:1", "tennis:2"]);
  });
  it("toggle aggiunge e toglie senza mutare l'insieme di partenza", () => {
    const start = new Set(["a"]);
    const added = toggleKey(start, "b");
    expect([...added]).toEqual(["a", "b"]);
    expect([...start]).toEqual(["a"]);
    expect([...toggleKey(added, "a")]).toEqual(["b"]);
  });
});
