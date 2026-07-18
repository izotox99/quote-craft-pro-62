import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, CheckCircle2 } from "lucide-react";

export type AgendaEvento = {
  id: string;
  org_id: string;
  created_by: string;
  titolo: string;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string | null;
  tutto_il_giorno: boolean;
  categoria: "appuntamento" | "scadenza" | "nota" | "altro";
  visibilita: "personale" | "organizzazione";
  completato: boolean;
  servizio_id: string | null;
  promemoria_minuti: number[];
};

export const CATEGORIA_COLOR: Record<AgendaEvento["categoria"], string> = {
  appuntamento: "#3b82f6",
  scadenza: "#ef4444",
  nota: "#10b981",
  altro: "#a855f7",
};

const PROMEMORIA_OPZIONI: { minuti: number; label: string }[] = [
  { minuti: 0, label: "All'ora dell'evento" },
  { minuti: 15, label: "15 minuti prima" },
  { minuti: 60, label: "1 ora prima" },
  { minuti: 1440, label: "1 giorno prima" },
  { minuti: 10080, label: "1 settimana prima" },
];

function toLocalInput(iso: string | null | undefined, allDay: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (allDay) return date;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string, allDay: boolean): string | null {
  if (!v) return null;
  const d = allDay ? new Date(v + "T00:00:00") : new Date(v);
  return d.toISOString();
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento?: AgendaEvento | null;
  defaultStart?: Date | null;
  onSaved: () => void;
};

export function EventoDialog({ open, onOpenChange, evento, defaultStart, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AgendaEvento>>({});

  useEffect(() => {
    if (!open) return;
    if (evento) {
      setForm({ ...evento });
    } else {
      const start = defaultStart ?? new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      setForm({
        titolo: "",
        descrizione: "",
        data_inizio: start.toISOString(),
        data_fine: end.toISOString(),
        tutto_il_giorno: false,
        categoria: "appuntamento",
        visibilita: "personale",
        completato: false,
        promemoria_minuti: [60],
      });
    }
  }, [open, evento, defaultStart]);

  const isNew = !evento;
  const allDay = !!form.tutto_il_giorno;

  const togglePromemoria = (m: number) => {
    const cur = form.promemoria_minuti ?? [];
    setForm({
      ...form,
      promemoria_minuti: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m].sort((a, b) => a - b),
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.titolo?.trim()) {
      toast.error("Inserisci un titolo");
      return;
    }
    if (!form.data_inizio) {
      toast.error("Inserisci una data di inizio");
      return;
    }
    setSaving(true);
    const payload = {
      titolo: form.titolo!.trim(),
      descrizione: form.descrizione ?? null,
      data_inizio: form.data_inizio!,
      data_fine: form.data_fine ?? null,
      tutto_il_giorno: !!form.tutto_il_giorno,
      categoria: form.categoria ?? "appuntamento",
      visibilita: form.visibilita ?? "personale",
      completato: !!form.completato,
      promemoria_minuti: form.promemoria_minuti ?? [],
    };

    let error;
    if (isNew) {
      const { error: e } = await supabase.from("agenda_eventi").insert({
        ...payload,
        org_id: "00000000-0000-0000-0000-000000000000",
        created_by: user.id,
      });
      error = e;
    } else {
      const { error: e } = await supabase
        .from("agenda_eventi")
        .update(payload)
        .eq("id", evento!.id);
      error = e;
    }
    setSaving(false);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    toast.success(isNew ? "Evento creato" : "Evento aggiornato");
    onSaved();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!evento) return;
    if (!confirm("Eliminare questo evento?")) return;
    const { error } = await supabase.from("agenda_eventi").delete().eq("id", evento.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento eliminato");
    onSaved();
    onOpenChange(false);
  };

  const handleToggleComplete = async () => {
    if (!evento) return;
    const { error } = await supabase
      .from("agenda_eventi")
      .update({ completato: !evento.completato })
      .eq("id", evento.id);
    if (error) { toast.error(error.message); return; }
    toast.success(evento.completato ? "Segnato come non completato" : "Segnato come completato");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo evento" : "Modifica evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Titolo *</Label>
            <Input
              value={form.titolo ?? ""}
              onChange={(e) => setForm({ ...form, titolo: e.target.value })}
              placeholder="Titolo evento"
            />
          </div>

          <div>
            <Label>Descrizione</Label>
            <Textarea
              value={form.descrizione ?? ""}
              onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="allday"
              checked={allDay}
              onCheckedChange={(v) => setForm({ ...form, tutto_il_giorno: !!v })}
            />
            <Label htmlFor="allday" className="cursor-pointer">Tutto il giorno</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inizio *</Label>
              <Input
                type={allDay ? "date" : "datetime-local"}
                value={toLocalInput(form.data_inizio, allDay)}
                onChange={(e) => setForm({ ...form, data_inizio: fromLocalInput(e.target.value, allDay) ?? undefined })}
              />
            </div>
            <div>
              <Label>Fine</Label>
              <Input
                type={allDay ? "date" : "datetime-local"}
                value={toLocalInput(form.data_fine, allDay)}
                onChange={(e) => setForm({ ...form, data_fine: fromLocalInput(e.target.value, allDay) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.categoria ?? "appuntamento"}
                onValueChange={(v) => setForm({ ...form, categoria: v as AgendaEvento["categoria"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="appuntamento">📅 Appuntamento</SelectItem>
                  <SelectItem value="scadenza">⏰ Scadenza</SelectItem>
                  <SelectItem value="nota">📝 Nota</SelectItem>
                  <SelectItem value="altro">📌 Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibilità</Label>
              <Select
                value={form.visibilita ?? "personale"}
                onValueChange={(v) => setForm({ ...form, visibilita: v as AgendaEvento["visibilita"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personale">Solo io</SelectItem>
                  <SelectItem value="organizzazione">Tutta l'azienda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Promemoria</Label>
            <div className="mt-2 space-y-1.5">
              {PROMEMORIA_OPZIONI.map((p) => (
                <div key={p.minuti} className="flex items-center gap-2">
                  <Checkbox
                    id={`prom-${p.minuti}`}
                    checked={(form.promemoria_minuti ?? []).includes(p.minuti)}
                    onCheckedChange={() => togglePromemoria(p.minuti)}
                  />
                  <Label htmlFor={`prom-${p.minuti}`} className="cursor-pointer text-sm font-normal">
                    {p.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!isNew && (
            <>
              <Button variant="outline" onClick={handleToggleComplete} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {evento?.completato ? "Ripristina" : "Completa"}
              </Button>
              <Button variant="destructive" onClick={handleDelete} className="gap-2">
                <Trash2 className="h-4 w-4" /> Elimina
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
