import {StrictMode} from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";

// #ATTRIB-EVERYWHERE-0915 — 15 iscrizioni su 21 senza sorgente identificabile,
// nello stesso mese di 180 post IG, 42 card Telegram, 16 invii email, 3 dirette
// Kick e 7 reel. Non perche' non arrivasse nessuno: perche' il page_view
// registrava `meta.path` e nient'altro, e i tag che i nostri link portano gia'
// (utm_*, crm, src) venivano buttati via all'arrivo.

const pathname = vi.hoisted(() => ({ value: "/tools" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import PageViewTracker from "./PageViewTracker";
import CookieBanner from "./CookieBanner";

let calls: Record<string, unknown>[] = [];

function setUrl(href: string) {
  window.history.replaceState({}, "", href);
}

function setReferrer(v: string) {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => v });
}

beforeEach(() => {
  calls = [];
  pathname.value = "/tools";
  localStorage.clear();
  sessionStorage.clear();
  setUrl("/tools");
  setReferrer("");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url) === "/api/track") calls.push(JSON.parse(String(init?.body ?? "{}")));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setReferrer("");
});

const meta = (i = 0) => calls[i]?.meta as Record<string, unknown>;

describe("PageViewTracker — ogni visita dice da dove arriva", () => {
  it("il path resta dov'era: nessuna query esistente si rompe", () => {
    render(<PageViewTracker />);
    expect(calls).toHaveLength(1);
    expect(calls[0].event_type).toBe("page_view");
    expect(meta().path).toBe("/tools");
  });

  it("cattura gli utm del profilo Reddit", () => {
    setUrl("/tools?utm_source=reddit&utm_medium=profile&utm_campaign=algobetting");
    render(<PageViewTracker />);
    expect(meta()).toMatchObject({
      path: "/tools",
      utm_source: "reddit",
      utm_medium: "profile",
      utm_campaign: "algobetting",
    });
  });

  it("cattura il tag Telegram e quello delle email", () => {
    setUrl("/tools/kelly-calculator?src=tg-free");
    render(<PageViewTracker />);
    expect(meta().src).toBe("tg-free");
    cleanup();
    calls = [];
    setUrl("/plans?crm=wb_day7_renew");
    render(<PageViewTracker />);
    expect(meta().crm).toBe("wb_day7_renew");
  });

  // Il canale che NON porta nulla nell'URL (un thread Reddit, un post su X, un
  // blog che ci cita) lascia una sola traccia: l'header Referer.
  it("registra l'host del referrer esterno, mai la sua URL", () => {
    setReferrer("https://www.reddit.com/r/sportsbook/comments/abc/thread-title/");
    render(<PageViewTracker />);
    expect(meta().ref_host).toBe("www.reddit.com");
    expect(JSON.stringify(meta())).not.toContain("thread-title");
  });

  it("il referrer interno non e' una sorgente", () => {
    setReferrer(`${window.location.origin}/`);
    render(<PageViewTracker />);
    expect(meta().ref_host).toBeUndefined();
  });

  // document.referrer NON cambia durante le navigazioni client-side: allegarlo a
  // ogni page_view direbbe che tutte le pagine della sessione arrivano da Reddit.
  it("l'host del referrer si registra solo sulla pagina d'ingresso", () => {
    setReferrer("https://www.reddit.com/r/sportsbook/");
    const view = render(<PageViewTracker />);
    expect(meta(0).ref_host).toBe("www.reddit.com");
    pathname.value = "/plans";
    view.rerender(<PageViewTracker />);
    expect(calls).toHaveLength(2);
    expect(meta(1).path).toBe("/plans");
    expect(meta(1).ref_host).toBeUndefined();
  });

  // Il gate del consenso non si sposta: la cattura anonima e' un dato che
  // l'utente porta lui, il session_id no.
  it("senza consenso l'evento parte anonimo e non crea identificatori", () => {
    setUrl("/tools?utm_source=reddit");
    setReferrer("https://www.reddit.com/");
    render(<PageViewTracker />);
    expect(calls[0].session_id).toBeUndefined();
    expect(sessionStorage.getItem("am_sid")).toBeNull();
    expect(localStorage.getItem("am_attrib")).toBeNull(); // first-touch persistente: ancora gated
    expect(meta().utm_source).toBe("reddit"); // ma la sorgente la sappiamo lo stesso
  });

  it("col consenso il first-touch persistente torna a scriversi", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    setUrl("/tools?utm_source=reddit");
    render(<PageViewTracker />);
    expect(JSON.parse(localStorage.getItem("am_attrib") ?? "{}").utm_source).toBe("reddit");
    expect(typeof calls[0].session_id).toBe("string");
  });

  // Superare il cap butta via l'INTERO meta lato route, path compreso.
  it("un path assurdo non fa saltare il cap di 2048 byte del meta", () => {
    pathname.value = `/${"x".repeat(5000)}`;
    render(<PageViewTracker />);
    expect(String(meta().path)).toHaveLength(512);
    expect(JSON.stringify(meta()).length).toBeLessThan(2048);
  });
});

