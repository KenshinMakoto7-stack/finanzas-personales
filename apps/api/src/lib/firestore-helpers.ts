import { db } from "./firebase.js";
import { Timestamp, Query, WhereFilterOp, FieldPath } from "firebase-admin/firestore";

/**
 * Convierte una fecha a Timestamp de Firestore
 */
export function toFirestoreTimestamp(date: Date | string | undefined): Timestamp | null {
  if (!date) return null;
  if (date instanceof Timestamp) return date;
  if (typeof date === "string") return Timestamp.fromDate(new Date(date));
  return Timestamp.fromDate(date);
}

/**
 * Convierte un Timestamp de Firestore a Date
 */
export function fromFirestoreTimestamp(timestamp: Timestamp | Date | undefined): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  return null;
}

/**
 * Helper para crear queries con filtros
 */
export function buildQuery(
  collection: string,
  filters: Array<{ field: string; op: WhereFilterOp; value: any }>,
  orderBy?: { field: string; direction: "asc" | "desc" },
  limit?: number
): Query {
  let query: Query = db.collection(collection);

  // Aplicar filtros
  for (const filter of filters) {
    query = query.where(filter.field, filter.op, filter.value);
  }

  // Aplicar ordenamiento
  if (orderBy) {
    query = query.orderBy(orderBy.field, orderBy.direction);
  }

  // Aplicar límite
  if (limit) {
    query = query.limit(limit);
  }

  return query;
}

/**
 * Helper para paginación (offset-based, menos eficiente)
 * @deprecated Usar paginateWithCursor para mejor performance
 */
export async function paginateQuery<T>(
  query: Query,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
  const skip = (page - 1) * pageSize;
  
  // Obtener total (sin límite)
  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;

  // Obtener datos paginados
  const snapshot = await query.offset(skip).limit(pageSize).get();
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[];

  return { data, total, page, pageSize };
}

/**
 * Paginación eficiente con cursor (recomendada para Firestore)
 * No usa offset, mucho más eficiente para datasets grandes
 */
