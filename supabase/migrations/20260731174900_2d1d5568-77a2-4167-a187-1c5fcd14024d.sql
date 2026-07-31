
-- ============ COMUNICAZIONI ============
CREATE TABLE public.comunicazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  titolo text NOT NULL,
  testo text NOT NULL,
  priorita text NOT NULL DEFAULT 'normale' CHECK (priorita IN ('normale','importante','urgente')),
  allegato_path text,
  allegato_nome text,
  destinatari text NOT NULL DEFAULT 'tutti' CHECK (destinatari IN ('tutti','singolo')),
  autista_id uuid REFERENCES public.autisti(id) ON DELETE CASCADE,
  created_by uuid,
  pubblicata_at timestamptz NOT NULL DEFAULT now(),
  scade_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicazioni TO authenticated;
GRANT ALL ON public.comunicazioni TO service_role;
ALTER TABLE public.comunicazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ufficio gestisce comunicazioni" ON public.comunicazioni
FOR ALL TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()))
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Autista vede le sue comunicazioni" ON public.comunicazioni
FOR SELECT TO authenticated
USING (
  org_id = public.get_autista_org_id(auth.uid())
  AND pubblicata_at <= now()
  AND (scade_at IS NULL OR scade_at > now())
  AND (destinatari = 'tutti' OR autista_id = public.get_autista_id(auth.uid()))
);

CREATE INDEX idx_comunicazioni_org_data ON public.comunicazioni(org_id, pubblicata_at DESC);
CREATE TRIGGER trg_comunicazioni_updated BEFORE UPDATE ON public.comunicazioni
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.comunicazioni_letture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicazione_id uuid NOT NULL REFERENCES public.comunicazioni(id) ON DELETE CASCADE,
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  letta_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicazione_id, autista_id)
);
GRANT SELECT, INSERT ON public.comunicazioni_letture TO authenticated;
GRANT ALL ON public.comunicazioni_letture TO service_role;
ALTER TABLE public.comunicazioni_letture ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ufficio vede letture" ON public.comunicazioni_letture
FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Autista vede le proprie letture" ON public.comunicazioni_letture
FOR SELECT TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()));

CREATE POLICY "Autista registra la propria lettura" ON public.comunicazioni_letture
FOR INSERT TO authenticated
WITH CHECK (
  autista_id = public.get_autista_id(auth.uid())
  AND org_id = public.get_autista_org_id(auth.uid())
);

-- ============ FEEDBACK ============
CREATE TABLE public.autisti_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  testo text NOT NULL,
  data date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Rome')::date,
  stato text NOT NULL DEFAULT 'nuovo' CHECK (stato IN ('nuovo','letto','gestito')),
  risposta text,
  risposto_at timestamptz,
  risposto_da uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autisti_feedback TO authenticated;
GRANT ALL ON public.autisti_feedback TO service_role;
ALTER TABLE public.autisti_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ufficio gestisce feedback" ON public.autisti_feedback
FOR ALL TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()))
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Autista vede i propri feedback" ON public.autisti_feedback
FOR SELECT TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()));

CREATE POLICY "Autista invia feedback" ON public.autisti_feedback
FOR INSERT TO authenticated
WITH CHECK (
  autista_id = public.get_autista_id(auth.uid())
  AND org_id = public.get_autista_org_id(auth.uid())
);

CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON public.autisti_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CARTE ============
CREATE TABLE public.autisti_carte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  intestazione text NOT NULL,
  ultime_quattro text CHECK (ultime_quattro IS NULL OR ultime_quattro ~ '^[0-9]{4}$'),
  scadenza text,
  plafond numeric,
  stato text NOT NULL DEFAULT 'attiva' CHECK (stato IN ('attiva','sospesa','revocata')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autisti_carte TO authenticated;
GRANT ALL ON public.autisti_carte TO service_role;
ALTER TABLE public.autisti_carte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ufficio gestisce carte" ON public.autisti_carte
FOR ALL TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()))
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Autista vede la propria carta" ON public.autisti_carte
FOR SELECT TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()));

CREATE TRIGGER trg_carte_updated BEFORE UPDATE ON public.autisti_carte
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SPESE: estensione ============
ALTER TABLE public.autisti_spese
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS foto_path text,
  ADD COLUMN IF NOT EXISTS servizio_id uuid REFERENCES public.servizi(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'ufficio';

CREATE POLICY "Autista vede le proprie spese" ON public.autisti_spese
FOR SELECT TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()));

CREATE POLICY "Autista registra le proprie spese" ON public.autisti_spese
FOR INSERT TO authenticated
WITH CHECK (
  autista_id = public.get_autista_id(auth.uid())
  AND org_id = public.get_autista_org_id(auth.uid())
  AND origine = 'autista'
);

-- ============ NOTIFICHE AUTOMATICHE ============
CREATE OR REPLACE FUNCTION public.notifica_nuovo_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nome text;
BEGIN
  SELECT nome || ' ' || cognome INTO _nome FROM public.autisti WHERE id = NEW.autista_id;
  INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
  VALUES (NEW.org_id, 'feedback_autista', 'Nuovo feedback da ' || coalesce(_nome,'autista'),
          left(NEW.testo, 200), NEW.autista_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notifica_nuovo_feedback AFTER INSERT ON public.autisti_feedback
FOR EACH ROW EXECUTE FUNCTION public.notifica_nuovo_feedback();

CREATE OR REPLACE FUNCTION public.notifica_risposta_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.risposta IS NOT NULL AND coalesce(OLD.risposta,'') <> NEW.risposta THEN
    NEW.risposto_at := now();
    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
    VALUES (NEW.org_id, 'risposta_feedback', 'Risposta al tuo feedback', left(NEW.risposta, 200), NEW.autista_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notifica_risposta_feedback BEFORE UPDATE ON public.autisti_feedback
FOR EACH ROW EXECUTE FUNCTION public.notifica_risposta_feedback();

CREATE OR REPLACE FUNCTION public.notifica_spesa_autista()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nome text;
BEGIN
  IF NEW.origine = 'autista' THEN
    SELECT nome || ' ' || cognome INTO _nome FROM public.autisti WHERE id = NEW.autista_id;
    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
    VALUES (NEW.org_id, 'spesa_autista', 'Nuova spesa da ' || coalesce(_nome,'autista'),
            coalesce(NEW.categoria,'spesa') || ' — € ' || coalesce(NEW.importo_spese, 0)::text, NEW.autista_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notifica_spesa_autista AFTER INSERT ON public.autisti_spese
FOR EACH ROW EXECUTE FUNCTION public.notifica_spesa_autista();

REVOKE EXECUTE ON FUNCTION public.notifica_nuovo_feedback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notifica_risposta_feedback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notifica_spesa_autista() FROM PUBLIC, anon, authenticated;
