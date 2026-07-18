import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info, GripVertical, Star, Trash2, Pencil, Save, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { COLUMNS_MAP, PINNED_COLUMNS, type ViewColumnState, SYSTEM_VIEW_IDS } from "@/lib/servizi-columns";
import type { ViewRef } from "@/hooks/use-servizi-viste";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeView: ViewRef;
  onUpdateColumns: (columns: ViewColumnState[]) => Promise<void>;
  onSaveAs: (nome: string, columns: ViewColumnState[]) => Promise<void>;
  onRename: (nome: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetDefault: () => Promise<void>;
  onResetWidths?: () => Promise<void> | void;
};

export function ColumnCustomizer({
  open, onOpenChange, activeView,
  onUpdateColumns, onSaveAs, onRename, onDelete, onSetDefault, onResetWidths,
}: Props) {
  const [draft, setDraft] = useState<ViewColumnState[]>(activeView.columns);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState<{ open: boolean; nome: string }>({ open: false, nome: "" });
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; nome: string }>({ open: false, nome: "" });
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Reset draft quando cambia la vista attiva o si riapre il pannello
  useMemo(() => setDraft(activeView.columns), [activeView.id, open]);

  const isSystem = SYSTEM_VIEW_IDS.has(activeView.id);
  const visibleCount = draft.filter((c) => c.visible).length;

  const toggle = (key: string) =>
    setDraft((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));

  const onDragStart = (key: string) => setDraggingKey(key);
  const onDragOver = (e: React.DragEvent, overKey: string) => {
    e.preventDefault();
    if (!draggingKey || draggingKey === overKey) return;
    setDraft((prev) => {
      const from = prev.findIndex((c) => c.key === draggingKey);
      const to = prev.findIndex((c) => c.key === overKey);
      if (from < 0 || to < 0) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const onDragEnd = () => setDraggingKey(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(activeView.columns);

  const handleApply = async () => {
    try {
      if (isSystem) {
        // Sulle viste di sistema, non salviamo: forziamo il "Salva come nuova"
        setSaveDialog({ open: true, nome: `${activeView.nome} (copia)` });
        return;
      }
      await onUpdateColumns(draft);
      toast.success("Vista aggiornata");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const handleSaveAs = async () => {
    try {
      await onSaveAs(saveDialog.nome, draft);
      setSaveDialog({ open: false, nome: "" });
      toast.success("Vista salvata");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const handleRename = async () => {
    try {
      await onRename(renameDialog.nome);
      setRenameDialog({ open: false, nome: "" });
      toast.success("Vista rinominata");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      setDeleteDialog(false);
      toast.success("Vista eliminata");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const handleSetDefault = async () => {
    try {
      await onSetDefault();
      toast.success("Vista impostata come predefinita");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="text-base">Personalizza colonne</SheetTitle>
            <SheetDescription className="text-xs">
              Vista attiva: <span className="font-medium text-foreground">{activeView.nome}</span>
              {isSystem && <span className="ml-1 text-muted-foreground">(sistema — clonabile)</span>}
              {activeView.predefinita && <span className="ml-1 text-primary">· predefinita</span>}
              <br />
              Trascina per riordinare. {visibleCount} colonne visibili.
            </SheetDescription>
          </SheetHeader>

          <TooltipProvider delayDuration={150}>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {draft.map((col) => {
                const def = COLUMNS_MAP[col.key];
                if (!def) return null;
                return (
                  <div
                    key={col.key}
                    draggable
                    onDragStart={() => onDragStart(col.key)}
                    onDragOver={(e) => onDragOver(e, col.key)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 bg-card transition-opacity ${
                      draggingKey === col.key ? "opacity-40" : "opacity-100"
                    } hover:border-primary/40`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                    <Checkbox
                      checked={col.visible}
                      onCheckedChange={() => toggle(col.key)}
                      aria-label={`Mostra ${def.label}`}
                    />
                    <span className="text-sm flex-1 truncate">{def.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => e.preventDefault()}
                          aria-label={`Cosa significa ${def.label}`}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        <p><span className="font-semibold">{def.label}</span> — {def.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>

          <div className="border-t px-5 py-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {!isSystem && (
                <>
                  <Button size="sm" onClick={handleApply} disabled={!dirty} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Salva modifiche
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSetDefault} disabled={activeView.predefinita} className="gap-1.5">
                    <Star className="h-3.5 w-3.5" />
                    {activeView.predefinita ? "Predefinita" : "Imposta predefinita"}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSaveDialog({ open: true, nome: isSystem ? `${activeView.nome} (copia)` : "" })}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Salva come nuova vista
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {onResetWidths && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try { await onResetWidths(); toast.success("Larghezze ripristinate"); }
                    catch (e: any) { toast.error(e.message || "Errore"); }
                  }}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Ripristina larghezze predefinite
                </Button>
              )}
              {!isSystem && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setRenameDialog({ open: true, nome: activeView.nome })} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Rinomina
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteDialog(true)} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Elimina
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={saveDialog.open} onOpenChange={(o) => setSaveDialog((s) => ({ ...s, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salva come nuova vista</AlertDialogTitle>
            <AlertDialogDescription>Assegna un nome per riutilizzare questa configurazione.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={saveDialog.nome}
            onChange={(e) => setSaveDialog((s) => ({ ...s, nome: e.target.value }))}
            placeholder="Es. Vista economica"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAs}>Salva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renameDialog.open} onOpenChange={(o) => setRenameDialog((s) => ({ ...s, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rinomina vista</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={renameDialog.nome}
            onChange={(e) => setRenameDialog((s) => ({ ...s, nome: e.target.value }))}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename}>Rinomina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare "{activeView.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              La vista verrà rimossa in modo permanente. I dati dei servizi non vengono toccati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
