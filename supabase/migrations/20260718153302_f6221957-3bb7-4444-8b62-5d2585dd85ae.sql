
-- === 1. servizi financial fields guard ===
CREATE OR REPLACE FUNCTION public.guard_servizi_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') THEN
    RETURN NEW;
  END IF;
  IF NEW.prezzo IS DISTINCT FROM OLD.prezzo
     OR NEW.prezzo_fattura IS DISTINCT FROM OLD.prezzo_fattura
     OR NEW.prezzo_ccredito IS DISTINCT FROM OLD.prezzo_ccredito
     OR NEW.prezzo_contante IS DISTINCT FROM OLD.prezzo_contante
     OR NEW.incasso IS DISTINCT FROM OLD.incasso
     OR NEW.costo_cs IS DISTINCT FROM OLD.costo_cs
     OR NEW.costo_autista IS DISTINCT FROM OLD.costo_autista
     OR NEW.costo_commissione IS DISTINCT FROM OLD.costo_commissione
     OR NEW.costo_centro IS DISTINCT FROM OLD.costo_centro
     OR NEW.com_cliente IS DISTINCT FROM OLD.com_cliente
  THEN
    RAISE EXCEPTION 'Solo admin/manager possono modificare i campi economici del servizio'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_servizi_admin_fields ON public.servizi;
CREATE TRIGGER trg_guard_servizi_admin_fields
BEFORE UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.guard_servizi_admin_fields();

-- === 2. servizi_accessori: enforce cross-org isolation ===
DROP POLICY IF EXISTS "View servizi_accessori via servizio" ON public.servizi_accessori;
DROP POLICY IF EXISTS "Insert servizi_accessori via servizio" ON public.servizi_accessori;
DROP POLICY IF EXISTS "Update servizi_accessori via servizio" ON public.servizi_accessori;
DROP POLICY IF EXISTS "Delete servizi_accessori via servizio" ON public.servizi_accessori;

CREATE POLICY "View servizi_accessori scoped"
ON public.servizi_accessori FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.servizi s
  WHERE s.id = servizi_accessori.servizio_id
    AND (
      s.org_id = public.get_user_org_id(auth.uid())
      OR (public.is_client_user(auth.uid()) AND s.org_id = public.get_client_org_id(auth.uid())
          AND (
            s.client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
            OR EXISTS (
              SELECT 1 FROM public.client_utenze u
              WHERE u.auth_user_id = auth.uid() AND u.attivo = true
                AND u.parent_client_id = s.client_id
                AND (u.tipo = 'gruppo' OR (u.tipo = 'singolo' AND s.utenza_id = u.id))
            )
          )
      )
    )
));

CREATE POLICY "Insert servizi_accessori scoped"
ON public.servizi_accessori FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.servizi s
  WHERE s.id = servizi_accessori.servizio_id
    AND (
      s.org_id = public.get_user_org_id(auth.uid())
      OR (public.is_client_user(auth.uid()) AND s.org_id = public.get_client_org_id(auth.uid())
          AND (
            s.client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
            OR EXISTS (
              SELECT 1 FROM public.client_utenze u
              WHERE u.auth_user_id = auth.uid() AND u.attivo = true
                AND u.parent_client_id = s.client_id
                AND (u.tipo = 'gruppo' OR (u.tipo = 'singolo' AND s.utenza_id = u.id))
            )
          )
      )
    )
));

CREATE POLICY "Update servizi_accessori scoped"
ON public.servizi_accessori FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.servizi s
  WHERE s.id = servizi_accessori.servizio_id
    AND s.org_id = public.get_user_org_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.servizi s
  WHERE s.id = servizi_accessori.servizio_id
    AND s.org_id = public.get_user_org_id(auth.uid())
));

CREATE POLICY "Delete servizi_accessori scoped"
ON public.servizi_accessori FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.servizi s
  WHERE s.id = servizi_accessori.servizio_id
    AND s.org_id = public.get_user_org_id(auth.uid())
));

