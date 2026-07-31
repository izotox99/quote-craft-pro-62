import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";
import { romeMonthRange } from "@/lib/romeDate";

type Autista = { id: string; nome: string; cognome: string | null };
type OreRow = {
  id: string;
  autista_id: string;
  data: string;
  ore_ordinarie: number;
  ore_straordinarie: number;
  ore_notturne: number;
  tipologia_partenza: string | null;
  trasferta_tipo: "nessuna" | "trasferta" | "trasferta_2";
  buono_pasto: boolean;
  note: string | null;
  corretta_at: string | null;
};

const monthRange = (ym: string) => romeMonthRange(ym);
function fmtEur(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export default function AutistiOre() {
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [selectedId, setSelectedId] = useState<string | "">("");
  const [rows, setRows] = useState<OreRow[]>([]);
  const [compenso, setCompenso] = useState<any>(null);
  const [editing, setEditing] = useState<OreRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("autisti")
        .select("id, nome, cognome, attivo")
        .eq("attivo", true)
        .order("nome");
      setAutisti((data ?? []) as Autista[]);
      if (data && data.length > 0) setSelectedId(data[0].id);
    })();
  }, []);

  const load = async () => {
    if (!selectedId) return;
    const { from, to } = monthRange(ym);
    const { data } = await supabase
      .from("autisti_ore")
      .select("*")
      .eq("autista_id", selectedId)
      .gte("data", from).lte("data", to)
      .order("data", { ascending: false });
    setRows((data ?? []) as OreRow[]);
    const { data: comp } = await supabase.rpc("calcola_compenso_autista", {
      _autista_id: selectedId, _from: from, _to: to,
    });
    setCompenso(comp);
  };

  useEffect(() => { load(); }, [selectedId, ym]);

  const salvaEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("autisti_ore").update({
      ore_ordinarie: editing.ore_ordinarie,
      ore_straordinarie: editing.ore_straordinarie,
      ore_notturne: editing.ore_notturne,
      tipologia_partenza: editing.tipologia_partenza as any,
      trasferta_tipo: editing.trasferta_tipo,
      buono_pasto: editing.buono_pasto,
      note: editing.note,
      corretta_da: (await supabase.auth.getUser()).data.user?.id ?? null,
      corretta_at: new Date().toISOString(),
    }).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("Riga aggiornata (traccia registrata)"); setEditing(null); load(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <h1 className="text-2xl font-bold font-display">Ore autisti</h1>
          <div className="flex gap-3">
            <div>
              <Label className="text-xs">Autista</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {autisti.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} {a.cognome ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mese</Label>
              <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
            </div>
          </div>
        </div>

        {compenso && (
          <Card>
            <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div><div className="text-muted-foreground">Ordinarie</div><div className="font-bold">{Number(compenso.quantita?.ore_ordinarie ?? 0).toFixed(2)} h</div><div>{fmtEur(compenso.voci?.compenso_ordinario ?? 0)}</div></div>
              <div><div className="text-muted-foreground">Straord.</div><div className="font-bold">{Number(compenso.quantita?.ore_straordinarie ?? 0).toFixed(2)} h</div><div>{fmtEur(compenso.voci?.compenso_straordinario ?? 0)}</div></div>
              <div><div className="text-muted-foreground">Notturne</div><div className="font-bold">{Number(compenso.quantita?.ore_notturne ?? 0).toFixed(2)} h</div><div>{fmtEur(compenso.voci?.compenso_notturno ?? 0)}</div></div>
              <div><div className="text-muted-foreground">Trasferte</div><div className="font-bold">{compenso.quantita?.trasferte ?? 0}</div><div>{fmtEur(compenso.voci?.compenso_trasferte ?? 0)}</div></div>
              <div><div className="text-muted-foreground">Trasferte 2</div><div className="font-bold">{compenso.quantita?.trasferte_2 ?? 0}</div><div>{fmtEur(compenso.voci?.compenso_trasferte_2 ?? 0)}</div></div>
              <div><div className="text-muted-foreground">Buoni pasto</div><div className="font-bold">{compenso.quantita?.buoni_pasto ?? 0}</div><div>{fmtEur(compenso.voci?.compenso_buoni_pasto ?? 0)}</div></div>
              <div className="bg-primary/10 -m-2 p-2 rounded">
                <div className="text-muted-foreground">Totale</div>
                <div className="font-bold text-lg text-primary">{fmtEur(compenso.totale ?? 0)}</div>
                {compenso.parametri?.assicurazione && (
                  <div className="text-[10px] text-muted-foreground">Assicurazione (info): {fmtEur(compenso.parametri.assicurazione)}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ord.</TableHead>
                  <TableHead className="text-right">Str.</TableHead>
                  <TableHead className="text-right">Not.</TableHead>
                  <TableHead>Partenza</TableHead>
                  <TableHead>Trasferta</TableHead>
                  <TableHead className="text-center">BP</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isEd = editing?.id === r.id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{new Date(r.data + "T00:00:00").toLocaleDateString("it-IT")}</TableCell>
                      {isEd ? (
                        <>
                          <TableCell><Input type="number" step="0.25" value={editing.ore_ordinarie} onChange={(e) => setEditing({ ...editing, ore_ordinarie: parseFloat(e.target.value) || 0 })} className="h-8 w-20 text-right" /></TableCell>
                          <TableCell><Input type="number" step="0.25" value={editing.ore_straordinarie} onChange={(e) => setEditing({ ...editing, ore_straordinarie: parseFloat(e.target.value) || 0 })} className="h-8 w-20 text-right" /></TableCell>
                          <TableCell><Input type="number" step="0.25" value={editing.ore_notturne} onChange={(e) => setEditing({ ...editing, ore_notturne: parseFloat(e.target.value) || 0 })} className="h-8 w-20 text-right" /></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono">{Number(r.ore_ordinarie).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{Number(r.ore_straordinarie).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{Number(r.ore_notturne).toFixed(2)}</TableCell>
                        </>
                      )}
                      <TableCell className="text-xs">{r.tipologia_partenza ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.trasferta_tipo}</TableCell>
                      <TableCell className="text-center">{r.buono_pasto ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs">{r.note ?? "—"} {r.corretta_at && <span className="text-amber-600">✎</span>}</TableCell>
                      <TableCell>
                        {isEd ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={salvaEdit}><Save className="h-4 w-4 text-primary" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nessuna dichiarazione nel periodo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
