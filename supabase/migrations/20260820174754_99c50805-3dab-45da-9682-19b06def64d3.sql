
-- ENUM
CREATE TYPE public.magazzino_ordine_stato AS ENUM ('bozza','convalidato','ricevuto','annullato');
CREATE TYPE public.magazzino_tipo_consumo AS ENUM ('macchine','consumo_interno');
CREATE TYPE public.magazzino_movimento_tipo AS ENUM ('carico','scarico');
CREATE TYPE public.magazzino_carico_motivo AS ENUM ('ordine','inventario_iniziale','rettifica','reso','altro');

-- FORNITORI MAGAZZINO
CREATE TABLE public.fornitori_magazzino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefono text, email text, indirizzo text, note text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornitori_magazzino TO authenticated;
GRANT ALL ON public.fornitori_magazzino TO service_role;
ALTER TABLE public.fornitori_magazzino ENABLE ROW LEVEL SECURITY;

-- ARTICOLI
CREATE TABLE public.articoli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unita_misura text NOT NULL DEFAULT 'pz',
  fornitore_default_id uuid REFERENCES public.fornitori_magazzino(id) ON DELETE SET NULL,
  prezzo_unitario numeric,
  scorta_minima numeric NOT NULL DEFAULT 0,
  note text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articoli TO authenticated;
GRANT ALL ON public.articoli TO service_role;
ALTER TABLE public.articoli ENABLE ROW LEVEL SECURITY;

