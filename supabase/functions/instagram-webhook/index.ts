import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KILO_PROMPT = `Você é o Kilo, o assistente virtual de vendas inteligente da CellManager.
Sua missão é atender clientes interessados em iPhones e assistência técnica.
Regras de comportamento:
1. Seja amigável, profissional e use emojis moderadamente.
2. Seu objetivo principal é QUALIFICAR o lead fazendo perguntas uma por uma:
   - Qual modelo de iPhone ele busca?
   - Ele tem um aparelho para dar na troca? (Se sim, qual modelo e saúde da bateria?)
   - Qual a forma de pagamento preferida (Pix, Cartão, Boleto)?
3. Se o cliente perguntar preço, dê uma estimativa baseada no mercado (ex: "iPhone 13 novo em torno de R$ 3.800") mas diga que o vendedor vai confirmar o valor exato.
4. Quando tiver as informações básicas, diga que um vendedor humano vai assumir para finalizar a negociação.
5. Nunca prometa descontos absurdos.
6. Responda de forma curta e objetiva, como em um chat real.`;

 // ─── Helper: Validação e limpeza de token ──────────────────────────────────
 const validateAndCleanToken = (token: string | null | undefined): string | null => {
   if (!token) return null;
   // Remove espaços em branco, quebras de linha e caracteres invisíveis comuns
   const cleanToken = token.trim().replace(/[\n\r\t]/g, "").replace(/\s+/g, "");
   
   // Um token válido do Facebook/Instagram geralmente é uma string longa alfanumérica
   // Se o token parece estar corrompido ou vazio após a limpeza, retornamos null
   if (cleanToken.length < 20) return null;
   
   return cleanToken;
 };
 
 // ─── Helper: buscar perfil público do Instagram via Graph API ───────────────
 const fetchInstagramUserProfile = async (userId: string, accessToken: string) => {
   const cleanToken = validateAndCleanToken(accessToken);
   if (!cleanToken) {
     console.error("fetchInstagramUserProfile: Access token inválido ou corrompido.");
     return { error: "Access token inválido ou corrompido." };
   }
 
   try {
     const url = `https://graph.facebook.com/v19.0/${userId}?fields=name,profile_pic&access_token=${cleanToken}`;
     const response = await fetch(url);
    const data = await response.json();
    
     if (data.error) {
       console.error(`Instagram Profile Fetch Error for ${userId}:`, JSON.stringify(data.error));
       return { error: data.error.message || "Erro API Instagram" };
     }
     
     console.log(`Successfully fetched profile for ${userId}: ${data.name}`);
     return data as { name?: string; id?: string; profile_pic?: string; error?: string };
  } catch (e) {
    console.error("Network error fetching IG profile:", e);
    return null;
  }
};

// ─── Helper: gravar log na tabela instagram_webhooks_logs ───────────────────
const writeLog = async (
  supabaseClient: ReturnType<typeof createClient>,
  payload: unknown,
  errorMessage: string | null = null
) => {
  const { error } = await supabaseClient.from("instagram_webhooks_logs").insert({
    payload,
    processed: errorMessage === null,
    error_message: errorMessage,
  });
  if (error) console.error("Erro ao gravar log:", error.message);
};

