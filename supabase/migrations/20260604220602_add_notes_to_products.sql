-- Add notes column to products table for device description/history
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Also add device_payment_voucher and parts_payment_voucher if they don't exist yet
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS device_payment_voucher TEXT DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS parts_payment_voucher TEXT DEFAULT NULL;
