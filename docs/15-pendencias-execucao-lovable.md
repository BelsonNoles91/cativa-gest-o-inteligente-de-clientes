# Pendências executáveis pelo Lovable

> Estado revisado em 23/04/2026 após fechamento técnico de ambiente, billing,
> agenda e analytics.

## Concluído nesta rodada

- `npm test` e `npm run build` voltaram a fechar no workspace atual.
- O fluxo de convite real de equipe já está operacional, com aceite por token,
  auditoria e enforcement real de `max_professionals`.
- O consumo de storage exibido no app passou a usar a função
  `tenant_storage_bytes_used(...)`, alinhado ao hard-limit do banco.
- Uploads do CRM agora fazem bloqueio preventivo quando o storage projetado
  excede o plano.
- A agenda ganhou visualização explícita por recurso/sala.
- Analytics foi reorganizado em contextos `Executivo`, `Operacional` e
  `Retenção`.

## Pendências que ainda fazem sentido para execução

### Bloco A — Validação integrada em banco real

**Prioridade:** P1  
**Natureza:** execução assistida / validação operacional
**Completude atual:** 94%

**Objetivo**
Confirmar que os fluxos já implementados funcionam ponta a ponta com sessão
real, RLS real e buckets reais.

**Estado atual**
- Preflight de ambiente E2E implementado.
- Trilha pública do Playwright estabilizada e validada.
- Trilha autenticada agora falha rápido quando credenciais não existem.
- Trilha autenticada também valida login real antes do Playwright.
- Credencial `owner` de QA validada com sucesso no Supabase.
- Matriz de contas QA por papel validada com sucesso no Supabase:
  `owner`, `manager`, `frontdesk`, `professional`.
- Corrigido bug do spec visual autenticado que descartava a sessão ao aplicar
  `storageState` vazio ao arquivo inteiro.
- Trilha de smoke autenticada separada criada para reduzir custo da suíte
  visual completa.
- `globalSetup` endurecido com espera ativa do app e tentativa de auth direta
  via Supabase antes do fallback por UI.
- Smoke autenticada multi-rota validada com sucesso em preview/build local
  para `/app`, `/app/agenda`, `/app/clientes` e `/app/confirmacoes`.
- O comando `test:auth:smoke` agora cobre essa trilha multi-rota.
- A trilha visual autenticada crítica no perfil principal
  (`iphone-14-portrait`) também foi validada com sucesso para baseline das
  quatro rotas principais, cenários transicionais e overlap do `BottomNav`.
- A expansão multi-dispositivo no `iphone-se` avançou: `/app/confirmacoes`
  passou na trilha preview crítica com o helper de `BottomNav` ajustado para
  priorizar `locator.boundingBox()`.
- Em `/app/clientes`, o overflow horizontal foi reduzido com ajustes de
  contração e padding na coluna esquerda.
- A tela branca de `/app/clientes` no preview autenticado foi diagnosticada e
  corrigida: o erro era `ReferenceError: cn is not defined` no CRM.
- Após essa correção, `/app/clientes` e `/app/confirmacoes` passaram na
  trilha preview crítica também em `iphone-se` e `iphone-14-landscape`.
- Resta fechar a baseline visual autenticada completa e as validações que
  dependem de portal real, bucket real e conferência humana de RLS/dispositivo.
- A consolidação dessa trilha crítica em um único comando serial ainda sofre
  instabilidade residual de `globalSetup`/rede no ambiente local.
- A expansão dessa trilha para outros perfis de dispositivo ainda está
  bloqueada por comportamento inconsistente de sessão quando se tenta remover o
  `globalSetup` e confiar apenas no `storageState` bootstrapado.

**Tarefas**
1. Validar onboarding residual e troca real de tenant/unidade.
2. Validar convite e aceite real de membro em fluxo E2E assistido.
3. Validar upload e remoção real em `client-media`.
4. Validar limites de plano com cenários reais de bloqueio.
5. Validar portal do cliente e autoagendamento com tenant real.
6. Rodar baseline visual autenticada completa e revisar diffs finais.
7. Expandir a trilha crítica validada do `iphone-14-portrait` para os demais
   perfis móveis/tablet.
8. Levar a mesma trilha preview-crítica validada para `android-360-portrait`
   e `ipad-portrait`.

**Critério de aceite**
- Fluxos críticos executam sem erro de permissão.
- Policies, claims e buckets se comportam como esperado.

### Bloco B — Validação visual e regressão assistida

**Prioridade:** P2  
**Natureza:** QA
**Completude atual:** 85%

**Objetivo**
Garantir que os refinamentos de agenda, analytics e billing permaneçam estáveis
visualmente em desktop e mobile.

**Tarefas**
1. Rodar suite visual autenticada do Playwright em ambiente configurado.
2. Revisar tela de agenda por recurso com sessão real.
3. Revisar tabs de analytics por contexto com dados reais.
4. Revisar tela de billing com consumo real de storage em tenant conectado.

**Critério de aceite**
- Baseline visual aprovada.
- Sem regressão perceptível nas telas críticas.

## O que não é mais pendência executável

- Convite real de equipe.
- Enforcement de `max_professionals`.
- Medição real de storage no app.
- Hard-limit de storage no banco.
- Saneamento de `build/test` no workspace atual.
- Fechamento de rastreabilidade documental vs prompt.

## Observação

O backlog restante agora é majoritariamente de validação integrada com ambiente
real. O núcleo funcional pedido no prompt está implementado; o que falta é
credencial, sessão real, bucket real e validação humana assistida.
