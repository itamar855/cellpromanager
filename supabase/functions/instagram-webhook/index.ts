import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const { method } = req;
  
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const fetchInstagramUserProfile = async (userId: string, accessToken: string) => {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${userId}?fields=name,username&access_token=${accessToken}`);
      const data = await response.json();
      if (data.error) {
        console.error("Instagram Profile Fetch Error:", data.error);
        return null;
      }
      return data;
    } catch (e) {
      console.error("Network error fetching IG profile:", e);
      return null;
    }
  };

  if (method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === 'instagram_crm_verify') {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const payload = await req.json();
    console.log("Processing payload object:", payload.object);
    
    if (payload.object === 'instagram' || payload.object === 'page') {
      for (const entry of payload.entry) {
        const messagingEvents = entry.messaging || entry.changes;
        if (!messagingEvents) continue;

        for (const messaging of messagingEvents) {
          const senderId = messaging.sender?.id || messaging.value?.from?.id || messaging.value?.sender_id;
          const message = messaging.message || messaging.value?.message;
          const messageText = message?.text || (typeof message === 'string' ? message : null);

          if (senderId && messageText) {
            console.log("Found senderId:", senderId, "message:", messageText);
            
            // 1. Tentar encontrar lead
            const { data: lead, error: leadFetchError } = await supabaseClient
              .from('leads')
              .select('id, name, store_id')
              .eq('instagram_user_id', senderId)
              .maybeSingle();

            if (leadFetchError) console.error("Error fetching lead:", leadFetchError);

            let leadId = lead?.id;
            let userName = lead?.name;
            let instagramUsername = null;

            const { data: config } = await supabaseClient
              .from('instagram_config')
              .select('page_access_token, store_id')
              .eq('is_active', true)
              .limit(1)
              .single();

            // Tentar pegar nome real se não tivermos no lead
            if ((!userName || userName.startsWith("IG User")) && config?.page_access_token) {
              const profile = await fetchInstagramUserProfile(senderId, config.page_access_token);
              if (profile?.name) userName = profile.name;
              if (profile?.username) instagramUsername = profile.username;
            }

            if (!userName) userName = "IG User " + senderId.substring(0, 5);

            // 2. Se não existir o lead, criar
            if (!leadId) {
              const configStoreId = config?.store_id || null;
              const fallbackUserId = "2bce7f09-1688-43e5-8b61-4e8d11517d0c";

              const { data: newLead, error: createError } = await supabaseClient
                .from('leads')
                .insert({
                  name: userName,
                  instagram_user_id: senderId,
                  instagram_username: instagramUsername,
                  source: 'instagram',
                  status: 'novo',
                  store_id: configStoreId,
                  created_by: fallbackUserId
                })
                .select('id')
                .single();
              
              if (createError) {
                console.error("Error creating lead:", createError);
                // Tentar buscar novamente se deu erro de unicidade
                const { data: retryLead } = await supabaseClient
                  .from('leads')
                  .select('id')
                  .eq('instagram_user_id', senderId)
                  .maybeSingle();
                leadId = retryLead?.id;
              } else {
                leadId = newLead.id;
              }
            } else if (userName && userName !== lead.name) {
              // Atualizar nome se descobrimos agora
              await supabaseClient
                .from('leads')
                .update({ 
                  name: userName,
                  instagram_username: instagramUsername || undefined
                })
                .eq('id', leadId);
            }

            // 3. Inserir mensagem se tivermos leadId
            if (leadId) {
              const { error: msgError } = await supabaseClient.from('lead_messages').insert({
                lead_id: leadId,
                content: messageText,
                sender_type: 'cliente',
                message_type: 'text',
                channel: 'instagram'
              });
              
              if (msgError) console.error("Error inserting message:", msgError);

              // 4. Atualizar timestamp do lead
              const { error: updateError } = await supabaseClient.from('leads').update({ 
                last_message_at: new Date().toISOString(),
                has_unread: true 
              }).eq('id', leadId);
              
              if (updateError) console.error("Error updating lead:", updateError);
              else console.log("Success processing message for lead", leadId);
            } else {
              console.error("Could not determine leadId for sender", senderId);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Instagram Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
