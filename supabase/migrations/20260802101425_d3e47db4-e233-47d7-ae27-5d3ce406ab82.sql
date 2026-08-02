
CREATE OR REPLACE FUNCTION public.servizi_valida_campi_obbligatori()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_insert boolean := (TG_OP = 'INSERT');
  changed boolean;
BEGIN
  -- Citta
  changed := is_insert OR NEW.citta IS DISTINCT FROM OLD.citta;
  IF changed AND coalesce(btrim(NEW.citta), '') = '' THEN
    RAISE EXCEPTION 'Città di servizio obbligatoria' USING ERRCODE = 'check_violation';
  END IF;

  -- Cliente
  changed := is_insert OR NEW.client_id IS DISTINCT FROM OLD.client_id;
  IF changed AND NEW.client_id IS NULL AND NEW.fornitore_cs_id IS NULL THEN
    RAISE EXCEPTION 'Seleziona la società cliente (Per Conto di)' USING ERRCODE = 'check_violation';
  END IF;

  -- Data
  IF NEW.data_servizio IS NULL THEN
    RAISE EXCEPTION 'Data del servizio obbligatoria' USING ERRCODE = 'check_violation';
  END IF;

  -- Ora inizio
  changed := is_insert OR NEW.ora_inizio IS DISTINCT FROM OLD.ora_inizio;
  IF changed THEN
    IF coalesce(btrim(NEW.ora_inizio), '') = '' THEN
      RAISE EXCEPTION 'Ora di inizio obbligatoria' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.ora_inizio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'Ora di inizio non valida (formato HH:MM)' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Tipo veicolo
  changed := is_insert OR NEW.veicolo_tipo IS DISTINCT FROM OLD.veicolo_tipo;
  IF changed AND coalesce(btrim(NEW.veicolo_tipo), '') = '' THEN
    RAISE EXCEPTION 'Tipo di veicolo obbligatorio' USING ERRCODE = 'check_violation';
  END IF;

  -- Luoghi
  changed := is_insert OR NEW.luogo_inizio IS DISTINCT FROM OLD.luogo_inizio;
  IF changed AND coalesce(btrim(NEW.luogo_inizio), '') = '' THEN
    RAISE EXCEPTION 'Luogo di inizio obbligatorio' USING ERRCODE = 'check_violation';
  END IF;

  changed := is_insert OR NEW.luogo_fine IS DISTINCT FROM OLD.luogo_fine;
  IF changed AND coalesce(btrim(NEW.luogo_fine), '') = '' THEN
    RAISE EXCEPTION 'Luogo di fine obbligatorio' USING ERRCODE = 'check_violation';
  END IF;

  -- Pagamento
  changed := is_insert OR NEW.tipo_pagamento IS DISTINCT FROM OLD.tipo_pagamento;
  IF changed AND coalesce(btrim(NEW.tipo_pagamento), '') = '' THEN
    RAISE EXCEPTION 'Tipo di pagamento obbligatorio' USING ERRCODE = 'check_violation';
  END IF;

  -- Stato
  IF NEW.stato IS NULL THEN
    RAISE EXCEPTION 'Stato del servizio obbligatorio' USING ERRCODE = 'check_violation';
  END IF;

  -- Passeggeri / bagagli
  changed := is_insert OR NEW.n_passeggeri IS DISTINCT FROM OLD.n_passeggeri;
  IF changed AND (NEW.n_passeggeri IS NULL OR NEW.n_passeggeri < 1) THEN
    RAISE EXCEPTION 'Deve esserci almeno 1 passeggero' USING ERRCODE = 'check_violation';
  END IF;

  changed := is_insert OR NEW.n_bagagli IS DISTINCT FROM OLD.n_bagagli;
  IF changed AND (NEW.n_bagagli IS NULL OR NEW.n_bagagli < 0) THEN
    RAISE EXCEPTION 'Numero bagagli non valido' USING ERRCODE = 'check_violation';
  END IF;

  -- Tipologia: almeno una tra transfer / disposizione / tour
  changed := is_insert
    OR NEW.transfer_tipo IS DISTINCT FROM OLD.transfer_tipo
    OR NEW.disposizione_oraria IS DISTINCT FROM OLD.disposizione_oraria
    OR NEW.tour_tipo IS DISTINCT FROM OLD.tour_tipo;
  IF changed
     AND coalesce(btrim(NEW.transfer_tipo), '') = ''
     AND coalesce(btrim(NEW.disposizione_oraria), '') = ''
     AND coalesce(btrim(NEW.tour_tipo), '') = '' THEN
    RAISE EXCEPTION 'Seleziona una tipologia: Transfer, Disposizione oraria o Tour' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.servizi_valida_campi_obbligatori() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_servizi_valida_campi_obbligatori ON public.servizi;
CREATE TRIGGER trg_servizi_valida_campi_obbligatori
BEFORE INSERT OR UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.servizi_valida_campi_obbligatori();
