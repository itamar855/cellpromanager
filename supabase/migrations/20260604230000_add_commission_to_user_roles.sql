-- Adicionar colunas de comissão na tabela user_roles
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS commission_sales_percent NUMERIC(5,2) DEFAULT 0;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS commission_repair_percent NUMERIC(5,2) DEFAULT 0;
