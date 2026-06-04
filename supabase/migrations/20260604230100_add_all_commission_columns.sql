-- Corrigir todas as colunas de comissão de user_roles de uma vez
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS commission_sales_percent NUMERIC(5,2) DEFAULT 0;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS commission_services_percent NUMERIC(5,2) DEFAULT 0;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS commission_on_sales BOOLEAN DEFAULT true;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS commission_on_services BOOLEAN DEFAULT true;
