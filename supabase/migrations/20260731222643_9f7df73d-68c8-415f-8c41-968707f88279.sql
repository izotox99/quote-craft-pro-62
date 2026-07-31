REVOKE ALL ON public.servizi_autista_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.servizi_autista_view TO authenticated;
GRANT ALL ON public.servizi_autista_view TO service_role;