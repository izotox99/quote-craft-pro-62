import * as React from "react";
import { Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const COMUNI = [
  "00:00", "05:00", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "21:00",
  "22:00", "23:00",
];

const VALID = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Normalizza input libero (es. "930", "0930", "9.30", "9:5") in HH:MM, o null se impossibile. */
export function normalizeTimeInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  let h = "";
  let m = "";
  if (/[:.\-\s]/.test(s)) {
    const [a, b] = s.split(/[:.\-\s]+/);
    h = (a ?? "").replace(/\D/g, "");
    m = (b ?? "").replace(/\D/g, "");
    if (m === "") m = "0";
  } else if (digits.length <= 2) {
    h = digits;
    m = "0";
  } else if (digits.length === 3) {
    h = digits.slice(0, 1);
    m = digits.slice(1);
  } else if (digits.length === 4) {
    h = digits.slice(0, 2);
    m = digits.slice(2);
  } else {
    return null;
  }
  if (h === "" || m === "") return null;
  const hn = Number(h);
  const mn = Number(m);
  if (!Number.isInteger(hn) || !Number.isInteger(mn)) return null;
  if (hn < 0 || hn > 23 || mn < 0 || mn > 59) return null;
  return `${String(hn).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

export function TimePicker({ value, onChange, placeholder = "HH:MM", className, disabled }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(value ?? "");

  React.useEffect(() => {
    setText(value ?? "");
  }, [value]);

  const invalid = text.trim() !== "" && !VALID.test(text.trim()) && normalizeTimeInput(text) === null;

  const commit = (raw: string) => {
    const n = normalizeTimeInput(raw);
    if (n) {
      setText(n);
      onChange(n);
    } else if (raw.trim() === "") {
      onChange("");
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        maxLength={5}
        aria-invalid={invalid}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const n = normalizeTimeInput(v);
          if (n && VALID.test(v.trim())) onChange(n);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive focus-visible:ring-destructive"
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Orari comuni"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-50"
          >
            <ChevronDown className="h-4 w-4 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-28 p-1" align="end">
          <ScrollArea className="h-56">
            <div className="flex flex-col">
              {COMUNI.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setText(t);
                    onChange(t);
                    setOpen(false);
                  }}
                  className={cn(
                    "py-1.5 text-sm rounded-md text-center transition-colors",
                    t === value ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {invalid && (
        <p className="mt-1 text-[11px] text-destructive">Orario non valido (usa HH:MM)</p>
      )}
    </div>
  );
}
