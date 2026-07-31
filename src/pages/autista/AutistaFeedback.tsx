import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Send, Loader2 } from "lucide-react";

type Fb = {
  id: string;
  testo: string;
  data: string;
  stato: string;
  risposta: string | null;
  risposto_at: string | null;
};

const STATI: Record<string, { label: string; cls: string }> = {
  nuovo: { label: "Inviato", cls: "bg-slate-100 text-slate-700" },
  letto: { label: "Letto", cls: "bg-amber-100 text-amber-800" },
  gestito: { label: "Gestito", cls: "bg-emerald-100 text-emerald-700" },
};

export default function AutistaFeedback() {
  const navigate = useNavigate();
  const [testo, setTesto] = useState("");
  const [rows, setRows] = useState<Fb[]>([]);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<{ id: string; org_id: string } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("autisti_feedback").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Fb[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase
        .from("autisti").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
      if (a) setMe({ id: a.id, org_id: a.org_id });
      load();
    })();
  }, []);

  const invia = async () => {
    const t = testo.trim();
    if (t.length < 3) return toast.error("Scrivi un messaggio");
    if (t.length > 2000) return toast.error("Messaggio troppo lungo (max 2000 caratteri)");
    if (!me) return toast.error("Profilo autista non trovato");
    setSending(true);
    const { error } = await supabase
      .from("autisti_feedback")
      .insert([{ autista_id: me.id, org_id: me.org_id, testo: t }]);
    setSending(false);
    if (error) return toast.error(error.message);
    setTesto("");
    toast.success("Messaggio inviato all'ufficio");
    load();
  };

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate("/autista")} className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <h1 className="font-display font-semibold text-xl">Feedback all'ufficio</h1>

        <div className="rounded-[18px] bg-white border p-4 space-y-3">
          <Textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Scrivi qui segnalazioni, problemi o suggerimenti…"
            rows={5}
            maxLength={2000}
            className="rounded-xl resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground tabular-nums">{testo.length}/2000</span>
            <Button className="h-11 rounded-xl gap-2" onClick={invia} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invia
            </Button>
          </div>
        </div>

        <h2 className="font-display font-semibold text-sm text-muted-foreground pt-2">I miei messaggi</h2>
        {rows.length === 0 ? (
          <div className="rounded-[18px] bg-white border p-10 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" /> Nessun messaggio inviato
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const st = STATI[r.stato] ?? STATI.nuovo;
              return (
                <div key={r.id} className="rounded-[18px] bg-white border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(r.data).toLocaleDateString("it-IT")}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.testo}</p>
                  {r.risposta && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                      <div className="text-[10px] font-semibold text-emerald-700 uppercase">Risposta ufficio</div>
                      <p className="text-sm mt-1 whitespace-pre-wrap text-emerald-900">{r.risposta}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AutistaLayout>
  );
}
