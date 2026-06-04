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
  console.log('--- DETAILED DB INFO ---');

  // 1. Products by status
  const { data: products, error: pErr } = await supabase.from('products').select('status, name, brand, model, store_id, created_at');
  if (pErr) {
    console.log('Error products:', pErr.message);
  } else {
    console.log('Total products in DB:', products.length);
    const counts = {};
    products.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    console.log('Products by status:', counts);
    console.log('All products list with creation dates:');
    products.forEach((p, idx) => {
      console.log(`  ${idx+1}. [${p.status}] ${p.brand} ${p.model} (${p.name}) - Criado em: ${p.created_at}`);
    });
  }

  // 2. Sales list
  const { data: sales, error: sErr } = await supabase.from('sales').select('id, product_id, sale_price, created_at');
  if (sErr) {
    console.log('Error sales:', sErr.message);
  } else {
    console.log('\nTotal sales in DB:', sales.length);
    sales.forEach((s, idx) => {
      console.log(`  ${idx+1}. ID: ${s.id}, Product: ${s.product_id}, Price: ${s.sale_price}, Sold at: ${s.created_at}`);
    });
  }

  // 3. Transactions list
  const { data: txs, error: tErr } = await supabase.from('transactions').select('type, amount, description, created_at');
  if (tErr) {
    console.log('Error txs:', tErr.message);
  } else {
    console.log('\nTotal transactions in DB:', txs.length);
    txs.forEach((t, idx) => {
      console.log(`  ${idx+1}. Type: ${t.type}, Amount: ${t.amount}, Desc: ${t.description}, Date: ${t.created_at}`);
    });
  }
}

check();
