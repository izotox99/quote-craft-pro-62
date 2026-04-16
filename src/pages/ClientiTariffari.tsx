import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export default function ClientiTariffari() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Tariffari salvati</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Nessun tariffario salvato</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
