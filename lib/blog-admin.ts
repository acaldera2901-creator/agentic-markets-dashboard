// Pure helpers for the /admin/blog page (the UI over /api/admin/blog).
// Kept out of the page file because Next.js pages may only export the page.

export type AdminBlogPost = {
  guid: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  pub_date: string | null;
  published_at: string | null;
  created_at: string;
};

export type BlogAction = "publish" | "unpublish";

// Anything not 'published' is treated as a draft: the endpoint only ever
// writes 'draft' | 'published', and an unknown status must stay reviewable
// (and publishable) rather than silently disappear from the page.
export function splitPosts(posts: AdminBlogPost[]): {
  drafts: AdminBlogPost[];
  published: AdminBlogPost[];
} {
  const byDateDesc = (key: (p: AdminBlogPost) => string | null) =>
    (a: AdminBlogPost, b: AdminBlogPost) =>
      (Date.parse(key(b) ?? "") || 0) - (Date.parse(key(a) ?? "") || 0);
  return {
    drafts: posts
      .filter((p) => p.status !== "published")
      .sort(byDateDesc((p) => p.pub_date ?? p.created_at)),
    published: posts
      .filter((p) => p.status === "published")
      .sort(byDateDesc((p) => p.published_at ?? p.pub_date ?? p.created_at)),
  };
}

export function actionFor(post: AdminBlogPost): BlogAction {
  return post.status === "published" ? "unpublish" : "publish";
}
