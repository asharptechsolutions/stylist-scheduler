// ============================================================
// Firebase Configuration
// ============================================================
// 
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use an existing one)
// 3. Click the gear icon → Project Settings → General
// 4. Scroll down to "Your apps" → click the web icon (</>)
// 5. Register your app and copy the config object
// 6. Paste your values below (replace the empty strings)
//
// ALSO ENABLE:
// - Authentication → Sign-in method → Email/Password (toggle ON)
// - Firestore Database → Create database (start in test mode for now)
//
// CREATING YOUR ADMIN ACCOUNT:
// - Go to Authentication → Users → Add user
// - Enter your email and a strong password
// - This is the account you'll use to log in to the dashboard
// ============================================================

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
}

// ============================================================
// OPTION A — Environment variables (recommended for deploys):
//   Create a .env file in the project root with:
//
//   VITE_FIREBASE_API_KEY=AIza...
//   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
//   VITE_FIREBASE_PROJECT_ID=your-project
//   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
//   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
//   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
//
// OPTION B — Hardcode directly (quick & dirty):
//   Replace the empty strings above with your actual values.
// ============================================================

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export default app
