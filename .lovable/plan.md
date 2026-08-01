# Accesso multi-utente alla tua organizzazione NCC

Obiettivo: invitare altre persone (socio, collaboratore) nella TUA organizzazione con un ruolo, senza condividere credenziali. Ogni loro modifica è visibile a te perché lavorano sugli stessi dati dell'org. Nessun accesso ad altre organizzazioni.

## Ruoli

| Ruolo | Legge | Scrive | Gestisce membri |
|---|---|---|---|
| Titolare (owner) | tutto della sua org | sì | sì (unico) |
| Admin invitato | tutto della sua org | sì | no |
| Visualizzatore (viewer) | tutto della sua org | no | no |

Il titolare è l'utente che ha creato l'organizzazione: non è rimovibile e non può essere declassato.

## 1. Migrazioni database (in due passaggi)

Migrazione A (isolata, obbligatoria per Postgres):
- `ALTER TYPE app_role ADD VALUE 'viewer'`.

Migrazione B:
- Funzione `public.can_write(_user uuid)` (SECURITY DEFINER, STABLE): vero se l'utente ha ruolo `admin` o `manager` nella propria org; falso per `viewer`.
- Funzione `public.is_org_owner(_user uuid)`: vero solo per il creatore dell'organizzazione (nuova colonna `organizations.owner_user_id`, valorizzata retroattivamente con il primo profilo/admin dell'org).
- Riscrittura delle policy di scrittura elencate sotto: si aggiunge `AND public.can_write(auth.uid())` a USING e WITH CHECK. Le policy di SELECT restano invariate (tutti i membri leggono).

### Tabelle e policy di scrittura da modificare (lato ufficio/org)

accessori_catalogo, agenda_eventi, autisti, autisti_carte, autisti_esterni, autisti_feedback (policy ufficio), autisti_ore (ramo ufficio), autisti_presenze (ramo ufficio), autisti_spese (policy org), clients, client_utenze (policy org), comunicazioni, config_assenze, departments, fornitori_cs, link_utili, notifiche (update/delete), organizations (update), passeggeri_rubrica (policy org), servizi, servizi_accessori, templates, veicoli, veicoli_documenti, veicoli_gasolio, veicoli_manutenzione_ord, veicoli_manutenzione_straord, veicoli_spese.

Non toccate (non appartengono al perimetro ufficio): policy degli autisti su sé stessi, portale clienti/utenze, `autisti_preferenze`, `autisti_veicolo_sessioni`, `comunicazioni_letture`, `dashboard_viste` (preferenze personali, un viewer può salvarsi le proprie viste), proposals/line_items/templates personali, tabelle di log in sola lettura.

### RPC ed edge function

Tutte le funzioni SECURITY DEFINER che scrivono per conto dell'ufficio ricevono un controllo iniziale `if not public.can_write(auth.uid()) then raise exception 'Permesso negato: sola lettura'`. In elenco: `approva_assenza`, `rifiuta_assenza`, `annulla_assenza`, `inserisci_assenza_ufficio`, `network_dispatch_servizio`, `network_withdraw_servizio`, `network_invite_partner`, `network_respond_invite`, `network_revoke_partnership`, `veicolo_tagliando_eseguito`, `client_portal_update_servizio` (solo ramo ufficio se presente).

Le edge function che scrivono con privilegi elevati (`create-client-account`, `delete-client-account`, `create-artista-account`, invito membri) verificano il JWT del chiamante e negano se non `can_write` (per l'invito membri: solo owner).

## 2. Invito dei membri

Nuova edge function `invite-org-member` (stesso pattern di `create-client-account`):
1. Valida il JWT del chiamante e verifica che sia il titolare dell'org.
2. Rifiuta se l'email è già usata da un cliente, un'utenza cliente, un autista o da un membro di un'altra org (errore chiaro e specifico).
3. Se l'email non esiste: crea l'utente con password casuale non mostrata e invia un'email di invito/reset per impostarla. Se esiste già come utente NCC senza org: lo collega.
4. Crea `profiles` con il TUO `org_id` e una riga in `user_roles` con il ruolo scelto (`admin` o `viewer`).

Altre funzioni della stessa edge function (solo owner): cambio ruolo, revoca accesso (rimozione da `profiles`/`user_roles`; il titolare non è mai rimovibile).

## 3. UI — Impostazioni > Team

Nuova pagina `/impostazioni/team`, visibile solo al titolare: elenco membri (nome, email, ruolo, ultimo accesso), invito per email con scelta ruolo, cambio ruolo inline, revoca con conferma.

Per i viewer: hook `usePermessi()` che espone `canWrite`. I pulsanti di creazione/modifica/eliminazione (Nuovo servizio, assegnazioni autista/veicolo, elimina, azioni bulk, moduli veicoli/clienti/autisti) vengono nascosti o disabilitati con badge "Sola lettura". La barriera reale resta comunque la RLS.

## 4. Verifica

- Test SQL con `set local role authenticated` e JWT simulato di un viewer: INSERT/UPDATE/DELETE su `servizi`, `clients`, `veicoli`, `autisti` devono fallire con errore RLS; SELECT deve funzionare.
- Chiamata diretta alle RPC (`approva_assenza`, `network_dispatch_servizio`) come viewer: errore "Permesso negato".
- Chiamata diretta all'edge function `create-client-account` come viewer: 403.
- Test browser: login viewer → tabella servizi visibile, pulsanti di scrittura assenti; login admin invitato → può modificare e la modifica è visibile al titolare.
- Un membro invitato non vede dati di altre organizzazioni (query di controllo cross-org a risultato vuoto).
