import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type Riga = { id: string; data: string; quantita: number; articolo_id: string; anomalia: boolean; note: string | null };

export function SectionMateriali({ veicoloId }: { veicoloId: string }) {
  const [rows, setRows] = useState<Riga[]>([]);
  const [articoli, setArticoli] = useState<Record<string, { nome: string; unita: string }>>({});

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: a }] = await Promise.all([
        supabase
          .from("movimenti_magazzino")
          .select("id, data, quantita, articolo_id, anomalia, note")
          .eq("tipo", "scarico")
          .eq("veicolo_id", veicoloId)
          .order("data", { ascending: false }),
        supabase.from("articoli").select("id, nome, unita_misura"),
      ]);
      setRows((m ?? []) as Riga[]);
      setArticoli(Object.fromEntries((a ?? []).map((x) => [x.id, { nome: x.nome, unita: x.unita_misura }])));
    })();
  }, [veicoloId]);

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Materiale</TableHead>
              <TableHead>Quantità</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.data).toLocaleDateString("it-IT")}</TableCell>
                <TableCell className="font-medium">
                  {articoli[r.articolo_id]?.nome ?? "—"}
                  {r.anomalia && <Badge variant="destructive" className="ml-2">anomalia</Badge>}
                </TableCell>
                <TableCell>{r.quantita} {articoli[r.articolo_id]?.unita ?? ""}</TableCell>
                <TableCell className="max-w-[280px] truncate">{r.note ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nessun materiale utilizzato su questo mezzo</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
