import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Trash2, Pencil, Calculator } from "lucide-react";
import { NuovoAutistaDialog } from "@/components/NuovoAutistaDialog";

type Autista = {
  id: string;
  mansione: string | null;
  nome: string;
  cognome: string;
  codice_fiscale: string | null;
  patente: string | null;
  prezzo_ora_ord: number | null;
  prezzo_ora_straord: number | null;
  cellulare: string | null;
  telefono: string | null;
  email: string | null;
  password: string | null;
  note: string | null;
  attivo: boolean;
};

type Spesa = {
  id: string;
  autista_id: string;
  tipo: string;
  data_intervento: string | null;
  data_scadenza: string | null;
  importo_spese: number | null;
  totale_fattura: number | null;
};

const emptySpesa = {
  tipo: "Patente", data_intervento: "", data_scadenza: "",
  importo_spese: "", totale_fattura: "",
};

export default function Autisti() {
  const { user } = useAuth();
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDisattivati, setShowDisattivati] = useState(false);

  // Dialog autista (nuovo / modifica)
  const [autistaDialogOpen, setAutistaDialogOpen] = useState(false);
  const [editingAutista, setEditingAutista] = useState<{ tipo: "interno" | "esterno"; id: string; data: any } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Spese dialog
  const [speseOpen, setSpeseOpen] = useState(false);
  const [currentAutista, setCurrentAutista] = useState<Autista | null>(null);
  const [spese, setSpese] = useState<Spesa[]>([]);
  const [editingSpesaId, setEditingSpesaId] = useState<string | null>(null);
  const [spesaForm, setSpesaForm] = useState(emptySpesa);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("autisti")
      .select("*")
      .eq("attivo", !showDisattivati)
      .order("cognome");
    setAutisti((data ?? []) as Autista[]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, showDisattivati]);

  const openNuovo = () => {
    setEditingAutista(null);
    setAutistaDialogOpen(true);
  };

  const openModifica = (a: Autista) => {
    setEditingAutista({ tipo: "interno", id: a.id, data: a });
    setAutistaDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    // Soft delete: disattiva
    const { error } = await supabase.from("autisti").update({ attivo: false }).eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Autista disattivato"); load(); }
    setDeleteId(null);
  };

  const riattiva = async (id: string) => {
    const { error } = await supabase.from("autisti").update({ attivo: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Autista riattivato"); load(); }
  };

  // Spese
  const openSpese = async (a: Autista) => {
    setCurrentAutista(a);
    setSpeseOpen(true);
    setEditingSpesaId(null);
    setSpesaForm(emptySpesa);
    const { data } = await supabase
      .from("autisti_spese")
      .select("*")
      .eq("autista_id", a.id)
      .order("data_intervento", { ascending: false });
    setSpese((data ?? []) as Spesa[]);
  };

  const reloadSpese = async () => {
    if (!currentAutista) return;
    const { data } = await supabase
      .from("autisti_spese")
      .select("*")
      .eq("autista_id", currentAutista.id)
      .order("data_intervento", { ascending: false });
    setSpese((data ?? []) as Spesa[]);
  };

  const saveSpesa = async () => {
    if (!currentAutista) return;
    const payload = {
      autista_id: currentAutista.id,
      tipo: spesaForm.tipo,
      data_intervento: spesaForm.data_intervento || null,
      data_scadenza: spesaForm.data_scadenza || null,
      importo_spese: spesaForm.importo_spese ? Number(spesaForm.importo_spese) : 0,
      totale_fattura: spesaForm.totale_fattura ? Number(spesaForm.totale_fattura) : 0,
    };
    const { error } = editingSpesaId
      ? await supabase.from("autisti_spese").update(payload).eq("id", editingSpesaId)
      : await supabase.from("autisti_spese").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingSpesaId ? "Spesa aggiornata" : "Spesa aggiunta");
    setSpesaForm(emptySpesa);
    setEditingSpesaId(null);
    reloadSpese();
  };

  const editSpesa = (s: Spesa) => {
    setEditingSpesaId(s.id);
    setSpesaForm({
      tipo: s.tipo,
      data_intervento: s.data_intervento ?? "",
      data_scadenza: s.data_scadenza ?? "",
      importo_spese: s.importo_spese?.toString() ?? "",
      totale_fattura: s.totale_fattura?.toString() ?? "",
    });
  };

  const deleteSpesa = async (id: string) => {
    const { error } = await supabase.from("autisti_spese").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Spesa eliminata"); reloadSpese(); }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("it-IT") : "—";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold font-display">
            Lista autisti {showDisattivati ? "disattivati" : "interni"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowDisattivati(v => !v)}>
              {showDisattivati ? "Autisti attivi" : "Autisti disattivati"}
            </Button>
            <Button className="gap-2" onClick={openNuovo}>
              <PlusCircle className="h-4 w-4" /> Aggiungi autista
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Mansione</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Codice Fiscale</TableHead>
                  <TableHead>Num patente</TableHead>
                  <TableHead className="text-right">Prezzo Ora.Ord</TableHead>
                  <TableHead className="text-right">Prezzo Ora.Straord</TableHead>
                  <TableHead>Cellulare</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead className="text-center w-32">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autisti.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="italic">{a.mansione ?? "—"}</TableCell>
                    <TableCell className="font-semibold uppercase">{a.cognome} {a.nome}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{a.codice_fiscale ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{a.patente ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.prezzo_ora_ord?.toFixed(2) ?? "0.00"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.prezzo_ora_straord?.toFixed(2) ?? "0.00"}</TableCell>
                    <TableCell>{a.cellulare ?? a.telefono ?? "—"}</TableCell>
                    <TableCell className="lowercase">{a.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.password ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" title="Spese / Scadenze" onClick={() => openSpese(a)}>
                          <Calculator className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Modifica" onClick={() => openModifica(a)}>
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        {showDisattivati ? (
                          <Button variant="ghost" size="sm" onClick={() => riattiva(a.id)}>Riattiva</Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Disattiva" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && autisti.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Nessun autista</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Nuovo / Modifica autista */}
      <NuovoAutistaDialog
        open={autistaDialogOpen}
        onOpenChange={setAutistaDialogOpen}
        defaultTipo="interno"
        editing={editingAutista}
        onSaved={() => load()}
      />

      {/* Dialog conferma disattivazione */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare l'autista?</AlertDialogTitle>
            <AlertDialogDescription>
              L'autista verrà spostato tra i disattivati. Potrai riattivarlo in qualsiasi momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Disattiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Spese */}
      <Dialog open={speseOpen} onOpenChange={setSpeseOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Spese per {currentAutista?.cognome} {currentAutista?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="text-sm font-medium">{editingSpesaId ? "Modifica spesa" : "Aggiungi spesa"}</div>
            <div className="grid gap-2 sm:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Input value={spesaForm.tipo} onChange={e => setSpesaForm({ ...spesaForm, tipo: e.target.value })} placeholder="Patente, Patente K…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data intervento</Label>
                <Input type="date" value={spesaForm.data_intervento} onChange={e => setSpesaForm({ ...spesaForm, data_intervento: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data scadenza</Label>
                <Input type="date" value={spesaForm.data_scadenza} onChange={e => setSpesaForm({ ...spesaForm, data_scadenza: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Importo spese (€)</Label>
                <Input type="number" step="0.01" value={spesaForm.importo_spese} onChange={e => setSpesaForm({ ...spesaForm, importo_spese: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Totale fattura (€)</Label>
                <Input type="number" step="0.01" value={spesaForm.totale_fattura} onChange={e => setSpesaForm({ ...spesaForm, totale_fattura: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editingSpesaId && (
                <Button variant="ghost" size="sm" onClick={() => { setEditingSpesaId(null); setSpesaForm(emptySpesa); }}>Annulla</Button>
              )}
              <Button size="sm" onClick={saveSpesa} disabled={!spesaForm.tipo}>
                {editingSpesaId ? "Aggiorna" : "Aggiungi"}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data intervento</TableHead>
                  <TableHead>Data scadenza</TableHead>
                  <TableHead className="text-right">Importo spese</TableHead>
                  <TableHead className="text-right">Totale fattura</TableHead>
                  <TableHead className="text-center w-24">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spese.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="italic">{s.tipo}</TableCell>
                    <TableCell>{fmtDate(s.data_intervento)}</TableCell>
                    <TableCell>{fmtDate(s.data_scadenza)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.importo_spese ? `€ ${Number(s.importo_spese).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.totale_fattura ? `€ ${Number(s.totale_fattura).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => editSpesa(s)}><Pencil className="h-4 w-4 text-blue-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteSpesa(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {spese.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nessuna spesa registrata</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
