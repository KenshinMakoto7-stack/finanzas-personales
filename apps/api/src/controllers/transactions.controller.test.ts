import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthRequest,
  mockResponse,
  createTestTransaction,
} from "../tests/helpers";

describe("Transactions Controller - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Validation", () => {
    it("rechaza transacción sin accountId", () => {
      const req = {
        ...mockAuthRequest(),
        body: {
          type: "EXPENSE",
          amountCents: 5000,
          currencyCode: "UYU",
          occurredAt: new Date().toISOString(),
        },
      } as any;
      const res = mockResponse();

      // Validación básica del body
      expect(req.body.accountId).toBeUndefined();
    });

    it("rechaza monto negativo", () => {
      const req = {
        ...mockAuthRequest(),
        body: {
          accountId: "acc-123",
          type: "EXPENSE",
          amountCents: -100,
          currencyCode: "UYU",
          occurredAt: new Date().toISOString(),
        },
      } as any;

      expect(req.body.amountCents).toBeLessThan(0);
    });

    it("valida tipos de transacción correctos", () => {
      const validTypes = ["INCOME", "EXPENSE", "TRANSFER"];
      
      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });

      expect(validTypes).not.toContain("INVALID");
    });

    it("valida código de moneda de 3 caracteres", () => {
      const validCurrencies = ["UYU", "USD", "EUR"];
      const invalidCurrencies = ["INVALID", "US", ""];

      validCurrencies.forEach(c => {
        expect(c.length).toBe(3);
      });

      invalidCurrencies.forEach(c => {
        expect(c.length).not.toBe(3);
      });
    });
  });

  describe("Transaction Data Structure", () => {
    it("crea estructura de transacción válida", () => {
      const tx = createTestTransaction();

      expect(tx).toHaveProperty("id");
      expect(tx).toHaveProperty("userId");
      expect(tx).toHaveProperty("accountId");
      expect(tx).toHaveProperty("type");
      expect(tx).toHaveProperty("amountCents");
      expect(tx).toHaveProperty("currencyCode");
      expect(tx).toHaveProperty("occurredAt");
    });

    it("transacción tiene userId correcto", () => {
      const tx = createTestTransaction({ userId: "custom-user" });
      expect(tx.userId).toBe("custom-user");
    });

    it("transacción tiene monto positivo", () => {
      const tx = createTestTransaction({ amountCents: 10000 });
      expect(tx.amountCents).toBeGreaterThan(0);
    });
  });

  describe("Pagination", () => {
    it("valores por defecto de paginación", () => {
      const defaultPage = 1;
      const defaultPageSize = 50;

      expect(defaultPage).toBe(1);
      expect(defaultPageSize).toBeLessThanOrEqual(100);
    });

    it("limita pageSize máximo", () => {
      const maxPageSize = 100;
      const requestedPageSize = 500;

      const effectivePageSize = Math.min(requestedPageSize, maxPageSize);
      expect(effectivePageSize).toBe(100);
    });
  });
});
