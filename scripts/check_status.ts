import 'dotenv/config';
import { getSupabase } from '../server/services/supabaseService';

async function check() {
  const supabase = getSupabase();
  const { data: templates, error } = await supabase.from('templates').select('status') as { data: any[] | null, error: any };
  
  if (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }

  const statuses = new Set();
  templates?.forEach(t => {
    statuses.add(t.status);
  });
  console.log("Statuses in Supabase:", Array.from(statuses));
  process.exit(0);
}

check().catch(console.error);
