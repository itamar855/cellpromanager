-- ============================================================
-- CellManagerPro — Ajuste de Constraints de Produtos
-- Permite a exclusão de produtos que foram recebidos como
-- trade-in ou que possuem transações associadas, alterando
-- a referência para NULL automaticamente sem quebrar o histórico.
-- ============================================================

-- 1. Alterar a chave estrangeira do trade-in na tabela sales para ON DELETE SET NULL
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_trade_in_product_id_fkey,
  ADD CONSTRAINT sales_trade_in_product_id_fkey 
    FOREIGN KEY (trade_in_product_id) 
    REFERENCES public.products(id) 
    ON DELETE SET NULL;

-- 2. Alterar a chave estrangeira de produtos na tabela de transações para ON DELETE SET NULL
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_product_id_fkey,
  ADD CONSTRAINT transactions_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES public.products(id) 
    ON DELETE SET NULL;
