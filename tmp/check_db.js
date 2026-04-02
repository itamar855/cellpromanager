import { createClient } from '@supabase/supabase-js';

const url = 'https://hzrqtolfbwnmmeliazmh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo';

const supabase = createClient(url, key);

async function check() {
  try {
    const [{ data: pGroup, error: pErr }, { data: oGroup, error: oErr }, { data: sData }] = await Promise.all([
      supabase.from('products').select('store_id, status'),
      supabase.from('service_orders').select('store_id, status'),
      supabase.from('stores').select('id, name')
    ]);

    if (pErr) console.error('Products Error:', pErr);
    if (oErr) console.error('OS Error:', oErr);

    const storeMap = Object.fromEntries((sData || []).map(s => [s.id, s.name]));
    
    console.log('--- PRODUCTS BY STORE ---');
    const pCounts = {};
    (pGroup || []).forEach(p => {
      const sName = storeMap[p.store_id] || p.store_id;
      pCounts[sName] = pCounts[sName] || { in_stock: 0, total: 0 };
      pCounts[sName].total++;
      if (p.status === 'in_stock') pCounts[sName].in_stock++;
    });
    console.log(JSON.stringify(pCounts, null, 2));

    console.log('\n--- SERVICE ORDERS BY STORE ---');
    const oCounts = {};
    (oGroup || []).forEach(o => {
      const sName = storeMap[o.store_id] || o.store_id;
      oCounts[sName] = (oCounts[sName] || 0) + 1;
    });
    console.log(JSON.stringify(oCounts, null, 2));
  } catch (e) {
    console.error('Script Error:', e);
  }
}

check();
