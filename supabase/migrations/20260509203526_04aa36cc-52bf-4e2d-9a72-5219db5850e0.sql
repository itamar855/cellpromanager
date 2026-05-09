-- 1. Clientes
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);

-- 2. Contas Bancárias (Tabela Base)
ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS credit_fee_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_settlement_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS debit_fee_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS debit_settlement_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pix_fee_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pix_settlement_days INTEGER DEFAULT 0;

-- 3. Atualizar View store_bank_accounts
CREATE OR REPLACE VIEW public.store_bank_accounts AS
SELECT 
    id,
    store_id,
    bank_name,
    account_type,
    agency,
    account_number,
    pix_key,
    pix_key_type,
    holder_name,
    holder_document,
    owner_type,
    is_primary,
    notes,
    created_at,
    updated_at,
    credit_fee_percent,
    credit_settlement_days,
    debit_fee_percent,
    debit_settlement_days,
    pix_fee_percent,
    pix_settlement_days
FROM public.bank_accounts;

-- 4. Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);