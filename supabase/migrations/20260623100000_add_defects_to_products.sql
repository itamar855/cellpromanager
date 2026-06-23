-- Migration to add defects column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS defects text[] DEFAULT '{}';
COMMENT ON COLUMN products.defects IS 'Lista de defeitos conhecidos do aparelho em estoque';
