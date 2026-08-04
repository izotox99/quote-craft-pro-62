CREATE OR REPLACE FUNCTION public.autista_can_read_allegato(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.servizi s
    WHERE s.org_id::text = (storage.foldername(_path))[1]
      AND s.id::text = (storage.foldername(_path))[2]
      AND (s.cartello_path = _path OR s.allegato_path = _path)
      AND (
        s.autista_id = public.get_autista_id(auth.uid())
        OR s.autista_esterno_id = public.get_autista_esterno_id(auth.uid())
      )
  )
$$;