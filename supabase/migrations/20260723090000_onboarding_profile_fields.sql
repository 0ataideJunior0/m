-- Onboarding: adiciona os campos coletados no primeiro login (nome reaproveita
-- a coluna username já existente) e a policy de UPDATE que faltava — hoje
-- nenhuma usuária consegue escrever na própria linha de `profiles`.
-- Todas as colunas nascem NULL nas ~20 contas já existentes; isso é
-- intencional: NULL em onboarding_completed_at é o próprio sinal de
-- "precisa fazer onboarding", sem precisar de backfill.

ALTER TABLE public.profiles
  ADD COLUMN age INTEGER NULL CHECK (age > 0 AND age < 120),
  ADD COLUMN sex TEXT NULL CHECK (sex IN ('feminino', 'masculino')),
  ADD COLUMN goal TEXT NULL CHECK (goal IN ('emagrecer', 'ganhar_musculo', 'manter')),
  ADD COLUMN height_cm INTEGER NULL CHECK (height_cm >= 50 AND height_cm <= 250),
  ADD COLUMN weight_kg NUMERIC(5,1) NULL CHECK (weight_kg > 0),
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ NULL;

GRANT UPDATE ON public.profiles TO authenticated;

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
