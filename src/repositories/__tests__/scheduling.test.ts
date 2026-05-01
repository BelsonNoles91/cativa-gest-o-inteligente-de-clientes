import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAppointmentsHydrated } from "../scheduling";
import { supabase } from "@/integrations/supabase/client";

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

// Precisamos que o order resolva o promise
mockQuery.order.mockResolvedValue({ data: [], error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => mockQuery),
  },
}));

describe("Scheduling Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.order.mockResolvedValue({ data: [], error: null });
  });

  describe("listAppointmentsHydrated", () => {
    it("should include filters in the query", async () => {
      await listAppointmentsHydrated({
        tenantId: "t1",
        unitId: "u1",
        rangeStart: "2026-05-01T00:00:00Z",
        rangeEnd: "2026-05-02T00:00:00Z",
        excludeStatuses: ["canceled"] as any,
      });

      expect(mockQuery.eq).toHaveBeenCalledWith("tenant_id", "t1");
      expect(mockQuery.eq).toHaveBeenCalledWith("unit_id", "u1");
      expect(mockQuery.not).toHaveBeenCalledWith("status", "in", "(canceled)");
    });
  });
});
