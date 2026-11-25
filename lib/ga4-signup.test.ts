import { afterEach, expect, it, vi } from "vitest";
import { sendGa4Signup } from "./ga4-signup";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("sends one signup tied to the existing GA client and session", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("GA4_MEASUREMENT_PROTOCOL_SECRET", "test-secret");
  const collect = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", collect);
  await sendGa4Signup(true, { client_id: "123.456", session_id: "1795500000" });
  expect(collect).toHaveBeenCalledTimes(1);
  const [url, request] = collect.mock.calls[0];
  expect(new URL(url).searchParams.get("measurement_id")).toBe("G-8XWQD5N6T7");
  expect(JSON.parse(request.body)).toEqual({
    client_id: "123.456",
    consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
    events: [{ name: "sign_up", params: { session_id: 1795500000, method: "email" } }],
  });
});

it("skips unconsented or invalid sessions and missing configuration", async () => {
  const collect = vi.fn();
  vi.stubGlobal("fetch", collect);
  const session = { client_id: "123.456", session_id: "1795500000" };
  vi.stubEnv("GA4_MEASUREMENT_PROTOCOL_SECRET", "");
  await sendGa4Signup(true, session);
  vi.stubEnv("GA4_MEASUREMENT_PROTOCOL_SECRET", "test-secret");
  await sendGa4Signup(false, session);
  await sendGa4Signup(true, { ...session, client_id: "name@example.test" });
  await sendGa4Signup(true, { ...session, session_id: "invalid" });
  expect(collect).not.toHaveBeenCalled();
});

it("never sends preview signup traffic to live GA4",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("GA4_MEASUREMENT_PROTOCOL_SECRET","test-secret");
 const collect=vi.fn();vi.stubGlobal("fetch",collect);
 await sendGa4Signup(true,{client_id:"123.456",session_id:"1795500000"});
 expect(collect).not.toHaveBeenCalled();
});
