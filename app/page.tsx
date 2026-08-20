// #SEO-PACK-0810: wrapper server della landing — la pagina client vive in
// landing-client.tsx (colocato, non-rotta); qui solo metadata con il canonical
// di "/", che in un client component non si può esportare.
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export { default } from "./landing-client";
