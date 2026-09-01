// #WIDGET-LANDING-0824 — /widget: la pagina che i partner leggono prima di
// incollare il tag. In inglese (è il pubblico che ha), sul design system della
// home v3 (.hv3 + classi v-*) perché deve sembrare BetRedge, non un allegato.
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { WidgetPlayground } from "./WidgetPlayground";

export const metadata: Metadata = {
  title: "Prediction Widget for Your Site | BetRedge",
  description:
    "Embed BetRedge model predictions on any website with one line of code. Free, responsive, no cookies — and every click carries your partner code.",
  alternates: { canonical: "/widget" },
};

const OPTIONS: Array<[string, string, string]> = [
  ["data-ref", "your partner code", "Attributes every click and signup to you. Ask us for one."],
  ["data-sport", "all · tennis · football", "Which board to pull from."],
  ["data-limit", "1 to 6", "How many matches to show."],
  ["data-lang", "en · it · es · fr · ru", "Widget language. Anything else falls back to English."],
  ["data-theme", "auto · light · dark", "auto follows your visitor's system theme."],
];

const FAQ: Array<[string, string]> = [
  ["Does it cost anything?", "No. The widget is free to embed and free to run."],
  ["How often does it update?", "The picks refresh as our model publishes them — you never touch the code again."],
  ["What happens when there are no matches?", "The widget stays, says there is nothing scheduled, and keeps the link to the full board. It never shows an empty box or a made-up match."],
  ["Will it slow my page down?", "It loads asynchronously in its own frame, after your content. It cannot block your page or inherit your CSS."],
  ["Does it set cookies or track my visitors?", "No cookies, no storage, no fingerprinting on your page, and we never identify or profile your visitors. We store how many times the widget was seen and clicked and on which domain — no country, no visitor identifier. Like any remote asset, the browser connects to our server to fetch it, so we see that connection's IP; we don't store it."],
  ["Can my visitors see every pick unlocked?", "By default the top match per sport is shown in full and the rest stay for BetRedge. When the model has no clear favourite it says so instead of inventing one. Partners who send real traffic can have every pick opened — talk to us."],
];

