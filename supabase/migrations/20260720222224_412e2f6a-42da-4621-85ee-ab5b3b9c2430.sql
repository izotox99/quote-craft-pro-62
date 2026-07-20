
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.trasferta_tipo AS ENUM ('nessuna','trasferta','trasferta_2');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipologia_partenza AS ENUM ('altro_luogo','aeroporto','civitavecchia','stazione');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ AUTISTI_PRESENZE ============
CREATE TABLE public.autisti_presenze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  data date NOT NULL,
  inizio_at timestamptz NOT NULL,
  fine_at timestamptz,
  note text,
  corretta_da uuid,
  corretta_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presenze_fine_dopo_inizio CHECK (fine_at IS NULL OR fine_at > inizio_at)
);

CREATE INDEX idx_presenze_autista_data ON public.autisti_presenze(autista_id, data DESC);
CREATE INDEX idx_presenze_org_data ON public.autisti_presenze(org_id, data DESC);
-- un solo turno aperto per autista
CREATE UNIQUE INDEX uniq_presenza_aperta_per_autista
  ON public.autisti_presenze(autista_id) WHERE fine_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autisti_presenze TO authenticated;
GRANT ALL ON public.autisti_presenze TO service_role;
ALTER TABLE public.autisti_presenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autista vede solo le sue presenze"
  ON public.autisti_presenze FOR SELECT TO authenticated
  USING (
    autista_id = public.get_autista_id(auth.uid())
    OR (
      org_id = public.get_user_org_id(auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    )
  );

CREATE POLICY "Autista gestisce solo le sue presenze"
  ON public.autisti_presenze FOR ALL TO authenticated
  USING (
    autista_id = public.get_autista_id(auth.uid())
    OR (
      org_id = public.get_user_org_id(auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    )
  )
  WITH CHECK (
    autista_id = public.get_autista_id(auth.uid())
    OR (
      org_id = public.get_user_org_id(auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    )
  );

CREATE TRIGGER trg_presenze_updated_at
  BEFORE UPDATE ON public.autisti_presenze
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTISTI_PRESENZE_MODIFICHE ============
CREATE TABLE public.autisti_presenze_modifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presenza_id uuid NOT NULL REFERENCES public.autisti_presenze(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text
);
CREATE INDEX idx_pres_mod_presenza ON public.autisti_presenze_modifiche(presenza_id, changed_at DESC);

GRANT SELECT, INSERT ON public.autisti_presenze_modifiche TO authenticated;
GRANT ALL ON public.autisti_presenze_modifiche TO service_role;
ALTER TABLE public.autisti_presenze_modifiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modifiche presenze visibili all'autista e all'ufficio"
  ON public.autisti_presenze_modifiche FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.autisti_presenze p
      WHERE p.id = presenza_id
        AND (
          p.autista_id = public.get_autista_id(auth.uid())
          OR (
            p.org_id = public.get_user_org_id(auth.uid())
            AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
          )
        )
    )
  );

-- trigger di log
CREATE OR REPLACE FUNCTION public.log_presenze_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f text; old_v text; new_v text;
BEGIN
  FOREACH f IN ARRAY ARRAY['inizio_at','fine_at','note'] LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f)
      INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.autisti_presenze_modifiche(presenza_id, org_id, changed_by, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.org_id, auth.uid(), f, old_v, new_v);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_presenze_log
  AFTER UPDATE ON public.autisti_presenze
  FOR EACH ROW EXECUTE FUNCTION public.log_presenze_changes();

-- ============ AUTISTI_ORE ============
CREATE TABLE public.autisti_ore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  data date NOT NULL,
  servizio_id uuid REFERENCES public.servizi(id) ON DELETE SET NULL,
  ore_ordinarie numeric(5,2) NOT NULL DEFAULT 0 CHECK (ore_ordinarie >= 0 AND ore_ordinarie <= 24),
  ore_straordinarie numeric(5,2) NOT NULL DEFAULT 0 CHECK (ore_straordinarie >= 0 AND ore_straordinarie <= 24),
  ore_notturne numeric(5,2) NOT NULL DEFAULT 0 CHECK (ore_notturne >= 0 AND ore_notturne <= 24),
  tipologia_partenza public.tipologia_partenza,
  trasferta_tipo public.trasferta_tipo NOT NULL DEFAULT 'nessuna',
  buono_pasto boolean NOT NULL DEFAULT false,
  note text,
  corretta_da uuid,
  corretta_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ore_autista_data ON public.autisti_ore(autista_id, data DESC);
