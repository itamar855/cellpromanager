-- 1. Garantir colunas necessárias na tabela de transações
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;

-- 2. Função de sincronização do Caixa para Transações
CREATE OR REPLACE FUNCTION public.sync_cash_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Só executa se o lançamento foi confirmado agora
    IF NEW.confirmed = true AND (OLD.confirmed = false OR OLD.confirmed IS NULL) THEN
        -- Busca transação correspondente (Mesmo valor, mesma loja, e descrição similar)
        -- Usamos ILIKE para ignorar prefixos como [Fixo]
        UPDATE public.transactions
        SET 
            status = 'confirmed',
            reconciled = true,
            receipt_url = NEW.receipt_url
        WHERE 
            store_id = NEW.store_id 
            AND amount = NEW.amount
            AND (
                description ILIKE '%' || NEW.description || '%' 
                OR NEW.description ILIKE '%' || REPLACE(description, '[Fixo] ', '') || '%'
                OR REPLACE(description, '[Fixo] ', '') ILIKE '%' || NEW.description || '%'
            )
            AND (reconciled = false OR status = 'pending')
            AND created_at >= (NEW.created_at - interval '2 days') -- Janela de 2 dias p/ segurança
            AND created_at <= (NEW.created_at + interval '2 days');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Trigger na tabela de cash_entries
DROP TRIGGER IF EXISTS trg_sync_cash_to_transaction ON public.cash_entries;
CREATE TRIGGER trg_sync_cash_to_transaction
AFTER UPDATE ON public.cash_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_cash_to_transaction();

-- 4. Reconciliação retroativa para as transações já confirmadas no Caixa
-- (Ajuste baseado nas fotos enviadas: Petro cell e Master cell)
UPDATE public.transactions t
SET 
    status = 'confirmed',
    reconciled = true,
    receipt_url = c.receipt_url
FROM public.cash_entries c
WHERE 
    t.store_id = c.store_id
    AND t.amount = c.amount
    AND (t.description ILIKE '%' || c.description || '%' OR c.description ILIKE '%' || t.description || '%')
    AND c.confirmed = true
    AND (t.reconciled = false OR t.status = 'pending');
