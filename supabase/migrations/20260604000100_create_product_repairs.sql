-- ============================================================
-- CellManagerPro — Tabela de Reparos e Peças de Estoque
-- Permite registrar reparos em aparelhos do estoque,
-- associando peças e comprovantes, recalculando o preço de custo.
-- ============================================================

-- 1. Adicionar coluna de custo original e comprovantes na tabela products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS original_cost_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS device_payment_voucher TEXT,
  ADD COLUMN IF NOT EXISTS parts_payment_voucher TEXT;

-- Atualizar original_cost_price com o custo atual para registros legados
UPDATE public.products 
SET original_cost_price = cost_price 
WHERE original_cost_price IS NULL;

-- 2. Criar a tabela principal de reparos de aparelhos do estoque
CREATE TABLE IF NOT EXISTS public.product_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  repair_types TEXT[] NOT NULL, -- Ex: ARRAY['Bateria', 'Tela']
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Criar a tabela de itens/peças usadas nos reparos do estoque
CREATE TABLE IF NOT EXISTS public.product_repair_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID REFERENCES public.product_repairs(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL, -- A peça no estoque
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.product_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_repair_items ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Authenticated users can manage product_repairs"
  ON public.product_repairs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage product_repair_items"
  ON public.product_repair_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Trigger/Função para atualizar automaticamente o cost_price do aparelho
CREATE OR REPLACE FUNCTION public.recalculate_product_repair_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_product_id UUID;
  v_repair_id UUID;
  v_total_repair_cost NUMERIC(12,2);
BEGIN
  -- Identificar a ID do reparo
  IF TG_OP = 'DELETE' THEN
    v_repair_id := OLD.repair_id;
  ELSE
    v_repair_id := NEW.repair_id;
  END IF;

  -- Obter a ID do aparelho sendo reparado
  SELECT product_id INTO v_parent_product_id
  FROM public.product_repairs
  WHERE id = v_repair_id;

  -- Calcular o custo total de todas as peças associadas aos reparos deste aparelho
  SELECT COALESCE(SUM(quantity * unit_cost), 0) INTO v_total_repair_cost
  FROM public.product_repair_items pri
  JOIN public.product_repairs pr ON pri.repair_id = pr.id
  WHERE pr.product_id = v_parent_product_id;

  -- Atualizar o cost_price final do produto
  UPDATE public.products
  SET cost_price = COALESCE(original_cost_price, cost_price) + v_total_repair_cost
  WHERE id = v_parent_product_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para acionar o recálculo
CREATE TRIGGER tr_recalculate_repair_cost_insert_update
  AFTER INSERT OR UPDATE ON public.product_repair_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_product_repair_cost();

CREATE TRIGGER tr_recalculate_repair_cost_delete
  AFTER DELETE ON public.product_repair_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_product_repair_cost();
