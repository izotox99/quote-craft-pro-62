import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Layers, Star } from "lucide-react";
import type { ViewRef } from "@/hooks/use-servizi-viste";

type Props = {
  viste: ViewRef[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function ViewSelector({ viste, activeId, onSelect }: Props) {
  const active = viste.find((v) => v.id === activeId);
  const sistema = viste.filter((v) => v.system);
  const personali = viste.filter((v) => !v.system);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          <span className="max-w-[10rem] truncate">{active?.nome || "Vista"}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Sistema</DropdownMenuLabel>
        {sistema.map((v) => (
          <DropdownMenuItem key={v.id} onClick={() => onSelect(v.id)} className="text-xs flex items-center gap-2">
            <span className="flex-1 truncate">{v.nome}</span>
            {v.id === activeId && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        {personali.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Le tue viste</DropdownMenuLabel>
            {personali.map((v) => (
              <DropdownMenuItem key={v.id} onClick={() => onSelect(v.id)} className="text-xs flex items-center gap-2">
                <span className="flex-1 truncate">{v.nome}</span>
                {v.predefinita && <Star className="h-3 w-3 text-amber-500" />}
                {v.id === activeId && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
