---
name: Costi e scadenze
description: Modulo Amministrazione → Inserisci Costi, fonte unica scadenze e regole notifiche
type: feature
---
Sezione Amministrazione → Inserisci Costi (`/amministrazione/costi`) con 3 schede: Autisti interni, Spese Macchine, Altri Costi.

- Nessun sistema parallelo di scadenze: le spese autista scrivono su `autisti_spese`, quelle mezzo su `veicoli_spese` (stesse righe della scheda veicolo), gli altri costi su `costi_generali`. `veicoli_documenti` resta solo archivio file.
- Vista unica `scadenze_costi` (stato ok/avviso/scaduto) alimenta dashboard, campanella e livello "Scadenze" in Agenda.
- Preavviso default 30 giorni, override per riga (`giorni_preavviso`).
- Job giornaliero `scadenze_costi_process()` (cron 6:30): UNA sola notifica per riga per fase (avviso, scaduto), deduplica in `scadenze_notificate`.
- Dropdown tipi configurabili in `config_tipi_costo` (ambito autista/veicolo/generale, flag `ricorrente`); seed automatico ad ogni nuova organizzazione via `handle_new_user` → `seed_config_tipi_costo`.
- Ogni costo ha `centro_costo` (veicolo/autista/generale) per i futuri consuntivi.
- La sezione "Inserisci Fattura" (costi con fattura) non è ancora implementata: da fare in un secondo momento.
