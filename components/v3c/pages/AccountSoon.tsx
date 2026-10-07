"use client";
// components/v3c/pages/AccountSoon.tsx (#REDESIGN-V3C fixui3 L1) — /profilo in Fase 0, a flag acceso e senza
// NEXT_PUBLIC_UX_NEW: prima era un 404. Una pagina neutra che dice cosa c'è (niente account da aprire oggi)
// e un solo link secondario all'anteprima Pro, che non vende nulla. Nessun accesso, nessun form: il login
// di oggi resta dov'è e non viene toccato (docs/redesign/fixui3-existing-members.md).
import Link from "next/link";
import { bannerCopyFor } from "@/lib/v3c/banner-copy";
import { fixui3CopyFor } from "@/lib/v3c/fixui3-copy";
import { useV3cLang } from "@/lib/v3c/lang.client";

export function AccountSoon() {
  const lang = useV3cLang();
  const c = fixui3CopyFor(lang);
  return (
    <section className="v3c-cm-box" data-v3c="account-soon">
      <h2 className="v3c-t-sec">{c.accountSoon}</h2>
      <p className="v3c-small">{c.accountSoonBody}</p>
      <Link className="v3c-ghost" href="/pricing">
        {bannerCopyFor(lang).pro.link}
      </Link>
    </section>
  );
}
