-- Add missing customer snapshots columns to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_cpf text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_address text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_email text;