export default function WidgetPage() {
  return (
    <div className="hv3 mc-scene-stadium" data-mc-ground style={{ background: "var(--am-bg)", color: "var(--am-text)", minHeight: "100vh" }}>
      <span className="bgfix" aria-hidden="true" />
      <JsonLd data={breadcrumbJsonLd([["Widget", "/widget"]])} />

      <style>{`
.wg-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0}
.wg-nav a{color:var(--am-muted);text-decoration:none;font-size:13px}
.wg-nav a:hover{color:var(--am-text)}
.wg-hero{padding:clamp(28px,6vw,64px) 0 clamp(24px,4vw,40px)}
.wg-hero h1{font-size:clamp(30px,5.2vw,50px);line-height:1.04;letter-spacing:-.03em;margin:12px 0 0;max-width:16ch;text-wrap:balance}
.wg-hero p.sub{font-size:clamp(15px,2vw,18px);color:var(--am-muted);max-width:56ch;margin:16px 0 0;line-height:1.6}
.wg-play{display:flex;flex-direction:column;gap:18px}
.wg-controls{display:flex;flex-wrap:wrap;gap:12px}
.wg-field{display:flex;flex-direction:column;gap:5px;min-width:132px}
.wg-field span{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--am-muted-2)}
.wg-field input,.wg-field select{background:var(--am-inset);border:1px solid var(--am-line);color:var(--am-text);border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit}
.wg-field input:focus-visible,.wg-field select:focus-visible{outline:2px solid var(--am-coral);outline-offset:1px}
.wg-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
.wg-frame-wrap{border:1px solid var(--am-line);border-radius:12px;overflow:hidden;background:var(--am-panel)}
.wg-frame-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--am-line);background:var(--am-panel-2);font-size:11px;color:var(--am-muted-2);font-family:var(--font-mono),monospace}
.wg-dot{width:8px;height:8px;border-radius:50%;background:var(--am-line-2);flex:none}
.wg-frame{display:block;width:100%;border:0;background:transparent;transition:height .18s ease}
.wg-code{border:1px solid var(--am-line);border-radius:12px;background:var(--am-panel);overflow:hidden}
.wg-code-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-bottom:1px solid var(--am-line);background:var(--am-panel-2);font-size:11.5px;color:var(--am-muted)}
.wg-code pre{margin:0;padding:14px;overflow-x:auto}
.wg-code code{font-family:var(--font-mono),ui-monospace,monospace;font-size:12px;line-height:1.7;color:var(--am-text);white-space:pre}
.wg-hint{margin:0;padding:0 14px 14px;font-size:12px;color:var(--am-muted-2);line-height:1.5}
.wg-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.wg-step h3{font-size:15px;margin:0 0 6px;letter-spacing:-.01em}
.wg-step p{margin:0;color:var(--am-muted);font-size:13.5px;line-height:1.6}
.wg-step .num{font-family:var(--font-mono),monospace;font-size:11px;color:var(--am-coral);letter-spacing:.1em}
.wg-table{width:100%;border-collapse:collapse;font-size:13.5px}
.wg-table th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--am-muted-2);padding:0 12px 10px;font-weight:600}
.wg-table td{padding:11px 12px;border-top:1px solid var(--am-line);vertical-align:top;color:var(--am-muted)}
.wg-table td:first-child{color:var(--am-text);font-family:var(--font-mono),monospace;font-size:12.5px;white-space:nowrap}
.wg-table td:nth-child(2){color:var(--am-text);font-size:12.5px;font-family:var(--font-mono),monospace}
.wg-faq{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px 32px}
.wg-faq h3{font-size:14px;margin:0 0 5px;letter-spacing:-.01em}
.wg-faq p{margin:0;color:var(--am-muted);font-size:13.5px;line-height:1.6}
.wg-note{border:1px solid var(--am-line);border-radius:12px;background:var(--am-panel);padding:16px 18px;font-size:12.5px;color:var(--am-muted);line-height:1.65}
.wg-note b{color:var(--am-text)}
@media(max-width:860px){.wg-split{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.wg-frame{transition:none}}
      `}</style>

      <div className="v-wrap">
        <nav className="wg-nav">
          <Link href="/" aria-label="BetRedge home" style={{ display: "inline-flex", alignItems: "center" }}>
            {/* #UI-LOGO-THEME-0623: due file, swap via CSS su data-theme (nessun flash). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo-dark" src="/logos/betredge-logo-white.png" alt="BetRedge" style={{ height: 26, width: "auto" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo-light" src="/logos/betredge-logo-black.png" alt="" aria-hidden="true" style={{ height: 26, width: "auto" }} />
          </Link>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/predictions">Predictions</Link>
            <Link href="/tools">Free tools</Link>
          </div>
        </nav>

        <header className="wg-hero">
          <div className="v-kick q">For site owners</div>
          <h1>Put our predictions on your site</h1>
          <p className="sub">
            One line of code puts today&apos;s model picks on your page — updated on their own, styled to fit,
            and carrying your partner code on every click. Free to run, and free to remove.
          </p>
          <div className="v-actions" style={{ marginTop: 22 }}>
            <a className="v-btn v-btn--primary" href="mailto:info@betredge.com?subject=Widget%20partner%20code">Ask for your code</a>
            <Link className="v-btn v-btn--secondary" href="/predictions">See the full board</Link>
          </div>
        </header>
      </div>

      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head">
          <div className="v-kick q">Try it here</div>
          <h2>Set it up, watch it change</h2>
          <p>This is the real widget reading the live board — not a mockup. Change anything and the tag below updates with it.</p>
        </div>
        <WidgetPlayground />
      </div></section>

      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">How it works</div><h2>Three steps, then nothing</h2></div>
        <div className="wg-steps">
          <div className="wg-step"><div className="num">01</div><h3>You paste one tag</h3>
            <p>Anywhere in your HTML — a sidebar, the middle of an article, a footer. It takes the width it finds and sets its own height.</p></div>
          <div className="wg-step"><div className="num">02</div><h3>We keep it fed</h3>
            <p>The picks come from the same board our subscribers read, refreshed as the model publishes. You never edit the tag again.</p></div>
          <div className="wg-step"><div className="num">03</div><h3>You get the credit</h3>
            <p>Every link opens BetRedge with your code attached, so the signups it brings are attributed to you — and you can see which of your pages sent them.</p></div>
        </div>
      </div></section>

      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">Options</div><h2>What you can change</h2></div>
        <table className="wg-table">
          <thead><tr><th>Attribute</th><th>Values</th><th>What it does</th></tr></thead>
          <tbody>
            {OPTIONS.map(([a, v, d]) => (
              <tr key={a}><td>{a}</td><td>{v}</td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div></section>

      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">Questions</div><h2>Before you paste it</h2></div>
        <div className="wg-faq">
          {FAQ.map(([q, a]) => (
            <div key={q}><h3>{q}</h3><p>{a}</p></div>
          ))}
        </div>
        <div className="wg-note" style={{ marginTop: 26 }}>
          <b>The small print that matters.</b> BetRedge publishes statistical model output for information only — it is not
          betting advice, and nothing here is a promise of profit. The widget shows an 18+ notice on every render. Sports
          betting is regulated differently in every country: if your audience sits somewhere the content should not run,
          tell us and we will keep it off your site. Operated by {LEGAL_ENTITY.senderName}, {LEGAL_ENTITY.correspondence}.
        </div>
      </div></section>

      <section className="v-final"><div className="v-wrap">
        <h2>Want the code that <span className="g">credits you</span>?</h2>
        <p>Tell us where the widget is going and we&apos;ll send a partner code the same day.</p>
        <div className="v-actions">
          <a className="v-btn v-btn--primary" href="mailto:info@betredge.com?subject=Widget%20partner%20code">Ask for your code</a>
        </div>
      </div></section>

      <SiteFooter lang="en" />
    </div>
  );
}
