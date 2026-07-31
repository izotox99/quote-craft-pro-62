import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Fuel, Receipt } from "lucide-react";

type Row = {
  id: string;
  data: string;
  autista_id: string | null;
  autista_nome: string | null;
  km: number | null;
  quantita: number | null;
  prezzo_unitario: number | null;
  prezzo_totale: number;
  luogo: string | null;
  foto_path?: string | null;
  distributore?: string | null;
};

export function SectionGasolio({ veicoloId }: { veicoloId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [autisti, setAutisti] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    const [{ data: g }, { data: a }] = await Promise.all([
      supabase.from("veicoli_gasolio").select("*").eq("veicolo_id", veicoloId).order("data", { ascending: false }),
      supabase.from("autisti").select("id, nome, cognome").eq("attivo", true).order("cognome"),
    ]);
    setRows((g ?? []) as Row[]);
    setAutisti((a ?? []) as any);
  };
  useEffect(() => { load(); }, [veicoloId]);

  const openNew = () => {
    setEditing(null);
    setForm({ data: new Date().toISOString().split("T")[0] });
    setOpen(true);
  };
  const openEdit = (r: Row) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const handleSave = async () => {
    const qta = form.quantita ? Number(form.quantita) : null;
    const pu = form.prezzo_unitario ? Number(form.prezzo_unitario) : null;
    const totale = form.prezzo_totale ? Number(form.prezzo_totale) : (qta && pu ? qta * pu : 0);
    const autista = autisti.find((x) => x.id === form.autista_id);
    const payload: any = {
      veicolo_id: veicoloId,
      data: form.data,
      autista_id: form.autista_id || null,
      autista_nome: autista ? `${autista.nome} ${autista.cognome}` : (form.autista_nome || null),
      km: form.km ? Number(form.km) : null,
      quantita: qta,
      prezzo_unitario: pu,
      prezzo_totale: totale,
      luogo: form.luogo || null,
    };
    const { error } = editing
      ? await supabase.from("veicoli_gasolio").update(payload as any).eq("id", editing.id)
      : await supabase.from("veicoli_gasolio").insert([payload] as any);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Aggiornato" : "Aggiunto");
    setOpen(false); load();
  };

  const openFoto = async (path: string) => {
    const { data, error } = await supabase.storage.from("scontrini-carburante").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Impossibile aprire lo scontrino");
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (r: Row) => {
    if (!confirm("Eliminare questo rifornimento?")) return;
    const { error } = await supabase.from("veicoli_gasolio").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato"); load();
  };

  const totaleSpese = rows.reduce((s, r) => s + (Number(r.prezzo_totale) || 0), 0);
  const totaleLitri = rows.reduce((s, r) => s + (Number(r.quantita) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Totale spese</div>
          <div className="text-xl font-semibold">{totaleSpese.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Totale litri</div>
          <div className="text-xl font-semibold">{totaleLitri.toFixed(2)} L</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Rifornimenti</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </Card>
        <div className="flex items-end justify-end">
          <Button onClick={openNew} className="gap-2 w-full sm:w-auto"><PlusCircle className="h-4 w-4" /> Aggiungi carburante</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Autista</TableHead>
              <TableHead className="text-right">KM</TableHead>
              <TableHead className="text-right">Litri</TableHead>
              <TableHead className="text-right">Prezzo unità</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="hidden md:table-cell">Luogo</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                <Fuel className="h-8 w-8 mx-auto mb-2 opacity-40" />Nessun rifornimento
              </TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.data).toLocaleDateString("it-IT")}</TableCell>
                <TableCell className="font-medium">{r.autista_nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.km?.toLocaleString("it-IT") ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.quantita ? Number(r.quantita).toFixed(2) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.prezzo_unitario ? Number(r.prezzo_unitario).toFixed(3) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {Number(r.prezzo_totale).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.luogo ?? r.distributore ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {r.foto_path && (
                    <Button variant="ghost" size="icon" title="Foto scontrino" onClick={() => openFoto(r.foto_path!)}>
                      <Receipt className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Modifica rifornimento" : "Nuovo rifornimento"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div><Label>Autista</Label>
              <Select value={form.autista_id ?? undefined} onValueChange={(v) => setForm({ ...form, autista_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {autisti.map((a) => <SelectItem key={a.id} value={a.id}>{a.cognome} {a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>KM</Label><Input inputMode="numeric" value={form.km ?? ""} onChange={(e) => setForm({ ...form, km: e.target.value })} /></div>
            <div><Label>Quantità (L)</Label><Input inputMode="decimal" value={form.quantita ?? ""} onChange={(e) => setForm({ ...form, quantita: e.target.value })} /></div>
            <div><Label>Prezzo unità (€)</Label><Input inputMode="decimal" value={form.prezzo_unitario ?? ""} onChange={(e) => setForm({ ...form, prezzo_unitario: e.target.value })} /></div>
            <div><Label>Prezzo totale (€)</Label><Input inputMode="decimal" value={form.prezzo_totale ?? ""} onChange={(e) => setForm({ ...form, prezzo_totale: e.target.value })} placeholder="auto" /></div>
            <div className="sm:col-span-2"><Label>Luogo</Label><Input value={form.luogo ?? ""} onChange={(e) => setForm({ ...form, luogo: e.target.value })} placeholder="es. esso prenestina km 7800" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={handleSave}>{editing ? "Salva" : "Aggiungi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
