import { describe, it, expect, vi } from "vitest";
import { daysUntilBirthday, computeCompleteness, type Client } from "../client";

describe("Client Domain Logic", () => {
  describe("daysUntilBirthday", () => {
    it("should return null if birthDate is missing", () => {
      expect(daysUntilBirthday(null)).toBeNull();
    });

    it("should calculate correctly for a future birthday in the same year", () => {
      const ref = new Date("2026-01-01T00:00:00");
      // Birthday on Jan 10th
      expect(daysUntilBirthday("1990-01-10", ref)).toBe(9);
    });

    it("should calculate correctly for a birthday that already passed this year", () => {
      const ref = new Date("2026-02-01T00:00:00");
      // Birthday was Jan 10th, next is Jan 10th 2027
      // 2026 is not a leap year, so Feb 1 to Jan 10 is 343 days
      const days = daysUntilBirthday("1990-01-10", ref);
      expect(days).toBeGreaterThan(340);
    });

    it("should return 0 for a birthday today", () => {
      const ref = new Date("2026-05-01T10:00:00");
      expect(daysUntilBirthday("1990-05-01", ref)).toBe(0);
    });
  });

  describe("computeCompleteness", () => {
    it("should return 0 for empty object", () => {
      const empty = { fullName: "" } as any;
      expect(computeCompleteness(empty)).toBe(0);
    });

    it("should return 100 for a fully complete object", () => {
      const complete = {
        fullName: "John Doe",
        phone: "123",
        email: "john@example.com",
        birthDate: "1990-01-01",
        origin: "Instagram",
        preferences: "Likes coffee",
        allergies: "None",
        contraindications: "None",
        preferredUnitId: "u1",
        preferredProfessionalId: "p1",
      };
      expect(computeCompleteness(complete)).toBe(100);
    });
  });
});
