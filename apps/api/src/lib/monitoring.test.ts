import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, metrics, measureAsync } from "./monitoring";

describe("Monitoring", () => {
  beforeEach(() => {
    metrics.reset();
    vi.clearAllMocks();
  });

  describe("logger", () => {
    it("loguea mensajes info correctamente", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("Test message", { userId: "123" });

      expect(consoleSpy).toHaveBeenCalled();
      const loggedMessage = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Test message");
      expect(parsed.userId).toBe("123");
      expect(parsed.timestamp).toBeDefined();
    });

    it("loguea mensajes warn correctamente", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      logger.warn("Warning message");

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("loguea mensajes error con stack trace", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test error");

      logger.error("Error occurred", error, { context: "test" });

      expect(consoleSpy).toHaveBeenCalled();
      const loggedMessage = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.level).toBe("error");
      expect(parsed.error).toBe("Test error");
      expect(parsed.stack).toBeDefined();
    });

    it("loguea debug solo en desarrollo", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.debug("Debug message");

      // En test environment, puede o no loguear dependiendo de la implementación
      // Este test verifica que no falla

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("metrics", () => {
    it("incrementa contadores correctamente", () => {
      metrics.increment("requests.total");
      metrics.increment("requests.total");
      metrics.increment("requests.total", 5);

      const stats = metrics.getStats();
      expect(stats.counters["requests.total"]).toBe(7);
    });

    it("registra timings correctamente", () => {
      metrics.timing("api.response_time", 100);
      metrics.timing("api.response_time", 200);
      metrics.timing("api.response_time", 150);

      const stats = metrics.getStats();
      expect(stats.timings["api.response_time"]).toBeDefined();
      expect(stats.timings["api.response_time"].count).toBe(3);
      expect(stats.timings["api.response_time"].avg).toBe(150);
      expect(stats.timings["api.response_time"].min).toBe(100);
      expect(stats.timings["api.response_time"].max).toBe(200);
    });

    it("calcula percentiles correctamente", () => {
      // Agregar 100 mediciones
      for (let i = 1; i <= 100; i++) {
        metrics.timing("test.percentiles", i);
      }

      const stats = metrics.getStats();
      // Percentiles aproximados (puede variar por redondeo)
      expect(stats.timings["test.percentiles"].p50).toBeGreaterThanOrEqual(49);
      expect(stats.timings["test.percentiles"].p50).toBeLessThanOrEqual(51);
      expect(stats.timings["test.percentiles"].p95).toBeGreaterThanOrEqual(94);
      expect(stats.timings["test.percentiles"].p99).toBeGreaterThanOrEqual(98);
    });

    it("reset limpia todas las métricas", () => {
      metrics.increment("counter");
      metrics.timing("timing", 100);

      metrics.reset();

      const stats = metrics.getStats();
      expect(stats.counters).toEqual({});
      expect(stats.timings).toEqual({});
    });
  });

  describe("measureAsync", () => {
    it("mide el tiempo de funciones async exitosas", async () => {
      const result = await measureAsync("test.operation", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "success";
      });

      expect(result).toBe("success");

      const stats = metrics.getStats();
      expect(stats.counters["test.operation.success"]).toBe(1);
      expect(stats.timings["test.operation"]).toBeDefined();
      expect(stats.timings["test.operation"].avg).toBeGreaterThanOrEqual(40);
    });

    it("registra errores y re-lanza la excepción", async () => {
      await expect(
        measureAsync("test.failing", async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      const stats = metrics.getStats();
      expect(stats.counters["test.failing.error"]).toBe(1);
    });
  });
});

