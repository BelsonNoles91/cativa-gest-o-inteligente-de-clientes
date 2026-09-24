import { forwardRef, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useSystemFlags } from "./useSystemFlags";

/** Retorna se novos cadastros de estabelecimentos estão abertos. */
export function useSignupsOpen() {
  const { flags } = useSystemFlags();
  return flags.enable_signups;
}

/**
 * Link de "Começar grátis". Quando os novos cadastros estão pausados pelo
 * painel administrativo, vira um link de "Entrar" — a opção de criar conta
 * some da página.
 */
export const SignupLink = forwardRef<
  HTMLAnchorElement,
  Omit<LinkProps, "to"> & { children?: ReactNode; closedLabel?: ReactNode }
>(function SignupLink({ children, closedLabel = "Entrar na minha conta", ...rest }, ref) {
  const open = useSignupsOpen();
  if (open) {
    return (
      <Link ref={ref} to="/onboarding" {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <Link ref={ref} to="/auth/login" {...rest}>
      {closedLabel}
    </Link>
  );
});
