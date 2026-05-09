
-- Migration to fix inventory reduction for non-admin users
-- Allows sellers and managers to update product status and accessory quantity

-- 1. Products Table
-- Allow authenticated users to update products (essential for marking as 'sold')
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Authenticated users can update products'
    ) THEN
        CREATE POLICY "Authenticated users can update products" ON public.products
          FOR UPDATE TO authenticated USING (true);
    END IF;
END $$;

-- 2. Accessories Table
-- Allow authenticated users to update accessories (essential for reducing quantity in PDV)
DO $$ 
BEGIN
    -- Check if table exists first because it's not in the standard types
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accessories') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'accessories' AND policyname = 'Authenticated users can update accessories'
        ) THEN
            CREATE POLICY "Authenticated users can update accessories" ON public.accessories
              FOR UPDATE TO authenticated USING (true);
        END IF;
    END IF;
END $$;
