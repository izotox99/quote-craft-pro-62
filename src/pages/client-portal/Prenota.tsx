import { useState, useEffect } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarPlus, Send } from "lucide-react";

export default function Prenota() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    data_servizio: "",
    tipologia: "transfer",
    contatto: "",
    telefono_contatto: "",
    n_passeggeri: "1",
    n_bagagli: "0",
    luogo_inizio: "",
    luogo_fine: "",
    itinerario: "",
    citta: "",
    note: "",
  });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, org_id")
        .eq("auth_user_id", user.id)
        .single();
      if (data) {
        setClientId(data.id);
        setOrgId(data.org_id);
      }
    };
    load();
  }, [user]);

  const set = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data_servizio || !form.contatto) {
      toast.error("Data servizio e passeggero sono obbligatori");
      return;
    }
    if (!clientId || !orgId) return;

    setLoading(true);
    const { error } = await supabase.from("servizi").insert({
      data_servizio: form.data_servizio,
      tipologia: form.tipologia as any,
      contatto: form.contatto,
      telefono_contatto: form.telefono_contatto || null,
      n_passeggeri: parseInt(form.n_passeggeri) || 1,
      n_bagagli: parseInt(form.n_bagagli) || 0,
      luogo_inizio: form.luogo_inizio || null,
      luogo_fine: form.luogo_fine || null,
      itinerario: form.itinerario || null,
      citta: form.citta || null,
      note: form.note || null,
      client_id: clientId,
      org_id: orgId,
      stato: "nuovo" as any,
    } as any);

    if (error) {
      toast.error("Errore nella prenotazione: " + error.message);
    } else {
      toast.success("Prenotazione inviata con successo!");
      setForm({
        data_servizio: "", tipologia: "transfer", contatto: "", telefono_contatto: "",
        n_passeggeri: "1", n_bagagli: "0", luogo_inizio: "", luogo_fine: "",
        itinerario: "", citta: "", note: "",
      });
    }
    setLoading(false);
  };

  return (
    <ClientPortalLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <CalendarPlus className="h-6 w-6 text-primary" />
          Prenota un servizio
        </h1>

        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Data servizio *</Label>
                  <Input type="date" value={form.data_servizio} onChange={(e) => set("data_servizio", e.target.value)} className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tipologia</Label>
                  <Select value={form.tipologia} onValueChange={(v) => set("tipologia", v)}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="disposizione">Disposizione</SelectItem>
                      <SelectItem value="tour">Tour</SelectItem>
                      <SelectItem value="evento">Evento</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Passeggero *</Label>
                  <Input value={form.contatto} onChange={(e) => set("contatto", e.target.value)} placeholder="Nome passeggero" className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Telefono contatto</Label>
                  <Input value={form.telefono_contatto} onChange={(e) => set("telefono_contatto", e.target.value)} placeholder="+39..." className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">N. passeggeri</Label>
                  <Input type="number" value={form.n_passeggeri} onChange={(e) => set("n_passeggeri", e.target.value)} className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">N. bagagli</Label>
                  <Input type="number" value={form.n_bagagli} onChange={(e) => set("n_bagagli", e.target.value)} className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Città</Label>
                  <Input value={form.citta} onChange={(e) => set("citta", e.target.value)} placeholder="Roma" className="rounded-lg h-10" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Luogo inizio</Label>
                  <Input value={form.luogo_inizio} onChange={(e) => set("luogo_inizio", e.target.value)} placeholder="Aeroporto Fiumicino" className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Luogo fine</Label>
                  <Input value={form.luogo_fine} onChange={(e) => set("luogo_fine", e.target.value)} placeholder="Hotel Roma" className="rounded-lg h-10" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Itinerario</Label>
                <Input value={form.itinerario} onChange={(e) => set("itinerario", e.target.value)} placeholder="Descrivi il percorso" className="rounded-lg h-10" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Note</Label>
                <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Note aggiuntive..." className="rounded-lg min-h-[80px]" />
              </div>

              <Button type="submit" className="w-full h-11 rounded-lg text-base font-medium gap-2" disabled={loading}>
                <Send className="h-4 w-4" />
                {loading ? "Invio in corso..." : "Invia prenotazione"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
