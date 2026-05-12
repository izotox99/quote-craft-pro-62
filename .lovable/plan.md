## Cosa sta succedendo davvero

Hai creato il cliente "Prova 1" (`provaazienda1@gmail.com`) e all'interno della scheda è stata salvata la password `MADmilionari1.`. Nel database tutto sembra corretto:

- Riga in `clients` con `auth_user_id` collegato.
- Utente in `auth.users` con email confermata.

Però quando provi il login da `/client-login` Supabase risponde `invalid_credentials` (lo si vede nei log auth) e poi parte il fallback su `utenza-login` che — giustamente — non trova nulla perché Prova 1 non è un'utenza, è un cliente "padre".

### Causa

Il salvataggio in `src/pages/Clients.tsx` ha due percorsi:

- **Creazione**: chiama l'edge function `create-client-account` che crea/collega l'utente `auth.users` con la password digitata. ✅
- **Modifica**: fa SOLO `UPDATE clients` sul DB. ❌ Non aggiorna mai email o password sull'utente `auth.users`.

Quindi se hai aperto "Modifica cliente" e hai (anche solo ri-)salvato la password, nel DB il campo `password_cliente` è "MADmilionari1." ma su `auth.users` è rimasta la password originale (o, se il primo salvataggio è stato fatto senza password e poi aggiunta in modifica, su `auth.users` non esiste proprio una password valida per quell'email). Risultato: `signInWithPassword` fallisce.

Stesso problema potenziale per l'email: se modifichi l'email del cliente, in `auth.users` resta quella vecchia.

C'è inoltre una piccola fragilità in `src/pages/ClientLogin.tsx`: dopo il login usa `.single()` per leggere il record `clients`, e se per qualunque motivo non lo trova (es. RLS o riga assente) butta l'utente sul fallback utenza, mascherando l'errore reale.

## Piano

### 1. Estendere l'edge function `create-client-account` a gestire anche gli update

Trasformarla in "upsert account":

- Input invariato: `email`, `password`, `client_id`, più un nuovo opzionale `mode: "create" | "update"`.
- Logica:
  - Se il client ha già `auth_user_id` → `auth.admin.updateUserById` per aggiornare email/password.
  - Se non ce l'ha ma esiste un utente `auth.users` con quell'email → collegalo e aggiorna la password.
  - Se non esiste → crealo come fa oggi (`account_type: "client"`, email confermata).
- Rate limit minimo per chiamata (verifica calling user è admin/manager dell'org del cliente).

### 2. Aggiornare `src/pages/Clients.tsx` (ramo modifica)

Dopo `UPDATE clients`, se è cambiata `email` e/o `password_cliente`:

- Se il cliente ha `email` valorizzata e una `password_cliente`, chiamare la edge function in modalità update.
- Mostrare toast specifici: "Account cliente aggiornato" / warning se la sync fallisce.
- In creazione resta tutto come ora.

### 3. Sistemare l'account "Prova 1" già esistente

Eseguire una sincronizzazione una‑tantum per allineare `auth.users` di `provaazienda1@gmail.com` alla password attuale `MADmilionari1.` (via service role, dentro una mini-procedura/edge call), così puoi loggarti subito senza dover ricreare il cliente.

### 4. Rinforzare `src/pages/ClientLogin.tsx`

- Sostituire `.single()` con `.maybeSingle()` sulla lookup `clients`.
- Se `signInWithPassword` ha successo ma non si trova né riga `clients` né `client_utenze`, mostrare un errore esplicito ("Account non collegato a un profilo cliente, contatta l'amministratore") invece di nascondere il problema.
- Lasciare invariato il fallback utenza per chi è davvero un'utenza.

### 5. Niente cambi di schema o RLS

Le policy `clients` permettono già al cliente di leggere il proprio record (`auth_user_id = auth.uid()`), e gli admin NCC vedono i clienti per `org_id`. Non serve toccarle.

## Dettagli tecnici

- File toccati: `supabase/functions/create-client-account/index.ts`, `src/pages/Clients.tsx`, `src/pages/ClientLogin.tsx`.
- Nessuna migrazione DB.
- L'aggiornamento password su `auth.users` avviene solo via service role nell'edge function, mai dal client.
- Validazioni: email formato valido, password min 6 caratteri (allineato a Supabase).
- Comportamento finale: ogni volta che salvi una password nella scheda cliente, l'account `auth.users` corrispondente viene allineato — niente più disallineamenti silenziosi.
