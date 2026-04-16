import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Fatture() {
  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Fatture</h1>
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Le fatture saranno disponibili a breve
            </p>
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
