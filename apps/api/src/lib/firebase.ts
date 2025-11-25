import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// Validar que existe al menos una forma de autenticarse ANTES de inicializar
if (!admin.apps.length) {
  // Validar que existe al menos una forma de autenticarse
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && 
      !process.env.FIREBASE_SERVICE_ACCOUNT_PATH && 
      !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'CRITICAL: Firebase credentials not found. ' +
      'Set FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS'
    );
  }

  // Si se usa PATH, validar que el archivo existe
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fullPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(fullPath)) {
      throw new Error(
        `CRITICAL: Firebase service account file not found: ${fullPath}`
      );
    }
  }

  // Opción 1: Usar credenciales desde variable de entorno (JSON string o Base64)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let jsonString = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      // Detectar si es Base64 (no empieza con {)
      if (!jsonString.trim().startsWith('{')) {
        // Decodificar Base64
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      }
      
      const serviceAccount = JSON.parse(jsonString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (error) {
      throw new Error(
        `CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  } 
  // Opción 2: Usar archivo de credenciales (para desarrollo local)
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (error) {
      throw new Error(
        `CRITICAL: Failed to load Firebase service account from ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  // Opción 3: Usar Application Default Credentials (para Firebase Functions/Cloud Run)
  else {
    admin.initializeApp();
  }
}

export const auth = getAuth();
export const db = getFirestore();

// Configurar Firestore para usar timestamps nativos
db.settings({ ignoreUndefinedProperties: true });

export default admin;

