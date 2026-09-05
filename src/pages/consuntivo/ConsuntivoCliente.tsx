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
import { MESI, ANNI, eur2, num, periodoRange, ServizioRiga, servizioLabel } from "@/lib/consuntivo";

type Cliente = { id: string; name: string };

export default function ConsuntivoCliente() {
  const oggi = new Date();
  const [mese, setMese] = useState(String(oggi.getMonth() + 1));
  const [anno, setAnno] = useState(String(oggi.getFullYear()));
  const [clienteId, setClienteId] = useState("tutti");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [righe, setRighe] = useState<ServizioRiga[]>([]);
  const [loading, setLoading] = useState(false);
  const [aperti, setAperti] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClienti((data ?? []) as Cliente[]));
  }, []);

  const cerca = async () => {
    setLoading(true);
    const { from, to } = periodoRange(Number(anno), Number(mese));
    let q = supabase
      .from("servizi")
      .select("id, data_servizio, ora_inizio, contatto, codice, client_id, prezzo, prezzo_fattura, prezzo_ccredito, prezzo_contante, non_incassato, com_cliente, costo_commissione, fatturato")
      .gte("data_servizio", from)
      .lte("data_servizio", to)
      .eq("archiviato", false)
      .order("data_servizio");
    if (clienteId !== "tutti") q = q.eq("client_id", clienteId);
    const { data } = await q;
    setRighe((data ?? []) as unknown as ServizioRiga[]);
    setLoading(false);
  };

  useEffect(() => { cerca(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const gruppi = useMemo(() => {
    const map = new Map<string, { nome: string; servizi: ServizioRiga[] }>();
    for (const s of righe) {
      const key = s.client_id ?? "senza";
      if (!map.has(key)) {
        map.set(key, {
          nome: clienti.find((c) => c.id === s.client_id)?.name ?? "Senza cliente",
          servizi: [],
        });
      }
      map.get(key)!.servizi.push(s);
    }
    return [...map.entries()]
      .map(([id, g]) => {
        const t = g.servizi.reduce(
          (a, s) => ({
            fattura: a.fattura + num(s.prezzo_fattura),
            ccredito: a.ccredito + num(s.prezzo_ccredito),
            nonInc: a.nonInc + num(s.non_incassato),
            cash: a.cash + num(s.prezzo_contante),
            comm_cliente: a.comm_cliente + num(s.com_cliente),
            commissione: a.commissione + num(s.costo_commissione),
            fatturati: a.fatturati + (s.fatturato ? 1 : 0),
            omaggio: a.omaggio + (num(s.prezzo) === 0 && num(s.prezzo_fattura) === 0 ? 1 : 0),
          }),
          { fattura: 0, ccredito: 0, nonInc: 0, cash: 0, comm_cliente: 0, commissione: 0, fatturati: 0, omaggio: 0 },
        );
        return { id, nome: g.nome, servizi: g.servizi, ...t, totale: g.servizi.length };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [righe, clienti]);

  const tot = useMemo(
    () =>
      gruppi.reduce(
        (a, g) => ({
          fattura: a.fattura + g.fattura,
          ccredito: a.ccredito + g.ccredito,
          nonInc: a.nonInc + g.nonInc,
          cash: a.cash + g.cash,
          comm_cliente: a.comm_cliente + g.comm_cliente,
          commissione: a.commissione + g.commissione,
          fatturati: a.fatturati + g.fatturati,
          totale: a.totale + g.totale,
          omaggio: a.omaggio + g.omaggio,
        }),
        { fattura: 0, ccredito: 0, nonInc: 0, cash: 0, comm_cliente: 0, commissione: 0, fatturati: 0, totale: 0, omaggio: 0 },
      ),
    [gruppi],
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold font-display">Consuntivo Cliente</h1>

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
              <Label className="text-xs">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti i clienti</SelectItem>
                  {clienti.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={cerca} disabled={loading} className="gap-2">
              <Search className="h-4 w-4" /> Ricerca
            </Button>
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-8" />
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-right">Prezzo Fattura</th>
                <th className="p-2 text-right">Carta di Credito</th>
                <th className="p-2 text-right">C. non inc</th>
                <th className="p-2 text-right">Prezzo Cash</th>
                <th className="p-2 text-right">Comm. Cliente</th>
                <th className="p-2 text-right">Commissione</th>
                <th className="p-2 text-center">Fatturato</th>
                <th className="p-2 text-center">Omaggio</th>
              </tr>
            </thead>
            <tbody>
              {gruppi.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nessun servizio nel periodo</td></tr>
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
                    <td className="p-2 font-medium">{g.nome}</td>
                    <td className="p-2 text-right">{eur2(g.fattura)}</td>
                    <td className="p-2 text-right">{eur2(g.ccredito)}</td>
                    <td className={cn("p-2 text-right", g.nonInc > 0 && "text-destructive font-medium")}>{eur2(g.nonInc)}</td>
                    <td className="p-2 text-right">{eur2(g.cash)}</td>
                    <td className="p-2 text-right">{eur2(g.comm_cliente)}</td>
                    <td className="p-2 text-right">{eur2(g.commissione)}</td>
                    <td className="p-2 text-center">{g.fatturati}/{g.totale}</td>
                    <td className="p-2 text-center">{g.omaggio}</td>
                  </tr>
                  {aperti[g.id] &&
                    g.servizi.map((s) => (
                      <tr key={s.id} className="border-t border-border/30 bg-muted/20 text-xs">
                        <td />
                        <td className="p-2 pl-6" colSpan={4}>{servizioLabel(s)}</td>
                        <td className="p-2 text-right" colSpan={5}>{eur2(num(s.prezzo_fattura) || num(s.prezzo))}</td>
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td />
                <td className="p-2">Totali</td>
                <td className="p-2 text-right">{eur2(tot.fattura)}</td>
                <td className="p-2 text-right">{eur2(tot.ccredito)}</td>
                <td className="p-2 text-right">{eur2(tot.nonInc)}</td>
                <td className="p-2 text-right">{eur2(tot.cash)}</td>
                <td className="p-2 text-right">{eur2(tot.comm_cliente)}</td>
                <td className="p-2 text-right">{eur2(tot.commissione)}</td>
                <td className="p-2 text-center">{tot.fatturati}/{tot.totale}</td>
                <td className="p-2 text-center">{tot.omaggio}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
