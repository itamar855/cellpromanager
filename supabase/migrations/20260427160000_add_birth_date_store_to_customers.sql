-- Add birth_date and store_id columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
