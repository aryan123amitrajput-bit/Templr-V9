import 'dotenv/config';
import { getSupabase } from '../api/services/supabaseService';

async function check() {
  const supabase = getSupabase();
  const { count, error } = await supabase.from('templates').select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }

  console.log("Total templates in Supabase:", count);
  process.exit(0);
}

check().catch(console.error);
