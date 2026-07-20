
UPDATE public.autisti SET auth_user_id = NULL, email = NULL, password_cambiata_at = NULL WHERE id = 'b1cf2a86-0d49-43dd-bd24-e89f41ed4f21';
DELETE FROM public.password_fingerprints WHERE owner_type='autista' AND owner_id='b1cf2a86-0d49-43dd-bd24-e89f41ed4f21';
DELETE FROM auth.users WHERE id = 'fb8f10cd-2133-4423-a5b1-bc2b5b3626bf';
