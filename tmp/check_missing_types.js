import { createClient } from '@supabase/supabase-js';

const url = 'https://hzrqtolfbwnmmeliazmh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo';

const supabase = createClient(url, key);

async function inspect() {
  console.log('--- Inspecting webhooks ---');
  const { data: wbData, error: wbError } = await supabase.from('webhooks').select('*').limit(1);
  if (wbError) {
    console.error('Error fetching webhooks:', wbError.message);
  } else if (wbData && wbData.length > 0) {
    console.log('Webhooks columns:', Object.keys(wbData[0]));
    console.log('Sample data:', wbData[0]);
  } else {
    console.log('Webhooks table is empty.');
  }

  console.log('\n--- Inspecting whatsapp_config ---');
  const { data: waData, error: waError } = await supabase.from('whatsapp_config').select('*').limit(1);
  if (waError) {
    console.error('Error fetching whatsapp_config:', waError.message);
  } else if (waData && waData.length > 0) {
    console.log('Whatsapp_config columns:', Object.keys(waData[0]));
    console.log('Sample data:', waData[0]);
  } else {
    console.log('Whatsapp_config table is empty.');
  }
}

inspect();
