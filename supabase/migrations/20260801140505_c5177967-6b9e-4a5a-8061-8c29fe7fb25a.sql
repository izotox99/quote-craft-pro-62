
-- 1. Funzioni di supporto
CREATE OR REPLACE FUNCTION public.can_write(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin'::app_role, 'manager'::app_role, 'agent'::app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.owner_user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;

-- 2. Policy org-scoped: aggiunta can_write

-- accessori_catalogo
ALTER POLICY "Org members delete accessori_catalogo" ON public.accessori_catalogo
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members insert accessori_catalogo" ON public.accessori_catalogo
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members update accessori_catalogo" ON public.accessori_catalogo
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- agenda_eventi: viewer solo eventi personali propri
ALTER POLICY "Agenda: insert own events in own org" ON public.agenda_eventi
  WITH CHECK (
    created_by = auth.uid()
    AND org_id = get_user_org_id(auth.uid())
    AND (can_write(auth.uid()) OR visibilita = 'personale'::agenda_visibilita)
  );
ALTER POLICY "Agenda: update own events or admin" ON public.agenda_eventi
  USING (
    org_id = get_user_org_id(auth.uid())
    AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    AND (can_write(auth.uid()) OR (created_by = auth.uid() AND visibilita = 'personale'::agenda_visibilita))
  )
  WITH CHECK (
    org_id = get_user_org_id(auth.uid())
    AND (can_write(auth.uid()) OR (created_by = auth.uid() AND visibilita = 'personale'::agenda_visibilita))
  );
ALTER POLICY "Agenda: delete own events or admin" ON public.agenda_eventi
  USING (
    org_id = get_user_org_id(auth.uid())
    AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    AND (can_write(auth.uid()) OR (created_by = auth.uid() AND visibilita = 'personale'::agenda_visibilita))
  );

-- autisti
ALTER POLICY "Org members can delete autisti" ON public.autisti
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can insert autisti" ON public.autisti
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update autisti" ON public.autisti
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- autisti_carte
ALTER POLICY "Ufficio gestisce carte" ON public.autisti_carte
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- autisti_esterni
ALTER POLICY "Org members can delete autisti_esterni" ON public.autisti_esterni
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can insert autisti_esterni" ON public.autisti_esterni
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update autisti_esterni" ON public.autisti_esterni
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- autisti_feedback (ufficio)
ALTER POLICY "Ufficio gestisce feedback" ON public.autisti_feedback
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- autisti_ore (ramo ufficio)
ALTER POLICY "Autista gestisce solo le sue ore" ON public.autisti_ore
  USING (
    autista_id = get_autista_id(auth.uid())
    OR (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
        AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  )
  WITH CHECK (
    autista_id = get_autista_id(auth.uid())
    OR (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
        AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  );

-- autisti_presenze (ramo ufficio)
ALTER POLICY "Autista gestisce solo le sue presenze" ON public.autisti_presenze
  USING (
    autista_id = get_autista_id(auth.uid())
    OR (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
        AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  )
  WITH CHECK (
    autista_id = get_autista_id(auth.uid())
    OR (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
        AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  );

-- autisti_spese
ALTER POLICY "Org members can delete autisti_spese" ON public.autisti_spese
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can insert autisti_spese" ON public.autisti_spese
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update autisti_spese" ON public.autisti_spese
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- clients
ALTER POLICY "Org members can delete clients" ON public.clients
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can insert clients" ON public.clients
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update clients" ON public.clients
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- comunicazioni
ALTER POLICY "Ufficio gestisce comunicazioni" ON public.comunicazioni
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- config_assenze
ALTER POLICY "config_assenze insert admin" ON public.config_assenze
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)));
ALTER POLICY "config_assenze update admin" ON public.config_assenze
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)));

