import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";

const META_PREFIX = "user_data_";
const CACHE_COLLECTION = "_cache";

export async function getUserDataUpdatedAt(userId: string) {
  try {
    const doc = await db.collection(CACHE_COLLECTION).doc(`${META_PREFIX}${userId}`).get();
    if (!doc.exists) return 0;
    return doc.data()?.updatedAt?.toMillis?.() || 0;
  } catch {
    return 0;
  }
}

export async function touchUserData(userId: string) {
  try {
    await db.collection(CACHE_COLLECTION).doc(`${META_PREFIX}${userId}`).set({
      updatedAt: Timestamp.now()
    }, { merge: true });
  } catch {
    // Silencioso: no bloquear flujo principal
  }
}

export async function readCachePayload(cacheKey: string, ttlMs: number, minUpdatedAt?: number) {
  try {
    const doc = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();
    if (!doc.exists) return null;
    const data = doc.data();
    const timestamp = data?.timestamp?.toMillis?.() || 0;
    if (minUpdatedAt && timestamp < minUpdatedAt) return null;
    if (Date.now() - timestamp > ttlMs) return null;
    return data?.payload || null;
  } catch {
    return null;
  }
}

export async function writeCachePayload(cacheKey: string, payload: any) {
  try {
    await db.collection(CACHE_COLLECTION).doc(cacheKey).set({
      payload,
      timestamp: Timestamp.now()
    });
  } catch {
    // Silencioso: no bloquear flujo principal
  }
}
