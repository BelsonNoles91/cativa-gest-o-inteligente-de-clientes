/**
 * PublicFooter — rodapé das páginas públicas. Inclui mapa do site,
 * informações institucionais e navegação para planos/login.
 */
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { appConfig } from "@/config/app";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Logo />
            <p className="text-sm text-muted-foreground">
              {appConfig.tagline}.
            </p>
          </div>

          <FooterCol
            title="Produto"
            items={[
              { to: "/#produto", label: "Visão geral" },
              { to: "/#modulos", label: "Módulos" },
              { to: "/#indice-cativa", label: "Índice Cativa" },
              { to: "/planos", label: "Planos" },
            ]}
          />
          <FooterCol
            title="Para o seu negócio"
            items={[
              { to: "/#segmentos", label: "Segmentos atendidos" },
              { to: "/#perfis", label: "Perfis de usuário" },
              { to: "/#roi", label: "ROI conceitual" },
              { to: "/#como-funciona", label: "Como funciona" },
            ]}
          />
          <FooterCol
            title="Conta"
            items={[
              { to: "/auth/login", label: "Entrar" },
              { to: "/onboarding", label: "Criar conta grátis" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} {appConfig.name}. Todos os direitos reservados.</p>
          <p>{appConfig.supportEmail}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) =>
          it.to.startsWith("/#") ? (
            <li key={it.to}>
              <a href={it.to.replace("/", "")} className="text-muted-foreground hover:text-foreground">
                {it.label}
              </a>
            </li>
          ) : (
            <li key={it.to}>
              <Link to={it.to} className="text-muted-foreground hover:text-foreground">
                {it.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
