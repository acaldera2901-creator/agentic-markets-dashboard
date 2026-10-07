// components/v3c/pages/Frame.tsx (#REDESIGN-V3C · filone pages)
// Lato server della cornice: porta il CSS del design system, il CSS di questo
// filone (pages.css, scope v3c-) e le variabili dei font, poi passa al client
// (FrameClient) che sceglie la lingua. Montata SOLO a flag acceso: a flag
// spento le pagine non importano né questo file né i suoi CSS/font.
import type { ReactNode } from "react";
import "../v3c.css";
import "../fixui.css";
import "./pages.css";
// community.css qui (server) e non nei componenti client: un import CSS in un modulo
// client entra nel CSS della rotta anche a flag spento (misurato su /privacy).
import "./community.css";
import { v3cFontClass } from "../fonts";
import { FrameClient, type FrameCurrent } from "./FrameClient";

export function V3cFrame({ current, children }: { current?: FrameCurrent; children: ReactNode }) {
  return (
    <FrameClient fontClass={v3cFontClass} current={current}>
      {children}
    </FrameClient>
  );
}
