import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
// IMPORTANTE: Substitua estes valores pelas suas credenciais do Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyB0RUKYWZfikfxAHg7YALKJ8EhdS4fgCYM",
  authDomain: "gestaoescola-e5f3d.firebaseapp.com",
  projectId: "gestaoescola-e5f3d",
  storageBucket: "gestaoescola-e5f3d.firebasestorage.app",
  messagingSenderId: "563074924483",
  appId: "1:563074924483:web:985d6ced72182e01580776"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
