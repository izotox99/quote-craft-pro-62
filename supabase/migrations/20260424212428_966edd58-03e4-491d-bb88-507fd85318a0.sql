CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Se l'utente è anche un membro di un'organizzazione (admin/manager/agent),
    -- non lo trattiamo come cliente (le sue azioni sono lato dashboard).
    NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = _user_id AND org_id IS NOT NULL
    )
    AND (
      EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.client_utenze WHERE auth_user_id = _user_id AND attivo = true)
    )
$function$;