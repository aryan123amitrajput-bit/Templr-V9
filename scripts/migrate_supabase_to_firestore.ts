import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

// Load env vars
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load Firebase config
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function migrate() {
  console.log('Fetching templates from Supabase...');
  const { data: templates, error } = await supabase.from('templates').select('*');
  
  if (error) {
    console.error('Error fetching from Supabase:', error);
    return;
  }

  console.log(`Found ${templates.length} templates. Migrating to Firestore...`);

  let successCount = 0;
  let errorCount = 0;

  for (const template of templates) {
    try {
      const docRef = doc(db, 'templates', template.id.toString());
      await setDoc(docRef, template);
      successCount++;
      console.log(`Migrated template ${template.id}`);
    } catch (e) {
      console.error(`Error migrating template ${template.id}:`, e);
      errorCount++;
    }
  }

  console.log(`Migration complete. Success: ${successCount}, Errors: ${errorCount}`);
}

migrate().catch(console.error);
