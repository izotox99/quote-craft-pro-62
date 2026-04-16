import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StickyNote } from "lucide-react";

export default function ClientiNote() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Note cliente</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <StickyNote className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Nessuna nota disponibile</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
