# Restore the missing approved news preview

Source of truth: ufficio-maven/drafts/tommy/news-feed/index.html and 2026-11-05-v3-profilo-compilato.png. User explicitly requests missing avatar/profile dashboard and the rest of this existing preview. Preserve no Share and no inline Photo credits.

Scope: profile entry/avatar in news header; production profile screen using actual signed account, email, join date, plan and plan-expiry; editable display name, unique case-insensitive username, 160-char bio; upload/remove real avatar; own comments and likes with links; avatar/name on comment authors; existing preview login banner. No demo Free/Pro/login toggles or fabricated account/pricing. Upgrade links existing /plans with no copied stale price. No new auth system or paid service.

Implementation contract:
- GET /api/news/profile => {profile:{displayName,username,bio,avatarUrl},account:{identifier,plan,createdAt,planExpiresAt},activity:{comments:[{id,body,newsGuid,title,createdAt}],likes:[{newsGuid,title,createdAt}],commentCount,likeCount}}. Null avatarUrl, empty username/bio allowed. Actual created date from profiles. Max100 activity items with true counts.
- PUT same endpoint JSON {displayName,username,bio}; authenticated same-origin; server validation length40/username3–20 ASCII word and unique lower, bio160; username blank allowed. No edits to auth name/password/plan. Return {ok:true}.
- POST /api/news/profile/avatar multipart field avatar; DELETE removes avatar. Signed existing session and same-origin. PNG/JPEG/WebP <=2MB, inspect actual bytes, reject SVG/animation/huge raster; sharp rotate and reencode256x256 WebP stripping metadata; store small dataURL in private community profile row, public only as avatar author. No external storage service. Return {avatarUrl}.
- community GET comment items add avatarUrl and username, current display_name joined, fallback old display_name. No identifiers exposed.
- public comment data remains plain text. Existing likes/comments persistence intact.

Ownership: backend worker app/api/news/profile/**, lib/news/profile* helpers/tests, community route and migration only. Frontend worker new components/news/NewsProfile.tsx, news-profile.css, profile UI tests, app/blog/profile/page.tsx only. Root integration NewsList/NewsActions/HomeAuthModal and dependencies/assets, migration/apply/release.

Plan: backend with schema+validation/security tests; preview-faithful UI; integrate entry/auth banner/comment avatars; profile persistence/avatar byte tests+browser mobile/desktop; review; additive DB migration; deploy; public verification. No production test comments or user profile edits without restoring prior state. Dedicated test account only for mutations, never fabricate engagement.
