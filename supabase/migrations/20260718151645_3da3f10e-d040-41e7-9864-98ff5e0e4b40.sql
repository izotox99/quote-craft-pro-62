
-- Enum categoria e visibilità
DO $$ BEGIN
  CREATE TYPE public.agenda_categoria AS ENUM ('appuntamento','scadenza','nota','altro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agenda_visibilita AS ENUM ('personale','organizzazione');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabella eventi
CREATE TABLE public.agenda_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titolo text NOT NULL,
  descrizione text,
  data_inizio timestamptz NOT NULL,
  data_fine timestamptz,
  tutto_il_giorno boolean NOT NULL DEFAULT false,
  categoria public.agenda_categoria NOT NULL DEFAULT 'appuntamento',
  visibilita public.agenda_visibilita NOT NULL DEFAULT 'personale',
  completato boolean NOT NULL DEFAULT false,
  servizio_id uuid REFERENCES public.servizi(id) ON DELETE SET NULL,
  promemoria_minuti integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agenda_eventi_org_data ON public.agenda_eventi(org_id, data_inizio);
CREATE INDEX idx_agenda_eventi_created_by ON public.agenda_eventi(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_eventi TO authenticated;
GRANT ALL ON public.agenda_eventi TO service_role;

ALTER TABLE public.agenda_eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agenda: view personal or org events"
  ON public.agenda_eventi FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid())
    AND (
      visibilita = 'organizzazione'
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "Agenda: insert own events in own org"
  ON public.agenda_eventi FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "Agenda: update own events or admin"
  ON public.agenda_eventi FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid())
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "Agenda: delete own events or admin"
  ON public.agenda_eventi FOR DELETE TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid())
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

-- Trigger org_id enforcement + updated_at
CREATE TRIGGER enforce_agenda_eventi_org_id
  BEFORE INSERT OR UPDATE ON public.agenda_eventi
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();

CREATE TRIGGER update_agenda_eventi_updated_at
  BEFORE UPDATE ON public.agenda_eventi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabella promemoria inviati
CREATE TABLE public.agenda_promemoria_inviati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.agenda_eventi(id) ON DELETE CASCADE,
  promemoria_minuti integer NOT NULL,
  inviato_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evento_id, promemoria_minuti)
);

CREATE INDEX idx_agenda_promemoria_inviati_evento ON public.agenda_promemoria_inviati(evento_id);

GRANT SELECT ON public.agenda_promemoria_inviati TO authenticated;
GRANT ALL ON public.agenda_promemoria_inviati TO service_role;

ALTER TABLE public.agenda_promemoria_inviati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promemoria: view own org"
  ON public.agenda_promemoria_inviati FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agenda_eventi e
    WHERE e.id = evento_id AND e.org_id = public.get_user_org_id(auth.uid())
  ));

-- Funzione che genera le notifiche di promemoria
CREATE OR REPLACE FUNCTION public.agenda_process_promemoria()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_delta_min int;
  v_label text;
BEGIN
  FOR r IN
    SELECT e.id, e.org_id, e.created_by, e.titolo, e.data_inizio, e.visibilita, m AS minuti
    FROM public.agenda_eventi e
    CROSS JOIN LATERAL unnest(e.promemoria_minuti) AS m
    WHERE e.completato = false
      AND e.data_inizio > now() - interval '5 minutes'
      AND e.data_inizio - (m || ' minutes')::interval <= now()
      AND e.data_inizio - (m || ' minutes')::interval > now() - interval '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.agenda_promemoria_inviati pi
        WHERE pi.evento_id = e.id AND pi.promemoria_minuti = m
      )
  LOOP
    v_delta_min := GREATEST(0, EXTRACT(EPOCH FROM (r.data_inizio - now()))/60)::int;
    v_label := CASE
      WHEN v_delta_min < 1 THEN 'ora'
      WHEN v_delta_min < 60 THEN v_delta_min || ' minuti'
      WHEN v_delta_min < 1440 THEN ROUND(v_delta_min/60.0)::int || ' ore'
      ELSE ROUND(v_delta_min/1440.0)::int || ' giorni'
    END;

    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
    VALUES (
      r.org_id,
      'agenda_promemoria',
      'Promemoria: ' || r.titolo,
      'Evento in agenda tra ' || v_label || ' (' || to_char(r.data_inizio, 'DD/MM/YYYY HH24:MI') || ')'
    );

    INSERT INTO public.agenda_promemoria_inviati (evento_id, promemoria_minuti)
    VALUES (r.id, r.minuti)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Schedula ogni 5 minuti
DO $$ BEGIN
  PERFORM cron.unschedule('agenda-promemoria-5min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('agenda-promemoria-5min', '*/5 * * * *', $$SELECT public.agenda_process_promemoria();$$);
