import { Fragment, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronRight, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MESI, ANNI, eur2, num, pct, periodoRange, percentualeApplicata, ServizioRiga, servizioLabel } from "@/lib/consuntivo";

type Esterno = { id: string; nome: string; percentuale_network: number | null; percentuale_last_minute: number | null };

export default function ConsuntivoCollaboratore() {
  const oggi = new Date();
  const [mese, setMese] = useState(String(oggi.getMonth() + 1));
  const [anno, setAnno] = useState(String(oggi.getFullYear()));
  const [autistaId, setAutistaId] = useState("tutti");
  const [esterni, setEsterni] = useState<Esterno[]>([]);
  const [righe, setRighe] = useState<ServizioRiga[]>([]);
  const [loading, setLoading] = useState(false);
  const [aperti, setAperti] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase
      .from("autisti_esterni")
      .select("id, nome, percentuale_network, percentuale_last_minute")
      .order("nome")
      .then(({ data }) => setEsterni((data ?? []) as Esterno[]));
  }, []);

  const cerca = async () => {
    setLoading(true);
    const { from, to } = periodoRange(Number(anno), Number(mese));
    let q = supabase
      .from("servizi")
      .select("id, data_servizio, ora_inizio, contatto, codice, client_id, autista_esterno_id, prezzo, prezzo_fattura, prezzo_ccredito, prezzo_contante, non_incassato, com_cliente, costo_commissione, fatturato, last_minute")
      .gte("data_servizio", from)
      .lte("data_servizio", to)
      .eq("archiviato", false)
      .not("autista_esterno_id", "is", null)
      .order("data_servizio");
    if (autistaId !== "tutti") q = q.eq("autista_esterno_id", autistaId);
    const { data } = await q;
    setRighe((data ?? []) as unknown as ServizioRiga[]);
    setLoading(false);
  };

  useEffect(() => { cerca(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const gruppi = useMemo(() => {
    const map = new Map<string, ServizioRiga[]>();
    for (const s of righe) {
      const key = s.autista_esterno_id!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()]
      .map(([id, servizi]) => {
        const a = esterni.find((e) => e.id === id);
        const percBase = num(a?.percentuale_network);
        const t = servizi.reduce(
          (acc, s) => {
            const base = num(s.prezzo) || num(s.prezzo_fattura);
            const p = a ? percentualeApplicata(s, a) : 0;
            const netto = base * (1 - p / 100);
            return {
              fatturaCliente: acc.fatturaCliente + num(s.prezzo_fattura),
              ccredito: acc.ccredito + num(s.prezzo_ccredito),
              nonInc: acc.nonInc + num(s.non_incassato),
              inc: acc.inc + num(s.prezzo_contante),
              base: acc.base + base,
              comm_cliente: acc.comm_cliente + num(s.com_cliente),
              commissione: acc.commissione + num(s.costo_commissione),
              netto: acc.netto + netto,
              risultato: acc.risultato + (base - netto),
              omaggio: acc.omaggio + (base === 0 ? 1 : 0),
            };
          },
          { fatturaCliente: 0, ccredito: 0, nonInc: 0, inc: 0, base: 0, comm_cliente: 0, commissione: 0, netto: 0, risultato: 0, omaggio: 0 },
        );
        return { id, nome: a?.nome ?? "Collaboratore", perc: percBase, servizi, ...t };
      })
      .sort((x, y) => x.nome.localeCompare(y.nome));
  }, [righe, esterni]);

  const tot = useMemo(
    () =>
      gruppi.reduce(
        (a, g) => ({
          fatturaCliente: a.fatturaCliente + g.fatturaCliente,
          ccredito: a.ccredito + g.ccredito,
          nonInc: a.nonInc + g.nonInc,
          inc: a.inc + g.inc,
          base: a.base + g.base,
          comm_cliente: a.comm_cliente + g.comm_cliente,
          commissione: a.commissione + g.commissione,
          netto: a.netto + g.netto,
          risultato: a.risultato + g.risultato,
          omaggio: a.omaggio + g.omaggio,
        }),
        { fatturaCliente: 0, ccredito: 0, nonInc: 0, inc: 0, base: 0, comm_cliente: 0, commissione: 0, netto: 0, risultato: 0, omaggio: 0 },
      ),
    [gruppi],
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold font-display">Consuntivo Collaboratore</h1>

        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Label className="text-xs">Mese</Label>
              <Select value={mese} onValueChange={setMese}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESI.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label className="text-xs">Anno</Label>
              <Select value={anno} onValueChange={setAnno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ANNI.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-56 flex-1">
              <Label className="text-xs">Autista</Label>
              <Select value={autistaId} onValueChange={setAutistaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti i collaboratori</SelectItem>
                  {esterni.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} - Esterno</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={cerca} disabled={loading} className="gap-2">
              <Search className="h-4 w-4" /> Ricerca
            </Button>
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-8" />
                <th className="p-2 text-left">Autista</th>
                <th className="p-2 text-right">Fattura Cliente</th>
                <th className="p-2 text-right">Carta di Credito</th>
                <th className="p-2 text-right">C. non inc</th>
                <th className="p-2 text-right">Inc</th>
                <th className="p-2 text-right">Prezzo Fattura</th>
                <th className="p-2 text-right">%</th>
                <th className="p-2 text-right">Comm. Cliente</th>
                <th className="p-2 text-right">Commissione</th>
                <th className="p-2 text-right">Netto Fattura</th>
                <th className="p-2 text-right">Risultato</th>
                <th className="p-2 text-center">Omaggio</th>
              </tr>
            </thead>
            <tbody>
              {gruppi.length === 0 && (
                <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Nessun servizio nel periodo</td></tr>
              )}
              {gruppi.map((g) => (
                <Fragment key={g.id}>
                  <tr
                    className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
                    onClick={() => setAperti((p) => ({ ...p, [g.id]: !p[g.id] }))}
                  >
                    <td className="pl-2">
                      {aperti[g.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="p-2 font-medium">{g.nome} - Esterno</td>
                    <td className="p-2 text-right">{eur2(g.fatturaCliente)}</td>
                    <td className="p-2 text-right">{eur2(g.ccredito)}</td>
                    <td className={cn("p-2 text-right", g.nonInc > 0 && "text-destructive font-medium")}>{eur2(g.nonInc)}</td>
                    <td className="p-2 text-right">{eur2(g.inc)}</td>
                    <td className="p-2 text-right">{eur2(g.base)}</td>
                    <td className="p-2 text-right">{pct(g.perc)}</td>
                    <td className="p-2 text-right">{eur2(g.comm_cliente)}</td>
                    <td className="p-2 text-right">{eur2(g.commissione)}</td>
                    <td className="p-2 text-right">{eur2(g.netto)}</td>
                    <td className="p-2 text-right font-medium">{eur2(g.risultato)}</td>
                    <td className="p-2 text-center">{g.omaggio}</td>
                  </tr>
                  {aperti[g.id] &&
                    g.servizi.map((s) => {
                      const base = num(s.prezzo) || num(s.prezzo_fattura);
                      const a = esterni.find((e) => e.id === g.id);
                      const p = a ? percentualeApplicata(s, a) : 0;
                      const netto = base * (1 - p / 100);
                      return (
                        <tr key={s.id} className="border-t border-border/30 bg-muted/20 text-xs">
                          <td />
                          <td className="p-2 pl-6" colSpan={5}>
                            {servizioLabel(s)}{s.last_minute ? " · last minute" : ""}
                          </td>
                          <td className="p-2 text-right">{eur2(base)}</td>
                          <td className="p-2 text-right">{pct(p)}</td>
                          <td colSpan={2} />
                          <td className="p-2 text-right">{eur2(netto)}</td>
                          <td className="p-2 text-right">{eur2(base - netto)}</td>
                          <td />
                        </tr>
                      );
                    })}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td />
                <td className="p-2">Totali</td>
                <td className="p-2 text-right">{eur2(tot.fatturaCliente)}</td>
                <td className="p-2 text-right">{eur2(tot.ccredito)}</td>
                <td className="p-2 text-right">{eur2(tot.nonInc)}</td>
                <td className="p-2 text-right">{eur2(tot.inc)}</td>
                <td className="p-2 text-right">{eur2(tot.base)}</td>
                <td />
                <td className="p-2 text-right">{eur2(tot.comm_cliente)}</td>
                <td className="p-2 text-right">{eur2(tot.commissione)}</td>
                <td className="p-2 text-right">{eur2(tot.netto)}</td>
                <td className="p-2 text-right">{eur2(tot.risultato)}</td>
                <td className="p-2 text-center">{tot.omaggio}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
