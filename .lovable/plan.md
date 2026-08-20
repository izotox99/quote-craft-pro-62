# Amministrazione → Inserisci Costi

## Come unifico le scadenze (punto chiave)

Oggi nel progetto ci sono già:
- `veicoli_spese` — spese del mezzo con `tipo`, `data_intervento`, `data_scadenza`, `importo_spese`, `totale_fattura`, `note`. È già usata nella scheda veicolo (tab "Spese") con evidenza giallo/rosso.
- `veicoli_documenti` — SOLO file allegati del mezzo (titolo + file). Non contiene date di scadenza.
- `autisti_spese` — spese autista, ha già `tipo`, `data_intervento`, `data_scadenza`, `importo_spese`, `totale_fattura`.

Proposta: **nessuna tabella parallela per mezzi e autisti**.
- Scheda "Spese Macchine" = stessa tabella `veicoli_spese` della scheda veicolo (stesse righe, due punti di accesso: uno per singolo mezzo, uno globale).
- Scheda "Autisti interni" = stessa tabella `autisti_spese`.
- `veicoli_documenti` resta solo archivio file; opzionalmente si potrà allegare un file a una spesa in futuro.
- **Fonte unica delle scadenze mezzo = `veicoli_spese.data_scadenza`** (più la soglia km tagliando già esistente, che resta separata perché è a km, non a data).

Unica tabella nuova: `costi_generali` per la scheda "Altri Costi" (costi non riferiti a mezzo né autista), più una tabella di configurazione `config_tipi_costo` per rendere configurabili i dropdown "Tipo Inserimento" / "Tipo Spese" / "Categoria".

## Modifiche al database

1. `autisti_spese`: aggiungere `tipo_pagamento text`, `centro_costo text` (default `'autista'`), `giorni_preavviso int default 30`.
2. `veicoli_spese`: aggiungere `tipo_pagamento text`, `fornitore text`, `centro_costo text` (default `'veicolo'`), `ricorrenza text` (`3m` | `6m` | `12m` | `nessuno`), `giorni_preavviso int default 30`.
3. Nuova `costi_generali`: `descrizione`, `categoria`, `data`, `data_scadenza`, `importo`, `tipo_pagamento`, `fornitore`, `note`, `centro_costo` (default `'generale'`), `org_id`, `giorni_preavviso`. Con GRANT + RLS per org come le altre tabelle.
4. Nuova `config_tipi_costo`: `ambito` (`autista` | `veicolo` | `generale`), `valore`, `ordine`, `attivo`, `org_id`. Seed con le voci richieste (Patente, Patente K, Permesso Civitavecchia, Visita medica, Altro / Bollo, Assicurazione, Licenza, Permesso ZTL, Rata finanziamento).
5. Vista unica `scadenze_costi` (autisti_spese + veicoli_spese + costi_generali) con: origine, riferimento (nome autista o TARGA - modello), tipo, data_scadenza, giorni_mancanti, stato (`ok` | `avviso` | `scaduto`). Usata da dashboard, campanella e Agenda: un solo motore di scadenze, nessun sistema doppio.
6. Job giornaliero (`pg_cron`, già in uso per l'agenda) che, per ogni scadenza entrata in finestra di preavviso, crea **una sola** notifica in `notifiche` (tipo `scadenza_costo`, dedup per riga + data).

## Schermate

Nuova voce di menu **Amministrazione → Inserisci Costi** (`/amministrazione/costi`), con tre tab.

1. **Autisti interni**: form Autista* | Tipo* | Data intervento | Data scadenza | Importo spese | Tipo di pagamento. Solo autista e tipo obbligatori. Sotto: ricerca + tabella (Autista, Tipo, Data intervento, Data scadenza, Importo spese, Totale fattura) con modifica/elimina riga.
2. **Spese Macchine**: form Macchina* ("TARGA - Modello", veicoli attivi) | Tipo Spese* | Data intervento | Tipo di pagamento | Importo spese | Note. Se il tipo è ricorrente (Assicurazione, Rata finanziamento, Bollo — configurabile) compare il blocco **Scadenze** con radio 3/6/12 mesi | Nessuno che calcola in automatico la data scadenza dalla data intervento (modificabile a mano). Tabella: Macchina, Tipo, Data intervento, Data scadenza, Importo, Totale fattura, Note, Fornitore.
3. **Altri Costi**: descrizione*, categoria, data, data scadenza (opzionale), importo, tipo di pagamento, fornitore, note.

Ogni tab con ricerca testuale, righe scadute in rosso e in scadenza in giallo, come già fa la scheda veicolo.

## Alert

- **Dashboard**: banner scadenze costi accanto all'alert manutenzione già presente, con click che porta alla riga.
- **Campanella**: notifica alla prima entrata in finestra di preavviso (default 30 giorni, configurabile per riga) e a scadenza superata.
- **Agenda**: le scadenze compaiono come livello "Scadenze" (categoria `scadenza` già esistente), in sola lettura, generate dalla vista — non duplicate come eventi salvati.

## Da confermare

- Confermi che "Spese Macchine" scriva sulle **stesse righe** già visibili nella scheda veicolo (quindi ciò che inserisci qui appare lì e viceversa)?
- Per "Altri Costi" serve anche il campo **data scadenza** (es. canone/abbonamento) — lo includo, dimmi se invece lo vuoi fuori.
- Preavviso: default 30 giorni globale + override per singola riga. Va bene?
