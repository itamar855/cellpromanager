A investigação detalhada revelou que os leads estão presentes no banco de dados (663 registros), mas podem não estar sendo exibidos devido a filtros restritivos no código ou problemas de sincronização com a loja ativa. Vou implementar correções para garantir a visibilidade total dos leads e melhorar a experiência de rastreamento de mensagens.

### Mudanças Propostas

#### 1. Melhoria na Busca de Leads (src/pages/Leads.tsx)
- Ajustar a lógica de filtragem por loja para garantir que, se nenhuma loja estiver ativa ou se for selecionado "Todas", os leads ainda sejam carregados.
- Otimizar a consulta para incluir o histórico completo de mensagens de forma mais eficiente.
- Garantir que a ordenação priorize interações recentes (last_message_at).

#### 2. Sincronização e Histórico de Conversas
- Atualizar o componente de Chat para exibir o histórico completo, incluindo mensagens enviadas e recebidas.
- Melhorar o feedback visual durante a sincronização manual para que o usuário saiba exatamente o que está acontecendo.

#### 3. Correção de Filtros e Estado
- Garantir que os filtros de Vendedor e Origem funcionem em harmonia com a listagem do Kanban.
- Adicionar logs de depuração específicos para identificar falhas silenciosas na obtenção de dados.

### Detalhes Técnicos
- Modificação da função `fetchData` em `src/pages/Leads.tsx` para tratar melhor o estado de `activeStoreId`.
- Ajuste na ordenação manual dos leads após o carregamento.
- Verificação da conexão em tempo real (Supabase Channel) para evitar dessincronização visual.
