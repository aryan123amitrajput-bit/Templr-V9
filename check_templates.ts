import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .limit(3);

  if (error) {
    console.error('Error fetching templates:', error);
    return;
  }

  console.log('Templates:', JSON.stringify(data, null, 2));
}

checkTemplates();
