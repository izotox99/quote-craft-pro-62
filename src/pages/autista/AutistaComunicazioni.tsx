import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, Megaphone, StickyNote, Inbox } from "lucide-react";

type Com = {
  id: string;
  titolo: string;
  testo: string;
  priorita: string;
  destinatari: string;
  allegato_path: string | null;
  allegato_nome: string | null;
  pubblicata_at: string;
};

const PRIO: Record<string, { label: string; cls: string }> = {
  normale: { label: "Normale", cls: "bg-slate-100 text-slate-700" },
  importante: { label: "Importante", cls: "bg-amber-100 text-amber-800" },
  urgente: { label: "Urgente", cls: "bg-red-100 text-red-700" },
};

export default function AutistaComunicazioni() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Com[]>([]);
  const [letti, setLetti] = useState<Set<string>>(new Set());
  const [aperta, setAperta] = useState<string | null>(null);
  const [autistaId, setAutistaId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase
        .from("autisti").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
      setAutistaId(a?.id ?? null);
      setOrgId(a?.org_id ?? null);

      const [{ data: c }, { data: l }] = await Promise.all([
        supabase.from("comunicazioni").select("*").order("pubblicata_at", { ascending: false }),
        supabase.from("comunicazioni_letture").select("comunicazione_id"),
      ]);
      setRows((c ?? []) as Com[]);
      setLetti(new Set((l ?? []).map((x: any) => x.comunicazione_id)));
      setLoading(false);
    })();
  }, []);

  const apri = async (c: Com) => {
    setAperta(aperta === c.id ? null : c.id);
    if (!letti.has(c.id) && autistaId && orgId) {
      setLetti((p) => new Set(p).add(c.id));
      await supabase.from("comunicazioni_letture").insert([
        { comunicazione_id: c.id, autista_id: autistaId, org_id: orgId },
      ]);
    }
  };

  const apriAllegato = async (path: string) => {
    const { data, error } = await supabase.storage.from("allegati-autisti").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Impossibile aprire l'allegato");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate("/autista")} className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <h1 className="font-display font-semibold text-xl">Comunicazioni e note</h1>

        {!loading && rows.length === 0 && (
          <div className="rounded-[18px] bg-white border p-10 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nessuna comunicazione
          </div>
        )}

        <div className="space-y-2">
          {rows.map((c) => {
            const letta = letti.has(c.id);
            const prio = PRIO[c.priorita] ?? PRIO.normale;
            const nota = c.destinatari === "singolo";
            return (
              <button
                key={c.id}
                onClick={() => apri(c)}
                className={`w-full text-left rounded-[18px] border bg-white p-4 transition active:scale-[0.99] ${
                  c.priorita === "urgente" ? "border-red-300" : ""
                } ${!letta ? "shadow-sm ring-1 ring-primary/20" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2 ${nota ? "bg-violet-100" : "bg-primary/10"}`}>
                    {nota ? <StickyNote className="h-4 w-4 text-violet-600" /> : <Megaphone className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {nota ? "Nota" : "Comunicazione"}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${prio.cls}`}>{prio.label}</span>
                      {!letta && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div className={`mt-1 text-sm ${!letta ? "font-semibold" : "font-medium"} ${c.priorita === "urgente" ? "text-red-700" : ""}`}>
                      {c.titolo}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(c.pubblicata_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                    {aperta === c.id && (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm whitespace-pre-wrap text-foreground/90">{c.testo}</p>
                        {c.allegato_path && (
                          <Button
                            variant="outline" size="sm" className="h-10 rounded-xl gap-2"
                            onClick={(e) => { e.stopPropagation(); apriAllegato(c.allegato_path!); }}
                          >
                            <Paperclip className="h-4 w-4" /> {c.allegato_nome ?? "Allegato"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AutistaLayout>
  );
}
