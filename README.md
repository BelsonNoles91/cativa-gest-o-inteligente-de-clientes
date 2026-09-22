# Cativa

> **Tagline:** Gestão que faz o cliente voltar.

SaaS multi-tenant, mobile-first, para clínicas de estética, salões de beleza,
barbearias, esmalterias, lash & brow, massagem e wellness. Centraliza agenda,
clientes, atendimentos, serviços, pacotes, protocolos, memberships,
confirmação de horários, retenção e visão gerencial.

---

## Visão do produto

- Aumentar **retenção, rebooking e ocupação da agenda**.
- Operação **leve e rápida no mobile** (recepção opera em poucos cliques).
- **Premium e clara** para quem decide.
- WhatsApp **sempre manual ou semiautomático** — geramos texto, link `wa.me`
  e copiamos a mensagem. **Nunca enviamos automaticamente.**
- **Sem módulo fiscal** (sem NF, impostos, SPED, DRE, contabilidade).

## Stack

- **Vite + React 18 + TypeScript**
- **TypeSafe Jev** para recomendações estruturadas de retenção, sempre com decisão humana
- **Tailwind CSS v3** + design system com tokens HSL semânticos
- **shadcn/ui** customizado com a identidade Cativa
- **React Router** para navegação SPA
- **TanStack Query** para data fetching
- **Lovable Cloud (Supabase)** previsto para auth, Postgres, Storage e edge
  functions — a ser ativado nas próximas etapas
- **GitHub Sync** desde o início (recomendado)

## Convenções

- **Idioma:** UI em **pt-BR**, código (variáveis, tabelas, funções, tipos)
  em **inglês**.
- **Cores:** apenas tokens semânticos HSL definidos em `src/index.css` e
  `tailwind.config.ts`. Nunca usar `text-white`, `bg-black` etc. direto em
  componentes.
- **Multi-tenant:** todas as entidades principais terão `tenant_id`. Quando
  aplicável também `unit_id`.
- **Papéis:** `super_admin`, `owner`, `manager`, `frontdesk`, `professional`,
  `client`. Roles em tabela própria com RLS + função `has_role`
  (security definer) — ver Etapa 2.
- **Regras críticas** vivem em `services/` e `domain/`, **nunca** na UI.
- **Migrations versionadas e incrementais.** Não recomeçar do zero.

## Estrutura de pastas

```
src/
├─ components/
│  ├─ brand/         # logo, marca
│  ├─ shell/         # AppLayout, AppHeader, AppSidebar, BottomNav, ...
│  ├─ feedback/      # EmptyState, StatusBadge, ...
│  └─ ui/            # primitivas shadcn customizadas
├─ pages/
│  ├─ public/        # Landing, Pricing
│  ├─ auth/          # Login, ForgotPassword, Onboarding
│  └─ app/           # Dashboard + telas autenticadas
├─ features/         # módulos por feature (theme, tenant, …)
├─ services/         # casos de uso / regras de negócio
├─ domain/           # entidades, value objects, enums (roles, tenant, …)
├─ repositories/     # contratos de acesso a dados (interface + impl)
├─ integrations/     # supabase client, wa.me helper, etc.
├─ hooks/            # hooks reutilizáveis
├─ utils/            # helpers genéricos
├─ types/            # tipos compartilhados
└─ config/           # appConfig, navigation, feature flags
```

## Portabilidade

A arquitetura **não depende do Lovable**. Para migrar para outro host ou VPS:

1. `npm run build` gera bundle estático servível por qualquer CDN/Nginx.
2. Backend (Supabase) pode ser auto-hospedado — apenas troca-se as env vars
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (publicáveis).
3. Camadas `services/` e `repositories/` permitem trocar a implementação de
   acesso a dados sem tocar na UI.
4. Estrutura preparada para **export/import CSV e JSON** nas próximas etapas.

## Scripts

```bash
npm run dev      # ambiente local
npm run build    # bundle de produção
npm run preview  # serve o bundle gerado
npm run test     # vitest
```

## Inteligência de retenção com Jev

A ficha do cliente pode solicitar ao Jev uma próxima ação de retenção. A integração:

- roda em `supabase/functions/retention-advisor`, nunca no navegador;
- consulta somente dados do tenant e cliente autorizados pelo JWT e pelas RLS;
- envia ao TypeSafe apenas métricas estruturadas, sem nome, telefone, e-mail ou notas;
- combina `Choice`, `Score` e `Noul` em uma única chamada;
- rebaixa baixa confiança, evidência insuficiente ou falta de canal de contato para revisão humana;
- registra latência, uso de tokens e resultado no log de auditoria, sem conteúdo pessoal;
- limita por padrão cada tenant a 200 avaliações concluídas por dia;
- nunca envia mensagens, agenda horários ou grava alterações automaticamente.

Para habilitar, configure e publique a função:

```bash
supabase secrets set TYPESAFE_API_KEY="sua-chave"
supabase functions deploy retention-advisor
```

Os limites podem ser calibrados com `RETENTION_ACTION_CONFIDENCE_THRESHOLD`,
`RETENTION_EVIDENCE_THRESHOLD` e `RETENTION_DAILY_TENANT_LIMIT`. Os padrões conservadores
são `0.60`, `0.65` e `200`, respectivamente.

Sem o secret, a aplicação preserva as métricas e a sugestão determinística existentes e exibe um erro recuperável ao solicitar o Jev.

## Status atual — Etapa 1

Base visual + estrutural pronta:

- Design system completo (tokens, gradientes, sombras, dark mode).
- App shell (sidebar desktop, bottom nav mobile, header com busca, tenant
  switcher e perfil).
- Rotas-base de público, auth, app autenticado e portal do cliente.
- Estrutura de pastas portável.

Próximas etapas implementarão CRM, agenda, billing, analytics, super admin
e integração com Lovable Cloud.
