Obiettivo: far apparire la tabella Servizi il più possibile come nello screenshot del vecchio gestionale: colonne separate da bordi sottili, testo compatto ma leggibile, nessuno spazio laterale/gap inutile tra una colonna e l'altra.

Piano di intervento:

1. Ripristinare intestazioni leggibili come nello screenshot
   - Usare label brevi ma non eccessivamente ridotte: “Città”, “Data servizio”, “Società”, “Contatti”, “Telefono”, “N.P”, “N.B”, “T.Serv”, ecc.
   - Evitare intestazioni a una sola lettera dove non serve, perché nello screenshot le colonne sono compatte ma riconoscibili.

2. Eliminare il finto “spazio” tra colonne
   - Passare a una resa più simile a foglio gestionale legacy: `border-collapse: collapse`, bordi verticali visibili su ogni cella e zero gap tra colonne.
   - Rimuovere padding orizzontale quasi del tutto: celle con `px-[1px]` o `px-0` dove possibile.
   - Ridurre padding interno di badge, pulsanti, autista/network e altri elementi che oggi creano aria dentro le celle.

3. Ricalibrare le larghezze per assomigliare allo screenshot
   - Dare più spazio alle colonne testuali lunghe: Società, Contatti, Telefono, Luogo inizio, Itinerario, Luogo fine, CS, Codice.
   - Comprimere molto le colonne numeriche e operative: N.P, N.B, T.P, No Inc €, Inc €, CS €, Aut €, C.C €, Com €, Foglio.
   - La checkbox resterà minima o verrà resa praticamente invisibile in larghezza rispetto alla tabella.

4. Cambiare il comportamento del contenuto nelle celle
   - Usare wrapping compatto come nello screenshot, non solo `truncate` ovunque.
   - Rendere font e line-height più simili al gestionale legacy: testo piccolo, grassetto/italico dove già usato, righe più dense.
   - Evitare che elementi interni come badge e pulsanti allarghino visivamente la colonna.

5. Verifica finale su preview
   - Controllare a 1280px che la tabella occupi tutta la larghezza, non abbia scroll orizzontale e mostri tutte le colonne della vista Completa.
   - Verificare visivamente che l’effetto sia quello dello screenshot: colonne attaccate tra loro con separatori verticali, non “spaziate”.

File interessati:
- `src/pages/Servizi.tsx`
- `src/lib/servizi-columns.ts`