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
  console.log('--- DEEP SEARCHING ---');
  
  // Search products by IMEIs from the screenshot:
  // 1. 357004281959768 (or 35 700428 195976 8)
  // 2. 353967818425806
  // 3. 352051689955075 (or 35 205168 995507 5)
  
  const imeis = ['357004281959768', '353967818425806', '352051689955075', '35 700428 195976 8', '35 205168 995507 5'];
  for (const imei of imeis) {
    const { data: prod, error } = await supabase.from('products').select('*').eq('imei', imei);
    console.log(`Searching IMEI [${imei}]:`, error ? 'Error: ' + error.message : prod);
  }

  // Search customers by name
  const names = ['Lucas Henrique', 'Luana Yasmim', 'Lucas Henrique bispo dos santos'];
  for (const name of names) {
    const { data: cust, error } = await supabase.from('customers').select('*').ilike('name', `%${name}%`);
    console.log(`Searching customer [${name}]:`, error ? 'Error: ' + error.message : cust);
  }
}

check();
