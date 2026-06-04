-- ============================================================
-- CellManagerPro — Tabela de Reparos e Peças de Estoque
-- ============================================================

-- 1. Adicionar colunas na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_cost_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS device_payment_voucher TEXT,
  ADD COLUMN IF NOT EXISTS parts_payment_voucher TEXT;

-- Atualizar original_cost_price com o custo atual para registros legados
UPDATE public.products
SET original_cost_price = cost_price
WHERE original_cost_price IS NULL;

-- 2. Tabela principal de reparos
CREATE TABLE IF NOT EXISTS public.product_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  repair_types TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Tabela de peças usadas nos reparos
CREATE TABLE IF NOT EXISTS public.product_repair_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID NOT NULL REFERENCES public.product_repairs(id) ON DELETE CASCADE,
  part_product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  payment_voucher TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Habilitar RLS
ALTER TABLE public.product_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_repair_items ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
DROP POLICY IF EXISTS "Authenticated users can manage product_repairs" ON public.product_repairs;
CREATE POLICY "Authenticated users can manage product_repairs"
  ON public.product_repairs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage product_repair_items" ON public.product_repair_items;
CREATE POLICY "Authenticated users can manage product_repair_items"
  ON public.product_repair_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 6. Função para recalcular custo do aparelho após cada reparo
CREATE OR REPLACE FUNCTION public.recalculate_product_repair_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_parent_product_id UUID;
  v_repair_id UUID;
  v_total_repair_cost NUMERIC(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_repair_id := OLD.repair_id;
  ELSE
    v_repair_id := NEW.repair_id;
  END IF;

  SELECT product_id INTO v_parent_product_id
  FROM public.product_repairs
  WHERE id = v_repair_id;

  SELECT COALESCE(SUM(pri.quantity * pri.unit_cost), 0) INTO v_total_repair_cost
  FROM public.product_repair_items pri
  JOIN public.product_repairs pr ON pri.repair_id = pr.id
  WHERE pr.product_id = v_parent_product_id;

  UPDATE public.products
  SET cost_price = COALESCE(original_cost_price, cost_price) + v_total_repair_cost
  WHERE id = v_parent_product_id;

  RETURN NULL;
END;
$func$;

-- 7. Triggers
DROP TRIGGER IF EXISTS tr_recalculate_repair_cost_insert_update ON public.product_repair_items;
CREATE TRIGGER tr_recalculate_repair_cost_insert_update
  AFTER INSERT OR UPDATE ON public.product_repair_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_product_repair_cost();

DROP TRIGGER IF EXISTS tr_recalculate_repair_cost_delete ON public.product_repair_items;
CREATE TRIGGER tr_recalculate_repair_cost_delete
  AFTER DELETE ON public.product_repair_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_product_repair_cost();
