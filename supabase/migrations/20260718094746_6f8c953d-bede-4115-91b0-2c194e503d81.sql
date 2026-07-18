UPDATE public.autisti SET password = NULL WHERE password IS NOT NULL;
UPDATE public.autisti_esterni SET password = NULL WHERE password IS NOT NULL;
COMMENT ON COLUMN public.autisti.password IS 'DEPRECATO: colonna in chiaro non piu utilizzata. Sara rimossa. Non scrivere.';
COMMENT ON COLUMN public.autisti_esterni.password IS 'DEPRECATO: colonna in chiaro non piu utilizzata. Sara rimossa. Non scrivere.';