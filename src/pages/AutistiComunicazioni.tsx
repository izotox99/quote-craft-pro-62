import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Megaphone, MessageSquare, Receipt, CreditCard, Paperclip, Send, Eye, Plus } from "lucide-react";

type Autista = { id: string; nome: string | null; cognome: string | null };
const nomeAutista = (a?: Autista) => a ? `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() : "—";

const PRIORITA = [
  { v: "normale", label: "Normale" },
  { v: "importante", label: "Importante" },
  { v: "urgente", label: "Urgente" },
];

export default function AutistiComunicazioni() {
  const { organization } = useAuth();
  const orgId = organization?.id as string | undefined;
  const [tab, setTab] = useState("comunicazioni");
  const [autisti, setAutisti] = useState<Autista[]>([]);

  const [comunicazioni, setComunicazioni] = useState<any[]>([]);
  const [letture, setLetture] = useState<any[]>([]);
  const [openCom, setOpenCom] = useState(false);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    titolo: "", testo: "", priorita: "normale", destinatari: "tutti", autista_id: "", scade_at: "",
  });
  const [letturePer, setLetturePer] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<any[]>([]);
  const [rispostaFb, setRispostaFb] = useState<{ id: string; testo: string } | null>(null);

  const [spese, setSpese] = useState<any[]>([]);
  const [filtri, setFiltri] = useState({ autista_id: "", dal: "", al: "" });

  const [carte, setCarte] = useState<any[]>([]);
  const [openCarta, setOpenCarta] = useState(false);
  const [carta, setCarta] = useState<any>({ stato: "attiva" });

  const loadBase = async () => {
    const { data: a } = await supabase.from("autisti").select("id, nome, cognome").eq("attivo", true).order("cognome");
    setAutisti((a ?? []) as Autista[]);
  };
  const loadComunicazioni = async () => {
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("comunicazioni").select("*").order("pubblicata_at", { ascending: false }),
      supabase.from("comunicazioni_letture").select("comunicazione_id, autista_id, letta_at"),
    ]);
    setComunicazioni(c ?? []);
    setLetture(l ?? []);
  };
  const loadFeedback = async () => {
    const { data } = await supabase.from("autisti_feedback").select("*").order("created_at", { ascending: false });
    setFeedback(data ?? []);
  };
  const loadSpese = async () => {
    let q = supabase.from("autisti_spese").select("*").order("data_intervento", { ascending: false });
    if (filtri.autista_id) q = q.eq("autista_id", filtri.autista_id);
    if (filtri.dal) q = q.gte("data_intervento", filtri.dal);
    if (filtri.al) q = q.lte("data_intervento", filtri.al);
    const { data } = await q;
    setSpese(data ?? []);
  };
  const loadCarte = async () => {
    const { data } = await supabase.from("autisti_carte").select("*").order("created_at", { ascending: false });
    setCarte(data ?? []);
  };

  useEffect(() => { loadBase(); loadComunicazioni(); loadFeedback(); loadCarte(); }, []);
  useEffect(() => { loadSpese(); }, [filtri.autista_id, filtri.dal, filtri.al]);

  const inviaComunicazione = async () => {
    if (!form.titolo.trim() || !form.testo.trim()) return toast.error("Compila titolo e testo");
    if (form.destinatari === "singolo" && !form.autista_id) return toast.error("Seleziona l'autista destinatario");
    if (!orgId) return toast.error("Organizzazione non trovata");
    setSending(true);
    try {
      let allegato_path: string | null = null;
      if (file) {
        const path = `${orgId}/comunicazioni/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("allegati-autisti").upload(path, file);
        if (upErr) throw upErr;
        allegato_path = path;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("comunicazioni").insert([{
        org_id: orgId,
        titolo: form.titolo.trim(),
        testo: form.testo.trim(),
        priorita: form.priorita,
        destinatari: form.destinatari,
        autista_id: form.destinatari === "singolo" ? form.autista_id : null,
        allegato_path,
        allegato_nome: file?.name ?? null,
        scade_at: form.scade_at ? new Date(form.scade_at).toISOString() : null,
        created_by: user?.id ?? null,
      }]);
      if (error) throw error;
      toast.success("Comunicazione inviata");
      setOpenCom(false); setFile(null);
      setForm({ titolo: "", testo: "", priorita: "normale", destinatari: "tutti", autista_id: "", scade_at: "" });
      loadComunicazioni();
    } catch (e: any) {
      toast.error(e.message ?? "Invio non riuscito");
    } finally { setSending(false); }
  };

  const apriAllegato = async (path: string) => {
    const { data, error } = await supabase.storage.from("allegati-autisti").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Impossibile aprire il file");
    window.open(data.signedUrl, "_blank");
  };

  const salvaRisposta = async () => {
    if (!rispostaFb) return;
    const { error } = await supabase.from("autisti_feedback")
      .update({ risposta: rispostaFb.testo, stato: "gestito" }).eq("id", rispostaFb.id);
    if (error) return toast.error(error.message);
    toast.success("Risposta inviata");
    setRispostaFb(null); loadFeedback();
  };

  const cambiaStatoFb = async (id: string, stato: string) => {
    const { error } = await supabase.from("autisti_feedback").update({ stato }).eq("id", id);
    if (error) return toast.error(error.message);
    loadFeedback();
  };

  const salvaCarta = async () => {
    if (!carta.autista_id || !carta.intestazione) return toast.error("Autista e intestazione obbligatori");
    if (!orgId) return;
    const payload = {
      org_id: orgId,
      autista_id: carta.autista_id,
      intestazione: carta.intestazione,
      ultime_quattro: carta.ultime_quattro || null,
      scadenza: carta.scadenza || null,
      plafond: carta.plafond ? Number(String(carta.plafond).replace(",", ".")) : null,
      stato: carta.stato ?? "attiva",
      note: carta.note || null,
    };
    const { error } = carta.id
      ? await supabase.from("autisti_carte").update(payload).eq("id", carta.id)
      : await supabase.from("autisti_carte").insert([payload]);
    if (error) return toast.error(error.message);
    toast.success("Carta salvata");
    setOpenCarta(false); setCarta({ stato: "attiva" }); loadCarte();
  };

  const totaleSpese = spese.reduce((s, r) => s + (Number(r.importo_spese) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Comunicazioni autisti</h1>
            <p className="text-sm text-muted-foreground">Comunicazioni, note, feedback, carte e spese</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="comunicazioni" className="gap-2"><Megaphone className="h-4 w-4" /> Comunicazioni</TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2"><MessageSquare className="h-4 w-4" /> Feedback</TabsTrigger>
            <TabsTrigger value="spese" className="gap-2"><Receipt className="h-4 w-4" /> Spese</TabsTrigger>
            <TabsTrigger value="carte" className="gap-2"><CreditCard className="h-4 w-4" /> Carte</TabsTrigger>
          </TabsList>

          {/* COMUNICAZIONI */}
          <TabsContent value="comunicazioni" className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => setOpenCom(true)}><Plus className="h-4 w-4" /> Nuova comunicazione</Button>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Priorità</TableHead>
                    <TableHead className="text-right">Letture</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comunicazioni.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nessuna comunicazione</TableCell></TableRow>
                  )}
                  {comunicazioni.map((c) => {
                    const n = letture.filter((l) => l.comunicazione_id === c.id).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{new Date(c.pubblicata_at).toLocaleDateString("it-IT")}</TableCell>
                        <TableCell className="font-medium">{c.titolo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {c.destinatari === "singolo"
                              ? `Nota · ${nomeAutista(autisti.find((a) => a.id === c.autista_id))}`
                              : "Comunicazione"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            c.priorita === "urgente" ? "bg-red-100 text-red-700 hover:bg-red-100"
                            : c.priorita === "importante" ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                            {c.priorita}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{n}</TableCell>
                        <TableCell className="text-right">
                          {c.allegato_path && (
                            <Button variant="ghost" size="icon" onClick={() => apriAllegato(c.allegato_path)}><Paperclip className="h-4 w-4" /></Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setLetturePer(c.id)}><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* FEEDBACK */}
          <TabsContent value="feedback" className="space-y-3">
            {feedback.length === 0 && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nessun feedback ricevuto</CardContent></Card>
            )}
            {feedback.map((f) => (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span>{nomeAutista(autisti.find((a) => a.id === f.autista_id))} · {new Date(f.data).toLocaleDateString("it-IT")}</span>
                    <Badge variant={f.stato === "gestito" ? "default" : "outline"}>{f.stato}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{f.testo}</p>
                  {f.risposta && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                      <div className="text-[10px] font-semibold text-emerald-700 uppercase">Risposta</div>
                      <p className="mt-1 whitespace-pre-wrap">{f.risposta}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setRispostaFb({ id: f.id, testo: f.risposta ?? "" })}>
                      <Send className="h-4 w-4" /> Rispondi
                    </Button>
                    {f.stato !== "gestito" && (
                      <Button size="sm" variant="ghost" onClick={() => cambiaStatoFb(f.id, "gestito")}>Segna come gestito</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* SPESE */}
          <TabsContent value="spese" className="space-y-4">
            <Card className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label>Autista</Label>
                <Select value={filtri.autista_id || "tutti"} onValueChange={(v) => setFiltri({ ...filtri, autista_id: v === "tutti" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    {autisti.map((a) => <SelectItem key={a.id} value={a.id}>{nomeAutista(a)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Dal</Label><Input type="date" value={filtri.dal} onChange={(e) => setFiltri({ ...filtri, dal: e.target.value })} /></div>
              <div><Label>Al</Label><Input type="date" value={filtri.al} onChange={(e) => setFiltri({ ...filtri, al: e.target.value })} /></div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Totale periodo</div>
                <div className="text-xl font-semibold tabular-nums">
                  {totaleSpese.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                </div>
              </div>
            </Card>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Autista</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="hidden md:table-cell">Note</TableHead>
                    <TableHead className="text-right">Giustificativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spese.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nessuna spesa</TableCell></TableRow>
                  )}
                  {spese.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.data_intervento ? new Date(s.data_intervento).toLocaleDateString("it-IT") : "—"}</TableCell>
                      <TableCell className="font-medium">{nomeAutista(autisti.find((a) => a.id === s.autista_id))}</TableCell>
                      <TableCell className="capitalize">{s.categoria ?? s.tipo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(s.importo_spese ?? 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.note ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {s.foto_path
                          ? <Button variant="ghost" size="icon" onClick={() => apriAllegato(s.foto_path)}><Receipt className="h-4 w-4" /></Button>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* CARTE */}
          <TabsContent value="carte" className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => { setCarta({ stato: "attiva" }); setOpenCarta(true); }}>
                <Plus className="h-4 w-4" /> Nuova carta
              </Button>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Autista</TableHead>
                    <TableHead>Intestazione</TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead className="text-right">Plafond</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carte.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nessuna carta assegnata</TableCell></TableRow>
                  )}
                  {carte.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{nomeAutista(autisti.find((a) => a.id === c.autista_id))}</TableCell>
                      <TableCell>{c.intestazione}</TableCell>
                      <TableCell className="tabular-nums">•••• {c.ultime_quattro ?? "••••"}</TableCell>
                      <TableCell className="tabular-nums">{c.scadenza ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.plafond != null ? Number(c.plafond).toLocaleString("it-IT", { style: "currency", currency: "EUR" }) : "—"}
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.stato}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setCarta(c); setOpenCarta(true); }}>Modifica</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog nuova comunicazione */}
      <Dialog open={openCom} onOpenChange={setOpenCom}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuova comunicazione</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titolo</Label><Input value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} maxLength={150} /></div>
            <div><Label>Testo</Label><Textarea rows={5} value={form.testo} onChange={(e) => setForm({ ...form, testo: e.target.value })} maxLength={4000} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priorità</Label>
                <Select value={form.priorita} onValueChange={(v) => setForm({ ...form, priorita: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITA.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destinatari</Label>
                <Select value={form.destinatari} onValueChange={(v) => setForm({ ...form, destinatari: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti gli autisti</SelectItem>
                    <SelectItem value="singolo">Nota a un autista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.destinatari === "singolo" && (
              <div>
                <Label>Autista</Label>
                <Select value={form.autista_id || undefined} onValueChange={(v) => setForm({ ...form, autista_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{autisti.map((a) => <SelectItem key={a.id} value={a.id}>{nomeAutista(a)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Scade il (facoltativo)</Label><Input type="date" value={form.scade_at} onChange={(e) => setForm({ ...form, scade_at: e.target.value })} /></div>
              <div><Label>Allegato</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCom(false)}>Annulla</Button>
            <Button onClick={inviaComunicazione} disabled={sending}>Invia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog letture */}
      <Dialog open={!!letturePer} onOpenChange={(o) => !o && setLetturePer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chi ha letto</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-auto">
            {letture.filter((l) => l.comunicazione_id === letturePer).length === 0 && (
              <p className="text-sm text-muted-foreground">Nessuna lettura registrata</p>
            )}
            {letture.filter((l) => l.comunicazione_id === letturePer).map((l) => (
              <div key={l.autista_id} className="flex items-center justify-between text-sm border-b pb-1">
                <span>{nomeAutista(autisti.find((a) => a.id === l.autista_id))}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(l.letta_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog risposta feedback */}
      <Dialog open={!!rispostaFb} onOpenChange={(o) => !o && setRispostaFb(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rispondi al feedback</DialogTitle></DialogHeader>
          <Textarea rows={5} value={rispostaFb?.testo ?? ""} onChange={(e) => setRispostaFb({ ...(rispostaFb as any), testo: e.target.value })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRispostaFb(null)}>Annulla</Button>
            <Button onClick={salvaRisposta}>Invia risposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog carta */}
      <Dialog open={openCarta} onOpenChange={setOpenCarta}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{carta?.id ? "Modifica carta" : "Nuova carta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Autista</Label>
              <Select value={carta?.autista_id ?? undefined} onValueChange={(v) => setCarta({ ...carta, autista_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{autisti.map((a) => <SelectItem key={a.id} value={a.id}>{nomeAutista(a)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Intestazione</Label><Input value={carta?.intestazione ?? ""} onChange={(e) => setCarta({ ...carta, intestazione: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ultime 4 cifre</Label>
                <Input inputMode="numeric" maxLength={4} value={carta?.ultime_quattro ?? ""} onChange={(e) => setCarta({ ...carta, ultime_quattro: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div><Label>Scadenza (MM/AA)</Label><Input value={carta?.scadenza ?? ""} onChange={(e) => setCarta({ ...carta, scadenza: e.target.value })} placeholder="12/28" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plafond (€)</Label><Input inputMode="decimal" value={carta?.plafond ?? ""} onChange={(e) => setCarta({ ...carta, plafond: e.target.value })} /></div>
              <div>
                <Label>Stato</Label>
                <Select value={carta?.stato ?? "attiva"} onValueChange={(v) => setCarta({ ...carta, stato: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attiva">Attiva</SelectItem>
                    <SelectItem value="sospesa">Sospesa</SelectItem>
                    <SelectItem value="revocata">Revocata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Note</Label><Textarea rows={3} value={carta?.note ?? ""} onChange={(e) => setCarta({ ...carta, note: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Il numero completo della carta non viene mai memorizzato.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCarta(false)}>Annulla</Button>
            <Button onClick={salvaCarta}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
