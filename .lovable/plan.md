Obiettivo: ogni NCC deve vedere solo i propri dati: clienti, utenze clienti, servizi, mezzi, autisti, fornitori, preventivi/template e allegati devono appartenere a un’unica organizzazione/account. I nuovi account non devono più ereditare o vedere dati già presenti.

## Piano di correzione

1. **Separare davvero gli account NCC alla registrazione**
   - Alla creazione di un nuovo account NCC verrà creata automaticamente una nuova organizzazione dedicata.
   - Il nuovo utente diventerà admin solo della propria organizzazione.
   - Non verrà più usata l’organizzazione predefinita condivisa per i nuovi account.

2. **Bloccare il default condiviso che causa il mix di dati**
   - Rimuovere i valori predefiniti fissi tipo `00000000-0000-0000-0000-000000000001` dai dati operativi.
   - Aggiungere protezioni lato database: quando un NCC crea un record, il record viene collegato solo alla sua organizzazione.
   - Se un record tenta di essere salvato con un’organizzazione diversa da quella dell’utente, viene rifiutato.

3. **Correggere la creazione di clienti e utenze clienti**
   - Gli account cliente/utenza non dovranno essere trattati come account NCC.
   - La funzione che crea l’accesso cliente verrà aggiornata per marcare l’utente come “cliente”, evitando la creazione automatica di profilo NCC/ruolo interno.
   - Le utenze dei clienti resteranno sempre collegate al cliente padre e quindi all’NCC proprietario.

4. **Aggiornare le schermate che salvano dati**
   - Clienti, servizi, mezzi, autisti, collaboratori, fornitori, template e preventivi useranno l’organizzazione dell’utente loggato invece del valore fisso condiviso.
   - Anche upload come foto mezzi e tariffari autisti verranno salvati con percorso separato per organizzazione.

5. **Sistemare i dati già esistenti**
   - I dati creati da un utente specifico verranno ricollegati alla sua organizzazione dedicata quando il proprietario è riconoscibile.
   - I dati storici senza proprietario chiaro resteranno assegnati solo all’account originale/admin, così i nuovi account non li vedranno più.
   - Gli account cliente già creati che hanno ricevuto per errore un ruolo/profilo interno verranno ripuliti, così restano clienti e non membri NCC.

6. **Verifica finale**
   - Controllare che un account NCC nuovo veda dashboard/liste vuote.
   - Controllare che ogni tabella operativa filtri per organizzazione.
   - Controllare che clienti e utenze cliente vedano solo i servizi del proprio NCC.
   - Eseguire un controllo sicurezza sulle regole di accesso del database.

## Dettagli tecnici

- Modifica della funzione database `handle_new_user` per creare una nuova riga in `organizations` per ogni signup NCC.
- Uso di metadata di signup per distinguere `ncc` da `client`.
- Trigger/funzioni di guardia su tabelle con `org_id`: `clients`, `servizi`, `veicoli`, `autisti`, `autisti_esterni`, `fornitori_cs`, `templates`, `proposals`, `passeggeri_rubrica`, dove necessario.
- Aggiornamento delle insert lato app in `Clients`, `Servizi`, `Veicoli`, `NuovoAutistaDialog`, `FornitoriCS`, `Templates`, `ProposalBuilder`.
- Aggiornamento della funzione `create-client-account` per creare utenti cliente senza ruolo NCC.
- Migrazione dati controllata per separare gli account esistenti senza cancellare dati.