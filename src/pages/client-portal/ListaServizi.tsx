import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { Search, Download, CalendarDays, Pencil, XCircle, Info, ChevronRight, MapPin, Clock, Users, Car, Lock } from "lucide-react";
import { toast } from "sonner";

const VEICOLI_DISPONIBILI = [
  "Autovettura 3 posti",
  "Luxury Car Serie S",
  "Minivan 7/8 posti",
  "Minivan 7 posti classe V",
  "Minibus 8 posti",
  "Minibus 16 Posti",
  "Bus 52 posti",
  "Veicolo disabili",
  "Servizio guida",
];

const TRANSFER_OPZIONI = [
  "Da / Per altro Luogo", "Da Aeroporto", "Da Civitavecchia", "Da Stazione",
  "Interno Città", "Per Aeroporto", "Per Civitavecchia", "Per Stazione",
];

const DISPOSIZIONE_OPZIONI = [
  "3 Ore", "4 Ore", "5 Ore", "6 Ore", "7 Ore", "8 Ore",
  "9 Ore", "10 Ore", "11 Ore", "12 Ore", "Mezza giornata", "Giornata intera",
];

const TOUR_OPZIONI = [
  "Da Civitavecchia Full Day", "Full Day Fuori Roma", "Full Day Roma",
  "Half Day Fuori Roma", "Half Day Roma",
];

const PAGAMENTO_OPZIONI = [
  { value: "fattura", label: "Fattura" },
  { value: "contante", label: "Contante" },
  { value: "carta_credito", label: "C. Credito" },
];

const TIPOLOGIA_OPZIONI = ["transfer", "disposizione", "tour"];

type Servizio = {
  id: string;
  data_servizio: string;
  ora_inizio: string | null;
  citta: string | null;
  contatto: string | null;
  telefono_contatto: string | null;
  email_contatto: string | null;
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
  prezzo: number | null;
  centro_costo: string | null;
  stato: string;
  codice: string | null;
  note: string | null;
  accessori: string | null;
};

function canModify(s: Servizio): boolean {
  if (s.stato === "annullato" || s.stato === "completato") return false;
  if (!s.ora_inizio || !s.data_servizio) return true;
  const serviceDate = new Date(`${s.data_servizio}T${s.ora_inizio}`);
  const now = new Date();
  return (serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60) > 12;
}

function buildTipoServizio(s: Servizio): string {
  const parts: string[] = [];
  if (s.transfer_tipo) parts.push(`Transfer: ${s.transfer_tipo}`);
  if (s.disposizione_oraria) parts.push(`Disp.: ${s.disposizione_oraria}`);
  if (s.tour_tipo) parts.push(`Tour: ${s.tour_tipo}`);
  if (parts.length === 0 && s.tipologia) return s.tipologia;
  return parts.join(" / ") || "—";
}

function buildTipoShort(s: Servizio): string {
  if (s.tour_tipo) return "Tour";
  if (s.transfer_tipo && s.disposizione_oraria) return "Transfer + Disp.";
  if (s.transfer_tipo) return "Transfer";
  if (s.disposizione_oraria) return "Disposizione";
  return s.tipologia ?? "—";
}

const pagamentoLabel: Record<string, string> = {
  fattura: "Fattura",
  contante: "Contante",
  carta_credito: "C. Credito",
};

