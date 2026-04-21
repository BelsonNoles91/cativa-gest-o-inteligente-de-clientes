/**
 * Cativa — App configuration
 * Centraliza metadados do produto e flags. Mantenha portável: nada de
 * acoplar ao Lovable aqui.
 */

export const appConfig = {
  name: "Cativa",
  tagline: "Gestão que faz o cliente voltar",
  locale: "pt-BR",
  defaultTheme: "light" as "light" | "dark" | "system",
  supportEmail: "contato@cativa.app",
} as const;

export type AppConfig = typeof appConfig;
