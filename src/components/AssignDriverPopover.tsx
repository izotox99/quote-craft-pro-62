import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Search, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type DriverOption = {
  id: string;
  nome: string;
  cognome?: string;
  kind: "interno" | "esterno";
};

export type VeicoloOption = {
  id: string;
  targa: string;
  tipo_macchina: string | null;
  marca: string | null;
  modello: string | null;
};

type Props = {
  trigger: React.ReactNode;
  currentInternoId?: string | null;
  currentEsternoId?: string | null;
  currentLabel?: string | null;
  onAssign: (driver: DriverOption | null) => Promise<void> | void;
  align?: "start" | "center" | "end";
  /** Tipo di veicolo richiesto dal cliente (servizi.veicolo_tipo) */
  requestedVeicoloTipo?: string | null;
  currentVeicoloId?: string | null;
  /** Se presente, mostra la sezione di assegnazione del veicolo specifico */
  onAssignVeicolo?: (veicolo: VeicoloOption | null) => Promise<void> | void;
  initialTab?: "autista" | "veicolo";
};

const normalize = (v?: string | null) => (v ?? "").trim().toLowerCase();

export function AssignDriverPopover({
  trigger,
  currentInternoId,
  currentEsternoId,
  currentLabel,
  onAssign,
  align = "start",
  requestedVeicoloTipo,
  currentVeicoloId,
  onAssignVeicolo,
  initialTab = "autista",
}: Props) {
  const [open, setOpen] = useState(false);
  const [interni, setInterni] = useState<DriverOption[]>([]);
  const [esterni, setEsterni] = useState<DriverOption[]>([]);
  const [veicoli, setVeicoli] = useState<VeicoloOption[]>([]);
  const [tab, setTab] = useState<"autista" | "veicolo">(initialTab);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);


  useEffect(() => {
    if (!open || (interni.length + esterni.length) > 0) return;
    setLoading(true);
    Promise.all([
      supabase.from("autisti").select("id, nome, cognome").eq("attivo", true).order("cognome"),
      supabase.from("autisti_esterni").select("id, nome").eq("attivo", true).order("nome"),
    ]).then(([i, e]) => {
      setInterni(((i.data ?? []) as any[]).map(x => ({ id: x.id, nome: x.nome, cognome: x.cognome, kind: "interno" as const })));
      setEsterni(((e.data ?? []) as any[]).map(x => ({ id: x.id, nome: x.nome, kind: "esterno" as const })));
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open || !onAssignVeicolo || veicoli.length > 0) return;
    supabase
      .from("veicoli")
      .select("id, targa, tipo_macchina, marca, modello")
      .eq("attivo", true)
      .order("targa")
      .then(({ data }) => setVeicoli((data ?? []) as any[]));
  }, [open, onAssignVeicolo]);

  const [veicoliMatch, veicoliAltri] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s
      ? veicoli
      : veicoli.filter(v => `${v.targa} ${v.tipo_macchina ?? ""} ${v.marca ?? ""} ${v.modello ?? ""}`.toLowerCase().includes(s));
    const tipo = normalize(requestedVeicoloTipo);
    if (!tipo) return [[], list] as [VeicoloOption[], VeicoloOption[]];
    const match = list.filter(v =>
      normalize(v.tipo_macchina) === tipo ||
      normalize(v.tipo_macchina).includes(tipo) ||
      tipo.includes(normalize(v.tipo_macchina)) && !!v.tipo_macchina ||
      normalize(v.modello).includes(tipo) ||
      normalize(v.marca).includes(tipo)
    );
    const ids = new Set(match.map(v => v.id));
    return [match, list.filter(v => !ids.has(v.id))] as [VeicoloOption[], VeicoloOption[]];
  }, [veicoli, q, requestedVeicoloTipo]);

  const handlePickVeicolo = async (v: VeicoloOption | null) => {
    if (!onAssignVeicolo) return;
    setSaving(true);
    await onAssignVeicolo(v);
    setSaving(false);
    setOpen(false);
    setQ("");
    setJustAssigned(null);
    setTab(initialTab);
  };


  const filteredInt = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return interni;
    return interni.filter(d => `${d.nome} ${d.cognome ?? ""}`.toLowerCase().includes(s));
  }, [interni, q]);

  const filteredExt = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return esterni;
    return esterni.filter(d => d.nome.toLowerCase().includes(s));
  }, [esterni, q]);

  const [justAssigned, setJustAssigned] = useState<string | null>(null);

  const handlePick = async (d: DriverOption) => {
    setSaving(true);
    await onAssign(d);
    setSaving(false);
    setQ("");
    // Dopo l'autista proponiamo sempre il mezzo (facoltativo)
    if (onAssignVeicolo) {
      setJustAssigned(`${d.nome}${d.cognome ? ` ${d.cognome}` : ""}`);
      setTab("veicolo");
      return;
    }
    setOpen(false);
  };

  const handleClear = async () => {
    setSaving(true);
    await onAssign(null);
    setSaving(false);
    setOpen(false);
    setQ("");
  };

  const closeAll = () => {
    setOpen(false);
    setQ("");
    setJustAssigned(null);
    setTab(initialTab);
  };

  const showVeicoli = !!onAssignVeicolo;
  const isVeicoloTab = showVeicoli && tab === "veicolo";


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-0" onClick={(e) => e.stopPropagation()}>
        {showVeicoli && (
          <div className="grid grid-cols-2 border-b text-xs">
            {(["autista", "veicolo"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setQ(""); }}
                className={cn(
                  "py-1.5 font-medium capitalize transition-colors",
                  tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="p-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={isVeicoloTab ? "Cerca targa o modello…" : "Cerca autista…"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {isVeicoloTab ? (
            <>
              {requestedVeicoloTipo && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground">
                  Richiesto dal cliente: <span className="font-semibold text-foreground">{requestedVeicoloTipo}</span>
                </div>
              )}
              {veicoliMatch.length > 0 && (
                <Section title="Corrispondenti al tipo richiesto" count={veicoliMatch.length}>
                  {veicoliMatch.map(v => (
                    <VeicoloRow key={v.id} v={v} highlight active={v.id === currentVeicoloId} disabled={saving} onClick={() => handlePickVeicolo(v)} />
                  ))}
                </Section>
              )}
              <Section title={veicoliMatch.length > 0 ? "Altri veicoli" : "Veicoli"} count={veicoliAltri.length}>
                {veicoliAltri.map(v => (
                  <VeicoloRow key={v.id} v={v} active={v.id === currentVeicoloId} disabled={saving} onClick={() => handlePickVeicolo(v)} />
                ))}
                {veicoliAltri.length === 0 && <Empty />}
              </Section>
            </>
          ) : loading ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Caricamento…</div>
          ) : (
            <>
              <Section title="Interni" count={filteredInt.length}>
                {filteredInt.map(d => {
                  const active = d.id === currentInternoId;
                  return (
                    <Row key={d.id} active={active} onClick={() => handlePick(d)} disabled={saving}>
                      <span className="truncate">{d.nome} {d.cognome}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </Row>
                  );
                })}
                {filteredInt.length === 0 && <Empty />}
              </Section>
              <Section title="Esterni" count={filteredExt.length}>
                {filteredExt.map(d => {
                  const active = d.id === currentEsternoId;
                  return (
                    <Row key={d.id} active={active} onClick={() => handlePick(d)} disabled={saving}>
                      <span className="truncate flex items-center gap-1.5">
                        {d.nome}
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">EXT</Badge>
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </Row>
                  );
                })}
                {filteredExt.length === 0 && <Empty />}
              </Section>
            </>
          )}
        </div>
        {isVeicoloTab
          ? currentVeicoloId && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-start text-destructive hover:text-destructive"
                  onClick={() => handlePickVeicolo(null)}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Rimuovi veicolo
                </Button>
              </div>
            )
          : (currentInternoId || currentEsternoId) && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-start text-destructive hover:text-destructive"
                  onClick={handleClear}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Rimuovi assegnazione
                </Button>
              </div>
            )}
      </PopoverContent>
    </Popover>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ active, onClick, disabled, children }: { active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-accent transition-colors disabled:opacity-50",
        active && "bg-primary/10 font-medium"
      )}
    >
      {children}
    </button>
  );
}

