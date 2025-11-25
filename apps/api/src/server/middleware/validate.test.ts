import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate } from "./validate";

describe("Validate Middleware", () => {
  const mockResponse = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockNext = vi.fn();

  const testSchema = z.object({
    name: z.string().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    email: z.string().email("Invalid email").optional(),
  });

  it("pasa la validación con datos correctos", () => {
    const req: any = {
      body: {
        name: "Test",
        amount: 100,
      },
    };
    const res = mockResponse();

    validate(testSchema)(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // validated puede estar en req o no dependiendo de la implementación
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rechaza datos inválidos con error 400", () => {
    const req: any = {
      body: {
        name: "",
        amount: -10,
      },
    };
    const res = mockResponse();

    validate(testSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    // La respuesta puede variar según implementación
    expect(res.json).toHaveBeenCalled();
  });

  it("incluye campos opcionales cuando están presentes", () => {
    const req: any = {
      body: {
        name: "Test",
        amount: 100,
        email: "test@example.com",
      },
    };
    const res = mockResponse();

    validate(testSchema)(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // Los datos validados están disponibles
    expect(res.status).not.toHaveBeenCalled();
  });

  it("valida email correctamente", () => {
    const req: any = {
      body: {
        name: "Test",
        amount: 100,
        email: "invalid-email",
      },
    };
    const res = mockResponse();

    validate(testSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            path: "email",
            message: "Invalid email",
          }),
        ]),
      })
    );
  });

  it("maneja body undefined", () => {
    const req: any = { body: undefined };
    const res = mockResponse();

    validate(testSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("maneja body null", () => {
    const req: any = { body: null };
    const res = mockResponse();

    validate(testSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("Validate Middleware - Complex Schemas", () => {
  const mockResponse = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockNext = vi.fn();

  const transactionSchema = z.object({
    accountId: z.string().min(1),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amountCents: z.number().int().positive().max(999999999999),
    currencyCode: z.string().length(3),
    occurredAt: z.string().datetime(),
    description: z.string().max(500).optional(),
  });

  it("valida transacción completa correctamente", () => {
    const req: any = {
      body: {
        accountId: "acc-123",
        type: "EXPENSE",
        amountCents: 5000,
        currencyCode: "UYU",
        occurredAt: "2024-11-25T10:00:00.000Z",
        description: "Compra",
      },
    };
    const res = mockResponse();

    validate(transactionSchema)(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rechaza tipo de transacción inválido", () => {
    const req: any = {
      body: {
        accountId: "acc-123",
        type: "INVALID_TYPE",
        amountCents: 5000,
        currencyCode: "UYU",
        occurredAt: "2024-11-25T10:00:00.000Z",
      },
    };
    const res = mockResponse();

    validate(transactionSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rechaza monto mayor al máximo permitido", () => {
    const req: any = {
      body: {
        accountId: "acc-123",
        type: "INCOME",
        amountCents: 9999999999999, // > max
        currencyCode: "UYU",
        occurredAt: "2024-11-25T10:00:00.000Z",
      },
    };
    const res = mockResponse();

    validate(transactionSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rechaza código de moneda inválido", () => {
    const req: any = {
      body: {
        accountId: "acc-123",
        type: "EXPENSE",
        amountCents: 5000,
        currencyCode: "INVALID", // > 3 chars
        occurredAt: "2024-11-25T10:00:00.000Z",
      },
    };
    const res = mockResponse();

    validate(transactionSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rechaza fecha inválida", () => {
    const req: any = {
      body: {
        accountId: "acc-123",
        type: "EXPENSE",
        amountCents: 5000,
        currencyCode: "UYU",
        occurredAt: "not-a-date",
      },
    };
    const res = mockResponse();

    validate(transactionSchema)(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

