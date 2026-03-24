-- Phase 2: Service Orders (OS) Enhancement

-- 1. Update service_orders table
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS entry_checklist jsonb;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS exit_checklist jsonb;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS entry_signature text;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS exit_signature text;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS warranty_end_date timestamptz;

-- 2. Create service_order_photos table (Galeria de fotos do aparelho)
CREATE TABLE IF NOT EXISTS service_order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('entrada', 'reparo', 'saida')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create service_order_items table (Baixa automática de peças associadas à OS)
CREATE TABLE IF NOT EXISTS service_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE service_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users on service_order_photos" ON service_order_photos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on service_order_items" ON service_order_items FOR ALL USING (auth.role() = 'authenticated');
