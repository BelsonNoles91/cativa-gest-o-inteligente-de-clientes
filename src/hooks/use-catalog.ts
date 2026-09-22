/**
 * @file use-catalog.ts
 * @description Hook library for interacting with the service catalog.
 * Uses React Query for state management, intelligent caching, and optimistic updates.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/TenantProvider";
import * as catalogRepo from "@/repositories/catalog";
import { toast } from "sonner";

interface UseCatalogOptions {
  /** If false, the queries will not run automatically. Useful for conditional fetching. */
  enabled?: boolean;
}

/**
 * @hook useCatalog
 * @description Provides read access to all catalog entities (categories, services, protocols, etc.)
 * for the current active tenant.
 * 
 * @param {UseCatalogOptions} [options] - Configuration for query execution.
 * @returns {Object} Object containing query states and an invalidation helper.
 * 
 * @example
 * const { services, isLoading } = useCatalog();
 */
export function useCatalog(options?: UseCatalogOptions) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const categories = useQuery({
    queryKey: ["catalog", tenantId, "categories"],
    queryFn: () => catalogRepo.listCategories(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hour - Categories are highly static
  });

  const services = useQuery({
    queryKey: ["catalog", tenantId, "services"],
    queryFn: () => catalogRepo.listServices({ tenantId: tenantId! }),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const basePrices = useQuery({
    queryKey: ["catalog", tenantId, "base-prices"],
    queryFn: () => catalogRepo.listBasePrices(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const protocols = useQuery({
    queryKey: ["catalog", tenantId, "protocols"],
    queryFn: () => catalogRepo.listProtocols(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const packages = useQuery({
    queryKey: ["catalog", tenantId, "packages"],
    queryFn: () => catalogRepo.listPackages(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const policies = useQuery({
    queryKey: ["catalog", tenantId, "policies"],
    queryFn: () => catalogRepo.listCancellationPolicies(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  /**
   * Manually invalidates all catalog-related queries for the current tenant.
   * Useful when external events require a full data refresh.
   */
  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog", tenantId] });
  };

  return {
    categories,
    services,
    basePrices,
    protocols,
    packages,
    policies,
    invalidateCatalog,
    isLoading: categories.isLoading || services.isLoading || basePrices.isLoading,
  };
}

/**
 * @hook useCatalogMutations
 * @description Exposes functions to modify catalog data with automatic cache invalidation.
 * Handles toast notifications for success/error feedback.
 */
export function useCatalogMutations() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const createService = useMutation({
    mutationFn: catalogRepo.createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "services"] });
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "base-prices"] });
      toast.success("Serviço criado");
    },
  });

  const updateService = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: catalogRepo.UpdateServiceInput }) =>
      catalogRepo.updateService(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "services"] });
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "base-prices"] });
      toast.success("Serviço atualizado");
    },
  });

  const createCategory = useMutation({
    mutationFn: catalogRepo.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "categories"] });
      toast.success("Categoria criada");
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, patch }: {
      id: string;
      patch: Parameters<typeof catalogRepo.updateCategory>[1];
    }) => catalogRepo.updateCategory(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "categories"] });
      toast.success("Categoria atualizada");
    },
  });

  const createProtocol = useMutation({
    mutationFn: catalogRepo.createProtocol,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "protocols"] });
      toast.success("Protocolo criado");
    },
  });

  const createPackage = useMutation({
    mutationFn: catalogRepo.createPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "packages"] });
      toast.success("Pacote criado");
    },
  });

  return {
    createService,
    updateService,
    createCategory,
    updateCategory,
    createProtocol,
    createPackage,
  };
}
