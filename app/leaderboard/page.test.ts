import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import LeaderboardPage from "./page";

describe("retired leaderboard URLs", () => {
  it("redirects the old path permanently to predictions", () => {
    try {
      LeaderboardPage();
      throw new Error("Expected a redirect");
    } catch (error) {
      expect(error).toHaveProperty("digest", "NEXT_REDIRECT;replace;/predictions;308;");
    }
  });

  it("redirects legacy tab links while preserving unrelated query parameters", async () => {
    const response = await middleware(new NextRequest("https://betredge.com/app?tab=leaderboard&sport=tennis&ref=abc"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://betredge.com/predictions?sport=tennis&ref=abc");
  });
});
