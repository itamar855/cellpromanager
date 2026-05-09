-- Tabela de configuração do Instagram
CREATE TABLE IF NOT EXISTS public.instagram_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    page_id TEXT,
    page_access_token TEXT,
    instagram_business_account_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas necessárias na tabela de leads para Instagram
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Tabela para logs de webhook do Instagram (debug e rastreabilidade)
CREATE TABLE IF NOT EXISTS public.instagram_webhooks_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.instagram_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_webhooks_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Baseadas em app_role)
CREATE POLICY "Admins and Managers can manage instagram config" ON public.instagram_config
    FOR ALL TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'gerente')
      )
    );

CREATE POLICY "Admins and Managers can view instagram logs" ON public.instagram_webhooks_logs
    FOR SELECT TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'gerente')
      )
    );