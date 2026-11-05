import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewsProfile } from "./NewsProfile";
vi.mock("./use-news", () => ({ useSiteLang: () => "en" }));
vi.mock("@/components/auth/HomeAuthModal", () => ({ HomeAuthModal: ({ onAuthenticated }: { onAuthenticated: () => void }) => <button onClick={onAuthenticated}>Complete login</button> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const data = { profile: { displayName: "Marco", username: "marco", bio: "Football", avatarUrl: null }, account: { identifier: "real@example.com", plan: "free", createdAt: "2026-10-12T00:00:00Z", planExpiresAt: null }, activity: { comments: [{ id: 1, body: "My opinion", newsGuid: "abc", title: "Match news", createdAt: "2026-11-01T00:00:00Z" }], likes: [], commentCount: 121, likeCount: 0 } };
const ok = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
it("shows real account, total activity and news links without demo pricing", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(data))); render(<NewsProfile />);
 expect(await screen.findByText("real@example.com")).toBeTruthy();
 expect(screen.getByText("Your comments (121)")).toBeTruthy();
 expect(screen.getByText("Latest 100")).toBeTruthy();
 expect(screen.getByRole("link", { name: /Match news/ }).getAttribute("href")).toBe("/blog#post-abc");
 expect(screen.getByRole("link", { name: "Explore plans" }).getAttribute("href")).toBe("/plans");
 expect(screen.queryByText(/29.99/)).toBeNull();
});
it("preserves entered profile on failed save and submits only editable fields", async () => {
 const f = vi.fn().mockResolvedValueOnce(ok(data)).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "username_taken" }) }); vi.stubGlobal("fetch", f); render(<NewsProfile />);
 fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "New name" } });
 fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
 expect(await screen.findByRole("alert")).toHaveTextContent("username");
 expect(screen.getByLabelText("Name")).toHaveValue("New name");
 expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ displayName: "New name", username: "marco", bio: "Football" });
});
it("opens existing authentication after a server 401 and reloads after login", async () => {
 const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce(ok(data)); vi.stubGlobal("fetch", f); render(<NewsProfile />);
 fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
 fireEvent.click(screen.getByRole("button", { name: "Complete login" }));
 expect(await screen.findByText("real@example.com")).toBeTruthy();
});
it("uploads a multipart avatar and removes the persisted image", async () => {
 const f = vi.fn().mockResolvedValueOnce(ok(data)).mockResolvedValueOnce(ok({ avatarUrl: "data:image/webp;base64,YQ==" })).mockResolvedValueOnce(ok({ avatarUrl: null })); vi.stubGlobal("fetch", f); render(<NewsProfile />);
 const input = await screen.findByLabelText("Upload image");
 fireEvent.change(input, { target: { files: [new File(["bytes"], "avatar.png", { type: "image/png" })] } });
 await screen.findByAltText("Your avatar");
 expect(f.mock.calls[1][1].body.get("avatar").name).toBe("avatar.png");
 fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
 await waitFor(() => expect(screen.queryByAltText("Your avatar")).toBeNull());
 expect(f.mock.calls[2][1].method).toBe("DELETE");
});
