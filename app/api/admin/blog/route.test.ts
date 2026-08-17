import { it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const dbExecute = vi.fn();
const dbQueryStrict = vi.fn();
const isAdminAuthorized = vi.fn();
vi.mock("@/lib/db", () => ({ dbExecute, dbQueryStrict, dbQuery: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ isAdminAuthorized }));

function post(body: unknown) {
  return new Request("https://x/api/admin/blog", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  isAdminAuthorized.mockResolvedValue(true);
  // Il comportamento REALE del rail exec_sql su una scrittura: nessuna riga
  // restituita, RETURNING compreso. È la condizione che il bug non copriva.
  dbExecute.mockResolvedValue([]);
});

it("401 senza autorizzazione admin", async () => {
  isAdminAuthorized.mockResolvedValue(false);
  const { POST } = await import("./route");
  expect((await POST(post({ slug: "x", action: "publish" }))).status).toBe(401);
});

it("400 se il body non usa action publish/unpublish", async () => {
  const { POST } = await import("./route");
  // La forma sbagliata più probabile: { slug, publish: true }.
  const res = await POST(post({ slug: "x", publish: true }));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain("action");
});

it("publish riuscito risponde 200 anche se la scrittura non restituisce righe", async () => {
  dbQueryStrict.mockResolvedValue([
    { slug: "x", status: "published", published_at: "2026-08-17T00:00:00Z" },
  ]);
  const { POST } = await import("./route");
  const res = await POST(post({ slug: "x", action: "publish" }));
  expect(res.status).toBe(200);
  expect((await res.json()).post.status).toBe("published");
  expect(dbExecute).toHaveBeenCalledWith(
    expect.stringContaining("status = 'published'"),
    ["x"]
  );
});

it("404 solo quando lo slug non esiste davvero", async () => {
  dbQueryStrict.mockResolvedValue([]);
  const { POST } = await import("./route");
  const res = await POST(post({ slug: "mai-esistito", action: "publish" }));
  expect(res.status).toBe(404);
});

it("500 se lo stato non risulta applicato dopo la scrittura", async () => {
  dbQueryStrict.mockResolvedValue([{ slug: "x", status: "draft", published_at: null }]);
  const { POST } = await import("./route");
  const res = await POST(post({ slug: "x", action: "publish" }));
  expect(res.status).toBe(500);
});

it("unpublish riporta a draft e risponde 200", async () => {
  dbQueryStrict.mockResolvedValue([{ slug: "x", status: "draft", published_at: "2026-08-17T00:00:00Z" }]);
  const { POST } = await import("./route");
  const res = await POST(post({ slug: "x", action: "unpublish" }));
  expect(res.status).toBe(200);
  expect(dbExecute).toHaveBeenCalledWith(expect.stringContaining("status = 'draft'"), ["x"]);
});
