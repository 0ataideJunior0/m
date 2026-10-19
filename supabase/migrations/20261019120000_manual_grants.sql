-- Liberação manual de acesso pela admin (ex.: aluna que pagou em dinheiro).
--
-- O acesso em si continua vindo de subscriptions: a liberação grava ali uma
-- linha source = 'manual', status = 'authorized', com next_payment_date no
-- fim do período — que has_active_subscription() já entende, sem mudança.
-- source é TEXT livre (sem CHECK), então 'manual' não exige alterar a tabela.
--
-- Esta tabela é o livro-razão: quem liberou, pra quem, quantos meses, até
-- quando e a anotação (forma de pagamento, valor). subscriptions guarda só o
-- estado atual e sobrescreve a cada liberação; sem isto não haveria como
-- conferir quem pagou em dinheiro e quando.
--
-- Escrita só pelo service role (api/admin-grant-access.ts, que confere se
-- quem chama é admin). Leitura só pra admin.
CREATE TABLE public.manual_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  months INTEGER NOT NULL CHECK (months IN (1, 3, 6, 12)),
  access_until TIMESTAMPTZ NOT NULL,
  note TEXT CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX manual_grants_user_idx ON public.manual_grants (user_id, created_at DESC);

ALTER TABLE public.manual_grants ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.manual_grants TO authenticated;

CREATE POLICY "Admins veem as liberações manuais" ON public.manual_grants
  FOR SELECT USING (public.is_admin());
