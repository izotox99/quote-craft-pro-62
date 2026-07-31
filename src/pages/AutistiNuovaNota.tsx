import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, StickyNote } from "lucide-react";

type Autista = { id: string; nome: string | null; cognome: string | null };
const nomeAutista = (a?: Autista) => (a ? `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() : "—");

export default function AutistiNuovaNota() {
  const { organization } = useAuth();
  const orgId = organization?.id as string | undefined;
  const navigate = useNavigate();
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ autista_id: "", titolo: "", testo: "", priorita: "normale", scade_at: "" });

  useEffect(() => {
    supabase
      .from("autisti")
      .select("id, nome, cognome")
      .eq("attivo", true)
      .order("cognome")
      .then(({ data }) => setAutisti((data ?? []) as Autista[]));
  }, []);

  const invia = async () => {
    if (!form.autista_id) return toast.error("Seleziona l'autista destinatario");
    if (!form.titolo.trim() || !form.testo.trim()) return toast.error("Compila titolo e testo");
    if (!orgId) return toast.error("Organizzazione non trovata");
    setSending(true);
    try {
      let allegato_path: string | null = null;
      if (file) {
        const path = `${orgId}/note/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
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
        destinatari: "singolo",
        autista_id: form.autista_id,
        allegato_path,
        allegato_nome: file?.name ?? null,
        scade_at: form.scade_at ? new Date(form.scade_at).toISOString() : null,
        created_by: user?.id ?? null,
      }]);
      if (error) throw error;
      toast.success("Nota inviata all'autista");
      navigate("/autisti/note");
    } catch (e: any) {
      toast.error(e.message ?? "Invio non riuscito");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Nuova nota autista</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nota personale a un singolo autista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Autista destinatario *</Label>
              <Select value={form.autista_id} onValueChange={(v) => setForm({ ...form, autista_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona autista" /></SelectTrigger>
                <SelectContent>
                  {autisti.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{nomeAutista(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Titolo *</Label>
              <Input value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Testo *</Label>
              <Textarea rows={6} value={form.testo} onChange={(e) => setForm({ ...form, testo: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Priorità</Label>
                <Select value={form.priorita} onValueChange={(v) => setForm({ ...form, priorita: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="importante">Importante</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Scadenza (opzionale)</Label>
                <Input type="datetime-local" value={form.scade_at} onChange={(e) => setForm({ ...form, scade_at: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Allegato (opzionale)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/autisti/note")}>Annulla</Button>
              <Button onClick={invia} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />{sending ? "Invio…" : "Invia nota"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
