DROP POLICY IF EXISTS "Users can manage line items of their proposals" ON public.line_items;
CREATE POLICY "Users can manage line items of their proposals"
ON public.line_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = line_items.proposal_id AND p.user_id = auth.uid()) AND public.can_write(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = line_items.proposal_id AND p.user_id = auth.uid()) AND public.can_write(auth.uid()));

DROP POLICY IF EXISTS "Users can view events for their proposals" ON public.proposal_events;
CREATE POLICY "Users can view events for their proposals"
ON public.proposal_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_events.proposal_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage versions of their proposals" ON public.proposal_versions;
CREATE POLICY "Users can manage versions of their proposals"
ON public.proposal_versions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_versions.proposal_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_versions.proposal_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Managers and admins can view org proposal versions" ON public.proposal_versions;
CREATE POLICY "Managers and admins can view org proposal versions"
ON public.proposal_versions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals p
  WHERE p.id = proposal_versions.proposal_id
    AND p.org_id = public.get_user_org_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
));