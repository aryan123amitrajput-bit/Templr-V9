import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const snap = await getDocs(query(collection(db, 'templates'), limit(5)));
  snap.forEach(doc => console.log(doc.id, doc.data().status));
  process.exit(0);
}

check().catch(console.error);
