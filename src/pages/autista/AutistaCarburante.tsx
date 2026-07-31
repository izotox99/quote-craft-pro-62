import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, Car, CheckCircle2, AlertTriangle, ImageUp, RefreshCw, Loader2, XCircle,
} from "lucide-react";

type Ocr = {
  data: string | null;
  prezzo_litro: number | null;
  litri: number | null;
  totale: number | null;
  km: number | null;
  tipo_carburante: string | null;
  distributore: string | null;
  confidence: number | null;
};

type Veicolo = { id: string; targa: string; marca: string | null; modello: string | null; km_attuale: number | null };

const CARBURANTI = ["diesel", "benzina", "gpl", "metano"];

const num = (v: string): number | null => {
  const s = v.replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function itaToISO(d: string): string | null {
  const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function resizeToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1024;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

type Stato = "idle" | "analyzing" | "review" | "success";

export default function AutistaCarburante() {
  const navigate = useNavigate();
  const [stato, setStato] = useState<Stato>("idle");
  const [photo, setPhoto] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [veicoloId, setVeicoloId] = useState<string>("");
  const [raw, setRaw] = useState<Ocr | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [riepilogo, setRiepilogo] = useState<{ litri: string; totale: string; km: string } | null>(null);
  const lastFile = useRef<File | null>(null);

  const [f, setF] = useState({
    data: "", prezzo_litro: "", litri: "", totale: "", tipo_carburante: "", distributore: "", km: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: v } = await supabase
        .from("veicoli")
        .select("id, targa, marca, modello, km_attuale")
        .eq("attivo", true)
        .order("targa");
      const list = (v ?? []) as Veicolo[];
      setVeicoli(list);

      const oggi = new Date().toISOString().slice(0, 10);
      const { data: srv } = await supabase
        .from("servizi")
        .select("veicolo_id")
        .eq("data_servizio", oggi)
        .not("veicolo_id", "is", null)
        .limit(1)
        .maybeSingle();
      setVeicoloId((srv?.veicolo_id as string) || list[0]?.id || "");
    })();
  }, []);

  const veicolo = veicoli.find((v) => v.id === veicoloId) || null;

  const reset = () => {
    setStato("idle"); setPhoto(null); setRaw(null); setOcrError(null); setTouched({});
    setF({ data: "", prezzo_litro: "", litri: "", totale: "", tipo_carburante: "", distributore: "", km: "" });
  };

  const analyze = async (file: File) => {
    lastFile.current = file;
    setOcrError(null);
    let dataUrl: string;
    try {
      dataUrl = await resizeToDataUrl(file);
    } catch {
      toast.error("Impossibile leggere la foto");
      return;
    }
    setPhoto(dataUrl);
    setStato("analyzing");
    const { data, error } = await supabase.functions.invoke("analyze-scontrino", {
      body: { imageDataUrl: dataUrl },
    });
    if (error || !data?.content) {
      setOcrError("Non è stato possibile leggere lo scontrino.");
      setStato("review");
      return;
    }
    try {
      const clean = String(data.content).replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean) as Ocr;
      setRaw(parsed);
      setF({
        data: parsed.data ?? "",
        prezzo_litro: parsed.prezzo_litro != null ? String(parsed.prezzo_litro) : "",
        litri: parsed.litri != null ? String(parsed.litri) : "",
        totale: parsed.totale != null ? String(parsed.totale) : "",
        tipo_carburante: parsed.tipo_carburante ?? "",
        distributore: parsed.distributore ?? "",
        km: parsed.km != null ? String(parsed.km) : "",
      });
      setTouched({});
      setStato("review");
    } catch {
      setOcrError("Risposta non leggibile dallo scanner.");
      setStato("review");
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) analyze(file);
  };

  const set = (k: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setTouched((p) => ({ ...p, [k]: true }));
  };

  const kmNum = num(f.km);
  const kmValido = kmNum !== null && Number.isInteger(kmNum) && kmNum >= 0 && kmNum <= 999999;
  const kmAuto = raw?.km != null && !touched.km;
  const confidence = raw?.confidence ?? null;
  const mancanti = raw
    ? ([
        ["Data", raw.data], ["Prezzo/litro", raw.prezzo_litro], ["Litri", raw.litri],
        ["Totale", raw.totale], ["Km", raw.km], ["Carburante", raw.tipo_carburante],
        ["Distributore", raw.distributore],
      ] as [string, unknown][]).filter(([, v]) => v == null).map(([k]) => k)
    : [];

  const pl = num(f.prezzo_litro), li = num(f.litri), to = num(f.totale);
  const crossWarn = pl && li && to ? Math.abs(pl * li - to) / to > 0.05 : false;

  const ringFor = (k: keyof typeof f, ocrVal: unknown) =>
    touched[k] ? "ring-2 ring-orange-400" : ocrVal == null && raw ? "ring-2 ring-red-300" : "";

  const submit = async () => {
    if (!veicoloId) return toast.error("Seleziona un veicolo");
    if (!kmValido) return toast.error("Inserisci i km (numero intero)");
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: a } = await supabase.from("autisti").select("org_id").eq("auth_user_id", user!.id).maybeSingle();
      let fotoPath: string | null = null;
      if (photo && a?.org_id) {
        const path = `${a.org_id}/${veicoloId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("scontrini-carburante")
          .upload(path, dataUrlToBlob(photo), { contentType: "image/jpeg" });
        if (!upErr) fotoPath = path;
      }
      const { error } = await supabase.rpc("autista_registra_rifornimento", {
        _veicolo_id: veicoloId,
        _data: itaToISO(f.data) ?? new Date().toISOString().slice(0, 10),
        _km: kmNum!,
        _litri: li,
        _prezzo_unitario: pl,
        _prezzo_totale: to,
        _distributore: f.distributore || null,
        _tipo_carburante: f.tipo_carburante || null,
        _foto_path: fotoPath,
        _confidence: confidence,
        _raw_ocr: raw as any,
      });
      if (error) throw error;
      setRiepilogo({ litri: f.litri || "—", totale: f.totale || "—", km: f.km });
      setStato("success");
    } catch (e: any) {
      toast.error(e.message ?? "Invio non riuscito", {
        action: { label: "Riprova", onClick: () => submit() },
      });
    } finally {
      setSending(false);
    }
  };

  const Field = ({
    label, k, ocrVal, type = "text", suffix,
  }: { label: string; k: keyof typeof f; ocrVal: unknown; type?: string; suffix?: string }) => (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0">
      <label className="text-[13px] text-muted-foreground w-28 shrink-0">{label}</label>
      <div className="flex-1 flex items-center gap-2">
        <Input
          inputMode={type === "num" ? "decimal" : undefined}
          value={f[k]}
          onChange={(e) => set(k)(e.target.value)}
          className={`h-11 text-right tabular-nums border-0 shadow-none focus-visible:ring-1 rounded-xl bg-muted/40 ${ringFor(k, ocrVal)}`}
        />
        {suffix && <span className="text-xs text-muted-foreground w-6">{suffix}</span>}
        {raw && ocrVal == null && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
      </div>
    </div>
  );

  return (
    <AutistaLayout>
      <div className="space-y-3 pb-28">
        <button onClick={() => navigate("/autista")} className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>

        {/* Veicolo */}
        <div className="rounded-[18px] bg-white border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5"><Car className="h-5 w-5 text-primary" /></div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Veicolo</div>
              <Select value={veicoloId} onValueChange={setVeicoloId}>
                <SelectTrigger className="h-11 mt-1 rounded-xl"><SelectValue placeholder="Seleziona veicolo" /></SelectTrigger>
                <SelectContent>
                  {veicoli.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.targa} — {[v.marca, v.modello].filter(Boolean).join(" ") || "veicolo"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {veicolo?.km_attuale != null && (
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                  Km attuali: {veicolo.km_attuale.toLocaleString("it-IT")}
                </div>
              )}
            </div>
          </div>
        </div>

        {stato === "idle" && (
          <>
            <label
              htmlFor="scatta-scontrino"
              className="block rounded-[22px] border-2 border-dashed bg-white px-6 py-10 text-center cursor-pointer active:scale-[0.99] transition"
            >
              <Camera className="h-10 w-10 mx-auto text-primary" />
              <div className="font-display font-semibold mt-3">Scatta foto scontrino</div>
              <p className="text-xs text-muted-foreground mt-1">L'analisi parte automaticamente dopo lo scatto</p>
            </label>
            <input id="scatta-scontrino" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} />

            <label htmlFor="carica-scontrino" className="flex items-center justify-center gap-2 text-sm text-primary font-medium py-3 min-h-[44px] cursor-pointer">
              <ImageUp className="h-4 w-4" /> oppure carica dalla galleria
            </label>
            <input id="carica-scontrino" type="file" accept="image/*" className="sr-only" onChange={onPick} />
          </>
        )}

        {stato === "analyzing" && (
          <div className="space-y-3" aria-live="polite">
            {photo && <img src={photo} alt="Scontrino carburante" className="w-full rounded-[18px] border object-cover max-h-64" />}
            <div className="rounded-[18px] bg-white border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisi scontrino in corso
              </div>
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          </div>
        )}

        {stato === "review" && (
          <div className="space-y-3">
            {photo && <img src={photo} alt="Scontrino carburante" className="w-full rounded-[18px] border object-cover max-h-52" />}

            {ocrError && (
              <div className="rounded-[16px] border border-red-300 bg-red-50 text-red-900 p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> {ocrError}</div>
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => lastFile.current && analyze(lastFile.current)}>
                  Riprova
                </Button>
              </div>
            )}

            {confidence != null && confidence < 0.7 && (
              <div className="rounded-[16px] border border-orange-300 bg-orange-50 text-orange-900 p-3 text-xs">
                Lettura poco affidabile ({Math.round(confidence * 100)}%): controlla tutti i campi.
              </div>
            )}
            {mancanti.length > 0 && (
              <div className="rounded-[16px] border border-red-300 bg-red-50 text-red-900 p-3 text-xs">
                Campi non rilevati: {mancanti.join(", ")}. Compilali a mano.
              </div>
            )}
            {crossWarn && (
              <div className="rounded-[16px] border border-orange-300 bg-orange-50 text-orange-900 p-3 text-xs">
                Attenzione: prezzo × litri non corrisponde al totale.
              </div>
            )}

            <div className="rounded-[18px] bg-white border overflow-hidden">
              <Field label="Data" k="data" ocrVal={raw?.data} />
              <Field label="Prezzo/litro" k="prezzo_litro" ocrVal={raw?.prezzo_litro} type="num" suffix="€" />
              <Field label="Litri" k="litri" ocrVal={raw?.litri} type="num" suffix="L" />
              <Field label="Totale" k="totale" ocrVal={raw?.totale} type="num" suffix="€" />
              <div className="flex items-center gap-3 px-4 py-2.5 border-b">
                <span className="text-[13px] text-muted-foreground w-28 shrink-0">Carburante</span>
                <Select value={f.tipo_carburante || undefined} onValueChange={set("tipo_carburante")}>
                  <SelectTrigger className={`h-11 rounded-xl flex-1 ${ringFor("tipo_carburante", raw?.tipo_carburante)}`}>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARBURANTI.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Distributore" k="distributore" ocrVal={raw?.distributore} />
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[13px] text-muted-foreground w-28 shrink-0">
                  Km <span className="text-red-500">*</span>
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    inputMode="numeric"
                    value={f.km}
                    onChange={(e) => set("km")(e.target.value)}
                    placeholder="obbligatorio"
                    className={`h-11 text-right tabular-nums border-0 shadow-none rounded-xl bg-muted/40 ${ringFor("km", raw?.km)}`}
                  />
                  {kmAuto && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">auto</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {stato === "success" && (
          <div className="rounded-[22px] bg-white border p-8 text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <div className="font-display font-semibold text-lg">Rifornimento registrato</div>
            <div className="text-sm text-muted-foreground tabular-nums">
              {riepilogo?.litri} L · {riepilogo?.totale} € · km {riepilogo?.km}
            </div>
            <Button className="h-12 rounded-xl w-full" onClick={reset}>Nuovo rifornimento</Button>
          </div>
        )}
      </div>

      {stato === "review" && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-2xl space-y-2">
            <Button className="w-full h-12 rounded-xl" disabled={!kmValido || sending} onClick={submit}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Invia rifornimento
            </Button>
            <Button variant="ghost" className="w-full h-11 rounded-xl text-muted-foreground" onClick={reset}>
              <RefreshCw className="h-4 w-4 mr-2" /> Rifai foto / cambia scontrino
            </Button>
          </div>
        </div>
      )}
    </AutistaLayout>
  );
}
