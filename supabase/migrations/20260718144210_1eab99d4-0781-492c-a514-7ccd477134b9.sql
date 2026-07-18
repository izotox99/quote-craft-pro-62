DROP FUNCTION IF EXISTS public.client_portal_update_servizio(
  _servizio_id uuid, _data_servizio date, _ora_inizio text, _citta text,
  _n_passeggeri integer, _n_bagagli integer, _tipologia public.servizio_tipologia,
  _transfer_tipo text, _disposizione_oraria text, _tour_tipo text, _veicolo_tipo text,
  _luogo_inizio text, _luogo_fine text, _itinerario text, _info_autista text,
  _tipo_pagamento text, _centro_costo text, _accessori text, _note text,
  _allegato_path text, _allegato_nome text, _remove_allegato boolean, _cancel boolean
);