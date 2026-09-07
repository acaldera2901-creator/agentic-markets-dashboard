"""Lo scrittore che mancava: le memorie vive dentro il cervello.

── Il difetto che questo file chiude ─────────────────────────────────
Il collector rigenera il grafo del cervello ogni 5 minuti, ma da una cartella
**congelata**: `cervello.py` dichiara «letta e mai scritta», e nessuno la
scriveva. `~/Desktop/00-SISTEMA/cervello/` era stata popolata a mano il
04/09 e da allora ferma, mentre le memorie vere continuavano a muoversi.

Misurato il 07/09, prima di questo file: **264 file su 268 divergenti**. Il
numero però mentiva sulla gravità — 258 avevano uno scarto identico di 15
byte (il campo `scope:` aggiunto dalla migrazione), quindi erano una
trasformazione, non una forcella. Le divergenze vere erano **sei**, con la
più vecchia a 5,9 giorni. Il quartier generale mostrava un grafo di tre
giorni prima e nessuno poteva accorgersene, perché non c'era niente che lo
misurasse.

── Perché non sovrascrive, mai ───────────────────────────────────────
La prima versione di questa sincronizzazione doveva sovrascrivere: `memory` è
più recente, quindi vince. **Verificato, e falso.** Su
`project_email_warmup_news_subdomain.md` la copia nel cervello aveva 14 righe
vere che `memory` non aveva — un blocco STATO del 01/09 con una trappola di
fuso orario che era costata quasi un'ora di lavoro. Non righe superate:
conoscenza.

Quindi la regola è: **prima di sostituire un file il cui contenuto differisce
per qualcosa che non sia `scope:`, la versione attuale del cervello si
parcheggia in `4-archivio/superati/`.** Costa qualche kilobyte e chiude per
sempre la categoria «l'ho perso perché credevo fosse vecchio».

E non cancella niente: i 376 file episodici, i 286 di archivio, i 7
procedurali e il vault non sono suoi e non li tocca. È additivo per
costruzione, non per attenzione.

── I nomi in comune fra i due profili ────────────────────────────────
Dieci file esistono in entrambe le memorie: ogni profilo ha il suo
`MEMORY.md`, il suo `user_andrea.md`, il suo `project_sistema.md`. La prima
versione li saltava e perdeva il privato — misurato: il `MEMORY.md` privato,
6,8 KB, non era mai entrato nel cervello in tutta la sua vita. Ora il primo
profilo tiene il nome nudo (i wikilink esistenti puntano lì) e il secondo
entra suffissato `--privato`. Se i due sono identici a meno dello `scope:`,
il gemello non si crea: sarebbe un nodo di rumore nel grafo.
"""

from __future__ import annotations

import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

# Le due memorie vive. I nomi dei profili non sono decorativi: finiscono nel
# campo `scope:` del frontmatter, ed è l'unica cosa che distingue nel grafo
# un progetto aziendale da uno privato.
FONTI = {
    'azienda': Path.home() / '.claude' / 'projects' / '-Users-calde' / 'memory',
    'privato': Path.home() / '.claude-personal' / 'projects',
}

CERVELLO = Path.home() / 'Desktop' / '00-SISTEMA' / 'cervello'

