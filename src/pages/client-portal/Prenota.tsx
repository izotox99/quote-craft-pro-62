import { useState, useEffect } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CalendarPlus,
  Send,
  Info,
  Paperclip,
  X,
  RotateCcw,
} from "lucide-react";
import { saveServizioAccessori, type AccessorioRow } from "@/components/servizi/AccessoriEditor";
import {
  BookingFormFields,
  emptyBookingForm,
  deriveTipologia,
  type BookingFormState,
} from "@/components/booking/BookingFormFields";
import { TERMINAL_FIUMICINO, TERMINAL_CIAMPINO, STAZIONI_ROMA, detectLuogoSpeciale } from "@/lib/booking-shared";

const ALLEGATO_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx";
const ALLEGATO_MAX_MB = 10;

type Passeggero = { id: string; nome: string; cognome: string | null; telefono: string | null; email: string | null };

export default function Prenota() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passeggeri, setPasseggeri] = useState<Passeggero[]>([]);
  const [ultimoServizio, setUltimoServizio] = useState<any>(null);
  const [activeUtenzaId, setActiveUtenzaId] = useState<string | null>(null);
  const [autoreName, setAutoreName] = useState<string>("");

  const [form, setForm] = useState<BookingFormState>(emptyBookingForm);
  const [accessoriRows, setAccessoriRows] = useState<AccessorioRow[]>([]);
  const [allegato, setAllegato] = useState<File | null>(null);

  const loadPasseggeri = async (cId: string) => {
    const { data } = await supabase
      .from("passeggeri_rubrica")
      .select("id, nome, cognome, telefono, email")
      .eq("client_id", cId)
      .order("nome");
    setPasseggeri((data ?? []) as Passeggero[]);
  };

  const loadUltimoServizio = async (cId: string, uId: string | null) => {
    let query = supabase
      .from("servizi")
      .select("contatto, telefono_contatto, email_contatto")
      .eq("client_id", cId)
      .eq("archiviato", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (uId) query = query.eq("utenza_id", uId);
    const { data } = await query;
    if (data && data.length > 0) setUltimoServizio(data[0]);
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id, org_id, name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      let resolvedClientId: string | null = null;
      let resolvedOrgId: string | null = null;
      let resolvedUtenzaId: string | null = null;
      let resolvedAutore = "";

      if (client) {
        resolvedClientId = client.id;
        resolvedOrgId = client.org_id;
        resolvedAutore = client.name ?? user.email ?? "";
      } else {
        const { data: utenza } = await supabase
          .from("client_utenze")
          .select("id, nome, cognome, parent_client_id, clients:parent_client_id(id, org_id)")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (utenza) {
          resolvedUtenzaId = utenza.id;
          setActiveUtenzaId(utenza.id);
          resolvedClientId = (utenza as any).parent_client_id;
          resolvedOrgId = (utenza as any).clients?.org_id ?? null;
          resolvedAutore = `${utenza.nome ?? ""} ${utenza.cognome ?? ""}`.trim() || (user.email ?? "");
        }
      }

      if (resolvedClientId) setClientId(resolvedClientId);
      if (resolvedOrgId) setOrgId(resolvedOrgId);
      setAutoreName(resolvedAutore);

      if (resolvedClientId) {
        await loadPasseggeri(resolvedClientId);
        await loadUltimoServizio(resolvedClientId, resolvedUtenzaId);
      }
    };
    load();
  }, [user]);

  const duplicaUltimo = () => {
    if (!ultimoServizio) return;
    setForm(prev => ({
      ...prev,
      contatto: ultimoServizio.contatto ?? "",
      telefono_contatto: ultimoServizio.telefono_contatto ?? "",
      email_contatto: ultimoServizio.email_contatto ?? "",
    }));
    toast.success("Nominativi passeggero ripresi dall'ultima prenotazione.");
  };

  const handleAllegato = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > ALLEGATO_MAX_MB * 1024 * 1024) {
      toast.error(`Il file supera ${ALLEGATO_MAX_MB} MB`);
      return;
    }
    setAllegato(file);
  };

  const validateForm = (): boolean => {
    if (!form.citta) { toast.error("Seleziona la città"); return false; }
    if (!form.data_servizio) { toast.error("Seleziona la data"); return false; }
    if (!form.ora_inizio) { toast.error("Seleziona l'ora"); return false; }
    if (!form.contatto.trim()) { toast.error("Inserisci il passeggero"); return false; }
    if (!form.veicolo_tipo) { toast.error("Seleziona il veicolo"); return false; }
    if (!form.transfer_tipo && !form.disposizione_oraria && !form.tour_tipo) {
      toast.error("Seleziona una tipologia (Trasfert, Disposizione o Tour)"); return false;
    }
    if (!form.luogo_inizio.trim()) { toast.error("Inserisci il luogo di inizio"); return false; }
    if (!form.luogo_fine.trim()) { toast.error("Inserisci il luogo di fine"); return false; }

    const inizioSpec = detectLuogoSpeciale(form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio);
    const fineSpec = detectLuogoSpeciale(form.luogo_fine, form.citta, form.luogo_fine_dettaglio);
    const checkTerminal = (spec: any, base: string, det: string, side: string) => {
      if (!spec) return true;
      const ok =
        spec.tipo === "fiumicino" ? TERMINAL_FIUMICINO.includes(det) :
        spec.tipo === "ciampino" ? TERMINAL_CIAMPINO.includes(det) :
        spec.tipo === "stazione" ? STAZIONI_ROMA.includes(base.trim()) :
        spec.tipo === "aeroporto_generico" ? false : true;
      if (!ok) {
        toast.error(
          spec.tipo === "aeroporto_generico" ? `Specifica quale aeroporto (${side})` :
          spec.tipo === "stazione" ? `Specifica quale stazione (${side})` :
          `Specifica il terminal (${side})`
        );
      }
      return ok;
    };
    if (!checkTerminal(inizioSpec, form.luogo_inizio, form.luogo_inizio_dettaglio, "inizio")) return false;
    if (!checkTerminal(fineSpec, form.luogo_fine, form.luogo_fine_dettaglio, "fine")) return false;

    if (!form.tipo_pagamento) { toast.error("Seleziona il tipo di pagamento"); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!clientId || !orgId) return;

    setLoading(true);

    const luogoInizioFinale = form.luogo_inizio_dettaglio
      ? `${form.luogo_inizio} - ${form.luogo_inizio_dettaglio}`
      : form.luogo_inizio;
    const luogoFineFinale = form.luogo_fine_dettaglio
      ? `${form.luogo_fine} - ${form.luogo_fine_dettaglio}`
      : form.luogo_fine;

    const t = deriveTipologia(form);

    const { data: inserted, error } = await supabase.from("servizi").insert({
      data_servizio: form.data_servizio,
      ora_inizio: form.ora_inizio || null,
      tipologia: t.tipologia as any,
      transfer_tipo: t.transfer_tipo,
      tour_tipo: t.tour_tipo,
      disposizione_oraria: t.disposizione_oraria,
      contatto: form.contatto,
      telefono_contatto: form.telefono_contatto || null,
      email_contatto: form.email_contatto || null,
      n_passeggeri: parseInt(form.n_passeggeri) || 1,
      n_bagagli: parseInt(form.n_bagagli) || 0,
      veicolo_tipo: form.veicolo_tipo || null,
      luogo_inizio: luogoInizioFinale || null,
      luogo_fine: luogoFineFinale || null,
      itinerario: form.itinerario || null,
      info_autista: form.info_autista || null,
      centro_costo: form.centro_costo || null,
      citta: form.citta || null,
      note: form.note || null,
      tipo_pagamento: form.tipo_pagamento || null,
      prezzo: form.prezzo ? parseFloat(form.prezzo) : null,
      client_id: clientId,
      org_id: orgId,
      stato: "nuovo" as any,
      utenza_id: activeUtenzaId,
    } as any).select("id").single();

    if (error || !inserted) {
      toast.error("Errore nella prenotazione: " + (error?.message ?? ""));
      setLoading(false);
      return;
    }

    try { await saveServizioAccessori(inserted.id, accessoriRows); } catch (e) { console.error(e); }

    if (allegato) {
      const safeName = allegato.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/${inserted.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("servizi-allegati")
        .upload(path, allegato, { contentType: allegato.type, upsert: false });
      if (upErr) {
        toast.error("Servizio creato ma upload allegato fallito: " + upErr.message);
      } else {
        await supabase.from("servizi")
          .update({ allegato_path: path, allegato_nome: allegato.name } as any)
          .eq("id", inserted.id);
      }
    }

    toast.success("Prenotazione inviata con successo!");

    await loadUltimoServizio(clientId, activeUtenzaId);

    setForm(emptyBookingForm);
    setAccessoriRows([]);
    setAllegato(null);
    setLoading(false);
  };

  return (
    <ClientPortalLayout>
      <div className="max-w-3xl mx-auto space-y-5 pb-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display font-bold flex items-center gap-2 text-lg">
            <CalendarPlus className="h-6 w-6 text-primary" />
            Nuovo Servizio
          </h1>
        </div>

        {ultimoServizio?.contatto && (
          <Card className="rounded-xl border-primary/30 bg-gradient-to-br from-primary/5 to-accent/30 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Usa l'ultimo passeggero</p>
                <p className="text-xs text-muted-foreground truncate">
                  {ultimoServizio.contatto}
                  {ultimoServizio.telefono_contatto ? ` · ${ultimoServizio.telefono_contatto}` : ""}
                  {ultimoServizio.email_contatto ? ` · ${ultimoServizio.email_contatto}` : ""}
                </p>
              </div>
              <Button type="button" size="sm" onClick={duplicaUltimo} className="rounded-lg shrink-0">
                Riprendi
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p>Compila tutte le sezioni della prenotazione. Dalla <strong>Lista Servizi</strong> potrai modificarla in seguito.</p>
                <p className="text-xs text-destructive font-medium">Modifica e annullamento: fino a 12 ore prima del servizio.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <BookingFormFields
              form={form}
              setForm={setForm}
              mode="create"
              orgId={orgId}
              clientId={clientId}
              passeggeri={passeggeri}
              onPasseggeroCreated={p => setPasseggeri(prev => [...prev, p])}
              accessoriRows={accessoriRows}
              setAccessoriRows={setAccessoriRows}
              autoreName={autoreName}
            />
          </CardContent>
        </Card>

        {/* Allegato per l'autista (invariato) */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" /> Allegato per l'autista
            </h2>
            <p className="text-xs text-muted-foreground">
              Opzionale. Immagini, PDF, Word o Excel — max {ALLEGATO_MAX_MB} MB.
            </p>
            {allegato ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <div className="min-w-0 text-sm truncate">
                  <Paperclip className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  {allegato.name}
                </div>
                <button type="button" onClick={() => setAllegato(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border/60 py-6 cursor-pointer hover:border-primary/60 transition-colors">
                <Paperclip className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Clicca per caricare un file</span>
                <input type="file" accept={ALLEGATO_ACCEPT} className="hidden" onChange={handleAllegato} />
              </label>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg gap-2 min-w-[220px]"
          >
            <Send className="h-4 w-4" />
            {loading ? "Invio in corso…" : "Conferma prenotazione"}
          </Button>
        </div>
      </div>
    </ClientPortalLayout>
  );
}
