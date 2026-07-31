import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, PlusCircle, Camera, Receipt, Loader2, ImageUp } from "lucide-react";
import { romeToday } from "@/lib/romeDate";

type Carta = {
  id: string; intestazione: string; ultime_quattro: string | null;
  scadenza: string | null; plafond: number | null; stato: string;
};
type Spesa = {
  id: string; data_intervento: string | null; importo_spese: number | null;
  categoria: string | null; note: string | null; foto_path: string | null; tipo: string;
};

const CATEGORIE = ["carburante", "pedaggio", "parcheggio", "lavaggio", "altro"];

const num = (v: string): number | null => {
  const s = v.replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

async function resizeToBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export default function AutistaCarta() {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ id: string; org_id: string } | null>(null);
  const [carta, setCarta] = useState<Carta | null>(null);
  const [spese, setSpese] = useState<Spesa[]>([]);
  const [servizi, setServizi] = useState<{ id: string; label: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [form, setForm] = useState({
    data: romeToday(), importo: "", categoria: "", servizio_id: "", note: "",
  });

  const load = async (autistaId: string) => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("autisti_carte").select("*").eq("autista_id", autistaId).maybeSingle(),
      supabase.from("autisti_spese").select("*").eq("autista_id", autistaId).order("data_intervento", { ascending: false }),
    ]);
    setCarta((c as Carta) ?? null);
    setSpese((s ?? []) as Spesa[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase.from("autisti").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
      if (!a) return;
      setMe({ id: a.id, org_id: a.org_id });
      load(a.id);
      const oggi = romeToday();
      const { data: srv } = await supabase
        .from("servizi_autista_view" as any)
        .select("id, data_servizio, ora_inizio, luogo_inizio")
        .gte("data_servizio", oggi)
        .order("data_servizio")
        .limit(20);
      setServizi(((srv ?? []) as any[]).map((x) => ({
        id: x.id,
        label: `${new Date(x.data_servizio).toLocaleDateString("it-IT")} ${x.ora_inizio ?? ""} ${x.luogo_inizio ?? ""}`.trim(),
      })));
    })();
  }, []);

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await resizeToBlob(file);
      setFoto({ blob, url: URL.createObjectURL(blob) });
    } catch { toast.error("Impossibile leggere la foto"); }
  };

  const salva = async () => {
    const importo = num(form.importo);
    if (!importo || importo <= 0) return toast.error("Inserisci l'importo");
    if (!form.categoria) return toast.error("Seleziona la categoria");
    if (!foto) return toast.error("La foto del giustificativo è obbligatoria");
    if (!me) return;
    setSending(true);
    try {
      const path = `${me.org_id}/spese/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("allegati-autisti").upload(path, foto.blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("autisti_spese").insert([{
        autista_id: me.id,
        org_id: me.org_id,
        tipo: form.categoria,
        categoria: form.categoria,
        data_intervento: form.data,
        importo_spese: importo,
        totale_fattura: importo,
        servizio_id: form.servizio_id || null,
        veicolo_id: (await getSessioneVeicoloAttiva())?.veicolo_id ?? null,
        note: form.note || null,
        foto_path: path,
        origine: "autista",
      }]);
      if (error) throw error;
      toast.success("Spesa registrata");
      setOpen(false); setFoto(null);
      setForm({ data: romeToday(), importo: "", categoria: "", servizio_id: "", note: "" });
      load(me.id);
    } catch (e: any) {
      toast.error(e.message ?? "Salvataggio non riuscito");
    } finally { setSending(false); }
  };

  const apriFoto = async (path: string) => {
    const { data, error } = await supabase.storage.from("allegati-autisti").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Impossibile aprire il giustificativo");
    window.open(data.signedUrl, "_blank");
  };

  const totale = spese.reduce((s, r) => s + (Number(r.importo_spese) || 0), 0);

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate("/autista")} className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>

        {carta ? (
          <div className="rounded-[22px] bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 shadow-md">
            <div className="flex items-center justify-between">
              <CreditCard className="h-7 w-7 opacity-90" />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                carta.stato === "attiva" ? "bg-emerald-400/20 text-emerald-200" : "bg-red-400/20 text-red-200"}`}>
                {carta.stato}
              </span>
            </div>
            <div className="mt-6 text-xl tracking-widest tabular-nums">•••• •••• •••• {carta.ultime_quattro ?? "••••"}</div>
            <div className="mt-4 flex items-end justify-between text-xs">
              <div>
                <div className="opacity-60 uppercase text-[10px]">Intestazione</div>
                <div className="font-medium text-sm">{carta.intestazione}</div>
              </div>
              <div className="text-right">
                <div className="opacity-60 uppercase text-[10px]">Scadenza</div>
                <div className="font-medium text-sm tabular-nums">{carta.scadenza ?? "—"}</div>
              </div>
            </div>
            {carta.plafond != null && (
              <div className="mt-3 text-xs opacity-80 tabular-nums">
                Plafond: {Number(carta.plafond).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[18px] bg-white border p-6 text-center text-sm text-muted-foreground">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nessuna carta assegnata dall'ufficio
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="font-display font-semibold text-sm">Le mie spese</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              Totale {totale.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
            </div>
          </div>
          <Button className="h-11 rounded-xl gap-2" onClick={() => setOpen(true)}>
            <PlusCircle className="h-4 w-4" /> Nuova spesa
          </Button>
        </div>

        {spese.length === 0 ? (
          <div className="rounded-[18px] bg-white border p-10 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" /> Nessuna spesa registrata
          </div>
        ) : (
          <div className="rounded-[18px] bg-white border overflow-hidden">
            {spese.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                <div className="rounded-xl bg-muted p-2"><Receipt className="h-4 w-4 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize">{s.categoria ?? s.tipo}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.data_intervento ? new Date(s.data_intervento).toLocaleDateString("it-IT") : "—"}
                    {s.note ? ` · ${s.note}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {Number(s.importo_spese ?? 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                </div>
                {s.foto_path && (
                  <Button variant="ghost" size="icon" onClick={() => apriFoto(s.foto_path!)} aria-label="Giustificativo">
                    <ImageUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-[20px]">
          <DialogHeader><DialogTitle>Nuova spesa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="date" className="h-11 rounded-xl" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Importo (€)</label>
              <Input inputMode="decimal" className="h-11 rounded-xl tabular-nums" value={form.importo} onChange={(e) => setForm({ ...form, importo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={form.categoria || undefined} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{CATEGORIE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Servizio collegato (facoltativo)</label>
              <Select value={form.servizio_id || undefined} onValueChange={(v) => setForm({ ...form, servizio_id: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>{servizi.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Giustificativo <span className="text-red-500">*</span></label>
              {foto ? (
                <div className="mt-1 space-y-2">
                  <img src={foto.url} alt="Giustificativo spesa" className="w-full rounded-xl border max-h-40 object-cover" />
                  <label htmlFor="foto-spesa" className="text-xs text-primary font-medium cursor-pointer">Cambia foto</label>
                </div>
              ) : (
                <label htmlFor="foto-spesa" className="mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 text-sm text-muted-foreground cursor-pointer min-h-[44px]">
                  <Camera className="h-4 w-4" /> Scatta o carica foto
                </label>
              )}
              <input id="foto-spesa" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFoto} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Note</label>
              <Textarea rows={3} className="rounded-xl resize-none" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setOpen(false)}>Annulla</Button>
            <Button className="h-11 rounded-xl" onClick={salva} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salva spesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AutistaLayout>
  );
}
