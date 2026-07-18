
REVOKE EXECUTE ON FUNCTION public.network_invite_partner(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_respond_invite(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_revoke_partnership(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_fornitore_partner_org() FROM PUBLIC, anon;
