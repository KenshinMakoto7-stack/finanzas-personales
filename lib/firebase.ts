import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;

  if (!_app) {
    _app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
          });
  }

  _auth = getAuth(_app);
  return _auth;
}
