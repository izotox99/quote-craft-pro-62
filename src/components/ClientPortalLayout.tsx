import { ReactNode, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus, List, Users, BookOpen, FileText,
  LogOut, Menu, X, Car, ChevronRight, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalTutorial } from "@/components/PortalTutorial";

const navItems = [
  { label: "Prenota", icon: CalendarPlus, path: "/client-portal/prenota", tour: "prenota" },
  { label: "Lista Servizi", icon: List, path: "/client-portal", tour: "servizi" },
  { label: "Utenze", icon: Users, path: "/client-portal/utenze", tour: "utenze", parentOnly: true },
  { label: "Tariffario", icon: BookOpen, path: "/client-portal/tariffario", tour: "tariffario" },
  { label: "Fatture", icon: FileText, path: "/client-portal/fatture", tour: "fatture" },
];

export function ClientPortalLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [clientName, setClientName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [autoStartTutorial, setAutoStartTutorial] = useState(false);
  const tutorialStartRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: client } = await supabase
        .from("clients")
        .select("company, name, tutorial_completato_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (client) {
        setClientName(client.company || client.name);
        setIsParent(true);
        if (!client.tutorial_completato_at) setAutoStartTutorial(true);
        return;
      }
      const { data: utenza } = await supabase
        .from("client_utenze")
        .select("nome, cognome, parent_client_id, tutorial_completato_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (utenza) {
        const { data: parent } = await supabase
          .from("clients")
          .select("company, name")
          .eq("id", utenza.parent_client_id)
          .maybeSingle();
        const parentLabel = parent?.company || parent?.name || "";
        setClientName(`${utenza.nome} ${utenza.cognome}${parentLabel ? ` · ${parentLabel}` : ""}`);
        setIsParent(false);
        if (!utenza.tutorial_completato_at) setAutoStartTutorial(true);
      }
    };
    load();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client-login");
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={cn(
      "flex flex-col bg-card border-r border-border/50 transition-all duration-300",
      mobile ? "w-64" : collapsed ? "w-16" : "w-56"
    )}>
      {/* Header */}
      <div className="h-14 flex items-center px-3 border-b border-border/50 gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Car className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && <span className="text-sm font-semibold truncate">{clientName || "Portale"}</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.filter(i => !i.parentOnly || isParent).map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              data-tour={item.tour}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {(!collapsed || mobile) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", collapsed ? "" : "rotate-180")} />
        </button>
      )}

      {/* Logout */}
      <div className="border-t border-border/50 p-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && <span>Esci</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              Benvenuto, <span className="text-foreground">{clientName}</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Rivedi tutorial"
            onClick={() => tutorialStartRef.current?.()}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      <PortalTutorial
        autoStart={autoStartTutorial}
        showUtenze={isParent}
        onReady={(start) => { tutorialStartRef.current = start; }}
      />
    </div>
  );
}
