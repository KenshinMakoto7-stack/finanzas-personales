import { initializeApp, getApps, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let _app: App | null = null;

function getApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is required");
  }

  const serviceAccount: ServiceAccount = JSON.parse(raw);
  _app = initializeApp({ credential: cert(serviceAccount) });
  return _app;
}

export function getDb(): Firestore {
  return getFirestore(getApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getApp());
}
