import { initializeApp, getApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

export function hasFirebaseConfig() {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  )
}

function createPrimaryApp() {
  if (getApps().length) return getApp()
  return initializeApp(firebaseConfig)
}

export const app = hasFirebaseConfig() ? createPrimaryApp() : null
export const auth = app ? getAuth(app) : null

/** Secondary app: createUserWithEmailAndPassword without switching the primary session */
export function getSecondaryAuth() {
  if (!hasFirebaseConfig()) return null
  try {
    const secondary = initializeApp(firebaseConfig, 'RegisterSecondary')
    return getAuth(secondary)
  } catch {
    try {
      return getAuth(getApp('RegisterSecondary'))
    } catch {
      return null
    }
  }
}
