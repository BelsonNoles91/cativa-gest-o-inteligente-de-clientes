import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/TenantProvider";
import * as catalogRepo from "@/repositories/catalog";
import { toast } from "sonner";

/**
 * Hook centralizado para acesso ao catálogo com cache TanStack Query.
 * Implementa cache de longa duração (staleTime) para dados pouco mutáveis
 * e invalidação inteligente por eventos (mutations).
 */
export function useCatalog(options?: { enabled?: boolean }) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Cache de categorias
  const categories = useQuery({
    queryKey: ["catalog", tenantId, "categories"],
    queryFn: () => catalogRepo.listCategories(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  // Cache de serviços
  const services = useQuery({
    queryKey: ["catalog", tenantId, "services"],
    queryFn: () => catalogRepo.listServices({ tenantId: tenantId! }),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });

  // Cache de preços base (mapa serviceId -> price)
  const basePrices = useQuery({
    queryKey: ["catalog", tenantId, "base-prices"],
    queryFn: () => catalogRepo.listBasePrices(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });

  // Protocolos
  const protocols = useQuery({
    queryKey: ["catalog", tenantId, "protocols"],
    queryFn: () => catalogRepo.listProtocols(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  // Pacotes
  const packages = useQuery({
    queryKey: ["catalog", tenantId, "packages"],
    queryFn: () => catalogRepo.listPackages(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  // Políticas de cancelamento
  const policies = useQuery({
    queryKey: ["catalog", tenantId, "policies"],
    queryFn: () => catalogRepo.listCancellationPolicies(tenantId!),
    enabled: !!tenantId && options?.enabled !== false,
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  // Helpers de invalidação
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
 * Mutation hooks para o catálogo com invalidação automática de cache.
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
    mutationFn: ({ id, patch }: { id: string; patch: any }) => catalogRepo.updateCategory(id, patch),
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