-- === 3. Storage: logos bucket ===
DROP POLICY IF EXISTS "Auth users manage logos insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth users manage logos update" ON storage.objects;
DROP POLICY IF EXISTS "Auth users manage logos delete" ON storage.objects;
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
DROP POLICY IF EXISTS "Logo images are publicly accessible" ON storage.objects;

CREATE POLICY "Auth users read own logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- (Existing "Users can upload/update/delete their own logo" policies already scope to auth.uid() folder.)

-- === 4. Storage: tariffari-autisti bucket (org-scoped by autista_esterni.org_id) ===
DROP POLICY IF EXISTS "Auth users can view tariffari" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload tariffari" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update tariffari" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete tariffari" ON storage.objects;

CREATE POLICY "Org members view tariffari-autisti"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tariffari-autisti'
  AND EXISTS (
    SELECT 1 FROM public.autisti_esterni ae
    WHERE (ae.id)::text = (storage.foldername(objects.name))[1]
      AND ae.org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members upload tariffari-autisti"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tariffari-autisti'
  AND EXISTS (
    SELECT 1 FROM public.autisti_esterni ae
    WHERE (ae.id)::text = (storage.foldername(objects.name))[1]
      AND ae.org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members update tariffari-autisti"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tariffari-autisti'
  AND EXISTS (
    SELECT 1 FROM public.autisti_esterni ae
    WHERE (ae.id)::text = (storage.foldername(objects.name))[1]
      AND ae.org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members delete tariffari-autisti"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tariffari-autisti'
  AND EXISTS (
    SELECT 1 FROM public.autisti_esterni ae
    WHERE (ae.id)::text = (storage.foldername(objects.name))[1]
      AND ae.org_id = public.get_user_org_id(auth.uid())
  )
);

-- === 5. Storage: veicoli-foto bucket (public bucket — direct URL still works; block listing + cross-org writes) ===
DROP POLICY IF EXISTS "Public read veicoli foto" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload veicoli foto" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update veicoli foto" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete veicoli foto" ON storage.objects;

CREATE POLICY "Org members view veicoli-foto"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'veicoli-foto'
  AND EXISTS (
    SELECT 1 FROM public.veicoli v
    WHERE (v.id)::text = (storage.foldername(objects.name))[1]
      AND v.org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members upload veicoli-foto"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'veicoli-foto'
  AND EXISTS (
    SELECT 1 FROM public.veicoli v
    WHERE (v.id)::text = (storage.foldername(objects.name))[1]
      AND v.org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members update veicoli-foto"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'veicoli-foto'
  AND EXISTS (
    SELECT 1 FROM public.veicoli v
    WHERE (v.id)::text = (storage.foldername(objects.name))[1]
      AND v.org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members delete veicoli-foto"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'veicoli-foto'
  AND EXISTS (
    SELECT 1 FROM public.veicoli v
    WHERE (v.id)::text = (storage.foldername(objects.name))[1]
      AND v.org_id = public.get_user_org_id(auth.uid())
  )
);

-- === 6. Revoke public execution on SECURITY DEFINER functions ===

-- Trigger-only / cron-only functions: revoke from both anon and authenticated (never called via API)
REVOKE EXECUTE ON FUNCTION public.agenda_process_promemoria() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_servizi_annullati() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_viste_single_default() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_user_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_vehicle_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_fornitore_dispatch_attivo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_network_proxy_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_servizi_admin_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_servizi_client_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.network_sync_b_to_a() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_servizio_client_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.servizi_state_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_fornitore_partner_org() FROM PUBLIC, anon, authenticated;

-- Password hashing helpers: only invoked internally by edge functions using service_role
REVOKE EXECUTE ON FUNCTION public.hash_share_password(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_utenza_password(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_share_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_utenza_password(uuid, text) FROM PUBLIC, anon, authenticated;

-- RLS helper / RPC functions: revoke from anon (never anonymous), keep authenticated
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_utenza_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_client_org_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_utenza_parent_client_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.client_portal_update_servizio(uuid, date, text, text, integer, integer, servizio_tipologia, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_dispatch_servizio(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_invite_partner(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_respond_invite(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_revoke_partnership(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_visible_orgs() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.network_withdraw_servizio(uuid) FROM PUBLIC, anon;
