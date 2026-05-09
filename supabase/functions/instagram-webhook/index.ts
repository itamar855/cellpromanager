import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const { method } = req;
  
  // Handle CORS
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Handle Verification (GET)
  if (method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // Replace with a secure verification token in a real app or use a env var
    if (mode === 'subscribe' && token === 'instagram_crm_verify') {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // Handle Webhook Notifications (POST)
  try {
    const payload = await req.json();
    
    // Log the payload for debug
    await supabaseClient.from('instagram_webhooks_logs').insert({ payload });

    // Process Instagram Messaging events
    if (payload.object === 'instagram') {
      for (const entry of payload.entry) {
        for (const messaging of entry.messaging) {
          const senderId = messaging.sender.id;
          const message = messaging.message;

          if (message && message.text) {
            // 1. Find or create lead
            const { data: lead, error: leadError } = await supabaseClient
              .from('leads')
              .select('id')
              .eq('instagram_user_id', senderId)
              .maybeSingle();

            let leadId = lead?.id;

            if (!leadId) {
              // Get profile info if possible (simplified here)
              const { data: newLead, error: createError } = await supabaseClient
                .from('leads')
                .insert({
                  name: `IG User ${senderId.substring(0, 5)}`,
                  instagram_user_id: senderId,
                  source: 'instagram',
                  status: 'novo',
                })
                .select('id')
                .single();
              
              if (createError) throw createError;
              leadId = newLead.id;
            }

            // 2. Insert message
            await supabaseClient.from('lead_messages').insert({
              lead_id: leadId,
              content: message.text,
              sender: 'cliente',
              message_type: 'text',
            });

            // 3. Update lead last_message_at
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