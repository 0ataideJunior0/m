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
--    A prova vale para o E-MAIL provado (coluna email), não para a conta: o checkout só
--    considera provada a conta cujo e-mail de autenticação atual é o da prova.
CREATE TABLE public.email_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- E-mail provado, em minúsculas.
  email text NOT NULL,
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
INSERT INTO public.email_verifications (user_id, email, verified_at, method)
SELECT id, lower(email), COALESCE(email_confirmed_at, now()), 'legacy'
FROM auth.users
WHERE email_confirmed_at IS NOT NULL AND email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2b) Troca de e-mail bloqueada. Com "Confirm email" desligado, a usuária logada trocaria
--     o próprio e-mail na hora (supabase.auth.updateUser({ email })), o que (a) levaria a
--     prova de um e-mail para outro que ela não controla e (b) deixaria quem cadastrou um
--     e-mail alheio trocá-lo depois que a dona comprou, e o reenvio do link não acharia
--     ninguém. O app não oferece troca de e-mail, então nenhuma troca é legítima.
--     Só dispara em UPDATE que muda o e-mail: cadastro (INSERT) e login (last_sign_in_at)
--     passam direto. Troca feita pela admin: auth.users pertence a supabase_auth_admin,
--     então DISABLE TRIGGER não funciona; em vez disso troque a função por uma que não
--     bloqueia, faça a troca e restaure:
--       CREATE OR REPLACE FUNCTION public.block_auth_email_change() RETURNS trigger
--         LANGUAGE plpgsql SET search_path = '' AS $f$ BEGIN RETURN NEW; END; $f$;
--       -- troca o e-mail (e atualiza email_verifications.email, se for o caso)
--       -- recria a função original (RAISE EXCEPTION 'Troca de e-mail desativada')
--     Atenção: isso também bloqueia apagar usuária com soft delete e um futuro login
--     com Google que sincronize e-mail.
CREATE FUNCTION public.block_auth_email_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Troca de e-mail desativada';
END;
$$;

CREATE TRIGGER block_auth_email_change
  BEFORE UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.block_auth_email_change();

-- 3) UTM do cadastro: {source, medium, campaign, content, term}. A própria usuária grava
--    pela policy de update que já existe em profiles.
ALTER TABLE public.profiles ADD COLUMN signup_utm jsonb;
-- profiles só tem UPDATE por coluna (20261026110000_profiles_column_grants.sql): a coluna nova precisa do grant.
GRANT UPDATE (signup_utm) ON public.profiles TO authenticated;

-- 4) subscriptions.source não tem CHECK no banco real (inspecionado antes de escrever
--    esta migração), então 'card' já é aceito: nada a trocar aqui.
