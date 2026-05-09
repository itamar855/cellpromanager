
-- Garantir que a tabela de vendas tenha a coluna de garantia e outros dados do cliente
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS warranty_days integer DEFAULT 90;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name text;

-- Se o usuário tiver permissão, vamos garantir que essas colunas sejam editáveis
-- (O RLS que criamos antes já cobre o UPDATE na tabela de produtos, aqui garantimos a estrutura)
