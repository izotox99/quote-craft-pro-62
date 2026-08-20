import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const TUTTI = "__tutti__";
const INTERNO = "__interno__";

type Movimento = {
  id: string; data: string; quantita: number; articolo_id: string; veicolo_id: string | null;
  consumo_interno: boolean; anomalia: boolean; note: string | null;
};

export default function ListaUsato() {
  const [rows, setRows] = useState<Movimento[]>([]);
  const [articoli, setArticoli] = useState<{ id: string; nome: string; unita_misura: string }[]>([]);
  const [veicoli, setVeicoli] = useState<{ id: string; targa: string; marca: string | null; modello: string | null }[]>([]);
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [articoloId, setArticoloId] = useState(TUTTI);
  const [veicoloId, setVeicoloId] = useState(TUTTI);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: a }, { data: v }] = await Promise.all([
        supabase.from("movimenti_magazzino").select("id, data, quantita, articolo_id, veicolo_id, consumo_interno, anomalia, note").eq("tipo", "scarico").order("data", { ascending: false }),
        supabase.from("articoli").select("id, nome, unita_misura").order("nome"),
        supabase.from("veicoli").select("id, targa, marca, modello").order("targa"),
      ]);
      setRows((m ?? []) as Movimento[]);
      setArticoli(a ?? []);
      setVeicoli(v ?? []);
    })();
  }, []);

  const filtrati = useMemo(
    () =>
      rows.filter((r) => {
        if (dal && r.data < dal) return false;
        if (al && r.data > al) return false;
        if (articoloId !== TUTTI && r.articolo_id !== articoloId) return false;
        if (veicoloId === INTERNO && !r.consumo_interno) return false;
        if (veicoloId !== TUTTI && veicoloId !== INTERNO && r.veicolo_id !== veicoloId) return false;
        return true;
      }),
    [rows, dal, al, articoloId, veicoloId]
  );

  const nomeArt = (id: string) => articoli.find((a) => a.id === id)?.nome ?? "—";
  const unitaArt = (id: string) => articoli.find((a) => a.id === id)?.unita_misura ?? "";
  const labelVei = (id: string | null) => {
    const v = veicoli.find((x) => x.id === id);
    return v ? `${[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - ${v.targa}` : "—";
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Lista ins. usato</h1>

        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5"><Label>Dal</Label><Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Al</Label><Input type="date" value={al} onChange={(e) => setAl(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Articolo</Label>
              <Select value={articoloId} onValueChange={setArticoloId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TUTTI}>Tutti gli articoli</SelectItem>
                  {articoli.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mezzo</Label>
              <Select value={veicoloId} onValueChange={setVeicoloId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TUTTI}>Tutti</SelectItem>
                  <SelectItem value={INTERNO}>Consumo interno</SelectItem>
                  {veicoli.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - {v.targa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Articolo</TableHead>
                  <TableHead>Quantità</TableHead>
                  <TableHead>Destinazione</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrati.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.data).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell className="font-medium">
                      {nomeArt(r.articolo_id)}
                      {r.anomalia && <Badge variant="destructive" className="ml-2">anomalia</Badge>}
                    </TableCell>
                    <TableCell>{r.quantita} {unitaArt(r.articolo_id)}</TableCell>
                    <TableCell>{r.consumo_interno ? "Consumo interno" : labelVei(r.veicolo_id)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{r.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {filtrati.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nessun materiale utilizzato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
