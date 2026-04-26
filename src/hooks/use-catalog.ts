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
    invalidateCatalog,
    isLoading: categories.isLoading || services.isLoading || basePrices.isLoading,
  };
}

/**
 * Mutation wrapper para serviços com invalidação automática de cache.
 */
export function useServiceMutations() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const createService = useMutation({
    mutationFn: catalogRepo.createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "services"] });
      queryClient.invalidateQueries({ queryKey: ["catalog", tenantId, "base-prices"] });
      toast.success("Serviço criado com sucesso");
    },
    onError: () => toast.error("Falha ao criar serviço"),
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

  return { createService, updateService };
}