// #SESSIONI-1006 leva 3 — dopo l'accept l'ingresso si lega alla sessione con
// UN evento distinto; prima dell'accept la fonte non tocca mai lo storage.
describe("PageViewTracker — entry_attributed dopo il consenso", () => {
  const byType = (t: string) => calls.filter((c) => c.event_type === t);
  const storageSnapshot = () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });

  function arriveAndDecide(choice: "accept" | "decline") {
    setUrl("/tools?utm_source=reddit&src=tg-free");
    setReferrer("https://www.reddit.com/r/sportsbook/");
    const view = render(<><PageViewTracker /><CookieBanner /></>);
    // Prima della scelta: nessuna fonte nello storage, in nessuna chiave.
    expect(storageSnapshot()).not.toContain("reddit");
    // Navigazione interna prima di decidere: la fonte resta quella d'ingresso.
    pathname.value = "/plans";
    setUrl("/plans");
    view.rerender(<><PageViewTracker /><CookieBanner /></>);
    fireEvent.click(screen.getByRole("button", { name: choice === "accept" ? /accept/i : /decline/i }));
    return view;
  }

  it("accept: un solo entry_attributed con sessione e fonte dell'ingresso", () => {
    arriveAndDecide("accept");
    const ev = byType("entry_attributed");
    expect(ev).toHaveLength(1);
    expect(typeof ev[0].session_id).toBe("string");
    expect(ev[0].meta).toEqual({ path: "/tools", utm_source: "reddit", src: "tg-free", ref_host: "www.reddit.com" });
    // L'ingresso non si conta due volte come page_view.
    expect(byType("page_view")).toHaveLength(2);
  });

  it("reject: nessun entry_attributed, e la fonte non resta da nessuna parte", () => {
    arriveAndDecide("decline");
    expect(byType("entry_attributed")).toHaveLength(0);
    expect(storageSnapshot()).not.toContain("reddit");
    // Un secondo evento di consenso (es. altro componente) non lo resuscita.
    localStorage.setItem("gdpr_consent", "accepted");
    act(() => { window.dispatchEvent(new Event("betredge:gdpr-consent")); });
    expect(byType("entry_attributed")).toHaveLength(0);
  });

  it("accept: un secondo evento di consenso non duplica", () => {
    arriveAndDecide("accept");
    act(() => { window.dispatchEvent(new Event("betredge:gdpr-consent")); });
    expect(byType("entry_attributed")).toHaveLength(1);
  });

  it("ricarica dopo l'accept: il page_view porta gia' il sid, nessun entry_attributed", () => {
    arriveAndDecide("accept");
    cleanup();
    calls = [];
    setUrl("/tools?utm_source=reddit");
    render(<><PageViewTracker /><CookieBanner /></>); // ricarica: consenso gia' salvato
    act(() => { window.dispatchEvent(new Event("betredge:gdpr-consent")); });
    expect(byType("entry_attributed")).toHaveLength(0);
    expect(typeof byType("page_view")[0].session_id).toBe("string");
  });
});

it('never records operator page views',()=>{pathname.value='/admin/banners-preview';setUrl('/admin/banners-preview');render(<PageViewTracker/>);expect(calls).toHaveLength(0);});
it('anchors a consenting session once across page navigation',()=>{localStorage.setItem('gdpr_consent','accepted');const {rerender}=render(<PageViewTracker/>);pathname.value='/plans';rerender(<PageViewTracker/>);expect(calls.filter(c=>c.event_type==='session_start')).toHaveLength(1);});
it('anchors the original entry after accept, not the later route',()=>{const {rerender}=render(<PageViewTracker/>);pathname.value='/plans';rerender(<PageViewTracker/>);localStorage.setItem('gdpr_consent','accepted');act(()=>window.dispatchEvent(new Event('betredge:gdpr-consent')));const anchors=calls.filter(c=>c.event_type==='session_start');expect(anchors).toHaveLength(1);expect(anchors[0].meta).toMatchObject({path:'/tools'});});

