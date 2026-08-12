"use client";
// #SORO-BETREDGE-0812: Soro blog widget. Soro's official snippet is a bare
// <div id="soro-blog"> plus a `defer` external <script> that finds the div on
// DOMContentLoaded and renders the SEO blog into it. Next 16's next/script is
// still the idiomatic loader (afterInteractive is the default and mounts the
// script client-side after hydration, which is fine: the mount point below is
// in the same client tree). The external origin must be allowlisted in the
// enforcing CSP (see next.config.ts #SORO-BETREDGE-0812) or the widget is
// dead-on-arrival.
import Script from "next/script";

const SORO_PROJECT_ID = "31b9cca8-1e93-4d13-b13d-bb67a0eba643";

export function SoroEmbed() {
  return (
    <>
      <div id="soro-blog" />
      <Script
        src={`https://app.trysoro.com/api/embed/${SORO_PROJECT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
