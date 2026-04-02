import { createClient } from '@supabase/supabase-js';

const url = 'https://hzrqtolfbwnmmeliazmh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo';

const supabase = createClient(url, key);

async function check() {
  try {
    const [
      { data: pData, error: pErr },
      { data: sData, error: sErr },
      { data: oData, error: oErr },
      { data: accData, error: accErr }
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('sales').select('*', { count: 'exact', head: true }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }),
      supabase.from('accessories').select('*', { count: 'exact', head: true })
    ]);

    console.log('--- DB SUMMARY (ANON ACCESS) ---');
    console.log('Products Count:', pErr ? 'Blocked/Error' : pData?.length || 0);
    console.log('Sales Count:', sErr ? 'Blocked/Error' : sData?.length || 0);
    console.log('OS Count:', oErr ? 'Blocked/Error' : oData?.length || 0);
    console.log('Accessories Count:', accErr ? 'Blocked/Error' : accData?.length || 0);
    
    // Teste de visualização de 1 registro se permitido
    if (!pErr) {
      const { data } = await supabase.from('products').select('*').limit(1);
      console.log('Sample Product:', data);
    }
  } catch (e) {
    console.error('Script Error:', e);
  }
}

check();
