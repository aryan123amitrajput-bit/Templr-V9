import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Mock config to prevent crashes if not set up
const firebaseConfig = {
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: "mock-project-id",
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
