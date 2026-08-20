
REVOKE EXECUTE ON FUNCTION public.magazzino_prossimo_numero(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.magazzino_convalida_righe(uuid, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.magazzino_ricevi_ordine(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.magazzino_annulla_ordine(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.magazzino_registra_scarico(uuid, numeric, date, uuid, boolean, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.magazzino_registra_carico_manuale(uuid, numeric, date, public.magazzino_carico_motivo, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.magazzino_prossimo_numero(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_convalida_righe(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_ricevi_ordine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_annulla_ordine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_registra_scarico(uuid, numeric, date, uuid, boolean, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_registra_carico_manuale(uuid, numeric, date, public.magazzino_carico_motivo, text) TO authenticated;
