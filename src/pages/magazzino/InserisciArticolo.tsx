import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FornitoriMagazzinoDialog, fetchFornitoriMagazzino, type FornitoreMagazzino } from "@/components/magazzino/FornitoriMagazzinoDialog";
import { Settings2 } from "lucide-react";
import { TIPI_CONFEZIONE, UNITA_BASE, CATEGORIE_ARTICOLO, formatoConfezione } from "@/lib/magazzino";

export const UNITA = ["pz", "litri", "kg", "set", "m", "conf"];
const NESSUNO = "__nessuno__";

export default function InserisciArticolo() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [fornitori, setFornitori] = useState<FornitoreMagazzino[]>([]);
  const [fornDialog, setFornDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorie, setCategorie] = useState<string[]>(["ordinaria"]);
  const [form, setForm] = useState({
    scorta_minima: "0",
    nome: "",
    tipo_confezione: "singolo",
    quantita_per_confezione: "1",
    unita_base: "pezzo",
    mostra_in_ordini: "si",
    fornitore_default_id: NESSUNO,
    prezzo_unitario: "",
    note: "",
  });

  const load = async () => setFornitori((await fetchFornitoriMagazzino()).filter((f) => f.attivo));
  useEffect(() => { load(); }, []);

  const toggleCat = (c: string) =>
    setCategorie((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const salva = async () => {
    if (!form.nome.trim()) return toast.error("Il nome dell'articolo è obbligatorio");
    if (categorie.length === 0) return toast.error("Seleziona almeno una categoria in \"Articolo per\"");
    setSaving(true);
    const { error } = await supabase.from("articoli").insert({
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
              <Label>Quantità minima</Label>
              <Input inputMode="decimal" value={form.scorta_minima} onChange={(e) => setForm({ ...form, scorta_minima: e.target.value })} />
              <p className="text-xs text-muted-foreground">Scorta minima sotto la quale l'articolo viene segnalato.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="es. Filtro olio" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Unità *</Label>
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
              <p className="text-xs text-muted-foreground">
                {formatoConfezione(form.tipo_confezione, Number(form.quantita_per_confezione) || 1, form.unita_base)}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Articolo per *</Label>
              <div className="flex flex-wrap gap-4 rounded-md border p-3">
                {CATEGORIE_ARTICOLO.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={categorie.includes(c.value)} onCheckedChange={() => toggleCat(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">L'articolo sarà selezionabile solo nelle sezioni corrispondenti.</p>
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
