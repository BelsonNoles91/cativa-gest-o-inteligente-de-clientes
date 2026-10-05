import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { safeOAuthRedirectTarget } from "@/features/auth/safeOAuthRedirect";

const KEY = "cativa:auth_redirect";

/**
 * Após o login social (Google/Apple) o provedor devolve o usuário para a raiz
 * do site. Este componente leva a pessoa ao destino que ela tentava acessar.
 */
export function OAuthRedirectHandler() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    let target: string | null = null;
    try {
      target = sessionStorage.getItem(KEY);
      if (target) sessionStorage.removeItem(KEY);
    } catch {
      return;
    }
    const safeTarget = safeOAuthRedirectTarget(target, window.location.origin);
    if (!safeTarget || safeTarget === location.pathname) return;
    navigate(safeTarget, { replace: true });
  }, [loading, user, navigate, location.pathname]);

  return null;
}
