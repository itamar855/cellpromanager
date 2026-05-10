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
    console.log("Processing payload:", JSON.stringify(payload));
    
    if (payload.object === 'instagram' || payload.object === 'page') {
      for (const entry of payload.entry) {
        const messagingEvents = entry.messaging || entry.changes;
        if (!messagingEvents) continue;

        for (const messaging of messagingEvents) {
          const senderId = messaging.sender?.id || messaging.value?.from?.id;
          const message = messaging.message || messaging.value?.message;
          const messageText = message?.text || (typeof message === 'string' ? message : null);

          if (senderId && messageText) {
            // Buscar lead
            const { data: lead } = await supabaseClient
              .from('leads')
              .select('id, name, avatar_url, store_id')
              .eq('instagram_user_id', senderId)
              .maybeSingle();

            let leadId = lead?.id;
            let userName = lead?.name || "IG User " + senderId.substring(0, 5);

            // Config
            const { data: config } = await supabaseClient
              .from('instagram_config')
              .select('page_access_token, store_id')
              .eq('is_active', true)
              .limit(1)
              .single();

            const configStoreId = config?.store_id || null;
            const fallbackUserId = "2bce7f09-1688-43e5-8b61-4e8d11517d0c";

            if (!leadId) {
              const { data: newLead, error: createError } = await supabaseClient
                .from('leads')
                .insert({
                  name: userName,
                  instagram_user_id: senderId,
                  source: 'instagram',
                  status: 'novo',
                  store_id: configStoreId,
                  created_by: fallbackUserId
                })
                .select('id')
                .single();
              
              if (createError) throw createError;
              leadId = newLead.id;
            }

            // Inserir mensagem
            await supabaseClient.from('lead_messages').insert({
              lead_id: leadId,
              content: messageText,
              sender: 'cliente',
              message_type: 'text',
            });

            // Atualizar lead
            await supabaseClient.from('leads').update({ 
              last_message_at: new Date().toISOString(),
              has_unread: true 
            }).eq('id', leadId);
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
