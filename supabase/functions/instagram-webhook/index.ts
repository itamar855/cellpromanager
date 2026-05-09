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
    await supabaseClient.from('instagram_webhooks_logs').insert({ payload });

    if (payload.object === 'instagram') {
      for (const entry of payload.entry) {
        if (!entry.messaging) continue;
        
        for (const messaging of entry.messaging) {
          const senderId = messaging.sender.id;
          const message = messaging.message;

          if (message && message.text) {
            const { data: lead } = await supabaseClient
              .from('leads')
              .select('id, name, avatar_url')
              .eq('instagram_user_id', senderId)
              .maybeSingle();

            let leadId = lead?.id;
            let userName = lead?.name || "IG User " + senderId.substring(0, 5);
            let avatarUrl = lead?.avatar_url || null;

            if (!leadId || userName.startsWith('IG User') || !avatarUrl) {
              try {
                const { data: config } = await supabaseClient
                  .from('instagram_config')
                  .select('page_access_token')
                  .eq('is_active', true)
                  .limit(1)
                  .single();

                if (config?.page_access_token) {
                  const graphUrl = "https://graph.facebook.com/v19.0/" + senderId + "?fields=name,profile_pic&access_token=" + config.page_access_token;
                  const response = await fetch(graphUrl);
                  const userData = await response.json();
                  
                  if (userData && userData.name) {
                    userName = userData.name;
                  }
                  if (userData && userData.profile_pic) {
                    avatarUrl = userData.profile_pic;
                  }
                }
              } catch (profileError) {
                console.error('Erro profile:', profileError);
              }
            }

            if (!leadId) {
              const { data: newLead, error: createError } = await supabaseClient
                .from('leads')
                .insert({
                  name: userName,
                  instagram_user_id: senderId,
                  avatar_url: avatarUrl,
                  source: 'instagram',
                  status: 'novo',
                })
                .select('id')
                .single();
              
              if (createError) throw createError;
              leadId = newLead.id;
            } else if (userName !== lead.name || avatarUrl !== lead.avatar_url) {
              await supabaseClient
                .from('leads')
                .update({ 
                  name: userName,
                  avatar_url: avatarUrl
                })
                .eq('id', leadId);
            }

            await supabaseClient.from('lead_messages').insert({
              lead_id: leadId,
              content: message.text,
              sender: 'cliente',
              message_type: 'text',
            });

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
