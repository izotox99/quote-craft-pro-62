ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS owner_user_id uuid;

WITH candidati AS (
  SELECT p.org_id,
         p.user_id,
         ROW_NUMBER() OVER (
           PARTITION BY p.org_id
           ORDER BY (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin')) DESC,
                    p.created_at ASC
         ) AS rn
  FROM public.profiles p
  WHERE p.org_id IS NOT NULL
)
UPDATE public.organizations o
SET owner_user_id = c.user_id
FROM candidati c
WHERE c.org_id = o.id AND c.rn = 1 AND o.owner_user_id IS NULL;