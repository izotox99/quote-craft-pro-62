import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Tariffario() {
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<{ url: string; nome: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Resolve client_id (parent client or utenza)
      const { data: parent } = await supabase.from("clients")
        .select("tariffario_url, tariffario_nome")
        .eq("auth_user_id", user.id).maybeSingle();
      if (parent?.tariffario_url) {
        setFile({ url: parent.tariffario_url, nome: parent.tariffario_nome });
        setLoading(false);
        return;
      }
      const { data: utenza } = await supabase.from("client_utenze")
        .select("parent_client_id").eq("auth_user_id", user.id).eq("attivo", true).maybeSingle();
      if (utenza?.parent_client_id) {
        const { data: c } = await supabase.from("clients")
          .select("tariffario_url, tariffario_nome").eq("id", utenza.parent_client_id).maybeSingle();
        if (c?.tariffario_url) setFile({ url: c.tariffario_url, nome: c.tariffario_nome });
      }
      setLoading(false);
    })();
  }, []);

  const open = async () => {
    if (!file) return;
    const { data, error } = await supabase.storage.from("tariffari-clienti").createSignedUrl(file.url, 300);
    if (error || !data?.signedUrl) { toast.error("Impossibile aprire il file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Tariffario</h1>
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="py-10">
            {loading ? (
              <div className="h-20 rounded-lg bg-muted animate-pulse" />
            ) : file ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <FileText className="h-12 w-12 text-primary" />
                <div>
                  <p className="font-medium">{file.nome ?? "Tariffario"}</p>
                  <p className="text-sm text-muted-foreground mt-1">Apri il tuo tariffario aggiornato</p>
                </div>
                <Button className="gap-2 rounded-lg" onClick={open}>
                  <ExternalLink className="h-4 w-4" /> Apri tariffario
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Nessun tariffario disponibile</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