# Le altre memorie vive, e dove il cervello le teneva già. La mappatura non è
# inventata: è stata **misurata** confrontando i nomi dei file (il diario del
# cervello conteneva `2026-04-09.md`, che vive in `sistema-andrea/docs/diario`;
# `Task_Debates.md` viene da `11_LLM_COUNCIL`). Inventare una cartella nuova
# avrebbe duplicato 189 file di diario invece di aggiornarli.
#
# Erano congelate come le memorie: diario fermo al 04/09 (189 file), council
# 34, learning 141. Il diario della notte del 07/09 non c'era.
_SA = Path.home() / 'Desktop' / '00-SISTEMA' / 'sistema-andrea'
_MB = Path.home() / 'Desktop' / 'obsidian-brain' / 'Maven-Brain'
#
# Il terzo campo dice se scendere nelle sottocartelle. **Non è un dettaglio.**
# Mappando `sistema-andrea/docs` in modo ricorsivo ho ripreso anche
# `docs/diario` e `docs/progetti`, che erano già mappati altrove: 91 file di
# diario sono comparsi in due posti del cervello. Cioè ho creato una
# duplicazione trenta secondi dopo aver finito di estirparne una — la
# ricorsione è comoda finché due mappature non si sovrappongono, e poi è un
# difetto silenzioso.
CARTELLE = (
    (_SA / 'docs' / 'diario',      '1-episodic/diario',            True),
    (_SA / 'agenti-output',        '1-episodic/agenti',            True),
    (_MB / '13_LEARNING',          '1-episodic/learning',          True),
    (_MB / '11_LLM_COUNCIL',       '1-episodic/council',           True),
    (_MB / '01_CALENDAR',          '1-episodic/calendar',          True),
    (_SA / 'docs' / 'progetti',    '2-semantic/progetti-sistema',  True),
    # Il sapere procedurale: lo standard, le definizioni degli agenti e le
    # istruzioni permanenti. Perderle costerebbe più di perdere un progetto —
    # sono il modo in cui si lavora, non una cosa su cui si lavora — e non
    # erano sotto alcun backup versionato. Nessuna contiene credenziali:
    # `~/.claude` **intero** resta fuori, e deve restarci.


    (Path.home() / '.claude-agents-shared',           '3-procedural/agenti', True),
)

# Le istruzioni permanenti, **file per file e non per cartella**. Non è
# pignoleria: mappare `01-BETREDGE/lab` e `sistema-andrea/docs` per cartella ha
# reimportato roba che il cervello teneva già altrove — le 11 schede prodotto
# comparivano sia in `2-semantic/prodotti` sia in `3-procedural/lab/.contesto`,
# `andrea_mindset.md` in due posti, le memorie di ruolo in due. **16 doppioni
# byte-identici creati nel gesto stesso di eliminarne 129.** Una mappatura per
# cartella è comoda finché non si sovrappone a una che c'è già, e allora è un
# difetto che non fa rumore.
#
# Ogni voce qui sotto è un file che **non era** già nel cervello da un'altra
# strada, verificato per nome.
ISTRUZIONI = (
    (Path.home() / 'CLAUDE.md',                      '3-procedural/istruzioni/CLAUDE-comune.md'),
    (Path.home() / '.claude' / 'CLAUDE.md',          '3-procedural/istruzioni/CLAUDE-azienda.md'),
    (Path.home() / '.claude-personal' / 'CLAUDE.md', '3-procedural/istruzioni/CLAUDE-privato.md'),
    (Path.home() / 'Desktop' / '01-BETREDGE' / 'lab' / 'standard.md',
     '3-procedural/lab-standard.md'),
    (_SA / 'docs' / 'operating_standard.md',         '3-procedural/operating_standard.md'),
    # `andrea_mindset.md` e `andrea_data.md` NON sono qui: il cervello li tiene
    # già in `2-semantic/andrea/`, ed è lì che vanno aggiornati.
    (_SA / 'docs' / 'andrea_mindset.md',             '2-semantic/andrea/andrea_mindset.md'),
    (_SA / 'docs' / 'andrea_data.md',                '2-semantic/andrea/andrea_data.md'),
)

# `Group_Chat-ORIGINALE-INTERO.md` è 2,8 MB e contiene la stessa cosa dei
# `Group_Chat-<mese>.md` tagliati accanto: `cervello.py` lo salta già nel
# grafo, e copiarlo sarebbe 2,8 MB riletti a ogni giro per niente.
SALTA_NOMI = {'Group_Chat-ORIGINALE-INTERO.md'}
LIMITE_BYTE = 2_000_000
# Tutto piatto qui: misurato il 07/09, la convenzione esistente mette
# `project_`, `feedback_`, `reference_` e l'indice nella stessa cartella —
# 291 file su 291. Inventarne una nuova spaccherebbe i wikilink.
DESTINAZIONE = CERVELLO / '2-semantic' / 'progetti'
SUPERATI = CERVELLO / '4-archivio' / 'superati'


