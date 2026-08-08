import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Luggage, Tag, Wallet, ArrowRight, Package } from "lucide-react";
import { romeToday, romeLabel } from "@/lib/romeDate";

type Servizio = any;

function dateForKey(key: string): { iso: string; label: string } {
  const offset = key === "domani" ? 1 : key === "dopodomani" ? 2 : 0;
  const iso = romeToday(offset);
  return { iso, label: romeLabel(iso) };
}

function timeLeft(dataISO: string, ora: string | null): string {
  if (!ora) return "";
  const [h, m] = ora.split(":").map(Number);
  const target = new Date(dataISO);
  target.setHours(h || 0, m || 0, 0, 0);
  const diff = target.getTime() - Date.now();
  if (diff < 0) return "in ritardo";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `tra ${mins} minuti`;
  const hs = Math.round(mins / 60);
  if (hs < 24) return `tra ${hs} ore`;
  const gg = Math.round(hs / 24);
  return `tra ${gg} giorni`;
}

export default function AutistaServizi() {
  const { giorno = "oggi" } = useParams<{ giorno: string }>();
  const navigate = useNavigate();
  const { iso, label } = useMemo(() => dateForKey(giorno), [giorno]);
  const [items, setItems] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("servizi_autista_view" as any)
        .select("*")
        .eq("data_servizio", iso)
        .in("stato", ["confermato", "in_corso", "completato"])
        .order("ora_inizio", { ascending: true });
      setItems((data as any[]) ?? []);
      setLoading(false);
    })();
  }, [iso]);

  const daFare = items.filter((s) => s.stato_autista !== "concluso");
  const conclusi = items.filter((s) => s.stato_autista === "concluso");

  return (
    <AutistaLayout>
      <div className="space-y-4">
        <div>
          <h1 className="font-display font-semibold text-lg capitalize">Servizi {giorno}</h1>
          <p className="text-xs text-muted-foreground capitalize">{label}</p>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Caricamento…</div>
        ) : items.length === 0 ? (
          <Card className="p-6 text-center">
            <div className="text-4xl mb-2">🌤️</div>
            <div className="font-semibold">Nessun servizio {giorno}</div>
            <div className="text-xs text-muted-foreground mt-1">Goditi un po' di riposo.</div>
          </Card>
        ) : (
          <>
            {daFare.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-bold uppercase text-muted-foreground">Da effettuare · {daFare.length}</h2>
                {daFare.map((s) => (
                  <CardServizio key={s.id} s={s} onOpen={() => navigate(`/autista/servizi/dett/${s.id}`)} />
                ))}
              </section>
            )}
            {conclusi.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-bold uppercase text-muted-foreground">Conclusi · {conclusi.length}</h2>
                {conclusi.map((s) => (
                  <CardConcluso key={s.id} s={s} onOpen={() => navigate(`/autista/servizi/dett/${s.id}`)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </AutistaLayout>
  );
}

function CardServizio({ s, onOpen }: { s: any; onOpen: () => void }) {
  const [veicolo, setVeicolo] = useState<{ marca?: string; modello?: string; targa?: string; foto_url?: string } | null>(null);
  useEffect(() => {
    if (!s.veicolo_id) { setVeicolo(null); return; }
    supabase.from("veicoli").select("marca,modello,targa,foto_url").eq("id", s.veicolo_id).maybeSingle()
      .then(({ data }) => setVeicolo(data as any));
  }, [s.veicolo_id]);

  return (
    <Card className="p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-4xl font-bold tabular-nums leading-none">{s.ora_inizio ?? "--:--"}</div>
          <div className="text-sm text-muted-foreground mt-1">{timeLeft(s.data_servizio, s.ora_inizio)}</div>
        </div>
        {veicolo ? (
          <div className="text-right">
            {veicolo.foto_url && <img src={veicolo.foto_url} className="h-12 w-20 object-cover rounded ml-auto" alt="" />}
            <div className="text-sm font-medium mt-1">{[veicolo.marca, veicolo.modello].filter(Boolean).join(" ")}</div>
            {veicolo.targa && (
              <div className="inline-block text-xs font-mono border rounded px-1.5 py-0.5 bg-yellow-50 border-slate-400">{veicolo.targa}</div>
            )}
          </div>
        ) : (
          <div className="text-right text-sm max-w-[150px]">
            {s.veicolo_tipo ? (
              <>
                <div className="font-medium">{s.veicolo_tipo}</div>
                <div className="text-amber-600 text-xs">Veicolo da assegnare</div>
              </>
            ) : (
              <span className="text-muted-foreground italic">Veicolo non assegnato</span>
            )}
          </div>
        )}
      </div>

      <div>
        {s.societa_cliente && (
          <div className="text-xs uppercase font-bold tracking-wide text-muted-foreground">{s.societa_cliente}</div>
        )}
        <div className="font-semibold text-lg leading-snug">{s.contatto || "Cliente"}</div>
        {s.telefono_contatto && <div className="text-sm text-muted-foreground">{s.telefono_contatto}</div>}
      </div>

      <div className="space-y-1 text-base">
        <div className="flex items-start gap-2">
          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span>{s.luogo_inizio || "—"}</span>
        </div>
        {s.itinerario && (
          <div className="pl-4 text-sm text-muted-foreground italic">{s.itinerario}</div>
        )}
        <div className="flex items-start gap-2">
          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" />
          <span>{s.luogo_fine || "—"}</span>
        </div>
      </div>

      <div className="bg-muted/60 rounded-md py-2 px-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-4 w-4" />{s.n_passeggeri ?? 0}</span>
        <span className="flex items-center gap-1"><Luggage className="h-4 w-4" />{s.n_bagagli ?? 0}</span>
        <span className="flex items-center gap-1"><Tag className="h-4 w-4" />{s.tipologia ?? "—"}</span>
        {s.tipo_pagamento && <span className="flex items-center gap-1"><Wallet className="h-4 w-4" />{s.tipo_pagamento}</span>}
      </div>

      {(s.accessori_dettaglio || s.accessori) && (
        <div className="flex items-start gap-2 text-sm">
          <Package className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium">{s.accessori_dettaglio || s.accessori}</span>
        </div>
      )}

      {s.info_autista && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-md p-3 text-sm">
          <div className="font-bold uppercase text-xs text-yellow-800 mb-1">Note per l'autista</div>
          <div className="text-yellow-900 whitespace-pre-wrap">{s.info_autista}</div>
        </div>
      )}

      <Button onClick={onOpen} className="w-full text-base" size="lg">
        Gestisci servizio <ArrowRight className="h-5 w-5 ml-1" />
      </Button>
    </Card>
  );
}

function CardConcluso({ s, onOpen }: { s: any; onOpen: () => void }) {
  return (
    <Card className="p-3 flex items-center justify-between gap-3 opacity-80">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{s.ora_inizio} · {s.contatto || "Cliente"}</div>
        <div className="text-xs text-muted-foreground truncate">
          {s.luogo_inizio} → {s.luogo_fine}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onOpen}>Dettagli</Button>
    </Card>
  );
}
