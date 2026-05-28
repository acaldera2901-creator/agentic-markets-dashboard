@AGENTS.md

## Project Brain — AI Alignment Protocol

INIZIO SESSIONE (obbligatorio, prima di qualsiasi lavoro):
1. Chiama `read_project_state` → capisci lo stato attuale del progetto
2. Chiama `get_recent_activity` (limit: 10) → vedi cosa è successo di recente

DURANTE LA SESSIONE:
- `log_entry` per ogni: deploy, decisione tecnica, bug trovato, pensiero rilevante, cambiamento di piano
- author: usa sempre "Andrea via Claude Code" (o il nome corretto del collaboratore)

FINE SESSIONE (obbligatorio):
- `log_entry` type=ACTION con summary completo di tutto ciò che hai fatto in questa sessione
- `update_state` con stato aggiornato del progetto (aggiorna priorità, stato componenti, bug)