def _con_scope(testo: str, scope: str) -> str:
    """Inserisce `scope:` subito dopo `name:` nel frontmatter.

    Se il frontmatter non c'è o `name:` manca, il file passa intatto: meglio
    un nodo senza scope che un file corrotto da una regex ottimista.
    """
    righe = testo.split('\n')
    if not righe or righe[0].strip() != '---':
        return testo
    for i, r in enumerate(righe[1:40], start=1):
        if r.strip() == '---':
            break
        if r.startswith('name:'):
            if any(x.startswith('scope:') for x in righe[1:i + 8]):
                return re.sub(r'^scope:.*$', f'scope: {scope}',
                              testo, count=1, flags=re.M)
            righe.insert(i + 1, f'scope: {scope}')
            return '\n'.join(righe)
    return testo


def _differenza_reale(vecchio: str, nuovo: str) -> bool:
    """Vero se i due testi differiscono per qualcosa che non sia `scope:`."""
    spoglia = lambda s: '\n'.join(r for r in s.split('\n') if not r.startswith('scope:'))
    return spoglia(vecchio).strip() != spoglia(nuovo).strip()


def aggiorna(prova: bool = False) -> dict:
    """Riversa le memorie vive nel cervello. Additivo: non cancella nulla.

    `prova=True` misura e non scrive — serve a guardare cosa farebbe prima
    di lasciarglielo fare.
    """
    esito = {'nuovi': [], 'aggiornati': [], 'invariati': 0,
             'parcheggiati': [], 'collisioni': [], 'mancanti': []}
    if not prova:
        DESTINAZIONE.mkdir(parents=True, exist_ok=True)
        SUPERATI.mkdir(parents=True, exist_ok=True)

    stampo = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    visti: dict[str, str] = {}

    for scope, radice in FONTI.items():
        if not radice.is_dir():
            esito['mancanti'].append(f'{scope}: {radice}')
            continue
        for src in sorted(radice.rglob('*.md')):
            nome = src.name
            try:
                testo = _con_scope(src.read_text(encoding='utf-8'), scope)
            except (OSError, UnicodeDecodeError) as e:
                esito['mancanti'].append(f'{nome}: {e}')
                continue

            # Due profili in una cartella piatta: 10 nomi esistono in
            # entrambi (ogni profilo ha il suo `MEMORY.md`, il suo
            # `user_andrea.md`). Saltare il secondo perdeva il privato —
            # misurato: `MEMORY.md` privato, 6,8 KB, non era mai entrato nel
            # cervello. Sovrascrivere alternerebbe i contenuti a ogni giro.
            # Quindi: il primo profilo tiene il nome nudo (i wikilink
            # esistenti puntano lì e non si rompono), il secondo entra
            # suffissato. Additivo: crea un nodo, non ne sostituisce uno.
            if nome in visti and visti[nome] != scope:
                gemello = DESTINAZIONE / nome
                if gemello.exists() and not _differenza_reale(
                        gemello.read_text(encoding='utf-8'), testo):
                    # identici a meno dello scope: un gemello sarebbe rumore
                    esito['invariati'] += 1
                    continue
                nome = nome[:-3] + f'--{scope}.md'
                esito['collisioni'].append(f'{src.name} -> {nome}')
            visti.setdefault(src.name, scope)

            dst = DESTINAZIONE / nome
            if not dst.exists():
                esito['nuovi'].append(nome)
                if not prova:
                    dst.write_text(testo, encoding='utf-8')
                continue

            attuale = dst.read_text(encoding='utf-8')
            if attuale == testo:
                esito['invariati'] += 1
                continue

            if _differenza_reale(attuale, testo):
                # La copia che sto per sostituire potrebbe avere righe che la
                # nuova non ha. Non lo giudico: la parcheggio.
                park = SUPERATI / nome.replace('.md', '') / f'{stampo}.md'
                esito['parcheggiati'].append(str(park.relative_to(CERVELLO)))
                if not prova:
                    park.parent.mkdir(parents=True, exist_ok=True)
                    park.write_text(attuale, encoding='utf-8')
            esito['aggiornati'].append(nome)
            if not prova:
                dst.write_text(testo, encoding='utf-8')

    # ── le istruzioni permanenti, file per file ──
    for src, rel in ISTRUZIONI:
        if not src.is_file():
            esito['mancanti'].append(f'istruzioni: {src}')
            continue
        dst = CERVELLO / rel
        testo = src.read_text(encoding='utf-8')
        if dst.exists():
            attuale = dst.read_text(encoding='utf-8')
            if attuale == testo:
                esito['invariati'] += 1
                continue
            park = SUPERATI / 'istruzioni' / dst.stem / f'{stampo}.md'
            esito['parcheggiati'].append(str(park.relative_to(CERVELLO)))
            if not prova:
                park.parent.mkdir(parents=True, exist_ok=True)
                park.write_text(attuale, encoding='utf-8')
            esito['aggiornati'].append(rel)
        else:
            esito['nuovi'].append(rel)
        if not prova:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(testo, encoding='utf-8')

    # ── le altre memorie vive, per cartella ──
    for radice, rel, ricorsivo in CARTELLE:
        if not radice.is_dir():
            esito['mancanti'].append(f'cartella: {radice}')
            continue
        dest = CERVELLO / rel
        elenco = radice.rglob('*.md') if ricorsivo else radice.glob('*.md')
        for src in sorted(elenco):
            if src.name in SALTA_NOMI or src.stat().st_size > LIMITE_BYTE:
                continue
            # Il percorso relativo si conserva: `13_LEARNING/social/x.md`
            # resta sotto `social/`. Appiattire farebbe collidere nomi che
            # nella sorgente non collidono.
            dst = dest / src.relative_to(radice)
            try:
                testo = src.read_text(encoding='utf-8')
            except (OSError, UnicodeDecodeError) as e:
                esito['mancanti'].append(f'{src.name}: {e}')
                continue
            if dst.exists():
                attuale = dst.read_text(encoding='utf-8')
                if attuale == testo:
                    esito['invariati'] += 1
                    continue
                park = SUPERATI / rel.replace('/', '-') / src.stem / f'{stampo}.md'
                esito['parcheggiati'].append(str(park.relative_to(CERVELLO)))
                if not prova:
                    park.parent.mkdir(parents=True, exist_ok=True)
                    park.write_text(attuale, encoding='utf-8')
                esito['aggiornati'].append(f'{rel}/{src.name}')
            else:
                esito['nuovi'].append(f'{rel}/{src.name}')
            if not prova:
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_text(testo, encoding='utf-8')

    return esito


