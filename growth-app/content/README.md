# How to update the /lavoro (Work) page (for Steve)

The **/lavoro** page has no database: it shows the files in this folder.
To change it you edit a file, make a commit and, at the next deploy, the page
updates. Nothing is saved from the page.

| Page section | File to edit |
|---|---|
| Tracking gaps | `tracking-gaps.json` |
| Experiment backlog | `experiments.json` |
| Weekly memo | a new file in `memo/` (e.g. `memo/2026-W41.md`) |
| Access and sources | `sources.json` |

## The simplest way: from GitHub in the browser

1. Open the file on GitHub, on the dashboard branch, and click the pencil (Edit).
2. Edit the text. In the `.json` files leave quotes, commas and brackets as they are.
3. «Commit changes» → choose «Create a new branch» and open a PR. Andrea or Calde merges it.

## Field rules (if you get one wrong, the build stops and says where)

- **tracking-gaps.json** — `priority`: `P0` | `P1` | `P2`. `status`: `open` | `in progress` | `mitigated` | `closed`.
  `owner` and `unlocks` (the KPIs the gap unlocks) cannot be empty. The `id`s (G01, G02 …) do not repeat.
  A closed gap is not deleted: set `"status": "closed"`, so the history stays.
- **experiments.json** — every field is required: `hypothesis`, `kpiTarget`, `dataSource`, `duration`,
  `decisionThreshold`. `status`: `proposed` | `in progress` | `scale` | `fix` | `kill`. The threshold is written **before** starting.
  The three experiments E01–E03 are examples with real numbers from the Oct 5 snapshot: keep them, edit them or set them to `kill`.
- **memo/** — copy `memo/_template.md` to `memo/YYYY-Www.md` (year and ISO week number, e.g. `2026-W41.md`).
  Memos appear newest first. The template does not appear as a memo.
  The memo is shown as plain text: markdown formatting is not interpreted.
- **sources.json** — one block per source: `reads`, `role` (the minimum role, never admin nor shared passwords),
  `steps` (steps to grant it), `owner` (who grants it), `verify` (the number that proves it works), `status`:
  `to grant` → `granted` (the owner did the steps) → `verified` (the number matches). It always starts from `to grant`.
- **tracking-gaps.json** — `tiles` (optional) lists the PROXY tiles the gap makes real, `dependsOn` what it depends on.

## Check before committing (if you work locally)

```bash
cd growth-app && npm test      # says which field of which row is wrong
```
