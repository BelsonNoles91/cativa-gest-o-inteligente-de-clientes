const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function run() {
  const { data: { user }, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'test.blocker@cativa.test',
    password: 'Cativa@Test2026'
  });

  if (loginErr) return console.log(loginErr);

  const { data, error } = await supabase.from('tenant_memberships').select('*');
  console.log('Error?', error);
}
run();