-- ORDINI
CREATE TABLE public.ordini (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  numero integer,
  data date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Rome')::date,
  stato public.magazzino_ordine_stato NOT NULL DEFAULT 'bozza',
  fornitore_id uuid REFERENCES public.fornitori_magazzino(id) ON DELETE SET NULL,
  note text,
  created_by uuid,
  ricevuto_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ordini_org_numero_uidx ON public.ordini(org_id, numero) WHERE numero IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordini TO authenticated;
GRANT ALL ON public.ordini TO service_role;
ALTER TABLE public.ordini ENABLE ROW LEVEL SECURITY;

-- ORDINI RIGHE
CREATE TABLE public.ordini_righe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ordine_id uuid NOT NULL REFERENCES public.ordini(id) ON DELETE CASCADE,
  tipo_consumo public.magazzino_tipo_consumo NOT NULL DEFAULT 'macchine',
  veicolo_tipo text,
  veicolo_id uuid REFERENCES public.veicoli(id) ON DELETE SET NULL,
  fornitore_id uuid REFERENCES public.fornitori_magazzino(id) ON DELETE SET NULL,
  articolo_id uuid NOT NULL REFERENCES public.articoli(id) ON DELETE RESTRICT,
  quantita numeric NOT NULL DEFAULT 1,
  unita text,
  prezzo_unitario numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ordini_righe_ordine_idx ON public.ordini_righe(ordine_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordini_righe TO authenticated;
GRANT ALL ON public.ordini_righe TO service_role;
ALTER TABLE public.ordini_righe ENABLE ROW LEVEL SECURITY;

-- MOVIMENTI
CREATE TABLE public.movimenti_magazzino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  articolo_id uuid NOT NULL REFERENCES public.articoli(id) ON DELETE RESTRICT,
  tipo public.magazzino_movimento_tipo NOT NULL,
  quantita numeric NOT NULL,
  data date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Rome')::date,
  ordine_riga_id uuid REFERENCES public.ordini_righe(id) ON DELETE SET NULL,
  veicolo_id uuid REFERENCES public.veicoli(id) ON DELETE SET NULL,
  consumo_interno boolean NOT NULL DEFAULT false,
  motivo public.magazzino_carico_motivo,
  anomalia boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movimenti_magazzino_art_idx ON public.movimenti_magazzino(org_id, articolo_id);
CREATE INDEX movimenti_magazzino_veicolo_idx ON public.movimenti_magazzino(veicolo_id);
CREATE UNIQUE INDEX movimenti_carico_riga_uidx ON public.movimenti_magazzino(ordine_riga_id) WHERE ordine_riga_id IS NOT NULL AND tipo = 'carico';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_magazzino TO authenticated;
GRANT ALL ON public.movimenti_magazzino TO service_role;
ALTER TABLE public.movimenti_magazzino ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Org members read fornitori_magazzino" ON public.fornitori_magazzino FOR SELECT TO authenticated USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Org writers manage fornitori_magazzino" ON public.fornitori_magazzino FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

CREATE POLICY "Org members read articoli" ON public.articoli FOR SELECT TO authenticated USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Org writers manage articoli" ON public.articoli FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

CREATE POLICY "Org members read ordini" ON public.ordini FOR SELECT TO authenticated USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Org writers manage ordini" ON public.ordini FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

CREATE POLICY "Org members read ordini_righe" ON public.ordini_righe FOR SELECT TO authenticated USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Org writers manage ordini_righe" ON public.ordini_righe FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

CREATE POLICY "Org members read movimenti" ON public.movimenti_magazzino FOR SELECT TO authenticated USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Org writers manage movimenti" ON public.movimenti_magazzino FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

-- TRIGGERS org_id + updated_at
CREATE TRIGGER fornitori_magazzino_org BEFORE INSERT ON public.fornitori_magazzino FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER articoli_org BEFORE INSERT ON public.articoli FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER ordini_org BEFORE INSERT ON public.ordini FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER ordini_righe_org BEFORE INSERT ON public.ordini_righe FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER movimenti_magazzino_org BEFORE INSERT ON public.movimenti_magazzino FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();

CREATE TRIGGER fornitori_magazzino_upd BEFORE UPDATE ON public.fornitori_magazzino FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER articoli_upd BEFORE UPDATE ON public.articoli FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ordini_upd BEFORE UPDATE ON public.ordini FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ordini_righe_upd BEFORE UPDATE ON public.ordini_righe FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VISTA GIACENZE
CREATE VIEW public.magazzino_giacenze WITH (security_invoker = on) AS
SELECT a.id AS articolo_id, a.org_id, a.nome, a.unita_misura, a.scorta_minima, a.prezzo_unitario, a.attivo,
  COALESCE(SUM(CASE WHEN m.tipo = 'carico' THEN m.quantita WHEN m.tipo = 'scarico' THEN -m.quantita END), 0) AS giacenza,
  (COALESCE(SUM(CASE WHEN m.tipo = 'carico' THEN m.quantita WHEN m.tipo = 'scarico' THEN -m.quantita END), 0) < a.scorta_minima) AS sotto_scorta
FROM public.articoli a
LEFT JOIN public.movimenti_magazzino m ON m.articolo_id = a.id
GROUP BY a.id;
GRANT SELECT ON public.magazzino_giacenze TO authenticated;
GRANT SELECT ON public.magazzino_giacenze TO service_role;

-- FUNZIONI
CREATE OR REPLACE FUNCTION public.magazzino_prossimo_numero(_org uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(numero), 0) + 1 FROM public.ordini WHERE org_id = _org;
$$;

CREATE OR REPLACE FUNCTION public.magazzino_convalida_righe(_ordine_id uuid, _riga_ids uuid[])
RETURNS SETOF public.ordini LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_forn uuid; v_new uuid; v_rest int;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  SELECT org_id INTO v_org FROM public.ordini WHERE id = _ordine_id AND stato = 'bozza';
  IF v_org IS NULL OR v_org <> public.get_user_org_id(auth.uid()) THEN RAISE EXCEPTION 'Ordine non trovato'; END IF;
  IF _riga_ids IS NULL OR array_length(_riga_ids, 1) IS NULL THEN RAISE EXCEPTION 'Nessuna riga selezionata'; END IF;

  FOR v_forn IN
    SELECT DISTINCT fornitore_id FROM public.ordini_righe WHERE ordine_id = _ordine_id AND id = ANY(_riga_ids)
  LOOP
    INSERT INTO public.ordini (org_id, numero, stato, fornitore_id, created_by, note)
    VALUES (v_org, public.magazzino_prossimo_numero(v_org), 'convalidato', v_forn, auth.uid(),
            (SELECT note FROM public.ordini WHERE id = _ordine_id))
    RETURNING id INTO v_new;

    UPDATE public.ordini_righe SET ordine_id = v_new
    WHERE ordine_id = _ordine_id AND id = ANY(_riga_ids)
      AND fornitore_id IS NOT DISTINCT FROM v_forn;

    RETURN QUERY SELECT * FROM public.ordini WHERE id = v_new;
  END LOOP;

  SELECT count(*) INTO v_rest FROM public.ordini_righe WHERE ordine_id = _ordine_id;
  IF v_rest = 0 THEN DELETE FROM public.ordini WHERE id = _ordine_id; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.magazzino_ricevi_ordine(_ordine_id uuid)
RETURNS public.ordini LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord public.ordini;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  SELECT * INTO v_ord FROM public.ordini WHERE id = _ordine_id;
  IF v_ord.id IS NULL OR v_ord.org_id <> public.get_user_org_id(auth.uid()) THEN RAISE EXCEPTION 'Ordine non trovato'; END IF;
  IF v_ord.stato <> 'convalidato' THEN RAISE EXCEPTION 'Solo gli ordini convalidati possono essere ricevuti'; END IF;

  INSERT INTO public.movimenti_magazzino (org_id, articolo_id, tipo, quantita, data, ordine_riga_id, veicolo_id, consumo_interno, motivo, note, created_by)
  SELECT r.org_id, r.articolo_id, 'carico', r.quantita, CURRENT_DATE, r.id, r.veicolo_id,
         r.tipo_consumo = 'consumo_interno', 'ordine', r.note, auth.uid()
  FROM public.ordini_righe r
  WHERE r.ordine_id = _ordine_id
  ON CONFLICT DO NOTHING;

  UPDATE public.ordini SET stato = 'ricevuto', ricevuto_at = now() WHERE id = _ordine_id RETURNING * INTO v_ord;
  RETURN v_ord;
END $$;

CREATE OR REPLACE FUNCTION public.magazzino_annulla_ordine(_ordine_id uuid)
RETURNS public.ordini LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord public.ordini;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  SELECT * INTO v_ord FROM public.ordini WHERE id = _ordine_id;
  IF v_ord.id IS NULL OR v_ord.org_id <> public.get_user_org_id(auth.uid()) THEN RAISE EXCEPTION 'Ordine non trovato'; END IF;
  IF v_ord.stato = 'ricevuto' THEN RAISE EXCEPTION 'Un ordine già ricevuto non può essere annullato'; END IF;
  UPDATE public.ordini SET stato = 'annullato' WHERE id = _ordine_id RETURNING * INTO v_ord;
  RETURN v_ord;
END $$;

CREATE OR REPLACE FUNCTION public.magazzino_registra_scarico(
  _articolo_id uuid, _quantita numeric, _data date, _veicolo_id uuid, _consumo_interno boolean, _note text, _forza boolean DEFAULT false)
RETURNS public.movimenti_magazzino LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_giac numeric; v_mov public.movimenti_magazzino;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  v_org := public.get_user_org_id(auth.uid());
  IF NOT EXISTS (SELECT 1 FROM public.articoli WHERE id = _articolo_id AND org_id = v_org) THEN RAISE EXCEPTION 'Articolo non trovato'; END IF;
  IF _quantita IS NULL OR _quantita <= 0 THEN RAISE EXCEPTION 'Quantità non valida'; END IF;
  IF _veicolo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.veicoli WHERE id = _veicolo_id AND org_id = v_org) THEN RAISE EXCEPTION 'Veicolo non trovato'; END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'carico' THEN quantita ELSE -quantita END), 0) INTO v_giac
  FROM public.movimenti_magazzino WHERE articolo_id = _articolo_id;

  IF _quantita > v_giac AND NOT COALESCE(_forza, false) THEN
    RAISE EXCEPTION 'Giacenza insufficiente (disponibili %)', v_giac;
  END IF;

  INSERT INTO public.movimenti_magazzino (org_id, articolo_id, tipo, quantita, data, veicolo_id, consumo_interno, note, anomalia, created_by)
  VALUES (v_org, _articolo_id, 'scarico', _quantita, COALESCE(_data, CURRENT_DATE), _veicolo_id,
          COALESCE(_consumo_interno, false), _note, _quantita > v_giac, auth.uid())
  RETURNING * INTO v_mov;
  RETURN v_mov;
END $$;

CREATE OR REPLACE FUNCTION public.magazzino_registra_carico_manuale(
  _articolo_id uuid, _quantita numeric, _data date, _motivo public.magazzino_carico_motivo, _note text)
RETURNS public.movimenti_magazzino LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_mov public.movimenti_magazzino;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  v_org := public.get_user_org_id(auth.uid());
  IF NOT EXISTS (SELECT 1 FROM public.articoli WHERE id = _articolo_id AND org_id = v_org) THEN RAISE EXCEPTION 'Articolo non trovato'; END IF;
  IF _quantita IS NULL OR _quantita <= 0 THEN RAISE EXCEPTION 'Quantità non valida'; END IF;

  INSERT INTO public.movimenti_magazzino (org_id, articolo_id, tipo, quantita, data, motivo, note, created_by)
  VALUES (v_org, _articolo_id, 'carico', _quantita, COALESCE(_data, CURRENT_DATE), COALESCE(_motivo, 'altro'), _note, auth.uid())
  RETURNING * INTO v_mov;
  RETURN v_mov;
END $$;
