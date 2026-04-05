import { createClient } from '@supabase/supabase-js';

const url = 'https://hzrqtolfbwnmmeliazmh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo';

const supabase = createClient(url, key);

async function inspect() {
  console.log('Inspecting audit_logs structure...');
  const { data: auditData, error: auditError } = await supabase.from('audit_logs').select('*').limit(1);
  if (auditError) {
    console.error('Error fetching audit_logs:', auditError);
  } else {
    console.log('Audit Logs Columns:', Object.keys(auditData[0] || {}));
  }

  console.log('\nInspecting products structure...');
  const { data: productData, error: productError } = await supabase.from('products').select('*').limit(1);
  if (productError) {
    console.error('Error fetching products:', productError);
  } else if (productData && productData.length > 0) {
    console.log('Products Columns:', Object.keys(productData[0]));
  } else {
    console.log('Products Table empty, trying to find another way...');
    const { data: columns, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'products' });
    if (colError) {
       console.log('RPC get_table_columns not available. Checking types file instead.');
    } else {
       console.log('Products Columns (via RPC):', columns);
    }
  }
}

inspect();
