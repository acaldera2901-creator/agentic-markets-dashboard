// #CLASSIC-COVERAGE-1014 — 404 del sito. A flag spento rende ESATTAMENTE la 404
// di default di Next (stesso componente), quindi main non cambia; a flag acceso
// rende la pagina classic.
import DefaultNotFound from "next/dist/client/components/builtin/not-found";
import ClassicNotFound from "@/components/classic/ClassicNotFound";
import { CLASSIC } from "@/lib/classic/flag";

export default function NotFound() {
  return CLASSIC ? <ClassicNotFound /> : <DefaultNotFound />;
}
