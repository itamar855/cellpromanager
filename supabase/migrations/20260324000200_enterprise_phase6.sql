-- Migration: Enterprise Phase 6 - Bank Accounts & Fees

-- Adicionando colunas de taxas e prazos em contas bancárias
ALTER TABLE public.store_bank_accounts 
ADD COLUMN IF NOT EXISTS credit_fee_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_settlement_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS debit_fee_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS debit_settlement_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pix_fee_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pix_settlement_days INTEGER DEFAULT 0;

-- Adicionando colunas de previsão e valor líquido em transações
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS expected_settlement_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2);

-- Atualiza dados existentes para evitar nulos
UPDATE public.transactions SET net_amount = amount WHERE net_amount IS NULL;
UPDATE public.transactions SET expected_settlement_date = created_at WHERE expected_settlement_date IS NULL;
