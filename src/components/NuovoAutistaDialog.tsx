import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type TipoAutista = "interno" | "esterno";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Tipo iniziale (può essere cambiato dall'utente nel dialog) */
  defaultTipo?: TipoAutista;
  /** Se passato, il dialog è in modalità modifica */
  editing?: { tipo: TipoAutista; id: string; data: any } | null;
  onSaved: (tipo: TipoAutista) => void;
};

const emptyCommon = {
  nome: "",
  codice_fiscale: "",
  cellulare: "",
  patente: "",
  email: "",
  calcola_riposi: "Si",
};


const emptyInterno = {
  mansione: "",
  numero_ore_ord: "",
  prezzo_ora_ord: "",
  prezzo_ora_straord: "",
  trasferta: "",
  trasferta_2: "",
  buono_pasto: "",
  assicurazione: "",
  percentuale_notturno: "",
};

const emptyEsterno = {
  tipo_macchina: "",
  targa: "",
  percentuale_network: "",
  percentuale_last_minute: "",
  numero_compto: "",
  iban: "",
  banca: "",
  km_voucher: "",
  modello_veicolo: "",
  lingua: "",
  level: "",
};

export function NuovoAutistaDialog({
  open, onOpenChange, defaultTipo = "interno", editing, onSaved,
}: Props) {
  const [tipo, setTipo] = useState<TipoAutista>(defaultTipo);
  const [common, setCommon] = useState(emptyCommon);
  const [interno, setInterno] = useState(emptyInterno);
  const [esterno, setEsterno] = useState(emptyEsterno);
  const [tipiMacchina, setTipiMacchina] = useState<string[]>([]);
  const [foglio, setFoglio] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Carica tipi macchina dai veicoli
    supabase.from("veicoli").select("tipo_macchina").then(({ data }) => {
      const set = new Set<string>();
      (data ?? []).forEach((v: any) => v.tipo_macchina && set.add(v.tipo_macchina));
      setTipiMacchina([...set].sort());
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo);
      const d = editing.data;
      setCommon({
        nome: editing.tipo === "interno"
          ? `${d.cognome ?? ""}${d.nome ? " " + d.nome : ""}`.trim()
          : (d.nome ?? ""),
        codice_fiscale: d.codice_fiscale ?? "",
        cellulare: d.cellulare ?? d.telefono ?? "",
        patente: d.patente ?? "",
        email: d.email ?? "",

        calcola_riposi: d.calcola_riposi === false ? "No" : "Si",
      });
      if (editing.tipo === "interno") {
        setInterno({
          mansione: d.mansione ?? "",
          numero_ore_ord: d.numero_ore_ord?.toString() ?? "",
          prezzo_ora_ord: d.prezzo_ora_ord?.toString() ?? "",
          prezzo_ora_straord: d.prezzo_ora_straord?.toString() ?? "",
          trasferta: d.trasferta?.toString() ?? "",
          trasferta_2: d.trasferta_2?.toString() ?? "",
          buono_pasto: d.buono_pasto?.toString() ?? "",
          assicurazione: d.assicurazione?.toString() ?? "",
          percentuale_notturno: d.percentuale_notturno?.toString() ?? "",
        });
      } else {
        setEsterno({
          tipo_macchina: d.tipo_macchina ?? "",
          targa: d.targa ?? "",
          percentuale_network: d.percentuale_network?.toString() ?? "",
          percentuale_last_minute: d.percentuale_last_minute?.toString() ?? "",
          numero_compto: d.numero_compto ?? "",
          iban: d.iban ?? "",
          banca: d.banca ?? "",
          km_voucher: d.km_voucher?.toString() ?? "",
          modello_veicolo: d.modello_veicolo ?? "",
          lingua: d.lingua ?? "",
          level: d.level ?? "",
        });
      }
    } else {
      setTipo(defaultTipo);
      setCommon(emptyCommon);
      setInterno(emptyInterno);
      setEsterno(emptyEsterno);
      setFoglio(null);
    }
  }, [open, editing, defaultTipo]);

  const splitNome = (full: string) => {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { cognome: parts[0], nome: "" };
    return { cognome: parts[0], nome: parts.slice(1).join(" ") };
  };

  const handleSave = async () => {
    if (!common.nome.trim()) return toast.error("Nome obbligatorio");
    setSaving(true);
    try {
      if (tipo === "interno") {
        const { cognome, nome } = splitNome(common.nome);
        const payload: any = {
          cognome: cognome || common.nome,
          nome: nome || "",
          mansione: interno.mansione || null,
          codice_fiscale: common.codice_fiscale || null,
          patente: common.patente || null,
          cellulare: common.cellulare || null,
          telefono: common.cellulare || null,
          email: common.email || null,
          calcola_riposi: common.calcola_riposi === "Si",

          numero_ore_ord: interno.numero_ore_ord ? Number(interno.numero_ore_ord) : null,
          prezzo_ora_ord: interno.prezzo_ora_ord ? Number(interno.prezzo_ora_ord) : 0,
          prezzo_ora_straord: interno.prezzo_ora_straord ? Number(interno.prezzo_ora_straord) : 0,
          trasferta: interno.trasferta ? Number(interno.trasferta) : null,
          trasferta_2: interno.trasferta_2 ? Number(interno.trasferta_2) : null,
          buono_pasto: interno.buono_pasto ? Number(interno.buono_pasto) : null,
          assicurazione: interno.assicurazione ? Number(interno.assicurazione) : null,
          percentuale_notturno: interno.percentuale_notturno ? Number(interno.percentuale_notturno) : null,
        };
        const { error } = editing
          ? await supabase.from("autisti").update(payload).eq("id", editing.id)
          : await supabase.from("autisti").insert(payload);
        if (error) throw error;
      } else {
        const payload: any = {
          nome: common.nome,
          codice_fiscale: common.codice_fiscale || null,
          patente: common.patente || null,
          cellulare: common.cellulare || null,
          email: common.email || null,
          
          calcola_riposi: common.calcola_riposi === "Si",
          tipo_macchina: esterno.tipo_macchina || null,
          targa: esterno.targa || null,
          percentuale_network: esterno.percentuale_network ? Number(esterno.percentuale_network) : null,
          percentuale_last_minute: esterno.percentuale_last_minute ? Number(esterno.percentuale_last_minute) : null,
          numero_compto: esterno.numero_compto || null,
          iban: esterno.iban || null,
          banca: esterno.banca || null,
          km_voucher: esterno.km_voucher ? Number(esterno.km_voucher) : null,
          modello_veicolo: esterno.modello_veicolo || null,
          lingua: esterno.lingua || null,
          level: esterno.level || null,
        };

        let id = editing?.id;
        if (editing) {
          const { error } = await supabase.from("autisti_esterni").update(payload).eq("id", editing.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("autisti_esterni").insert(payload).select("id").single();
          if (error) throw error;
          id = data.id;
        }

        // Upload foglio (tariffario) se presente
        if (foglio && id) {
          const ext = foglio.name.split(".").pop() ?? "bin";
          const path = `${id}/tariffario-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("tariffari-autisti")
            .upload(path, foglio, { upsert: true });
          if (upErr) throw upErr;
          await supabase.from("autisti_esterni")
            .update({ tariffario_url: path, tariffario_nome: foglio.name })
            .eq("id", id);
        }
      }

      toast.success(editing ? "Autista aggiornato" : "Autista inserito");
      onOpenChange(false);
      onSaved(tipo);
    } catch (err: any) {
      toast.error(err.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const lockTipo = !!editing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display">
            {editing ? "Modifica Autista" : "Nuovo Autista"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Colonna sinistra: dati comuni */}
          <div className="space-y-3">
            <Field label="Tipo Autista">
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as TipoAutista)}
                disabled={lockTipo}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="esterno">Esterno</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Nome">
              <Input
                value={common.nome}
                onChange={(e) => setCommon({ ...common, nome: e.target.value })}
                placeholder={tipo === "interno" ? "Cognome Nome" : "Cognome Nome - Sigla"}
              />
            </Field>

            <Field label="Codice Fiscale">
              <Input
                value={common.codice_fiscale}
                onChange={(e) => setCommon({ ...common, codice_fiscale: e.target.value.toUpperCase() })}
              />
            </Field>

            <Field label="Cellulare">
              <Input
                value={common.cellulare}
                onChange={(e) => setCommon({ ...common, cellulare: e.target.value })}
              />
            </Field>

            <Field label="N Patente">
              <Input
                value={common.patente}
                onChange={(e) => setCommon({ ...common, patente: e.target.value })}
              />
            </Field>

            <Field label="E-mail">
              <Input
                type="email"
                value={common.email}
                onChange={(e) => setCommon({ ...common, email: e.target.value })}
              />
            </Field>



            <Field label="Calcola riposi">
              <Select
                value={common.calcola_riposi}
                onValueChange={(v) => setCommon({ ...common, calcola_riposi: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Si">Si</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Colonna destra: campi specifici */}
          <div className="space-y-3">
            {tipo === "interno" ? (
              <>
                <Field label="Mansione">
                  <Input value={interno.mansione} onChange={(e) => setInterno({ ...interno, mansione: e.target.value })} />
                </Field>
                <Field label="Numero Ore Ordinarie">
                  <Input inputMode="decimal" value={interno.numero_ore_ord} onChange={(e) => setInterno({ ...interno, numero_ore_ord: e.target.value })} />
                </Field>
                <Field label="Prezzo Ore Ordinarie">
                  <Input inputMode="decimal" value={interno.prezzo_ora_ord} onChange={(e) => setInterno({ ...interno, prezzo_ora_ord: e.target.value })} />
                </Field>
                <Field label="Prezzo Ore Straordinarie">
                  <Input inputMode="decimal" value={interno.prezzo_ora_straord} onChange={(e) => setInterno({ ...interno, prezzo_ora_straord: e.target.value })} />
                </Field>
                <Field label="Trasferta">
                  <Input inputMode="decimal" value={interno.trasferta} onChange={(e) => setInterno({ ...interno, trasferta: e.target.value })} />
                </Field>
                <Field label="Trasferta 2">
                  <Input inputMode="decimal" value={interno.trasferta_2} onChange={(e) => setInterno({ ...interno, trasferta_2: e.target.value })} />
                </Field>
                <Field label="Buono pasto">
                  <Input inputMode="decimal" value={interno.buono_pasto} onChange={(e) => setInterno({ ...interno, buono_pasto: e.target.value })} />
                </Field>
                <Field label="Assicurazione">
                  <Input inputMode="decimal" value={interno.assicurazione} onChange={(e) => setInterno({ ...interno, assicurazione: e.target.value })} />
                </Field>
                <Field label="Percentuale notturno">
                  <Input inputMode="decimal" value={interno.percentuale_notturno} onChange={(e) => setInterno({ ...interno, percentuale_notturno: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Tipo Macchina">
                  <Select
                    value={esterno.tipo_macchina || undefined}
                    onValueChange={(v) => setEsterno({ ...esterno, tipo_macchina: v })}
                  >
                    <SelectTrigger><SelectValue placeholder={tipiMacchina.length ? "Seleziona…" : "Nessun mezzo caricato"} /></SelectTrigger>
                    <SelectContent>
                      {tipiMacchina.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Targa Macchina">
                  <Input value={esterno.targa} onChange={(e) => setEsterno({ ...esterno, targa: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Percentuale Network">
                  <Input inputMode="decimal" value={esterno.percentuale_network} onChange={(e) => setEsterno({ ...esterno, percentuale_network: e.target.value })} />
                </Field>
                <Field label="Percentuale Last Minute">
                  <Input inputMode="decimal" value={esterno.percentuale_last_minute} onChange={(e) => setEsterno({ ...esterno, percentuale_last_minute: e.target.value })} />
                </Field>
                <Field label="Numero Compito">
                  <Input value={esterno.numero_compto} onChange={(e) => setEsterno({ ...esterno, numero_compto: e.target.value })} />
                </Field>
                <Field label="Iban">
                  <Input value={esterno.iban} onChange={(e) => setEsterno({ ...esterno, iban: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="BANCA">
                  <Input value={esterno.banca} onChange={(e) => setEsterno({ ...esterno, banca: e.target.value })} />
                </Field>
                <Field label="Km Voucher">
                  <Input inputMode="decimal" value={esterno.km_voucher} onChange={(e) => setEsterno({ ...esterno, km_voucher: e.target.value })} />
                </Field>
                <Field label="Modello Veicolo">
                  <Input value={esterno.modello_veicolo} onChange={(e) => setEsterno({ ...esterno, modello_veicolo: e.target.value })} />
                </Field>
                <Field label="Lingua">
                  <Input value={esterno.lingua} onChange={(e) => setEsterno({ ...esterno, lingua: e.target.value })} />
                </Field>
                <Field label="Level">
                  <Input value={esterno.level} onChange={(e) => setEsterno({ ...esterno, level: e.target.value })} />
                </Field>
                <Field label="Foglio (tariffario)">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods,image/*"
                    onChange={(e) => setFoglio(e.target.files?.[0] ?? null)}
                  />
                  {editing?.data?.tariffario_nome && !foglio && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Attuale: {editing.data.tariffario_nome}
                    </p>
                  )}
                </Field>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving || !common.nome.trim()}>
            {editing ? "Aggiorna" : "Inserisci"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <Label className="text-sm italic font-semibold text-right">{label}:</Label>
      <div>{children}</div>
    </div>
  );
}
