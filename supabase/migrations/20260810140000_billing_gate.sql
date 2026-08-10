-- Fase M4 do plano de re-implantação do Mercado Pago (docs/PLANO-MERCADOPAGO.md):
-- recria a tabela subscriptions (dropada no revert de julho), fecha o gate de
-- workouts, e substitui pdf_plans + bucket de Storage por meal_plans (texto
-- markdown gateado por RLS, sem signed URL nem bucket).
--
-- ENTREGUE COMO ARQUIVO, NÃO APLICADO (Tarefa M4.4). A ativação é a Fase M5,
-- que tem ordem própria: código no ar com o gate ainda inativo, teste real
-- de ponta a ponta, comunicar as usuárias, só então aplicar esta migration.

-- ---------------------------------------------------------------------------
-- M4.1 — subscriptions + has_active_subscription()
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preapproval_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'pending' | 'authorized' | 'paused' | 'cancelled' (valores reais confirmados na M1.2)
  next_payment_date TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.subscriptions TO authenticated;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription, admins view all" ON public.subscriptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- Nenhuma policy de INSERT/UPDATE/DELETE — só o service_role (dentro das
-- Vercel Functions) grava.

-- Defesa contra assinatura "expirada mas ainda authorized" (decidido em
-- 2026-08-10): se um webhook de cancelamento se perder, uma linha authorized
-- ficaria liberada para sempre. Opção 1 do plano — checar next_payment_date
-- com folga de 3 dias — em vez da opção 2 (job de reconciliação periódico).
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid()
      AND status = 'authorized'
      AND (next_payment_date IS NULL OR next_payment_date > NOW() - INTERVAL '3 days')
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;

-- ---------------------------------------------------------------------------
-- M4.2 — fechar a policy aberta de workouts
-- ---------------------------------------------------------------------------

-- Substitui (não soma) a policy pública existente — uma USING(true) deixada
-- no lugar combina por OR com qualquer policy nova e a anula por completo.
DROP POLICY IF EXISTS "Anyone can view workouts" ON public.workouts;
CREATE POLICY "Subscribers and admins can view workouts" ON public.workouts
  FOR SELECT USING (
    public.has_active_subscription()
    OR public.is_admin()
  );

-- programs fica aberta de propósito — é vitrine, não o produto pago.
-- user_progress fica fora do gate de propósito — é dado da usuária, não
-- conteúdo do produto (decidido em 2026-08-08, ver Fase M4.2 do plano).

-- ---------------------------------------------------------------------------
-- M4.3 (reescrita em 2026-08-10) — meal_plans no lugar do bucket de Storage
-- ---------------------------------------------------------------------------
-- Os planos alimentares eram 2 PDFs estáticos servidos via signed URL do
-- Storage (bucket "plans"). Substituídos por conteúdo markdown gateado pela
-- mesma RLS usada em workouts — sem bucket, sem signed URL, sem a janela em
-- que uma URL emitida continua válida mesmo se a assinatura for cancelada.

DROP TABLE IF EXISTS public.pdf_plans;

CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE, -- 'mass_gain' | 'fat_loss'
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.meal_plans TO authenticated;

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers and admins can view meal plans" ON public.meal_plans
  FOR SELECT USING (
    public.has_active_subscription()
    OR public.is_admin()
  );

