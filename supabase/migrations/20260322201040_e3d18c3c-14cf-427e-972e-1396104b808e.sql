-- Bank accounts per store
CREATE TABLE public.store_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'corrente',
  agency text,
  account_number text,
  pix_key text,
  holder_name text,
  holder_cpf_cnpj text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bank accounts" ON public.store_bank_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage bank accounts" ON public.store_bank_accounts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

CREATE TRIGGER update_store_bank_accounts_updated_at
  BEFORE UPDATE ON public.store_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();