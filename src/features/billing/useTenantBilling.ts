import { useTenantBillingContext } from "@/features/billing/TenantBillingProvider";

export function useTenantBilling() {
  return useTenantBillingContext();
}
