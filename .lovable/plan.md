
# Piano: Semplificare la prenotazione con wizard a step

## Obiettivo
Trasformare il form attuale (single-page, ~10 campi visibili insieme) in un **wizard a 5 step guidati** mantenendo **gli stessi identici dati richiesti** dal database. Aggiungere due scorciatoie per ridurre il lavoro ripetitivo: **"Duplica ultima prenotazione"** e **autocomplete passeggero** dalla rubrica.

Nessuna modifica al database — solo riorganizzazione UI/UX della pagina `src/pages/client-portal/Prenota.tsx`.

---

## 1. Struttura del wizard (5 step)

In cima alla pagina: barra di progresso minimale stile Notion (`Step 2 di 5 · Tragitto`) + bottoni `Indietro` / `Continua` in basso. Ogni step mostra solo i campi di quella sezione, validati prima di procedere.

| # | Titolo step | Campi inclusi |
|---|---|---|
| 1 | **Quando** | `data_servizio`, `ora_inizio` |
| 2 | **Dove** | `citta`, `luogo_inizio` (con detection aeroporti/stazioni esistente), `luogo_fine`, `itinerario` |
| 3 | **Servizio** | `tipologia` (Transfer interno / regionale / Tour), `tour_tipo` (se Tour), `veicolo_tipo`, `n_passeggeri`, `n_bagagli`, `accessori` |
| 4 | **Passeggero** | `contatto` (nome), `telefono_contatto`, `email_contatto` — con **autocomplete dalla rubrica `passeggeri_rubrica`** |
| 5 | **Riepilogo & extra** | `tipo_pagamento`, `info_autista`, `note`, allegato → riepilogo completo + pulsante **"Conferma prenotazione"** |

**Validazione per step**: blocca `Continua` se mancano i campi obbligatori (es. step 1: data + ora; step 2: città + luogo inizio; step 4: nome contatto).

---

## 2. Pulsante "Duplica ultima prenotazione"

In cima alla pagina (sopra lo step 1), card compatta:

```
┌─────────────────────────────────────────────────┐
│ 🔄  Ripeti l'ultima prenotazione                │
│     Transfer interno · Roma · 18 apr 2026       │
│     [ Duplica e modifica ]                      │
└─────────────────────────────────────────────────┘
```

**Logica**:
- Al mount, query `servizi` filtrata per `client_id` o `utenza_id` corrente, `order by created_at desc limit 1`.
- Se esiste, mostra la card con un riassunto (tipologia + città + data).
- Click su "Duplica e modifica" → precompila **tutti** i campi del wizard tranne `data_servizio` (default = oggi) e `ora_inizio` (svuotato), poi salta direttamente allo **step 5 (riepilogo)** così l'utente verifica e conferma. Può tornare indietro con `Indietro` se vuole cambiare qualcosa.
- L'allegato NON viene duplicato (file diverso ogni volta).

---

## 3. Autocomplete passeggero (step 4)

Nel campo `contatto` dello step 4: mentre l'utente digita, mostra suggerimenti dalla rubrica `passeggeri_rubrica` (già esistente, con RLS per parent client e utenze).

- Input con dropdown sotto (stessa estetica del `LuogoField` esistente).
- Al click su un passeggero: precompila automaticamente nome, telefono, email.
- Sotto l'input: link `+ Salva nuovo passeggero in rubrica` se il nome digitato non esiste già — al submit del wizard, viene anche inserito in `passeggeri_rubrica` (oltre che salvato nel servizio).

---

## 4. UI/UX dettagli

- **Header wizard**: titolo grande step corrente + sottotitolo grigio (es. *"Quando vuoi il servizio?"*) + barra di progresso a 5 segmenti (Plus Jakarta Sans, in linea con il design system Notion-like del progetto).
- **Footer fisso**: `[← Indietro]` a sinistra, `[Continua →]` a destra. All'ultimo step diventa `[Conferma prenotazione]` con icona `Send`.
- **Animazione step**: fade + slide-in da destra (`animate-in fade-in-0 slide-in-from-right-2`) quando si avanza, viceversa quando si torna indietro.
- **Mobile**: stesso layout (già single-column), footer sticky in basso.
- **Riepilogo step 5**: mostra tutti i dati raccolti in una card a 2 colonne con etichette grigie + valori in grassetto, e link "Modifica" accanto a ciascuna sezione che riporta allo step relativo.

---

## 5. Implementazione tecnica

**File modificato**: `src/pages/client-portal/Prenota.tsx` (riscrittura della struttura, mantenendo tutta la logica esistente di submit, detection luoghi, allegato, passeggeri rubrica).

**State aggiuntivo**:
```ts
const [step, setStep] = useState(1);
const [ultimoServizio, setUltimoServizio] = useState<Servizio | null>(null);
const [passeggeriSuggeriti, setPasseggeriSuggeriti] = useState<Passeggero[]>([]);
```

**Funzioni nuove**:
- `caricaUltimoServizio()` — query Supabase al mount.
- `duplicaUltimo()` — copia campi nello state e va a `setStep(5)`.
- `validateStep(n)` — ritorna `boolean` + toast errore se mancano campi.
- `handleNext()` / `handleBack()` — con validazione.

**Nessuna modifica a**:
- Database / RLS / migrazioni.
- Edge functions.
- Logica di submit (`handleSubmit` rimane identica, viene solo richiamata al click finale).
- Componenti `LuogoField`, detection aeroporti, dropzone allegato — restano come sono.

---

## Cosa NON cambia
- I dati salvati su `servizi` sono **esattamente gli stessi** di adesso.
- Le RLS, i permessi utenze (singolo/gruppo), il limite 12h, lo stato `nuovo` → tutto invariato.
- La rubrica `passeggeri_rubrica` esiste già, viene solo letta + opzionalmente arricchita.

## Risultato
L'utente vede 2-4 campi per volta invece di 15+, può ripetere l'ultima prenotazione in 2 click, e il sistema impara i passeggeri ricorrenti. Stesso database, esperienza molto più snella.
