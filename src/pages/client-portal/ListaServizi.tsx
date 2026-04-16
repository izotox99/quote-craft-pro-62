import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, CalendarDays, Pencil, XCircle, Info } from "lucide-react";
import { toast } from "sonner";

type Servizio = {
  id: string;
  data_servizio: string;
  ora_inizio: string | null;
  citta: string | null;
  contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  tipologia: string | null;
  transfer_tipo: string | null;
  disposizione_oraria: string | null;
  tour_tipo: string | null;
  luogo_inizio: string | null;
  itinerario: string | null;
  luogo_fine: string | null;
  info_autista: string | null;
  veicolo_tipo: string | null;
  tipo_pagamento: string | null;
  centro_costo: string | null;
  stato: string;
  codice: string | null;
  note: string | null;
};

function canModify(s: Servizio): boolean {
  if (s.stato === "annullato" || s.stato === "completato") return false;
  if (!s.ora_inizio || !s.data_servizio) return true;
  const serviceDate = new Date(`${s.data_servizio}T${s.ora_inizio}`);
  const now = new Date();
  const diffMs = serviceDate.getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  return diffH > 12;
}

function buildTipoServizio(s: Servizio): string {
  const parts: string[] = [];
  if (s.transfer_tipo) parts.push(`Transfer: ${s.transfer_tipo}`);
  if (s.disposizione_oraria) parts.push(`Disposizione: ${s.disposizione_oraria}`);
  if (s.tour_tipo) parts.push(`Tour: ${s.tour_tipo}`);
  if (parts.length === 0 && s.tipologia) return s.tipologia;
  return parts.join(" / ") || "—";
}

const pagamentoLabel: Record<string, string> = {
  fattura: "Fattura",
  contante: "Contante",
  carta_credito: "C.Credito",
};

const statoLabel: Record<string, string> = {
  nuovo: "Nuovo",
  confermato: "Confermato",
  in_corso: "In corso",
  completato: "Completato",
  annullato: "Annullato",
};

