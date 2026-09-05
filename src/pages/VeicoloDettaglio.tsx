import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, Wrench, Hammer, Fuel, Receipt, Package, Car as CarIcon } from "lucide-react";
import { SectionDocumenti } from "@/components/veicoli/SectionDocumenti";
import { SectionManutenzione } from "@/components/veicoli/SectionManutenzione";
import { SectionGasolio } from "@/components/veicoli/SectionGasolio";
import { SectionSpese } from "@/components/veicoli/SectionSpese";
import { SectionMateriali } from "@/components/veicoli/SectionMateriali";

type V = { id: string; targa: string; tipo_macchina: string | null; modello: string | null; marca: string | null };

export default function VeicoloDettaglio() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [v, setV] = useState<V | null>(null);
  const tab = params.get("tab") ?? "documenti";

  useEffect(() => {
    if (!id) return;
    supabase.from("veicoli").select("id, targa, tipo_macchina, modello, marca").eq("id", id).maybeSingle()
      .then(({ data }) => setV(data as V | null));
  }, [id]);

  if (!id) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/veicoli")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <CarIcon className="h-6 w-6 text-primary" />
              {v?.tipo_macchina ?? v?.modello ?? "Veicolo"} — {v?.targa ?? "..."}
            </h1>
            <p className="text-sm text-muted-foreground">Gestione completa del mezzo</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(t) => setParams({ tab: t })}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-6 w-full max-w-4xl">
            <TabsTrigger value="documenti" className="gap-1.5"><FileText className="h-4 w-4" />Documenti</TabsTrigger>
            <TabsTrigger value="man-ord" className="gap-1.5"><Wrench className="h-4 w-4" />M. Ord</TabsTrigger>
            <TabsTrigger value="man-str" className="gap-1.5"><Hammer className="h-4 w-4" />M. Straord</TabsTrigger>
            <TabsTrigger value="gasolio" className="gap-1.5"><Fuel className="h-4 w-4" />Gasolio</TabsTrigger>
            <TabsTrigger value="spese" className="gap-1.5"><Receipt className="h-4 w-4" />Spese</TabsTrigger>
            <TabsTrigger value="materiali" className="gap-1.5"><Package className="h-4 w-4" />Materiali</TabsTrigger>
          </TabsList>

          <TabsContent value="documenti" className="mt-6"><SectionDocumenti veicoloId={id} /></TabsContent>
          <TabsContent value="man-ord" className="mt-6"><SectionManutenzione veicoloId={id} mode="ord" /></TabsContent>
          <TabsContent value="man-str" className="mt-6"><SectionManutenzione veicoloId={id} mode="straord" targa={v?.targa} /></TabsContent>
          <TabsContent value="gasolio" className="mt-6"><SectionGasolio veicoloId={id} /></TabsContent>
          <TabsContent value="spese" className="mt-6"><SectionSpese veicoloId={id} /></TabsContent>
          <TabsContent value="materiali" className="mt-6"><SectionMateriali veicoloId={id} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
