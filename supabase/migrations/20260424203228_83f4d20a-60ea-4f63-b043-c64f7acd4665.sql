-- Rubrica passeggeri frequenti per cliente
CREATE TABLE public.passeggeri_rubrica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cognome text,
  telefono text,
  email text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passeggeri_rubrica_client ON public.passeggeri_rubrica(client_id);
CREATE INDEX idx_passeggeri_rubrica_org ON public.passeggeri_rubrica(org_id);

ALTER TABLE public.passeggeri_rubrica ENABLE ROW LEVEL SECURITY;

-- Org members
CREATE POLICY "Org members view passeggeri_rubrica"
  ON public.passeggeri_rubrica FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members insert passeggeri_rubrica"
  ON public.passeggeri_rubrica FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members update passeggeri_rubrica"
  ON public.passeggeri_rubrica FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members delete passeggeri_rubrica"
  ON public.passeggeri_rubrica FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Parent client access
CREATE POLICY "Parent clients view own passeggeri"
  ON public.passeggeri_rubrica FOR SELECT TO authenticated
  USING (client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "Parent clients insert own passeggeri"
  ON public.passeggeri_rubrica FOR INSERT TO authenticated
  WITH CHECK (
    public.is_client_user(auth.uid())
    AND org_id = public.get_client_org_id(auth.uid())
    AND client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Parent clients update own passeggeri"
  ON public.passeggeri_rubrica FOR UPDATE TO authenticated
  USING (client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "Parent clients delete own passeggeri"
  ON public.passeggeri_rubrica FOR DELETE TO authenticated
  USING (client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1));

-- Utenze access (sub-users)
CREATE POLICY "Utenze view parent passeggeri"
  ON public.passeggeri_rubrica FOR SELECT TO authenticated
  USING (client_id = public.get_utenza_parent_client_id(auth.uid()));

CREATE POLICY "Utenze insert parent passeggeri"
  ON public.passeggeri_rubrica FOR INSERT TO authenticated
  WITH CHECK (
    public.is_client_user(auth.uid())
    AND org_id = public.get_client_org_id(auth.uid())
    AND client_id = public.get_utenza_parent_client_id(auth.uid())
  );

CREATE POLICY "Utenze update parent passeggeri"
  ON public.passeggeri_rubrica FOR UPDATE TO authenticated
  USING (client_id = public.get_utenza_parent_client_id(auth.uid()));

CREATE TRIGGER update_passeggeri_rubrica_updated_at
  BEFORE UPDATE ON public.passeggeri_rubrica
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();