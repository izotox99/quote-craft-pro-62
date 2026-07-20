import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProtectedClientRoute } from "@/components/ProtectedClientRoute";
import { ProtectedAutistaRoute } from "@/components/ProtectedAutistaRoute";


import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Servizi from "./pages/Servizi";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import ClientiTariffari from "./pages/ClientiTariffari";
import ClientiValutazione from "./pages/ClientiValutazione";
import ClientiAccessori from "./pages/ClientiAccessori";
import ClientiRappresentante from "./pages/ClientiRappresentante";
import ClientiNote from "./pages/ClientiNote";
import ClientiInAttesa from "./pages/ClientiInAttesa";
import Preventivi from "./pages/Preventivi";
import Veicoli from "./pages/Veicoli";
import VeicoloDettaglio from "./pages/VeicoloDettaglio";
import { AllertMezzi, BilancioVettura, ManutenzioneStraordinaria, DettagliCarburante, DettagliAdBlue, AggiungiAdBlue } from "./pages/mezzi/Stub";
import Autisti from "./pages/Autisti";
import AutistiCollaboratori from "./pages/AutistiCollaboratori";
import FornitoriCS from "./pages/FornitoriCS";
import Network from "./pages/Network";
import Settings from "./pages/Settings";
import Agenda from "./pages/Agenda";
import NotFound from "./pages/NotFound";

// Client portal
import ClientLogin from "./pages/ClientLogin";
import ClientGdpr from "./pages/ClientGdpr";
import ListaServizi from "./pages/client-portal/ListaServizi";
import Prenota from "./pages/client-portal/Prenota";
import Utenze from "./pages/client-portal/Utenze";
import Tariffario from "./pages/client-portal/Tariffario";
import Fatture from "./pages/client-portal/Fatture";

// Autista app
import AutistaLogin from "./pages/autista/AutistaLogin";
import AutistaSetup from "./pages/autista/AutistaSetup";
import AutistaHome from "./pages/autista/AutistaHome";
import AutistaServizi from "./pages/autista/AutistaServizi";
import AutistaServizioDetail from "./pages/autista/AutistaServizioDetail";
import AutistaPlaceholder from "./pages/autista/AutistaPlaceholder";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Servizi /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/clients/tariffari" element={<ProtectedRoute><ClientiTariffari /></ProtectedRoute>} />
            <Route path="/clients/valutazione" element={<ProtectedRoute><ClientiValutazione /></ProtectedRoute>} />
            <Route path="/clients/accessori" element={<ProtectedRoute><ClientiAccessori /></ProtectedRoute>} />
            <Route path="/clients/rappresentante" element={<ProtectedRoute><ClientiRappresentante /></ProtectedRoute>} />
            <Route path="/clients/note" element={<ProtectedRoute><ClientiNote /></ProtectedRoute>} />
            <Route path="/clients/in-attesa" element={<ProtectedRoute><ClientiInAttesa /></ProtectedRoute>} />
            <Route path="/clients/preventivi" element={<ProtectedRoute><Preventivi /></ProtectedRoute>} />
            <Route path="/veicoli" element={<ProtectedRoute><Veicoli /></ProtectedRoute>} />
            <Route path="/veicoli/allert" element={<ProtectedRoute><AllertMezzi /></ProtectedRoute>} />
            <Route path="/veicoli/bilancio" element={<ProtectedRoute><BilancioVettura /></ProtectedRoute>} />
            <Route path="/veicoli/manutenzione-straordinaria" element={<ProtectedRoute><ManutenzioneStraordinaria /></ProtectedRoute>} />
            <Route path="/veicoli/carburante" element={<ProtectedRoute><DettagliCarburante /></ProtectedRoute>} />
            <Route path="/veicoli/adblue" element={<ProtectedRoute><DettagliAdBlue /></ProtectedRoute>} />
            <Route path="/veicoli/adblue/nuovo" element={<ProtectedRoute><AggiungiAdBlue /></ProtectedRoute>} />
            <Route path="/veicoli/:id" element={<ProtectedRoute><VeicoloDettaglio /></ProtectedRoute>} />
            <Route path="/autisti" element={<ProtectedRoute><Autisti /></ProtectedRoute>} />
            <Route path="/autisti/collaboratori" element={<ProtectedRoute><AutistiCollaboratori /></ProtectedRoute>} />
            <Route path="/fornitori" element={<ProtectedRoute><FornitoriCS /></ProtectedRoute>} />
            <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />

            {/* Client portal */}
            <Route path="/client-login" element={<ClientLogin />} />
            <Route path="/client-portal/gdpr" element={<ClientGdpr />} />
            <Route path="/client-portal" element={<ProtectedClientRoute><ListaServizi /></ProtectedClientRoute>} />
            <Route path="/client-portal/prenota" element={<ProtectedClientRoute><Prenota /></ProtectedClientRoute>} />
            <Route path="/client-portal/utenze" element={<ProtectedClientRoute><Utenze /></ProtectedClientRoute>} />
            <Route path="/client-portal/tariffario" element={<ProtectedClientRoute><Tariffario /></ProtectedClientRoute>} />
            <Route path="/client-portal/fatture" element={<ProtectedClientRoute><Fatture /></ProtectedClientRoute>} />

            {/* Area Autisti */}
            <Route path="/autista/login" element={<AutistaLogin />} />
            <Route path="/autista/setup" element={<AutistaSetup />} />
            <Route path="/autista" element={<ProtectedAutistaRoute><AutistaHome /></ProtectedAutistaRoute>} />


            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
