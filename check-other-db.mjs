import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tjxdeuwpktwagmhyhipv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqeGRldXdwa3R3YWdtaHloaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDg3OTYxLCJleHAiOjIwODk2ODM5NjF9.KPJrJPMQeZ5H8R4pnJXzkz6DGWGRjweRaLHh4BC-XhY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- CHECKING THIRD ALTERNATIVE DB (tjxdeuwpktwagmhyhipv) ---');
  
  try {
    const { count: productCount, error: pErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
    console.log('Products count:', pErr ? 'Error: ' + pErr.message : productCount);
    
    const { count: salesCount, error: sErr } = await supabase.from('sales').select('*', { count: 'exact', head: true });
    console.log('Sales count:', sErr ? 'Error: ' + sErr.message : salesCount);
    
    if (salesCount > 0) {
      const { data: sales } = await supabase.from('sales').select('created_at, sale_price').order('created_at', { ascending: false }).limit(10);
      console.log('Last sales:', sales);
    }
  } catch (err) {
    console.error('Failed to connect:', err);
  }
}

check();
