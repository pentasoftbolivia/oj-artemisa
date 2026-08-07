import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Logging in...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'arseniocastellon@gmail.com',
    password: 'denkikis',
  });

  if (error) {
    console.error("Login error:", error.message);
    return;
  }

  const user = data.user;
  console.log("Logged in UID:", user.id);

  console.log("Fetching rol table with UID...");
  let { data: roleData1, error: roleError1 } = await supabase
    .from("rol")
    .select("*")
    .eq("UID", user.id);

  console.log("Result for UID:", roleData1, roleError1);

  console.log("Fetching rol table with uid...");
  let { data: roleData2, error: roleError2 } = await supabase
    .from("rol")
    .select("*")
    .eq("uid", user.id);

  console.log("Result for uid:", roleData2, roleError2);
}

test();
