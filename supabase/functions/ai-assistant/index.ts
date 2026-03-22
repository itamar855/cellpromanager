import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "financial") {
      systemPrompt = `Você é um analista financeiro especializado em lojas de celulares no Brasil. Analise os dados fornecidos e dê insights acionáveis em português. Seja direto e prático. Use formatação markdown. Inclua:
- Análise de receitas vs despesas
- Identificação de tendências
- Sugestões de redução de custos
- Alertas sobre gastos PF excessivos
- Projeções simples`;
      userPrompt = `Analise os seguintes dados financeiros da loja:\n${JSON.stringify(context, null, 2)}`;
    } else if (type === "stock") {
      systemPrompt = `Você é um especialista em gestão de estoque de lojas de celulares no Brasil. Analise os dados e sugira otimizações em português. Use markdown. Inclua:
- Produtos com baixa rotatividade
- Sugestões de compra baseadas em histórico
- Alertas de estoque crítico
- Otimização de preços
- ROI do estoque`;
      userPrompt = `Analise os seguintes dados de estoque e vendas:\n${JSON.stringify(context, null, 2)}`;
    } else if (type === "legal") {
      systemPrompt = `Você é um consultor jurídico especializado em termos de serviço para assistência técnica de celulares no Brasil. Gere ou adapte termos de responsabilidade em português. Use linguagem clara mas juridicamente adequada. Inclua cláusulas sobre:
- Condição do aparelho na entrega
- Responsabilidade sobre dados
- Prazo de retirada
- Garantia do serviço
- Alterações no orçamento
- LGPD e proteção de dados`;
      userPrompt = context?.customRequest 
        ? `Adapte os termos para o seguinte cenário: ${context.customRequest}\n\nTermos atuais: ${context.currentTerms || "padrão"}`
        : `Gere termos de responsabilidade completos para uma ordem de serviço de assistência técnica de celulares. Contexto: ${JSON.stringify(context, null, 2)}`;
    } else {
      return new Response(JSON.stringify({ error: "Tipo inválido. Use: financial, stock, legal" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
