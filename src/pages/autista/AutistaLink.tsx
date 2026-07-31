import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ExternalLink, Link2, Star } from "lucide-react";

type LinkRow = {
  id: string;
  etichetta: string;
  url: string;
  icona: string | null;
  ordine: number;
  evidenza: boolean;
};

export default function AutistaLink() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [open, setOpen] = useState<LinkRow | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("link_utili")
        .select("id, etichetta, url, icona, ordine, evidenza")
        .eq("attivo", true)
        .order("evidenza", { ascending: false })
        .order("ordine", { ascending: true });
      setRows((data ?? []) as LinkRow[]);
    })();
  }, []);

  // Fallback: se il sito impedisce l'incorporamento, apri in una nuova scheda
  useEffect(() => {
    if (!open) return;
    setBlocked(false);
    const t = window.setTimeout(() => {
      setBlocked(true);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [open]);

  const apriEsterno = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const evidenza = rows.filter((r) => r.evidenza);
  const altri = rows.filter((r) => !r.evidenza);

  const item = (r: LinkRow, big = false) => (
    <button
      key={r.id}
      onClick={() => setOpen(r)}
      className={`w-full text-left rounded-2xl border bg-white p-4 min-h-[44px] flex items-center gap-3 active:scale-[0.99] transition ${
        big ? "shadow-sm" : ""
      }`}
    >
      <div className={`rounded-xl p-2 ${big ? "bg-primary/10" : "bg-muted"}`}>
        {big ? <Star className="h-5 w-5 text-primary" /> : <Link2 className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{r.etichetta}</div>
        <div className="text-[11px] text-muted-foreground truncate">{r.url}</div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate("/autista")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <h1 className="font-display font-semibold text-lg">Link utili</h1>

        {rows.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground rounded-2xl">
            Nessun link disponibile. L'ufficio può aggiungerli dalla dashboard.
          </Card>
        )}

        {evidenza.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase font-semibold text-muted-foreground">In evidenza</div>
            {evidenza.map((r) => item(r, true))}
          </div>
        )}
        {altri.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase font-semibold text-muted-foreground">Altri link</div>
            {altri.map((r) => item(r))}
          </div>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl h-[80vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm truncate">{open?.etichetta}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 relative">
            {open && (
              <iframe
                title={open.etichetta}
                src={open.url}
                className="absolute inset-0 h-full w-full"
                onLoad={() => setBlocked(false)}
              />
            )}
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {blocked ? "Alcuni siti non possono essere aperti qui dentro." : "Anteprima interna"}
            </span>
            <Button size="sm" onClick={() => open && apriEsterno(open.url)} className="min-h-[44px]">
              <ExternalLink className="h-4 w-4 mr-2" /> Apri in una nuova scheda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AutistaLayout>
  );
}
