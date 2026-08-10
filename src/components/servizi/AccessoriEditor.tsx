import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";

export type AccessorioRow = {
  accessorio_id: string;
  quantita: number;
  prezzo_unitario: number;
};

export type CatalogoItem = {
  id: string;
  nome: string;
  prezzo: number;
  attivo?: boolean;
};

type Props = {
  value: AccessorioRow[];
  onChange: (rows: AccessorioRow[]) => void;
  readOnly?: boolean;
  compact?: boolean;
};

export function AccessoriEditor({ value, onChange, readOnly }: Props) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("accessori_catalogo")
        .select("id, nome, prezzo, attivo")
        .order("nome");
      setCatalogo((data ?? []) as CatalogoItem[]);
      setLoading(false);
    })();
  }, []);

  const usati = new Set(value.filter(r => (r.quantita || 0) > 0).map(r => r.accessorio_id));
  // accessori attivi + eventuali disattivati già presenti nel servizio (sola lettura)
  const visibili = catalogo.filter(c => c.attivo !== false || usati.has(c.id));

  const getQty = (id: string) => value.find(r => r.accessorio_id === id)?.quantita ?? 0;

  const setQty = (item: CatalogoItem, raw: string) => {
    const qty = raw === "" ? 0 : Math.max(0, parseInt(raw) || 0);
    if (qty <= 0) {
      onChange(value.filter(r => r.accessorio_id !== item.id));
      return;
    }
    const existing = value.find(r => r.accessorio_id === item.id);
    if (existing) {
      onChange(value.map(r => (r.accessorio_id === item.id ? { ...r, quantita: qty } : r)));
    } else {
      onChange([...value, { accessorio_id: item.id, quantita: qty, prezzo_unitario: Number(item.prezzo) }]);
    }
  };

  const total = value.reduce((s, r) => s + (r.quantita || 0) * (Number(r.prezzo_unitario) || 0), 0);

  if (loading) return <p className="text-xs text-muted-foreground">Caricamento catalogo…</p>;

  if (readOnly) {
    const inclusi = value.filter(r => (r.quantita || 0) > 0);
    if (!inclusi.length) return <p className="text-xs text-muted-foreground italic">Nessun accessorio</p>;
    return (
      <div className="space-y-1 text-xs">
        {inclusi.map((r, i) => {
          const item = catalogo.find(c => c.id === r.accessorio_id);
          return (
            <div key={i} className="flex justify-between border-b py-1">
              <span>{r.quantita}× {item?.nome ?? "Accessorio"}</span>
              <span className="font-medium">€ {(r.quantita * Number(r.prezzo_unitario)).toFixed(2)}</span>
            </div>
          );
        })}
        <div className="flex justify-between pt-1 font-semibold">
          <span>Totale accessori</span>
          <span>€ {total.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  if (!visibili.length) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">
        <Package className="mx-auto h-5 w-5 mb-1 opacity-40" />
        Nessun accessorio nel catalogo. Configurali dalla pagina Accessori.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visibili.map(item => {
        const qty = getQty(item.id);
        const rowTotal = qty * Number(item.prezzo || 0);
        const disattivato = item.attivo === false;
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {item.nome}
                {disattivato && (
                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">non più disponibile</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">€ {Number(item.prezzo).toFixed(2)} cad.</div>
            </div>
            <div className="w-20 text-right text-xs font-medium tabular-nums">
              {qty > 0 ? `€ ${rowTotal.toFixed(2)}` : ""}
            </div>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              disabled={disattivato}
              value={qty === 0 ? "" : qty}
              onChange={e => setQty(item, e.target.value)}
              placeholder="0"
              className="w-16 h-9 text-center rounded-md"
            />
          </div>
        );
      })}
      <div className="flex justify-end pt-1 text-sm font-semibold">
        Totale accessori: € {total.toFixed(2)}
      </div>
    </div>
  );
}


export function accessoriSummary(rows: AccessorioRow[], catalogo: CatalogoItem[]): string {
  if (!rows.length) return "";
  return rows
    .map(r => {
      const item = catalogo.find(c => c.id === r.accessorio_id);
      return `${r.quantita}× ${item?.nome ?? "Acc."}`;
    })
    .join(", ");
}

export async function saveServizioAccessori(servizioId: string, rows: AccessorioRow[]) {
  // una sola riga per (servizio, accessorio): dedup lato client + upsert
  const map = new Map<string, AccessorioRow>();
  for (const r of rows) {
    if (!r.accessorio_id || (r.quantita || 0) <= 0) continue;
    map.set(r.accessorio_id, r);
  }
  const clean = [...map.values()];

  // rimuove gli accessori non più presenti
  let del = supabase.from("servizi_accessori").delete().eq("servizio_id", servizioId);
  if (clean.length) del = del.not("accessorio_id", "in", `(${clean.map(r => r.accessorio_id).join(",")})`);
  await del;

  if (!clean.length) return;
  await supabase.from("servizi_accessori").upsert(
    clean.map(r => ({
      servizio_id: servizioId,
      accessorio_id: r.accessorio_id,
      quantita: r.quantita || 1,
      prezzo_unitario: Number(r.prezzo_unitario) || 0,
    })) as any,
    { onConflict: "servizio_id,accessorio_id" }
  );
}


export async function loadServizioAccessori(servizioId: string): Promise<AccessorioRow[]> {
  const { data } = await supabase
    .from("servizi_accessori")
    .select("accessorio_id, quantita, prezzo_unitario")
    .eq("servizio_id", servizioId);
  return (data ?? []).map(r => ({
    accessorio_id: r.accessorio_id as string,
    quantita: r.quantita as number,
    prezzo_unitario: Number(r.prezzo_unitario),
  }));
}
