-- 1) Anagrafica operai
CREATE TABLE public.operai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  nome text NOT NULL,
  cognome text,
  mansione text,
  costo_orario numeric,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operai TO authenticated;
GRANT ALL ON public.operai TO service_role;

ALTER TABLE public.operai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read operai" ON public.operai
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org writers manage operai" ON public.operai
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

CREATE TRIGGER operai_org BEFORE INSERT ON public.operai
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE TRIGGER operai_upd BEFORE UPDATE ON public.operai
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_operai_org ON public.operai(org_id);

-- 2) Manutenzione ordinaria: intervento interno/esterno
ALTER TABLE public.veicoli_manutenzione_ord
  ADD COLUMN intervento_tipo text NOT NULL DEFAULT 'esterno',
  ADD COLUMN operaio_id uuid REFERENCES public.operai(id) ON DELETE SET NULL,
  ADD COLUMN ora_inizio time,
  ADD COLUMN ora_fine time,
  ADD COLUMN costo_materiale numeric NOT NULL DEFAULT 0,
  ADD COLUMN costo_manodopera numeric NOT NULL DEFAULT 0;

ALTER TABLE public.veicoli_manutenzione_ord
  ADD CONSTRAINT man_ord_intervento_tipo_chk CHECK (intervento_tipo IN ('interno','esterno'));

-- 3) Movimenti collegati alla manutenzione
ALTER TABLE public.movimenti_magazzino
  ADD COLUMN manutenzione_ord_id uuid REFERENCES public.veicoli_manutenzione_ord(id) ON DELETE CASCADE,
  ADD COLUMN prezzo_unitario numeric;

CREATE INDEX idx_mov_manutenzione_ord ON public.movimenti_magazzino(manutenzione_ord_id);

