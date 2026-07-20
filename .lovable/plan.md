# Fase 4 — Assenze, ferie e calendario condiviso

Sistema per gestire ferie/riposi/permessi/malattia degli autisti con controlli di copertura server-side, calendario condiviso a privacy minima e workflow di approvazione dal titolare.

## 1. Database

### Nuove tabelle

**`public.config_assenze`** (una riga per org)
- `org_id uuid PK` → `organizations.id`
- `max_riposi_mese int NOT NULL DEFAULT 4`
- `max_ferie_mese int NOT NULL DEFAULT 10`
- `max_permessi_mese int NOT NULL DEFAULT 2`
- `min_autisti_disponibili_giorno int NOT NULL DEFAULT 1`
- `created_at`, `updated_at`
- RLS: SELECT/UPDATE per membri org; INSERT solo admin/manager.

**`public.autisti_assenze`**
- `id uuid PK`, `org_id uuid NOT NULL`, `autista_id uuid NOT NULL` → `autisti.id`
- `tipo` enum `assenza_tipo` = (`ferie`, `riposo`, `permesso`, `malattia`)
- `data_inizio date NOT NULL`, `data_fine date NOT NULL` (CHECK `data_fine >= data_inizio` — costante, ok)
- `motivazione text`, `note_ufficio text`
- `stato` enum `assenza_stato` = (`richiesta`, `approvata`, `rifiutata`, `annullata`) DEFAULT `richiesta`
- `richiesta_da uuid` (auth.uid dell'autista o dell'ufficio se inserita manualmente)
- `deciso_da uuid`, `deciso_at timestamptz`
- `origine` text ('autista' | 'ufficio')
- Timestamps + trigger `updated_at`.
- Indici su `(org_id, data_inizio, data_fine)`, `(autista_id, stato)`.

**Estensioni su `autisti`** (override per singolo autista, nullable)
- `max_riposi_mese int`, `max_ferie_mese int`, `max_permessi_mese int`.
  Se NULL → vale il default di `config_assenze`.

### Enum

```sql
CREATE TYPE assenza_tipo AS ENUM ('ferie','riposo','permesso','malattia');
CREATE TYPE assenza_stato AS ENUM ('richiesta','approvata','rifiutata','annullata');
```

### GRANT + RLS

- `config_assenze`: SELECT a `authenticated` con USING org membership (NCC) OR autista dell'org (per leggere la soglia). UPDATE/INSERT solo admin/manager della stessa org.
- `autisti_assenze`:
  - SELECT: membri NCC dell'org **OR** autista dell'org (per il calendario condiviso — restituisce solo righe della propria org).
  - INSERT/UPDATE lato client bloccati: tutte le mutazioni passano dalle funzioni SECURITY DEFINER sotto.
  - Nessuna DELETE diretta (soft state `annullata`).

## 2. Funzioni SECURITY DEFINER

Tutte con `SET search_path = public`, revocate a `PUBLIC` e concesse solo ad `authenticated`.

### `assenze_get_effective_limits(_autista_id uuid) → jsonb`
Restituisce `{max_riposi, max_ferie, max_permessi, min_disponibili}` risolvendo override → default org.

### `assenze_conteggia_mese(_autista_id uuid, _tipo assenza_tipo, _anno int, _mese int) → int`
Conta giorni **effettivi** (somma `data_fine - data_inizio + 1` intersecati col mese) per stato in (`richiesta`,`approvata`) escludendo un eventuale `_exclude_id`.

### `assenze_copertura_giorno(_org uuid, _giorno date) → jsonb`
Restituisce:
- `autisti_attivi` = COUNT autisti attivi dell'org
- `assenti_approvati` = distinct autisti con assenza approvata che copre il giorno
- `assenti_in_attesa` = distinct autisti con richiesta pendente
- `disponibili` = attivi - approvati
- `min_richiesto` da config
- `pieno` boolean

### `richiedi_assenza(_tipo, _data_inizio, _data_fine, _motivazione) → autisti_assenze`
Chiamata dall'autista.
Controlli:
- (a) plafond mensile per tipo (ferie e riposi separati; permesso separato; malattia esente).
- (b) per ogni giorno del range, verifica che approvate + questa nuova non porti `disponibili` < `min`. Se sì → EXCEPTION con messaggio `Giorno YYYY-MM-DD pieno. Assenti: <elenco nome + tipo>` (nomi dei colleghi già prenotati approvati/in_attesa).
- Malattia: bypassa (a) e (b), viene creata direttamente **approvata** e genera notifica `assenza_malattia` al titolare.
- Altrimenti inserisce `stato='richiesta'` e notifica il titolare (`assenza_richiesta`).

### `approva_assenza(_id, _note_ufficio)` / `rifiuta_assenza(_id, _note_ufficio)`
Solo admin/manager dell'org. All'approvazione rifà il controllo (b) sui giorni residui (situazione può essere cambiata). Se non passa → EXCEPTION esplicativa. Notifica autista. Alla transizione ad `approvata`, se un giorno raggiunge esattamente il limite (`disponibili == min_richiesto`), genera `assenza_giorno_pieno` al titolare.

