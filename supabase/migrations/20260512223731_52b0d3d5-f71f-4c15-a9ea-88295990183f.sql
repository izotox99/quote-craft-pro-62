DROP TRIGGER IF EXISTS enforce_clients_org_id ON public.clients;
DROP TRIGGER IF EXISTS enforce_org_id ON public.clients;

CREATE TRIGGER enforce_clients_org_id
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_org_id();