
REVOKE EXECUTE ON FUNCTION public.presenza_apri_turno(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.presenza_chiudi_turno(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.presenza_correggi_oggi(uuid, timestamptz, timestamptz, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calcola_compenso_autista(uuid, date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_ore_changes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_presenze_changes() FROM anon, public;
