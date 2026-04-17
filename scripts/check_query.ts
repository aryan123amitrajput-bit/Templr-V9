import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit, where, orderBy } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  try {
    const templatesRef = collection(db, 'templates');
    let q = query(templatesRef, where('status', '==', 'approved'));
    q = query(q, orderBy('created_at', 'desc'));
    q = query(q, limit(7));

    const querySnapshot = await getDocs(q);
    console.log("Found:", querySnapshot.size);
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}

check().catch(console.error);
