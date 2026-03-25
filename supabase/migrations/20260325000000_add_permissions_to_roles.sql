-- Adicionar coluna de permissões na tabela user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.user_roles.permissions IS 'Permissões granulares do usuário para cada módulo do sistema.';

-- Opcional: Atualizar todos os admins para ter permissões totais (embora o código vá tratar isso)
-- UPDATE public.user_roles 
-- SET permissions = '{"vendas":true,"estoque":true,"os":true,"clientes":true,"transacoes":true,"relatorios":true,"lojas":true,"equipe":true,"ia":true}'::jsonb
-- WHERE role = 'admin';
