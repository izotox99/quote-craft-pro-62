import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimePicker({ value, onChange, placeholder = "Seleziona ora", className, disabled }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedHour, setSelectedHour] = React.useState(() => value?.split(":")[0] ?? "");
  const [selectedMinute, setSelectedMinute] = React.useState(() => value?.split(":")[1] ?? "");

  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setSelectedHour(h ?? "");
      setSelectedMinute(m ?? "");
    }
  }, [value]);

  // scroll to selected on open
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        hourRef.current?.querySelector("[data-selected=true]")?.scrollIntoView({ block: "center" });
        minuteRef.current?.querySelector("[data-selected=true]")?.scrollIntoView({ block: "center" });
      }, 50);
    }
  }, [open]);

  const handleHour = (h: string) => {
    setSelectedHour(h);
    const m = selectedMinute || "00";
    onChange(`${h}:${m}`);
  };

  const handleMinute = (m: string) => {
    setSelectedMinute(m);
    const h = selectedHour || "00";
    onChange(`${h}:${m}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 rounded-lg",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0 opacity-60" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x divide-border">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2">Ore</span>
            <ScrollArea className="h-52" ref={hourRef}>
              <div className="flex flex-col px-1 pb-1">
                {hours.map(h => (
                  <button
                    key={h}
                    data-selected={h === selectedHour}
                    onClick={() => handleHour(h)}
                    className={cn(
                      "w-12 py-1.5 text-sm rounded-md transition-colors text-center",
                      h === selectedHour
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-2">Min</span>
            <ScrollArea className="h-52" ref={minuteRef}>
              <div className="flex flex-col px-1 pb-1">
                {minutes.map(m => (
                  <button
                    key={m}
                    data-selected={m === selectedMinute}
                    onClick={() => handleMinute(m)}
                    className={cn(
                      "w-12 py-1.5 text-sm rounded-md transition-colors text-center",
                      m === selectedMinute
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
