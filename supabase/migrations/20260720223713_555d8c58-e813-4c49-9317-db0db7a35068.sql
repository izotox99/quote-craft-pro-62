
CREATE POLICY "Autista can view own autisti row"
  ON public.autisti
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Autista can view own autisti_esterni row"
  ON public.autisti_esterni
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Consenti all'autista di aggiornare solo ultimo_accesso_at sulla propria riga
CREATE POLICY "Autista can touch own last access autisti"
  ON public.autisti
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Autista can touch own last access autisti_esterni"
  ON public.autisti_esterni
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
