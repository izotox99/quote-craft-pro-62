
-- 1) FK: cambia servizi.client_id da SET NULL a RESTRICT
ALTER TABLE public.servizi DROP CONSTRAINT servizi_client_id_fkey;
ALTER TABLE public.servizi
  ADD CONSTRAINT servizi_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

-- 2) UNIQUE (nessun duplicato rilevato)
CREATE UNIQUE INDEX IF NOT EXISTS veicoli_org_targa_uniq
  ON public.veicoli (org_id, targa)
  WHERE targa IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_org_email_uniq
  ON public.clients (org_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- 3) INDICI
CREATE INDEX IF NOT EXISTS idx_servizi_org_data ON public.servizi (org_id, data_servizio);
CREATE INDEX IF NOT EXISTS idx_servizi_org_stato ON public.servizi (org_id, stato);
CREATE INDEX IF NOT EXISTS idx_servizi_autista_id ON public.servizi (autista_id);
CREATE INDEX IF NOT EXISTS idx_servizi_veicolo_id ON public.servizi (veicolo_id);
CREATE INDEX IF NOT EXISTS idx_servizi_fornitore_cs_id ON public.servizi (fornitore_cs_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_org_letta ON public.notifiche (org_id, letta);
