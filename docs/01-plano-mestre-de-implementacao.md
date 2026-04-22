# Plano Mestre de Implementacao

Este arquivo registra o planejamento inicial para levar o projeto a 100% do
`prompt_original.txt`. A cada fase concluida no repositorio, o status deve ser
atualizado para `OK`.

| Fase | Objetivo | Status |
| --- | --- | --- |
| Fase 0 | Correcao estrutural de schema, migrations ausentes e saneamento tecnico | OK |
| Fase 1 | CRM operacional completo em `/app/clientes` | OK |
| Fase 2 | Catalogo operacional completo em `/app/servicos` e `/app/pacotes` | OK |
| Fase 3 | Agenda operacional completa em `/app/agenda` e waitlist | OK |
| Fase 4 | Central de confirmacao funcional ponta a ponta | OK |
| Fase 5 | Portal do cliente funcional e seguro | OK |
| Fase 6 | Dashboards, metricas e Indice Cativa | OK |
| Fase 7 | Super admin e billing SaaS consolidados | OK |
| Fase 8 | Importacao, exportacao, seeds, seguranca e documentacao final | OK |
| Fase 9 | Refino final, aderencia integral ao prompt e fechamento de 100% | OK |

## Escopo resumido por fase

### Fase 0 - OK
- Criar migrations faltantes para confirmacao e portal.
- Corrigir inconsistencias entre codigo e schema.
- Fechar falha do parser CSV.
- Deixar a suite de testes verde no repositorio.

### Fase 1 - CRM operacional completo
- Substituir o placeholder de clientes por tela real.
- Entregar busca, filtros, lista, ficha, notas, tags, arquivos, fotos, timeline, consentimentos e campos customizados.
- Garantir operacao de cadastro e edicao sem SQL.

### Fase 2 - Catalogo operacional completo
- Substituir placeholders de servicos e pacotes.
- Entregar gestao de servicos, precos, pacotes, protocolos e memberships.
- Fechar conexao do catalogo com agenda e portal.

### Fase 3 - Agenda operacional completa
- Substituir o placeholder da agenda.
- Entregar visoes de agenda, fluxos de agendamento e lista de espera operacional.
- Fechar integracao com servicos, profissionais, recursos e politicas.

### Fase 4 - OK
- Conectar UI existente ao schema real.
- Entregar regras, templates, fila e rastreabilidade de contatos.
- Manter o fluxo manual sem WhatsApp API.

### Fase 5 - OK
- Fechar vinculo entre autenticacao e cliente.
- Entregar agendamento, reagendamento, historico, perfil, pacotes e avaliacoes.
- Validar RLS e branding por tenant.

### Fase 6 - OK
- Substituir placeholder de analytics.
- Entregar dashboards operacionais e executivos com filtros.
- Fechar metricas, score e recomendacoes acionaveis.

### Fase 7 - OK
- Completar CRUD de planos, features, flags e subscriptions.
- Fechar UX de owner para plano, limites e consumo.
- Consolidar enforcement de limites por tenant.

### Fase 8 - OK
- Fechar imports restantes.
- Criar seeds realistas por segmento.
- Ampliar testes, docs e revisao de seguranca/portabilidade.

### Fase 9 - OK
- Eliminar placeholders remanescentes.
- Revisar UX mobile, performance e consistencia textual.
- Fazer auditoria final de aderencia ao prompt original.