-- 4) Salvataggio manutenzione + sincronizzazione scarichi magazzino
CREATE OR REPLACE FUNCTION public.manutenzione_ord_salva(
  _id uuid,
  _veicolo_id uuid,
  _data date,
  _km integer,
  _intervento_tipo text,
  _tipo text,
  _note text,
  _ricambi text,
  _fornitore text,
  _operaio_id uuid,
  _ora_inizio time,
  _ora_fine time,
  _righe jsonb DEFAULT '[]'::jsonb,
  _totale_esterno numeric DEFAULT NULL,
  _forza boolean DEFAULT false
) RETURNS public.veicoli_manutenzione_ord
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_man public.veicoli_manutenzione_ord;
  r jsonb;
  v_art uuid;
  v_qta numeric;
  v_prezzo numeric;
  v_giac numeric;
  v_materiale numeric := 0;
  v_manodopera numeric := 0;
  v_ore numeric := 0;
  v_costo_orario numeric;
  v_ppc integer;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN
    RAISE EXCEPTION 'Permesso negato: sola lettura';
  END IF;
  v_org := public.get_user_org_id(auth.uid());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organizzazione non trovata'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.veicoli WHERE id = _veicolo_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'Veicolo non trovato';
  END IF;
  IF _intervento_tipo IS NULL OR _intervento_tipo NOT IN ('interno','esterno') THEN
    RAISE EXCEPTION 'Tipo intervento non valido';
  END IF;
  IF _operaio_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.operai WHERE id = _operaio_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'Operaio non trovato';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.veicoli_manutenzione_ord
      (org_id, veicolo_id, data, km, tipo, note, ricambi, fornitore,
       intervento_tipo, operaio_id, ora_inizio, ora_fine, totale)
    VALUES (v_org, _veicolo_id, COALESCE(_data, CURRENT_DATE), _km, _tipo, _note, _ricambi, _fornitore,
       _intervento_tipo, _operaio_id, _ora_inizio, _ora_fine, 0)
    RETURNING * INTO v_man;
  ELSE
    UPDATE public.veicoli_manutenzione_ord SET
      veicolo_id = _veicolo_id,
      data = COALESCE(_data, CURRENT_DATE),
      km = _km,
      tipo = _tipo,
      note = _note,
      ricambi = _ricambi,
      fornitore = _fornitore,
      intervento_tipo = _intervento_tipo,
      operaio_id = _operaio_id,
      ora_inizio = _ora_inizio,
      ora_fine = _ora_fine
    WHERE id = _id AND org_id = v_org
    RETURNING * INTO v_man;
    IF v_man.id IS NULL THEN RAISE EXCEPTION 'Manutenzione non trovata'; END IF;
  END IF;

  -- storna i movimenti precedenti collegati a questa manutenzione
  DELETE FROM public.movimenti_magazzino WHERE manutenzione_ord_id = v_man.id;

  IF _intervento_tipo = 'interno' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(_righe, '[]'::jsonb))
    LOOP
      v_art := NULLIF(r->>'articolo_id','')::uuid;
      v_qta := COALESCE((r->>'quantita')::numeric, 0);
      v_prezzo := NULLIF(r->>'prezzo_unitario','')::numeric;
      CONTINUE WHEN v_art IS NULL OR v_qta <= 0;

      SELECT pezzi_per_confezione, COALESCE(v_prezzo, prezzo_unitario)
        INTO v_ppc, v_prezzo
      FROM public.articoli WHERE id = v_art AND org_id = v_org;
      IF v_ppc IS NULL THEN RAISE EXCEPTION 'Articolo non trovato'; END IF;

      SELECT COALESCE(SUM(CASE WHEN tipo = 'carico' THEN quantita ELSE -quantita END), 0)
        INTO v_giac
      FROM public.movimenti_magazzino WHERE articolo_id = v_art;

      IF v_qta > v_giac AND NOT COALESCE(_forza, false) THEN
        RAISE EXCEPTION 'Giacenza insufficiente (disponibili %)', v_giac;
      END IF;

      INSERT INTO public.movimenti_magazzino
        (org_id, articolo_id, tipo, quantita, data, veicolo_id, consumo_interno,
         note, anomalia, created_by, manutenzione_ord_id, prezzo_unitario,
         confezioni, pezzi_per_confezione)
      VALUES (v_org, v_art, 'scarico', v_qta, v_man.data, _veicolo_id, false,
         'Manutenzione ordinaria', v_qta > v_giac, auth.uid(), v_man.id, v_prezzo,
         CASE WHEN v_ppc > 0 THEN v_qta / v_ppc ELSE NULL END, GREATEST(v_ppc, 1));

      v_materiale := v_materiale + v_qta * COALESCE(v_prezzo, 0);
    END LOOP;

    IF _ora_inizio IS NOT NULL AND _ora_fine IS NOT NULL THEN
      v_ore := EXTRACT(EPOCH FROM (_ora_fine - _ora_inizio)) / 3600.0;
      IF v_ore < 0 THEN v_ore := v_ore + 24; END IF;
    END IF;
    SELECT costo_orario INTO v_costo_orario FROM public.operai WHERE id = _operaio_id;
    v_manodopera := ROUND(COALESCE(v_costo_orario, 0) * v_ore, 2);
  END IF;

  UPDATE public.veicoli_manutenzione_ord SET
    costo_materiale = ROUND(v_materiale, 2),
    costo_manodopera = v_manodopera,
    totale = CASE WHEN _intervento_tipo = 'interno'
                  THEN ROUND(v_materiale, 2) + v_manodopera
                  ELSE COALESCE(_totale_esterno, 0) END
  WHERE id = v_man.id
  RETURNING * INTO v_man;

  -- aggiorna km veicolo e rivaluta alert tagliando
  IF _km IS NOT NULL THEN
    UPDATE public.veicoli
       SET km_attuale = GREATEST(COALESCE(km_attuale, 0), _km)
     WHERE id = _veicolo_id AND org_id = v_org;
  END IF;
  PERFORM public.veicolo_valuta_tagliando(_veicolo_id);

  RETURN v_man;
END $$;

GRANT EXECUTE ON FUNCTION public.manutenzione_ord_salva(uuid, uuid, date, integer, text, text, text, text, text, uuid, time, time, jsonb, numeric, boolean) TO authenticated;