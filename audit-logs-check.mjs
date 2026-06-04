import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://hzrqtolfbwnmmeliazmh.supabase.co';
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- AUDIT LOGS CHECK ---');
  
  // Let's check audit_logs table
  const { data: logs, count, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) {
    console.log('Error fetching audit_logs:', error.message);
  } else {
    console.log(`audit_logs has ${count} rows total. Last 50 rows:`);
    logs.forEach((log, idx) => {
      console.log(`  ${idx+1}. [${log.created_at}] Action: ${log.action}, Table: ${log.table_name}, User: ${log.user_id}`);
      if (log.payload) {
        console.log(`     Payload: ${JSON.stringify(log.payload).substring(0, 150)}`);
      }
    });
  }
}

check();
