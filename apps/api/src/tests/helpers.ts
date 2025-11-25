/**
 * Helpers para tests
 * Funciones utilitarias para crear datos de prueba y mocks
 */

import { vi } from "vitest";

// Tipos de datos de prueba
export interface TestUser {
  userId: string;
  email: string;
  currencyCode: string;
  timeZone: string;
}

export interface TestAccount {
  id: string;
  userId: string;
  name: string;
  type: string;
  currencyCode: string;
  balanceCents: number;
}

export interface TestCategory {
  id: string;
  userId: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  parentId: string | null;
}

export interface TestTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amountCents: number;
  currencyCode: string;
  occurredAt: string;
  description: string | null;
}

// Factories para crear datos de prueba
export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  userId: "test-user-123",
  email: "test@example.com",
  currencyCode: "UYU",
  timeZone: "America/Montevideo",
  ...overrides,
});

export const createTestAccount = (overrides: Partial<TestAccount> = {}): TestAccount => ({
  id: "account-123",
  userId: "test-user-123",
  name: "Cuenta Principal",
  type: "BANK",
  currencyCode: "UYU",
  balanceCents: 100000,
  ...overrides,
});

export const createTestCategory = (overrides: Partial<TestCategory> = {}): TestCategory => ({
  id: "category-123",
  userId: "test-user-123",
  name: "Alimentación",
  type: "EXPENSE",
  parentId: null,
  ...overrides,
});

export const createTestTransaction = (overrides: Partial<TestTransaction> = {}): TestTransaction => ({
  id: "tx-123",
  userId: "test-user-123",
  accountId: "account-123",
  categoryId: "category-123",
  type: "EXPENSE",
  amountCents: 5000,
  currencyCode: "UYU",
  occurredAt: new Date().toISOString(),
  description: "Compra supermercado",
  ...overrides,
});

// Mock de request autenticado
export const mockAuthRequest = (userId: string = "test-user-123") => ({
  user: { userId },
  body: {},
  params: {},
  query: {},
});

// Mock de response
export const mockResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

// Mock de Firestore document
export const mockFirestoreDoc = (data: any, exists: boolean = true) => ({
  exists,
  id: data?.id || "mock-id",
  data: () => (exists ? data : undefined),
  ref: { id: data?.id || "mock-id" },
});

// Mock de Firestore snapshot
export const mockFirestoreSnapshot = (docs: any[]) => ({
  docs: docs.map((d) => mockFirestoreDoc(d)),
  empty: docs.length === 0,
  size: docs.length,
});

// Helper para crear mock de db.collection
export const createMockCollection = (data: any[] = []) => {
  const mockCol: any = {
    doc: vi.fn((id) => ({
      get: vi.fn(() => Promise.resolve(mockFirestoreDoc(data.find((d) => d.id === id), !!data.find((d) => d.id === id)))),
      set: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    })),
    add: vi.fn((newData) => {
      const newId = `new-${Date.now()}`;
      return Promise.resolve({
        id: newId,
        get: () => Promise.resolve(mockFirestoreDoc({ id: newId, ...newData })),
      });
    }),
    where: vi.fn(() => mockCol),
    orderBy: vi.fn(() => mockCol),
    limit: vi.fn(() => mockCol),
    offset: vi.fn(() => mockCol),
    get: vi.fn(() => Promise.resolve(mockFirestoreSnapshot(data))),
    count: vi.fn(() => ({
      get: () => Promise.resolve({ data: () => ({ count: data.length }) }),
    })),
  };
  return mockCol;
};

// Timestamps helper
export const createTimestamp = (date: Date = new Date()) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

// Assertions helpers - usar en tests con import { expect } from "vitest"
export const expectValidationError = (res: any, field?: string) => {
  if (res.status.mock.calls[0]?.[0] !== 400) {
    throw new Error(`Expected status 400, got ${res.status.mock.calls[0]?.[0]}`);
  }
};

export const expectUnauthorized = (res: any) => {
  if (res.status.mock.calls[0]?.[0] !== 401) {
    throw new Error(`Expected status 401, got ${res.status.mock.calls[0]?.[0]}`);
  }
};

export const expectForbidden = (res: any) => {
  if (res.status.mock.calls[0]?.[0] !== 403) {
    throw new Error(`Expected status 403, got ${res.status.mock.calls[0]?.[0]}`);
  }
};

export const expectNotFound = (res: any) => {
  if (res.status.mock.calls[0]?.[0] !== 404) {
    throw new Error(`Expected status 404, got ${res.status.mock.calls[0]?.[0]}`);
  }
};

export const expectSuccess = (res: any, statusCode: number = 200) => {
  if (res.status.mock.calls[0]?.[0] !== statusCode) {
    throw new Error(`Expected status ${statusCode}, got ${res.status.mock.calls[0]?.[0]}`);
  }
};

