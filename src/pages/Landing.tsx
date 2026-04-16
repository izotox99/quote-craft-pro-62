import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Car, ArrowRight, CheckCircle2, Shield, Users, BarChart3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Car, title: "Gestione Servizi", description: "Organizza tutti i servizi NCC: transfer, disposizioni, tour ed eventi in un'unica piattaforma." },
  { icon: Users, title: "Multi-Società", description: "Ogni società accede con le proprie credenziali e vede solo i propri dati in totale sicurezza." },
  { icon: MapPin, title: "Itinerari e Percorsi", description: "Gestisci luoghi di partenza, arrivo e itinerari completi per ogni servizio." },
  { icon: Shield, title: "Autisti e Mezzi", description: "Anagrafica completa di autisti e veicoli con assegnazione rapida ai servizi." },
  { icon: BarChart3, title: "Contabilità", description: "Traccia incassi, costi autisti, costi CS e commissioni per ogni servizio." },
  { icon: CheckCircle2, title: "Filtri Avanzati", description: "Cerca servizi per data, stato, tipologia, targa, cliente, autista e molto altro." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">NCC Manager</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/client-login")}>Area Clienti</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Accedi</Button>
            <Button size="sm" onClick={() => navigate("/signup")}>Registrati</Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 to-background" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Gestionale per{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Servizi NCC
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Gestisci servizi, autisti, mezzi e clienti della tua azienda di noleggio con conducente. Tutto in un unico posto.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="h-12 px-8 text-base w-full sm:w-auto" onClick={() => navigate("/signup")}>
                Inizia ora <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base w-full sm:w-auto" onClick={() => navigate("/login")}>
                Accedi
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Tutto ciò che serve per gestire i tuoi servizi</h2>
            <p className="mt-4 text-lg text-muted-foreground">Dalla prenotazione alla contabilità, NCC Manager copre ogni aspetto.</p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Pronto a organizzare i tuoi servizi?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Registrati e inizia a gestire la tua flotta in pochi minuti.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 px-8 text-base w-full sm:w-auto" onClick={() => navigate("/signup")}>
              Registrati gratis <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Car className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">NCC Manager</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} NCC Manager. Tutti i diritti riservati.</p>
        </div>
      </footer>
    </div>
  );
}
