-- Fix RLS for customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;

CREATE POLICY "Authenticated users can manage customers" ON customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
