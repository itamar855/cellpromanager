-- Phase 1: Core Financial and RBAC Schema Extensions

-- 1. Update app_role enum (if it doesn't already exist)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'tecnico';

-- 2. Update store_bank_accounts
ALTER TABLE store_bank_accounts ADD COLUMN IF NOT EXISTS owner_type text CHECK (owner_type IN ('PJ', 'PF')) DEFAULT 'PJ';
ALTER TABLE store_bank_accounts ADD COLUMN IF NOT EXISTS is_cashbox boolean DEFAULT false;

-- 3. Update transactions (to support transfers)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES store_bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_account_id uuid REFERENCES store_bank_accounts(id) ON DELETE SET NULL;

-- 4. Create cash_registers table (Caixas Físicos)
CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid, -- Reference to auth.users not strictly enforced here to avoid hard coupling if not needed, but typical in Supabase
  status text NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'closed',
  opened_at timestamptz,
  closed_at timestamptz,
  current_balance numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create cash_closures table (Fechamento de Caixa Cego)
CREATE TABLE IF NOT EXISTS cash_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  opened_at timestamptz NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  reported_cash numeric(10,2) NOT NULL,
  system_cash numeric(10,2) NOT NULL,
  difference numeric(10,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected')) DEFAULT 'pending_review',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add some basic RLS policies for the new tables
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on cash_registers" ON cash_registers FOR SELECT USING (true);
CREATE POLICY "Enable all access for authenticated users on cash_registers" ON cash_registers FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users on cash_closures" ON cash_closures FOR SELECT USING (true);
CREATE POLICY "Enable all access for authenticated users on cash_closures" ON cash_closures FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users on audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on audit_logs" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
