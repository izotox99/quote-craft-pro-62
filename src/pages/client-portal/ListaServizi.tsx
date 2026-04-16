import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, CalendarDays } from "lucide-react";

type Servizio = {
  id: string;
  data_servizio: string;
  citta: string | null;
  contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  tipologia: string | null;
  luogo_inizio: string | null;
  itinerario: string | null;
  luogo_fine: string | null;
  stato: string;
  veicolo_id: string | null;
  codice: string | null;
};

export default function ListaServizi() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!client) return;

      let query = supabase
        .from("servizi")
        .select("*")
        .eq("client_id", client.id)
        .order("data_servizio", { ascending: false });

      if (dateFrom) query = query.gte("data_servizio", dateFrom);
      if (dateTo) query = query.lte("data_servizio", dateTo);

      const { data } = await query;
      setServizi((data ?? []) as Servizio[]);
      setLoading(false);
    };
    load();
  }, [user, dateFrom, dateTo]);

  const filtered = servizi.filter((s) =>
    (s.contatto ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.citta ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.codice ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const exportExcel = () => {
    const headers = ["Città", "Data servizio", "Passeggero", "N.P", "N.bg", "Tipo", "Luogo inizio", "Itinerario", "Luogo fine", "Stato", "Codice"];
    const rows = filtered.map(s => [
      s.citta ?? "", s.data_servizio, s.contatto ?? "", s.n_passeggeri ?? "", s.n_bagagli ?? "",
      s.tipologia ?? "", s.luogo_inizio ?? "", s.itinerario ?? "", s.luogo_fine ?? "", s.stato, s.codice ?? ""
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "servizi.csv";
    a.click();
  };

  const statoLabel: Record<string, string> = {
    nuovo: "Nuovo",
    confermato: "Confermato",
    in_corso: "In corso",
    completato: "Completato",
    annullato: "Annullato",
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Lista Servizi</h1>

        {/* Filtri */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Zona Ricerca</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Periodo da</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Periodo a</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Passeggero / Codice</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="pl-8 rounded-lg h-9" />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={exportExcel}>
                  <Download className="h-3.5 w-3.5" /> Esporta CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabella */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Nessun servizio trovato</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Città</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Passeggero</TableHead>
                      <TableHead>N.P</TableHead>
                      <TableHead>N.bg</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Luogo inizio</TableHead>
                      <TableHead>Itinerario</TableHead>
                      <TableHead>Luogo fine</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Codice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.citta ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(s.data_servizio).toLocaleDateString("it-IT")}</TableCell>
                        <TableCell>{s.contatto ?? "—"}</TableCell>
                        <TableCell>{s.n_passeggeri ?? 0}</TableCell>
                        <TableCell>{s.n_bagagli ?? 0}</TableCell>
                        <TableCell className="capitalize">{s.tipologia ?? "—"}</TableCell>
                        <TableCell>{s.luogo_inizio ?? "—"}</TableCell>
                        <TableCell>{s.itinerario ?? "—"}</TableCell>
                        <TableCell>{s.luogo_fine ?? "—"}</TableCell>
                        <TableCell>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                            {statoLabel[s.stato] ?? s.stato}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.codice ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
