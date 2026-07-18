import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Trash2, Pencil, FileText, Upload, X } from "lucide-react";
import { NuovoAutistaDialog } from "@/components/NuovoAutistaDialog";

type Esterno = {
  id: string;
  nome: string;
  codice_fiscale: string | null;
  patente: string | null;
  cellulare: string | null;
  email: string | null;
  
  tipo_macchina: string | null;
  targa: string | null;
  level: string | null;
  note: string | null;
  attivo: boolean;
  tariffario_url: string | null;
  tariffario_nome: string | null;
};

export default function AutistiCollaboratori() {
  const { user } = useAuth();
  const [list, setList] = useState<Esterno[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDisattivati, setShowDisattivati] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutista, setEditingAutista] = useState<{ tipo: "interno" | "esterno"; id: string; data: any } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("autisti_esterni")
      .select("*")
      .eq("attivo", !showDisattivati)
      .order("nome");
    setList((data ?? []) as Esterno[]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, showDisattivati]);

  const openNuovo = () => {
    setEditingAutista(null);
    setDialogOpen(true);
  };

  const openModifica = (a: Esterno) => {
    setEditingAutista({ tipo: "esterno", id: a.id, data: a });
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("autisti_esterni").update({ attivo: false }).eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Collaboratore disattivato"); load(); }
    setDeleteId(null);
  };

  const riattiva = async (id: string) => {
    const { error } = await supabase.from("autisti_esterni").update({ attivo: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Collaboratore riattivato"); load(); }
  };

  // ---- Tariffario upload/download/remove ----
  const triggerUpload = (id: string) => {
    setPendingUploadId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = pendingUploadId;
    e.target.value = "";
    setPendingUploadId(null);
    if (!file || !id) return;

    setUploadingId(id);
    try {
      // Rimuovi vecchio file se esiste
      const current = list.find(x => x.id === id);
      if (current?.tariffario_url) {
        const oldPath = current.tariffario_url.split("/").slice(-2).join("/");
        await supabase.storage.from("tariffari-autisti").remove([oldPath]);
      }

      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${id}/tariffario-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("tariffari-autisti")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("autisti_esterni")
        .update({ tariffario_url: path, tariffario_nome: file.name })
        .eq("id", id);
      if (dbErr) throw dbErr;

      toast.success("Tariffario caricato");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Errore upload");
    } finally {
      setUploadingId(null);
    }
  };

  const downloadTariffario = async (a: Esterno) => {
    if (!a.tariffario_url) return;
    const { data, error } = await supabase.storage
      .from("tariffari-autisti")
      .createSignedUrl(a.tariffario_url, 60);
    if (error || !data) return toast.error("Impossibile scaricare il file");
    window.open(data.signedUrl, "_blank");
  };

  const removeTariffario = async (a: Esterno) => {
    if (!a.tariffario_url) return;
    await supabase.storage.from("tariffari-autisti").remove([a.tariffario_url]);
    await supabase.from("autisti_esterni")
      .update({ tariffario_url: null, tariffario_nome: null })
      .eq("id", a.id);
    toast.success("Tariffario rimosso");
    load();
  };

  return (
    <DashboardLayout>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods,image/*"
        onChange={handleFileChange}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold font-display">
            Lista Autisti {showDisattivati ? "Disattivati" : "Esterni"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowDisattivati(v => !v)}>
              {showDisattivati ? "Collaboratori attivi" : "Collaboratori disattivati"}
            </Button>
            <Button className="gap-2" onClick={openNuovo}>
              <PlusCircle className="h-4 w-4" /> Aggiungi collaboratore
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Codice Fiscale</TableHead>
                  <TableHead>Num patente</TableHead>
                  <TableHead>Cellulare</TableHead>
                  <TableHead>Email</TableHead>
                  
                  <TableHead>Tipo macchina</TableHead>
                  <TableHead>Targa</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-center">Tariffario</TableHead>
                  <TableHead className="text-center w-28">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold uppercase">{a.nome}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{a.codice_fiscale ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{a.patente ?? "—"}</TableCell>
                    <TableCell>{a.cellulare ?? "—"}</TableCell>
                    <TableCell className="lowercase">{a.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.password ?? "—"}</TableCell>
                    <TableCell className="italic">{a.tipo_macchina ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{a.targa ?? "—"}</TableCell>
                    <TableCell>{a.level ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-center items-center gap-1">
                        {a.tariffario_url ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={a.tariffario_nome ?? "Scarica tariffario"}
                              onClick={() => downloadTariffario(a)}
                            >
                              <FileText className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Sostituisci tariffario"
                              onClick={() => triggerUpload(a.id)}
                              disabled={uploadingId === a.id}
                            >
                              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Rimuovi tariffario"
                              onClick={() => removeTariffario(a)}
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => triggerUpload(a.id)}
                            disabled={uploadingId === a.id}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingId === a.id ? "..." : "Carica"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" title="Modifica" onClick={() => openModifica(a)}>
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        {showDisattivati ? (
                          <Button variant="ghost" size="sm" onClick={() => riattiva(a.id)}>Riattiva</Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Disattiva" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                      Nessun collaboratore
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Nuovo / Modifica */}
      <NuovoAutistaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultTipo="esterno"
        editing={editingAutista}
        onSaved={() => load()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare il collaboratore?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà spostato tra i disattivati. Potrai riattivarlo in qualsiasi momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Disattiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
