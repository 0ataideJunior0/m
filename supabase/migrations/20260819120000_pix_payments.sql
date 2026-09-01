-- Fase P1 do docs/PLANO-PIX.md — pagamento avulso via Pix convivendo com a
-- assinatura recorrente no cartão.
--
-- Nada aqui muda comportamento existente: as colunas novas têm DEFAULT que
-- preserva a semântica atual (toda linha existente é 'preapproval'), e
-- has_active_subscription() continua intocada — ela já libera acesso enquanto
-- next_payment_date estiver no futuro, que é exatamente como o Pix credita.

-- ---------------------------------------------------------------------------
-- subscriptions: passa a aceitar linhas que não vêm de uma preapproval
-- ---------------------------------------------------------------------------

-- Um pagamento Pix não tem preapproval_id. Em Postgres, UNIQUE permite
-- múltiplos NULL, então o índice único existente continua válido para as
-- linhas de cartão.
ALTER TABLE public.subscriptions ALTER COLUMN preapproval_id DROP NOT NULL;

ALTER TABLE public.subscriptions ADD COLUMN source TEXT NOT NULL DEFAULT 'preapproval'; -- 'preapproval' | 'pix'
ALTER TABLE public.subscriptions ADD COLUMN payment_id TEXT; -- último pagamento Pix que creditou acesso

-- ---------------------------------------------------------------------------
-- pix_payments: livro-razão dos pagamentos, para idempotência e auditoria
-- ---------------------------------------------------------------------------
-- Por que uma tabela separada em vez de só guardar payment_id em subscriptions:
-- subscriptions tem uma linha por usuária, então uma renovação sobrescreve o
-- payment_id anterior. Sem este registro, uma notificação atrasada de um
-- pagamento antigo seria tratada como nova e creditaria período duas vezes.
-- O UNIQUE em payment_id é o que torna o webhook idempotente de verdade.

CREATE TABLE public.pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  months INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pix_payments_user_id_idx ON public.pix_payments (user_id);

GRANT SELECT ON public.pix_payments TO authenticated;

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pix payments, admins view all" ON public.pix_payments
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- Nenhuma policy de INSERT/UPDATE/DELETE — só o service_role grava, de dentro
-- das Vercel Functions. Mesmo padrão de subscriptions.
