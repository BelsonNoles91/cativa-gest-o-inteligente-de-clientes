/**
 * Tipos compartilhados entre camadas (DTOs, enums, value objects).
 * Mantenha aqui apenas tipos genéricos. Tipos de domínio vivem em /domain.
 */

export type ID = string;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
