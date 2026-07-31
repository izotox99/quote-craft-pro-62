import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, Home, Calendar, Clock, Umbrella, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = { children: ReactNode };

const NAV = [
  { to: "/autista", icon: Home, label: "Home", end: true },
  { to: "/autista/servizi/oggi", icon: Calendar, label: "Oggi" },
  { to: "/autista/presenza", icon: Clock, label: "Presenza" },
  { to: "/autista/ferie", icon: Umbrella, label: "Ferie" },
  { to: "/autista/impostazioni", icon: Settings, label: "Opzioni" },
];

export function AutistaLayout({ children }: Props) {
  const [azienda, setAzienda] = useState("");
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase
        .from("autisti")
        .select("org_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (a?.org_id) {
        const { data: o } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", a.org_id)
          .maybeSingle();
        setAzienda(o?.name ?? "");
        const [{ data: com }, { data: let_ }] = await Promise.all([
          supabase.from("comunicazioni").select("id"),
          supabase.from("comunicazioni_letture").select("comunicazione_id"),
        ]);
        const lette = new Set((let_ ?? []).map((x: any) => x.comunicazione_id));
        setUnread((com ?? []).filter((c: any) => !lette.has(c.id)).length);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 h-14">
          <div className="font-display font-semibold text-sm truncate">{azienda || "NCC"}</div>
          <button
            onClick={() => navigate("/autista/notifiche")}
            className="relative rounded-full p-2 hover:bg-white/10"
            aria-label="Notifiche"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-900" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 pb-20">
        <div className="mx-auto max-w-2xl px-3 py-3">{children}</div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="mx-auto max-w-2xl grid grid-cols-5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
