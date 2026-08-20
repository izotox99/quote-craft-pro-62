import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Pencil, Plus, Power, Search, Truck } from "lucide-react";
import { FornitoriMagazzinoDialog, fetchFornitoriMagazzino, type FornitoreMagazzino } from "@/components/magazzino/FornitoriMagazzinoDialog";
import { TIPI_CONFEZIONE, UNITA_BASE, CATEGORIE_ARTICOLO, formatoConfezione, labelCategoria } from "@/lib/magazzino";

const NESSUNO = "__nessuno__";
type Articolo = {
  id: string; nome: string; unita_misura: string; fornitore_default_id: string | null;
  prezzo_unitario: number | null; scorta_minima: number; note: string | null; attivo: boolean;
  tipo_confezione: string | null; quantita_per_confezione: number | null;
  unita_base: string | null; categorie: string[] | null; mostra_in_ordini: boolean | null;
};

export default function ListaArticoli() {
  const { canWrite } = useAuth();
  const [rows, setRows] = useState<Articolo[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreMagazzino[]>([]);
  const [q, setQ] = useState("");
  const [fornDialog, setFornDialog] = useState(false);
  const [editing, setEditing] = useState<Articolo | null>(null);
  const [categorie, setCategorie] = useState<string[]>([]);
  const [form, setForm] = useState({
    nome: "", tipo_confezione: "singolo", quantita_per_confezione: "1", unita_base: "pezzo",
    mostra_in_ordini: "si", fornitore_default_id: NESSUNO, prezzo_unitario: "", scorta_minima: "0",
  });

  const load = async () => {
    const [{ data }, forn] = await Promise.all([
      supabase.from("articoli").select("*").order("nome"),
      fetchFornitoriMagazzino(),
    ]);
    setRows((data ?? []) as unknown as Articolo[]);
    setFornitori(forn);
  };
  useEffect(() => { load(); }, []);

  const filtrati = useMemo(
    () => rows.filter((r) => r.nome.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  const apriModifica = (a: Articolo) => {
    setEditing(a);
    setCategorie(a.categorie ?? []);
    setForm({
      nome: a.nome,
      tipo_confezione: a.tipo_confezione ?? "singolo",
      quantita_per_confezione: String(a.quantita_per_confezione ?? 1),
      unita_base: a.unita_base ?? "pezzo",
      mostra_in_ordini: a.mostra_in_ordini === false ? "no" : "si",
      fornitore_default_id: a.fornitore_default_id ?? NESSUNO,
      prezzo_unitario: a.prezzo_unitario != null ? String(a.prezzo_unitario) : "",
      scorta_minima: String(a.scorta_minima ?? 0),
    });
  };

  const toggleCat = (c: string) =>
    setCategorie((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const salva = async () => {
    if (!editing) return;
    if (categorie.length === 0) return toast.error("Seleziona almeno una categoria");
    const { error } = await supabase.from("articoli").update({
      nome: form.nome.trim(),
      unita_misura: form.unita_base === "litro" ? "litri" : "pz",
      unita_base: form.unita_base,
      tipo_confezione: form.tipo_confezione,
      quantita_per_confezione: Math.max(1, parseInt(form.quantita_per_confezione || "1", 10)),
      categorie,
      mostra_in_ordini: form.mostra_in_ordini === "si",
      fornitore_default_id: form.fornitore_default_id !== NESSUNO ? form.fornitore_default_id : null,
      prezzo_unitario: form.prezzo_unitario ? Number(form.prezzo_unitario.replace(",", ".")) : null,
      scorta_minima: Number((form.scorta_minima || "0").replace(",", ".")),
    } as never).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Articolo aggiornato");
    setEditing(null);
    load();
  };

  const toggle = async (a: Articolo) => {
    const { error } = await supabase.from("articoli").update({ attivo: !a.attivo }).eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">Lista articoli</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setFornDialog(true)}>
              <Truck className="h-4 w-4" /> Fornitori magazzino
            </Button>
            <Link to="/magazzino/articoli/nuovo">
              <Button className="gap-2"><Plus className="h-4 w-4" /> Inserisci articolo</Button>
            </Link>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cerca articolo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articolo</TableHead>
                  <TableHead>Unità</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Fornitore default</TableHead>
                  <TableHead>Prezzo</TableHead>
                  <TableHead>Qtà minima</TableHead>
                  <TableHead>In ordini</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrati.map((a) => (
                  <TableRow key={a.id} className={a.attivo ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{formatoConfezione(a.tipo_confezione, a.quantita_per_confezione, a.unita_base)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(a.categorie ?? []).map((c) => <Badge key={c} variant="secondary" className="text-[11px]">{labelCategoria(c)}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>{fornitori.find((f) => f.id === a.fornitore_default_id)?.nome ?? "—"}</TableCell>
                    <TableCell>{a.prezzo_unitario != null ? `€ ${a.prezzo_unitario}` : "—"}</TableCell>
                    <TableCell>{a.scorta_minima}</TableCell>
                    <TableCell>{a.mostra_in_ordini === false ? "No" : "Sì"}</TableCell>
                    <TableCell>{a.attivo ? "Attivo" : "Disattivato"}</TableCell>
                    <TableCell className="text-right">
                      {canWrite && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => apriModifica(a)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle(a)}><Power className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtrati.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nessun articolo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <FornitoriMagazzinoDialog open={fornDialog} onOpenChange={setFornDialog} onChanged={load} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica articolo</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantità minima</Label>
              <Input inputMode="decimal" value={form.scorta_minima} onChange={(e) => setForm({ ...form, scorta_minima: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prezzo unitario (€)</Label>
              <Input inputMode="decimal" value={form.prezzo_unitario} onChange={(e) => setForm({ ...form, prezzo_unitario: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Unità</Label>
              <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2">
                <Select value={form.tipo_confezione} onValueChange={(v) => setForm({ ...form, tipo_confezione: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPI_CONFEZIONE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">da</span>
                <Input inputMode="numeric" value={form.quantita_per_confezione} onChange={(e) => setForm({ ...form, quantita_per_confezione: e.target.value })} />
                <Select value={form.unita_base} onValueChange={(v) => setForm({ ...form, unita_base: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITA_BASE.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{formatoConfezione(form.tipo_confezione, Number(form.quantita_per_confezione) || 1, form.unita_base)}</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Articolo per</Label>
              <div className="flex flex-wrap gap-4 rounded-md border p-3">
                {CATEGORIE_ARTICOLO.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={categorie.includes(c.value)} onCheckedChange={() => toggleCat(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mostra in ordini</Label>
              <Select value={form.mostra_in_ordini} onValueChange={(v) => setForm({ ...form, mostra_in_ordini: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sì</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fornitore default</Label>
              <Select value={form.fornitore_default_id} onValueChange={(v) => setForm({ ...form, fornitore_default_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NESSUNO}>Nessuno</SelectItem>
                  {fornitori.filter((f) => f.attivo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={salva} disabled={!canWrite}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
