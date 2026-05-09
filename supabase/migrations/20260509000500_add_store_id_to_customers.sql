-- Add store_id column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
