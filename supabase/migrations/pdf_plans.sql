-- Table for storing PDF plans metadata
CREATE TABLE IF NOT EXISTS pdf_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT UNIQUE NOT NULL CHECK (type IN ('mass_gain','fat_loss')),
  title TEXT NOT NULL,
  description TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'plans',
  storage_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT ON pdf_plans TO anon;
GRANT ALL PRIVILEGES ON pdf_plans TO authenticated;

INSERT INTO pdf_plans (type, title, description, storage_key)
VALUES
('mass_gain','Plano Alimentar • Ganho de Massa','Estrutura nutricional com foco em hipertrofia','mass_gain.pdf'),
('fat_loss','Plano Alimentar • Perda de Gordura','Plano com déficit calórico e foco em composição corporal','fat_loss.pdf')
ON CONFLICT (type) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  storage_key = EXCLUDED.storage_key;

