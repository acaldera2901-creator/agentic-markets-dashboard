// #HYDRATION-418-1014 — il fuso iniziale è fisso (uguale fra server e
// idratazione), quello del browser arriva solo dopo: niente React #418.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { useBrowserTimeZone, SSR_TZ } from "./use-browser-tz";

function Probe() {
  return <span data-testid="tz">{useBrowserTimeZone()}</span>;
}

const fakeBrowserTz = (timeZone: string) => {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...real.call(this), timeZone };
  });
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

describe("useBrowserTimeZone", () => {
  it("in SSR rende sempre il fuso fisso, qualunque sia quello del processo", () => {
    fakeBrowserTz("UTC"); // Vercel
    expect(renderToString(<Probe />)).toContain(SSR_TZ);
    expect(SSR_TZ).toBe("Europe/Rome");
  });

  it("idrata senza mismatch con un browser in un altro fuso, poi passa al fuso vero", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    fakeBrowserTz("America/New_York");
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("America/New_York");
    container.remove();
  });
});
