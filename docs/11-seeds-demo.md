# 11. Seeds operacionais de demonstração

Esta pasta reúne pacotes CSV prontos para acelerar homologação, demo comercial
e smoke test manual do produto sem depender de SQL custom.

## Onde estão

- `docs/seeds/estetica-facial/`
- `docs/seeds/barbearia/`
- `docs/seeds/wellness/`

Cada pack vem com:

- `clients.csv`
- `services.csv`
- `team.csv`
- `packages.csv`
- `appointments.csv`

## Ordem recomendada de importação

1. `services.csv`
2. `team.csv`
3. `clients.csv`
4. `packages.csv`
5. `appointments.csv`

## Observações importantes

- Os agendamentos usam nomes, não IDs.
- A coluna `unidade` pode ficar vazia quando o tenant tiver apenas uma unidade
  ativa. Se houver múltiplas unidades, preencha a coluna antes de importar.
- Os packs usam delimitador `;`, compatível com Excel pt-BR.
- Preços estão em reais para casar com o importador.

## Uso recomendado

- Tenant novo: importar um pack completo para montar base inicial.
- QA: usar o pack do segmento mais próximo do cenário testado.
- Demo: importar clientes/serviços/agendamentos e validar CRM, agenda,
  portal, confirmação e analytics com dados coerentes.
