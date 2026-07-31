import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, ShieldAlert, User } from "lucide-react";

type Autista = {
  id: string;
  org_id: string;
  nome: string;
  cognome: string;
  codice_fiscale: string | null;
  patente: string | null;
  mansione: string | null;
  telefono: string | null;
  cellulare: string | null;
  email: string | null;
  foto_url: string | null;
  foto_consenso: boolean;
  numero_ore_ord: number | null;
  prezzo_ora_ord: number | null;
  prezzo_ora_straord: number | null;
  buono_pasto: number | null;
  trasferta: number | null;
};

export default function AutistaProfilo() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [a, setA] = useState<Autista | null>(null);
  const [telefono, setTelefono] = useState("");
  const [cellulare, setCellulare] = useState("");
  const [email, setEmail] = useState("");
  const [consenso, setConsenso] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFoto = async (path: string | null) => {
    if (!path) return setFotoUrl(null);
    const { data } = await supabase.storage.from("allegati-autisti").createSignedUrl(path, 3600);
    setFotoUrl(data?.signedUrl ?? null);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("autisti").select("*").eq("auth_user_id", user.id).maybeSingle();
      if (!data) return;
      const row = data as unknown as Autista;
      setA(row);
      setTelefono(row.telefono ?? "");
      setCellulare(row.cellulare ?? "");
      setEmail(row.email ?? "");
      setConsenso(!!row.foto_consenso);
      loadFoto(row.foto_url);
    })();
  }, []);

  const onFile = async (f: File | null) => {
    if (!f || !a) return;
    if (!f.type.startsWith("image/")) return toast.error("Seleziona un'immagine");
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${a.org_id}/profili/${a.id}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("allegati-autisti").upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("autisti").update({ foto_url: path }).eq("id", a.id);
      if (error) throw error;
      setA({ ...a, foto_url: path });
      await loadFoto(path);
      toast.success("Foto aggiornata");
    } catch (e: any) {
      toast.error(e.message ?? "Caricamento non riuscito");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const salva = async () => {
    if (!a) return;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Email non valida");
    setSaving(true);
    const { error } = await supabase
      .from("autisti")
      .update({
        telefono: telefono.trim() || null,
        cellulare: cellulare.trim() || null,
        email: email.trim() || null,
        foto_consenso: consenso,
      })
      .eq("id", a.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dati aggiornati, l'ufficio è stato avvisato");
  };

  const ro = (label: string, value: any, suffix = "") => (
    <div className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value ?? "—"}{value != null && suffix}</span>
    </div>
  );

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate("/autista")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>

        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {fotoUrl
                ? <img src={fotoUrl} alt="Foto profilo autista" className="h-full w-full object-cover" />
                : <User className="h-8 w-8 text-muted-foreground" />}
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-lg leading-tight">
                {a ? `${a.nome} ${a.cognome}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">{a?.mansione || "Autista"}</div>
              <label className="mt-2 inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border text-sm font-medium cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {fotoUrl ? "Cambia foto" : "Carica foto"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              La tua fotografia potrà essere mostrata al cliente (ad esempio nella scheda del servizio)
              solo se dai il consenso qui sotto. Puoi revocarlo in qualsiasi momento.
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Label htmlFor="consenso" className="text-sm">Acconsento alla pubblicazione della foto</Label>
            <Switch id="consenso" checked={consenso} onCheckedChange={setConsenso} />
          </div>
        </Card>

        <Card className="p-4 rounded-2xl space-y-3">
          <div className="text-xs uppercase font-semibold text-muted-foreground">Contatti</div>
          <div>
            <Label htmlFor="cell">Cellulare</Label>
            <Input id="cell" value={cellulare} onChange={(e) => setCellulare(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <Label htmlFor="tel">Telefono</Label>
            <Input id="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <Label htmlFor="mail">Email</Label>
            <Input id="mail" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </div>
          <Button className="w-full min-h-[44px]" onClick={salva} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salva modifiche
          </Button>
        </Card>

        <Card className="p-4 rounded-2xl">
          <div className="text-xs uppercase font-semibold text-muted-foreground mb-1">
            Dati contrattuali (sola lettura)
          </div>
          {ro("Codice fiscale", a?.codice_fiscale)}
          {ro("Patente", a?.patente)}
          {ro("Ore ordinarie", a?.numero_ore_ord)}
          {ro("Paga oraria", a?.prezzo_ora_ord, " €")}
          {ro("Paga straordinario", a?.prezzo_ora_straord, " €")}
          {ro("Buono pasto", a?.buono_pasto, " €")}
          {ro("Trasferta", a?.trasferta, " €")}
          <p className="text-[11px] text-muted-foreground mt-2">
            Per correggere questi dati contatta l'ufficio.
          </p>
        </Card>
      </div>
    </AutistaLayout>
  );
}