CREATE INDEX idx_ore_org_data ON public.autisti_ore(org_id, data DESC);
CREATE INDEX idx_ore_servizio ON public.autisti_ore(servizio_id) WHERE servizio_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autisti_ore TO authenticated;
GRANT ALL ON public.autisti_ore TO service_role;
ALTER TABLE public.autisti_ore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autista vede solo le sue ore"
  ON public.autisti_ore FOR SELECT TO authenticated
  USING (
    autista_id = public.get_autista_id(auth.uid())
    OR (
      org_id = public.get_user_org_id(auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    )
  );

CREATE POLICY "Autista gestisce solo le sue ore"
  ON public.autisti_ore FOR ALL TO authenticated
  USING (
    autista_id = public.get_autista_id(auth.uid())
    OR (
      org_id = public.get_user_org_id(auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    )
  )
  WITH CHECK (
    autista_id = public.get_autista_id(auth.uid())
    OR (
      org_id = public.get_user_org_id(auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    )
  );

CREATE TRIGGER trg_ore_updated_at
  BEFORE UPDATE ON public.autisti_ore
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTISTI_ORE_MODIFICHE ============
CREATE TABLE public.autisti_ore_modifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ore_id uuid NOT NULL REFERENCES public.autisti_ore(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text
);
CREATE INDEX idx_ore_mod_ore ON public.autisti_ore_modifiche(ore_id, changed_at DESC);

GRANT SELECT, INSERT ON public.autisti_ore_modifiche TO authenticated;
GRANT ALL ON public.autisti_ore_modifiche TO service_role;
ALTER TABLE public.autisti_ore_modifiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modifiche ore visibili all'autista e all'ufficio"
  ON public.autisti_ore_modifiche FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.autisti_ore o
      WHERE o.id = ore_id
        AND (
          o.autista_id = public.get_autista_id(auth.uid())
          OR (
            o.org_id = public.get_user_org_id(auth.uid())
            AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.log_ore_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f text; old_v text; new_v text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'ore_ordinarie','ore_straordinarie','ore_notturne',
    'tipologia_partenza','trasferta_tipo','buono_pasto','note','data'
  ] LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f)
      INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.autisti_ore_modifiche(ore_id, org_id, changed_by, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.org_id, auth.uid(), f, old_v, new_v);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ore_log
  AFTER UPDATE ON public.autisti_ore
  FOR EACH ROW EXECUTE FUNCTION public.log_ore_changes();

-- ============ RPC PRESENZA (autista) ============
CREATE OR REPLACE FUNCTION public.presenza_apri_turno(_note text DEFAULT NULL)
RETURNS public.autisti_presenze
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aut uuid := public.get_autista_id(v_uid);
  v_org uuid := public.get_autista_org_id(v_uid);
  v_row public.autisti_presenze%ROWTYPE;
BEGIN
  IF v_aut IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.autisti_presenze WHERE autista_id=v_aut AND fine_at IS NULL) THEN
    RAISE EXCEPTION 'Hai già un turno aperto' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.autisti_presenze(autista_id, org_id, data, inizio_at, note)
  VALUES (v_aut, v_org, (now() AT TIME ZONE 'Europe/Rome')::date, now(), _note)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.presenza_chiudi_turno(_note text DEFAULT NULL)
RETURNS public.autisti_presenze
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aut uuid := public.get_autista_id(v_uid);
  v_row public.autisti_presenze%ROWTYPE;
BEGIN
  IF v_aut IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  UPDATE public.autisti_presenze
     SET fine_at = now(),
         note = COALESCE(_note, note)
   WHERE autista_id=v_aut AND fine_at IS NULL
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Nessun turno aperto' USING ERRCODE='22023';
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.presenza_correggi_oggi(
  _presenza_id uuid,
  _inizio_at timestamptz DEFAULT NULL,
  _fine_at timestamptz DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS public.autisti_presenze
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aut uuid := public.get_autista_id(v_uid);
  v_row public.autisti_presenze%ROWTYPE;
  v_is_office boolean;
  v_today date := (now() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
  SELECT * INTO v_row FROM public.autisti_presenze WHERE id=_presenza_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Turno non trovato' USING ERRCODE='22023';
  END IF;

  v_is_office := (v_row.org_id = public.get_user_org_id(v_uid))
                 AND (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager'));

  IF v_row.autista_id = v_aut THEN
    -- autista può correggere solo la giornata corrente
    IF v_row.data <> v_today THEN
      RAISE EXCEPTION 'Puoi correggere solo la giornata corrente' USING ERRCODE='42501';
    END IF;
  ELSIF NOT v_is_office THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;

  UPDATE public.autisti_presenze
     SET inizio_at = COALESCE(_inizio_at, inizio_at),
         fine_at = CASE
           WHEN _fine_at IS NOT NULL THEN _fine_at
           ELSE fine_at
         END,
         note = COALESCE(_note, note),
         corretta_da = v_uid,
         corretta_at = now()
   WHERE id = _presenza_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- ============ CALCOLO COMPENSO ============
CREATE OR REPLACE FUNCTION public.calcola_compenso_autista(
  _autista_id uuid,
  _from date,
  _to date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.autisti%ROWTYPE;
  v_ord numeric := 0;
  v_str numeric := 0;
  v_not numeric := 0;
  v_tr numeric := 0;
  v_tr2 numeric := 0;
  v_bp numeric := 0;
  v_bp_cnt int := 0;
  v_tr_cnt int := 0;
  v_tr2_cnt int := 0;
  v_maggior numeric;
  v_comp_ord numeric;
  v_comp_str numeric;
  v_comp_not numeric;
  v_comp_tr numeric;
  v_comp_tr2 numeric;
  v_comp_bp numeric;
  v_totale numeric;
BEGIN
  SELECT * INTO v_a FROM public.autisti WHERE id=_autista_id;
  IF v_a.id IS NULL THEN
    RAISE EXCEPTION 'Autista non trovato' USING ERRCODE='22023';
  END IF;

  -- autorizzazione: se stesso o ufficio della sua org
  IF NOT (
    v_a.id = public.get_autista_id(v_uid)
    OR (
      v_a.org_id = public.get_user_org_id(v_uid)
      AND (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager'))
    )
  ) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;

  SELECT
    COALESCE(SUM(ore_ordinarie),0),
    COALESCE(SUM(ore_straordinarie),0),
    COALESCE(SUM(ore_notturne),0),
    COALESCE(SUM(CASE WHEN trasferta_tipo='trasferta' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN trasferta_tipo='trasferta_2' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN buono_pasto THEN 1 ELSE 0 END),0)
  INTO v_ord, v_str, v_not, v_tr_cnt, v_tr2_cnt, v_bp_cnt
  FROM public.autisti_ore
  WHERE autista_id = _autista_id
    AND data >= _from AND data <= _to;

  v_maggior := 1 + COALESCE(v_a.percentuale_notturno,0)/100.0;
  v_comp_ord := ROUND(v_ord * COALESCE(v_a.prezzo_ora_ord,0), 2);
  v_comp_str := ROUND(v_str * COALESCE(v_a.prezzo_ora_straord,0), 2);
  v_comp_not := ROUND(v_not * COALESCE(v_a.prezzo_ora_ord,0) * v_maggior, 2);
  v_comp_tr  := ROUND(v_tr_cnt * COALESCE(v_a.trasferta,0), 2);
  v_comp_tr2 := ROUND(v_tr2_cnt * COALESCE(v_a.trasferta_2,0), 2);
  v_comp_bp  := ROUND(v_bp_cnt * COALESCE(v_a.buono_pasto,0), 2);
  v_totale := v_comp_ord + v_comp_str + v_comp_not + v_comp_tr + v_comp_tr2 + v_comp_bp;

  RETURN jsonb_build_object(
    'autista_id', _autista_id,
    'periodo', jsonb_build_object('from', _from, 'to', _to),
    'parametri', jsonb_build_object(
      'prezzo_ora_ord', v_a.prezzo_ora_ord,
      'prezzo_ora_straord', v_a.prezzo_ora_straord,
      'percentuale_notturno', v_a.percentuale_notturno,
      'trasferta', v_a.trasferta,
      'trasferta_2', v_a.trasferta_2,
      'buono_pasto', v_a.buono_pasto,
      'assicurazione', v_a.assicurazione
    ),
    'quantita', jsonb_build_object(
      'ore_ordinarie', v_ord,
      'ore_straordinarie', v_str,
      'ore_notturne', v_not,
      'trasferte', v_tr_cnt,
      'trasferte_2', v_tr2_cnt,
      'buoni_pasto', v_bp_cnt
    ),
    'voci', jsonb_build_object(
      'compenso_ordinario', v_comp_ord,
      'compenso_straordinario', v_comp_str,
      'compenso_notturno', v_comp_not,
      'compenso_trasferte', v_comp_tr,
      'compenso_trasferte_2', v_comp_tr2,
      'compenso_buoni_pasto', v_comp_bp
    ),
    'totale', v_totale
  );
END $$;

GRANT EXECUTE ON FUNCTION public.presenza_apri_turno(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.presenza_chiudi_turno(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.presenza_correggi_oggi(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcola_compenso_autista(uuid, date, date) TO authenticated;
