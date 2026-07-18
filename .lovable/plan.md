# Piano: Documentazione tecnica completa del gestionale NCC

## Obiettivo

Produrre un unico documento Markdown (`/mnt/documents/gestionale-ncc-documentazione.md`) che descriva in modo esaustivo il gestionale, pensato per essere dato in pasto a Claude come contesto di progetto. Nessuna modifica al codice: solo lettura + scrittura del file.

## Cosa conterrà il documento

### 1. Panoramica generale
- Scopo del gestionale (NCC multi-tenant, portale cliente separato)
- Stack tecnico: React 18 + Vite + TS, Tailwind, shadcn/ui, React Router, TanStack Query, Supabase (Lovable Cloud), Edge Functions Deno
- Lingua UI: italiano
- Design system: Plus Jakarta Sans / DM Sans, mobile-first, stile Notion minimale

### 2. Architettura
- Multi-tenant per `org_id`; ogni NCC = una `organization`
- Separazione netta account NCC vs account cliente vs utenze cliente
- Ruoli: `admin`, `manager`, `agent` in `user_roles`
- Trigger `handle_new_user` → crea org + profile + ruolo admin al signup NCC
- Trigger `enforce_*_org_id` → forza `org_id` in insert su tabelle sensibili
- Funzioni `SECURITY DEFINER`: `has_role`, `is_client_user`, `get_user_org_id`, `get_client_org_id`, `get_active_utenza_id`, `hash_*_password`, `verify_*_password`

### 3. Autenticazione e accesso
- `/login` NCC (email/password + Google OAuth)
- `/signup`, `/forgot-password`, `/reset-password`
- `/client-login` clienti + utenze (edge function `utenza-login` per utenze)
- `ProtectedRoute` (NCC) e `ProtectedClientRoute` (portale)
- Flusso GDPR obbligatorio al primo accesso cliente
- Regole di isolamento: un account cliente non può entrare in dashboard NCC e viceversa

### 4. Moduli funzionali (dashboard NCC)
Per ognuno: pagine, tabelle DB usate, azioni CRUD, RLS principali, edge function collegate.

- **Servizi** (`/dashboard`): lista, filtri stato, assegnazione autista/mezzo/fornitore, flag `modificato_da_cliente`, notifiche, popover modifiche, scroll orizzontale ottimizzato macOS
- **Clienti** (`/clients` + sotto-pagine Tariffari, Valutazione, Accessori, Rappresentante, Note, In attesa, Preventivi, `/clients/:id`): creazione via edge function `create-client-account`, sync credenziali, eliminazione via `delete-client-account`, utenze figlie (`client_utenze`) con tipo singolo/gruppo
- **Mezzi** (`/veicoli` + dropdown: Allert, Bilancio, Manutenzione straord., Carburante, AdBlue, Aggiungi AdBlue, dettaglio `/veicoli/:id`): tabella con voucher, disattivazione, foto, sezioni Documenti/Gasolio/Manutenzione ord/straord/Spese, VoucherDialog giornaliero PDF
- **Autisti** (`/autisti`, `/autisti/collaboratori`): interni + esterni, spese
- **Fornitori CS** (`/fornitori`)
- **Impostazioni** (`/settings`): dati azienda, P.IVA, sede legale, branding

### 5. Portale cliente (`/client-portal`)
- Lista servizi con stato, modifiche via RPC `client_portal_update_servizio`
- Prenota: form unica pagina con Quando/Dove/Servizio/Passeggero/Pagamento, tipologie (Transfer interno, regionale, Tour), disposizione oraria opzionale sui transfer, rubrica passeggeri con combobox
- Utenze: gestione sub-account
- Tariffario, Fatture

### 6. Schema database (tabelle principali)
Elenco delle 25+ tabelle con scopo, colonne chiave e RLS in sintesi:
`organizations, profiles, user_roles, clients, client_utenze, servizi, servizi_modifiche, autisti, autisti_esterni, autisti_spese, veicoli, veicoli_documenti, veicoli_gasolio, veicoli_manutenzione_ord, veicoli_manutenzione_straord, veicoli_spese, fornitori_cs, departments, notifiche, passeggeri_rubrica, proposals, proposal_versions, proposal_events, line_items, templates, audit_logs`.

### 7. Edge Functions
- `create-client-account`: upsert credenziali, validazioni email cross-org
- `delete-client-account`: elimina cliente + auth user
- `utenza-login`: login con password sintetica ricalcolata da hash
- `ai-content`: rifinitura contenuti via Lovable AI Gateway
- `verify-hibp-protection`, `verify-share-password`

### 8. Sicurezza
- RLS su tutte le tabelle pubbliche, GRANT espliciti
- SECURITY DEFINER per check ruoli/org (no ricorsione)
- Password hash con `pgcrypto` (bcrypt) per utenze e share
- No password in chiaro nel DB (`clients.password_cliente` deprecata)
- Rate limiting e JWT su edge function critiche

### 9. Trigger e logica automatica servizi
- `servizi_state_sync`: assegnazione autista → `confermato`; modifica da cliente → `nuovo` + flag
- `log_servizi_client_changes`: diff campi in `servizi_modifiche`
- `notify_servizio_client_change`: inserimento in `notifiche`
- `cleanup_servizi_annullati`: purge dopo 7gg annullati, 30gg notifiche

### 10. Convenzioni UI/UX
- Componenti shadcn, layout `DashboardLayout` + `ClientPortalLayout`
- Notifiche via `NotificheBell`, tooltip modifiche via `ModificheClientePopover`
- Assegnazione autista via `AssignDriverPopover`
- Hook `use-horizontal-wheel` per scroll trackpad

### 11. Routing completo
Tabella di tutte le route con guardia, componente, scopo.

### 12. Storage buckets
`logos`, `tariffari-autisti`, `servizi-allegati`, `veicoli-foto` (public), `veicoli-documenti`.

### 13. Note operative per Claude
Regole d'oro del progetto (dalle memorie): italiano sempre, UX minimale, isolamento per org, non toccare `client.ts`/`types.ts`, RLS + GRANT ovunque.

## Come procederò (in build mode)

1. Leggere i file chiave che non sono ancora in contesto per non inventare dettagli: `Servizi.tsx`, `Clients.tsx`, `Veicoli.tsx`, `VeicoloDettaglio.tsx`, `client-portal/*`, `Settings.tsx`, `DashboardLayout.tsx`, tutte le edge function, `types.ts` (per schema tabelle), pagine autisti/fornitori.
2. Interrogare il DB per policies/columns effettive delle tabelle principali via `supabase--read_query`.
3. Scrivere il documento finale in `/mnt/documents/gestionale-ncc-documentazione.md` (Markdown strutturato con TOC, ~40-60 pagine).
4. Esporre il file con `<presentation-artifact>` per download immediato.

Nessuna modifica al codice sorgente, nessuna migration. Solo lettura + generazione documento.

## Domanda prima di procedere

Vuoi il documento **in italiano** (coerente col resto del progetto) o **in inglese** (a volte Claude ragiona meglio su documentazione tecnica in inglese)? Se non rispondi, procedo in italiano.
