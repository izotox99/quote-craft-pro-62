UPDATE public.servizi SET transfer_tipo = 'Interno città' WHERE transfer_tipo IN ('Transfer interno città','Transfer interno citta');
UPDATE public.servizi SET transfer_tipo = 'Da aeroporto' WHERE transfer_tipo = 'Da Aeroporto';
UPDATE public.servizi SET transfer_tipo = 'Per aeroporto' WHERE transfer_tipo = 'Per Aeroporto';
UPDATE public.servizi SET transfer_tipo = 'Da stazione' WHERE transfer_tipo = 'Da Stazione';
UPDATE public.servizi SET transfer_tipo = 'Per stazione' WHERE transfer_tipo = 'Per Stazione';
UPDATE public.servizi SET transfer_tipo = 'Da porto' WHERE transfer_tipo IN ('Da Porto','Da Civitavecchia');
UPDATE public.servizi SET transfer_tipo = 'Per porto' WHERE transfer_tipo IN ('Per Porto','Per Civitavecchia');