async function check() {
  const url = "https://uegkelcokufmtmxjnsww.supabase.co/rest/v1/products?select=*";
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZ2tlbGNva3VmbXRteGpuc3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDg3MjIsImV4cCI6MjA4OTc4NDcyMn0.7BgojTS6QeLOVCEjzcRkzcP0iwWxuxd1gSzSChsoOo0"
      }
    });
    console.log('Status:', res.status);
    console.log('Status text:', res.statusText);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Error fetching:', err);
  }
}

check();
