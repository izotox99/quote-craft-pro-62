REVOKE EXECUTE ON FUNCTION public.seed_config_tipi_costo(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.scadenze_costi_process() FROM anon, authenticated, public;
REVOKE SELECT ON public.scadenze_notificate FROM authenticated;