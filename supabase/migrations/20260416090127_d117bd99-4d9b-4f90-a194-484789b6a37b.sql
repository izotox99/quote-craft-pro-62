
-- Enum for service status
CREATE TYPE public.servizio_stato AS ENUM ('nuovo', 'confermato', 'in_corso', 'completato', 'annullato');

-- Enum for service type
CREATE TYPE public.servizio_tipologia AS ENUM ('transfer', 'disposizione', 'tour', 'evento', 'altro');

-- Vehicles table
CREATE TABLE public.veicoli (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  targa TEXT NOT NULL,
  tipo_macchina TEXT,
  marca TEXT,
  modello TEXT,
  colore TEXT,
  posti INTEGER DEFAULT 4,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.veicoli ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view veicoli" ON public.veicoli FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can insert veicoli" ON public.veicoli FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update veicoli" ON public.veicoli FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can delete veicoli" ON public.veicoli FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_veicoli_updated_at BEFORE UPDATE ON public.veicoli FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drivers table
CREATE TABLE public.autisti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  patente TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.autisti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view autisti" ON public.autisti FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can insert autisti" ON public.autisti FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update autisti" ON public.autisti FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can delete autisti" ON public.autisti FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_autisti_updated_at BEFORE UPDATE ON public.autisti FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Suppliers table
CREATE TABLE public.fornitori_cs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  nome TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fornitori_cs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fornitori_cs" ON public.fornitori_cs FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can insert fornitori_cs" ON public.fornitori_cs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update fornitori_cs" ON public.fornitori_cs FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can delete fornitori_cs" ON public.fornitori_cs FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_fornitori_cs_updated_at BEFORE UPDATE ON public.fornitori_cs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Services table (core of the system)
CREATE TABLE public.servizi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  data_servizio DATE NOT NULL DEFAULT CURRENT_DATE,
  citta TEXT,
  luogo_inizio TEXT,
  luogo_fine TEXT,
  itinerario TEXT,
  stato servizio_stato NOT NULL DEFAULT 'nuovo',
  tipologia servizio_tipologia DEFAULT 'transfer',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contatto TEXT,
  telefono_contatto TEXT,
  autista_id UUID REFERENCES public.autisti(id) ON DELETE SET NULL,
  veicolo_id UUID REFERENCES public.veicoli(id) ON DELETE SET NULL,
  fornitore_cs_id UUID REFERENCES public.fornitori_cs(id) ON DELETE SET NULL,
  n_passeggeri INTEGER DEFAULT 1,
  n_bagagli INTEGER DEFAULT 0,
  accessori TEXT,
  info_autista TEXT,
  codice TEXT,
  foglio TEXT,
  -- Pricing
  incasso NUMERIC DEFAULT 0,
  costo_cs NUMERIC DEFAULT 0,
  costo_autista NUMERIC DEFAULT 0,
  costo_commissione NUMERIC DEFAULT 0,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servizi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view servizi" ON public.servizi FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can insert servizi" ON public.servizi FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update servizi" ON public.servizi FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can delete servizi" ON public.servizi FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_servizi_updated_at BEFORE UPDATE ON public.servizi FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for common queries
CREATE INDEX idx_servizi_data ON public.servizi(data_servizio);
CREATE INDEX idx_servizi_stato ON public.servizi(stato);
CREATE INDEX idx_servizi_org ON public.servizi(org_id);
CREATE INDEX idx_servizi_client ON public.servizi(client_id);
CREATE INDEX idx_veicoli_targa ON public.veicoli(targa);
