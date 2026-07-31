import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Star, Trash2 } from "lucide-react";

type LinkRow = {
  id: string;
  etichetta: string;
  url: string;
  icona: string | null;
  ordine: number;
  evidenza: boolean;
  attivo: boolean;
};

const EMPTY = { etichetta: "", url: "", icona: "", ordine: 0, evidenza: false, attivo: true };

export default function LinkUtili() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  const load = async () => {
    const { data } = await supabase
      .from("link_utili").select("*")
      .order("evidenza", { ascending: false })
      .order("ordine", { ascending: true });
    setRows((data ?? []) as LinkRow[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("profiles").select("org_id").eq("user_id", user.id).maybeSingle();
      setOrgId(p?.org_id ?? null);
      load();
    })();
  }, []);

  const apri = (r?: LinkRow) => {
    if (r) {
      setEditId(r.id);
      setForm({ etichetta: r.etichetta, url: r.url, icona: r.icona ?? "", ordine: r.ordine, evidenza: r.evidenza, attivo: r.attivo });
    } else {
      setEditId(null);
      setForm({ ...EMPTY, ordine: rows.length });
    }
    setOpen(true);
  };

  const salva = async () => {
    if (!form.etichetta.trim()) return toast.error("Inserisci un'etichetta");
    let url = form.url.trim();
    if (!url) return toast.error("Inserisci l'indirizzo del sito");
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const payload = {
      etichetta: form.etichetta.trim(),
      url,
      icona: form.icona.trim() || null,
      ordine: Number(form.ordine) || 0,
      evidenza: form.evidenza,
      attivo: form.attivo,
    };
    const { error } = editId
      ? await supabase.from("link_utili").update(payload).eq("id", editId)
      : await supabase.from("link_utili").insert([{ ...payload, org_id: orgId }]);
    if (error) return toast.error(error.message);
    toast.success("Link salvato");
    setOpen(false);
    load();
  };

  const elimina = async (id: string) => {
    if (!confirm("Eliminare questo link?")) return;
    const { error } = await supabase.from("link_utili").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Link utili</h1>
            <p className="text-sm text-muted-foreground">
              Radar voli, traffico e altri siti utili, visibili nell'app degli autisti.
            </p>
          </div>
          <Button onClick={() => apri()}><Plus className="h-4 w-4 mr-2" /> Nuovo link</Button>
        </div>

        <Card className="divide-y">
          {rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">Nessun link configurato.</div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              {r.evidenza ? <Star className="h-4 w-4 text-amber-500" /> : <ExternalLink className="h-4 w-4 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.etichetta}</div>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground truncate hover:underline">{r.url}</a>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">#{r.ordine}</span>
              {!r.attivo && <span className="text-[11px] rounded-full bg-muted px-2 py-0.5">nascosto</span>}
              <Button size="icon" variant="ghost" onClick={() => apri(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => elimina(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Modifica link" : "Nuovo link"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="et">Etichetta</Label>
              <Input id="et" value={form.etichetta} onChange={(e) => setForm({ ...form, etichetta: e.target.value })} placeholder="Radar voli" />
            </div>
            <div>
              <Label htmlFor="url">Indirizzo</Label>
              <Input id="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.flightradar24.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ic">Icona (facoltativa)</Label>
                <Input id="ic" value={form.icona} onChange={(e) => setForm({ ...form, icona: e.target.value })} placeholder="plane" />
              </div>
              <div>
                <Label htmlFor="or">Ordine</Label>
                <Input id="or" type="number" value={form.ordine} onChange={(e) => setForm({ ...form, ordine: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ev">In evidenza (radar voli/traffico)</Label>
              <Switch id="ev" checked={form.evidenza} onCheckedChange={(v) => setForm({ ...form, evidenza: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="at">Visibile agli autisti</Label>
              <Switch id="at" checked={form.attivo} onCheckedChange={(v) => setForm({ ...form, attivo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={salva}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