INSERT INTO public.meal_plans (type, title, description, content_md) VALUES
('mass_gain', 'Plano Alimentar • Ganho de Massa', 'Estrutura nutricional com foco em hipertrofia', $md$# ⭐ PLANO ALIMENTAR COMPLETO – MUSA FIT

**Foco:** 2.300 kcal / 5 REFEIÇÕES
*(Com tabela de substituições embutida para variações diárias)*

## 1) CAFÉ DA MANHÃ (Energia e Saciedade)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Tapioca (goma) | 100g |
| Ovos inteiros | 3 unidades (150g) |

**Dica Musa Fit — Preparo Rápido:** Cozinhe os ovos na noite anterior ou prepare-os mexidos com um pouco de azeite. A combinação de carboidratos e proteínas é ideal para começar o dia com energia e evitar a fome antes do lanche da manhã.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Tapioca (goma) | 100g |
| Carboidratos | Pão de forma | 4 fatias (100g) |
| Carboidratos | Arroz cozido | 150g |
| Proteínas | Ovos | 3 unidades |
| Proteínas | Queijo Muçarela | 75g |
| Proteínas | Sobrecoxa sem pele | 150g |
| Proteínas | Peito de frango | 120g |
| Proteínas | Queijo Muçarela (Proteína + Gordura) | 75g |

## 2) LANCHE DA MANHÃ (Foco e Praticidade)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Pão de forma | 2 fatias |
| Peito de frango desfiado | 80g |

**Dica Musa Fit — Marmita Inteligente:** Prepare o frango desfiado em maior quantidade no início da semana. O sanduíche é uma opção prática para levar ao trabalho ou faculdade. Se preferir, substitua o pão por batata cozida para uma digestão mais lenta.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Pão de forma | 2 fatias (50g) |
| Carboidratos | Pão francês | ½ unidade |
| Carboidratos | Batata cozida | 100g |
| Carboidratos | Tapioca (goma) | 50g |
| Proteínas | Frango desfiado | 80g |
| Proteínas | Ovos cozidos | 2 unidades |
| Proteínas | Carne moída | 100g |

## 3) ALMOÇO (Refeição Principal)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Arroz cozido | 100g |
| Feijão cozido | 100g |
| Carne moída 90/10 | 150g |
| Batata inglesa | 100g (opcional) |

**Dica Musa Fit — Nutrientes Completos:** Adicione sempre uma porção generosa de vegetais e salada (folhas verdes, tomate, pepino) para aumentar a saciedade e o consumo de micronutrientes. A batata é opcional, mas ajuda a atingir o aporte calórico.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Arroz + Feijão | 100g + 100g |
| Carboidratos | Pão francês | 1 unidade |
| Carboidratos | Batata cozida | 200g |
| Proteínas | Carne moída | 150g |
| Proteínas | Peito de frango | 200g |
| Proteínas | Sobrecoxa sem pele | 150g |

## 4) LANCHE DA TARDE (LEVE – Pré-Treino)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Pão francês ou Pão de forma | 1 unidade ou 3 fatias |
| Ovos cozidos | 2 unidades |

**Dica Musa Fit — Timing Estratégico:** Consuma este lanche cerca de 60 a 90 minutos antes do seu treino para garantir energia durante o exercício. A combinação de carboidrato e proteína é excelente para o desempenho e recuperação muscular.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Pão francês | 1 unidade |
| Carboidratos | Pão de forma | 3 fatias |
| Carboidratos | Batata cozida | 150g |
| Carboidratos | Tapioca (goma) | 50g |
| Proteínas | Ovos | 2 unidades |
| Proteínas | Frango desfiado | 80g |
| Proteínas | Carne moída | 100g |

## 5) JANTAR (Recuperação e Leveza)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Arroz cozido | 200g |
| Peito de frango grelhado | 120g |

**Dica Musa Fit — Foco na Proteína:** O jantar é crucial para a recuperação muscular. Mantenha a porção de proteína conforme o plano e ajuste o carboidrato de acordo com a sua fome e o nível de atividade do dia. Evite alimentos muito gordurosos antes de dormir.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Arroz | 200g |
| Carboidratos | Batata | 250g |
| Carboidratos | Pães franceses | 2 unidades |
| Proteínas | Frango | 120g |
| Proteínas | Carne moída | 160g |
| Proteínas | Asinhas assadas | 140g (sem pele excessiva) |

---

## ⭐ TABELA DE SUBSTITUIÇÕES – PORÇÕES EQUIVALENTES

### Carboidratos – Porções Equivalentes (~30–35g Carbo)

| Alimento | Quantidade |
|---|---|
| Arroz cozido | 150g |
| Pão francês | 1 unidade |
| Pão de forma | 3 fatias |
| Batata inglesa cozida | 200g |
| Batata assada | 180g |
| Feijão cozido | 150g |
| Tapioca (goma) | 50g |

### Proteínas – Porções Equivalentes (~25–30g Proteína)

| Alimento | Quantidade |
|---|---|
| Peito de frango | 120g |
| Carne moída | 140g |
| Sobrecoxa sem pele | 150g |
| Asinhas | 140g |
| Ovos | 3 unidades |
| Queijo Muçarela | 75g |

### Gorduras – Porções Equivalentes (~9–10g Gordura)
*(Não utilizadas no plano principal, mas disponíveis para enriquecer refeições futuramente)*

| Alimento | Quantidade |
|---|---|
| Abacate | 70g |
| Pasta de amendoim | 15g |
| Queijo muçarela | 25g |

---

## ORIENTAÇÕES GERAIS MUSA FIT

**Salada à Vontade**
Volume e Nutrientes: Consuma salada (folhas verdes, tomate, pepino, etc.) à vontade em todas as refeições principais (Almoço e Jantar). Elas são ricas em fibras e micronutrientes, ajudam na saciedade e adicionam poucas calorias.

**Hidratação**
Beba Água: Mantenha-se hidratada ao longo do dia. O ideal é consumir pelo menos 3 a 4 litros de água. A hidratação é fundamental para o metabolismo e para a sensação de saciedade.

**Preparação (Meal Prep)**
Planejamento é Chave: Reserve um tempo (ex: domingo) para cozinhar e porcionar os alimentos da semana (frango desfiado, arroz, batata cozida). Isso garante que você siga o plano mesmo nos dias mais corridos.

**Temperos e Sabor**
Use e Abuse: Utilize temperos naturais (alho, cebola, páprica, orégano, pimenta, limão) para dar sabor aos alimentos sem adicionar calorias ou gorduras desnecessárias. Evite caldos industrializados ricos em sódio.

**Flexibilidade**
A Tabela é Sua Aliada: Lembre-se que a Tabela de Substituições permite variar o cardápio sem comprometer os resultados. Se enjoar de frango, troque por carne moída na porção equivalente.

**Foco Total**
Consistência: O sucesso do plano alimentar depende da sua consistência. Não se preocupe com deslizes pontuais, mas sim com a adesão à rotina na maior parte do tempo.

---

## RESUMO CALÓRICO (APROXIMADO)

| Nutriente | Quantidade |
|---|---|
| Proteínas | 135–150g |
| Gorduras | 45–55g |
| Carboidratos | 300–330g |
| **Calorias Totais** | **~2.300 kcal** |
$md$),
('fat_loss', 'Plano Alimentar • Perda de Gordura', 'Plano com déficit calórico e foco em composição corporal', $md$# ⭐ PLANO ALIMENTAR COMPLETO – MUSA FIT

**Foco:** 1.800 kcal / 5 REFEIÇÕES
*(Com tabela de substituições embutida para variações diárias)*

## 1) CAFÉ DA MANHÃ (Energia e Saciedade)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Pão francês | 1 unidade (50–60g total) |
| Ovos inteiros | 2 unidades (100g) |

**Dica Musa Fit — Início Leve:** Esta porção é ideal para um despertar energético. Priorize a proteína dos ovos para garantir saciedade até o lanche da manhã. Se não tiver pão francês, use 2 fatias de pão de forma.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Pão francês | 1 unidade (50–60g) |
| Carboidratos | Pão de forma | 2 fatias (50g) |
| Carboidratos | Arroz cozido | 100g |
| Proteínas | Ovos | 2 unidades |
| Proteínas | Sobrecoxa sem pele | 100g |
| Proteínas | Peito de frango | 80g |

## 2) LANCHE DA MANHÃ (Nutrição e Praticidade)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Iogurte natural desnatado | 1 pote (170g) |
| Aveia em flocos | 2 colheres de sopa (20g) |
| Fruta picada (ex: morango, banana) | 1 unidade média (100g) |

**Dica Musa Fit — Saúde Intestinal:** Esta combinação é rica em fibras (aveia e fruta) e probióticos (iogurte), auxiliando na saúde digestiva. Prepare em um pote e leve refrigerado para consumir em qualquer lugar.

### Substituições Possíveis (Mantenha a proporção)

| Grupo | Opção | Quantidade |
|---|---|---|
| Iogurte | Iogurte natural desnatado | 1 pote (170g) |
| Iogurte | Leite | 200ml |
| Carboidratos | Aveia em flocos | 2 colheres de sopa (20g) |
| Carboidratos | Granola sem açúcar | 1 colher de sopa (10g) |
| Frutas | Banana, Maçã, Pêra | 1 unidade média |
| Frutas | Morangos, Mirtilos | 1 xícara |

## 3) ALMOÇO (Refeição Principal)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Arroz cozido | 100g |
| Carne moída 90/10 | 120g |
| Batata inglesa | 80g (opcional) |

**Dica Musa Fit — Controle de Porções:** Reduza o volume de carboidratos em relação ao plano anterior. Lembre-se de adicionar uma porção generosa de vegetais e salada (folhas verdes, tomate, pepino) para aumentar a saciedade e o consumo de micronutrientes.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Arroz | 100g |
| Carboidratos | Pão francês | ½ unidade |
| Carboidratos | Batata cozida | 150g |
| Proteínas | Carne moída | 120g |
| Proteínas | Peito de frango | 150g |
| Proteínas | Sobrecoxa sem pele | 120g |

## 4) LANCHE DA TARDE (LEVE – Pré-Treino)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Pão de forma | 2 fatias |
| Ovos cozidos | 1 unidade |

**Dica Musa Fit — Energia Rápida:** Consuma este lanche cerca de 60 minutos antes do seu treino. É uma porção menor que a anterior, focada em fornecer o combustível necessário sem pesar no estômago.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Pão francês | ½ unidade |
| Carboidratos | Pão de forma | 2 fatias |
| Carboidratos | Batata cozida | 100g |
| Proteínas | Ovos | 1 unidade |
| Proteínas | Frango desfiado | 50g |
| Proteínas | Carne moída | 60g |

## 5) JANTAR (Recuperação e Leveza)

### Opção Principal

| Alimento | Quantidade |
|---|---|
| Arroz cozido | 150g |
| Peito de frango grelhado | 100g |

**Dica Musa Fit — Jantar Leve:** Mantenha o foco na proteína para a recuperação muscular. A porção de carboidrato é moderada para auxiliar no sono e na reposição de glicogênio.

### Substituições Possíveis por Grupo (Escolha 1 de cada)

| Grupo | Opção | Quantidade |
|---|---|---|
| Carboidratos | Arroz | 150g |
| Carboidratos | Batata | 200g |
| Carboidratos | Pão francês | 1 unidade |
| Proteínas | Frango | 100g |
| Proteínas | Carne moída | 120g |
| Proteínas | Asinhas assadas | 100g (sem pele excessiva) |

---

## ⭐ TABELA DE SUBSTITUIÇÕES – PORÇÕES EQUIVALENTES (1.800 kcal)

### Carboidratos – Porções Equivalentes (~25g Carbo)

| Alimento | Quantidade |
|---|---|
| Arroz cozido | 100g |
| Pão francês | 1 unidade |
| Pão de forma | 2 fatias |
| Batata inglesa cozida | 150g |
| Batata assada | 130g |

### Proteínas – Porções Equivalentes (~20g Proteína)

| Alimento | Quantidade |
|---|---|
| Peito de frango | 80g |
| Carne moída | 100g |
| Sobrecoxa sem pele | 100g |
| Asinhas | 100g |
| Ovos | 2 unidades |

### Gorduras – Porções Equivalentes (~9–10g Gordura)
*(Para enriquecer refeições, se necessário)*

| Alimento | Quantidade |
|---|---|
| Abacate | 70g |
| Pasta de amendoim | 15g |
| Queijo muçarela | 25g |

---

## ORIENTAÇÕES GERAIS MUSA FIT

**Salada à Vontade (Foco na Perda de Gordura)**
Prioridade Máxima: Consuma salada (folhas verdes, tomate, pepino, etc.) à vontade em todas as refeições principais (Almoço e Jantar). No plano de 1.800 kcal, a salada é sua principal aliada para aumentar a saciedade com pouquíssimas calorias, facilitando a perda de gordura.

**Hidratação**
Beba Água: Mantenha-se hidratada ao longo do dia. O ideal é consumir pelo menos 2,5 a 3 litros de água. A hidratação é fundamental para o metabolismo e para a sensação de saciedade.

**Preparação (Meal Prep)**
Planejamento é Chave: Reserve um tempo (ex: domingo) para cozinhar e porcionar os alimentos da semana (frango desfiado, arroz, batata cozida). Isso garante que você siga o plano mesmo nos dias mais corridos.

**Temperos e Sabor**
Use e Abuse: Utilize temperos naturais (alho, cebola, páprica, orégano, pimenta, limão) para dar sabor aos alimentos sem adicionar calorias ou gorduras desnecessárias. Evite caldos industrializados ricos em sódio.

**Flexibilidade**
A Tabela é Sua Aliada: Lembre-se que a Tabela de Substituições permite variar o cardápio sem comprometer os resultados. Se enjoar de frango, troque por carne moída na porção equivalente.

**Foco Total**
Consistência: O sucesso do plano alimentar depende da sua consistência. Não se preocupe com deslizes pontuais, mas sim com a adesão à rotina na maior parte do tempo.

---

## RESUMO CALÓRICO (APROXIMADO)

| Nutriente | Quantidade |
|---|---|
| Proteínas | 100–110g |
| Gorduras | 40–45g |
| Carboidratos | 200–220g |
| **Calorias Totais** | **~1.800 kcal** |
$md$);
