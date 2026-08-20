import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FornitoriMagazzinoDialog, fetchFornitoriMagazzino, type FornitoreMagazzino } from "@/components/magazzino/FornitoriMagazzinoDialog";
import { Settings2 } from "lucide-react";
import { TIPI_CONFEZIONE, formatoConfezione } from "@/lib/magazzino";

export const UNITA = ["pz", "litri", "kg", "set", "m", "conf"];
const NESSUNO = "__nessuno__";

export default function InserisciArticolo() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [fornitori, setFornitori] = useState<FornitoreMagazzino[]>([]);
  const [fornDialog, setFornDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", unita_misura: "pz", tipo_confezione: "singolo", pezzi_per_confezione: "1", fornitore_default_id: NESSUNO, prezzo_unitario: "", scorta_minima: "0", note: "" });

  const load = async () => setFornitori((await fetchFornitoriMagazzino()).filter((f) => f.attivo));
  useEffect(() => { load(); }, []);

  const salva = async () => {
    if (!form.nome.trim()) return toast.error("Il nome dell'articolo è obbligatorio");
    setSaving(true);
    const { error } = await supabase.from("articoli").insert({
      nome: form.nome.trim(),
      unita_misura: form.unita_misura,
      tipo_confezione: form.tipo_confezione,
      pezzi_per_confezione: Math.max(1, parseInt(form.pezzi_per_confezione || "1", 10)),
      fornitore_default_id: form.fornitore_default_id !== NESSUNO ? form.fornitore_default_id : null,
      prezzo_unitario: form.prezzo_unitario ? Number(form.prezzo_unitario.replace(",", ".")) : null,
      scorta_minima: Number((form.scorta_minima || "0").replace(",", ".")),
      note: form.note || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Articolo inserito");
    navigate("/magazzino/articoli");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-display text-2xl font-bold">Inserisci articolo</h1>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Dati articolo</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="es. Filtro olio" />
            </div>
            <div className="space-y-1.5">
              <Label>Unità di misura</Label>
              <Select value={form.unita_misura} onValueChange={(v) => setForm({ ...form, unita_misura: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITA.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo confezione</Label>
              <Select value={form.tipo_confezione} onValueChange={(v) => setForm({ ...form, tipo_confezione: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPI_CONFEZIONE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pezzi per confezione</Label>
              <Input inputMode="numeric" value={form.pezzi_per_confezione} onChange={(e) => setForm({ ...form, pezzi_per_confezione: e.target.value })} />
              <p className="text-xs text-muted-foreground">{formatoConfezione(form.tipo_confezione, Number(form.pezzi_per_confezione) || 1)}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Fornitore di default</Label>
                <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={() => setFornDialog(true)}>
                  <Settings2 className="h-3 w-3" /> gestisci fornitori
                </button>
              </div>
              <Select value={form.fornitore_default_id} onValueChange={(v) => setForm({ ...form, fornitore_default_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NESSUNO}>Nessuno</SelectItem>
                  {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prezzo unitario (€)</Label>
              <Input inputMode="decimal" value={form.prezzo_unitario} onChange={(e) => setForm({ ...form, prezzo_unitario: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Scorta minima (pezzi)</Label>
              <Input inputMode="decimal" value={form.scorta_minima} onChange={(e) => setForm({ ...form, scorta_minima: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Note</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={salva} disabled={!canWrite || saving}>Salva articolo</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <FornitoriMagazzinoDialog open={fornDialog} onOpenChange={setFornDialog} onChanged={load} />
    </DashboardLayout>
  );
}
