/**
 * Setup global para tests
 * Configura mocks y variables de entorno para testing
 */

import { vi, beforeAll, afterAll, afterEach } from "vitest";

// Mock de variables de entorno
process.env.NODE_ENV = "test";
process.env.PORT = "3001";
process.env.FIREBASE_PROJECT_ID = "test-project";
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  project_id: "test-project",
  private_key_id: "test",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBALRiMLAHudeSA2FjL5q5ZbZ5kbU=\n-----END RSA PRIVATE KEY-----",
  client_email: "test@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
});

// Mock de Firebase Admin
vi.mock("firebase-admin", () => {
  const mockDoc = (data: any = null) => ({
    exists: !!data,
    id: data?.id || "mock-id",
    data: () => data,
    ref: { id: data?.id || "mock-id" },
  });

  const mockCollection = {
    doc: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve(mockDoc(null))),
      set: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    })),
    add: vi.fn(() => Promise.resolve({ id: "new-doc-id", get: () => Promise.resolve(mockDoc({ id: "new-doc-id" })) })),
    where: vi.fn(() => mockCollection),
    orderBy: vi.fn(() => mockCollection),
    limit: vi.fn(() => mockCollection),
    offset: vi.fn(() => mockCollection),
    get: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
    count: vi.fn(() => ({ get: () => Promise.resolve({ data: () => ({ count: 0 }) }) })),
  };

  const mockFirestore = {
    collection: vi.fn(() => mockCollection),
    batch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    })),
    runTransaction: vi.fn((fn) => fn({
      get: vi.fn(() => Promise.resolve(mockDoc(null))),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  };

  const mockAuth = {
    createCustomToken: vi.fn(() => Promise.resolve("mock-token")),
    verifyIdToken: vi.fn(() => Promise.resolve({ uid: "test-user-id" })),
    createUser: vi.fn(() => Promise.resolve({ uid: "new-user-id" })),
    getUser: vi.fn(() => Promise.resolve({ uid: "test-user-id", email: "test@test.com" })),
    getUserByEmail: vi.fn(() => Promise.resolve({ uid: "test-user-id" })),
    deleteUser: vi.fn(() => Promise.resolve()),
  };

  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
      },
      auth: vi.fn(() => mockAuth),
      firestore: vi.fn(() => mockFirestore),
    },
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    auth: vi.fn(() => mockAuth),
    firestore: vi.fn(() => mockFirestore),
  };
});

// Mock de Sentry
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((fn) => fn({ setUser: vi.fn(), setTag: vi.fn(), setExtras: vi.fn() })),
  expressIntegration: vi.fn(() => ({ setupOnce: vi.fn() })),
  expressErrorHandler: vi.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  httpIntegration: vi.fn(() => ({})),
  startInactiveSpan: vi.fn(() => ({ finish: vi.fn() })),
}));

// Limpiar mocks después de cada test
afterEach(() => {
  vi.clearAllMocks();
});

// Cleanup global
afterAll(() => {
  vi.restoreAllMocks();
});

console.log("✅ Test setup completed");

