import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Phone, Building2, StickyNote } from "lucide-react";
import { TariffarioUpload } from "@/components/clients/TariffarioUpload";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  nuovo: "bg-blue-100 text-blue-800",
  da_confermare: "bg-orange-100 text-orange-800",
  confermato: "bg-green-100 text-green-800",
  in_corso: "bg-yellow-100 text-yellow-800",
  completato: "bg-gray-100 text-gray-800",
  annullato: "bg-red-100 text-red-800",
};

type Client = { id: string; name: string; email: string | null; company: string | null; phone: string | null; notes: string | null; created_at: string; org_id: string; tariffario_url: string | null; tariffario_nome: string | null; };
type Servizio = { id: string; data_servizio: string; citta: string | null; luogo_inizio: string | null; luogo_fine: string | null; stato: string; incasso: number | null; };

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("servizi").select("id, data_servizio, citta, luogo_inizio, luogo_fine, stato, incasso").eq("client_id", id).eq("archiviato", false).order("data_servizio", { ascending: false }),
    ]).then(([cRes, sRes]) => {
      setClient(cRes.data as Client | null);
      setServizi((sRes.data ?? []) as Servizio[]);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <DashboardLayout><div className="space-y-4">{[1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div></DashboardLayout>;
  }

  if (!client) {
    return <DashboardLayout><div className="py-20 text-center"><p className="text-muted-foreground">Cliente non trovato</p><Button className="mt-4" onClick={() => navigate("/clients")}>Torna ai clienti</Button></div></DashboardLayout>;
  }

  const totaleIncassi = servizi.reduce((s, sv) => s + (Number(sv.incasso) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.company || "Nessuna società"} · Aggiunto il {format(new Date(client.created_at), "dd/MM/yyyy")}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Totale servizi</p><p className="text-2xl font-bold font-display text-card-foreground">{servizi.length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Totale incassi</p><p className="text-2xl font-bold font-display text-card-foreground">€{totaleIncassi.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Servizi completati</p><p className="text-2xl font-bold font-display text-success">{servizi.filter(s => s.stato === "completato").length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Informazioni contatto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{client.email}</span></div>}
            {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{client.phone}</span></div>}
            {client.company && <div className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span>{client.company}</span></div>}
            {client.notes && <div className="flex items-start gap-2 text-sm"><StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" /><span className="text-muted-foreground whitespace-pre-wrap">{client.notes}</span></div>}
            {!client.email && !client.phone && !client.company && !client.notes && <p className="text-sm text-muted-foreground">Nessun dettaglio di contatto</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tariffario</CardTitle></CardHeader>
          <CardContent>
            <TariffarioUpload
              clientId={client.id}
              orgId={client.org_id}
              currentUrl={client.tariffario_url}
              currentName={client.tariffario_nome}
              onChange={() => {
                supabase.from("clients").select("*").eq("id", client.id!).single().then(({ data }) => data && setClient(data as Client));
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Servizi</CardTitle></CardHeader>
          <CardContent>
            {servizi.length === 0 ? (
              <div className="py-8 text-center"><p className="text-sm text-muted-foreground">Nessun servizio per questo cliente</p></div>
            ) : (
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead><TableHead>Città</TableHead>
                    <TableHead>Da</TableHead><TableHead>A</TableHead>
                    <TableHead>Stato</TableHead><TableHead className="text-right">Incasso €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servizi.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{format(new Date(s.data_servizio), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{s.citta || "—"}</TableCell>
                      <TableCell>{s.luogo_inizio || "—"}</TableCell>
                      <TableCell>{s.luogo_fine || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColors[s.stato] || ""}>{s.stato}</Badge></TableCell>
                      <TableCell className="text-right">€{Number(s.incasso || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
