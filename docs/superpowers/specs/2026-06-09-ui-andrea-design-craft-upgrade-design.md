# UI-ANDREA Design-Craft Upgrade — Design Spec

**Data:** 2026-06-09
**Owner:** Andrea
**Tipo:** Upgrade agente + knowledge base (documentazione/ricerca, low-risk)

## Problema

L'UI dei prodotti Agentic Markets è percepita come "AI slop": estetica generica,
template-like, senza intenzionalità. L'agente `ui-andrea` è oggi forte
sull'operatività (browser-driven, fonti librerie, guardrail etici, sistema
Cobalt & Coral) ma **non possiede teoria del design**: nessuna conoscenza di
storia grafica, nessuna disciplina anti-slop, nessun criterio di craft. È un
esecutore, non un graphic designer senior.

## Obiettivo

Trasformare `ui-andrea` in un **graphic/UI designer senior** product-agnostic,
capace di produrre interfacce che leggano come **human-made** — non template
generati — pur restando moderne e impressive. Competenza trasferibile a
qualsiasi progetto, non tarata su un prodotto specifico.

Criterio di successo verificabile: dato un brief UI, l'agente (a) ragiona come
un designer (concept → voce tipografica → griglia → restraint → dettaglio
intenzionale) e (b) supera una **checklist anti-slop** prima di dichiarare
finito. Il salto qualitativo deve essere evidente rispetto al comportamento
default.

## Deliverable

1. `docs/design-craft/design-bible.md` — lo "studio profondo" (knowledge base
   riusabile, lunga).
2. `docs/design-craft/research-notes.md` — finding grezzi citati dalla ricerca
   multi-agente (appendice/fonti).
3. `~/.claude/agents/ui-andrea.md` — riscrittura chirurgica: aggiunge il
   design-craft core, mantiene TUTTA la macchina operativa esistente
   (browser, librerie, scope, output, **Engagement Ethics intatte**).
4. Log in `docs/ui_memory.md`.

## Approccio: ricerca multi-agente (ultracode)

Workflow con 5 track di ricerca paralleli, ognuno verificato adversarialmente
prima della sintesi:

1. **Heritage grafico pre-AI** — Swiss/International Typographic Style
   (Müller-Brockmann, griglie), editorial/print (Brodovitch, Vignelli, Willi
   Kunz), type espressivo (Paula Scher, David Carson, Neville Brody),
   Bauhaus/costruttivismo, Push Pin/Milton Glaser, Saul Bass. Lezione: quale
   disciplina imponevano i vincoli della stampa.
2. **Typography & grid craft** — pairing con contrasto reale, gerarchia oltre
   il font-size, measure/ritmo/baseline grid, rompere la griglia di proposito.
3. **Color & composizione** — Albers, palette limitate, equilibrio
   asimmetrico, tensione, Gestalt, focal point.
4. **Anatomia dell'AI slop** — catalogo dei "tell": default gradiente
   viola/glassmorphism, Inter ovunque, tutto centrato, card uniformi
   rounded + soft shadow, icona lucide per heading, blob sfocati di sfondo,
   look shadcn default intoccato, fade-up-on-scroll identico, copy
   placeholder. Per ciascuno: perché legge come macchina + alternativa umana.
5. **Web craft human-made** — tradizione awwwards/editorial-web, reazione
   brutalista, imperfezione intenzionale, texture/grana/foto reale/
   illustrazione custom, coreografia del movimento.

## Struttura design-bible.md

```
1. Manifesto — cosa significa "human-made", perché lo slop è un fallimento
   di intenzionalità
2. The heritage — movimenti & maestri pre-AI, la lezione di ognuno
3. The craft — typography · grid · color · composition · motion
   (principi azionabili)
4. Anatomia dell'AI slop — catalogo dei tell, ognuno con "perché legge come
   AI" + alternativa human-made
5. La checklist anti-slop — pass operativo che l'agente esegue prima di
   dichiarare finito
6. References — fonti citate dalla ricerca
```

## Rewrite ui-andrea.md (chirurgico)

- **Si mantiene intatto:** browser automation, tabella progetti/stack, Research
  Mode, fonti librerie, SCOPE, OUTPUT STANDARD, e in particolare l'intero
  blocco **Engagement Ethics** (non si tocca).
- **Si aggiunge:** un "design-craft core" — l'agente apre ogni task di design
  ragionando da designer senior; punta alla bible come base teorica; esegue la
  checklist anti-slop prima di dichiarare finito.
- **Si riformula:** la lista librerie (Magic UI, Aceternity, ...) da "fonte di
  pattern" a "materia prima da trasformare — mai shippare i loro default
  così come sono".

## Vincoli

- Surgical: la rewrite dell'agente non rimuove funzionalità esistenti.
- Product-agnostic: la bible non si lega a Cobalt & Coral né al prediction
  market; gli esempi sono trasferibili.
- Low-risk: nessun deploy, nessun codice prodotto, nessun DB. Gate di
  approvazione non richiesto.
- Le fonti nella bible sono citate (no claim a memoria non verificati).

## Fuori scope

- Redesign concreto di un prodotto Agentic (verrà fatto dopo, caso per caso).
- Modifiche a codice prodotto / componenti.
