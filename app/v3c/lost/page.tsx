// /v3c/lost (#REDESIGN-V3C polish) — destinazione della rewrite «fallback» di
// lib/v3c/rewrites.ts: a flag acceso una URL che nessuna pagina serve arriva qui
// e risponde 404 VERO con il 404 illustrato del kit (app/v3c/not-found.tsx).
// A flag spento la rewrite non esiste e questa rotta è un 404 come le altre /v3c.
import { notFound } from "next/navigation";

export const metadata = { robots: { index: false } };

export default function V3cLost() {
  notFound();
}
