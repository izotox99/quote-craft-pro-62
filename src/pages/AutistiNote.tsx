import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { StickyNote, Plus, Paperclip, Trash2, Pencil } from "lucide-react";
import { romeDateTimeLabel } from "@/lib/romeDate";

type Autista = { id: string; nome: string | null; cognome: string | null };
const nomeAutista = (a?: Autista) => (a ? `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() : "—");

const prioritaBadge = (p: string) =>
  p === "urgente" ? "destructive" : p === "importante" ? "default" : "secondary";

export default function AutistiNote() {
  const navigate = useNavigate();
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [note, setNote] = useState<any[]>([]);
  const [letture, setLetture] = useState<any[]>([]);
  const [filtroAutista, setFiltroAutista] = useState("tutti");
  const [q, setQ] = useState("");
  const [aperta, setAperta] = useState<any | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: c }, { data: l }] = await Promise.all([
      supabase.from("autisti").select("id, nome, cognome").order("cognome"),
      supabase.from("comunicazioni").select("*").eq("destinatari", "singolo").order("pubblicata_at", { ascending: false }),
      supabase.from("comunicazioni_letture").select("comunicazione_id, autista_id, letta_at"),
    ]);
    setAutisti((a ?? []) as Autista[]);
    setNote(c ?? []);
    setLetture(l ?? []);
  };
  useEffect(() => { load(); }, []);

  const autistaById = useMemo(() => {
    const m = new Map<string, Autista>();
    autisti.forEach((a) => m.set(a.id, a));
    return m;
  }, [autisti]);

  const letturaDi = (n: any) =>
    letture.find((l) => l.comunicazione_id === n.id && l.autista_id === n.autista_id);

  const filtered = note.filter((n) => {
    if (filtroAutista !== "tutti" && n.autista_id !== filtroAutista) return false;
    if (q.trim()) {
      const s = `${n.titolo} ${n.testo} ${nomeAutista(autistaById.get(n.autista_id))}`.toLowerCase();
      if (!s.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const apriAllegato = async (path: string) => {
    const { data, error } = await supabase.storage.from("allegati-autisti").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Impossibile aprire il file");
    window.open(data.signedUrl, "_blank");
  };

  const elimina = async (id: string) => {
    if (!confirm("Eliminare definitivamente questa nota?")) return;
    await supabase.from("comunicazioni_letture").delete().eq("comunicazione_id", id);
    const { error } = await supabase.from("comunicazioni").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Nota eliminata");
    setAperta(null);
    load();
  };

  const salvaModifica = async () => {
    if (!edit) return;
    if (!edit.titolo?.trim() || !edit.testo?.trim()) return toast.error("Compila titolo e testo");
    setSaving(true);
    const { error } = await supabase.from("comunicazioni").update({
      titolo: edit.titolo.trim(),
      testo: edit.testo.trim(),
      priorita: edit.priorita,
    }).eq("id", edit.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Nota aggiornata");
    setEdit(null);
    setAperta(null);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Note autisti</h1>
          </div>
          <Button onClick={() => navigate("/autisti/nuova-nota")}>
            <Plus className="h-4 w-4 mr-2" />Nuova nota
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 min-w-[220px]">
              <Label>Autista</Label>
              <Select value={filtroAutista} onValueChange={setFiltroAutista}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti gli autisti</SelectItem>
                  {autisti.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{nomeAutista(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[220px]">
              <Label>Ricerca</Label>
              <Input placeholder="Titolo o testo…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Autista</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Estratto</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Lettura</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessuna nota trovata</TableCell></TableRow>
                )}
                {filtered.map((n) => {
                  const lettura = letturaDi(n);
                  return (
                    <TableRow key={n.id} className="cursor-pointer" onClick={() => setAperta(n)}>
                      <TableCell className="font-medium">{nomeAutista(autistaById.get(n.autista_id))}</TableCell>
                      <TableCell>{n.titolo}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">{n.testo}</TableCell>
                      <TableCell><Badge variant={prioritaBadge(n.priorita) as any}>{n.priorita}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{romeDateTimeLabel(n.pubblicata_at)}</TableCell>
                      <TableCell>
                        {lettura
                          ? <Badge variant="outline">Letta {romeDateTimeLabel(lettura.letta_at)}</Badge>
                          : <Badge variant="secondary">Non letta</Badge>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => setEdit({ ...n })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => elimina(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!aperta} onOpenChange={(o) => !o && setAperta(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{aperta?.titolo}</DialogTitle></DialogHeader>
          {aperta && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant={prioritaBadge(aperta.priorita) as any}>{aperta.priorita}</Badge>
                <span className="text-muted-foreground">A: {nomeAutista(autistaById.get(aperta.autista_id))}</span>
                <span className="text-muted-foreground">{romeDateTimeLabel(aperta.pubblicata_at)}</span>
                {letturaDi(aperta)
                  ? <Badge variant="outline">Letta {romeDateTimeLabel(letturaDi(aperta).letta_at)}</Badge>
                  : <Badge variant="secondary">Non letta</Badge>}
              </div>
              <p className="whitespace-pre-wrap">{aperta.testo}</p>
              {aperta.allegato_path && (
                <Button variant="outline" size="sm" onClick={() => apriAllegato(aperta.allegato_path)}>
                  <Paperclip className="h-4 w-4 mr-2" />{aperta.allegato_nome ?? "Allegato"}
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit({ ...aperta })}>Modifica</Button>
            <Button variant="destructive" onClick={() => aperta && elimina(aperta.id)}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica nota</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Titolo</Label>
                <Input value={edit.titolo ?? ""} onChange={(e) => setEdit({ ...edit, titolo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Testo</Label>
                <Textarea rows={6} value={edit.testo ?? ""} onChange={(e) => setEdit({ ...edit, testo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Priorità</Label>
                <Select value={edit.priorita} onValueChange={(v) => setEdit({ ...edit, priorita: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="importante">Importante</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Annulla</Button>
            <Button onClick={salvaModifica} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
