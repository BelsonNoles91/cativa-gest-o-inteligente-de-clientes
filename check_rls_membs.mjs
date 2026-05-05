import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL="(.+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="(.+)"/)[1];

const supabase = createClient(url, key);

async function run() {
  const { data: login } = await supabase.auth.signInWithPassword({
    email: 'profissional@cativa.test',
    password: 'Cativa@Test2026'
  });
  
  if (login.user) {
    const { data: membs, error } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants:tenants!inner(id, name, slug, segment)")
      .eq("user_id", login.user.id)
      .eq("status", "active");
      
    console.log('Query Result:', membs);
    if (error) console.log('Error:', error);
  }
}
run();
