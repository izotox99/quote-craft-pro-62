# Modulo MAGAZZINO (dashboard NCC)

Nuovo menu "Magazzino" con 7 voci, dati isolati per organizzazione (org_id + RLS + GRANT + trigger + `can_write`), testi in italiano.

## 1. Tabelle

| Tabella | Campi principali |
|---|---|
| `fornitori_magazzino` | org_id, nome, telefono, email, indirizzo, note, attivo |
| `articoli` | org_id, nome, unita_misura (pz/litri/kg/set), fornitore_default_id → fornitori_magazzino, prezzo_unitario, scorta_minima, attivo |
| `ordini` | org_id, numero (progressivo per org), data, stato (`bozza`\|`convalidato`\|`ricevuto`\|`annullato`), fornitore_id, created_by, note |
| `ordini_righe` | ordine_id, org_id, tipo_consumo (`macchine`\|`consumo_interno`), veicolo_tipo, veicolo_id (nullable → veicoli), fornitore_id, articolo_id, quantita, unita, prezzo_unitario, note |
| `movimenti_magazzino` | org_id, articolo_id, tipo (`carico`\|`scarico`), quantita, data, ordine_riga_id, veicolo_id, consumo_interno bool, note, created_by |

Enum nuovi: `magazzino_ordine_stato`, `magazzino_tipo_consumo`, `magazzino_movimento_tipo`.

Vista `magazzino_giacenze`: per articolo → somma carichi − somma scarichi, con unità, scorta minima e flag `sotto_scorta`. Nessuna colonna denormalizzata.

Regole: eliminazione articolo/fornitore = disattivazione (`attivo=false`); i mezzi arrivano sempre da `veicoli` della stessa org.

## 2. Funzioni database (SECURITY DEFINER, con controllo `can_write`)

- `magazzino_prossimo_numero(_org)` — progressivo ordine per organizzazione.
- `magazzino_convalida_righe(_ordine_id, _riga_ids[])` — sposta le righe selezionate in ordini convalidati **raggruppati per fornitore** (un ordine convalidato per fornitore, numero nuovo); le righe non selezionate restano nella bozza.
- `magazzino_ricevi_ordine(_ordine_id)` — stato `ricevuto` + genera un movimento di **carico** per ogni riga (idempotente: niente doppi carichi).
- `magazzino_annulla_ordine(_ordine_id)`.
- `magazzino_registra_scarico(_articolo_id, _quantita, _data, _veicolo_id, _consumo_interno, _note)` — con blocco se la giacenza risultante andrebbe sotto zero (avviso, vedi punto ambiguo 4).

## 3. Schermate (menu "Magazzino" in `DashboardLayout`)

1. **Nuovo ordine** `/magazzino/nuovo-ordine` — form nell'ordine richiesto: Tipo Consumo → Tipo macchina (tipi presenti in `veicoli` + "Tutte le macchine") → Modello ("Modello - Targa", filtrato per tipo) → Fornitore (precompilato dal default dell'articolo) → Articolo → Unità (sola lettura) → Quantità → Note. Con "Consumo interno" i campi mezzo sono disattivati. "Aggiungi all'ordine" crea/riusa la bozza e inserisce la riga; tabella sotto con Consumo interno (SI/NO), Tipo macchina, Modello, Fornitore, Articolo, Quantità, X per rimuovere. In fondo "Aggiungi" e "Convalida ordine" (dialog con checkbox per riga).
2. **Lista ordine** `/magazzino/ordini` — ordini convalidati/ricevuti: numero, data, fornitore, n. righe, stato, totale (se prezzi valorizzati). Dettaglio con azioni "Segna come ricevuto" e "Annulla".
3. **Inserisci articolo** `/magazzino/articoli/nuovo`.
4. **Lista articoli** `/magazzino/articoli` — ricerca, modifica, disattivazione.
5. **Magazzino** `/magazzino` — giacenze per articolo con righe sotto scorta in rosso; pulsante "Registra scarico" (articolo, quantità, destinazione mezzo o consumo interno, data, note).
6. **Lista ins. usato** `/magazzino/usato` — cronologia scarichi con filtri periodo / articolo / mezzo.
7. **Ord consumo interno** `/magazzino/consumo-interno` — stessa lista ordini filtrata su `tipo_consumo = consumo_interno`.

In più: sezione **"Materiali utilizzati"** nella scheda veicolo (`VeicoloDettaglio.tsx`), con gli scarichi di quel mezzo.

Catalogo fornitori magazzino: gestito dentro Lista articoli (dialog "Fornitori magazzino"), senza una voce di menu aggiuntiva.

## 4. Punti ambigui — decisioni proposte, dimmi se cambiare

1. **Fornitori magazzino**: non hai chiesto una schermata dedicata; li gestisco in un dialog dalla Lista articoli. Vuoi invece una voce di menu?
2. **Ordini raggruppati per fornitore alla convalida**: la tua frase "(o gli ordini, raggruppati per fornitore)" la interpreto come: se le righe selezionate hanno fornitori diversi, si generano più ordini convalidati, uno per fornitore. Confermi?
3. **Tipo macchina "Tutte le macchine"**: lo tratto come riga senza `veicolo_id` (materiale generico per il parco mezzi), non come una riga per ogni veicolo. Confermi?
4. **Scarico oltre giacenza**: propongo di bloccarlo con messaggio chiaro ("Giacenza insufficiente"). Alternativa: permetterlo con giacenza negativa.
5. **Prezzi**: `prezzo_unitario` viene dall'articolo, copiato sulla riga alla creazione e modificabile lì; il totale ordine è la somma. Se non vuoi prezzi in ordine, li lascio solo in anagrafica.
6. **Carico manuale**: prevedo solo carichi da ordine ricevuto. Serve anche un carico manuale (rettifica inventario)?
7. **Permessi**: modulo visibile a tutti i membri dell'org; scrittura solo con `can_write` (i viewer vedono ma non modificano). Nessun accesso per autisti e portale clienti.
8. **`veicoli.visibile_magazzino`**: esiste già questo flag. Lo uso per filtrare i mezzi selezionabili nel modulo, oppure mostro tutti i veicoli attivi?

## 5. Verifica finale

Migrazioni applicate, controllo RLS cross-org (un'altra org non vede nulla), flusso completo: articolo → ordine bozza → convalida parziale → ricezione (carico) → scarico su mezzo → giacenza aggiornata → voce visibile in Lista ins. usato e nella scheda veicolo.
