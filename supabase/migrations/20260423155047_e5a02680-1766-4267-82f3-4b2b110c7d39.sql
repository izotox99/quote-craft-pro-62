ALTER TABLE public.servizi REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.servizi;