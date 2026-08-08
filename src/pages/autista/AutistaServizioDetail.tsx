import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Phone, FileText, Monitor, Play, Flag, X,
} from "lucide-react";
import { toast } from "sonner";
import { getCartelloUrl } from "@/lib/cartello";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function AutistaServizioDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<any>(null);
  const [veicolo, setVeicolo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCartello, setShowCartello] = useState(false);
  const [cartelloUrl, setCartelloUrl] = useState<string | null>(null);
  const [cartelloLoading, setCartelloLoading] = useState(false);

  const apriCartelloFile = async () => {
    if (!s?.cartello_path) return;
    setCartelloLoading(true);
    const url = await getCartelloUrl(s.cartello_path, 3600);
    setCartelloLoading(false);
    if (!url) { toast.error("Impossibile aprire il cartello"); return; }
    setCartelloUrl(url);
    setShowCartello(true);
  };

  const [dlg, setDlg] = useState<null | "start" | "close_transfer" | "close_dispo">(null);
  const [km, setKm] = useState<string>("");
  const [nota, setNota] = useState("");
  const [oraFine, setOraFine] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("servizi_autista_view" as any)
      .select("*").eq("id", id).maybeSingle();
    setS(data);
    setVeicolo(null);
    if ((data as any)?.veicolo_id) {
      const { data: v } = await supabase.from("veicoli")
        .select("marca,modello,tipo_macchina,targa,foto_url,km_attuale")
        .eq("id", (data as any).veicolo_id).maybeSingle();
      setVeicolo(v);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <AutistaLayout><div className="text-sm text-center py-8">Caricamento…</div></AutistaLayout>;
  if (!s) return <AutistaLayout><div className="text-sm text-center py-8">Servizio non trovato</div></AutistaLayout>;

  const hasTransfer = s.tipologia === "transfer" || !!s.transfer_tipo;
  const hasDispo = s.tipologia === "disposizione" || !!s.disposizione_oraria;
  const transferDone = !hasTransfer || !!s.transfer_concluso_at;
  const dispoDone = !hasDispo || !!s.dispo_conclusa_at;

  const openDlg = (action: "start" | "close_transfer" | "close_dispo") => {
    setDlg(action);
    setNota("");
    setOraFine(new Date().toISOString().slice(0, 16));
    if (action === "start") setKm(veicolo?.km_attuale?.toString() ?? "");
    else setKm(veicolo?.km_attuale?.toString() ?? s.km_inizio_servizio?.toString() ?? "");
  };

  const submit = async () => {
    if (!dlg) return;
    setSaving(true);
    const payload: any = {
      _servizio_id: id,
      _action: dlg,
      _km: km ? parseInt(km, 10) : null,
    };
    if (dlg !== "start") {
      payload._nota = nota || null;
      payload._ora_fine = new Date(oraFine).toISOString();
    }
    const { error } = await supabase.rpc("autista_update_servizio" as any, payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(dlg === "start" ? "Servizio iniziato" : "Chiusura registrata");
    setDlg(null);
    load();
  };

  const openFoglio = async () => {
    if (!s.allegato_path) return;
    const { data } = await supabase.storage.from("servizi-allegati")
      .createSignedUrl(s.allegato_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </button>

        <Card className="p-4 space-y-1">
          <div className="text-4xl font-bold tabular-nums">{s.ora_inizio ?? "--:--"}</div>
          <div className="text-sm text-muted-foreground">
            {new Date(s.data_servizio).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div className="text-xs uppercase font-bold mt-2">
            Stato: <span className="text-primary">{s.stato_autista}</span>
          </div>
        </Card>

        {/* Cartello */}
        {(s.contatto || s.cartello_path) && (
          <Card className="p-3 space-y-2 bg-blue-50 border-blue-200">
            <div className="text-xs uppercase font-bold text-blue-800">Cartello aeroporto</div>
            <div className="text-xl font-semibold">{s.contatto ?? s.cartello_nome}</div>
            {s.cartello_path && (
              <Button size="sm" onClick={apriCartelloFile} disabled={cartelloLoading} className="w-full">
                <Monitor className="h-4 w-4 mr-1" /> {cartelloLoading ? "Apertura…" : "Apri cartello"}
              </Button>
            )}
            {s.contatto && (
              <Button size="sm" variant="secondary" onClick={() => { setCartelloUrl(null); setShowCartello(true); }} className="w-full">
                <Monitor className="h-4 w-4 mr-1" /> Mostra cartello (nome)
              </Button>
            )}
          </Card>
        )}

        {/* Cliente e passeggero */}
        <Card className="p-3 space-y-2">
          {s.societa_cliente && (
            <div>
              <div className="text-xs uppercase text-muted-foreground font-semibold">Società cliente</div>
              <div className="text-lg font-bold leading-snug">{s.societa_cliente}</div>
            </div>
          )}
          <Info label="Cliente" value={s.contatto} />
          {s.telefono_contatto && (
            <a href={`tel:${s.telefono_contatto}`} className="flex items-center gap-2 text-primary text-base">
              <Phone className="h-4 w-4" /> {s.telefono_contatto}
            </a>
          )}
          {s.telefono_d && (
            <a href={`tel:${s.telefono_d}`} className="flex items-center gap-2 text-primary text-base">
              <Phone className="h-4 w-4" /> {s.telefono_d}
            </a>
          )}
          <Info label="Passeggero" value={s.contatto} />
        </Card>

        {/* Percorso */}
        <Card className="p-3 space-y-1 text-base">
          <div className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />{s.luogo_inizio}</div>
          {s.itinerario && <div className="pl-4 text-sm italic text-muted-foreground">{s.itinerario}</div>}
          <div className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 rounded-full bg-red-500" />{s.luogo_fine}</div>
        </Card>

        {/* Dati operativi */}
        <Card className="p-3 grid grid-cols-2 gap-2 text-sm">
          <Info label="Passeggeri" value={s.n_passeggeri} />
          <Info label="Bagagli" value={s.n_bagagli} />
          <Info
            label="Veicolo"
            value={
              veicolo
                ? `${[veicolo.marca, veicolo.modello].filter(Boolean).join(" ") || veicolo.tipo_macchina || ""} — ${veicolo.targa}`.trim()
                : s.veicolo_tipo
                  ? `${s.veicolo_tipo} · Veicolo da assegnare`
                  : null
            }
          />
          <Info label="Tipologia" value={s.tipologia} />
          {s.transfer_tipo && <Info label="Transfer" value={s.transfer_tipo} />}
          {s.disposizione_oraria && <Info label="Disposizione" value={s.disposizione_oraria} />}
          {s.tour_tipo && <Info label="Tour" value={s.tour_tipo} />}
          {(s.accessori_dettaglio || s.accessori) && (
            <div className="col-span-2">
              <Info label="Accessori" value={s.accessori_dettaglio || s.accessori} />
            </div>
          )}
          {s.tipo_pagamento && <Info label="Pagamento" value={s.tipo_pagamento} />}
        </Card>

        {/* Note operative */}
        {s.info_autista && (
          <div className="bg-yellow-100 border border-yellow-300 rounded-md p-3 text-base">
            <div className="font-bold uppercase text-xs text-yellow-800 mb-1">Note per l'autista</div>
            <div className="text-yellow-900 whitespace-pre-wrap">{s.info_autista}</div>
          </div>
        )}
        {s.note && (
          <Card className="p-3 text-base">
            <div className="text-xs uppercase font-bold text-muted-foreground mb-1">Note ufficio</div>
            <div className="whitespace-pre-wrap">{s.note}</div>
          </Card>
        )}

        {/* Foglio di servizio */}
        {s.allegato_path && (
          <Button variant="outline" onClick={openFoglio} className="w-full">
            <FileText className="h-4 w-4 mr-1" /> Apri foglio di servizio
          </Button>
        )}

        {/* Azioni gestione */}
        <div className="space-y-2 pt-2 border-t">
          {s.stato_autista === "da_effettuare" && (
            <Button onClick={() => openDlg("start")} className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg">
              <Play className="h-4 w-4 mr-1" /> Inizia servizio
            </Button>
          )}
          {s.stato_autista === "in_corso" && (
            <>
              {hasTransfer && !transferDone && (
                <Button onClick={() => openDlg("close_transfer")} className="w-full" size="lg">
                  <Flag className="h-4 w-4 mr-1" /> Concludi transfer
                </Button>
              )}
              {hasDispo && !dispoDone && (
                <Button onClick={() => openDlg("close_dispo")} className="w-full" size="lg" variant="secondary">
                  <Flag className="h-4 w-4 mr-1" /> Concludi disposizione
                </Button>
              )}
            </>
          )}
          {s.stato_autista === "concluso" && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              ✓ Servizio concluso
              {s.km_fine_servizio != null && <div className="text-xs mt-1">Km fine: {s.km_fine_servizio}</div>}
              {s.transfer_nota_chiusura && <div className="text-xs mt-1"><b>Transfer:</b> {s.transfer_nota_chiusura}</div>}
              {s.dispo_nota_chiusura && <div className="text-xs mt-1"><b>Disposizione:</b> {s.dispo_nota_chiusura}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Cartello full-screen */}
      {showCartello && (
        <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6">
          <button
            onClick={() => setShowCartello(false)}
            className="absolute top-4 right-4 rounded-full p-3 bg-black/10"
            aria-label="Chiudi"
          >
            <X className="h-6 w-6" />
          </button>
          {cartelloUrl ? (
            s.cartello_nome?.toLowerCase().endsWith(".pdf") ? (
              <iframe src={cartelloUrl} title="Cartello" className="w-full h-full border-0" />
            ) : (
              <img src={cartelloUrl} alt={`Cartello per ${s.contatto ?? "il passeggero"}`} className="max-w-full max-h-full object-contain" />
            )
          ) : (
            <div className="text-center font-display font-bold text-black break-words leading-none" style={{ fontSize: "clamp(3rem, 15vw, 10rem)" }}>
              {s.contatto}
            </div>
          )}
        </div>
      )}

      {/* Dialog gestione */}
      <Dialog open={dlg !== null} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dlg === "start" && "Inizia servizio"}
              {dlg === "close_transfer" && "Concludi transfer"}
              {dlg === "close_dispo" && "Concludi disposizione"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Km {dlg === "start" ? "iniziali" : "finali"}</Label>
              <Input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
            {dlg !== "start" && (
              <>
                <div>
                  <Label>Ora di fine</Label>
                  <Input type="datetime-local" value={oraFine} onChange={(e) => setOraFine(e.target.value)} />
                </div>
                <div>
                  <Label>Note (ritardi, attese, imprevisti…)</Label>
                  <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={4} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>Annulla</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvataggio…" : "Conferma"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AutistaLayout>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground font-semibold">{label}</div>
      <div className="text-base font-medium">{value}</div>
    </div>
  );
}
