import { useEffect, useState } from "react";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { romeMonthRange } from "@/lib/romeDate";

type Compenso = {
  totale: number;
  quantita: Record<string, number>;
  voci: Record<string, number>;
  parametri: Record<string, number | null>;
};

const monthRange = (ym: string) => romeMonthRange(ym);
function fmtEur(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export default function AutistaLista() {
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [autistaId, setAutistaId] = useState<string | null>(null);
  const [isInterno, setIsInterno] = useState<boolean | null>(null);
  const [comp, setComp] = useState<Compenso | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase
        .from("autisti").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (a) {
        setAutistaId(a.id);
        setIsInterno(true);
      } else {
        setIsInterno(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!autistaId) return;
    (async () => {
      const { from, to } = monthRange(ym);
      const { data, error } = await supabase.rpc("calcola_compenso_autista", {
        _autista_id: autistaId, _from: from, _to: to,
      });
      if (!error && data) setComp(data as unknown as Compenso);
    })();
  }, [autistaId, ym]);

  if (isInterno === false) {
    return (
      <AutistaLayout>
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Come collaboratore esterno il compenso è regolato dal tuo tariffario.
          Questa sezione non è disponibile.
        </Card>
      </AutistaLayout>
    );
  }

  const q = comp?.quantita ?? {};
  const v = comp?.voci ?? {};

  return (
    <AutistaLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-display font-bold">Lista</h1>
            <p className="text-xs text-muted-foreground">Prospetto compenso mensile</p>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Mese</Label>
            <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
          </div>
        </div>

        <Card className="p-5 bg-primary text-primary-foreground">
          <div className="text-xs opacity-80">Totale maturato</div>
          <div className="text-3xl font-display font-bold">{fmtEur(comp?.totale ?? 0)}</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground font-semibold mb-3">Voci</div>
          <ul className="divide-y text-sm">
            <li className="py-2 flex justify-between">
              <span>Ore ordinarie ({Number(q.ore_ordinarie ?? 0).toFixed(2)} h)</span>
              <span className="font-semibold">{fmtEur(v.compenso_ordinario ?? 0)}</span>
            </li>
            <li className="py-2 flex justify-between">
              <span>Ore straordinarie ({Number(q.ore_straordinarie ?? 0).toFixed(2)} h)</span>
              <span className="font-semibold">{fmtEur(v.compenso_straordinario ?? 0)}</span>
            </li>
            <li className="py-2 flex justify-between">
              <span>
                Ore notturne ({Number(q.ore_notturne ?? 0).toFixed(2)} h
                {comp?.parametri?.percentuale_notturno
                  ? ` +${comp.parametri.percentuale_notturno}%`
                  : ""}
                )
              </span>
              <span className="font-semibold">{fmtEur(v.compenso_notturno ?? 0)}</span>
            </li>
            <li className="py-2 flex justify-between">
              <span>Trasferte ({q.trasferte ?? 0})</span>
              <span className="font-semibold">{fmtEur(v.compenso_trasferte ?? 0)}</span>
            </li>
            <li className="py-2 flex justify-between">
              <span>Trasferte 2 ({q.trasferte_2 ?? 0})</span>
              <span className="font-semibold">{fmtEur(v.compenso_trasferte_2 ?? 0)}</span>
            </li>
            <li className="py-2 flex justify-between">
              <span>Buoni pasto ({q.buoni_pasto ?? 0})</span>
              <span className="font-semibold">{fmtEur(v.compenso_buoni_pasto ?? 0)}</span>
            </li>
          </ul>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center px-4">
          Prospetto informativo: il documento ufficiale è la busta paga.
        </p>
      </div>
    </AutistaLayout>
  );
}