### `inserisci_assenza_ufficio(_autista_id, _tipo, ...)` 
Solo admin/manager. Crea direttamente `approvata` (con stessi controlli hard, ma con parametro `_force boolean` opzionale per override esplicito del min copertura, tracciato in `note_ufficio`).

### `annulla_assenza(_id)`
Autista può annullare le proprie `richiesta`. Ufficio può annullare qualsiasi assenza della propria org (soft → `annullata`).

## 3. UI

### Dashboard NCC — Configurazione (`/impostazioni` o sezione dedicata)
- Blocco "Assenze e copertura": max ferie/mese, max riposi/mese, max permessi/mese, min autisti disponibili/giorno.
- Nel form autista (`NuovoAutistaDialog`) aggiungere sezione "Limiti personali (opzionali)" con i 3 override.

### Dashboard NCC — nuova pagina `/autisti/assenze`
- Tab **Richieste in attesa**: lista con autista, tipo, range, motivazione, azioni Approva/Rifiuta (+ textarea nota).
- Tab **Calendario copertura**: vista mensile con per ogni giorno badge `assenti/attivi` e evidenza giorni al limite/pieni. Click → dialog con elenco assenti (nome, tipo, stato) e pulsante "Inserisci assenza manuale".
- Tab **Storico**: filtrabile per autista/tipo/stato.

### Agenda NCC esistente
- Nuovo livello "Assenze autisti" (checkbox layer): eventi generati dalle `autisti_assenze` approvate, colore per tipo, titolo `NomeAutista — Tipo`.

### App autista — nuova sezione `/autista/ferie`
Layout mobile-first:
- **Calendario mensile** (griglia semplice, no libreria pesante): ogni cella mostra `n/N` (assenti/disponibili). Codifica:
  - verde: disponibile
  - giallo: quasi al limite (disponibili = min)
  - rosso: pieno
  - grigio: passato
- Tap su un giorno → sheet con lista `Nome — Tipo` (solo questo, nessun altro dato) e, se giorno non pieno, pulsante "Richiedi assenza da questo giorno".
- Form richiesta: tipo, data_inizio, data_fine (default giorno tappato), motivazione. Invio → `richiedi_assenza`. Errori server mostrati nel toast.
- Sotto: **Le mie richieste** (lista con stato colorato, possibilità di annullare le pendenti).
- **Contatori personali del mese corrente**: "Riposi: X di Y — Ferie: X di Y — Permessi: X di Y" via `assenze_get_effective_limits` + `assenze_conteggia_mese`.

### Voce menu app autista
Aggiungere "Ferie" nel `AutistaLayout` (sostituendo o affiancando il placeholder Opzioni al bisogno).

## 4. Notifiche (usano `public.notifiche` esistente)

| Evento | Destinatario | tipo |
|---|---|---|
| Richiesta creata | org (titolare) | `assenza_richiesta` |
| Approvata | autista (via notifica org + client filter, oppure canale futuro) | `assenza_approvata` |
| Rifiutata | autista | `assenza_rifiutata` |
| Giorno raggiunge limite | org | `assenza_giorno_pieno` |
| Malattia registrata | org | `assenza_malattia` |

Le notifiche destinate all'autista useranno `autista_id` in un nuovo campo o passeranno via `notifiche.utenza_id`; per non allargare lo schema di `notifiche`, aggiungiamo colonna nullable `autista_id uuid` a `notifiche` (piccola migration) e la `NotificheBell` dell'app autista già interroga per `autista_id = get_autista_id(auth.uid())`.

## 5. Sicurezza / privacy

- Calendario condiviso: l'autista chiama una funzione dedicata `assenze_calendario_mese(_anno, _mese)` (SECURITY DEFINER) che ritorna **solo** `giorno`, `autista_nome`, `tipo`, `stato in (approvata, richiesta)` per la propria org. Nessun `id`, nessun contatto, nessun dato economico.
- Le policy RLS su `autisti_assenze` per il ruolo autista sono più permissive di quanto serve → per sicurezza il client autista **non** interroga la tabella direttamente; usa esclusivamente le funzioni. Le policy SELECT per autista possono comunque essere strette a `autista_id = get_autista_id(auth.uid())` (solo le proprie righe) e il calendario condiviso passa dalla funzione.
- Tutte le funzioni: `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE TO authenticated;` e controllo esplicito ruolo/appartenenza autista all'inizio.

## 6. Piano di rollout

1. Migration: enum, tabelle, override su `autisti`, colonna `autista_id` su `notifiche`, GRANT, RLS, funzioni, trigger `updated_at`.
2. Seed: riga `config_assenze` per ogni org esistente con i default (Fabio: `min = 7`).
3. UI dashboard NCC: sezione Configurazione + pagina `/autisti/assenze` + hook agenda.
4. UI app autista: pagina `/autista/ferie` + voce menu + integrazione notifiche.
5. Verifica end-to-end: richiesta → limite plafond → limite copertura → approvazione con ricontrollo → malattia diretta → visualizzazione calendario condiviso a privacy minima.

Confermi il piano così com'è o vuoi cambiare qualcosa (es. nomi enum, gestione permessi, comportamento del force-override lato ufficio)?
