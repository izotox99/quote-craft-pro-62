## Diagnosi (verificata)

Nel file `src/components/DashboardLayout.tsx`, riga 382, il `<main>` è così:

```
<main className="mx-auto max-w-7xl px-4 py-8 lg:px-8 overflow-x-clip">
```

Questo produce **tre problemi contemporanei** che spiegano quello che vedi nello screenshot:

1. **`max-w-7xl` (1280px) + `mx-auto`**: la colonna di contenuto è limitata a 1280px e centrata. La pagina Servizi non può mai essere più larga di così, indipendentemente dal viewport.
2. **`overflow-x-clip` sul main**: annulla il trucco full-bleed `w-[100vw] ml-[calc(50%-50vw)]` usato nella tabella. La parte di tabella che sporge fuori dai 1280px viene **letteralmente ritagliata**. È per questo che nello screenshot la prima intestazione è "SOCIETÀ": **Città e Data sono lì, ma tagliate a sinistra dal clip**; specularmente Com€, Codice, Foglio sono tagliate a destra.
3. **`py-8`**: 32px di padding verticale sopra e sotto — spreco di spazio verticale che ho appena chiesto di ridurre e che il layout globale sta reintroducendo.

Confermato leggendo `src/lib/servizi-columns.ts`: la vista `Completa` ha effettivamente `citta` e `data` come prime due colonne — non è un problema di configurazione delle viste, è puramente il layout.

## Fix definitivo

### 1. `src/components/DashboardLayout.tsx` — main non-costrittivo

Sostituire il `<main>` (riga 382) con:

```
<main className="w-full px-3 py-3 lg:px-4">
  {children}
</main>
```

- Rimosso `mx-auto max-w-7xl` → la pagina usa tutta la larghezza del viewport.
- Rimosso `overflow-x-clip` dal main (rimane comunque sull'outer div riga 79, che continua a proteggere la pagina dallo scroll orizzontale).
- `py-8` → `py-3`, `px-4/lg:px-8` → `px-3/lg:px-4` (padding minimo che punteremo poi da Servizi).

### 2. `src/pages/Servizi.tsx` — full-bleed reale

Sostituire nel wrapper della tabella desktop (riga 929) `w-[100vw] ml-[calc(50%-50vw)]` con un negative-margin che compensa esattamente il padding orizzontale di `<main>`:

```
<div className="hidden md:block -mx-3 lg:-mx-4 overflow-hidden border-y bg-card">
```

Così la tabella tocca davvero i bordi laterali del viewport senza dipendere da calcoli con `50vw` che vengono spezzati da `overflow-x-clip`.

### 3. Verifica finale (obbligatoria prima di dichiarare chiuso)

Aprire il preview a 1280px, 1440px e 1512px (MacBook 14") e:
- Contare le `<th>` renderizzate: devono essere 26 (checkbox + 25 dati).
- Prima intestazione visibile = **CITTÀ**, ultima = **FOG.** (Foglio).
- Nessuno scroll orizzontale a livello di pagina (`document.scrollWidth === innerWidth`).
- La tabella tocca `x=0` e `x=innerWidth`.

## Impatto collaterale

Rimuovendo `max-w-7xl` da `<main>` **tutte** le pagine sotto `DashboardLayout` (Clienti, Veicoli, Autisti, Fornitori, Network, Settings…) diventano full-width. La maggior parte usa già `<Card>` interni che mantengono la propria struttura, quindi il rendering resta corretto; cambia solo che i contenuti non sono più limitati a 1280px e usano lo spazio reale disponibile. Se preferisci mantenere le altre pagine centrate a 1280px e liberare solo la dashboard, dimmelo e sposto la logica di larghezza dentro le singole pagine invece che sul layout globale.
