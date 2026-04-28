import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCatalog } from '../use-catalog';
import { useTenant } from '@/features/tenant/TenantProvider';
import * as catalogRepo from '@/repositories/catalog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
vi.mock('@/features/tenant/TenantProvider', () => ({
  useTenant: vi.fn(),
}));

vi.mock('@/repositories/catalog', () => ({
  listCategories: vi.fn(),
  listServices: vi.fn(),
  listBasePrices: vi.fn(),
  listProtocols: vi.fn(),
  listPackages: vi.fn(),
  listCancellationPolicies: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCatalog Hook', () => {
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    (useTenant as any).mockReturnValue({
      currentTenant: { id: mockTenantId },
    });
  });

  it('should fetch catalog data when tenant is present (Happy Path)', async () => {
    // Arrange
    const mockCategories = [{ id: '1', name: 'Cat 1' }];
    (catalogRepo.listCategories as any).mockResolvedValue(mockCategories);
    (catalogRepo.listServices as any).mockResolvedValue([]);
    (catalogRepo.listBasePrices as any).mockResolvedValue(new Map());

    // Act
    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });

    // Assert
    await waitFor(() => expect(result.current.categories.isSuccess).toBe(true));
    expect(result.current.categories.data).toEqual(mockCategories);
    expect(catalogRepo.listCategories).toHaveBeenCalledWith(mockTenantId);
  });

  it('should not fetch data if tenant is missing (Sad Path)', async () => {
    // Arrange
    (useTenant as any).mockReturnValue({ currentTenant: null });

    // Act
    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });

    // Assert
    expect(result.current.categories.enabled).toBe(false);
    expect(catalogRepo.listCategories).not.toHaveBeenCalled();
  });

  it('should respect the enabled option (Edge Case)', async () => {
    // Act
    const { result } = renderHook(() => useCatalog({ enabled: false }), { wrapper: createWrapper() });

    // Assert
    expect(result.current.categories.fetchStatus).toBe('idle');
    expect(catalogRepo.listCategories).not.toHaveBeenCalled();
  });
});
