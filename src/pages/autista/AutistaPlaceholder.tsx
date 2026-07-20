import { useNavigate, useParams } from "react-router-dom";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench } from "lucide-react";

export default function AutistaPlaceholder({ title }: { title?: string }) {
  const navigate = useNavigate();
  const { section } = useParams();
  const t = title ?? section ?? "Sezione";
  return (
    <AutistaLayout>
      <button onClick={() => navigate("/autista")} className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Home
      </button>
      <Card className="p-8 text-center space-y-3">
        <Wrench className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="font-display font-semibold text-lg capitalize">{t}</div>
        <p className="text-sm text-muted-foreground">Sezione in preparazione. Sarà attivata nella prossima fase.</p>
        <Button variant="outline" onClick={() => navigate("/autista")}>Torna alla Home</Button>
      </Card>
    </AutistaLayout>
  );
}
