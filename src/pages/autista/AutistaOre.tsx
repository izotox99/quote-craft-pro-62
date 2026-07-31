import { useEffect, useState } from "react";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import { romeToday, romeMonthStart } from "@/lib/romeDate";

type OreRow = {
  id: string;
  data: string;
  ore_ordinarie: number;
  ore_straordinarie: number;
  ore_notturne: number;
  tipologia_partenza: string | null;
  trasferta_tipo: "nessuna" | "trasferta" | "trasferta_2";
  buono_pasto: boolean;
  servizio_id: string | null;
  note: string | null;
};

const TIPOLOGIA = [
  { v: "altro_luogo", l: "Da/per altro luogo" },
  { v: "aeroporto", l: "Per aeroporto" },
  { v: "civitavecchia", l: "Per Civitavecchia" },
  { v: "stazione", l: "Per stazione" },
] as const;

const TRASFERTA = [
  { v: "nessuna", l: "Nessuna" },
  { v: "trasferta", l: "Trasferta" },
  { v: "trasferta_2", l: "Trasferta 2" },
] as const;

export default function AutistaOre() {
  const [autistaId, setAutistaId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [list, setList] = useState<OreRow[]>([]);
  const [busy, setBusy] = useState(false);
  const today = romeToday();

  const emptyForm = {
    data: today,
    ore_ordinarie: "",
    ore_straordinarie: "",
    ore_notturne: "",
    tipologia_partenza: "altro_luogo",
    trasferta_tipo: "nessuna" as OreRow["trasferta_tipo"],
    buono_pasto: false,
    note: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: a } = await supabase
      .from("autisti").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
    if (!a) return;
    setAutistaId(a.id);
    setOrgId(a.org_id);
    const from = romeMonthStart();
    const { data } = await supabase
      .from("autisti_ore")
      .select("*")
      .eq("autista_id", a.id)
      .gte("data", from)
      .order("data", { ascending: false });
    setList((data ?? []) as OreRow[]);
  };

  useEffect(() => { load(); }, []);

  const parseNum = (s: string) => {
    if (!s) return 0;
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const salva = async () => {
    if (!autistaId || !orgId) return;
    const ord = parseNum(form.ore_ordinarie);
    const str = parseNum(form.ore_straordinarie);
    const not = parseNum(form.ore_notturne);
    if (ord === 0 && str === 0 && not === 0 && form.trasferta_tipo === "nessuna" && !form.buono_pasto) {
      toast.error("Compila almeno una voce");
      return;
    }
    if (ord + str + not > 24) {
      toast.error("Ore totali maggiori di 24");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("autisti_ore").insert({
      autista_id: autistaId,
      org_id: orgId,
      data: form.data,
      ore_ordinarie: ord,
      ore_straordinarie: str,
      ore_notturne: not,
      tipologia_partenza: form.tipologia_partenza as any,
      trasferta_tipo: form.trasferta_tipo,
      buono_pasto: form.buono_pasto,
      note: form.note || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Dichiarazione salvata");
      setForm(emptyForm);
      load();
    }
  };

  const elimina = async (id: string) => {
    const { error } = await supabase.from("autisti_ore").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Riga eliminata"); load(); }
  };

  return (
    <AutistaLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-display font-bold">Dichiarazione ore</h1>
          <p className="text-xs text-muted-foreground">Inserisci le ore lavorate per giornata.</p>
        </div>

        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Giorno</Label>
            <Input
              type="date"
              value={form.data}
              max={today}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Ordinarie</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={form.ore_ordinarie}
                onChange={(e) => setForm({ ...form, ore_ordinarie: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Straordinarie</Label>
              <Input
                inputMode="decimal"
                placeholder="1,5"
                value={form.ore_straordinarie}
                onChange={(e) => setForm({ ...form, ore_straordinarie: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Notturne</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={form.ore_notturne}
                onChange={(e) => setForm({ ...form, ore_notturne: e.target.value })}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Ordinarie, straordinarie e notturne sono voci <b>distinte</b>: non sommarle due volte.
            Se un'ora è già stata dichiarata come notturna, non contarla anche come ordinaria.
          </p>

          <div>
            <Label className="text-xs">Tipologia di partenza</Label>
            <Select
              value={form.tipologia_partenza}
              onValueChange={(v) => setForm({ ...form, tipologia_partenza: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOLOGIA.map((t) => (
                  <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Trasferta</Label>
            <Select
              value={form.trasferta_tipo}
              onValueChange={(v) => setForm({ ...form, trasferta_tipo: v as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRASFERTA.map((t) => (
                  <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Buono pasto</Label>
            <Switch
              checked={form.buono_pasto}
              onCheckedChange={(v) => setForm({ ...form, buono_pasto: v })}
            />
          </div>

          <div>
            <Label className="text-xs">Note (facoltative)</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <Button className="w-full" onClick={salva} disabled={busy}>
            <Save className="h-4 w-4 mr-1" /> Salva dichiarazione
          </Button>
        </Card>

        {/* Storico mese */}
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground font-semibold mb-2">
            Storico mese
          </div>
          {list.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">Nessuna dichiarazione</div>
          )}
          <div className="divide-y">
            {list.map((r) => (
              <div key={r.id} className="py-2 text-xs flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {new Date(r.data + "T00:00:00").toLocaleDateString("it-IT")}
                  </div>
                  <div className="text-muted-foreground">
                    Ord {Number(r.ore_ordinarie).toFixed(2)} · Str {Number(r.ore_straordinarie).toFixed(2)} · Not {Number(r.ore_notturne).toFixed(2)}
                    {r.trasferta_tipo !== "nessuna" && ` · ${r.trasferta_tipo === "trasferta" ? "Trasf." : "Trasf.2"}`}
                    {r.buono_pasto && " · BP"}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => elimina(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AutistaLayout>
  );
}
