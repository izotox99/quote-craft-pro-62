import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SectionManutenzione } from "@/components/veicoli/SectionManutenzione";
import { Hammer } from "lucide-react";

type Veicolo = { id: string; targa: string; marca: string | null; modello: string | null; tipo_macchina: string | null };

const etichetta = (v: Veicolo) =>
  `${v.tipo_macchina || [v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - ${v.targa}`;

export default function ManutenzioneStraordPage() {
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [veicoloId, setVeicoloId] = useState<string>("");

  useEffect(() => {
    supabase
      .from("veicoli")
      .select("id, targa, marca, modello, tipo_macchina")
      .eq("attivo", true)
      .order("targa")
      .then(({ data }) => setVeicoli((data ?? []) as Veicolo[]));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Hammer className="h-6 w-6 text-primary" /> Manutenzione straordinaria
          </h1>
          <p className="text-sm text-muted-foreground">Registra un intervento straordinario su un mezzo della flotta.</p>
        </div>

        <Card>
          <CardContent className="pt-6 max-w-md space-y-1.5">
            <Label>Mezzo *</Label>
            <Select value={veicoloId} onValueChange={setVeicoloId}>
              <SelectTrigger><SelectValue placeholder="Seleziona il mezzo" /></SelectTrigger>
              <SelectContent>
                {veicoli.map((v) => <SelectItem key={v.id} value={v.id}>{etichetta(v)}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {veicoloId ? (
          <SectionManutenzione key={veicoloId} veicoloId={veicoloId} mode="straord" targa={veicoli.find((v) => v.id === veicoloId)?.targa} />
        ) : (
          <p className="text-sm text-muted-foreground">Seleziona un mezzo per vedere e registrare gli interventi straordinari.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
