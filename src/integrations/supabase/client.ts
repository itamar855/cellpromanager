import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Validação de variáveis de ambiente ──────────────────────
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    '❌ [CellManagerPro] Variáveis de ambiente do Supabase não configuradas!\n' +
    '   Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão definidas no .env\n' +
    '   Variáveis encontradas:\n' +
    `   - VITE_SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌ FALTANDO'}\n` +
    `   - VITE_SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_PUBLISHABLE_KEY ? '✅' : '❌ FALTANDO'}`
  );
}

// Verificar se a URL parece válida
if (SUPABASE_URL && !SUPABASE_URL.includes('.supabase.co')) {
  console.warn(
    '⚠️ [CellManagerPro] VITE_SUPABASE_URL não parece ser uma URL Supabase válida:',
    SUPABASE_URL
  );
}

// Verificar se a key é um JWT válido (3 partes separadas por ponto)
if (SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY.split('.').length !== 3) {
  console.warn(
    '⚠️ [CellManagerPro] VITE_SUPABASE_PUBLISHABLE_KEY não parece ser um JWT válido.'
  );
}

// Extrair project ref da URL e do JWT para verificar se coincidem
if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
  try {
    const urlRef = SUPABASE_URL.match(/https?:\/\/(.+)\.supabase\.co/)?.[1];
    const jwtPayload = JSON.parse(atob(SUPABASE_PUBLISHABLE_KEY.split('.')[1]));
    const jwtRef = jwtPayload?.ref;

    if (urlRef && jwtRef && urlRef !== jwtRef) {
      console.error(
        `❌ [CellManagerPro] ATENÇÃO: A URL Supabase (${urlRef}) e a API Key (${jwtRef}) apontam para projetos DIFERENTES!\n` +
        '   Isso causará falha na conexão com o banco de dados.\n' +
        '   Corrija o .env para que ambos apontem para o mesmo projeto.'
      );
    }
  } catch {
    // Se falhar ao decodificar, ignora silenciosamente
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

