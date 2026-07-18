
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS archiviato boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_servizi_archiviato ON public.servizi(archiviato);

CREATE OR REPLACE FUNCTION public.cleanup_servizi_annullati()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.servizi
  SET archiviato = true
  WHERE stato = 'annullato'
    AND archiviato = false
    AND COALESCE(modificato_at, updated_at) < now() - interval '7 days';

  DELETE FROM public.notifiche
  WHERE created_at < now() - interval '30 days';
END;
$$;
