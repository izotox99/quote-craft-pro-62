import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Trash2, Upload, Download } from "lucide-react";

type Doc = {
  id: string;
  titolo: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
};

export function SectionDocumenti({ veicoloId }: { veicoloId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [titolo, setTitolo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("veicoli_documenti")
      .select("*")
      .eq("veicolo_id", veicoloId)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
  };

  useEffect(() => { load(); }, [veicoloId]);

  const handleUpload = async () => {
    if (!file || !titolo.trim()) {
      toast.error("Inserisci titolo e seleziona un file");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${veicoloId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("veicoli-documenti")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("veicoli_documenti").insert({
        veicolo_id: veicoloId,
        titolo: titolo.trim(),
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
      });
      if (error) throw error;
      toast.success("Documento aggiunto");
      setTitolo(""); setFile(null);
      (document.getElementById("doc-file") as HTMLInputElement).value = "";
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  const handleDownload = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("veicoli-documenti").createSignedUrl(d.file_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (d: Doc) => {
    if (!confirm(`Eliminare "${d.titolo}"?`)) return;
    await supabase.storage.from("veicoli-documenti").remove([d.file_path]);
    const { error } = await supabase.from("veicoli_documenti").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Documento eliminato");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">Titolo</label>
            <Input placeholder="es. libretto circolazione" value={titolo} onChange={(e) => setTitolo(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">File</label>
            <Input id="doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" />{uploading ? "Caricamento..." : "Carica"}
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />Nessun documento caricato
              </TableCell></TableRow>
            )}
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell><FileText className="h-5 w-5 text-primary" /></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(d.created_at).toLocaleDateString("it-IT")}
                </TableCell>
                <TableCell className="font-medium">{d.titolo}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(d)} title="Scarica">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d)} title="Elimina">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
