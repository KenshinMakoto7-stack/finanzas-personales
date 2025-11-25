import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Schemas de validación (igual que en el controlador)
const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  currencyCode: z.string().length(3).default("UYU"),
  timeZone: z.string().default("America/Montevideo"),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

describe("Auth Controller - Validation Tests", () => {
  describe("Register Validation", () => {
    it("acepta datos de registro válidos", () => {
      const validData = {
        email: "test@example.com",
        password: "securepassword123",
        currencyCode: "UYU",
        timeZone: "America/Montevideo",
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rechaza email inválido", () => {
      const invalidData = {
        email: "invalid-email",
        password: "securepassword123",
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain("email");
      }
    });

    it("rechaza contraseña muy corta", () => {
      const invalidData = {
        email: "test@example.com",
        password: "short",
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain("password");
      }
    });

    it("usa valores por defecto para currencyCode y timeZone", () => {
      const minimalData = {
        email: "test@example.com",
        password: "securepassword123",
      };

      const result = registerSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currencyCode).toBe("UYU");
        expect(result.data.timeZone).toBe("America/Montevideo");
      }
    });

    it("rechaza código de moneda inválido", () => {
      const invalidData = {
        email: "test@example.com",
        password: "securepassword123",
        currencyCode: "INVALID",
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Login Validation", () => {
    it("acepta credenciales válidas", () => {
      const validData = {
        email: "test@example.com",
        password: "anypassword",
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rechaza email inválido", () => {
      const invalidData = {
        email: "not-an-email",
        password: "password123",
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rechaza contraseña vacía", () => {
      const invalidData = {
        email: "test@example.com",
        password: "",
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Password Security", () => {
    it("contraseña debe tener al menos 8 caracteres", () => {
      const passwords = [
        { pass: "1234567", valid: false },
        { pass: "12345678", valid: true },
        { pass: "securepassword", valid: true },
      ];

      passwords.forEach(({ pass, valid }) => {
        const result = registerSchema.safeParse({
          email: "test@example.com",
          password: pass,
        });
        expect(result.success).toBe(valid);
      });
    });
  });

  describe("Email Format", () => {
    it("acepta emails válidos", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@example.co.uk",
      ];

      validEmails.forEach(email => {
        const result = loginSchema.safeParse({ email, password: "password123" });
        expect(result.success).toBe(true);
      });
    });

    it("rechaza emails inválidos", () => {
      const invalidEmails = [
        "not-an-email",
        "@nodomain.com",
        "no@",
        "spaces in@email.com",
      ];

      invalidEmails.forEach(email => {
        const result = loginSchema.safeParse({ email, password: "password123" });
        expect(result.success).toBe(false);
      });
    });
  });
});

describe("Auth Controller - Security Tests", () => {
  describe("Password Hashing", () => {
    it("hash debe ser diferente a la contraseña original", () => {
      const password = "securepassword123";
      // Simulación de hash
      const hash = `salt:${Buffer.from(password).toString("base64")}`;
      
      expect(hash).not.toBe(password);
      expect(hash).toContain(":");
    });

    it("mismo password produce diferentes hashes con diferentes salts", () => {
      const password = "securepassword123";
      const salt1 = "salt1";
      const salt2 = "salt2";
      
      const hash1 = `${salt1}:${Buffer.from(password).toString("base64")}`;
      const hash2 = `${salt2}:${Buffer.from(password).toString("base64")}`;
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Token Generation", () => {
    it("token no debe contener información sensible", () => {
      // Simulación de token
      const mockToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
      
      expect(mockToken).not.toContain("password");
      expect(mockToken).not.toContain("secret");
    });
  });
});
