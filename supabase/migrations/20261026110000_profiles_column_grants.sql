-- Correção de segurança: a tabela profiles tinha UPDATE/INSERT em nível de
-- tabela para anon e authenticated, e a única policy de UPDATE só confere
-- id = auth.uid(). Com isso qualquer usuária logada podia, pela API, mudar o
-- próprio is_admin (virar admin) ou o próprio email. Agora a aluna só altera
-- as colunas que o app edita (src/utils/profile.ts#updateProfileFields).
--
-- O perfil novo continua sendo criado pelo trigger handle_new_user, que é
-- SECURITY DEFINER (dono postgres) e não depende destes grants.

REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (username, age, sex, goal, height_cm, weight_kg, onboarding_completed_at)
  ON public.profiles TO authenticated;
