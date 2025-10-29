// Firebase initialization for the web app
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrwtom29YISZyyCQgH3Q6btxirIRDCadg",
  authDomain: "lotus-9740e.firebaseapp.com",
  projectId: "lotus-9740e",
  storageBucket: "lotus-9740e.firebasestorage.app",
  messagingSenderId: "1039087792369",
  appId: "1:1039087792369:web:3f2d71bb227714624f7950",
  measurementId: "G-X1EWBC1MTP"
};

// Initialize (or reuse) the Firebase app instance
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Lazily initialize Analytics only when supported (e.g., browser, localhost/HTTPS)
export async function initAnalytics() {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    return supported ? getAnalytics(app) : null;
  } catch (_) {
    return null;
  }
}

export default app;

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);


