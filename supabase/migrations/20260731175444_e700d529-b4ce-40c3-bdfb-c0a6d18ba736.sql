
ALTER TABLE public.autisti ADD COLUMN IF NOT EXISTS foto_consenso boolean NOT NULL DEFAULT false;

-- Guard: autista can only self-update contact/photo fields
CREATE OR REPLACE FUNCTION public.guard_autista_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL AND NEW.auth_user_id = auth.uid()
     AND public.get_user_org_id(auth.uid()) IS DISTINCT FROM NEW.org_id THEN
    NEW.nome := OLD.nome;
    NEW.cognome := OLD.cognome;
    NEW.codice_fiscale := OLD.codice_fiscale;
    NEW.patente := OLD.patente;
    NEW.mansione := OLD.mansione;
    NEW.prezzo_ora_ord := OLD.prezzo_ora_ord;
    NEW.prezzo_ora_straord := OLD.prezzo_ora_straord;
    NEW.numero_ore_ord := OLD.numero_ore_ord;
    NEW.trasferta := OLD.trasferta;
    NEW.trasferta_2 := OLD.trasferta_2;
    NEW.buono_pasto := OLD.buono_pasto;
    NEW.assicurazione := OLD.assicurazione;
    NEW.percentuale_notturno := OLD.percentuale_notturno;
    NEW.attivo := OLD.attivo;
    NEW.calcola_riposi := OLD.calcola_riposi;
    NEW.org_id := OLD.org_id;
    NEW.auth_user_id := OLD.auth_user_id;
    NEW.password := OLD.password;
    NEW.max_riposi_mese := OLD.max_riposi_mese;
    NEW.max_ferie_mese := OLD.max_ferie_mese;
    NEW.max_permessi_mese := OLD.max_permessi_mese;
    NEW.note := OLD.note;

    IF (NEW.telefono IS DISTINCT FROM OLD.telefono)
       OR (NEW.cellulare IS DISTINCT FROM OLD.cellulare)
       OR (NEW.email IS DISTINCT FROM OLD.email)
       OR (NEW.foto_url IS DISTINCT FROM OLD.foto_url)
       OR (NEW.foto_consenso IS DISTINCT FROM OLD.foto_consenso) THEN
      INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
      VALUES (NEW.org_id, 'autista_profilo',
              'Profilo autista aggiornato',
              coalesce(NEW.nome,'') || ' ' || coalesce(NEW.cognome,'') || ' ha aggiornato i propri dati di contatto o la foto profilo.',
              NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_autista_self_update ON public.autisti;
CREATE TRIGGER trg_guard_autista_self_update
BEFORE UPDATE ON public.autisti
FOR EACH ROW EXECUTE FUNCTION public.guard_autista_self_update();

-- Link utili
CREATE TABLE IF NOT EXISTS public.link_utili (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  etichetta text NOT NULL,
  url text NOT NULL,
  icona text,
  ordine integer NOT NULL DEFAULT 0,
  evidenza boolean NOT NULL DEFAULT false,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_utili TO authenticated;
GRANT ALL ON public.link_utili TO service_role;
ALTER TABLE public.link_utili ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage link_utili"
ON public.link_utili FOR ALL TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()))
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Autisti view link_utili"
ON public.link_utili FOR SELECT TO authenticated
USING (attivo AND org_id = public.get_autista_org_id(auth.uid()));

CREATE TRIGGER trg_link_utili_updated
BEFORE UPDATE ON public.link_utili
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Preferenze autista
CREATE TABLE IF NOT EXISTS public.autisti_preferenze (
  autista_id uuid PRIMARY KEY REFERENCES public.autisti(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tasti jsonb NOT NULL DEFAULT '[]'::jsonb,
  notifiche jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autisti_preferenze TO authenticated;
GRANT ALL ON public.autisti_preferenze TO service_role;
ALTER TABLE public.autisti_preferenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autista manages own preferenze"
ON public.autisti_preferenze FOR ALL TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()))
WITH CHECK (autista_id = public.get_autista_id(auth.uid()) AND org_id = public.get_autista_org_id(auth.uid()));

CREATE TRIGGER trg_autisti_preferenze_updated
BEFORE UPDATE ON public.autisti_preferenze
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