export async function paginateWithCursor<T>(
  query: Query,
  pageSize: number = 50,
  cursor?: string // ID del último documento de la página anterior
): Promise<{ 
  data: T[]; 
  nextCursor: string | null; 
  hasMore: boolean;
}> {
  let q = query;
  
  // Si hay cursor, empezar después de ese documento
  if (cursor) {
    const cursorDoc = await db.collection(query as any).doc(cursor).get();
    if (cursorDoc.exists) {
      q = query.startAfter(cursorDoc);
    }
  }
  
  // Pedir uno más para saber si hay más páginas
  const snapshot = await q.limit(pageSize + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  
  // Quitar el documento extra si existe
  const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const data = resultDocs.map(doc => docToObject(doc) as T);
  
  // Cursor para la siguiente página
  const lastDoc = resultDocs[resultDocs.length - 1];
  const nextCursor = hasMore && lastDoc ? lastDoc.id : null;
  
  return { data, nextCursor, hasMore };
}

/**
 * Paginación con cursor usando documento snapshot directamente
 */
export async function paginateWithSnapshot<T>(
  query: Query,
  pageSize: number = 50,
  lastDocSnapshot?: FirebaseFirestore.DocumentSnapshot
): Promise<{ 
  data: T[]; 
  lastDoc: FirebaseFirestore.DocumentSnapshot | null; 
  hasMore: boolean;
}> {
  let q = query;
  
  if (lastDocSnapshot) {
    q = query.startAfter(lastDocSnapshot);
  }
  
  const snapshot = await q.limit(pageSize + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
  
  const data = resultDocs.map(doc => docToObject(doc) as T);
  const lastDoc = resultDocs[resultDocs.length - 1] || null;
  
  return { data, lastDoc, hasMore };
}

/**
 * Helper para agregaciones simples (sum, count)
 * Nota: Firestore no tiene agregaciones nativas, así que hacemos en código
 */
export async function aggregate(
  collection: string,
  filters: Array<{ field: string; op: WhereFilterOp; value: any }>,
  field: string,
  operation: "sum" | "count" | "avg"
): Promise<number> {
  let query: Query = db.collection(collection);
  
  for (const filter of filters) {
    query = query.where(filter.field, filter.op, filter.value);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs.map(doc => doc.data());

  if (operation === "count") {
    return docs.length;
  }

  if (operation === "sum") {
    return docs.reduce((sum, doc) => sum + (Number(doc[field]) || 0), 0);
  }

  if (operation === "avg") {
    const sum = docs.reduce((sum, doc) => sum + (Number(doc[field]) || 0), 0);
    return docs.length > 0 ? sum / docs.length : 0;
  }

  return 0;
}

/**
 * Helper para búsqueda de texto (contains)
 * Nota: Firestore no tiene búsqueda de texto nativa, esto es una aproximación
 */
export async function textSearch(
  collection: string,
  searchField: string,
  searchTerm: string,
  userId: string,
  limit: number = 50
): Promise<any[]> {
  // Firestore no soporta "contains" case-insensitive directamente
  // Opción 1: Buscar por prefijo (más eficiente)
  // Opción 2: Traer todos y filtrar en código (menos eficiente pero más preciso)
  
  // Por ahora, usamos la opción 2 para mayor precisión
  const snapshot = await db.collection(collection)
    .where("userId", "==", userId)
    .limit(limit * 2) // Traer más para filtrar
    .get();

  const searchLower = searchTerm.toLowerCase();
  const results = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((doc: any) => {
      const fieldValue = doc[searchField]?.toLowerCase() || "";
      return fieldValue.includes(searchLower);
    })
    .slice(0, limit);

  return results;
}

/**
 * Helper para obtener o crear documento
 */
export async function getOrCreate(
  collection: string,
  id: string,
  defaultData: any
): Promise<any> {
  const docRef = db.collection(collection).doc(id);
  const doc = await docRef.get();

  if (doc.exists) {
    return { id: doc.id, ...doc.data() };
  }

  await docRef.set(defaultData);
  return { id, ...defaultData };
}

/**
 * Helper para transacciones (batch writes)
 */
export async function batchWrite(operations: Array<{
  type: "create" | "update" | "delete";
  collection: string;
  id: string;
  data?: any;
}>): Promise<void> {
  const batch = db.batch();

  for (const op of operations) {
    const docRef = db.collection(op.collection).doc(op.id);

    if (op.type === "create" || op.type === "update") {
      batch.set(docRef, op.data!, { merge: op.type === "update" });
    } else if (op.type === "delete") {
      batch.delete(docRef);
    }
  }

  await batch.commit();
}

/**
 * Convierte documento de Firestore a objeto plano
 */
export function docToObject(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    // Convertir Timestamps a Date
    createdAt: fromFirestoreTimestamp(data?.createdAt),
    updatedAt: fromFirestoreTimestamp(data?.updatedAt),
    occurredAt: fromFirestoreTimestamp(data?.occurredAt),
    nextOccurrence: fromFirestoreTimestamp(data?.nextOccurrence),
    month: fromFirestoreTimestamp(data?.month),
    startMonth: fromFirestoreTimestamp(data?.startMonth),
    lastMatched: fromFirestoreTimestamp(data?.lastMatched),
    resetTokenExpires: fromFirestoreTimestamp(data?.resetTokenExpires)
  };
}

/**
 * Convierte objeto a formato Firestore (convierte Dates a Timestamps)
 */
export function objectToFirestore(obj: any): any {
  const firestoreObj: any = { ...obj };
  
  // Convertir campos de fecha a Timestamp
  const dateFields = ["createdAt", "updatedAt", "occurredAt", "nextOccurrence", "month", "startMonth", "lastMatched", "resetTokenExpires"];
  for (const field of dateFields) {
    if (firestoreObj[field] && firestoreObj[field] instanceof Date) {
      firestoreObj[field] = Timestamp.fromDate(firestoreObj[field]);
    } else if (firestoreObj[field] && typeof firestoreObj[field] === "string") {
      firestoreObj[field] = Timestamp.fromDate(new Date(firestoreObj[field]));
    }
  }

  // Eliminar campos undefined
  Object.keys(firestoreObj).forEach(key => {
    if (firestoreObj[key] === undefined) {
      delete firestoreObj[key];
    }
  });

  return firestoreObj;
}

/**
 * Helper para dividir array en chunks
 * Útil para queries "in" de Firestore que tienen límite de 10 elementos
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Obtener documentos por IDs (respeta límite de 10 de Firestore para queries "in")
 * Reemplaza el uso incorrecto de .where("__name__", "in", ids)
 * 
 * @param collection - Nombre de la colección
 * @param ids - Array de IDs de documentos
 * @returns Array de documentos convertidos a objetos
 */
export async function getDocumentsByIds<T = any>(
  collection: string,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }

  // Eliminar duplicados
  const uniqueIds = [...new Set(ids)];

  // Firestore limita queries "in" a 10 elementos
  const chunks = chunkArray(uniqueIds, 10);
  
  // Ejecutar queries en paralelo
  const results = await Promise.all(
    chunks.map(chunk =>
      db.collection(collection)
        .where(FieldPath.documentId(), "in", chunk)
        .get()
    )
  );

  // Combinar todos los documentos
  const allDocs = results.flatMap(snapshot => snapshot.docs);
  
  // Convertir a objetos usando docToObject
  return allDocs.map(doc => docToObject(doc) as T);
}

