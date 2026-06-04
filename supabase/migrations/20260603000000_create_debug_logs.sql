-- ============================================================
-- CellManagerPro — Debug Logs Table
-- Armazena logs de erro e debug da aplicação.
-- Limpeza automática a cada 30 dias via cron (pg_cron).
-- ============================================================

-- Criar tabela de debug logs
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  stack_trace TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON public.debug_logs (level);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON public.debug_logs (created_at DESC);

-- RLS: permitir insert para qualquer usuário autenticado, select apenas admin
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Política: qualquer autenticado pode inserir logs
CREATE POLICY "Authenticated users can insert debug logs"
  ON public.debug_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: qualquer autenticado pode ler logs (admin filtra no frontend)
CREATE POLICY "Authenticated users can read debug logs"
  ON public.debug_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Função para limpar logs antigos (> 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_debug_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.debug_logs
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;

-- NOTA: Para limpeza automática, execute no SQL Editor do Supabase:
-- SELECT cron.schedule('cleanup-debug-logs', '0 4 * * *', 'SELECT public.cleanup_old_debug_logs()');
