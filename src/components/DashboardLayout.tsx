import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText, LayoutDashboard, Users, Car, UserCheck, Truck, Settings, LogOut, User, Menu,
  ChevronDown, List, Receipt, Star, Package, UserPlus, StickyNote, Clock, FileSpreadsheet,
  Users2, Fuel, ClipboardCheck, ClipboardList, TrendingUp, FilePlus, FileText as FileTextIcon, CalendarDays,
  AlertTriangle, Wrench, Droplet, PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificheBell } from "@/components/NotificheBell";

const clientSubItems = [
  { to: "/clients", icon: List, label: "Lista clienti" },
  { to: "/clients/tariffari", icon: Receipt, label: "Tariffari salvati" },
  { to: "/clients/valutazione", icon: Star, label: "Valutazione cliente" },
  { to: "/clients/accessori", icon: Package, label: "Gest. accessorio" },
  { to: "/clients/rappresentante", icon: UserPlus, label: "Rappresentante" },
  { to: "/clients/note", icon: StickyNote, label: "Nota cliente" },
  { to: "/clients/in-attesa", icon: Clock, label: "Clienti in attesa" },
  { to: "/clients/preventivi", icon: FileSpreadsheet, label: "Preventivo" },
];

const autistiSubItems = [
  { to: "/autisti", icon: Users2, label: "Autisti interni" },
  { to: "/autisti/collaboratori", icon: UserPlus, label: "Collaboratore" },
  { to: "/autisti/consumi", icon: Fuel, label: "Autista/Consumi" },
  { to: "/autisti/valutazione", icon: Star, label: "Valutazione autista" },
  { to: "/autisti/valutazione-interni", icon: ClipboardCheck, label: "Valutazione Interni" },
  { to: "/autisti/produzione", icon: TrendingUp, label: "Produzione autista" },
  { to: "/autisti/nuova-nota", icon: FilePlus, label: "Nuova nota autista" },
  { to: "/autisti/note", icon: StickyNote, label: "Note autisti" },
  { to: "/autisti/mensile", icon: CalendarDays, label: "Mensile autisti interni" },
];

const mezziSubItems = [
  { to: "/veicoli", icon: List, label: "Lista mezzi" },
  { to: "/veicoli/allert", icon: AlertTriangle, label: "Allert Mezzi" },
  { to: "/veicoli/bilancio", icon: TrendingUp, label: "Bilancio vettura" },
  { to: "/veicoli/manutenzione-straordinaria", icon: Wrench, label: "Manutenzione stra." },
  { to: "/veicoli/carburante", icon: Fuel, label: "Dettagli Carburante" },
  { to: "/veicoli/adblue", icon: Droplet, label: "Dettagli AdBlue" },
  { to: "/veicoli/adblue/nuovo", icon: PlusCircle, label: "Aggiungi AdBlue" },
];

const mainNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Servizi" },
  { to: "/fornitori", icon: Truck, label: "Fornitori CS" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, signOut, organization } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientsExpanded, setClientsExpanded] = useState(false);
  const [autistiExpanded, setAutistiExpanded] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isClientActive = pathname.startsWith("/clients");
  const isAutistiActive = pathname.startsWith("/autisti");
  const isMezziActive = pathname.startsWith("/veicoli");
  const [mezziExpanded, setMezziExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="flex h-16 items-center px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <FileText className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-display text-foreground hidden sm:block tracking-tight">
                Dashboard Aziendale
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-end mr-4">
            {mainNavItems.map((item) => {
              const isActive = item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 rounded-lg font-medium transition-all",
                      isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}

            {/* Mezzi dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 rounded-lg font-medium transition-all",
                    isMezziActive && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <Car className="h-4 w-4" />
                  <span>Mezzi</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                {mezziSubItems.map((sub) => (
                  <DropdownMenuItem
                    key={sub.to}
                    onClick={() => navigate(sub.to)}
                    className={cn("gap-3 cursor-pointer", pathname === sub.to && "bg-accent")}
                  >
                    <sub.icon className="h-4 w-4 text-muted-foreground" />
                    {sub.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 rounded-lg font-medium transition-all",
                    isClientActive && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <Users className="h-4 w-4" />
                  <span>Clienti</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {clientSubItems.map((sub) => (
                  <DropdownMenuItem
                    key={sub.to}
                    onClick={() => navigate(sub.to)}
                    className={cn(
                      "gap-3 cursor-pointer",
                      pathname === sub.to && "bg-accent"
                    )}
                  >
                    <sub.icon className="h-4 w-4 text-muted-foreground" />
                    {sub.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Autisti dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 rounded-lg font-medium transition-all",
                    isAutistiActive && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Autisti</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                {autistiSubItems.map((sub) => (
                  <DropdownMenuItem
                    key={sub.to}
                    onClick={() => navigate(sub.to)}
                    className={cn(
                      "gap-3 cursor-pointer",
                      pathname === sub.to && "bg-accent"
                    )}
                  >
                    <sub.icon className="h-4 w-4 text-muted-foreground" />
                    {sub.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <NotificheBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/50">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-3 cursor-pointer">
                  <Settings className="h-4 w-4" /> Impostazioni
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-3 cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4" /> Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b border-border/50 p-5">
            <SheetTitle className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <FileText className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              Dashboard Aziendale
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-0.5 p-4">
            {mainNavItems.map((item) => {
              const isActive = item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 h-11 rounded-lg font-medium",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {/* Clienti collapsible on mobile */}
            <Collapsible open={clientsExpanded || isClientActive} onOpenChange={setClientsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between gap-3 h-11 rounded-lg font-medium",
                    isClientActive && "bg-primary/10 text-primary"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    Clienti
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", (clientsExpanded || isClientActive) && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-border/30 pl-4">
                {clientSubItems.map((sub) => (
                  <Link key={sub.to} to={sub.to} onClick={() => setMobileOpen(false)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-3 h-9 rounded-lg text-sm font-normal",
                        pathname === sub.to && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <sub.icon className="h-4 w-4" />
                      {sub.label}
                    </Button>
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Autisti collapsible on mobile */}
            <Collapsible open={autistiExpanded || isAutistiActive} onOpenChange={setAutistiExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between gap-3 h-11 rounded-lg font-medium",
                    isAutistiActive && "bg-primary/10 text-primary"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <UserCheck className="h-5 w-5" />
                    Autisti
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", (autistiExpanded || isAutistiActive) && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-border/30 pl-4">
                {autistiSubItems.map((sub) => (
                  <Link key={sub.to} to={sub.to} onClick={() => setMobileOpen(false)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-3 h-9 rounded-lg text-sm font-normal",
                        pathname === sub.to && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <sub.icon className="h-4 w-4" />
                      {sub.label}
                    </Button>
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>

            <div className="my-3 border-t border-border/30" />
            <Button variant="ghost" className="w-full justify-start gap-3 h-11 rounded-lg font-medium" onClick={() => { setMobileOpen(false); navigate("/settings"); }}>
              <Settings className="h-5 w-5" />
              Impostazioni
            </Button>
          </nav>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
