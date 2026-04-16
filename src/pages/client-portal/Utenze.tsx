import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Phone, MapPin, User } from "lucide-react";

export default function Utenze() {
  const { user } = useAuth();
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      setClient(data);
    };
    load();
  }, [user]);

  if (!client) return (
    <ClientPortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </ClientPortalLayout>
  );

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <ClientPortalLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="font-display text-2xl font-bold">I miei dati</h1>

        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-0">
            <InfoRow icon={Building2} label="Società" value={client.company} />
            <InfoRow icon={User} label="Rappresentante" value={[client.nome_rappresentante, client.cognome_rappresentante].filter(Boolean).join(" ")} />
            <InfoRow icon={Mail} label="Email" value={client.email} />
            <InfoRow icon={Phone} label="Telefono" value={client.phone} />
            <InfoRow icon={MapPin} label="Indirizzo" value={[client.sede_legale, client.citta, client.provincia, client.cap].filter(Boolean).join(", ")} />
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
