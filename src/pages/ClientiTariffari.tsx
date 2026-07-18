import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; name: string; company: string | null; tariffario_url: string; tariffario_nome: string | null };

export default function ClientiTariffari() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("clients")
      .select("id, name, company, tariffario_url, tariffario_nome")
      .not("tariffario_url", "is", null)
      .order("name")
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("tariffari-clienti").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("Impossibile aprire"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Tariffari salvati</h1>
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Nessun tariffario salvato</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/clients/${r.id}`)}>
                      <TableCell className="font-medium">{r.company ?? r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.tariffario_nome ?? "tariffario"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="gap-1 rounded-lg" onClick={() => open(r.tariffario_url)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Apri
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