-- fornitori_cs
ALTER POLICY "Org members can delete fornitori_cs" ON public.fornitori_cs
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can insert fornitori_cs" ON public.fornitori_cs
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update fornitori_cs" ON public.fornitori_cs
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- link_utili
ALTER POLICY "Org members manage link_utili" ON public.link_utili
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- notifiche
ALTER POLICY "Org members delete notifiche" ON public.notifiche
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members update notifiche" ON public.notifiche
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- organizations
ALTER POLICY "Admins can update their organization" ON public.organizations
  USING (id = get_user_org_id(auth.uid()) AND can_write(auth.uid()) AND has_role(auth.uid(),'admin'::app_role));

-- passeggeri_rubrica (rami org)
ALTER POLICY "Org members delete passeggeri_rubrica" ON public.passeggeri_rubrica
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members insert passeggeri_rubrica" ON public.passeggeri_rubrica
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members update passeggeri_rubrica" ON public.passeggeri_rubrica
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- servizi (rami org)
ALTER POLICY "Org members can delete servizi" ON public.servizi
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- servizi_accessori (rami org)
ALTER POLICY "Delete servizi_accessori scoped" ON public.servizi_accessori
  USING (EXISTS (SELECT 1 FROM servizi s WHERE s.id = servizi_accessori.servizio_id
    AND s.org_id = get_user_org_id(auth.uid())) AND can_write(auth.uid()));
ALTER POLICY "Update servizi_accessori scoped" ON public.servizi_accessori
  USING (EXISTS (SELECT 1 FROM servizi s WHERE s.id = servizi_accessori.servizio_id
    AND s.org_id = get_user_org_id(auth.uid())) AND can_write(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM servizi s WHERE s.id = servizi_accessori.servizio_id
    AND s.org_id = get_user_org_id(auth.uid())) AND can_write(auth.uid()));

-- templates
ALTER POLICY "Admins can delete org templates" ON public.templates
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()) AND has_role(auth.uid(),'admin'::app_role));
ALTER POLICY "Org members can insert templates" ON public.templates
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update org templates" ON public.templates
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- proposals / versions / line_items
ALTER POLICY "Users can insert proposals" ON public.proposals
  WITH CHECK (auth.uid() = user_id AND org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Users can update own proposals" ON public.proposals
  USING (user_id = auth.uid() AND can_write(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND can_write(auth.uid()));
ALTER POLICY "Users can delete own proposals" ON public.proposals
  USING (user_id = auth.uid() AND can_write(auth.uid()));
ALTER POLICY "Users can manage versions of their proposals" ON public.proposal_versions
  USING (EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_versions.proposal_id
    AND p.user_id = auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Users can manage line items of their proposals" ON public.line_items
  USING (EXISTS (SELECT 1 FROM proposals p WHERE p.id = line_items.proposal_id
    AND p.user_id = auth.uid()) AND can_write(auth.uid()));

-- veicoli e correlate
ALTER POLICY "Org members can delete veicoli" ON public.veicoli
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can insert veicoli" ON public.veicoli
  WITH CHECK (get_user_org_id(auth.uid()) IS NOT NULL AND org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update veicoli" ON public.veicoli
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

ALTER POLICY "Org delete veicoli_documenti" ON public.veicoli_documenti
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org insert veicoli_documenti" ON public.veicoli_documenti
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org update veicoli_documenti" ON public.veicoli_documenti
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

ALTER POLICY "Org delete gasolio" ON public.veicoli_gasolio
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org insert gasolio" ON public.veicoli_gasolio
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org update gasolio" ON public.veicoli_gasolio
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

ALTER POLICY "Org delete man_ord" ON public.veicoli_manutenzione_ord
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org insert man_ord" ON public.veicoli_manutenzione_ord
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org update man_ord" ON public.veicoli_manutenzione_ord
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

ALTER POLICY "Org delete man_str" ON public.veicoli_manutenzione_straord
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org insert man_str" ON public.veicoli_manutenzione_straord
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org update man_str" ON public.veicoli_manutenzione_straord
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

ALTER POLICY "Org delete spese" ON public.veicoli_spese
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org insert spese" ON public.veicoli_spese
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org update spese" ON public.veicoli_spese
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
