import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Props = {
  clientId: string;
  orgId: string;
  currentUrl: string | null;
  currentName: string | null;
  onChange?: () => void;
};

export function TariffarioUpload({ clientId, orgId, currentUrl, currentName, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFile = async () => {
    if (!currentUrl) return;
    const { data, error } = await supabase.storage.from("tariffari-clienti").createSignedUrl(currentUrl, 300);
    if (error || !data?.signedUrl) { toast.error("Impossibile aprire il file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const upload = async (file: File) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Formato non supportato (PDF o immagine)"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File troppo grande (max 10MB)"); return; }
    setBusy(true);
    try {
      // Remove previous file if any
      if (currentUrl) {
        await supabase.storage.from("tariffari-clienti").remove([currentUrl]);
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${orgId}/${clientId}/tariffario-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tariffari-clienti").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("clients")
        .update({ tariffario_url: path, tariffario_nome: file.name })
        .eq("id", clientId);
      if (dbErr) throw dbErr;
      toast.success("Tariffario caricato");
      onChange?.();
    } catch (e: any) {
      toast.error(e.message || "Errore caricamento");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!currentUrl) return;
    setBusy(true);
    try {
      await supabase.storage.from("tariffari-clienti").remove([currentUrl]);
      await supabase.from("clients").update({ tariffario_url: null, tariffario_nome: null }).eq("id", clientId);
      toast.success("Tariffario rimosso");
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {currentUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">{currentName || "tariffario"}</span>
          <Button type="button" size="sm" variant="ghost" onClick={openFile} className="h-8 gap-1">
            <ExternalLink className="h-3.5 w-3.5" /> Apri
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy} className="h-8 gap-1">
            <Upload className="h-3.5 w-3.5" /> Sostituisci
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={busy} className="h-8 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} className="gap-2 rounded-lg">
          <Upload className="h-4 w-4" /> {busy ? "Caricamento..." : "Carica tariffario (PDF/immagine)"}
        </Button>
      )}
    </div>
  );
}
