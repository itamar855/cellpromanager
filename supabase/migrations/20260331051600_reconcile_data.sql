-- Reconciliação manual conforme solicitado nas imagens
-- 1. Petro cell: Foi entrada no Caixa mas é saída (Gasto PJ) no valor de 384.00
-- 2. Master cell: É saída (Gasto PJ) no valor de 230.00, apenas confirmando.

BEGIN;

-- Ajusta Petro cell (ID pode variar, vamos pelo nome e data no Caixa)
UPDATE cash_entries 
SET type = 'saida', confirmed = true 
WHERE description ILIKE '%Petro cell%' 
  AND CAST(created_at AS DATE) = '2026-03-30';

-- Ajusta Master cell no Caixa
UPDATE cash_entries 
SET confirmed = true 
WHERE description ILIKE '%Master cell%' 
  AND CAST(created_at AS DATE) = '2026-03-30';

-- Sincroniza tabela de transactions (se houver duplicidade ou erro lá)
UPDATE transactions 
SET status = 'confirmed', type = 'saida'
WHERE description ILIKE '%Petro cell%' 
  AND CAST(created_at AS DATE) = '2026-03-30';

UPDATE transactions 
SET status = 'confirmed'
WHERE description ILIKE '%Master cell%' 
  AND CAST(created_at AS DATE) = '2026-03-30';

COMMIT;
