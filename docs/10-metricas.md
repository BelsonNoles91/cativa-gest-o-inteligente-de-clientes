# 10. Métricas e Índice Cativa

Todas as fórmulas vivem em `src/domain/analytics.ts` — funções puras,
documentadas, testadas.

## Métricas operacionais

| Métrica | Fórmula |
|---|---|
| Comparecimento | comparecimentos / agendamentos não cancelados |
| No-show | no-shows / agendamentos não cancelados |
| Cancelamento | cancelamentos / agendamentos marcados |
| Confirmação | confirmados / elegíveis para confirmação |
| Ocupação | minutos reservados / minutos disponíveis |
| Ticket médio | receita concluída / nº de atendimentos concluídos |
| Valor futuro agendado | soma de cents de futuros não cancelados |
| Receita futura em risco | futuros sem confirmação |
| Tempo médio até confirmação | média de horas entre criação e `confirmed_at` |

## Retenção e conversão

- **Retenção do negócio** = clientes elegíveis que retornaram dentro da
  janela / clientes elegíveis (1ª visita ≤ end - windowDays).
- **Conversão N→N+1** = clientes na N-ésima visita que voltaram /
  clientes na N-ésima visita (parametrizada por `windowDays`).
- **Rebooking** = atendimentos concluídos com próxima visita marcada /
  atendimentos concluídos elegíveis.
- **Recuperação de no-show** = clientes com no-show que remarcaram dentro
  da janela / clientes com no-show.

## Índice Cativa (0–100)

Componentes normalizados em 0..100 e ponderados:

| Componente | Peso |
|---|---|
| Retenção | 25 |
| Rebooking | 15 |
| Confirmação | 10 |
| Recuperação de no-show | 10 |
| Ocupação | 10 |
| Adesão à janela ideal | 10 |
| Completude do CRM | 10 |
| Valor futuro agendado | 10 |

Exibido por **negócio**, **unidade**, **profissional** e **coorte**.
Acompanhado de:

- score atual
- tendência
- principais gargalos
- principais oportunidades
- **Next Best Action** — sugestões acionáveis ("baixa confirmação → fila",
  "agenda com buracos → acionar lista de espera", etc.)

## Filtros

Todas as métricas podem ser filtradas por:

- período (presets: hoje, ontem, 7d, 30d, 90d, mês atual, mês passado, YTD)
- unidade
- profissional
- serviço
- origem (frontdesk, portal, walk-in, telefone, ...)

## Roadmap futuro

- Metas configuráveis por super admin/owner.
- Snapshot diário (`usage_snapshots`) para histórico longo do Índice Cativa.
- Comparativos coorte vs coorte.
