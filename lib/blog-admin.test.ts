import { describe, it, expect } from "vitest";
import { splitPosts, actionFor, type AdminBlogPost } from "./blog-admin";

const post = (over: Partial<AdminBlogPost>): AdminBlogPost => ({
  guid: over.slug ?? "g",
  slug: "s",
  title: "t",
  description: null,
  status: "draft",
  pub_date: null,
  published_at: null,
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

describe("splitPosts", () => {
  it("separates drafts from published, newest first", () => {
    const { drafts, published } = splitPosts([
      post({ slug: "d-old", pub_date: "2026-08-18T00:00:00Z" }),
      post({ slug: "p-old", status: "published", published_at: "2026-08-13T00:00:00Z" }),
      post({ slug: "d-new", pub_date: "2026-09-27T00:00:00Z" }),
      post({ slug: "p-new", status: "published", published_at: "2026-08-17T00:00:00Z" }),
    ]);
    expect(drafts.map((p) => p.slug)).toEqual(["d-new", "d-old"]);
    expect(published.map((p) => p.slug)).toEqual(["p-new", "p-old"]);
  });

  it("keeps an unknown status reviewable as a draft", () => {
    const { drafts, published } = splitPosts([post({ slug: "x", status: "weird" })]);
    expect(drafts.map((p) => p.slug)).toEqual(["x"]);
    expect(published).toEqual([]);
  });

  it("falls back to created_at when pub_date is missing", () => {
    const { drafts } = splitPosts([
      post({ slug: "a", created_at: "2026-08-01T00:00:00Z" }),
      post({ slug: "b", created_at: "2026-09-01T00:00:00Z" }),
    ]);
    expect(drafts.map((p) => p.slug)).toEqual(["b", "a"]);
  });
});

describe("actionFor", () => {
  it("maps draft to publish and published to unpublish", () => {
    expect(actionFor(post({ status: "draft" }))).toBe("publish");
    expect(actionFor(post({ status: "published" }))).toBe("unpublish");
  });
});