// ─── Helper: buscar o created_by do primeiro admin disponível ───────────────
const resolveCreatedBy = async (
  supabaseClient: ReturnType<typeof createClient>
): Promise<string | null> => {
  const { data } = await supabaseClient
    .from("profiles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
};

// ────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const { method } = req;

  // ── CORS preflight ─────────────────────────────────────────────────────────
  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // ── GET: verificação de webhook pela Meta ──────────────────────────────────
  if (method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // O verify_token deve bater exatamente com o configurado no painel da Meta
    const expectedToken = Deno.env.get("INSTAGRAM_VERIFY_TOKEN") ?? "instagram_crm_verify";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("Webhook verificado com sucesso pela Meta.");
      return new Response(challenge, { status: 200 });
    }
    console.warn("Tentativa de verificação inválida. Token recebido:", token);
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: receber eventos de mensagem ─────────────────────────────────────
  let payload: any = null;

  try {
    payload = await req.json();

    // Novo: suporte para operações via painel (evita CORS no navegador)
    if (payload.type === 'sync-profile' || payload.type === 'send-message') {
      const { userId, storeId, message } = payload;
      let query = supabaseClient
        .from("instagram_config")
        .select("*")
        .eq("is_active", true);
      
      if (storeId) {
        query = query.eq("store_id", storeId);
      }
      
      const { data: config } = await query.limit(1).maybeSingle();

      if (!config?.page_access_token) {
        return new Response(JSON.stringify({ error: "Configuração do Instagram não encontrada ou inativa." }), { 
          status: 404, headers: corsHeaders 
        });
      }
      
      if (type === 'debug-token') {
        console.log("Iniciando Diagnóstico de Token...");
        // 1. Verificar Páginas
        const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${config.page_access_token}`);
        const pagesData = await pagesRes.json();

        // 2. Verificar Conta IG vinculada à página atual
        const igRes = await fetch(`https://graph.facebook.com/v19.0/${config.page_id}?fields=instagram_business_account&access_token=${config.page_access_token}`);
        const igData = await igRes.json();

        return new Response(JSON.stringify({
          pages: pagesData,
          linked_ig: igData,
          current_config: {
            page_id: config.page_id,
            ig_id: config.instagram_business_account_id
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

       const cleanToken = validateAndCleanToken(config.page_access_token);
       
       if (!cleanToken) {
         return new Response(JSON.stringify({ error: "Access token configurado é inválido ou está corrompido." }), { 
           status: 400, headers: corsHeaders 
         });
       }
 
       if (payload.type === 'sync-profile') {
         const profile = await fetchInstagramUserProfile(userId, cleanToken);
         return new Response(JSON.stringify({ profile }), { 
           headers: { ...corsHeaders, "Content-Type": "application/json" } 
         });
       } else {
         const res = await fetch(`https://graph.facebook.com/v19.0/${config.instagram_business_account_id}/messages`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanToken}` },
           body: JSON.stringify({
             recipient: { id: userId },
             message: { text: message }
           })
         });
 
         const result = await res.json();
         return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
       }
    }

    console.log("Payload recebido. Objeto:", payload.object);

    if (payload.object !== "instagram" && payload.object !== "page" && !payload.type) {
      // Payload de outro objeto (ex: feed, story) — ignorar silenciosamente
      await writeLog(supabaseClient, payload, null);
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── FIX BUG 2: buscar config com .maybeSingle() para não explodir ───────
    const { data: config, error: configError } = await supabaseClient
      .from("instagram_config")
      .select("page_access_token, store_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("Erro ao buscar instagram_config:", configError.message);
    }

    if (!config) {
      console.warn("Nenhuma configuração Instagram ativa encontrada. Leads serão criados sem store_id e sem buscar perfil.");
    }

    // ── FIX BUG 3: resolver created_by dinamicamente ─────────────────────────
    const createdBy = await resolveCreatedBy(supabaseClient);

    // ── Processar cada entrada do webhook ─────────────────────────────────────
    for (const entry of payload.entry ?? []) {
      const messagingEvents = entry.messaging ?? entry.changes ?? [];

      for (const messaging of messagingEvents) {
        const senderId = messaging.sender?.id ?? messaging.value?.from?.id ?? messaging.value?.sender_id;
        const recipientId = messaging.recipient?.id;
        const message = messaging.message ?? messaging.value?.message;
        const messageText = message?.text ?? (typeof message === "string" ? message : null);
        const isEcho = message?.is_echo === true;

        // Ignorar eventos sem mensagem de texto nem anexo
        if (!senderId || (!messageText && !message?.attachments)) {
          console.log("Evento sem conteúdo válido, ignorado.");
          continue;
        }

        // Em echo, o lead é o destinatário; em mensagem recebida, é o remetente
        const targetLeadId = isEcho ? recipientId : senderId;

        if (!targetLeadId) {
          console.log("targetLeadId não encontrado, evento ignorado.");
          continue;
        }

        console.log(`Processando ${isEcho ? "echo" : "mensagem"} para target=${targetLeadId}: "${messageText?.substring(0, 30)}"`);

        // 1. Buscar lead existente pelo instagram_user_id
        const { data: existingLead, error: leadFetchError } = await supabaseClient
          .from("leads")
          .select("id, name, instagram_username")
          .eq("instagram_user_id", targetLeadId)
          .maybeSingle();

        if (leadFetchError) console.error("Erro ao buscar lead:", leadFetchError.message);

        let leadId = existingLead?.id ?? null;
        let userName = existingLead?.name ?? null;
        let instagramUsername = existingLead?.instagram_username ?? null;

        // 2. Tentar enriquecer o nome via Graph API (apenas mensagens recebidas)
         if (!isEcho && config?.page_access_token && (!userName || userName.startsWith("IG User"))) {
           const profile: any = await fetchInstagramUserProfile(targetLeadId, config.page_access_token);
           if (profile && !profile.error) {
             if (profile.name) userName = profile.name;
             if (profile.username) instagramUsername = profile.username;
           }
         }

        // Nome de fallback quando a API não retornou nada
        if (!userName) {
          userName = `IG User ${targetLeadId.substring(0, 8)}`;
        }

        // 3. Criar lead se não existir
        if (!leadId) {
          const { data: newLead, error: createError } = await supabaseClient
            .from("leads")
            .insert({
              name: userName,
              instagram_user_id: targetLeadId,
              instagram_username: instagramUsername,
              source: "instagram",
              status: "novo",
              store_id: config?.store_id ?? null,
              // ── FIX BUG 3: sem UUID hardcoded ─────────────────────────────
              created_by: createdBy,
            })
            .select("id")
            .maybeSingle();

          if (createError) {
            console.error("Erro ao criar lead:", createError.message);
            // Race condition: outro evento pode ter criado o lead em paralelo
            const { data: retryLead } = await supabaseClient
              .from("leads")
              .select("id")
              .eq("instagram_user_id", targetLeadId)
              .maybeSingle();
            leadId = retryLead?.id ?? null;
          } else {
            leadId = newLead?.id ?? null;
          }
        } else {
          // 3b. Atualizar nome se ainda estava genérico
          const nameIsGeneric = !existingLead?.name || existingLead.name.startsWith("IG User");
          if (nameIsGeneric && userName) {
            await supabaseClient
              .from("leads")
              .update({ name: userName, instagram_username: instagramUsername ?? undefined })
              .eq("id", leadId);
          }
        }

        if (!leadId) {
          console.error("Não foi possível determinar leadId para target", targetLeadId);
          continue;
        }

        // 4. Inserir mensagem
        const { error: msgError } = await supabaseClient.from("lead_messages").insert({
          lead_id: leadId,
          content: messageText ?? (message?.attachments ? "[Mídia]" : ""),
          // ── FIX (original já estava certo aqui, mantido) ─────────────────
          sender_type: isEcho ? "vendedor" : "cliente",
          message_type: message?.attachments ? "image" : "text",
          channel: "instagram",
        });

        if (msgError) console.error("Erro ao inserir mensagem:", msgError.message);

        // 5. Atualizar lead com timestamp e flag de não lida
        const { error: updateError } = await supabaseClient
          .from("leads")
          .update({
            last_message_at: new Date().toISOString(),
            has_unread: !isEcho,
          })
          .eq("id", leadId);

        if (updateError) console.error("Erro ao atualizar lead:", updateError.message);
        else console.log("Mensagem processada com sucesso para lead", leadId);

        // ─── NOVO: Atendimento Automático IA (Modo Kilo) ───────────────────
        if (config.ai_active && !isEcho) {
          const { data: lead } = await supabaseClient
            .from("leads")
            .select("*")
            .eq("id", leadId)
            .maybeSingle();

          if (lead && lead.ai_chat_active !== false) {
            console.log("Iniciando resposta automática da IA (Kilo) para lead", leadId);
            
            // Buscar histórico recente para contexto
            const { data: history } = await supabaseClient
              .from("lead_messages")
              .select("content, sender_type")
              .eq("lead_id", leadId)
              .order("created_at", { ascending: false })
              .limit(10);

            const conversationContext = history?.reverse().map(m => `${m.sender_type === 'vendedor' ? 'Kilo' : 'Cliente'}: ${m.content}`).join("\n");

            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.0-flash-exp",
                messages: [
                  { role: "system", content: KILO_PROMPT },
                  { role: "user", content: `Histórico recente:\n${conversationContext}\n\nNova mensagem do cliente: ${messageText}\n\nResponda como Kilo:` }
                ],
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const kiloText = aiData.choices?.[0]?.message?.content;

               if (kiloText) {
                 const cleanToken = validateAndCleanToken(config.page_access_token);
                 if (!cleanToken) {
                   console.error("Kilo: Erro ao enviar resposta, token inválido.");
                 } else {
                   // Enviar para o Instagram
                   const fbRes = await fetch(`https://graph.facebook.com/v19.0/${config.instagram_business_account_id}/messages`, {
                     method: "POST",
                     headers: { "Content-Type": "application/json", Authorization: `Bearer ${cleanToken}` },
                     body: JSON.stringify({ recipient: { id: senderId }, message: { text: kiloText } }),
                   });
 
                   if (fbRes.ok) {
                  // Gravar mensagem da IA no banco
                  await supabaseClient.from("lead_messages").insert({
                    lead_id: leadId,
                    content: kiloText,
                    sender_type: "vendedor",
                    message_type: "text",
                    channel: "instagram"
                  });
                  console.log("Resposta do Kilo enviada e gravada.");
                } else {
                  const fbErr = await fbRes.json();
                  console.error("Erro ao enviar resposta do Kilo para FB:", fbErr);
                }
              }
            } else {
              const aiErr = await aiResponse.text();
              console.error("Erro no gateway de IA para resposta automática:", aiErr);
            }
          }
        }
        // ──────────────────────────────────────────────────────────────────
      }
    }

    // ── FIX BUG 4: gravar log de sucesso ────────────────────────────────────
    await writeLog(supabaseClient, payload, null);

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Instagram Webhook Error:", error);

    // ── FIX BUG 4: gravar log de erro para aparecer no painel de sync ───────
    if (supabaseClient && payload !== null) {
      await writeLog(supabaseClient, payload, error?.message ?? "Erro desconhecido");
    }

    return new Response(JSON.stringify({ error: error?.message ?? "Erro interno" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});