function VeicoloRow({
  v, active, highlight, disabled, onClick,
}: { v: VeicoloOption; active?: boolean; highlight?: boolean; disabled?: boolean; onClick: () => void }) {
  const desc = [v.marca, v.modello].filter(Boolean).join(" ") || v.tipo_macchina || "";
  return (
    <Row active={active} onClick={onClick} disabled={disabled}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="font-mono text-[10px] border rounded px-1 py-0.5 bg-yellow-50 border-slate-400 text-slate-900 shrink-0">{v.targa}</span>
        <span className="truncate">{desc}</span>
        {highlight && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary text-primary shrink-0">TIPO OK</Badge>}
      </span>
      {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </Row>
  );
}

function Empty() {
  return <div className="px-3 py-2 text-[11px] text-muted-foreground italic">Nessun risultato</div>;
}

// Bulk assign bar
type BulkProps = {
  count: number;
  onAssign: (driver: DriverOption) => Promise<void> | void;
  onClear: () => void;
};

export function BulkAssignBar({ count, onAssign, onClear }: BulkProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground shadow-lg animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary-foreground/20 text-xs font-bold">
          {count}
        </span>
        <span>servizi selezionati</span>
      </div>
      <div className="flex items-center gap-2">
        <AssignDriverPopover
          align="end"
          onAssign={async (d) => { if (d) await onAssign(d); }}
          trigger={
            <Button size="sm" variant="secondary" className="h-8 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Assegna autista
            </Button>
          }
        />
        <Button size="sm" variant="ghost" onClick={onClear} className="h-8 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
