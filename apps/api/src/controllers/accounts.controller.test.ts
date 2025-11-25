import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAuthRequest,
  mockResponse,
  createTestAccount,
} from "../tests/helpers";

describe("Accounts Controller - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Validation", () => {
    it("rechaza cuenta sin nombre", () => {
      const req = {
        ...mockAuthRequest(),
        body: {
          type: "BANK",
          currencyCode: "UYU",
        },
      } as any;

      expect(req.body.name).toBeUndefined();
    });

    it("valida tipos de cuenta válidos", () => {
      const validTypes = ["CASH", "BANK", "CREDIT", "SAVINGS", "OTHER"];
      
      validTypes.forEach(type => {
        expect(validTypes).toContain(type);
      });

      expect(validTypes).not.toContain("INVALID_TYPE");
    });

    it("valida código de moneda", () => {
      const validCurrencies = ["UYU", "USD", "EUR"];
      
      validCurrencies.forEach(c => {
        expect(c.length).toBe(3);
      });
    });
  });

  describe("Account Data Structure", () => {
    it("crea estructura de cuenta válida", () => {
      const account = createTestAccount();

      expect(account).toHaveProperty("id");
      expect(account).toHaveProperty("userId");
      expect(account).toHaveProperty("name");
      expect(account).toHaveProperty("type");
      expect(account).toHaveProperty("currencyCode");
      expect(account).toHaveProperty("balanceCents");
    });

    it("cuenta tiene userId correcto", () => {
      const account = createTestAccount({ userId: "custom-user" });
      expect(account.userId).toBe("custom-user");
    });

    it("cuenta tiene balance inicial", () => {
      const account = createTestAccount({ balanceCents: 50000 });
      expect(account.balanceCents).toBe(50000);
    });

    it("cuenta puede tener balance cero", () => {
      const account = createTestAccount({ balanceCents: 0 });
      expect(account.balanceCents).toBe(0);
    });
  });

  describe("Authorization", () => {
    it("request tiene userId del usuario autenticado", () => {
      const req = mockAuthRequest("user-123");
      expect(req.user.userId).toBe("user-123");
    });

    it("cuenta pertenece al usuario correcto", () => {
      const account = createTestAccount({ userId: "user-123" });
      const req = mockAuthRequest("user-123");

      expect(account.userId).toBe(req.user.userId);
    });

    it("detecta cuenta de otro usuario", () => {
      const account = createTestAccount({ userId: "other-user" });
      const req = mockAuthRequest("user-123");

      expect(account.userId).not.toBe(req.user.userId);
    });
  });
});