const statoConfig: Record<string, { label: string; className: string }> = {
  nuovo: { label: "Nuovo", className: "bg-blue-100 text-blue-700 border-blue-200" },
  confermato: { label: "Confermato", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  in_corso: { label: "In corso", className: "bg-amber-100 text-amber-700 border-amber-200" },
  completato: { label: "Completato", className: "bg-green-100 text-green-700 border-green-200" },
  annullato: { label: "Annullato", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2">
      <span className="text-xs text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="text-sm text-right ml-4">{value}</span>
    </div>
  );
}

export default function ListaServizi() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail sheet
  const [selected, setSelected] = useState<Servizio | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    data_servizio: "",
    ora_inizio: "",
    citta: "",
    n_passeggeri: "1",
    n_bagagli: "0",
    tipologia: "" as string,
    transfer_tipo: "",
    disposizione_oraria: "",
    tour_tipo: "",
    veicolo_tipo: "",
    luogo_inizio: "",
    luogo_fine: "",
    itinerario: "",
    info_autista: "",
    tipo_pagamento: "",
    centro_costo: "",
    accessori: "",
    note: "",
  });

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

  const openDetail = (s: Servizio) => {
    setSelected(s);
    setDetailOpen(true);
  };

  const openEdit = (s: Servizio) => {
    setSelected(s);
    setEditForm({
      data_servizio: s.data_servizio ?? "",
      ora_inizio: s.ora_inizio ?? "",
      citta: s.citta ?? "",
      n_passeggeri: String(s.n_passeggeri ?? 1),
      n_bagagli: String(s.n_bagagli ?? 0),
      tipologia: s.tipologia ?? "",
      transfer_tipo: s.transfer_tipo ?? "",
      disposizione_oraria: s.disposizione_oraria ?? "",
      tour_tipo: s.tour_tipo ?? "",
      veicolo_tipo: s.veicolo_tipo ?? "",
      luogo_inizio: s.luogo_inizio ?? "",
      luogo_fine: s.luogo_fine ?? "",
      itinerario: s.itinerario ?? "",
      info_autista: s.info_autista ?? "",
      tipo_pagamento: s.tipo_pagamento ?? "",
      centro_costo: s.centro_costo ?? "",
      accessori: s.accessori ?? "",
      note: s.note ?? "",
    });
    setDetailOpen(false);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const payload: any = {
      data_servizio: editForm.data_servizio || null,
      ora_inizio: editForm.ora_inizio || null,
      citta: editForm.citta || null,
      n_passeggeri: editForm.n_passeggeri ? parseInt(editForm.n_passeggeri) : null,
      n_bagagli: editForm.n_bagagli ? parseInt(editForm.n_bagagli) : null,
      tipologia: editForm.tipologia || null,
      transfer_tipo: editForm.tipologia === "transfer" ? (editForm.transfer_tipo || null) : null,
      disposizione_oraria: editForm.tipologia === "disposizione" ? (editForm.disposizione_oraria || null) : null,
      tour_tipo: editForm.tipologia === "tour" ? (editForm.tour_tipo || null) : null,
      veicolo_tipo: editForm.veicolo_tipo || null,
      luogo_inizio: editForm.luogo_inizio || null,
      luogo_fine: editForm.luogo_fine || null,
      itinerario: editForm.itinerario || null,
      info_autista: editForm.info_autista || null,
      tipo_pagamento: editForm.tipo_pagamento || null,
      centro_costo: editForm.centro_costo || null,
      accessori: editForm.accessori || null,
      note: editForm.note || null,
    };
    const { error } = await supabase.from("servizi").update(payload).eq("id", selected.id);
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
    if (!window.confirm("Sei sicuro di voler annullare questo servizio?")) return;
    const { error } = await supabase
      .from("servizi")
      .update({ stato: "annullato" } as any)
      .eq("id", s.id);
    if (error) {
      toast.error("Errore nell'annullamento");
    } else {
      toast.success("Servizio annullato");
      setDetailOpen(false);
      loadServizi();
    }
  };

  const exportExcel = () => {
    const headers = ["Città", "Data", "Ora", "Passeggero", "N.P", "N.bg", "T.serv", "Luogo inizio", "Itinerario", "Luogo fine", "Veicolo", "T.P", "Centro Costo", "Stato"];
    const rows = filtered.map(s => [
      s.citta ?? "", s.data_servizio, s.ora_inizio ?? "", s.contatto ?? "", s.n_passeggeri ?? "",
      s.n_bagagli ?? "", buildTipoServizio(s), s.luogo_inizio ?? "", s.itinerario ?? "",
      s.luogo_fine ?? "", s.veicolo_tipo ?? "", pagamentoLabel[s.tipo_pagamento ?? ""] ?? "",
      s.centro_costo ?? "", statoConfig[s.stato]?.label ?? s.stato
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "servizi.csv";
    a.click();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Lista Servizi</h1>

        {/* Info */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Modifica e annulla:</strong> fino a 12 ore prima dell'orario del servizio. Clicca su un servizio per i dettagli.
          </p>
        </div>

        {/* Filtri */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Da</label>
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data inizio" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">A</label>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data fine" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cerca</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Passeggero, città..." className="pl-8 rounded-lg h-9 text-sm" />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg w-full h-9 text-xs" onClick={exportExcel}>
                  <Download className="h-3.5 w-3.5" /> Esporta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">Nessun servizio trovato</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const stato = statoConfig[s.stato] ?? { label: s.stato, className: "bg-muted" };
              return (
                <Card
                  key={s.id}
                  className="rounded-xl border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                  onClick={() => openDetail(s)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Date block */}
                      <div className="shrink-0 text-center min-w-[56px]">
                        <div className="text-lg font-bold leading-tight">{new Date(s.data_servizio).getDate()}</div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase">
                          {new Date(s.data_servizio).toLocaleDateString("it-IT", { month: "short" })}
                        </div>
                        {s.ora_inizio && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{s.ora_inizio}</div>
                        )}
                      </div>

                      <Separator orientation="vertical" className="h-12" />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">{s.contatto ?? "—"}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${stato.className}`}>
                            {stato.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {s.citta && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{s.citta}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" />{buildTipoShort(s)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />{s.n_passeggeri ?? 1}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg rounded-xl p-0 gap-0 overflow-hidden">
            {selected && (() => {
              const stato = statoConfig[selected.stato] ?? { label: selected.stato, className: "bg-muted" };
              const editable = canModify(selected);
              return (
                <>
                  {/* Header */}
                  <div className="p-5 pb-3">
                    <DialogHeader>
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">{selected.contatto ?? "Servizio"}</DialogTitle>
                        <Badge variant="outline" className={`text-xs ${stato.className}`}>{stato.label}</Badge>
                      </div>
                    </DialogHeader>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(selected.data_servizio)}</span>
                      {selected.ora_inizio && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {selected.ora_inizio}</span>}
                      {selected.citta && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selected.citta}</span>}
                    </div>
                  </div>

                  <Separator />

                  {/* Details */}
                  <div className="p-5 space-y-1 max-h-[50vh] overflow-y-auto">
                    <DetailRow label="Tipo servizio" value={buildTipoServizio(selected)} />
                    <DetailRow label="Veicolo" value={selected.veicolo_tipo} />
                    <DetailRow label="N. passeggeri" value={String(selected.n_passeggeri ?? 1)} />
                    <DetailRow label="N. bagagli" value={String(selected.n_bagagli ?? 0)} />
                    <DetailRow label="Telefono" value={selected.telefono_contatto} />
                    <DetailRow label="Email" value={selected.email_contatto} />

                    <Separator className="my-2" />

                    <DetailRow label="Luogo inizio" value={selected.luogo_inizio} />
                    <DetailRow label="Luogo fine" value={selected.luogo_fine} />
                    <DetailRow label="Itinerario" value={selected.itinerario} />
                    <DetailRow label="Info autista" value={selected.info_autista} />

                    <Separator className="my-2" />

                    <DetailRow label="Tipo pagamento" value={pagamentoLabel[selected.tipo_pagamento ?? ""] ?? selected.tipo_pagamento} />
                    <DetailRow label="Prezzo" value={selected.prezzo != null ? `€ ${selected.prezzo.toFixed(2)}` : null} />
                    <DetailRow label="Centro di costo" value={selected.centro_costo} />
                    <DetailRow label="Accessori" value={selected.accessori} />
                    <DetailRow label="Note" value={selected.note} />
                    <DetailRow label="Codice" value={selected.codice} />
                  </div>

                  {/* Actions */}
                  {editable && (
                    <>
                      <Separator />
                      <div className="p-4 flex gap-2">
                        <Button variant="outline" className="flex-1 rounded-lg h-10 gap-2 text-sm" onClick={() => openEdit(selected)}>
                          <Pencil className="h-3.5 w-3.5" /> Modifica
                        </Button>
                        <Button variant="outline" className="flex-1 rounded-lg h-10 gap-2 text-sm text-destructive hover:text-destructive hover:bg-destructive/5" onClick={() => handleCancel(selected)}>
                          <XCircle className="h-3.5 w-3.5" /> Annulla servizio
                        </Button>
                      </div>
                    </>
                  )}
                  {!editable && selected.stato !== "annullato" && (
                    <>
                      <Separator />
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Non più modificabile (meno di 12 ore al servizio)
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

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
