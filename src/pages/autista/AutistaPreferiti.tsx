import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, GripVertical, Loader2 } from "lucide-react";
import { ALL_TILES, mergePrefs, TilePref } from "@/lib/autistaTiles";

export default function AutistaPreferiti() {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ id: string; org_id: string } | null>(null);
  const [prefs, setPrefs] = useState<TilePref[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase
        .from("autisti").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
      if (!a) return;
      setMe({ id: a.id, org_id: a.org_id });
      const { data: p } = await supabase
        .from("autisti_preferenze").select("tasti").eq("autista_id", a.id).maybeSingle();
      setPrefs(mergePrefs((p?.tasti as unknown as TilePref[]) ?? null));
    })();
  }, []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= prefs.length || from === to) return;
    const next = prefs.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setPrefs(next);
  };

  const toggle = (key: string, v: boolean) =>
    setPrefs((p) => p.map((x) => (x.key === key ? { ...x, visibile: v } : x)));

  const salva = async () => {
    if (!me) return;
    setSaving(true);
    const { error } = await supabase
      .from("autisti_preferenze")
      .upsert({ autista_id: me.id, org_id: me.org_id, tasti: prefs as any }, { onConflict: "autista_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preferenze salvate");
    navigate("/autista");
  };

  return (
    <AutistaLayout>
      <div className="space-y-3 pb-24">
        <button onClick={() => navigate("/autista")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <h1 className="font-display font-semibold text-lg">Tasti preferiti</h1>
        <p className="text-xs text-muted-foreground">
          Trascina per riordinare i tasti della home e usa gli interruttori per mostrarli o nasconderli.
        </p>

        <Card className="rounded-2xl divide-y overflow-hidden">
          {prefs.map((p, i) => {
            const def = ALL_TILES.find((t) => t.key === p.key);
            if (!def) return null;
            const Icon = def.icon;
            return (
              <div
                key={p.key}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                className="flex items-center gap-3 px-3 py-2 bg-white min-h-[52px]"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0" />
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <span className="flex-1 text-sm font-medium truncate">{def.label}</span>
                <div className="flex items-center gap-1">
                  <button
                    aria-label="Sposta su"
                    className="h-9 w-9 rounded-lg border text-xs"
                    onClick={() => move(i, i - 1)}
                  >↑</button>
                  <button
                    aria-label="Sposta giù"
                    className="h-9 w-9 rounded-lg border text-xs"
                    onClick={() => move(i, i + 1)}
                  >↓</button>
                </div>
                <Switch checked={p.visibile} onCheckedChange={(v) => toggle(p.key, v)} />
              </div>
            );
          })}
        </Card>
      </div>

      <div className="fixed bottom-16 inset-x-0 z-30 bg-white/95 backdrop-blur border-t px-3 py-3 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl">
          <Button className="w-full min-h-[44px]" onClick={salva} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Fatto
          </Button>
        </div>
      </div>
    </AutistaLayout>
  );
}
