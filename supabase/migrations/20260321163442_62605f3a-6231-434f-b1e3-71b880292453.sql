
-- Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  address TEXT,
  email TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Gerentes can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gerente'));

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service Orders table
CREATE TABLE public.service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_cpf TEXT,
  -- Device info
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_imei TEXT,
  device_color TEXT,
  device_condition TEXT,
  device_password TEXT,
  device_accessories TEXT,
  -- Service info
  reported_defect TEXT NOT NULL,
  requested_service TEXT NOT NULL,
  technician_id UUID,
  store_id UUID REFERENCES public.stores(id),
  -- Status and dates
  status TEXT NOT NULL DEFAULT 'open',
  estimated_completion TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  -- Pricing
  estimated_price NUMERIC DEFAULT 0,
  final_price NUMERIC DEFAULT 0,
  -- Terms
  terms_text TEXT DEFAULT 'O cliente declara que o aparelho foi entregue nas condições descritas acima. A loja não se responsabiliza por dados contidos no aparelho. Recomenda-se backup prévio. Em caso de não retirada do aparelho após 90 dias da conclusão do serviço, a loja poderá dispor do mesmo para cobrir custos. A garantia do serviço cobre apenas o defeito reparado e a peça substituída, pelo período de 90 dias. O orçamento inicial pode sofrer alterações após análise técnica, mediante aprovação do cliente.',
  terms_accepted BOOLEAN DEFAULT false,
  signature_data TEXT,
  -- Notes
  internal_notes TEXT,
  -- Tracking
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_orders" ON public.service_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage service_orders" ON public.service_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Gerentes can update service_orders" ON public.service_orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "Technicians can update own service_orders" ON public.service_orders FOR UPDATE TO authenticated USING (technician_id = auth.uid());

CREATE TRIGGER update_service_orders_updated_at BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service order status history for tracking changes
CREATE TABLE public.service_order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view os_history" ON public.service_order_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert os_history" ON public.service_order_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Add commission fields to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS commission_percent NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;

-- Add product type/condition fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'celular';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'used';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS capacity TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color TEXT;

-- Enable realtime for service_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
