import { getSupabase } from './api/services/supabaseService.js';
import 'dotenv/config';

async function check() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('templates').select('*');
  console.log('Error:', error);
  console.log('Count:', data?.length);
  if (data) {
    console.log(data.map((d: any) => ({ id: d.id, title: d.title })));
  }
}

check();
