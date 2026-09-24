# Auditoria — Fase 2: Banco de dados e integridade

Data: 2026-09-24.

## Escopo executado

- Comparação do histórico de migrations local com o projeto Supabase remoto.
- Lint do schema remoto com `plpgsql_check` via Supabase CLI.
- Revisão das migrations pendentes antes da aplicação.
- Revisão estática de cadeias `UPDATE`/`DELETE` usadas pela aplicação.
- Regressão de instalação limpa, typecheck, testes unitários/componentes e build.
- Nenhum teste destrutivo foi executado com dados remotos.

## Achados e correções

| Prioridade | Achado | Causa | Correção / evidência |
|---|---|---|---|
| P2 | `start_default_trial` e `start_specific_trial` continham evento `subscription_started`, inexistente no enum `subscription_event_type`. O erro era engolido por `EXCEPTION WHEN OTHERS`, permitindo assinatura sem evento de auditoria. | Valor de enum inválido + tratamento genérico que silenciava falha. | Migration `20260924201500`: usa `activated` e remove o silenciamento, mantendo assinatura + evento na mesma transação. Lint remoto passou após aplicação. |
| P2 | `user_change_password_with_history` e `admin_force_reset_password` não encontravam `crypt`/`gen_salt`. | `pgcrypto` está no schema `extensions`, fora do `search_path` efetivo das funções. | Migration `20260924201500`: `SET search_path = public, extensions` e chamadas qualificadas `extensions.crypt` / `extensions.gen_salt`. Lint remoto passou. |
| P2 | Cinco migrations existentes estavam presentes no Git, mas ausentes no banco remoto. | Drift entre repositório e schema implantado. | As cinco migrations foram revisadas como incrementais/não destrutivas e aplicadas; histórico local/remoto ficou alinhado. |
| P3 | Clone limpo não conseguia executar `npm ci` porque `package-lock.json` não correspondia ao `package.json`. | Lockfile antigo após mudanças de dependências. | Lockfile regenerado sem alterar versões declaradas. `npm ci` passou em seguida. |
| P4 | Vitest falhava localmente ao importar o cliente Supabase sem variáveis de ambiente. | Supabase 2.117 valida URL na criação do cliente; CI possui secrets, mas clone local limpo não. | `vitest.config.ts` ganhou valores fictícios somente no ambiente de testes, preservando variáveis reais quando presentes e sem alterar o guard de produção. 448/448 testes passaram. |
| P4 | `update_client_retention_metrics` mantinha duas variáveis/consultas sem uso. | Código morto legado. | Migration `20260924203000` removeu `v_tenant_id`, `v_visit_count` e consultas associadas sem mudar o cálculo. Lint remoto: `No schema errors found`. |

## Migrations aplicadas ao remoto nesta fase

1. `20260712224058_73d37bea-bbc7-4fe1-9691-9fcdf10002c3.sql` — endurecimento da inserção em `tenant_memberships`.
2. `20260714002819_ee9acfba-d062-4f21-979c-98cf5cf499ea.sql` — proteção contra autoelevação de `is_super_admin`.
3. `20260714164650_355edc5a-7046-4d1b-877c-d4119bcf0c78.sql` — guards de tenant nas RPCs de reativação e policy de convites.
4. `20260717020027_3c00b25b-46bf-4fb3-838f-193416cdff50.sql` — restrição de incidentes, proteção de token de convite e leitura administrativa de memberships.
5. `20260923002000_restore_plan_feature_entitlements.sql` — restauração idempotente de direitos de funcionalidades dos planos.
6. `20260924201500_fix_phase2_database_integrity.sql` — correção de trials/eventos e RPCs de senha.
7. `20260924203000_cleanup_retention_metrics_function.sql` — remoção de código morto da função de retenção.

Nenhuma migration desta fase remove tabela, coluna ou registros de negócio.

## CRUD e filtros

Foi executada varredura estática delimitando cada cadeia Supabase independente. Foram analisadas 76 cadeias diretas contendo `UPDATE` ou `DELETE` em repositories/services/features/pages.

Resultado: **0 candidatos a mutação direta sem filtro**. As mutações usam filtros como `eq`, `match`, `in` ou equivalentes após a operação.

Isso não substitui a validação de RLS/autorização no servidor, que pertence à Fase 3.

## Integridade e constraints

- O histórico de migrations local e remoto está alinhado até `20260924203000`.
- O lint completo do schema remoto terminou com `No schema errors found`.
- As correções de trial passaram a falhar atomicamente se o evento de assinatura não puder ser gravado.
- Não foi introduzida alteração destrutiva em cascatas ou relacionamentos.

## Testes executados

| Verificação | Resultado |
|---|---|
| `supabase db push --dry-run` antes das novas migrations | PASS |
| Aplicação das migrations no projeto remoto | PASS |
| `supabase migration list --linked` | PASS — local/remoto alinhados |
| `supabase db lint --linked --level warning` | PASS — `No schema errors found` |
| Instalação limpa com `npm ci` | PASS após sincronização do lockfile |
| Typecheck com Node 22 | PASS |
| Vitest com Node 22 | PASS — 38 arquivos, 448/448 testes |
| Build de produção com Node 22 | PASS |
| Varredura de 76 cadeias `UPDATE`/`DELETE` | PASS — 0 mutações diretas sem filtro detectadas |

