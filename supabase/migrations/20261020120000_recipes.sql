-- Receitas fitness: texto/macros/vídeo só pra assinantes (e só as publicadas);
-- foto do prato num bucket público; escrita só da admin.

CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  -- Macros da receita inteira (não por porção). Todos opcionais.
  calories integer CHECK (calories >= 0),
  protein_g numeric(6,1) CHECK (protein_g >= 0),
  carbs_g numeric(6,1) CHECK (carbs_g >= 0),
  fat_g numeric(6,1) CHECK (fat_g >= 0),
  -- Um item por linha.
  ingredients text NOT NULL DEFAULT '',
  steps text NOT NULL DEFAULT '',
  -- Caminho no bucket recipe-images.
  image_path text,
  -- Link do YouTube (ou outro vídeo), aberto no modal de vídeo do app.
  video_url text,
  sort_order integer NOT NULL DEFAULT 0,
  -- Rascunho até a admin publicar.
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipes_published_sort_idx ON public.recipes (published, sort_order);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Sem o GRANT, o delete/update falha calado (ver 20260727100000_user_exercise_progress_delete_policy.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;

CREATE POLICY "Subscribers see published recipes, admins see all" ON public.recipes
  FOR SELECT USING (
    public.is_admin()
    OR (published AND public.has_active_subscription())
  );

CREATE POLICY "Admins can insert recipes" ON public.recipes
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update recipes" ON public.recipes
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete recipes" ON public.recipes
  FOR DELETE USING (public.is_admin());

-- Fotos: leitura pública (bucket público), escrita só admin.
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload recipe images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND public.is_admin());

CREATE POLICY "Admins can update recipe images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'recipe-images' AND public.is_admin());

CREATE POLICY "Admins can delete recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND public.is_admin());
