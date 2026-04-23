-- Tabella collaboratori (autisti esterni)
CREATE TABLE IF NOT EXISTS public.autisti_esterni (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  nome text NOT NULL,
  codice_fiscale text,
  patente text,
  cellulare text,
  email text,
  password text,
  tipo_macchina text,
  targa text,
  level text,
  note text,
  attivo boolean NOT NULL DEFAULT true,
  tariffario_url text,
  tariffario_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autisti_esterni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view autisti_esterni"
  ON public.autisti_esterni FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can insert autisti_esterni"
  ON public.autisti_esterni FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can update autisti_esterni"
  ON public.autisti_esterni FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can delete autisti_esterni"
  ON public.autisti_esterni FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER update_autisti_esterni_updated_at
  BEFORE UPDATE ON public.autisti_esterni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket storage per i tariffari (privato)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tariffari-autisti', 'tariffari-autisti', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can view tariffari"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tariffari-autisti');

CREATE POLICY "Auth users can upload tariffari"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tariffari-autisti');

CREATE POLICY "Auth users can update tariffari"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tariffari-autisti');

CREATE POLICY "Auth users can delete tariffari"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tariffari-autisti');