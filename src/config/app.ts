/**
 * Cativa — App configuration
 * Centraliza metadados do produto e flags. Mantenha portável.
 */

export const appConfig = {
  name: "Cativa",
  tagline: "Gestão que faz o cliente voltar",
  locale: "pt-BR",
  defaultTheme: "light" as "light" | "dark" | "system",
  supportEmail: "contato@cativa.app",
  
  // PWA & Performance
  offlineMode: {
    enabled: true,
    cacheTime: 1000 * 60 * 60 * 24, // 24h
  },
  
  // UX Refinements
  quickConfirmEnabled: true,
} as const;

export type AppConfig = typeof appConfig;