export default function ListaServizi() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Servizio | null>(null);
  const [editForm, setEditForm] = useState({ luogo_inizio: "", luogo_fine: "", itinerario: "", info_autista: "", note: "" });

  const loadServizi = async () => {
    if (!user) return;
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!client) return;

    let query = supabase
      .from("servizi")
      .select("*")
      .eq("client_id", client.id)
      .order("data_servizio", { ascending: false });

    if (dateFrom) query = query.gte("data_servizio", dateFrom);
    if (dateTo) query = query.lte("data_servizio", dateTo);

    const { data } = await query;
    setServizi((data ?? []) as Servizio[]);
    setLoading(false);
  };

  useEffect(() => { loadServizi(); }, [user, dateFrom, dateTo]);

  const filtered = servizi.filter((s) =>
    (s.contatto ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.citta ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.codice ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s: Servizio) => {
    setEditing(s);
    setEditForm({
      luogo_inizio: s.luogo_inizio ?? "",
      luogo_fine: s.luogo_fine ?? "",
      itinerario: s.itinerario ?? "",
      info_autista: s.info_autista ?? "",
      note: s.note ?? "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("servizi")
      .update({
        luogo_inizio: editForm.luogo_inizio || null,
        luogo_fine: editForm.luogo_fine || null,
        itinerario: editForm.itinerario || null,
        info_autista: editForm.info_autista || null,
        note: editForm.note || null,
      } as any)
      .eq("id", editing.id);

    if (error) {
      toast.error("Errore nel salvataggio");
    } else {
      toast.success("Servizio aggiornato");
      setEditOpen(false);
      loadServizi();
    }
  };

  const handleCancel = async (s: Servizio) => {
    if (!canModify(s)) {
      toast.error("Non è possibile annullare: mancano meno di 12 ore al servizio");
      return;
    }
    const ok = window.confirm("Sei sicuro di voler annullare questo servizio?");
    if (!ok) return;
    const { error } = await supabase
      .from("servizi")
      .update({ stato: "annullato" } as any)
      .eq("id", s.id);
    if (error) {
      toast.error("Errore nell'annullamento");
    } else {
      toast.success("Servizio annullato");
      loadServizi();
    }
  };

  const exportExcel = () => {
    const headers = ["Città", "Data", "Ora", "Passeggero", "N.P", "N.bg", "T.serv", "Luogo inizio", "Itinerario", "Luogo fine", "Veicolo", "T.P", "Centro Costo", "Stato"];
    const rows = filtered.map(s => [
      s.citta ?? "", s.data_servizio, s.ora_inizio ?? "", s.contatto ?? "", s.n_passeggeri ?? "",
      s.n_bagagli ?? "", buildTipoServizio(s), s.luogo_inizio ?? "", s.itinerario ?? "",
      s.luogo_fine ?? "", s.veicolo_tipo ?? "", pagamentoLabel[s.tipo_pagamento ?? ""] ?? "",
      s.centro_costo ?? "", statoLabel[s.stato] ?? s.stato
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "servizi.csv";
    a.click();
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Lista Servizi</h1>

        {/* Info */}
        <Card className="rounded-xl border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-0.5 text-xs">
                <p><strong>Modifica e Annulla:</strong> fino a 12 ore prima dell'orario del servizio.</p>
                <p><strong>Valutazione:</strong> trascorso l'orario potete darci la valutazione del servizio erogato.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtri */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Zona Ricerca</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Periodo da</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Periodo a</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Passeggero / Codice</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="pl-8 rounded-lg h-9" />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={exportExcel}>
                  <Download className="h-3.5 w-3.5" /> Esporta CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabella */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Nessun servizio trovato</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Città</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Passeggero</TableHead>
                      <TableHead>N.P</TableHead>
                      <TableHead>N.bg</TableHead>
                      <TableHead>T.serv</TableHead>
                      <TableHead>Luogo inizio</TableHead>
                      <TableHead>Itinerario</TableHead>
                      <TableHead>Luogo fine</TableHead>
                      <TableHead>Veicolo</TableHead>
                      <TableHead>T.P</TableHead>
                      <TableHead>C. Costo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => {
                      const editable = canModify(s);
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.citta ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(s.data_servizio).toLocaleDateString("it-IT")}
                            {s.ora_inizio && <span className="text-muted-foreground ml-1 text-xs">{s.ora_inizio}</span>}
                          </TableCell>
                          <TableCell>{s.contatto ?? "—"}</TableCell>
                          <TableCell>{s.n_passeggeri ?? 0}</TableCell>
                          <TableCell>{s.n_bagagli ?? 0}</TableCell>
                          <TableCell className="text-xs max-w-[160px]">{buildTipoServizio(s)}</TableCell>
                          <TableCell>{s.luogo_inizio ?? "—"}</TableCell>
                          <TableCell>{s.itinerario ?? "—"}</TableCell>
                          <TableCell>{s.luogo_fine ?? "—"}</TableCell>
                          <TableCell className="text-xs">{s.veicolo_tipo ?? "—"}</TableCell>
                          <TableCell className="text-xs">{pagamentoLabel[s.tipo_pagamento ?? ""] ?? "—"}</TableCell>
                          <TableCell className="text-xs">{s.centro_costo ?? "—"}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              s.stato === "annullato" ? "bg-destructive/10 text-destructive" :
                              s.stato === "completato" ? "bg-green-100 text-green-700" :
                              "bg-muted"
                            }`}>
                              {statoLabel[s.stato] ?? s.stato}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {editable && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                                    <Pencil className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCancel(s)}>
                                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </>
                              )}
                              {!editable && s.stato !== "annullato" && (
                                <span className="text-[10px] text-muted-foreground">Non modificabile</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>Modifica servizio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Luogo inizio</Label>
                <Input value={editForm.luogo_inizio} onChange={(e) => setEditForm(p => ({ ...p, luogo_inizio: e.target.value }))} className="rounded-lg h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Luogo fine</Label>
                <Input value={editForm.luogo_fine} onChange={(e) => setEditForm(p => ({ ...p, luogo_fine: e.target.value }))} className="rounded-lg h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Itinerario</Label>
                <Input value={editForm.itinerario} onChange={(e) => setEditForm(p => ({ ...p, itinerario: e.target.value }))} className="rounded-lg h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Info autista</Label>
                <Input value={editForm.info_autista} onChange={(e) => setEditForm(p => ({ ...p, info_autista: e.target.value }))} className="rounded-lg h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Textarea value={editForm.note} onChange={(e) => setEditForm(p => ({ ...p, note: e.target.value }))} className="rounded-lg min-h-[60px]" />
              </div>
              <Button className="w-full rounded-lg h-10" onClick={handleSaveEdit}>Salva modifiche</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ClientPortalLayout>
  );
}
