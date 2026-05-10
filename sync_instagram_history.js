import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sync() {
  const { data: config } = await supabase
    .from('instagram_config')
    .select('page_access_token, instagram_business_account_id')
    .eq('is_active', true)
    .single();

  if (!config || !config.page_access_token) {
    console.error("Configuração do Instagram não encontrada ou inativa.");
    return;
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('id, instagram_user_id, name')
    .eq('source', 'instagram')
    .not('instagram_user_id', 'is', null);

  if (!leads) return;

  console.log(`Sincronizando ${leads.length} leads...`);

  for (const lead of leads) {
    console.log(`\n--- Processando lead: ${lead.name} (${lead.instagram_user_id}) ---`);
    
    // 1. Atualizar Perfil (Nome Real)
    try {
        const profileRes = await fetch(`https://graph.facebook.com/v19.0/${lead.instagram_user_id}?fields=name,username&access_token=${config.page_access_token}`);
        const profile = await profileRes.json();
        if (profile.name) {
            await supabase.from('leads').update({ 
                name: profile.name,
                instagram_username: profile.username 
            }).eq('id', lead.id);
            console.log(`Nome atualizado para: ${profile.name}`);
        } else if (profile.error) {
            console.error(`Erro API Perfil: ${profile.error.message}`);
        }
    } catch (e) {
        console.error(`Erro ao buscar perfil:`, e);
    }

    // 2. Sincronizar Histórico Completo
    try {
        // Buscar a conversa específica do usuário
        const convUrl = `https://graph.facebook.com/v19.0/${config.instagram_business_account_id}/conversations?user_id=${lead.instagram_user_id}&fields=messages{message,from,created_time,attachments}&access_token=${config.page_access_token}`;
        const convRes = await fetch(convUrl);
        const convData = await convRes.json();
        
        if (convData.data && convData.data[0] && convData.data[0].messages) {
            let messages = convData.data[0].messages.data;
            console.log(`Encontradas ${messages.length} mensagens no histórico.`);
            
            for (const msg of messages) {
                // Se a mensagem veio do ID da Business Account, o sender é o vendedor
                const isFromMe = msg.from.id === config.instagram_business_account_id;
                
                // Verificar se a mensagem já existe para evitar duplicidade
                const { data: existing } = await supabase
                    .from('lead_messages')
                    .select('id')
                    .eq('lead_id', lead.id)
                    .eq('content', msg.message || '')
                    .eq('created_at', msg.created_time)
                    .maybeSingle();
                
                if (!existing) {
                    const { error: insError } = await supabase.from('lead_messages').insert({
                        lead_id: lead.id,
                        content: msg.message || (msg.attachments ? '[Mídia/Anexo]' : ''),
                        sender_type: isFromMe ? 'vendedor' : 'cliente',
                        message_type: msg.attachments ? 'image' : 'text',
                        channel: 'instagram',
                        created_at: msg.created_time
                    });
                    
                    if (insError) console.error("Erro insert msg:", insError.message);
                    else console.log(`[${isFromMe ? 'ME' : 'LEAD'}] ${msg.message?.substring(0, 20)}...`);
                }
            }
        } else if (convData.error) {
            console.error(`Erro API Conv: ${convData.error.message}`);
        }
    } catch (e) {
        console.error(`Erro ao sincronizar histórico:`, e);
    }
  }
  console.log("\nSincronização completa!");
}

sync();