it('enhanced tracking waits for the signed cookie before the first page_view and dedupes StrictMode',async()=>{
 vi.stubEnv('NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED','1');localStorage.setItem('gdpr_consent','accepted');
 let ready!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{
  if(url==='/api/analytics/session')return new Promise<Response>(resolve=>{ready=resolve;});
  if(url==='/api/track')calls.push(JSON.parse(String(init?.body)));
  return Promise.resolve({ok:true} as Response);
 }));
 render(<StrictMode><PageViewTracker/></StrictMode>);
 expect(calls).toHaveLength(0);
 await act(async()=>{ready({ok:true} as Response);});
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(1);
 expect(calls.find(c=>c.event_type==='page_view')?.session_id).toBeTruthy();
});
it('advanced mode keeps undecided entry in memory and measures the current page once after acceptance',async()=>{
 vi.stubEnv('NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED','1');const {rerender}=render(<PageViewTracker/>);
 expect(calls).toHaveLength(0);expect(sessionStorage.getItem('am_sid')).toBeNull();
 pathname.value='/plans';rerender(<PageViewTracker/>);expect(calls).toHaveLength(0);
 await act(async()=>{localStorage.setItem('gdpr_consent','accepted');window.dispatchEvent(new Event('betredge:gdpr-consent'));window.dispatchEvent(new Event('betredge:gdpr-consent'));});
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(1);
 expect(calls.find(c=>c.event_type==='page_view')?.meta).toMatchObject({path:'/plans'});
 expect(calls.find(c=>c.event_type==='session_start')?.meta).toMatchObject({path:'/tools'});
});
it('withdrawal while bootstrap is pending prevents late page linkage and revokes the late cookie',async()=>{
 vi.stubEnv('NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED','1');localStorage.setItem('gdpr_consent','accepted');let ready!:(value:Response)=>void;
 const requests:string[]=[];
 vi.stubGlobal('fetch',vi.fn((url:string,init?:RequestInit)=>{
  const body=JSON.parse(String(init?.body));
  if(url==='/api/analytics/session'){requests.push(body.consent);if(body.consent==='accepted')return new Promise<Response>(resolve=>{ready=resolve;});return Promise.resolve({ok:true} as Response);}
  if(url==='/api/track')calls.push(body);return Promise.resolve({ok:true} as Response);
 }));
 render(<PageViewTracker/>);
 await act(async()=>{localStorage.setItem('gdpr_consent','declined');window.dispatchEvent(new Event('betredge:gdpr-consent'));ready({ok:true} as Response);});
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(0);expect(requests).toContain('revoked');
});
it('same-page declined to accepted synchronizes and anchors without duplicating the aggregate page view',async()=>{
 vi.stubEnv('NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED','1');localStorage.setItem('gdpr_consent','declined');render(<PageViewTracker/>);
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(1);
 await act(async()=>{localStorage.setItem('gdpr_consent','accepted');window.dispatchEvent(new Event('betredge:gdpr-consent'));});
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(1);expect(calls.filter(c=>c.event_type==='session_start')).toHaveLength(1);
 expect(vi.mocked(fetch).mock.calls.some(c=>String(c[0])==='/api/analytics/session'&&JSON.parse(String(c[1]?.body)).consent==='accepted')).toBe(true);
});
it('same-page withdrawal and reacceptance establish a fresh anchor while keeping one aggregate page view',async()=>{
 vi.stubEnv('NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED','1');localStorage.setItem('gdpr_consent','accepted');
 await act(async()=>{render(<PageViewTracker/>);});
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(1);
 await act(async()=>{localStorage.setItem('gdpr_consent','declined');window.dispatchEvent(new Event('betredge:gdpr-consent'));});
 expect(sessionStorage.getItem('am_sid')).toBeNull();
 await act(async()=>{localStorage.setItem('gdpr_consent','accepted');window.dispatchEvent(new Event('betredge:gdpr-consent'));});
 expect(calls.filter(c=>c.event_type==='page_view')).toHaveLength(1);expect(calls.filter(c=>c.event_type==='session_start')).toHaveLength(2);
 const choices=vi.mocked(fetch).mock.calls.filter(c=>String(c[0])==='/api/analytics/session').map(c=>JSON.parse(String(c[1]?.body)).consent);
 expect(choices).toEqual(['accepted','revoked','accepted']);
});
