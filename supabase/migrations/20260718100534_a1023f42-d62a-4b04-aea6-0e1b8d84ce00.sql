ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS non_incassato numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS costo_centro numeric(10,2) NULL;

COMMENT ON COLUMN public.servizi.non_incassato IS 'Importo non ancora incassato (€)';
COMMENT ON COLUMN public.servizi.costo_centro IS 'Importo attribuito al centro di costo (€); l''etichetta rimane in centro_costo';