def cruscotto() -> str:
    """Rigenera `~/Desktop/00-SISTEMA/STATO.md`, il cruscotto da terminale.

    Perché sta qui: è una **vista derivata** della stessa verità (lo dice da
    sé — «si riscrive da zero, non modificarlo a mano»), ma si rigenerava a
    mano, quindi invecchiava. Un test a freddo del 07/09 l'ha mostrato: a un
    agente aperto pulito ho chiesto dove si guarda lo stato, e ha risposto
    `STATO.md` — trovandolo generato due giorni prima e rigenerandolo lui.
    Una vista che invecchia diventa una fonte che mente, e la differenza fra
    le due la paga chi legge.

    Non è un registro in più: legge gli stessi tre registri di progetto e non
    contiene niente che non sia già lì.
    """
    import subprocess
    script = (Path.home() / 'Desktop' / '00-SISTEMA' / 'sistema-andrea'
              / 'scripts' / 'genera_stato.py')
    if not script.is_file():
        return 'assente'
    try:
        r = subprocess.run(['python3', str(script)], capture_output=True,
                           text=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as e:
        return f'non rigenerato: {e}'
    if r.returncode != 0:
        return f'non rigenerato: {(r.stderr or r.stdout).strip()[:120]}'
    return 'rigenerato'


def salva(esito: dict) -> str:
    """Committa nel cervello **solo** i file che questo giro ha toccato.

    Perché non `git add -A`: la regola di casa vuole che ogni commit elenchi i
    propri file per nome, e qui vale doppio. Il cervello è una cartella che
    altri strumenti guardano; un `add -A` porterebbe dentro anche ciò che non
    ho scritto io, e a quel punto il commit non racconta più cosa è cambiato.

    Committa solo se c'è qualcosa: un commit ogni 5 minuti a contenuto
    identico renderebbe la storia illeggibile, che è il modo in cui un backup
    smette di servire.
    """
    tocchi = list(esito['nuovi']) + list(esito['aggiornati']) + list(esito['parcheggiati'])
    if not tocchi:
        return ''
    if not (CERVELLO / '.git').is_dir():
        return 'non versionato'

    import subprocess
    # I nomi in `nuovi`/`aggiornati` sono relativi alla loro destinazione:
    # quelli senza `/` stanno nella cartella piatta delle memorie.
    percorsi = sorted({
        (n if '/' in n else f'2-semantic/progetti/{n}') for n in tocchi
    })
    esistenti = [x for x in percorsi if (CERVELLO / x).exists()]
    if not esistenti:
        return ''
    msg = ('cervello: %d nuovi, %d aggiornati, %d parcheggiati'
           % (len(esito['nuovi']), len(esito['aggiornati']), len(esito['parcheggiati'])))
    try:
        subprocess.run(['git', 'add', '--'] + esistenti, cwd=CERVELLO,
                       check=True, capture_output=True, timeout=60)
        r = subprocess.run(['git', '-c', 'user.name=Andrea via Claude Code',
                            '-c', 'user.email=calde@mavenagency.io',
                            'commit', '-q', '-m', msg],
                           cwd=CERVELLO, capture_output=True, text=True, timeout=60)
        if r.returncode != 0 and 'nothing to commit' not in (r.stdout + r.stderr):
            return f'commit fallito: {(r.stderr or r.stdout).strip()[:120]}'
    except (OSError, subprocess.SubprocessError) as e:
        return f'git non disponibile: {e}'
    return msg


def scarto() -> dict:
    """Quanti file sono fuori pari. È il controllo, non la riparazione:
    `lab certifica` lo chiama per dire se l'unione ha tenuto.
    """
    e = aggiorna(prova=True)
    return {'fuori_pari': len(e['nuovi']) + len(e['aggiornati']),
            'nuovi': len(e['nuovi']), 'aggiornati': len(e['aggiornati']),
            'invariati': e['invariati'], 'collisioni': e['collisioni']}


if __name__ == '__main__':
    import json
    import sys
    prova = '--prova' in sys.argv or '--dry-run' in sys.argv
    e = aggiorna(prova=prova)
    print(('PROVA — non ho scritto niente' if prova else 'SCRITTO') + ':')
    print('  nuovi        %4d  %s' % (len(e['nuovi']), e['nuovi'][:5]))
    print('  aggiornati   %4d  %s' % (len(e['aggiornati']), e['aggiornati'][:5]))
    print('  invariati    %4d' % e['invariati'])
    print('  parcheggiati %4d  (in 4-archivio/superati/)' % len(e['parcheggiati']))
    if e['collisioni']:
        print('  ⚠️ COLLISIONI %d: %s' % (len(e['collisioni']), e['collisioni']))
    if e['mancanti']:
        print('  ⚠️ non letti: %s' % e['mancanti'])
    if not prova:
        m = salva(e)
        print('  git          %s' % (m or 'niente da committare'))
        print('  cruscotto    %s' % cruscotto())
