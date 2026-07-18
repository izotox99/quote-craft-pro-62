## Obiettivo
Ridurre lo spazio interno tra le colonne della tabella Servizi (`/dashboard`) così che tutte le 25 voci restino leggibili anche a viewport strette (826px attuali dello screenshot, dove alcune colonne di destra come `Com €`, `Cod.`, `Fog.` risultano tagliate/troncate).

## Modifiche

### `src/pages/Servizi.tsx`
- Header `<th>`: `px-1 py-1.5` → `px-0.5 py-1` (dimezza il padding orizzontale).
- Celle `<td>` (`cellCls`): `px-1 py-1` → `px-0.5 py-1`.
- Tabella: `text-[10.5px]` → `text-[10px]` per allineare corpo e header e recuperare ~5% larghezza.
- Header font: resta `text-[10px]`, aggiungo `tracking-tight` per evitare wrap su label brevi.
- Checkbox `<th>`/`<td>`: `px-1` → `px-0.5` così la prima colonna non ruba spazio.

### `src/lib/servizi-columns.ts`
Ribilancio pesi delle colonne per dare più larghezza a quelle che nello screenshot risultano compresse/tagliate e ridurre quelle sovradimensionate:
- `citta` 3 → 2, `data` 4 → 3, `np` 2 → 1, `nb` 2 → 1, `tp` 3 → 2, `foglio` 2 → 1.
- `societa` 6 → 5, `luogo_inizio`/`itinerario`/`luogo_fine` 7 → 6.
- Le colonne economiche di destra (`non_incassato`, `incasso`, `costo_cs`, `costo_autista`, `costo_centro`, `commissione`, `codice`) restano a 3 così i valori numerici e la label `Com €`/`Cod.` non vengono più troncati.

Nessuna modifica a logica dati, RLS, o layout esterno alla tabella.

## Verifica
Playwright headless a 826px, 1280px, 1440px: confermare che tutte le 26 `<th>` sono renderizzate, `scrollWidth === clientWidth` (nessun scroll orizzontale), e che le label `Com€`, `Cod.`, `Fog.` non sono clippate (bounding box interamente dentro il viewport).