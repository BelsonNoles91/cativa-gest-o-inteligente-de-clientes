/**
 * Páginas institucionais e de login foram desenhadas só no modo claro
 * (fundos brancos fixos). Nelas forçamos o tema claro para manter o contraste.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "./ThemeProvider";

const LIGHT_ONLY = [
  /^\/$/,
  /^\/(planos|pricing|status|onboarding|privacidade|termos)(\/|$)/,
  /^\/auth(\/|$)/,
];

export function ForceLightOnPublicRoutes() {
  const { pathname } = useLocation();
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    const lightOnly = LIGHT_ONLY.some((r) => r.test(pathname));
    root.classList.remove("light", "dark");
    root.classList.add(lightOnly ? "light" : resolvedTheme);
  }, [pathname, resolvedTheme]);
  return null;
}
