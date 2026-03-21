
-- Sales table with trade-in and payment method support
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) NOT NULL,
  store_id uuid REFERENCES public.stores(id) NOT NULL,
  sale_price numeric NOT NULL,
  
  -- Trade-in info
  has_trade_in boolean NOT NULL DEFAULT false,
  trade_in_device_name text,
  trade_in_device_brand text,
  trade_in_device_model text,
  trade_in_device_imei text,
  trade_in_value numeric DEFAULT 0,
  trade_in_product_id uuid REFERENCES public.products(id),
  
  -- Payment breakdown
  payment_cash numeric NOT NULL DEFAULT 0,
  payment_card numeric NOT NULL DEFAULT 0,
  payment_pix numeric NOT NULL DEFAULT 0,
  
  customer_name text,
  customer_phone text,
  notes text,
  
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sales" ON public.sales FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view sales" ON public.sales FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
