import { useEffect, useState } from "react";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Square, Pencil, Check, X } from "lucide-react";

type Presenza = {
  id: string;
  data: string;
  inizio_at: string;
  fine_at: string | null;
  note: string | null;
  corretta_at: string | null;
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}
function durationH(start: string, end: string | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms / 3600000;
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AutistaPresenza() {
  const [list, setList] = useState<Presenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; inizio: string; fine: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const from = new Date();
    from.setDate(1);
    const { data } = await supabase
      .from("autisti_presenze")
      .select("id, data, inizio_at, fine_at, note, corretta_at")
      .gte("data", from.toISOString().slice(0, 10))
      .order("inizio_at", { ascending: false });
    setList((data ?? []) as Presenza[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const aperta = list.find((p) => !p.fine_at) ?? null;
  const oggiChiuse = list.filter((p) => p.data === today && p.fine_at);
  const oreOggi = list
    .filter((p) => p.data === today)
    .reduce((sum, p) => sum + (durationH(p.inizio_at, p.fine_at ?? new Date().toISOString()) ?? 0), 0);
  const oreMese = list.reduce((sum, p) => {
    const d = durationH(p.inizio_at, p.fine_at);
    return sum + (d ?? 0);
  }, 0);

  const apri = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("presenza_apri_turno", { _note: null });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Turno iniziato"); load(); }
  };
  const chiudi = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("presenza_chiudi_turno", { _note: null });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Turno concluso"); load(); }
  };
  const salvaCorrezione = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.rpc("presenza_correggi_oggi", {
      _presenza_id: editing.id,
      _inizio_at: new Date(editing.inizio).toISOString(),
      _fine_at: editing.fine ? new Date(editing.fine).toISOString() : null,
      _note: null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Turno corretto"); setEditing(null); load(); }
  };

  return (
    <AutistaLayout>
      <div className="space-y-4">
        {/* Stato corrente */}
        <Card
          className={`p-4 ${aperta ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-800"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-80">Stato attuale</div>
              <div className="font-display font-bold text-lg">
                {aperta
                  ? `In servizio dalle ${fmtTime(aperta.inizio_at)}`
                  : "Non in servizio"}
              </div>
            </div>
            {aperta ? (
              <Button
                size="lg"
                variant="secondary"
                onClick={chiudi}
                disabled={busy}
                className="bg-white text-emerald-700 hover:bg-white/90"
              >
                <Square className="h-4 w-4 mr-1" /> Termina servizio
              </Button>
            ) : (
              <Button size="lg" onClick={apri} disabled={busy}>
                <Play className="h-4 w-4 mr-1" /> Inizia servizio
              </Button>
            )}
          </div>
        </Card>

        {/* Riepilogo oggi */}
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground font-semibold mb-2">Oggi</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Inizio</div>
              <div className="font-semibold">
                {fmtTime(aperta?.inizio_at ?? oggiChiuse[0]?.inizio_at ?? null)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Fine</div>
              <div className="font-semibold">
                {aperta ? "in corso" : fmtTime(oggiChiuse[0]?.fine_at ?? null)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Ore totali</div>
              <div className="font-semibold">{oreOggi.toFixed(2)}</div>
            </div>
          </div>

          {/* correzione della giornata corrente */}
          {list.filter((p) => p.data === today).map((p) => (
            <div key={p.id} className="mt-3 pt-3 border-t text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">Turno:</span> {fmtTime(p.inizio_at)} → {fmtTime(p.fine_at)}{" "}
                  {p.corretta_at && <span className="text-amber-600">(corretto)</span>}
                </div>
                {editing?.id === p.id ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        id: p.id,
                        inizio: toLocalInput(p.inizio_at),
                        fine: p.fine_at ? toLocalInput(p.fine_at) : "",
                      })
                    }
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Correggi
                  </Button>
                )}
              </div>
              {editing?.id === p.id && (
                <div className="mt-2 space-y-2 bg-muted/40 p-2 rounded">
                  <div>
                    <Label className="text-[10px]">Inizio</Label>
                    <Input
                      type="datetime-local"
                      value={editing.inizio}
                      onChange={(e) => setEditing({ ...editing, inizio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Fine</Label>
                    <Input
                      type="datetime-local"
                      value={editing.fine}
                      onChange={(e) => setEditing({ ...editing, fine: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      <X className="h-3 w-3 mr-1" /> Annulla
                    </Button>
                    <Button size="sm" onClick={salvaCorrezione} disabled={busy}>
                      <Check className="h-3 w-3 mr-1" /> Salva
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>

        {/* Storico mese */}
        <Card className="p-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs uppercase text-muted-foreground font-semibold">Mese corrente</div>
            <div className="text-sm font-bold">{oreMese.toFixed(2)} h</div>
          </div>
          <div className="divide-y">
            {list.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground py-4 text-center">Nessun turno</div>
            )}
            {list.map((p) => {
              const h = durationH(p.inizio_at, p.fine_at);
              return (
                <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold">{fmtDate(p.data)}</span>{" "}
                    <span className="text-muted-foreground">
                      {fmtTime(p.inizio_at)} → {fmtTime(p.fine_at)}
                    </span>
                    {p.corretta_at && <span className="ml-1 text-amber-600">✎</span>}
                  </div>
                  <div className="font-mono">{h !== null ? h.toFixed(2) : "—"} h</div>
                </div>
              );
            })}
          </div>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center">
          Puoi correggere solo la giornata di oggi. Per giorni passati contatta l'ufficio.
        </p>
      </div>
    </AutistaLayout>
  );
}
