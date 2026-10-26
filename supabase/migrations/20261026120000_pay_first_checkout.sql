-- Checkout "pagar primeiro": intenção de compra (funil), e-mail provado e UTM do cadastro.
-- Tudo que é escrito pelo checkout passa pelo service role (bypassa RLS); o cliente só lê.

-- 1) Intenção de compra: uma linha por tentativa de pagamento, criada no servidor
--    quando o e-mail é digitado e o plano escolhido. A conta só nasce com o pagamento aprovado.
CREATE TABLE public.purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Já normalizado (trim + minúsculas) pelo servidor.
  email text NOT NULL,
  plan_id text NOT NULL,
  method text NOT NULL CHECK (method IN ('pix', 'card')),
  months int NOT NULL,
  amount numeric(10,2) NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  -- Último status bruto devolvido pelo Mercado Pago (pending, in_process, rejected...).
  last_payment_status text,
  payment_id text UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  -- Passos do funil depois do pagamento, preenchidos conforme acontecem.
  access_email_sent_at timestamptz,
  link_opened_at timestamptz,
  password_set_at timestamptz
);

CREATE INDEX purchase_intents_email_created_idx ON public.purchase_intents (email, created_at DESC);
CREATE INDEX purchase_intents_created_idx ON public.purchase_intents (created_at);

ALTER TABLE public.purchase_intents ENABLE ROW LEVEL SECURITY;

-- O padrão do Supabase dá tudo a anon/authenticated em tabela nova. Aqui só a admin lê
-- (e só pela policy); escrita é exclusiva do service role.
REVOKE ALL ON public.purchase_intents FROM anon, authenticated;
GRANT SELECT ON public.purchase_intents TO authenticated;

CREATE POLICY "Admins can view purchase intents" ON public.purchase_intents
  FOR SELECT USING (public.is_admin());

-- 2) E-mail provado: a pessoa já abriu um link enviado a esse e-mail (ou já tinha
--    o e-mail confirmado quando o checkout nasceu). Decide se o checkout manda e-mail de acesso.
CREATE TABLE public.email_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  -- 'legacy' = já confirmado antes deste checkout; 'link' = abriu o link de acesso.
  method text NOT NULL CHECK (method IN ('legacy', 'link'))
);

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_verifications FROM anon, authenticated;
GRANT SELECT ON public.email_verifications TO authenticated;

CREATE POLICY "Own verification or admin can view" ON public.email_verifications
  FOR SELECT USING (user_id = (select auth.uid()) OR public.is_admin());

-- Quem já tem e-mail confirmado hoje conta como provado.
INSERT INTO public.email_verifications (user_id, verified_at, method)
SELECT id, COALESCE(email_confirmed_at, now()), 'legacy'
FROM auth.users
WHERE email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3) UTM do cadastro: {source, medium, campaign, content, term}. A própria usuária grava
--    pela policy de update que já existe em profiles.
ALTER TABLE public.profiles ADD COLUMN signup_utm jsonb;
-- profiles só tem UPDATE por coluna (20261026110000_profiles_column_grants.sql): a coluna nova precisa do grant.
GRANT UPDATE (signup_utm) ON public.profiles TO authenticated;

-- 4) subscriptions.source não tem CHECK no banco real (inspecionado antes de escrever
--    esta migração), então 'card' já é aceito: nada a trocar aqui.
