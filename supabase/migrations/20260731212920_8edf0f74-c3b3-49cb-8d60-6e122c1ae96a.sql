-- 1. Nuove colonne
ALTER TABLE public.veicoli
  ADD COLUMN IF NOT EXISTS intervallo_tagliando_km integer NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS tagliando_alert_stato text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS tagliando_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS tagliando_ultimo_km integer,
  ADD COLUMN IF NOT EXISTS tagliando_ultimo_at date;

-- 2. Il contachilometri non torna mai indietro (salvo correzione esplicita admin/manager)
CREATE OR REPLACE FUNCTION public.guard_veicolo_km_non_decrescente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.km_attuale IS NOT NULL AND OLD.km_attuale IS NOT NULL
     AND NEW.km_attuale < OLD.km_attuale THEN
    IF auth.uid() IS NOT NULL
       AND public.get_user_org_id(auth.uid()) = OLD.org_id
       AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
      -- correzione manuale ufficio: consentita
      NULL;
    ELSE
      NEW.km_attuale := OLD.km_attuale;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_veicolo_km ON public.veicoli;
CREATE TRIGGER trg_guard_veicolo_km
BEFORE UPDATE OF km_attuale ON public.veicoli
FOR EACH ROW EXECUTE FUNCTION public.guard_veicolo_km_non_decrescente();

-- 3. Valutazione alert tagliando
CREATE OR REPLACE FUNCTION public.veicolo_valuta_tagliando(_veicolo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v public.veicoli%ROWTYPE;
  v_diff integer;
  v_nuovo text;
BEGIN
  SELECT * INTO v FROM public.veicoli WHERE id = _veicolo_id;
  IF v.id IS NULL THEN RETURN NULL; END IF;

  IF v.km_prima_scadenza IS NULL OR v.km_attuale IS NULL OR v.attivo = false THEN
    v_nuovo := 'ok';
  ELSE
    v_diff := v.km_prima_scadenza - v.km_attuale;
    v_nuovo := CASE
      WHEN v_diff <= 0 THEN 'scaduto'
      WHEN v_diff <= 5000 THEN 'avviso'
      ELSE 'ok'
    END;
  END IF;

  IF v_nuovo IS DISTINCT FROM COALESCE(v.tagliando_alert_stato,'ok') THEN
    UPDATE public.veicoli
       SET tagliando_alert_stato = v_nuovo,
           tagliando_alert_at = now()
     WHERE id = _veicolo_id;

    IF v_nuovo = 'avviso' THEN
      INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
      VALUES (v.org_id, 'tagliando_avviso',
        'Tagliando in avvicinamento — ' || v.targa,
        'Mancano ' || v_diff || ' km al tagliando (soglia ' ||
        v.km_prima_scadenza || ' km, attuali ' || v.km_attuale || ' km).');
    ELSIF v_nuovo = 'scaduto' THEN
      INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
      VALUES (v.org_id, 'tagliando_scaduto',
        'URGENTE — Tagliando da eseguire: ' || v.targa,
        'Soglia superata di ' || abs(v_diff) || ' km (soglia ' ||
        v.km_prima_scadenza || ' km, attuali ' || v.km_attuale || ' km).');
    END IF;
  END IF;

  RETURN v_nuovo;
END $$;

REVOKE ALL ON FUNCTION public.veicolo_valuta_tagliando(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_veicolo_valuta_tagliando()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.veicolo_valuta_tagliando(NEW.id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_veicoli_tagliando ON public.veicoli;
CREATE TRIGGER trg_veicoli_tagliando
AFTER INSERT OR UPDATE OF km_attuale, km_prima_scadenza, attivo ON public.veicoli
FOR EACH ROW EXECUTE FUNCTION public.trg_veicolo_valuta_tagliando();

-- 4. Sincronizzazione km da QUALSIASI rifornimento (scanner, manuale, import)
CREATE OR REPLACE FUNCTION public.sync_km_da_rifornimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_km_attuale integer;
  v_targa text;
BEGIN
  IF NEW.km IS NULL THEN RETURN NEW; END IF;

  SELECT km_attuale, targa INTO v_km_attuale, v_targa
    FROM public.veicoli WHERE id = NEW.veicolo_id;

  IF v_km_attuale IS NULL OR NEW.km > v_km_attuale THEN
    UPDATE public.veicoli
       SET km_attuale = NEW.km, updated_at = now()
     WHERE id = NEW.veicolo_id;
  ELSIF NEW.km < v_km_attuale THEN
    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
    VALUES (NEW.org_id, 'km_anomalia',
      'Km rifornimento incoerenti — ' || COALESCE(v_targa,''),
      'Registrati ' || NEW.km || ' km, inferiori ai ' || v_km_attuale ||
      ' km del mezzo. Il contachilometri NON è stato modificato: verificare lo scontrino.',
      NEW.autista_id);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gasolio_sync_km ON public.veicoli_gasolio;
CREATE TRIGGER trg_gasolio_sync_km
AFTER INSERT OR UPDATE OF km ON public.veicoli_gasolio
FOR EACH ROW EXECUTE FUNCTION public.sync_km_da_rifornimento();

-- 5. Pulsante "Tagliando eseguito"
CREATE OR REPLACE FUNCTION public.veicolo_tagliando_eseguito(_veicolo_id uuid, _km integer DEFAULT NULL, _intervallo integer DEFAULT NULL)
RETURNS public.veicoli
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v public.veicoli%ROWTYPE;
  v_org uuid := public.get_user_org_id(auth.uid());
  v_km integer;
  v_int integer;
BEGIN
  SELECT * INTO v FROM public.veicoli WHERE id = _veicolo_id;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Veicolo non trovato' USING ERRCODE='22023';
  END IF;
  IF v_org IS NULL OR v_org <> v.org_id
     OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;

  v_km := COALESCE(_km, v.km_attuale);
  IF v_km IS NULL THEN
    RAISE EXCEPTION 'Km attuali mancanti: inseriscili prima di registrare il tagliando' USING ERRCODE='22023';
  END IF;
  v_int := GREATEST(COALESCE(_intervallo, v.intervallo_tagliando_km, 20000), 1);

  UPDATE public.veicoli
     SET km_prima_scadenza = v_km + v_int,
         intervallo_tagliando_km = v_int,
         tagliando_ultimo_km = v_km,
         tagliando_ultimo_at = current_date,
         updated_at = now()
   WHERE id = _veicolo_id
  RETURNING * INTO v;

  PERFORM public.veicolo_valuta_tagliando(_veicolo_id);
  SELECT * INTO v FROM public.veicoli WHERE id = _veicolo_id;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.veicolo_tagliando_eseguito(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.veicolo_tagliando_eseguito(uuid, integer, integer) TO authenticated;

-- 6. Controllo giornaliero
CREATE OR REPLACE FUNCTION public.veicoli_check_tagliandi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.veicoli WHERE attivo = true LOOP
    PERFORM public.veicolo_valuta_tagliando(r.id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.veicoli_check_tagliandi() FROM PUBLIC, anon, authenticated;