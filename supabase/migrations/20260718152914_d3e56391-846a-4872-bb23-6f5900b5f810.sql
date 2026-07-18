
CREATE OR REPLACE FUNCTION public.agenda_process_promemoria()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_local timestamp;
  v_now_local timestamp;
  v_ora text;
  v_msg text;
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
    v_local := (r.data_inizio AT TIME ZONE 'Europe/Rome');
    v_now_local := (now() AT TIME ZONE 'Europe/Rome');
    v_ora := to_char(v_local, 'HH24:MI');

    v_msg := CASE r.minuti
      WHEN 0 THEN 'L''evento inizia adesso (ore ' || v_ora || ')'
      WHEN 15 THEN 'L''evento inizia tra 15 minuti (ore ' || v_ora || ')'
      WHEN 60 THEN 'L''evento inizia tra 1 ora (ore ' || v_ora || ')'
      WHEN 1440 THEN 'L''evento è domani alle ' || v_ora
      WHEN 10080 THEN 'L''evento è il ' || to_char(v_local, 'DD/MM') || ' alle ' || v_ora
      ELSE
        CASE
          WHEN r.minuti < 60 THEN 'L''evento inizia tra ' || r.minuti || ' minuti (ore ' || v_ora || ')'
          WHEN r.minuti < 1440 THEN 'L''evento inizia tra ' || ROUND(r.minuti/60.0)::int || ' ore (ore ' || v_ora || ')'
          ELSE 'L''evento è il ' || to_char(v_local, 'DD/MM/YYYY') || ' alle ' || v_ora
        END
    END;

    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
    VALUES (
      r.org_id,
      'agenda_promemoria',
      'Promemoria: ' || r.titolo,
      v_msg
    );

    INSERT INTO public.agenda_promemoria_inviati (evento_id, promemoria_minuti)
    VALUES (r.id, r.minuti)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$function$;
