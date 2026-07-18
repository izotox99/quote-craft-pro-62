
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS telefono_d text,
  ADD COLUMN IF NOT EXISTS info_interne text,
  ADD COLUMN IF NOT EXISTS info_cliente_autista text,
  ADD COLUMN IF NOT EXISTS info_cliente text,
  ADD COLUMN IF NOT EXISTS ritirare_voucher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS con_guida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS con_assistente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permesso_effettuato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prezzo_fattura numeric(10,2),
  ADD COLUMN IF NOT EXISTS prezzo_ccredito numeric(10,2),
  ADD COLUMN IF NOT EXISTS prezzo_contante numeric(10,2),
  ADD COLUMN IF NOT EXISTS com_cliente numeric(10,2);