O Node 22 foi usado nos gates de código por ser a versão definida no CI do projeto e exigida pelo Supabase JS atual.

## NÃO TESTADO / limitações desta fase

- **Órfãos e duplicidades em dados remotos, com contagem exata:** NÃO TESTADO. O acesso disponível nesta sessão permite migrations, lint e estatísticas, mas não expõe um canal de SQL arbitrário nem `SUPABASE_DB_URL`. As estimativas de `table-stats` não foram aceitas como prova.
- **Matriz destrutiva de entradas contra cada CRUD remoto** (vazio, `null`, `undefined`, strings extremas, emoji, caracteres especiais, duplicados): NÃO TESTADO integralmente no banco remoto. O protocolo proíbe usar dados de produção para testes destrutivos; os testes automatizados existentes cobrem diversos casos negativos e passaram, mas não equivalem à matriz completa em banco isolado.
- **RLS, IDOR e isolamento entre tenants:** propositalmente não concluídos aqui; são escopo principal da Fase 3.
- `npm ci` informou 4 advisories de severidade `moderate`. Não foi usado `npm audit fix --force`; a análise/atualização de dependências fica registrada para a fase de segurança.

## Commits produzidos durante a fase

- `d5439a3` — Corrige integridade de trials e RPCs de senha.
- `0d5271f` — Sincroniza package-lock com dependências atuais.
- `8328d7b` — Permite testes locais sem credenciais Supabase.
- `3d94be8` — Remove código morto da função de retenção.

## Resultado da Fase 2

Os defeitos reproduzíveis de schema/funções encontrados nesta fase foram corrigidos e validados no banco remoto. O schema está sem erros de lint e o histórico de migrations está sincronizado. A regressão de código terminou com 448/448 testes, typecheck e build aprovados.

A fase não recebe um PASS para a inspeção exata de órfãos/duplicidades nem para a matriz destrutiva completa de CRUD, pois essas verificações exigem um canal SQL/banco isolado que não está disponível nesta sessão.

=== ESTADO DA AUDITORIA ===

FASE CONCLUÍDA:
2 — Banco de dados e integridade

FASES CONCLUÍDAS:
0 — Congelamento funcional e mapa real do projeto
1 — Saúde técnica do projeto
2 — Banco de dados e integridade

P0:
0 abertos

P1:
0 abertos

P2:
0 abertos (3 grupos P2 corrigidos nesta fase)

P3:
1 pendência transversal: 4 advisories `moderate` do npm, reservados para auditoria de segurança

P4:
0 abertos (2 grupos P4 corrigidos nesta fase)

CORREÇÕES REALIZADAS:
Sincronização de migrations; correção atômica dos eventos de trial; correção das RPCs de senha com pgcrypto; sincronização do package-lock; ambiente Vitest local autossuficiente; remoção de código morto na função de retenção.

ARQUIVOS ALTERADOS:
supabase/migrations/20260924201500_fix_phase2_database_integrity.sql
supabase/migrations/20260924203000_cleanup_retention_metrics_function.sql
package-lock.json
vitest.config.ts
docs/21-auditoria-fase2-banco-integridade.md

BANCO ALTERADO:
sim — 7 migrations pendentes/novas aplicadas; nenhuma alteração destrutiva de tabela/coluna ou exclusão de dados de negócio nesta fase

MIGRATIONS:
20260712224058_73d37bea-bbc7-4fe1-9691-9fcdf10002c3.sql
20260714002819_ee9acfba-d062-4f21-979c-98cf5cf499ea.sql
20260714164650_355edc5a-7046-4d1b-877c-d4119bcf0c78.sql
20260717020027_3c00b25b-46bf-4fb3-838f-193416cdff50.sql
20260923002000_restore_plan_feature_entitlements.sql
20260924201500_fix_phase2_database_integrity.sql
20260924203000_cleanup_retention_metrics_function.sql

PERFIS AFETADOS:
owner, manager, super_admin, usuários autenticados que alteram senha, usuários/convites de equipe e tenants sujeitos aos direitos de plano

TESTES EXECUTADOS:
Supabase migration dry-run e push; comparação de migrations local/remoto; lint remoto do schema; npm ci; typecheck Node 22; Vitest 448/448; build Node 22; varredura estática de 76 cadeias UPDATE/DELETE

TESTES FALHANDO:
nenhum após as correções

TESTES NÃO EXECUTADOS:
contagem SQL exata de órfãos/duplicidades no remoto; matriz destrutiva completa de entradas por CRUD; RLS/IDOR/multitenancy completos (Fase 3)

PENDÊNCIAS:
validar órfãos/duplicidades quando houver canal SQL seguro ou banco isolado; revisar 4 advisories moderate na fase de segurança; executar Fase 3 de autenticação/autorização/perfis

RISCO ATUAL:
médio — não há erro de schema conhecido, mas a inspeção exata de integridade dos registros remotos permanece não testada

PRÓXIMA FASE:
3 — Autenticação, autorização e perfis

=== FIM DO ESTADO ===
