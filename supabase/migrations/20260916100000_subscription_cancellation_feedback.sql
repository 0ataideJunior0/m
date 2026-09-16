-- Motivo de cancelamento informado pela cliente ao cancelar a assinatura no
-- cartão. A escrita é sempre feita pelo service role, dentro de
-- api/cancel-subscription.ts, best-effort: se o motivo vier ausente ou
-- inválido, o cancelamento em si segue normalmente e só a coleta de feedback
-- é pulada — o cancelamento nunca pode depender disso. Só admin lê.
CREATE TABLE public.subscription_cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('preco', 'pouco_uso', 'faltou_recurso', 'nao_gostei', 'outro')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscription_cancellation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem os motivos de cancelamento" ON public.subscription_cancellation_feedback
  FOR SELECT USING (public.is_admin());
