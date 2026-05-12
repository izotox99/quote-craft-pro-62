
-- ============================
-- DOCUMENTI VEICOLO
-- ============================
CREATE TABLE public.veicoli_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  veicolo_id uuid NOT NULL REFERENCES public.veicoli(id) ON DELETE CASCADE,
  titolo text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.veicoli_documenti(veicolo_id);
ALTER TABLE public.veicoli_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view veicoli_documenti" ON public.veicoli_documenti
  FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org insert veicoli_documenti" ON public.veicoli_documenti
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org update veicoli_documenti" ON public.veicoli_documenti
  FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org delete veicoli_documenti" ON public.veicoli_documenti
  FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER set_org_id_veicoli_documenti BEFORE INSERT ON public.veicoli_documenti
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();

-- ============================
-- MANUTENZIONE ORDINARIA
-- ============================
CREATE TABLE public.veicoli_manutenzione_ord (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  veicolo_id uuid NOT NULL REFERENCES public.veicoli(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  km integer,
  tipo text,
  note text,
  ricambi text,
  fornitore text,
  totale numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.veicoli_manutenzione_ord(veicolo_id);
ALTER TABLE public.veicoli_manutenzione_ord ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view man_ord" ON public.veicoli_manutenzione_ord
  FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org insert man_ord" ON public.veicoli_manutenzione_ord
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org update man_ord" ON public.veicoli_manutenzione_ord
  FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org delete man_ord" ON public.veicoli_manutenzione_ord
  FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER set_org_id_man_ord BEFORE INSERT ON public.veicoli_manutenzione_ord
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER set_updated_at_man_ord BEFORE UPDATE ON public.veicoli_manutenzione_ord
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================
-- MANUTENZIONE STRAORDINARIA
-- ============================
CREATE TABLE public.veicoli_manutenzione_straord (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  veicolo_id uuid NOT NULL REFERENCES public.veicoli(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  km_attuale integer,
  tipo_riparazione text,
  tipo text,
  note text,
  ricambi text,
  fornitore text,
  ordine text,
  totale numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.veicoli_manutenzione_straord(veicolo_id);
ALTER TABLE public.veicoli_manutenzione_straord ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view man_str" ON public.veicoli_manutenzione_straord
  FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org insert man_str" ON public.veicoli_manutenzione_straord
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org update man_str" ON public.veicoli_manutenzione_straord
  FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org delete man_str" ON public.veicoli_manutenzione_straord
  FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER set_org_id_man_str BEFORE INSERT ON public.veicoli_manutenzione_straord
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER set_updated_at_man_str BEFORE UPDATE ON public.veicoli_manutenzione_straord
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================
-- CARBURANTE / GASOLIO
-- ============================
CREATE TABLE public.veicoli_gasolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  veicolo_id uuid NOT NULL REFERENCES public.veicoli(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  autista_id uuid,
  autista_nome text,
  km integer,
  quantita numeric,
  prezzo_unitario numeric,
  prezzo_totale numeric DEFAULT 0,
  luogo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.veicoli_gasolio(veicolo_id);
ALTER TABLE public.veicoli_gasolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view gasolio" ON public.veicoli_gasolio
  FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org insert gasolio" ON public.veicoli_gasolio
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org update gasolio" ON public.veicoli_gasolio
  FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org delete gasolio" ON public.veicoli_gasolio
  FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER set_org_id_gasolio BEFORE INSERT ON public.veicoli_gasolio
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER set_updated_at_gasolio BEFORE UPDATE ON public.veicoli_gasolio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================
-- SPESE VEICOLO
-- ============================
CREATE TABLE public.veicoli_spese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  veicolo_id uuid NOT NULL REFERENCES public.veicoli(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  data_intervento date,
  data_scadenza date,
  importo_spese numeric DEFAULT 0,
  totale_fattura numeric DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.veicoli_spese(veicolo_id);
ALTER TABLE public.veicoli_spese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view spese" ON public.veicoli_spese
  FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org insert spese" ON public.veicoli_spese
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org update spese" ON public.veicoli_spese
  FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org delete spese" ON public.veicoli_spese
  FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER set_org_id_spese BEFORE INSERT ON public.veicoli_spese
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER set_updated_at_spese BEFORE UPDATE ON public.veicoli_spese
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================
-- STORAGE BUCKET veicoli-documenti
-- ============================
INSERT INTO storage.buckets (id, name, public)
VALUES ('veicoli-documenti', 'veicoli-documenti', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members view veicoli-documenti"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'veicoli-documenti'
    AND EXISTS (
      SELECT 1 FROM public.veicoli v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND v.org_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Org members upload veicoli-documenti"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'veicoli-documenti'
    AND EXISTS (
      SELECT 1 FROM public.veicoli v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND v.org_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Org members delete veicoli-documenti"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'veicoli-documenti'
    AND EXISTS (
      SELECT 1 FROM public.veicoli v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND v.org_id = get_user_org_id(auth.uid())
    )
  );
