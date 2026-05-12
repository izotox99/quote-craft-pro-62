## Obiettivo

Rendere strutturalmente impossibili i disallineamenti tra le schede cliente/utenza e le credenziali reali in `auth.users`, oltre a chiudere alcuni rischi correlati che oggi possono mordere in futuro (password in chiaro, account orfani, email "rubate" da account NCC, ecc.).

## Cosa NON cambia

- Le utenze (`client_utenze`) non hanno problemi di disallineamento: l'edge function `utenza-login` ricalcola la password sintetica a ogni accesso usando `password_hash`. Le lascio così.
- Le RLS attuali su `clients`, `client_utenze`, `servizi`, `proposals` restano invariate.

## Interventi

### 1. Hardening dell'edge function `create-client-account`

Aggiungo validazioni che oggi mancano e che potrebbero generare nuovi casi tipo "Prova 1":

- **Email già usata da un account NCC** (presente in `profiles` o `user_roles`) → errore esplicito, niente collegamento.
- **Email già usata da un'altra utenza** (`client_utenze.auth_user_id` con quella mail sintetica? no, controllo per email reale via metadata) → errore esplicito.
- **Email già assegnata a un altro `clients`** (anche in altra org) → errore esplicito.
- Risposte con `code` strutturato (`email_taken_ncc`, `email_taken_client`, `client_not_found`, ecc.) per messaggi UI puliti.

### 2. Eliminazione cliente "pulita"

Oggi `delete from clients` lascia l'utente orfano in `auth.users`. Se poi si ricrea un cliente con la stessa email, il vecchio auth user viene riciclato con eventuale password obsoleta.

- Nuova edge function `delete-client-account`:
  - Verifica che il chiamante sia admin/manager dell'org del cliente.
  - Recupera `auth_user_id`, elimina il record `clients`, poi cancella l'utente in `auth.users` solo se non è collegato ad altre risorse.
- `Clients.tsx`: il bottone elimina chiama questa function invece del `delete` diretto.

### 3. Stop alla password in chiaro nel DB

`clients.password_cliente` oggi memorizza la password in chiaro. È un problema di sicurezza e una fonte di confusione (la fonte di verità deve essere `auth.users`).

- Migration: la colonna viene **svuotata e marcata come deprecata** (commento SQL); in alternativa, se preferisci, possiamo droparla. Per non rompere niente la lascio in DB ma smetto di scriverci la password reale.
- `Clients.tsx`:
  - Campo "Password" diventa "Imposta/Cambia password" e in modifica si presenta vuoto con placeholder `••••••••`.
  - Se vuoto in modifica → password invariata. Se compilato → sync via edge function.
  - In creazione resta obbligatoria.
  - Non si scrive più la password in chiaro su `password_cliente` (resta `null`).

### 4. Self-healing nel login cliente

`ClientLogin.tsx`:

- Se `signInWithPassword` fallisce ma esiste in `clients` un record con quell'email **senza** `auth_user_id`, mostrare: "Account non ancora attivato — chiedi al tuo NCC di completare la configurazione".
- Aggiungere link "Hai dimenticato la password?" che usa `resetPasswordForEmail` (verifica preventiva: l'email deve appartenere a un cliente o utenza, altrimenti errore generico per non leakare).

### 5. Allineamento "una sola via" dei cambi credenziali

Documentare e blindare a livello codice:

- L'unico modo lecito per cambiare email/password di un cliente è la edge function `create-client-account` (ora di fatto un upsert).
- L'unico modo per eliminarlo è `delete-client-account`.
- Tutte le altre scritture su `clients` non toccano credenziali.

### 6. Verifica finale

- Esegui linter Supabase.
- Test manuale dei 4 flussi: crea cliente, modifica email, modifica password, elimina cliente. Per ognuno: login dal portale cliente con le ultime credenziali → deve funzionare; login con le credenziali vecchie → deve fallire.

## Dettagli tecnici

- File modificati: `supabase/functions/create-client-account/index.ts`, nuovo `supabase/functions/delete-client-account/index.ts`, `src/pages/Clients.tsx`, `src/pages/ClientLogin.tsx`.
- Migration leggera (commenti su colonna deprecata, nessun drop distruttivo). Se preferisci dropparla del tutto, lo facciamo in una seconda migration dopo che ti sei accertato che nessuno legga più quella colonna.
- Nessuna modifica RLS, nessun cambio per utenze e servizi.
- Scope volutamente fuori dal piano: tutta la parte Mezzi/voucher e qualunque modifica UI non legata a credenziali cliente.

Confermami se ti va bene così — soprattutto la parte "non scrivere più la password in chiaro nel DB e svuotare i valori esistenti": è il cambiamento più importante per non avere più sorprese.
