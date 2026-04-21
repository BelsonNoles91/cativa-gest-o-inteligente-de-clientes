# 2. Estrutura do projeto

Arquitetura em camadas, pensada para portabilidade e troca de backend.

```
src/
├─ components/        # UI compartilhada (shadcn customizado, shells, feedback)
│  ├─ brand/          # logo + identidade visual
│  ├─ shell/          # AppLayout, AppHeader, BottomNav, PortalLayout
│  ├─ feedback/       # EmptyState, StatusBadge
│  └─ ui/             # primitivas shadcn
├─ pages/
│  ├─ public/         # Landing, Pricing
│  ├─ auth/           # Login, ForgotPassword, Onboarding
│  ├─ app/            # área autenticada (Dashboard, Agenda, Clientes...)
│  └─ portal/         # portal do cliente final
├─ features/          # módulos por feature (auth, tenant, theme, billing, ...)
├─ services/          # casos de uso / regras de negócio (sem React)
│  ├─ confirmation/   # geração da fila + render de templates
│  ├─ portal/         # booking via portal
│  ├─ team/           # invite, gerenciamento
│  ├─ tenant/         # criação de tenant + owner
│  └─ import-export/  # CSV import/export
├─ domain/            # entidades, value-objects, enums (puros TS)
│  ├─ analytics.ts    # métricas + Índice Cativa
│  ├─ scheduling.ts   # agenda
│  ├─ confirmation.ts # confirmação de horário
│  ├─ billing.ts      # planos & assinaturas
│  ├─ catalog.ts      # serviços, pacotes, memberships
│  ├─ client.ts       # CRM
│  ├─ portal.ts       # regras do portal
│  ├─ roles.ts        # papéis
│  └─ tenant.ts       # tenant/unit
├─ repositories/      # acesso a dados (atualmente Supabase, swappable)
├─ integrations/      # supabase client + helpers wa.me
├─ hooks/             # hooks reutilizáveis
├─ utils/             # helpers (slug, csv, ...)
├─ types/             # tipos compartilhados
├─ config/            # appConfig, navigation, segmentos
└─ test/              # vitest setup + suites
```

## Convenções

- **UI em pt-BR**, **código em inglês** (variáveis, funções, tabelas).
- **Cores/medidas**: use sempre tokens semânticos do design system. Nunca
  `bg-black`, `text-white`, etc.
- **Multi-tenant**: toda entidade tem `tenant_id`. Quando aplicável, `unit_id`.
- **Regras críticas** vivem em `services/` ou `domain/`. Nunca na UI.
- **Repositories** isolam o banco. Trocar de backend = trocar implementação.
- **WhatsApp** = nunca API. Apenas helpers em `integrations/whatsapp/manual.ts`.
