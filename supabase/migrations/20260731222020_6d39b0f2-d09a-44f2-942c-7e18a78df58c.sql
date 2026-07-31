ALTER VIEW public.servizi_autista_view SET (security_invoker = false);
REVOKE ALL ON public.servizi_autista_view FROM anon;
GRANT SELECT ON public.servizi_autista_view TO authenticated;