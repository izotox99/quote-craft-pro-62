import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Package } from "lucide-react";

export type AccessorioRow = {
  accessorio_id: string;
  quantita: number;
  prezzo_unitario: number;
};

export type CatalogoItem = {
  id: string;
  nome: string;
  prezzo: number;
};

type Props = {
  value: AccessorioRow[];
  onChange: (rows: AccessorioRow[]) => void;
  readOnly?: boolean;
  compact?: boolean;
};

export function AccessoriEditor({ value, onChange, readOnly, compact }: Props) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("accessori_catalogo")
        .select("id, nome, prezzo")
        .eq("attivo", true)
        .order("nome");
      setCatalogo((data ?? []) as CatalogoItem[]);
      setLoading(false);
    })();
  }, []);

  const addRow = () => {
    onChange([...value, { accessorio_id: "", quantita: 1, prezzo_unitario: 0 }]);
  };

  const updateRow = (idx: number, patch: Partial<AccessorioRow>) => {
    const next = value.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const onSelectAcc = (idx: number, accessorio_id: string) => {
    const item = catalogo.find(c => c.id === accessorio_id);
    updateRow(idx, {
      accessorio_id,
      prezzo_unitario: item ? Number(item.prezzo) : value[idx].prezzo_unitario,
    });
  };

  const total = value.reduce((s, r) => s + (r.quantita || 0) * (Number(r.prezzo_unitario) || 0), 0);

  if (readOnly) {
    if (!value.length) return <p className="text-xs text-muted-foreground italic">Nessun accessorio</p>;
    return (
      <div className="space-y-1 text-xs">
        {value.map((r, i) => {
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

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-xs text-muted-foreground">Caricamento catalogo…</p>
      ) : catalogo.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">
          <Package className="mx-auto h-5 w-5 mb-1 opacity-40" />
          Nessun accessorio nel catalogo. Configurali dalla pagina Accessori.
        </div>
      ) : (
        <>
          {value.length > 0 && !compact && (
            <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-muted-foreground font-semibold px-1">
              <div className="col-span-6">Accessorio</div>
              <div className="col-span-2 text-center">Qta</div>
              <div className="col-span-2 text-right">Prezzo €</div>
              <div className="col-span-1 text-right">Totale</div>
              <div className="col-span-1" />
            </div>
          )}
          {value.map((row, idx) => {
            const rowTotal = (row.quantita || 0) * (Number(row.prezzo_unitario) || 0);
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <Select value={row.accessorio_id} onValueChange={v => onSelectAcc(idx, v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona accessorio" /></SelectTrigger>
                    <SelectContent>
                      {catalogo.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} <span className="text-muted-foreground ml-2">€ {Number(c.prezzo).toFixed(2)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.quantita}
                    onChange={e => updateRow(idx, { quantita: Math.max(1, parseInt(e.target.value || "1")) })}
                    className="h-9 text-center"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={row.prezzo_unitario}
                    onChange={e => updateRow(idx, { prezzo_unitario: parseFloat(e.target.value || "0") })}
                    className="h-9 text-right"
                  />
                </div>
                <div className="col-span-1 text-right text-xs font-medium">
                  € {rowTotal.toFixed(2)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Aggiungi accessorio
            </Button>
            {value.length > 0 && (
              <div className="text-sm font-semibold">
                Totale: € {total.toFixed(2)}
              </div>
            )}
          </div>
        </>
      )}
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
  await supabase.from("servizi_accessori").delete().eq("servizio_id", servizioId);
  const clean = rows.filter(r => r.accessorio_id);
  if (clean.length === 0) return;
  await supabase.from("servizi_accessori").insert(
    clean.map(r => ({
      servizio_id: servizioId,
      accessorio_id: r.accessorio_id,
      quantita: r.quantita || 1,
      prezzo_unitario: Number(r.prezzo_unitario) || 0,
    })) as any
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
