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
  console.log('--- COUNTS ONLY ---');
  const tables = ['stores', 'products', 'sales', 'transactions', 'customers', 'service_orders', 'cash_registers', 'cash_entries', 'leads', 'lead_messages'];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${table}: Error ${error.message}`);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }
}

check();
