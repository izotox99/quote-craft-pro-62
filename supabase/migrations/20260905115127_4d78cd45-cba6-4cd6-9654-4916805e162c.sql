-- 1. stato enum ordini
ALTER TYPE public.magazzino_ordine_stato ADD VALUE IF NOT EXISTS 'parzialmente_ricevuto';

-- 2. righe ordine: stato individuale
ALTER TABLE public.ordini_righe
  ADD COLUMN IF NOT EXISTS stato_ricezione text NOT NULL DEFAULT 'in_attesa',
  ADD COLUMN IF NOT EXISTS quantita_ricevuta numeric,
  ADD COLUMN IF NOT EXISTS ricevuta_at timestamptz;

ALTER TABLE public.ordini_righe DROP CONSTRAINT IF EXISTS ordini_righe_stato_ricezione_chk;
ALTER TABLE public.ordini_righe ADD CONSTRAINT ordini_righe_stato_ricezione_chk
  CHECK (stato_ricezione IN ('in_attesa','confermata','rimossa'));

UPDATE public.ordini_righe r SET stato_ricezione = 'confermata',
   quantita_ricevuta = COALESCE(r.quantita_ricevuta, r.quantita)
 FROM public.ordini o WHERE o.id = r.ordine_id AND o.stato = 'ricevuto' AND r.stato_ricezione = 'in_attesa';

-- 3. storico prezzi fornitore
CREATE TABLE IF NOT EXISTS public.articoli_prezzi_storico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  articolo_id uuid NOT NULL REFERENCES public.articoli(id) ON DELETE CASCADE,
  fornitore_id uuid REFERENCES public.fornitori_magazzino(id) ON DELETE SET NULL,
  ordine_riga_id uuid REFERENCES public.ordini_righe(id) ON DELETE SET NULL,
  prezzo_unitario numeric NOT NULL,
  quantita numeric,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articoli_prezzi_storico TO authenticated;
GRANT ALL ON public.articoli_prezzi_storico TO service_role;
ALTER TABLE public.articoli_prezzi_storico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org read prezzi storico" ON public.articoli_prezzi_storico;
CREATE POLICY "org read prezzi storico" ON public.articoli_prezzi_storico
  FOR SELECT TO authenticated USING (org_id = public.get_user_org_id(auth.uid()));
DROP POLICY IF EXISTS "org write prezzi storico" ON public.articoli_prezzi_storico;
CREATE POLICY "org write prezzi storico" ON public.articoli_prezzi_storico
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));
DROP TRIGGER IF EXISTS trg_prezzi_storico_org ON public.articoli_prezzi_storico;
CREATE TRIGGER trg_prezzi_storico_org BEFORE INSERT ON public.articoli_prezzi_storico
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
CREATE INDEX IF NOT EXISTS idx_prezzi_storico_art ON public.articoli_prezzi_storico(articolo_id, data DESC);

-- 4. manutenzione straordinaria: km manutenzione + fornitore anagrafica
ALTER TABLE public.veicoli_manutenzione_straord
  ADD COLUMN IF NOT EXISTS km_manutenzione integer,
  ADD COLUMN IF NOT EXISTS fornitore_id uuid REFERENCES public.fornitori_magazzino(id) ON DELETE SET NULL;

-- 5. tipi riparazione configurabili
ALTER TABLE public.config_tipi_costo DROP CONSTRAINT IF EXISTS config_tipi_costo_ambito_check;
ALTER TABLE public.config_tipi_costo ADD CONSTRAINT config_tipi_costo_ambito_check
  CHECK (ambito IN ('autista','veicolo','riparazione'));

CREATE OR REPLACE FUNCTION public.seed_config_tipi_costo(_org uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  INSERT INTO public.config_tipi_costo (org_id, ambito, valore, ricorrente, ordine)
  VALUES
    (_org, 'autista', 'Patente', true, 1),
    (_org, 'autista', 'Patente K', true, 2),
    (_org, 'autista', 'Permesso Civitavecchia', true, 3),
    (_org, 'autista', 'Visita medica', true, 4),
    (_org, 'autista', 'Altro', false, 5),
    (_org, 'veicolo', 'Bollo', true, 1),
    (_org, 'veicolo', 'Assicurazione', true, 2),
    (_org, 'veicolo', 'Licenza', true, 3),
    (_org, 'veicolo', 'Permesso ZTL', true, 4),
    (_org, 'veicolo', 'Rata finanziamento', true, 5),
    (_org, 'riparazione', 'Acquisto ricambio', false, 1),
    (_org, 'riparazione', 'Cambio gomme', false, 2),
    (_org, 'riparazione', 'Carroattrezzi', false, 3),
    (_org, 'riparazione', 'Convergenza', false, 4),
    (_org, 'riparazione', 'Inversione gomme', false, 5),
    (_org, 'riparazione', 'Riparazione carrozzeria', false, 6),
    (_org, 'riparazione', 'Riparazione elettrica', false, 7),
    (_org, 'riparazione', 'Riparazione meccanica', false, 8),
    (_org, 'riparazione', 'Riparazione gomma', false, 9),
    (_org, 'riparazione', 'Ricarica A/C', false, 10)
  ON CONFLICT (org_id, ambito, valore) DO NOTHING;
$function$;
REVOKE ALL ON FUNCTION public.seed_config_tipi_costo(uuid) FROM public;

DO $$ DECLARE o uuid; BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP PERFORM public.seed_config_tipi_costo(o); END LOOP;
END $$;
