import { getSupabase } from './api/services/supabaseService.js';
import 'dotenv/config';

async function test() {
  const res = await fetch('http://localhost:3000/api/templates?limit=100');
  const json = await res.json();
  console.log('Total returned:', json.data?.length);
  const t = json.data[0];
  console.log(t);
}

test();
