-- Estendi tabella autisti con i nuovi campi
ALTER TABLE public.autisti
  ADD COLUMN IF NOT EXISTS mansione text,
  ADD COLUMN IF NOT EXISTS codice_fiscale text,
  ADD COLUMN IF NOT EXISTS prezzo_ora_ord numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prezzo_ora_straord numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cellulare text,
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS attivo boolean NOT NULL DEFAULT true;

-- Tabella spese autista
CREATE TABLE IF NOT EXISTS public.autisti_spese (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  tipo text NOT NULL,
  data_intervento date,
  data_scadenza date,
  importo_spese numeric DEFAULT 0,
  totale_fattura numeric DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autisti_spese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view autisti_spese"
  ON public.autisti_spese FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can insert autisti_spese"
  ON public.autisti_spese FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can update autisti_spese"
  ON public.autisti_spese FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can delete autisti_spese"
  ON public.autisti_spese FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER update_autisti_spese_updated_at
  BEFORE UPDATE ON public.autisti_spese
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_autisti_spese_autista ON public.autisti_spese(autista_id);