import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function MezziStubPage({ title, description }: { title: string; description: string }) {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold font-display">{title}</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Construction className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground max-w-md">{description}</p>
            <p className="text-xs text-muted-foreground">Sezione in preparazione.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export const AllertMezzi = () => (
  <MezziStubPage title="Allert Mezzi" description="Avvisi su scadenze, revisioni, bollo, assicurazione e manutenzioni dei mezzi." />
);
export const BilancioVettura = () => (
  <MezziStubPage title="Bilancio Vettura" description="Riepilogo costi e ricavi per ogni vettura della flotta." />
);
export const ManutenzioneStraordinaria = () => (
  <MezziStubPage title="Manutenzione Straordinaria" description="Registro interventi straordinari e riparazioni dei mezzi." />
);
export const DettagliCarburante = () => (
  <MezziStubPage title="Dettagli Carburante" description="Storico rifornimenti e consumi di carburante per veicolo." />
);
export const DettagliAdBlue = () => (
  <MezziStubPage title="Dettagli AdBlue" description="Storico rifornimenti AdBlue per veicolo." />
);
export const AggiungiAdBlue = () => (
  <MezziStubPage title="Aggiungi AdBlue" description="Registra un nuovo rifornimento di AdBlue." />
);
