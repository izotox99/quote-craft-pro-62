ALTER TABLE public.password_fingerprints DROP CONSTRAINT IF EXISTS password_fingerprints_pkey;
ALTER TABLE public.password_fingerprints ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.password_fingerprints ADD CONSTRAINT password_fingerprints_pkey PRIMARY KEY (org_id, fingerprint);