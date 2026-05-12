Ho verificato il motivo dell’errore: l’account attualmente loggato (`michele.santamaria99@gmail.com`) non ha un profilo aziendale NCC (`profiles` + `org_id` + ruolo), perché in database risulta già collegato come cliente a “Terramà Sas”. Per sicurezza, il trigger dei veicoli blocca l’inserimento quando manca l’azienda NCC, quindi compare “Account NCC non configurato”.

Piano di correzione:

1. Sistemare l’account attuale
   - Creare/collegare un’organizzazione NCC dedicata per l’utente loggato.
   - Inserire il profilo aziendale mancante.
   - Assegnare il ruolo `admin` all’utente.
   - Non spostare né mischiare i dati cliente esistenti: il record cliente “Terramà Sas” resta separato e appartiene alla sua organizzazione attuale.

2. Rendere il riconoscimento account più sicuro
   - Aggiornare la logica backend che decide se un utente è “cliente” o “NCC”, così un account con ruolo/profilo NCC viene trattato come NCC anche se in passato era stato collegato a un cliente.

3. Verificare l’inserimento veicoli
   - Dopo la migrazione, l’inserimento di una nuova macchina userà automaticamente l’`org_id` dell’NCC loggato.
   - I veicoli resteranno visibili solo all’organizzazione di quell’NCC, senza mix tra account diversi.

Dettagli tecnici:
- Intervento via migrazione database.
- Nessuna modifica al file client auto-generato.
- Manteniamo RLS e trigger di isolamento dati attivi: non verranno allentate le policy di sicurezza.