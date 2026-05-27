-- =====================================================
-- Fix: Sales RLS - Insert, Delete permissions
-- Fix: Product update RLS for status changes during sales
-- Fix: Only admins/gerentes can delete sales
-- =====================================================

-- 1. PRODUCTS - Ensure update policy exists (safely)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Authenticated users can update products'
    ) THEN
        CREATE POLICY "Authenticated users can update products" ON public.products
          FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. PRODUCTS - Also allow INSERT for authenticated (trade-in creation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Authenticated users can insert products'
    ) THEN
        CREATE POLICY "Authenticated users can insert products" ON public.products
          FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- 3. SALES - Allow authenticated users to insert sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales' AND policyname = 'Authenticated users can insert sales'
    ) THEN
        CREATE POLICY "Authenticated users can insert sales" ON public.sales
          FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- 4. SALES - Allow authenticated users to select sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales' AND policyname = 'Authenticated users can view sales'
    ) THEN
        CREATE POLICY "Authenticated users can view sales" ON public.sales
          FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 5. SALES - Only admins and gerentes can DELETE sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales' AND policyname = 'Admins and gerentes can delete sales'
    ) THEN
        CREATE POLICY "Admins and gerentes can delete sales" ON public.sales
          FOR DELETE TO authenticated 
          USING (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_roles.user_id = auth.uid()
              AND user_roles.role IN ('admin', 'gerente')
            )
          );
    END IF;
END $$;

-- 6. SALES - Only admins and gerentes can UPDATE sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales' AND policyname = 'Admins and gerentes can update sales'
    ) THEN
        CREATE POLICY "Admins and gerentes can update sales" ON public.sales
          FOR UPDATE TO authenticated 
          USING (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_roles.user_id = auth.uid()
              AND user_roles.role IN ('admin', 'gerente')
            )
          )
          WITH CHECK (true);
    END IF;
END $$;

-- 7. TRANSACTIONS - Allow authenticated users to insert transactions (for cash flow)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'transactions' AND policyname = 'Authenticated users can insert transactions'
    ) THEN
        CREATE POLICY "Authenticated users can insert transactions" ON public.transactions
          FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- 8. TRANSACTIONS - Allow authenticated to view
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'transactions' AND policyname = 'Authenticated users can view transactions'
    ) THEN
        CREATE POLICY "Authenticated users can view transactions" ON public.transactions
          FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 9. TRANSACTIONS - Only admins and gerentes can delete transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'transactions' AND policyname = 'Admins and gerentes can delete transactions'
    ) THEN
        CREATE POLICY "Admins and gerentes can delete transactions" ON public.transactions
          FOR DELETE TO authenticated 
          USING (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_roles.user_id = auth.uid()
              AND user_roles.role IN ('admin', 'gerente')
            )
          );
    END IF;
END $$;
