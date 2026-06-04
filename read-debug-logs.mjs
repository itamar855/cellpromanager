import { createClient } from '@supabase/supabase-js';

const url = 'https://hzrqtolfbwnmmeliazmh.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIxMjUwMSwiZXhwIjoyMDg5Nzg4NTAxfQ.r2EtLy9dZeGYmRQaaqB_EJmmuRnIkErgSx2yrRG0oro';

const supabase = createClient(url, serviceKey);

async function run() {
  console.log('=== READING RECENT DEBUG LOGS ===');
  const { data, error } = await supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching logs:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
