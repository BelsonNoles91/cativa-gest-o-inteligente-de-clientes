import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCategories, createCategory } from '../catalog';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Catalog Repository', () => {
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCategories', () => {
    it('should fetch and map categories correctly (Happy Path)', async () => {
      // Arrange
      const mockData = [
        { id: '1', tenant_id: mockTenantId, name: 'Category 1', position: 0, is_active: true },
        { id: '2', tenant_id: mockTenantId, name: 'Category 2', position: 1, is_active: false },
      ];
      
      const selectMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const eqMock = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockData, error: null }) });
      
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: eqMock
        })
      });

      // Act
      const result = await listCategories(mockTenantId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('service_categories');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Category 1');
      expect(result[1].isActive).toBe(false);
    });

    it('should throw error when database returns an error (Sad Path)', async () => {
      // Arrange
      const mockError = { message: 'Database connection failed' };
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: mockError })
          })
        })
      });

      // Act & Assert
      await expect(listCategories(mockTenantId)).rejects.toEqual(mockError);
    });
  });

  describe('createCategory', () => {
    it('should insert a new category and return mapped object (Happy Path)', async () => {
      // Arrange
      const input = { tenantId: mockTenantId, name: 'New Category' };
      const mockResponse = { id: 'new-id', tenant_id: mockTenantId, name: 'New Category', position: 0, is_active: true };
      
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockResponse, error: null })
          })
        })
      });

      // Act
      const result = await createCategory(input);

      // Assert
      expect(result.id).toBe('new-id');
      expect(result.name).toBe('New Category');
    });

    it('should handle missing optional fields with defaults (Edge Case)', async () => {
      // Arrange
      const input = { tenantId: mockTenantId, name: 'Default Category' };
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { ...input, id: '1', tenant_id: mockTenantId }, error: null })
        })
      });
      (supabase.from as any).mockReturnValue({ insert: insertMock });

      // Act
      await createCategory(input);

      // Assert
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        position: 0,
        is_active: true
      }));
    });
  });
});
