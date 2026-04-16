import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Tariffario() {
  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Tariffario</h1>
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Il tariffario sarà disponibile a breve
            </p>
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
