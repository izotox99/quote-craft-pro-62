import { useState } from "react";
import { Image as ImageIcon, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { CARTELLO_ACCEPT, CARTELLO_MAX_MB, validateCartelloFile, openCartello } from "@/lib/cartello";

interface Props {
  /** File già salvato sul servizio */
  path?: string | null;
  nome?: string | null;
  /** File selezionato ma non ancora caricato */
  file?: File | null;
  onFile: (file: File | null) => void;
  /** Rimozione del file già salvato */
  onRemoveExisting?: () => void;
  disabled?: boolean;
}

export default function CartelloUpload({ path, nome, file, onFile, onRemoveExisting, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  const handlePick = (f: File | null) => {
    if (!f) return;
    const err = validateCartelloFile(f);
    if (err) { toast.error(err); return; }
    onFile(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
        <ImageIcon className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 min-w-0 truncate text-xs">{file.name}</span>
        {!disabled && (
          <button type="button" onClick={() => onFile(null)} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  if (path) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
        <ImageIcon className="h-4 w-4 text-primary shrink-0" />
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); const u = await openCartello(path); setBusy(false); if (!u) toast.error("Impossibile aprire il cartello"); }}
          className="flex-1 min-w-0 truncate text-left text-xs font-medium hover:underline"
        >
          {nome ?? "Cartello"}
        </button>
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        {!disabled && (
          <>
            <label className="cursor-pointer text-[11px] text-primary hover:underline">
              Sostituisci
              <input type="file" accept={CARTELLO_ACCEPT} className="hidden" onChange={e => handlePick(e.target.files?.[0] ?? null)} />
            </label>
            {onRemoveExisting && (
              <button type="button" onClick={onRemoveExisting} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <label className={`flex items-center gap-2 rounded-md border border-dashed border-border/60 px-2 py-1.5 text-xs text-muted-foreground ${disabled ? "opacity-60" : "cursor-pointer hover:border-primary/60"}`}>
      <ImageIcon className="h-4 w-4" />
      <span>Allega cartello (immagine o PDF, max {CARTELLO_MAX_MB} MB)</span>
      <input type="file" accept={CARTELLO_ACCEPT} className="hidden" disabled={disabled} onChange={e => handlePick(e.target.files?.[0] ?? null)} />
    </label>
  );
}
