
import 'dotenv/config';
import { getSupabase } from '../api/services/supabaseService';

async function checkColumns() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('templates').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample data ID:', (data[0] as any).id);
  } else {
    console.log('No data found in templates table.');
  }
  process.exit(0);
}

checkColumns();
