import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Car } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, role, organization, signIn, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user) return;
    if (role && organization) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let active = true;
    const validateExistingSession = async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("org_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
      ]);
      if (!active) return;
      if (profile?.org_id && Array.isArray(roles) && roles.length > 0) navigate("/dashboard", { replace: true });
      else signOut();
    };

    validateExistingSession();
    return () => { active = false; };
  }, [authLoading, user, role, organization, navigate, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      uid
        ? supabase.from("profiles").select("org_id").eq("user_id", uid).maybeSingle()
        : Promise.resolve({ data: null }),
      uid
        ? supabase.from("user_roles").select("role").eq("user_id", uid).limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const hasNccAccess = !!profile?.org_id && Array.isArray(roles) && roles.length > 0;
    if (!hasNccAccess) {
      await signOut();
      setLoading(false);
      toast.error("Questo account è cliente: usa l'Area Clienti oppure accedi con un account NCC.");
      return;
    }

    setLoading(false);
    navigate("/dashboard", { replace: true });
  };

  const handleGoogle = async () => {
    try { await signInWithGoogle(); } catch { toast.error("Accesso con Google fallito"); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Car className="h-5 w-5 text-primary-foreground" />
          </Link>
          <CardTitle className="font-display text-2xl">Accedi al tuo account</CardTitle>
          <CardDescription>Entra nel gestionale della tua società</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continua con Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">oppure</span></div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Password dimenticata?</Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Non hai un account? <Link to="/signup" className="text-primary hover:underline">Registrati</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
