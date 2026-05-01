import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAppointmentsHydrated } from "../scheduling";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

describe("Scheduling Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAppointmentsHydrated", () => {
    it("should include filters in the query", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockNot = vi.fn().mockReturnThis();

      (supabase.from as any).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        not: mockNot,
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await listAppointmentsHydrated({
        tenantId: "t1",
        unitId: "u1",
        rangeStart: "2026-05-01T00:00:00Z",
        rangeEnd: "2026-05-02T00:00:00Z",
        excludeStatuses: ["canceled"] as any,
      });

      expect(mockEq).toHaveBeenCalledWith("tenant_id", "t1");
      expect(mockEq).toHaveBeenCalledWith("unit_id", "u1");
      expect(mockNot).toHaveBeenCalledWith("status", "in", "(canceled)");
    });
  });
});
