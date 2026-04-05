-- Add battery_percentage to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS battery_percentage integer;

-- Update the audit_logs comment or description if needed (optional)
COMMENT ON COLUMN products.battery_percentage IS 'Battery health percentage of the device';
