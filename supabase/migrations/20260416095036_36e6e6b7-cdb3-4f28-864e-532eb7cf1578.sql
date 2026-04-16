
-- Create default organization
INSERT INTO public.organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Organizzazione Predefinita')
ON CONFLICT (id) DO NOTHING;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing auth users
INSERT INTO public.profiles (user_id, org_id)
SELECT id, '00000000-0000-0000-0000-000000000001'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;
