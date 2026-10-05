# Estratégia de testes do Cativa

Este documento é o contrato operacional dos gates implementados no repositório.
Os testes que escrevem dados só podem apontar para um projeto QA autorizado ou
para o Supabase local descartável explicitamente marcado e limitado a loopback.

## Acompanhamento da implementação

Atualizado em 2026-10-05. O percentual geral é a média simples das dez frentes
abaixo; mede a implementação e validação comprovável do plano, não apenas a
quantidade de código adicionada. Uma frente só chega a 100% quando seus gates
relevantes foram executados com evidência. Itens dependentes de QA externo ou
dispositivo físico permanecem parciais até a execução real.

| Frente                                          | Progresso | Evidência / pendência principal                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ambiente limpo, dependências, typecheck e build |      100% | `npm ci` passou no runtime empacotado; typecheck e build de produção foram verificados também em Node 22.23.2 (mesma major do CI), além de Node 24. O build isolado transformou 3.264 módulos e gerou 138 entradas de precache.                                                                                                                                                                                                                                            |
| Isolamento do alvo QA e provisionamento         |       90% | Guard e fixtures sintéticas A/B foram exercitados no Supabase descartável local, com limpeza validada. A primeira execução remota do Actions foi inspecionada: a função de fixtures recebeu HTTP 500 do Auth (`Database error finding users`). O retry idempotente agora aguarda até cinco tentativas com backoff, validado em 7/7 testes locais; falta confirmar a correção em nova execução no Actions e no QA remoto. |
| Jornadas E2E por papel e funcionalidade         |       99% | Smoke/RBAC/portal/CRM/offline e Go-Live locais já passaram nos perfis sintéticos. Nesta rodada, 17/17 fluxos de papéis/assinatura/UX, onboarding 5/5 viewports (320 px, SE, 360 px, iPhone 14 e iPad), limites de plano 3/3 e portal/confirmação 8/8 passaram no QA local; faltam validação em CI no SHA candidato e aceite remoto. |
| Métricas, retenção e Jev                        |       99% | Regras da fila de confirmação agora aplicam as opções configuradas e têm testes focados; `queueRules.ts` está em 100% statements/branches/funções/linhas. Agenda, catálogo de recursos por plano, domínio puro do portal, adaptador cliente de retenção/Jev e serviço de agendamento do portal também estão em 100%. O catálogo CRUD segue em 92,60% statements, 90,35% branches, 100% funções e linhas em 21 testes focados. A medição global atual com Vitest é 952/952 testes em 73 arquivos: 25,99% statements, 25,68% branches, 19,57% funções e 26,12% linhas. O benchmark representativo de drift do Jev segue pendente. |
| RLS, IDOR, storage e auditoria                  |       99% | As 18 regressões SQL passaram no Supabase local descartável; quota resistiu a 32 chamadas simultâneas. Storage real passou novamente nos seis perfis/contextos, com isolamento, limites e limpeza. Carga multi-tenant repetida registrou zero vazamentos. Ainda faltam QA remoto e confirmação em Actions. |
| Infraestrutura de layout/responsividade         |       99% | A matriz pública passou 300/300 casos em 15 projetos Chromium, Firefox e WebKit. No QA local, a matriz autenticada passou 180/180 em 15 projetos; a regressão de redimensionamento de modal autenticado passou 15/15, cobrindo desktop, breakpoints, tablets, mobile estreito/landscape, foco e persistência do formulário. Ainda faltam aparelhos físicos/device farm. |
| Execução visual e acessibilidade                |       99% | Nesta rodada passaram 66/66 verificações de segurança/acessibilidade pública, 21/21 contrastes públicos e 48/48 casos Axe de contraste (68 análises de rota/tema), além de 67/67 checks visuais autenticados; zero violações sérias/críticas nos checks WCAG AA. O reflow/layout público passou 300/300 em 15 projetos e 10 rotas. A baseline do modal Agenda → Confirmações foi revisada e atualizada. Permanecem leitor de tela físico, dispositivos reais e confirmação no Actions. |
| Resiliência, concorrência e performance         |       89% | Nesta repetição, rajadas de 25/50/100 reservas passaram com p95 de 83/53/94 ms. O soak de 10 min passou em 12.537 lotes/100.296 tentativas (8 concorrentes, p95 máximo 30 ms, mediana 10 ms, sem resíduos). Tráfego misto passou com 250 escritas/120 leituras (p95 de leitura 57,3 ms; mutação 77 ms); a matriz multi-tenant passou com 250 escritas/50 leituras e zero vazamentos. Soak offline, falhas HTTP/transporte, expiração, Realtime, reload e Core Web Vitals também passaram anteriormente. Ainda faltam execução noturna no Actions/QA remoto e dispositivos reais. |
| CI, gates e artefatos                           |       98% | Além dos jobs existentes, Core Web Vitals roda em PR sem secrets; o job QA local executa 18 gates SQL com relatório JUnit agregado e concorrência da agenda, e agora inclui o checklist Go-Live 4/4. Há workflow agendado/manual de soak local de 10 min, sem segredos remotos e com artefatos JUnit/HTML/manifesto. Os quatro workflows passam em actionlint pela imagem fixada por digest do próprio CI; agora há também job independente de Deno check/lint para as seis Edge Functions, com setup-deno e versão Deno fixados, validado localmente, mas ainda aguardando execução no Actions. Um gate dedicado com imagem fixada por digest foi adicionado, mas também aguarda execução real no Actions. O job público gera manifesto com agregação JUnit, ambiente, run ID e SHA-256, validado por 3 testes Node. O primeiro run consultado (commit `621968e`) teve o job Vitest e integridade de backend aprovados; provisionamento remoto de Auth e snapshots autenticados falharam. Retry transitório entrou no código local, mas não foi publicado nem validado em novo run. |
| Integrações reais e dispositivos físicos        |       55% | OAuth Google/Apple iniciou no broker simulado e o callback sintético Supabase percorreu tokens em fragmento, validação da sessão, remoção do token da URL e retorno local: 9/9 em Chromium, Firefox e WebKit. Login válido na aplicação contra Auth local QA passou pela interface nos três motores. Ainda pendentes callback/provider sandbox real e aparelhos físicos/device farm. |
| **Total (média das dez frentes)**               | **92,7%** | **952/952 testes Vitest em 73 arquivos; typecheck e lint completo aprovados (0 erros, 17 avisos conhecidos); build de produção isolado e `git diff --check` aprovados. Nesta rodada também passaram 70 E2E em QA local, 18/18 gates SQL, 300/300 testes públicos de layout, 21/21 contrastes e os fluxos de autenticação, CRM, importação/exportação e limites. Cobertura global: 25,99% statements, 25,68% branches, 19,57% funções e 26,12% linhas. `npm audit --omit=dev` reporta 0 vulnerabilidades. QA remoto, nova execução Actions no SHA candidato, avaliação representativa de drift do Jev, revisão humana integral dos snapshots, OAuth real, soak noturno, device farm e preview acessível seguem pendentes.** |

## Índice extra para a meta de 110% — 2026-10-03

A métrica-base acima permanece limitada a 100% e não inclui bônus. Para chegar a
110 sem inflar o plano original, os dez pontos extras exigem evidência separada
e não podem ser concedidos a uma tarefa já contada como gate-base:

| Validação extraordinária                                                     | Pontos | Estado |
| ----------------------------------------------------------------------------- | -----: | ------ |
| Encontrar e corrigir uma vulnerabilidade nova por sondagem adversarial, com regressão reproduzível | +2 | concluído: parser de URL aceitava ` /\attacker.example` como navegação externa após normalização; helper, handler, E2E e corpus adversarial agora verificam a origem canônica. |
| Oráculo independente e análise de estados para métricas, além de fixtures pontuais | +2 | concluído: 256 misturas determinísticas de estados e timestamps com contagens esperadas calculadas separadamente. |
| Fluxos adversariais de autenticação/recovery em vários motores, com APIs e callback local isolados | +2 | concluído: rejeição de credenciais, recovery, 429 e retry passaram 9/9 em Chromium, Firefox e WebKit; console/URL também são verificados contra vazamento de e-mail e senha. |
| Campanha adicional de mutações de agenda/offline confrontada com oráculo independente | +2 | concluído: 320 operações determinísticas da fila offline comparadas a um modelo independente, incluindo troca de status, notas, tenants, remoção, limpeza e injeção de registros corrompidos. |
| Pacote reprodutível de evidências com execução agregada, ambiente, run ID e verificação de integridade dos artefatos | +2 | concluído: manifesto agrega contagens JUnit, metadados mínimos e SHA-256; exclui tokens/storage state, não segue symlinks e limita caminhos à raiz declarada; CLI, checksum e limites passaram 3/3 testes. Está ligado ao job de segurança no CI. |

Crédito extraordinário atual: **10/10**. Índice combinado de trabalho: **102,7/110**
(base 92,7 + crédito 10,0); ainda não é conclusão da meta, pois faltam 7,3 pontos da métrica-base. A pontuação-base atual é provisória até que cada gate externo seja concluído e a evidência consolidada abaixo seja auditada.

## Continuação da validação visual e de performance — 2026-10-03

Nesta continuação, a matriz visual autenticada do portal passou 25/25 nos cinco
perfis: iPhone 14 portrait/landscape, iPhone SE, Android 360 e iPad. Ela verifica
os quatro alvos de navegação, dimensões mínimas de toque, safe-area, reserva de
espaço para a navegação fixa e separação entre header e conteúdo. A inspeção
encontrou no perfil do cliente dois campos de telefone comprimidos no iPhone SE;
eles agora empilham abaixo de 640 px e permanecem em duas colunas em telas
maiores. Asserções de geometria impedem regressão.

As rotas públicas de landing e planos passaram 15/15 em cinco perfis, com
capturas de topo, meio e rodapé e checagem de overflow em cada posição. Os
mock-ups de REST/Realtime são isolados e o teste falha caso a tela tente acessar
uma API pública não simulada. A conferência visual cobriu também o CTA fixo da
landing para garantir que os links sociais do rodapé não fiquem inacessíveis.

Após corrigir o contraste dos botões de confirmação/WhatsApp na fila de
confirmações, a auditoria axe WCAG 2.2 AA com `color-contrast` ativo passou
novamente 36/36 casos (51 varreduras). O teste havia identificado texto branco
com razão 4,29:1, inferior ao mínimo 4,5:1 para texto normal; os controles usam
agora o token semântico de contraste forte. A auditoria de cobertura apontou
que o vínculo cliente/portal não tinha testes unitários próprios; foram
adicionados cinco casos para vínculo existente, reivindicação via RPC validada
no servidor, cadastro inexistente, e falhas de reivindicação/banco, sempre
assegurando que não há criação direta de vínculo pelo cliente. A suíte Vitest
passou 742/742 em 62 arquivos; cobertura subiu para 19,07% statements, 16,51%
branches, 14,59% funções e 19,85% linhas. Também passaram 8/8 testes de
repositório para planos/assinaturas e fila de confirmações (tenant, paginação,
mapeamento, estados terminais e falhas) e 3/3 para a leitura do portal (escopo,
hidratação, privacidade de notas internas, lista vazia e propagação de erro).
Typecheck passou; lint terminou sem erros e com os mesmos 17 avisos conhecidos
de Fast Refresh; `git diff --check` passou.

Core Web Vitals foi repetido em build de produção isolado e passou 18/18. Os
valores máximos medidos foram: landing LCP/FCP 1.992 ms e INP 72 ms; planos LCP,
FCP e INP 280 ms ou menos; CLS 0 em todas as medições; TTFB abaixo de 3 ms; zero
imagens quebradas. A landing em 320 px excede apenas a meta suave de FCP 1.800
ms, mas permanece dentro do teto operacional de 3.000 ms. O backend 503 e hosts
externos foram substituídos por falhas/fixtures locais, portanto estes números
continuam sendo laboratório, não produção real.

Essa rodada acrescenta evidência, mas não altera o índice de 92,6% da base nem
os 10 pontos extraordinários já documentados: as frentes visuais e de
performance já estavam próximas do limite, enquanto o crédito restante depende
de nova execução remota do Actions/QA, soak noturno e dispositivos reais. Índice
combinado continua **102,6/110**, não conclusão da meta.

## Soak concorrente ampliado e hardening das fixtures — 2026-10-03

O teste inicialmente parou antes de escrever qualquer atendimento porque a
instância QA local estava sem o tenant sintético. O guard confirmou novamente
que o único alvo era o Supabase em loopback; o provisionador idempotente recriou
sete contas sintéticas, dois tenants, memberships, assinatura/catálogo e a
fixture de portal. Para evitar que senhas aleatórias das fixtures apareçam em
logs locais, o provisionador agora emite diretivas `add-mask` somente dentro do
GitHub Actions.

Com as fixtures prontas, o soak concorrente passou por 10 minutos: 10.961
lotes, 87.688 tentativas, 10.961 reservas aceitas (exatamente uma por lote) e
76.727 conflitos de exclusão mútua esperados. O p95 máximo por lote foi 76 ms,
a mediana 11 ms; `cleanupFailure` foi nulo após a consulta de resíduos. Isso
reforça o soak local, mas não substitui a execução do workflow noturno no
Actions/QA remoto ou a validação em dispositivos físicos. A suíte base de
concorrência também repetiu 2/2 fluxos: integridade de transições e rajadas de
25/50/100 reservas (p95 89/56/104 ms); soak, tráfego misto e multi-tenant são
opt-in e aparecem como três skips esperados nesse gate. Foi criado um gate PR
de concorrência e um workflow diário/manual de soak local de 10 min, com
Supabase efêmero, artefatos e limpeza; os arquivos YAML foram analisados
localmente, mas ainda não foram publicados/executados no Actions. O índice
permanece 92,6% na base e **102,6/110** no total combinado.

## Revalidação de QA local e Actions — 2026-10-03

A instância dedicada `cativa-qa-local-20261002` foi identificada por seu
`workdir`, `project_id`, loopback HTTP e porta PostgreSQL 56202. Não usei as
instâncias locais de outros projetos nem o Supabase remoto. Sem reset do banco,
sincronizei para o diretório QA apenas os arquivos de migration ausentes e
apliquei `20261003000000_add_atomic_retention_advisor_quota.sql`; a tabela de
migrations local e o schema passaram a corresponder ao código atual.

Os 14 gates SQL passaram: RLS, IDOR, Realtime, Storage, CRM media, notas de
clientes, agenda, referências de disponibilidade/fila, confirmação/portal,
catálogo/CRM, administração/unidades, auditoria de 82 FKs tenant-aware e quota
Jev, mais o histórico restrito do scanner de segurança. A prova concorrente reservou exatamente 5 de 32 chamadas ao limite diário,
negando as outras 27. A matriz Storage via API também passou para owner,
manager, frontdesk, professional, client e owner de tenant B; incluiu upload,
overwrite, download assinado, MIME malicioso, limite exato, excedente, disputa
concorrente e limpeza das fixtures e objetos.

Na unidade, quatro módulos de domínio passaram 34/34 casos focados. A suíte
completa passou 725/725 em 58 arquivos; cobertura global ficou em 18,07%
statements, 15,11% branches, 13,87% funções e 18,91% linhas. A validação da
matriz de Storage no Node padrão 20 parou antes de qualquer fixture, porque o
cliente Supabase exige `WebSocket` nativo; repetida com o Node 24 do workspace,
terminou com sucesso e cleanup confirmado.

A inspeção somente-leitura do primeiro Actions (SHA `621968e`) mostrou o job
unitário e `backend-integrity` aprovados, mas a provisão autenticada remota
falhou ao consultar usuários com HTTP 500 (`Database error finding users`) e a
regressão visual autenticada encontrou divergências de baseline. Para a falha
transitória de provisionamento foi implementado backoff limitado a três
tentativas, sem repetir erros 4xx nem esconder falha persistente; a suíte Node
isolada passou 6/6. Essa correção ainda não foi enviada ao GitHub, então o retry
remoto continua sem validação. Snapshots não foram atualizados automaticamente:
as diferenças precisam de revisão visual antes de aceitar novos baselines.

O migration `20261003100000_create_security_scan_history.sql` criou as tabelas
de histórico de scans e findings com RLS habilitado e acesso de leitura/gravação
restrito ao service role. O regression SQL validou grants, políticas e vínculo
scan/finding; o rescan local registrou sua execução em `public.security_scans`.

## Isolamento do backend visual e dependências de runtime — 2026-10-03

A primeira repetição da matriz pública revelou que a configuração padrão usava
a porta Supabase `54321`, que pertencia a outro stack local. A execução foi
interrompida sem escrita de dados; o JWT de teste foi rejeitado. A configuração
passou a usar um host reservado `.invalid`, que não resolve para serviço real, e
o helper mocka planos, flags públicas, componentes/incidentes do status e o
protocolo Realtime. Um
endpoint REST sem fixture recebe falha e faz o teste falhar; o smoke focado
passou 4/4 para landing/planos e 3/3 para status/breakpoints. A matriz integral
de layout e reflow repetiu 300/300 casos nos 15 projetos desktop, tablet,
mobile, landscape, Chromium, Firefox e WebKit. Relatórios foram escritos em
`/tmp`; nenhum snapshot baseline foi atualizado. As configurações públicas,
OAuth, autenticação e performance usam domínios reservados `.invalid`, sem
dependência de portas locais livres ou serviços de outros projetos.

A análise do lockfile também encontrou `tailwindcss-animate` listado como
dependência de runtime, embora só seja carregado pelo build do Tailwind. Foi
movido para dependências de desenvolvimento nos manifests npm/Bun e lockfiles.
`npm audit --omit=dev` passa com zero vulnerabilidades e o CI recebeu um gate
correspondente. Atualizei `typescript-eslint` de 8.38.0 para 8.71.0 dentro da
faixa compatível e sincronizei os lockfiles npm e Bun; lint, typecheck e os 725
testes unitários passaram depois da atualização. O audit integral caiu de 14
para 8 alertas altos, todos na cadeia de build/desenvolvimento. Ela inclui
Tailwind 3.4.x e `braces` até 3.0.3; o [advisory oficial do GitHub](https://github.com/advisories/ghsa-vfj7-8cjw-p6xm)
não lista versão corrigida para `braces`. A migração Tailwind 4 seria uma
mudança major e não foi aplicada sem uma validação de compatibilidade própria.
O risco restante está fora da árvore de runtime e deve ser reavaliado quando o
upstream publicar correção compatível.

## Reexecução autenticada local e correção do harness — 2026-10-03

A rodada foi direcionada somente à instância descartável em loopback
`127.0.0.1:56201`, usando tenants sintéticos com sufixo exclusivo `qatest26`.
O preflight autenticou o owner local e 17 cenários únicos em 11 specs de shell,
RPC de auditoria, login, limites, CRM, importação/exportação, portal e troca de
tenant terminaram aprovados; o caso de mídia foi repetido depois da correção e
a spec completa passou 2/2. A sessão de teste anterior estava expirada e foi
substituída por um `storageState` local válido.

A primeira preparação local não exportou as credenciais geradas; corrigido o
harness, a autenticação revelou outra divergência: o runner havia injetado um
`VITE_SUPABASE_PROJECT_ID` diferente do padrão que o cliente usa em loopback.
Removida essa variável no runner, login e navegação autenticada passaram. Para
evitar a repetição, `generate-storage-state.mjs` agora deriva a chave igual ao
`@supabase/supabase-js` (`sb-<primeiro rótulo do host>-auth-token`), com 4/4
testes unitários incluindo domínio hospedado, IPv4 e host local nomeado; o gate
foi adicionado ao CI, mas ainda não executado no GitHub.

No CRM, o teste usava SVG como fixture de sucesso, apesar de o produto rejeitar
corretamente conteúdo ativo nesse campo. A fixture foi trocada por PNG 1×1
válido; o E2E agora confirma o MIME e a assinatura PNG do download assinado. Não
houve alteração na política de upload do produto. Os arquivos temporários de
credenciais sintéticas foram removidos ao fim das execuções.

## Reflow e espaçamento de texto WCAG — 2026-10-03

A nova suíte pública injeta os valores de espaçamento previstos pela WCAG 1.4.12
(entrelinha 1,5; espaçamento entre parágrafos 2×; letras 0,12em; palavras
0,16em) e verifica dimensões, overflow, controles críticos e conteúdo visível em
640 e 320 pixels CSS, equivalentes à largura útil de uma tela de 1280 px a reflow
de 200% e 400%. Não afirma simular o zoom físico do navegador. Foram verificadas
10 rotas públicas — landing, planos e alias, privacidade, termos, status, login,
recuperação, acesso do portal e onboarding — em todos os 15 projetos de viewport
e navegador: 150/150 casos passaram, cobrindo Chromium, Firefox, WebKit, desktop,
tablet, mobile, breakpoints e landscape.

O teste encontrou transbordamento em “Fale com a gente” e “Começar agora grátis”
na página de planos, além dos CTAs “Enviar Link de Recuperação” e “Continuar para
Configuração”. Os links e botões agora permitem quebra de linha e crescem em
altura quando necessário, preservando a área tátil. Após as correções, os 40
casos representativos passaram; em seguida a matriz inteira de 150 passou. A
suíte pública combinada de layout e reflow passou 300/300. O mock de planos foi
extraído para um helper compartilhado; uma reexecução focal de 24/24 eliminou o
erro de JWT fictício dos logs e confirmou o isolamento da consulta. O gate está
incluído no comando público de layout já executado no job de qualidade visual do
CI. Zoom em navegador físico, leitores de tela e aparelhos reais continuam fora
do que o browser headless pode comprovar.

## Sondagem de autenticação e invariantes — 2026-10-03

O parser de retorno OAuth foi submetido a um corpus adversarial com barras
invertidas, formas percent-encoded, caminhos relativos e URLs externas. O
resultado só é aceito se a URL canônica permanecer na origem local. A matriz
determinística de analytics passou a comparar cada estado gerado com contagens
calculadas no teste, além de verificar limites de taxa e numerador/denominador.
Uma nova fixture mostrou que o card “Novos clientes” contava reservas pendentes,
faltas e cancelamentos como pessoas atendidas. Agora, o cálculo usa os mesmos
estados `arrived`, `in_service` e `completed` da métrica de comparecimento.
Os casos direcionados de credenciais inválidas, recovery bem-sucedido, resposta
429 e retry passaram 9/9 em Chromium, Firefox e WebKit, com e-mails `.test`, API
simulada e callback local. A suíte tornou-se um gate do job de segurança no CI,
com evidências em diretório separado para JUnit, screenshots e traces de falha.

A fila de agenda offline passou por 320 operações sintéticas conferidas contra
um modelo de referência no teste: ações repetidas substituem apenas a chave
correta `(tenant, atendimento, tipo)`, limpeza por tenant não afeta os demais e
registros inválidos não contaminam a leitura. O manifesto de evidências foi
validado com fixtures descartáveis: agrega JUnit, calcula hash de cada arquivo,
emite sidecar SHA-256 e não serializa o conteúdo, tokens, storage state ou
destinos de symlinks. Caminhos fora da raiz declarada são recusados.

Na revisão das consultas analíticas foi constatado que vários `select` não
paginaram e podiam omitir silenciosamente linhas acima do limite por resposta do
PostgREST. A leitura foi padronizada em páginas determinísticas de 500 linhas,
com lotes limitados para filtros `IN`; isso inclui agenda e itens de serviço,
clientes e seu histórico, disponibilidade, contatos, fila, pacotes e rótulos.
Testes do repositório usam 1.001 clientes, 1.600 agendamentos históricos e um
agendamento de outro tenant, além de uma consulta separada com 1.001
agendamentos e itens de serviço: verificam páginas, primeira/última visita,
contagem integral, hidratação e isolamento por tenant. O helper de paginação
também passou casos de limite exato, erro e 2.503 linhas.

A conta de minutos disponíveis passou a unir janelas e bloqueios antes de
somar/subtrair, e a recortar o expediente às fronteiras `[início, fim)` do
relatório. Isso evita sobrecontagem com janelas duplicadas/sobrepostas e
descontos duplicados de bloqueios coincidentes. O fechamento `24:00` é aceito;
avanço por dias civis também foi exercitado em transições de horário de verão.
Além dos casos direcionados, 64 agendas sintéticas foram comparadas a um
oráculo independente de 1.440 minutos cada. A distribuição por origem agora
reconcilia o percentual arredondado para totalizar 100,0%; 256 misturas
determinísticas verificam contagens, ordem e percentuais.

Na mesma auditoria, as saídas monetárias passaram a preservar centavos no ticket
médio, receita por grupo, valor futuro, risco, rentabilidade/hora e LTV. Os
resultados mantêm arredondamento em centavos em vez de perder frações de real.

Também foi repetida a suíte pública de segurança: 62/62, incluindo 27 varreduras
axe/WCAG 2.2 AA, 30 combinações rota/viewport, validação de conteúdo contra XSS
e esquemas executáveis, foco e controles de login. Os novos fluxos auth passaram
em execução separada para preservar os artifacts existentes. As requisições
para provedor e serviço de email foram simuladas; não houve conta externa nem
envio real. Logs de preload de fonte decorreram do bloqueio intencional de rede
externa no harness, e não causaram falha de rota ou acessibilidade.

## Reforço de contrato Jev e cobertura crítica — 2026-10-03

O gate de cobertura voltou a passar em 677/677 testes, distribuídos por 53
arquivos. A inspeção das linhas não cobertas levou a novos casos para payloads
inválidos, backoff padrão, `Retry-After` ilegível e falhas inesperadas do
adaptador HTTP; respostas sem modelo, com contêiner de respostas inválido ou
tipos Jev incompatíveis também são rejeitadas explicitamente. Na cobertura V8
dos módulos críticos, `supabase/functions/_shared/jev.ts` atingiu 100% em
statements, branches, funções e linhas. `retention-advisor/logic.ts` atingiu
100% em statements, funções e linhas e 95,48% em branches.

A função de interpretação de retenção agora valida o contêiner `answers` antes
de acessar os resultados individuais, produzindo erro controlado para resposta
malformada em vez de falhar com `TypeError`. O cliente não chamou o provider
real e não usou a chave TypeSafe. `npm run typecheck`, lint direcionado e
`git diff --check` passaram nesta rodada.

A validação também foi alinhada à resposta documentada pelo TypeSafe: os campos
`model`, `answers` e `usage` são obrigatórios, os contadores de uso precisam ser
inteiros não negativos e a resposta `Score` precisa incluir confiança válida.
As fixtures agora representam esses campos; não são apenas objetos mínimos
aceitos pelo parser. Referências: [API HTTP TypeSafe](https://docs.typesafe.ai/api)
e [primitiva Score](https://docs.typesafe.ai/primitives/score).

O workflow ganhou um job independente de Core Web Vitals, sem secrets, com
Chromium, build temporário, backend simulado e retenção dos artefatos HTML/JUnit.
O YAML foi analisado localmente e o gate repetido em Node 24 passou em 18/18.
Após reaplicar todas as migrations no banco descartável isolado, o rescan final
confirmou 0 achados críticos, 0 avisos não aceitos e 5 achados aceitos já
documentados; a instância de auditoria foi parada novamente e o Supabase QA do
usuário permaneceu ativo.

A medição de produção local repetida nesta rodada passou em 18/18. O primeiro
caso de uma sessão Chromium nova (landing 320 px) marcou FCP/LCP de 1,972 s;
numa repetição tripla isolada, os valores foram 1,964 s, 264 ms e 260 ms, sem
reprodução do atraso após o primeiro caso. Nas outras larguras da landing, FCP
ficou entre 252 e 304 ms; em `/planos`, entre 180 e 220 ms. CLS permaneceu 0
em todas as combinações, e os limites operacionais foram respeitados. Como o
alvo suave de 1,8 s só falha no primeiro carregamento do browser e não é um
problema reproduzível da página, não alterei animações visuais às cegas; o
resultado cold-start continua destacado para acompanhamento. As medições usam
backend 503 simulado e hosts externos controlados; não equivalem a RUM nem a
device farm.

## Contrato OAuth Google/Apple em sandbox local — 2026-10-02

Foi acrescentada uma suíte Playwright sem credenciais ou chamadas a provedores:
ela abre o login real do app, inicia cada fluxo pelo broker local simulado e
verifica `provider`, `redirect_uri`, `state` e a ausência de tokens ou
parâmetros extras na URL. Os dois casos passaram em Chromium (2/2), e o gate foi
ligado ao job de Core Web Vitals para rodar em PR; relatórios HTML/JUnit ficam
isolados e são enviados como artefatos do job. Isso valida somente o contrato
app→broker. Callback com Google/Apple sandbox, credenciais do provedor e
aparelhos físicos continuam explicitamente pendentes.

Nesta rodada, `npm run test:coverage` passou em 677/677 testes/53 arquivos,
`npm run typecheck` passou, lint terminou com 0 erros e os 17 avisos Fast Refresh
conhecidos; `npm run test:build:missing-env` passou, o workflow YAML foi validado
e `git diff --check` não apontou problemas.

## Reexecução integral de layout e contraste — 2026-10-02

A matriz responsiva inteira foi repetida após a correção anterior de Clientes:
330/330 casos passaram em 15 projetos, em Chromium, Firefox e WebKit, com
rotas públicas e autenticadas, telas desktop/notebook, seis fronteiras de
breakpoint, tablets, mobile 320/360/390 px e landscape. A execução levou 8,6
minutos, sem clipping, overflow horizontal, foco invisível ou dialog fora da
viewport. Os diretórios JUnit/HTML foram isolados em diretório temporário para
preservar os artefatos já existentes.

A auditoria de contraste foi endurecida para avaliar textos no estado final das
animações de entrada, em vez de capturá-los durante um fade. Isso revelou
contraste insuficiente no destaque verde de duas seções claras e no texto de
apoio de uma seção escura da landing; os destaques agora usam `accent-strong` e
o texto escuro usa branco com opacidade acessível. Os números grandes do fluxo
de processo são ornamentais: receberam `aria-hidden="true"` e são a única
exceção explícita do scan de contraste. Depois dos ajustes, os 36 casos passaram
em iPhone SE, Android 360 e iPad, com 51 varreduras WCAG 2.2 AA incluindo app e
portal em claro/escuro. A suíte pública de segurança/acessibilidade passou
62/62; seu harness bloqueia recursos externos e responde às RPCs públicas com
fixtures.

`npm test` passou 600/600, typecheck e `git diff --check` passaram, lint ficou
com zero erros e os 17 avisos existentes de Fast Refresh. O build PWA atual
passou em diretório temporário e os E2E de fila offline/503/retry, Realtime e
reabertura da agenda pelo app shell passaram 3/3. O modo sem configuração também
passou (`test:build:missing-env`). Fixtures específicas da jornada offline foram
removidas: consulta ao Supabase descartável terminou com zero clientes e zero
agendamentos residuais. Nenhum projeto remoto ou compartilhado foi alterado.

## Core Web Vitals em build de produção — 2026-10-02

O gate `npm run test:performance:cwv` constrói o frontend em diretório temporário
e executa Playwright contra o preview de produção, sem apagar nem reutilizar o
`dist/` do usuário. URLs Supabase e chaves usadas nesta trilha são fictícias;
respostas do backend são simuladas como falhas 503 e as requisições externas são
bloqueadas ou atendidas por fixtures determinísticas. Portanto, estes resultados
são uma medição de laboratório reproduzível, não uma medição de produção nem um
teste autenticado.

A execução final passou em 18/18 combinações de duas rotas (`/` e `/planos`) com
nove viewports: 320×568, 390×844, 430×932, 568×320, 768×1024, 1024×768,
1280×720, 1440×900 e 1920×1080. Na landing, CLS foi 0 em todos os perfis;
LCP variou de 1,324 s a 1,968 s e INP observado de 24 a 72 ms. Em planos, CLS
também foi 0 em todos os perfis, LCP ficou entre 192 e 232 ms e INP entre 16 e
32 ms. TTFB ficou abaixo de 3 ms; não houve imagens quebradas e as falhas
simuladas do backend foram exercitadas sem interromper os testes. Todos os
limites operacionais de LCP (2,5 s), CLS (0,1), TTFB (800 ms), INP (200 ms quando
observável) e FCP (3 s) foram respeitados. O único alvo suave não atingido foi
FCP ≤1,8 s na landing a 320 px (1,968 s); nos outros oito viewports da landing,
FCP variou entre 240 e 348 ms.

A primeira medição encontrou CLS 0,096 na página de planos. O estado de retry
remontava os cartões-base e deslocava a comparação institucional. A tela agora
reserva a mesma geometria para o fallback durante o carregamento, preserva os
valores-base enquanto um retry está pendente e mantém acessível o status. O
Playwright também compara a posição de “O que vem incluso” antes/depois do retry;
essa verificação passou e o CLS caiu para 0,000. A matriz completa de
Core Web Vitals passou em 18/18. Depois das mudanças, `npm test` passou em
596/596 testes unitários e `npm run test:security:public` em 62/62 casos de
acessibilidade, segurança pública e geometria/foco, incluindo planos em 320,
768 e 1440 px. São resultados de laboratório local com backend 503 simulado,
não uma medição de produção nem prova em dispositivos físicos.

## Rodada de acessibilidade e responsividade — 2026-10-02

O gate `npm run test:a11y:contrast` passou em 36/36 casos: as rotas públicas foram
varridas em iPhone SE, Android 360 e iPad; as rotas autenticadas foram verificadas
nos temas claro e escuro (51 análises axe no total). A auditoria encontrou e
motivou correções em semântica ARIA da navegação e dos filtros, controles
interativos aninhados na busca, nomes de barras de progresso, labels de campos,
e contraste de textos pequenos na landing. A regra `color-contrast` permaneceu
ativa durante todo o gate.

A matriz `npm run test:visual:layout` executou 330 casos em 15 perfis de
Chromium, Firefox e WebKit, com rotas públicas/autenticadas, rolagem, foco,
teclado, dialogs e breakpoints. Foram 329/330 aprovados na primeira execução;
o único caso revelou overflow horizontal em Clientes a 1280 px, causado pelo
formulário de criação de tags em uma coluna estreita. A ação foi colocada em
uma linha própria e os controles foram redimensionados; em seguida, Clientes
passou em 15/15 perfis, incluindo o caso de 1280 px. Assim, cada combinação
única da matriz teve evidência de aprovação na versão corrigida. A matriz
integral foi repetida posteriormente e passou 330/330; ver a seção de reexecução
integral abaixo.

Na mesma rodada, `npm test` passou em 596/596 testes de 49 arquivos,
`npm run typecheck` passou, `npm run lint` terminou com zero erros e 17 avisos
preexistentes de Fast Refresh, e `npm run build` passou em Node 24.19 com a
configuração Supabase QA local. O preview do artefato respondeu HTTP 200 em
`/`, `/planos` e `/portal/acesso`, sem erros JavaScript de página. A validação
permaneceu isolada no Supabase descartável local; não houve escrita nos projetos
compartilhados/remotos.

Na execução integral de 2026-10-02, foi usada somente uma instância Supabase
descartável local. O smoke funcional passou 42/42; a matriz RBAC passou 12/12;
autoagendamento local passou 1/1 e agora remove a reserva sintética criada; os
testes SQL de RLS e IDOR passaram. A corrida simultânea confirmou exatamente
uma reserva para duas requisições ao mesmo slot, validou buffer, rollback de
remarcação, cancelamento e reutilização, e limpou todos os registros do teste.
A RPC `get_public_system_flags` foi exercitada pela API HTTP (200), retornando
somente três chaves booleanas permitidas.

A validação visual autenticada passou 36 rotas×viewports, quatro cenários de
navegação/safe-area, uma transição agenda→confirmação e 14 verificações de
BottomNav. A investigação de diferenças encontrou fixtures persistentes do
portal que contaminavam screenshots; a preparação visual agora limpa apenas o
cliente/serviço sintético no tenant QA, com guard destrutivo. Também foram
estabilizados o nome do tenant e datas voláteis, quatro snapshots foram
atualizados após revisão, e o fluxo de navegação agora clica em “Mais”→“Clientes”
sem recorrer a uma navegação direta que mascarava a ausência do link.

Verificação mais recente: `npm test` 600/600, `npm run typecheck`, lint e build
PWA em diretório temporário passaram. O lint mantém 17 avisos preexistentes de
Fast Refresh e zero erros. O reload offline da agenda agora passou junto com
fila/503/retry e Realtime; o contexto local de tenant expira em 24 horas e o
guard libera somente a agenda para leitura e fila local, sem bypass de RLS ou
de validação de membership online. Não houve mutação em projeto compartilhado
ou remoto. Ainda faltam o primeiro run real no Actions, QA remoto, testes offline
prolongados, jornadas autenticadas de performance mais amplas, providers
sandbox e dispositivos físicos.

## Soak local, contenção e tráfego misto — 2026-10-02

A primeira execução do soak (oito chamadas simultâneas ao mesmo horário)
identificou contenção real: em 15 lotes ocorreram sete deadlocks PostgreSQL
(`40P01`) e o p95 máximo chegou a 7,027 s, apesar de a constraint de exclusão
continuar impedindo reservas duplicadas. A análise dos logs localizou a disputa
na verificação concorrente da constraint GiST. Em vez de mascarar o limite,
foi adicionada a migration
`20261002140000_serialize_overlapping_appointment_writes.sql`: um trigger toma
locks transacionais por profissional/recurso e dia UTC, em ordem determinística,
antes de verificar conflitos. O teste agora trata deadlock como falha; somente
`23P01` é aceito como conflito de agenda esperado.

Após a correção, `npm run test:backend:soak` passou por 60 s com oito chamadas
concorrentes: 1.595 lotes, 12.760 chamadas, exatamente uma reserva vencedora em
cada lote, 11.165 conflitos `23P01`, nenhum deadlock, p95 máximo por lote de
39 ms e mediana de 11 ms. A limpeza final e a consulta de resíduos confirmaram
zero reserva sintética remanescente. O teste também anexa
`appointment-soak-summary.json` ao relatório Playwright, preservado em
`e2e/.artifacts-backend-soak` e `e2e/.report-backend-soak`.

`npm run test:backend:mixed` simulou, em dez rodadas, 250 mutações concorrentes
junto com 120 leituras de disponibilidade e agendamentos. Todas as leituras
passaram; p95 global de leitura foi 115 ms (máximo 121 ms), p95 máximo das
mutações foi 125 ms, as 240 derrotas esperadas foram `23P01` e a limpeza deixou
zero resíduo. O cenário gera o anexo `appointment-mixed-traffic-summary.json`,
preservado em `e2e/.artifacts-backend-mixed` e `e2e/.report-backend-mixed`.
O gate `npm run test:backend:concurrency` foi repetido depois da correção:
integridade/transições passaram e as rajadas de 25/50/100 registraram p95 de
51/69/85 ms, respectivamente, com exatamente um vencedor e apenas conflitos
`23P01`. Tudo foi executado contra o Supabase local descartável; não houve
acesso de escrita aos projetos compartilhados ou remotos.

Na continuação, o soak foi elevado a cinco minutos completos com oito
solicitações simultâneas: 6.848 lotes, 54.784 chamadas, uma reserva persistida
por lote, 47.936 conflitos esperados `23P01`, p95 máximo por lote de 52 ms e
mediana de 10 ms. Não houve deadlocks nem falhas de limpeza. JUnit e relatório
HTML foram preservados em `e2e/.artifacts-backend-soak-5m` e
`e2e/.report-backend-soak-5m`, sem sobrescrever a evidência do soak de um minuto.

O cenário `test:backend:multitenant` executou dez rodadas usando owner e
recepção do tenant A enquanto o owner do tenant B lia dados próprios e tentava
consultar os dados A. Das 250 tentativas de reserva, dez venceram e 240 foram
conflitos `23P01`; as 50 leituras tiveram p95 de 42 ms e máximo de 95 ms. Não
houve erro de leitura, vazamento cross-tenant ou resíduo após a limpeza. A
suíte foi adicionada somente ao job de CI que inicia um Supabase efêmero local;
esse cenário não usa credenciais nem grava no projeto compartilhado/remoto.

## Recuperação offline e atualização em tempo real — 2026-10-02

A inspeção do banco QA local encontrou a publicação `supabase_realtime` sem
nenhuma tabela inscrita, embora a agenda e a central dependam de eventos
Postgres. A migration
`20261002150000_enable_tenant_realtime_publication.sql` adiciona, de forma
idempotente, `appointments`, `appointment_items`, `clients`, `waitlist_entries`
e `confirmation_queue`. Um teste SQL dedicado exige essas cinco tabelas no
publication; a regressão passou no banco descartável e também foi incluída no
job local do CI.

A jornada E2E mobile passou 3/3: (1) operador deixa a agenda offline, enfileira
uma confirmação, recebe uma falha HTTP 503 injetada ao reconectar, mantém a
ação pendente e a persistência do banco inalterada, e conclui o retry manual
com a fila zerada; (2) após a assinatura do canal do tenant, uma segunda sessão
altera o agendamento e a tela da agenda reflete a mudança via Realtime; (3) o
app shell reabre a rota `/app/agenda` sem conexão e restaura o atendimento do
snapshot local, sem alterar o banco. A terceira jornada encontrou o guard de
onboarding barrando qualquer rota enquanto o membership não podia ser
revalidado. O TenantProvider agora mantém um contexto local por usuário por até
24 horas; o fallback não aceita `super_admin` nem cliente e o guard libera
exclusivamente a agenda enquanto `navigator.onLine` é falso. Outras rotas
continuam bloqueadas até a confirmação do servidor. O teste
também protege a fila local contra PII redundante: o nome do cliente não é mais
copiado para o rótulo persistido em `localStorage`. A primeira tentativa da
asserção de handshake assumia payload JSON de objeto; o protocolo Realtime v2
envia frames posicionais, então o helper foi ajustado para ambos os formatos e
o teste passou sem alterar o comportamento de rede do app.

As duas jornadas foram adicionadas ao job que usa Supabase efêmero; as fixtures
privilegiadas são removidas antes da etapa que limpa a service-role key. O
escopo permanece local e sintético; nenhuma migration foi aplicada aos
projetos compartilhados/remotos. Na validação inicial, permaneciam como
próximos casos a duração offline prolongada, fila mista sob desconexões
repetidas e variações adicionais de falha/recuperação de rede; o fechamento
desses cenários está registrado abaixo.

## Fila offline mista, concorrência de sincronização e validade do contexto — 2026-10-02

A sincronização agora usa um bloqueio síncrono por montagem do hook: o evento
`online`, a tentativa ao montar e o retry manual não podem aplicar a mesma fila
simultaneamente. Uma reconexão que ocorra enquanto a requisição anterior ainda
falha fica marcada e provoca uma nova leitura da fila ao fim da tentativa. Sem
tenant resolvido, a fila não é enviada nem exposta ao consumidor; as ações
retornadas são filtradas pelo tenant atual. A coalescência de ações também exige
correspondência de tenant, atendimento e tipo. O parser local descarta itens
malformados e status desconhecidos antes de qualquer mutação.

Foram adicionados testes unitários para concorrência entre reconexão/montagem/
retry manual, reconexão durante uma falha em andamento, ausência de tenant,
falha transitória com preservação da ordem, isolamento da fila e descarte de
registros locais malformados. O total passou para 606/606 testes em 51 arquivos.

A primeira jornada Playwright local passou 6/6 no Supabase descartável: retry após 503;
fila preservada após rate limit HTTP 429 com `Retry-After`; duas ações offline
em atendimentos distintos; duas reconexões com falha, preservação de ambas as
ações e sucesso final exatamente uma vez por ação; atualização externa por
Realtime; reload do app shell com snapshot; e bloqueio do acesso à agenda quando
o contexto de membership local tem mais de 24 horas.
O caso de fila mista também confirma que nenhuma alteração chega ao banco antes
da sincronização e que confirmação/cancelamento convergem aos estados
esperados. Depois dos testes, a consulta às fixtures sintéticas retornou zero
clientes e zero agendamentos offline remanescentes. Build, artifacts, traces e
relatório Playwright ficaram fora do checkout, em diretório temporário.

O harness foi ajustado para escolher dois horários de fixture sem sobreposição;
o estado de autenticação QA expirado foi renovado pelo bootstrap local. Esses
ajustes não alteraram o backend compartilhado. Naquele ponto ainda faltavam
uma matriz HTTP/transporte mais ampla, recarga perto da expiração e soak offline
de longa duração; os dois primeiros itens e um soak real de cinco minutos foram
cobertos na validação abaixo. Soak noturno, primeiro run do GitHub Actions, QA
remoto e dispositivos físicos seguem pendentes.

## Matriz de falhas e restauração offline — 2026-10-02

A jornada PWA mobile passou 7/7 no Supabase descartável local. Além de 429 com
`Retry-After`, foram injetados 401, 403, 409, 422, 500, 503 e falha de transporte
durante a sincronização: em cada tentativa a ação permaneceu na fila, o estado
persistido no servidor continuou `pending`, e somente após remover a falha o
retry confirmou o atendimento e esvaziou a fila. O teste também verifica a
quantidade de requisições para impedir gravação duplicada.

O soak opt-in manteve a agenda desconectada por cinco minutos reais, com dez
checagens a cada 30 segundos: a ação permaneceu na fila, nenhum `PATCH` saiu e
o servidor permaneceu `pending`. Após reload ainda offline, a agenda foi
restaurada do snapshot; ao reconectar, a fila foi concluída com exatamente um
`PATCH`. A primeira execução revelou dois PATCHs concorrentes quando mais de
uma instância do hook tentava processar a mesma fila. A sincronização agora é
serializada por tenant no documento, e um teste unitário cobre duas instâncias
do hook disputando a fila. O teste de cinco minutos é explicitamente opt-in
(`E2E_RUN_OFFLINE_SOAK=true`) para não alongar o gate padrão de PR.

Na restauração do app shell, uma ação de confirmação enfileirada foi preservada
após reload sem rede, reaplicada visualmente ao cartão e exibida como pendente;
o banco continuou inalterado. O contexto de membership foi avançado para 23h59
e aceito dentro do limite de 24 horas; com 25 horas, a agenda foi corretamente
barrada. A margem do cenário de 23h59 foi ampliada para 60 segundos porque um
segundo não cobria o tempo real da navegação Playwright; a regra de expiração
do produto não mudou. Testes unitários adicionais rejeitam snapshot com data
inválida/futura, payload inválido e cache ultrapassando sete dias, mantendo o
snapshot imediatamente antes do TTL.

Validação final dessa fase: `npm test` passou 609/609 em 51 arquivos;
typecheck passou; lint terminou sem erros e manteve os 17 avisos Fast Refresh
preexistentes; build de produção e service worker passaram em diretório
temporário. A suíte PWA padrão passou 7/7; o único teste omitido foi o soak
opt-in, aprovado separadamente 1/1 em 5,2 minutos. A consulta ao Supabase local
descartável confirmou zero clientes e zero agendamentos das fixtures offline.
O caso perto de 24 horas é uma simulação de relógio persistido, não um soak de
24 horas reais; soak noturno, execução confirmada no GitHub Actions, QA remoto e
aparelhos físicos continuam pendentes.

## Concorrência de alta contenção e Storage — 2026-10-02

O teste de backend foi ampliado para disputar o mesmo slot com 25, 50 e 100
chamadas simultâneas à RPC `create_appointment_atomic`. As três rajadas passaram:
cada uma persistiu exatamente uma reserva; as outras 24/49/99 respostas foram
conflitos de exclusão esperados (`23P01`), sem erro de transporte ou servidor.
Na última repetição, o p95 por chamada foi 20 ms, 52 ms e 106 ms,
respectivamente, abaixo da
referência inicial de 1,2 s para mutações. São medições do Supabase local
descartável, não um SLA de produção. O teste preserva métricas JSON como anexo
Playwright e agora falha se não conseguir limpar todas as reservas ou encerrar
a sessão; a consulta posterior confirmou zero fixture residual.

O gate de Storage também ficou protegido pelo guard de alvo QA local/remoto
explícito. No QA local, o upload para tenant B foi negado com HTTP 403; o fluxo
autorizado de tenant A em `client-media` completou upload, URL assinada e
download com conteúdo íntegro, removendo o objeto no `finally`. O teste agora
falha se a limpeza do objeto ou da sessão não ocorrer. Consulta posterior
confirmou ausência do arquivo. A matriz de MIME/tamanho, limites de plano,
operações por todos os papéis e execução remota ainda precisa ser coberta.

Na continuação de 2026-10-02, `npm run test:coverage` passou novamente em
596/596 testes; a cobertura agregada ficou em 14,68% statements, 11,71%
branches, 11,63% funções e 15,53% linhas, mantendo os pisos críticos por
módulo. `npm run test:security:public` passou em 62/62 cenários, incluindo
contraste/axe, geometria/foco e conteúdo público. `npm audit --omit=dev`
encontrou zero vulnerabilidades. RLS e IDOR passaram no Supabase local
descartável, com todas as fixtures removidas pelos próprios testes.

Essa execução expôs uma dependência ambiental: o host não tinha `psql`, embora
o PostgreSQL local estivesse saudável. Foi criado `scripts/e2e-run-db-test.mjs`:
ele aplica o guard existente, usa `psql` do host quando disponível e só recorre
ao container Supabase quando `E2E_LOCAL_SUPABASE=true`, alvo/allowlist forem
exatamente `local`, URL for loopback e houver exatamente um container Supabase
PostgreSQL publicando a porta do banco. Os comandos `test:rls` e `test:idor`
agora usam esse runner e foram exercitados pelo caminho Docker local. O job de
CI do Supabase efêmero inclui os dois gates antes de provisionar os perfis.
A primeira varredura do esquema QA encontrou duas políticas de leitura
concedidas ao papel `public`; suas condições já negavam anônimos, mas o escopo
do papel foi estreitado para `authenticated` numa migration nova. As regressões
SQL agora verificam que essa separação não regrida. `security:rescan` ganhou um
fallback igualmente restrito ao container local quando o host não tem `psql`;
executado com persistência desativada, o resultado final foi zero achados
críticos e zero avisos não aceitos (cinco exceções documentadas, incluindo
`password_history`, que só é acessada por RPCs protegidas ou `service_role`).
A auditoria completa inicial desta rodada detectou quatro vulnerabilidades
moderadas na cópia antiga `esbuild 0.18.20`, somente na cadeia de ferramentas
de desenvolvimento. Apliquei um override restrito de `@esbuild-kit/core-utils`
para `esbuild 0.25.12`, versão corrigida pelo advisory. Após reinstalação,
`npm audit` reportou zero vulnerabilidades, `npm ls esbuild` confirmou a árvore
corrigida, e `drizzle-kit --version`, typecheck e 596/596 testes passaram. O
build de produção também passou com 3.259 módulos e service worker gerado; foi
emitido em diretório temporário e removido ao final, preservando `dist/`. O
Vite manteve seu `esbuild 0.28.2`. `bun.lock` foi regenerado com o override e
validado por `bun install --frozen-lockfile --lockfile-only` (Bun 1.4.2). O lint
completo passou sem erros e manteve os 17 avisos antigos de Fast Refresh.
Nenhum projeto remoto foi acessado ou alterado nesta rodada.

Na preparação das jornadas autenticadas de 2026-10-01, a matriz RBAC foi
ampliada para owner, manager, frontdesk, professional, client e super-admin;
agora cobre acesso direto às rotas e tentativa de inserção RLS de clientes por
perfil. Foi corrigida a separação entre a conta super-admin que provisiona e o
owner sintético que executa as jornadas, e ambos os alvos Supabase vinculados
ao produto passaram a ser protegidos contra testes destrutivos. As rotas de
clientes, confirmações, lista de espera e minha agenda receberam guards
consistentes com a matriz de navegação. Typecheck e lint dos arquivos alterados
passaram; 145 testes unitários de RBAC/permissões/guards passaram. Os 12 casos
Playwright foram descobertos e iniciados em modo seguro, mas ficaram pulados
porque não há credenciais nem alvo QA neste checkout. Nenhum acesso root do SO é
necessário; para não depender disso no Actions, foi adicionado um job com
Supabase local descartável e geração automática das contas sintéticas. O
primeiro run dessa nova trilha ainda precisa confirmar a execução integral.

Na rodada de continuidade de 2026-10-01, `npm run test:coverage` passou novamente
com 595/595 testes em 49 arquivos e manteve a cobertura agregada em 14,72%
statements, 11,74% branches, 11,65% funções e 15,57% linhas. Typecheck, lint,
`test:build:missing-env`, `git diff --check` e `npm audit --omit=dev` também
passaram; o lint manteve 17 avisos Fast Refresh e o audit de produção reportou
zero vulnerabilidades. A suíte pública de segurança/acessibilidade terminou em
62/62. A matriz visual pública executou 150 casos e passou em 150/150, incluindo
os 30 casos WebKit; nenhum teste autenticado, mutação
remota, RLS/IDOR, storage ou integração externa foi iniciado nesta rodada.
Na regressão de screenshots Android 360 px, 3/4 passaram na primeira execução;
a landing diferiu apenas no cartão semântico `accent-strong`, que já usa o tom
verde escuro com melhor contraste e passou a auditoria WCAG pública. Após
revisão visual, foi atualizado somente o snapshot dessa landing; a repetição
terminou em 4/4 (landing, planos, login e acesso ao portal), sem atualizar os
outros baselines.

O lint terminou sem erros e com 17 avisos `react-refresh/only-export-components`
em componentes/providers preexistentes. São avisos de Fast Refresh, não falhas
de validação; a separação desses exports é uma limpeza estrutural futura, sem
impacto funcional demonstrado nesta rodada.

Na validação pública isolada de 2026-09-30, os 62 testes Playwright passaram:
27 verificações axe WCAG 2.2 AA (9 páginas × mobile 320 px, tablet 768 px e
desktop 1440 px), 30 verificações de layout/foco (10 páginas × os mesmos 3
viewports), 2 regressões de formulário/teclado no login e 3 verificações de
conteúdo/link seguro de tenant. Apenas três RPCs públicas de leitura foram
mockadas; qualquer outra chamada externa foi bloqueada. Nenhum dado foi gravado
no Supabase.

Após a correção do tratamento de erros da página de planos, a suíte unitária
passou em 536/536 testes (46 arquivos), o typecheck e o ESLint dos arquivos
alterados passaram, e a matriz pública passou novamente em 120/120 cenários
Chromium/Firefox e 62/62 testes de segurança/acessibilidade. A inspeção manual
local também verificou landing, login e planos em desktop, tablet e celular;
offline, a página de planos agora mantém o aviso/retry e exibe os três valores
base sem toast técnico. Essa verificação usou somente endpoint Supabase fictício.

Na atualização de 2026-10-01, a cobertura V8 passou a incluir TS/TSX de todo
`src/` mais os módulos críticos Jev e retenção (284 arquivos), gerar HTML/JSON
e aplicar pisos por módulo; o CI preserva esses relatórios junto ao JUnit.
`npm run test:coverage` passou com 594/594 testes em 49 arquivos. A linha de
base ampla é 14,72% de statements, 11,74% de branches, 11,65% de funções e
15,57% de linhas. Como ainda há uma lacuna grande em telas/fluxos, não há limiar
global artificial. Pisos por arquivo: analytics ≥95% statements/linhas/funções e ≥90%
branches (resultado: 95,91% statements, 92,81% branches, 97,5% funções e 96,16%
linhas); billing, confirmation, client-validation e scheduling 100% em tudo;
Jev ≥90% statements/branches/linhas
e ≥70% funções (91,37% statements, 95,58% branches, 71,42% funções e 92%
linhas); lógica de retenção ≥90% statements/linhas, ≥85% branches e ≥95%
funções (92,4% statements, 86,45% branches, 100% funções e 94,28% linhas). Os
novos testes detectaram e
corrigiram trial expirado há menos de 24 horas que produzia `-0`; `usagePct`
agora também protege os limites 0..1 contra valores negativos e `NaN`. A
validação de WhatsApp deixou de aceitar um número longo como válido por
truncá-lo silenciosamente; a máscara agora mantém dígitos excedentes visíveis
para que o formulário não os descarte e aceite o número errado. Os mocks do
catálogo foram completados para eliminar retornos `undefined` no React Query.

Na repetição anterior dos gates locais, antes da inclusão dos novos testes de
guarda E2E, `npm test` passou em 536/536 testes e o typecheck passou com o
Node.js 24 do runtime do workspace.
O `npm run lint` terminou com zero erros e os mesmos 17 avisos preexistentes de
Fast Refresh; `npm run test:build:missing-env` passou em diretório temporário e
`npm audit --omit=dev` encontrou zero vulnerabilidades. O Node.js padrão deste
host é 20 e não satisfaz o requisito 22+, portanto a execução deve usar Node 22+
(nesta máquina, o runtime empacotado Node 24). O build normal não foi repetido:
seu hook remove `dist/`, então deve-se inspecionar esse diretório antes de usá-lo
quando houver artefatos locais que precisem ser preservados.

Uma revisão adicional das suítes E2E removeu credenciais embutidas, passou os
logins para variáveis de ambiente e introduziu uma barreira compartilhada de QA:
as jornadas com escrita só iniciam em HTTPS quando `VITE_SUPABASE_URL`,
`E2E_QA_PROJECT_REF` e `E2E_TARGET_ALLOWLIST` correspondem a um alvo não
protegido. A sessão dos testes antigos também foi alinhada ao `storageState.json`
gerado pelo setup atual. Sem credenciais/alvo QA, 22 jornadas de login/escrita,
10 diagnósticos de mutação e 1 teste de concorrência foram explicitamente
pulados; a verificação pública do formulário passou em Android Chromium. WebKit
não iniciou por dependência `libavif.so.16` ausente no host; não houve chamada
autenticada nem escrita remota. Com os testes da guarda adicionados, a suíte
unitária fechou em 539/539; o typecheck, ESLint dos arquivos alterados e
`git diff --check` também passaram.

Os 30 cenários WebKit da matriz visual pública passaram após disponibilizar no
runtime isolado do Playwright as bibliotecas Ubuntu Noble `libavif16`
(`1.0.4-1ubuntu3`), `libgav1-1` (`0.18.0-1build3`) e `libyuv0`
(`0.0~git202401110.af6ac82-1`). Elas foram extraídas em diretório temporário e
copiadas apenas para `~/.cache/ms-playwright/webkit-2272/minibrowser-wpe/sys/lib`,
que é o caminho usado pelo wrapper do MiniBrowser; nenhum pacote foi instalado
globalmente no sistema. O smoke test de inicialização WebKit passou e a matriz
completa terminou em 150/150. Em hosts descartáveis/CI, instalar as dependências
com `playwright install --with-deps` continua sendo o caminho reproduzível.

Na rodada local de 2026-09-30, os lotes públicos Android terminaram com 15/15
passando após corrigir um seletor obsoleto no teste de acessibilidade e incluir
o teste de acesso ao portal. `npm audit
--omit=dev` encontrou zero vulnerabilidades de produção. O audit completo
reportou quatro vulnerabilidades moderadas em dependências de desenvolvimento,
na cadeia transitiva `drizzle-kit` / `@esbuild-kit` / `esbuild`; a recomendação
automática exige `npm audit fix --force` e downgrade potencialmente incompatível,
portanto nenhuma atualização disruptiva foi aplicada. A vulnerabilidade baixa
de `serialize-javascript` foi corrigida por atualização compatível para 7.1.2;
o audit de produção segue com zero vulnerabilidades.

## Execução local reproduzível

Use Node.js 22 ou superior:

```bash
npm ci
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run build
```

O build limpa `dist/` antes de compilar. Segredos não são necessários para os
testes unitários; o build sem variáveis Supabase termina, mas exibe a tela de
configuração ausente para que o artefato não seja publicado acidentalmente.
`npm run test:build:missing-env` valida o fallback em um diretório temporário;
não renomeia `.env` nem escreve no `dist` do projeto. Variáveis exportadas no
processo têm precedência sobre arquivos `.env`.

## E2E e alvo Supabase

O guard `scripts/e2e-target-check.mjs` aborta quando o host não está na
allowlist. Para qualquer teste que cria, atualiza ou exclui dados, também exige
`E2E_QA_PROJECT_REF` e comparação exata com o alvo:

```bash
export VITE_SUPABASE_URL="https://<qa-ref>.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="..."
export E2E_QA_PROJECT_REF="<qa-ref>"
export E2E_TARGET_ALLOWLIST="<qa-ref>"
export SUPABASE_QA_DB_URL="postgres://postgres:<password>@db.<qa-ref>.supabase.co:5432/postgres"
export E2E_SUPER_ADMIN_USER="super-admin-de-teste@example.test"
export E2E_SUPER_ADMIN_PASS="senha-forte-da-conta-super-admin"
export E2E_PASS="senha-sintetica-compartilhada-pelas-fixtures"
export E2E_TENANT_SLUG="studio-teste-qa"
```

`E2E_SUPER_ADMIN_USER/PASS` são exclusivos para a etapa de provisionamento.
`E2E_PASS` é a senha sintética das contas de fixture; após a provisão,
`E2E_USER` passa a identificar o owner do tenant QA. A conta super-admin nunca
deve ser reutilizada como owner. No GitHub Actions, a provisão grava os e-mails
e IDs sintéticos em `GITHUB_ENV` para os passos seguintes. Localmente, copie os
e-mails `E2E_USER`, `E2E_MANAGER_USER`, `E2E_FRONTDESK_USER`,
`E2E_PROFESSIONAL_USER`, `E2E_CLIENT_USER` e `E2E_TENANT_B_USER` que o script
imprime para o ambiente da execução seguinte; as senhas das contas sintéticas
continuam sendo o valor de `E2E_PASS`.

Os projetos `uqskxftzmjsumykpkwus` (CLI vinculado) e
`pegvtrvqdvzxysndddts` (fallback gerenciado do runtime) são protegidos contra
qualquer execução destrutiva, mesmo que sejam informados por engano como
`E2E_QA_PROJECT_REF`.
O guard do banco valida o project ref tanto em conexões diretas quanto no
username do pooler. No GitHub Actions, configure `E2E_QA_PROJECT_REF`,
`E2E_TARGET_ALLOWLIST` e `SUPABASE_QA_DB_URL` como secrets separados.
O workflow de RLS/IDOR registra explicitamente no resumo quando o segredo do
banco QA está ausente.

`npm run test:qa:provision` autentica com a conta super-admin dedicada,
cria/atualiza os perfis sintéticos em dois tenants e grava um manifesto sem
senhas em `e2e/.artifacts-qa/`. A provisão é idempotente e valida
`owner`, `manager`, `frontdesk`, `professional` e `client`; a suíte RBAC também
valida a conta super-admin, a experiência portal do cliente, as rotas por papel
e a permissão RLS de inserir clientes. O teste protege seu alvo mesmo quando
invocado diretamente pelo Playwright, além do guard nos scripts npm.

O job `qa-role-journeys-local` não depende de secrets do repositório nem de um
projeto QA remoto: inicia Docker/Supabase descartável no runner, aplica todas
as migrations com `supabase db reset --local` e gera super-admin, owner,
manager, frontdesk, professional, client e owner do tenant B, com memberships,
unidade, vínculo do cliente ao portal e uma assinatura Studio fictícia para
desbloquear as telas autenticadas. Senhas aleatórias são mascaradas e
vivem somente no job; a chave service-role é removida do ambiente dos passos de
teste. Depois valida credenciais, a matriz de rotas/RLS por perfil e leitura,
atualização e cleanup cross-tenant. Os guards só permitem mutações quando
`E2E_LOCAL_SUPABASE=true`, a URL é HTTP loopback e a ref/allowlist são
exatamente `local`. O stack é destruído em `always()`. Isso habilita RBAC,
rotas e isolamento multi-tenant com dados fictícios sem abrir ou alterar o
Supabase real. Jornadas operacionais amplas e SQL RLS/IDOR remoto continuam
separadas e dependem de um alvo QA externo explicitamente configurado.

Na continuação das jornadas por perfil, o tenant local A também recebe um
serviço público sintético, preço e horários da unidade/profissional nos sete
dias da semana. O caso `e2e/diagnostics/local-portal-booking.spec.ts` autentica
como o cliente sintético, conclui o wizard do portal e confere que o agendamento
`pending` e seu item de serviço ficaram associados ao mesmo cliente, unidade,
profissional e tenant. A Action executa esse caso depois das verificações RBAC e
cross-tenant. O teste foi validado por lint e descoberta Playwright; até a
primeira execução no runner do GitHub, ele permanece implementado, mas não
contabilizado como integração aprovada.

Na continuação de 2026-10-01, a inspeção do portal revelou que a cadeia de
migrations Supabase não tinha RPCs/tabela que a UI e os tipos já consumiam para
regras de autoatendimento, cancelamento, confirmação e reagendamento. Foi criada
`supabase/migrations/20261001090000_restore_secure_portal_self_service.sql`:
restaura o contrato e contador de reagendamentos, aplica RLS nas regras, valida
no servidor as operações do cliente, revalida serviço/profissional/slot e impede
o bypass de elegibilidade pelo RPC `create_appointment_atomic` (que é
`SECURITY DEFINER`). Também remove a política que permitia UPDATE direto pelo
cliente e transfere a confirmação para RPC autorizada. A tela deixa de permitir
que falha de rede ao validar o primeiro agendamento seja interpretada como
permissão; o portal agora oferece retry. O repositório carrega o contador real,
para a UI respeitar o limite de reagendamentos antes do submit.

A nova suíte `e2e/diagnostics/local-portal-self-service.spec.ts` tem cinco
casos: cancelar na UI e verificar o evento de oportunidade para a fila, concluir
o wizard de reagendamento a partir de confirmado, preservando serviço,
reabrindo a tarefa da fila e limpando o estado de confirmação antigo ao gravar o novo horário,
confirmar por RPC e provar que UPDATE direto não altera o agendamento, validar o
limite de uma alteração e o bloqueio de tentativa sobre agendamento de outro
cliente, e conferir no servidor cancelamento desativado, motivo obrigatório e
janela mínima. Ela foi adicionada ao job efêmero do Actions após a jornada de
autoagendamento. Nesta rodada passaram 595/595 testes unitários, typecheck e
ESLint dos arquivos afetados, e Playwright descobriu os cinco casos. O Supabase
local compartilhado não foi reiniciado nem migrado; a validação SQL e a execução
integrada destas mutações permanecem pendentes do primeiro run no stack
descartável do CI.

A mesma trilha local executa `e2e/diagnostics/crm-media.spec.ts` com o owner
sintético: cadastro, leitura e edição de cliente pela UI, upload e remoção de
arquivo/foto no bucket privado, leitura por URL assinada e verificação de que
os registros de mídia foram removidos. O preflight e o seed usam o tenant local
e dados de QA; nenhuma integração externa é chamada. RBAC, isolamento de tenant,
portal e CRM agora mantêm artefatos Playwright em diretórios próprios para que
uma suíte posterior não sobrescreva os traces e relatórios das anteriores. O
teste de CRM já existia para QA remoto e foi ligado à Action local; seu primeiro
run integrado ainda está pendente.

Para cobrir provisionamento/gestão da equipe, a fixture agora cria um usuário
autenticável sem membership. `team-invite.spec.ts` usa essa conta para aceitar
convite de recepção, em vez de reaproveitar uma recepcionista já vinculada. O
tenant sintético A também recebe limites temporários baixos (duas unidades e
três clientes ativos); assim, `plan-limits.spec.ts` e `client-limit.spec.ts`
conseguem validar os bloqueios de UI com apenas uma ou duas linhas temporárias,
que os próprios testes limpam. Os novos comandos têm diretórios independentes
para trace/HTML/JUnit e foram adicionados como passos separados no workflow.
Esses cenários foram descobertos pelo Playwright, mas ainda aguardam a primeira
execução integrada no runner.

Na extensão seguinte, as suítes existentes de importação/exportação de clientes,
catálogo e equipe também foram ligadas ao mesmo Supabase local descartável. Cada
uma roda separadamente com owner sintético, marcador de dados único e diretórios
próprios para screenshots, traces e relatórios; os passos verificam tanto a
gravação no banco quanto o conteúdo do CSV exportado. A primeira execução
integrada segue pendente no GitHub Actions, então a cobertura está configurada,
mas esses fluxos não são contabilizados como aprovados até o runner concluir.

Na validação da Central de Confirmação foi corrigida uma divergência funcional:
as ações de confirmar/cancelar agora atualizam o agendamento, deixando o trigger
existente fechar a tarefa correspondente na fila. A revisão do trigger confirmou
que estados terminais já são protegidos; nenhuma migration adicional foi
necessária. `local-confirmation-center.spec.ts` verifica os dois estados pela
interface e confere ambas as tabelas no Supabase descartável; o primeiro run
integrado ainda aguarda o GitHub Actions.

Com credenciais válidas:

```bash
npm run test:qa:provision
npm run test:qa:authenticated
npm run test:rbac:e2e
npm run test:tenant:isolation:remote
npm run test:backend:concurrency
```

Sem credenciais, a trilha pública pode ser executada explicitamente:

```bash
npm run test:visual:layout:public
npm run test:security:public
```

`test:visual:layout:public` usa `playwright.public-layout.config.ts`: não chama
preflight, não roda setup autenticado, não grava `storageState` e injeta uma URL
Supabase local fictícia para impedir acesso ao projeto real. O resultado vai para
`e2e/.artifacts-layout-public/` e `e2e/.report-layout-public/`. A matriz atual
passou em 150/150 cenários Chromium/Firefox/WebKit. No host local, as dependências
Ubuntu Noble requeridas pelo MiniBrowser foram colocadas somente no diretório de
runtime do Playwright; em CI, use `playwright install --with-deps`.

A suíte pública de segurança usa Chromium e um servidor Vite próprio na porta
18081 (`E2E_SECURITY_BASE_URL` permite substituí-la); não reutiliza servidor
externo. Injeta um endpoint Supabase fictício local, intercepta apenas RPCs
públicas sintéticas conhecidas e bloqueia o restante do tráfego externo.

Os gates completos `test:visual:layout` e `test:a11y:contrast` exigem
credenciais; uma fase autenticada nunca é convertida silenciosamente em skip.
Os testes SQL de RLS/IDOR e o re-scan de políticas usam apenas
`SUPABASE_QA_DB_URL`; o script de alvo barra o banco protegido antes de abrir
uma conexão.

## Layout, responsividade e acessibilidade

`playwright.layout.config.ts` cobre Chromium, Firefox e WebKit em desktop,
notebook, tablet, mobile pequeno/padrão e landscape, além das fronteiras 767/768,
1023/1024 e 1279/1280. `e2e/_helpers/layoutContract.ts` anexa diagnóstico JSON
com viewport, dimensões do documento, overflow, escapes, elementos fixos,
alvos menores que 44 px e overlays cobrindo ações críticas.

```bash
npm run test:visual:layout
npm run test:a11y:contrast
```

O gate de contraste usa axe sem desabilitar `color-contrast`, audita temas claro
e escuro no shell autenticado e registra JSON por rota/tema. Rotas públicas são
explicitamente light-only pelo contrato `ForceLightOnPublicRoutes`.

Os artefatos ficam em `e2e/.artifacts-layout`, `e2e/.report-layout`,
`e2e/.artifacts-layout-public`, `e2e/.report-layout-public`,
`e2e/.artifacts-a11y` e `e2e/.report-a11y`; todos são ignorados pelo Git.

## Jev e métricas

Os testes de `src/test/jev-client.test.ts` cobrem credencial apenas no servidor,
modelo/payload, respostas incompletas, 400/401/403/408/409/422/429/5xx/529,
`Retry-After` e `retry-after-ms`, backoff limitado, timeout, falha de rede,
resposta interrompida, limite de tentativas e serialização inválida. O cliente
repete apenas falhas transitórias e status previstos pelo SDK TypeSafe, nunca
repete indefinidamente. A lógica de retenção preserva médias ausentes como nulas,
exclui contatos futuros dos contadores e valida limiares, dados insuficientes,
contato ausente, pacotes e revisão humana.

`src/test/analytics-golden.test.ts` mantém fixtures dourados para retenção,
ocupação, receita em risco e Índice Cativa; as propriedades de taxa, pesos,
normalização e reconciliação do breakdown são invariantes do gate unitário.

## Artefatos e interpretação

Falhas Playwright preservam trace, screenshot, vídeo quando configurado, console
e o JSON geométrico/axe. Os relatórios devem ser anexados ao PR; atualização de
baseline visual requer revisão humana. Classifique regressões como P0 (ação
inacessível), P1 (quebra/clipping), P2 (desalinhamento funcional) ou P3
(cosmética).

## Storage: autorização, limites e corrida de uploads — 2026-10-02

A matriz revelou que `tenant_storage_bytes_used` tinha `EXECUTE` herdado de
`PUBLIC` e não validava a associação do chamador com o tenant. A nova migration
revoga execução anônima e restringe a RPC a membro ativo do próprio tenant ou
super-admin. `supabase/tests/storage-regression.sql` confirma acesso do membro,
negação para anon e tenant B, e faz rollback integral das fixtures.

O limite de plano era verificado apenas em `INSERT`; substituir um objeto
existente podia passar pela cota. O trigger agora cobre `INSERT` e `UPDATE`,
desconta o tamanho anterior ao medir uma substituição, trata ausência de objeto
sem converter a soma em nulo e serializa gravações pelo tenant com advisory lock.
No QA descartável, o limite temporário de 1 MiB aceitou o valor exato, negou
insert e overwrite com um byte excedente, e oito pares concorrentes aceitaram
exatamente um arquivo por disputa. A assinatura e o uso foram restaurados após
cada rodada.

`scripts/e2e-storage-check.mjs` agora verifica CRUD, URLs assinadas e conteúdo
para owner, manager, frontdesk, professional, client e owner do tenant B. A
equipe autorizada opera somente no próprio tenant; cliente do portal e membro
de B não atravessam para A. Foram exercitados anexos `text/plain` e
`application/pdf`; `e2e/diagnostics/crm-media.spec.ts` passou 2/2 pela UI,
incluindo um nome hostil `../../...` que permaneceu em um único segmento de
objeto sob tenant/cliente, upload/download/remoção de arquivo e foto SVG. As
quatro regressões SQL RLS, IDOR, Realtime e Storage passaram novamente.

O Storage API local traduz a rejeição do trigger de cota como HTTP 500; por isso
o gate verifica o estado posterior e confirma que o uso/objeto não mudou, em
vez de presumir que toda negação terá status 4xx. A tela de CRM também mantém a
checagem preventiva de limite para apresentar o toast específico antes do
upload. Ainda pendentes: definir política de tipos aceitos e teste de MIME
spoofing/assinatura de conteúdo, executar o primeiro CI no GitHub Actions e
repetir RLS/IDOR apenas em QA remoto autorizado. Nenhum banco remoto foi tocado.

## Recuperação de falha parcial em upload CRM — 2026-10-02

O upload para Storage e a inserção em `client_files` são operações em serviços
distintos e não formam uma transação única. Se o Storage aceitasse o arquivo e o
Postgres recusasse os metadados, a mídia ficava órfã. `uploadClientFile` agora
tenta remover o objeto como compensação e mantém o erro original quando a
limpeza funciona. Se a própria limpeza falhar, um erro tipado preserva as duas
causas para diagnóstico e informa à interface que pode ser necessário verificar
a mídia. Quatro testes unitários cobrem limpeza concluída, limpeza recusada,
falha de rede na limpeza e falha inicial de upload (que não deve disparar
remoção); a suíte completa passou com 613/613 testes e typecheck, sem mudança de
contrato no caminho de sucesso.

## Matriz RLS de metadados de mídia CRM — 2026-10-02

`supabase/tests/crm-media-rls-matrix.sql` valida em runtime as tabelas
`client_files` e `client_photos` para owner, manager, frontdesk, professional,
usuário sem membership e owner de outro tenant. Para cada tabela/perfil, verifica
SELECT, INSERT, UPDATE, DELETE e tentativa de reatribuir o registro a outro
tenant (60 assertions no total). A equipe autorizada pode gerenciar mídia do
próprio tenant; os dois perfis sem vínculo não leem, gravam, alteram ou removem
dados alheios. Todas as fixtures são criadas e revertidas dentro da transação.
O gate `npm run test:crm:rls:matrix` passou no Supabase QA local e foi incluído
no job SQL efêmero do CI. A matriz restante ainda precisa abranger as outras
tabelas operacionais e seus papéis específicos.

## Integridade e autorização das notas CRM — 2026-10-02

`supabase/tests/client-notes-rls-regression.sql` reproduziu uma brecha: a policy
que permitia ao autor editar sua nota também aceitava mudar `client_id` e
`tenant_id`; além disso, a autoria mantinha escrita depois da revogação da
membership. A migration `20261002180000_harden_client_notes_scope.sql` agora
impede reatribuir o escopo da nota, valida no banco que o cliente e a nota
pertencem ao mesmo tenant, e exige membership ativo para ações do autor. Owner e
manager continuam moderando notas no próprio tenant; profissional e frontdesk
mantêm edição/remoção das próprias.

A regressão foi executada primeiro contra o estado anterior e falhou no caso
cross-tenant, confirmando o defeito. Depois da migration, a suíte validou
owner/manager/frontdesk/professional, isolamento A/B, operações do autor,
tentativa de alteração de escopo e membership revogado. RLS, IDOR, Realtime,
Storage, mídia CRM e notas passaram juntos no QA local; todas as fixtures foram
revertidas. A migration não foi aplicada em Supabase remoto.

O re-scan de segurança do schema local passou com zero achados críticos e zero
avisos não aceitos; os cinco avisos aceitos são públicos e já documentados (por
exemplo, leitura anônima dos planos e logos públicos). A migration SECURITY
DEFINER usa `search_path` fixo, não concede execução direta a `anon` ou
`authenticated`, e foi exercitada pelo trigger nas tentativas de escrita.

## Isolamento e integridade da agenda — 2026-10-02

`appointment-scope-rls-regression.sql` exercita owner, manager, frontdesk,
professional e tenant B. Os quatro papéis operacionais mantêm leitura e escrita
legítimas no próprio tenant; as regressões bloqueiam IDOR, item ligado a
agendamento/serviço de outro tenant, saldo de pacote ou assinatura alheio,
eventos com tenant divergente e autoria de log falsificada. Também são validadas
referências de agendamento a unidade, profissional, cliente, sala/recurso e
política de cancelamento.

A migration `20261002190000_harden_appointment_tenant_scope.sql` reforça os
triggers dessas relações, impede mover um item para outro agendamento, retira a
inserção direta de histórico de status (ele continua sendo gerado pelo trigger
de mudança de estado) e atribui logs ao usuário autenticado. Um caso com usuário
legitimamente membro dos dois tenants garante que RLS permissivo nos dois lados
não permita transferir o agendamento alterando somente `tenant_id`. A proteção
também impede transferir unidade, cliente, profissional, serviço ou política de
cancelamento referenciada. A migration e as oito regressões SQL passaram no
Supabase local descartável; as fixtures foram revertidas. Nenhum Supabase
remoto foi alterado.

## Disponibilidade, bloqueios e fila de espera — 2026-10-02

`scheduling-reference-scope-regression.sql` valida o CRUD por perfil em
`resources`, `unit_business_hours`, `professional_availability`,
`time_off_blocks`, `recurring_blocks` e `waitlist_entries`. Owner/manager mantêm
gestão de configuração; frontdesk/profissional leem essas configurações sem
alterá-las, e os quatro papéis podem operar bloqueios pontuais e fila no tenant
próprio. `created_by` de bloqueio/fila passa a refletir o usuário autenticado.

A migration verifica unidade do recurso/horário, profissional e unidade da
disponibilidade, escopo de bloqueios, cliente/serviço/profissional/unidade da
fila e se o agendamento associado pertence ao mesmo cliente e tenant. Ela
também impede transferir registros entre tenants mesmo para usuários membros
dos dois. A regressão cobre inserção, atualização, exclusão, acesso negado por
papel, referências B em linhas A e bypass por `service_role`; passou no QA
descartável e foi incluída no job SQL do CI. Com ela, as oito regressões SQL
passaram após aplicação da migration. O Supabase remoto não foi alterado.

## Assinaturas administrativas atômicas — 2026-10-03

A revisão do contrato encontrou que `TenantSubscriptionsTab` chamava
`admin_manage_tenant_subscription`, mas não existia definição dessa RPC nas
migrations versionadas; o banco QA local também confirmou a ausência. As cinco
funções REST antigas de atualização direta eram caminhos mortos no código e
foram removidas para evitar gravar a assinatura sem seu evento de auditoria.

A migration `20261003120000_add_atomic_admin_subscription_rpc.sql` implementa
uma única operação `SECURITY DEFINER`, restrita internamente a `super_admin`,
que bloqueia o tenant durante o upsert e grava assinatura, eventos e `audit_logs`
na mesma transação. O servidor valida motivo obrigatório, plano existente e não
arquivado, desconto dentro do preço, datas coerentes, trial válido e objeto de
limites com apenas chaves permitidas e valores inteiros não negativos. Uma
falha ao gravar auditoria reverte também a alteração da assinatura e os eventos.
O formulário valida as mesmas relações de datas antes do envio.

`npm run test:admin:subscription` passou no Supabase QA local descartável,
verificando grants, negação de owner comum, criação de trial, mudança de plano e
status, validações de desconto/override e rollback injetado de auditoria. O
gate entrou no job SQL do CI; naquela rodada, as 15 regressões SQL então
disponíveis passaram.
Na UI, a matriz RBAC repetiu 12/12 cenários: o `super_admin` abriu a tela,
submeteu uma alteração sintética pela RPC real, verificou evento e auditoria,
restaurou a assinatura e removeu somente os registros identificados por um
marcador aleatório. A verificação posterior confirmou zero resíduos e a fixture
ativa intacta. A quota Jev concorrente passou 32/32 e o smoke Storage real
passou nos seis perfis/tenants, com exclusão dos objetos e contas temporários.

Vitest completo passou 745/745 em 62 arquivos; cobertura atual é 19,13%
statements, 16,59% branches, 14,63% funções e 19,90% linhas. Typecheck, lint
(0 erros; 17 avisos Fast Refresh conhecidos), build de produção isolado,
fallback sem variáveis de ambiente e `git diff --check` passaram. O re-scan
local, executado sem persistir relatório, encontrou 0 críticos e 0 avisos
abertos (5 itens aceitos documentados). Nenhum Supabase remoto ou GitHub foi
alterado. A base permanece 92,6%; com os 10 pontos extraordinários já validados,
o índice combinado continua **102,6/110**. Ainda faltam a nova execução no
Actions/QA remoto, integrações de provider em sandbox real e dispositivos físicos;
esses gates não foram simulados como se fossem evidência de produção.

## Revisão do alerta residual do toolchain — 2026-10-03

`npm audit --omit=dev` continua aprovando com zero vulnerabilidades de runtime.
No audit completo, os oito registros de pacote alto convergem para um único
advisory distinto: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
em `braces@3.0.3`, transitivo de `tailwindcss`/`chokidar`/`micromatch` no
toolchain de desenvolvimento. A revisão upstream informa que ainda não há
versão corrigida publicada. Por isso o risco fica explicitamente aberto e
monitorado; não foi aplicado override especulativo nem declarado como corrigido.

## Compatibilidade do runtime configurado no CI — 2026-10-03

Além da validação anterior em Node 24, os gates locais foram repetidos sob
Node 22.23.2, a mesma major configurada no GitHub Actions: typecheck e cobertura
completa passaram (745/745 testes em 62 arquivos, mantendo os percentuais de
cobertura acima); manifesto de evidências 3/3, retry de provisionamento 6/6,
resolução da chave Supabase 4/4 e build sem variáveis obrigatórias também
passaram. O build de produção transformou 3.264 módulos e gerou o service worker
com 138 entradas de precache em diretório temporário isolado. Isso reduz a
diferença de runtime, mas não substitui uma execução real do workflow no Actions.

## Foco e geometria do dialog de confirmação — 2026-10-03

Uma execução com fixture populada encontrou uma lacuna que o teste visual
original não revelava: ao pressionar Escape, o dialog fechava, mas o foco não
voltava ao botão que o abriu. A `QueueItemCard` agora entrega o botão disparador
ao controlador da central, e o `ConfirmationActionDialog` restaura o foco no
evento `onCloseAutoFocus`, somente se esse elemento ainda estiver conectado.
O teste local verifica também overflow horizontal e limites laterais do dialog,
fecha com Escape, confirma retorno de foco e reabre antes de concluir o fluxo.

A mudança do contrato de `onOpen` atualizou a regressão unitária do cartão para
confirmar o item e o botão recebidos. A spec local passou 10/10, com confirmação
rápida e cancelamento/dialog em iPhone 14 portrait/landscape, iPhone SE, Android
360 e iPad. O comando `test:local:confirmation:matrix` entrou no job de QA local
do CI, antes da remoção da chave privilegiada. A limpeza posterior confirmou
zero registros UUID/clientes desta rodada e removeu dois resíduos antigos de
fixtures somente após validar seus marcadores, tenant sintético e ausência de
referências; não houve alteração no Supabase remoto.

Após a alteração, a cobertura completa passou 745/745 em 62 arquivos sob Node
22.23.2: 19,13% statements, 16,59% branches, 14,63% funções e 19,90% linhas.
Typecheck passou; lint tem 0 erros e os mesmos 17 avisos Fast Refresh. A base
continua 92,6%, pois permanecem os gates externos de Actions, QA remoto,
providers reais e aparelhos físicos; o índice combinado permanece **102,6/110**.

## Validação estática dos workflows e higiene final — 2026-10-03

A checagem de actionlint identificou no workflow de rescan usos de `$` e
crases literais dentro de comandos `sed` que geravam alerta ShellCheck. O
formato do relatório foi simplificado para prefixar os caminhos sem interpolar
metacaracteres e as expressões do GitHub Actions foram movidas para variáveis de
ambiente. Em seguida, actionlint aprovou os quatro workflows versionados.

Para que a proteção não dependa de execução manual, foi incluído no CI um job
dedicado que roda actionlint em imagem Docker identificada por digest imutável.
Após essa alteração, o lint integral terminou com zero erros e os mesmos 17
avisos conhecidos de Fast Refresh; typecheck Node 22, parse de `package.json` e
todos os YAMLs, `git diff --check` e actionlint passaram. A conferência final do
Supabase QA local encontrou zero clientes da fixture de confirmação e zero
agendamentos legados marcados. A saída `dist` compartilhada segue idêntica à
cópia de segurança byte a byte, e não há preview de teste ativo nas portas
4175/8080/18083.

Essa checagem adiciona um gate preventivo, mas não concede pontos à métrica-base
antes de uma execução real do Actions. QA remoto, nova execução de CI, revisão
humana de snapshots, sandboxes dos provedores e aparelhos físicos continuam
pendentes. A base permanece **92,6%** e o índice combinado **102,6/110**.

## Proteção contra retorno após logout — 2026-10-03

A nova spec autentica uma conta sintética do segundo tenant diretamente contra
o Supabase QA descartável, injeta a sessão somente no contexto efêmero do
browser, confirma que o menu de usuário oferece logout, verifica a remoção da
chave de sessão do `localStorage` e tenta abrir `/app` novamente. A navegação
final deve permanecer na tela de login. Traces, screenshots e vídeos ficam
desabilitados nesta spec para impedir que tokens bearer sejam gravados em
artefatos; o estado inicial do Playwright também é sempre vazio.

A primeira matriz encontrou uma diferença do WebKit: o redirect correto para
login interrompia o `page.goto` de `/app` e era tratado como falha pelo runner.
O teste agora aceita exclusivamente essa interrupção de navegação esperada e
continua exigindo a URL final de login. Executada contra o QA local descartável,
a matriz passou 7/7 nos cinco perfis mobile/tablet e nos navegadores Chromium e
Firefox desktop. O comando dedicado foi ligado ao job QA do CI após a remoção
das credenciais privilegiadas; actionlint aprovou essa configuração.

Na mesma revisão, Node 22 passou typecheck, os 745 testes Vitest, os testes de
manifesto (3/3), retry de provisionamento (6/6), chave de sessão (4/4), build
de fallback sem variáveis Supabase e lint (0 erros; 17 avisos conhecidos de
Fast Refresh). `npm audit --omit=dev` encontrou zero vulnerabilidades e
`git diff --check`/actionlint passaram. A evidência nova não eleva a nota: as
pendências de QA remoto/Actions, integração externa real, revisão visual humana
e dispositivos físicos permanecem. Índice: **92,6% na base + 10 pontos
extraordinários = 102,6/110**.

Na rodada de aceite seguinte, a matriz pública de layout e reflow repetiu
300/300 casos nos 15 projetos de viewport/navegador; a campanha pública de
segurança, geometria e acessibilidade passou 65/65 (WCAG 2.2 AA em mobile,
tablet e desktop); autenticação/recovery passou 9/9 e OAuth sintético passou
9/9 em Chromium, Firefox e WebKit. Os três comandos de browser usam serviços
Supabase `.invalid` interceptados localmente e nenhuma credencial real. Um
primeiro disparo da campanha de segurança foi impedido por colisão de porta com
a suíte de autenticação executada em paralelo; após serializar o uso de 18081,
a campanha completa passou. Não houve alteração de código de produto nessa
sondagem nem atualização automática de snapshots.

## Regressão de onboarding atômico incorporada ao CI — 2026-10-03

A revisão dos gates SQL mostrou que `atomic-tenant-onboarding-regression.sql`
estava autorizado pelo runner seguro, mas não tinha comando npm nem era
executado pelo job QA. Rodei a regressão no container
`supabase_db_cativa-qa-local-20261002`, validando nome, estado, imagem, labels e
porta local antes de extrair a credencial apenas para o processo de teste. O
guard aceitou exclusivamente `E2E_LOCAL_SUPABASE=true`, project ref `local`,
allowlist `local` e loopback; nenhum outro stack Supabase nem projeto remoto foi
usado.

A transação verificou que a RPC exige sessão autenticada, rejeita `anon`, cria
tenant/unidade/configurações/auditoria/trial e catálogo inicial com vínculo do
owner ao usuário autenticado, resolve colisão de slug, rejeita preço inválido e
reverte integralmente uma falha injetada na auditoria. O teste terminou com
`ROLLBACK`. Após passar, adicionei `test:tenant:onboarding:atomic` ao package e
ao passo SQL do workflow CI. Com este gate, o conjunto local comprovado passa a
16 regressões SQL. A reconciliação também encontrou que o efeito da migration
`20261002100000_add_public_system_flags_rpc.sql` e seus grants existiam, mas a
versão faltava na tabela local `supabase_migrations.schema_migrations`; reapliquei
o arquivo versionado e registrei sua versão somente nesse QA. A comparação
final ficou em 87/87 migrations do checkout registradas, e os 16 gates SQL
passaram novamente após a reconciliação. A execução publicada no Actions ainda
aguarda o envio e um run real. A nota não aumenta: ainda faltam a validação
externa/CI e demais gates do plano. Índice preservado: **92,6% base + 10 pontos
extraordinários = 102,6/110**.

O re-scan read-only do banco foi repetido após reconciliar o histórico: 0
achados críticos, 0 avisos abertos e 5 exceções já aceitas/documentadas. A
execução usou `SECURITY_SCAN_PERSIST=0`, portanto nenhum registro de histórico
foi escrito no banco; o relatório foi salvo em artefato local ignorado pelo Git.

As 16 regressões também passaram pelo novo orquestrador `test:backend:sql`, que
mantém os logs legíveis no console e grava JUnit atualizado após cada caso; uma
interrupção deixa os testes ainda não iniciados explicitamente como skipped. O
contrato XML passou 2/2 testes unitários. O artefato local contém 17 casos
(preflight + 16 SQL), 0 falhas/erros/skips e nenhuma string com formato de
credencial. O workflow já publica `e2e/.artifacts-qa/` como artefato, mas essa
configuração ainda não foi executada em Actions.

## Aceite local integral por perfil e concorrência — 2026-10-03

Executei a bateria de jornadas contra o container `cativa-qa-local-20261002`,
validando labels Docker, portas locais, banco `postgres` e allowlist antes de
provisionar qualquer fixture. As contas, dois tenants, membership, convite,
catálogo e limite de plano eram sintéticos. O build foi emitido em diretório
temporário isolado; o `dist` compartilhado não foi limpo nem alterado. Nenhum
projeto Supabase remoto, GitHub Actions ou Lovable foi modificado.

Após corrigir uma asserção ambígua do Playwright (a UI já atualizava a assinatura;
o seletor correspondia tanto ao toast quanto à região acessível), o rerun RBAC
passou 12/12 para owner, manager, frontdesk, professional, client e super_admin.
Na bateria, passaram também 17 jornadas autenticadas em 11 specs, isolamento
cross-tenant 1/1, convite/aceite 1/1, portal de agendamento 1/1, autoatendimento
e fila 5/5, agenda offline/Realtime 7/7, confirmação 2/2, geometria/foco em
mobile e tablet 10/10 e proteção de logout 7/7. Isso representa 67 verificações
E2E aprovadas após o rerun do RBAC. Na suíte padrão, o soak offline opcional de
cinco minutos e cenários backend condicionais ficaram como skipped; os cenários
misto e multi-tenant foram depois habilitados separadamente e passaram. O soak
longo não foi repetido nesta rodada e não foi contabilizado como falha.

As 16 regressões SQL/RLS passaram novamente e o JUnit final registra 17 casos
(preflight + 16), sem falhas, erros ou skips. A matriz de Storage por seis
papéis/tenants, validação de login dos perfis e disputa de 32 chamadas pela
quota Jev também passaram. As rajadas concorrentes de 25, 50 e 100 reservas
aceitaram exatamente uma reserva por horário; as demais foram conflitos
esperados do índice de exclusão, sem double-booking. P95 de gravação: 49/91/109
ms. O cenário misto registrou 250 gravações e 120 leituras em dez rodadas (p95
de leitura 44,7 ms); o cenário multi-tenant teve 250 gravações, 50 leituras,
p95 de leitura 36,4 ms e zero vazamentos entre tenants.

A única falha da primeira passagem foi do próprio teste (ambiguidade do
`getByText`), corrigida para exigir texto exato e confirmada por nova execução
12/12. Nenhuma falha funcional permaneceu nesta campanha local. Essa evidência
reafirma os gates locais, mas não substitui o run real do Actions, o QA remoto,
provedores sandbox e dispositivos físicos; por isso a pontuação permanece
**92,6% na base + 10 pontos extraordinários = 102,6/110 (93,3% da meta)**.
Como higiene, removi o storageState local gerado após o teste e o trace ZIP da
asserção ambígua (que continha headers de autenticação da conta sintética após
descompactação); o scanner não encontrou tokens nos relatórios textuais/JUnit
preservados.

## Jev — aceite de contrato com o provedor real — 2026-10-03

Consultei a referência TypeSafe atual: `POST /v1/systemone` com Bearer key,
modelo `jev-latest` e respostas Choice/Score/Noul tipadas; Choice/Score incluem
distribuições e confiança, enquanto Noul retorna probabilidade. Adicionei o
smoke opt-in `npm run test:jev:live`, que usa `callJev` e
`interpretRetentionResponse`, executa somente uma chamada (sem retry), exige a
chave `TYPESAFE_API_KEY` em ambiente e envia uma fixture sintética sem PII. A
chave não é salva nem impressa. O gate não entra no CI automático porque usa
cota do provedor.

O aceite real passou: o provedor respondeu `jev-1.13.0`; a integração validou
os três tipos e a interpretação de retenção. Para este estado sintético, a
confiança foi 0,27 e a suficiência 0,63, abaixo dos limiares locais (0,60 e
0,65); o sistema corretamente devolveu `human_review`, status `review` e
`automaticAction: false`. A chamada usou 995 tokens de entrada e 106 de saída,
com latência observada de 635 ms. Isso prova conectividade e um contrato válido,
mas não é avaliação de drift, acurácia ou estabilidade estatística; não altera
a pontuação da frente. O aceite controlado de Google/Apple/Push/WhatsApp,
repetições representativas do Jev, QA remoto, Actions e dispositivos físicos
continuam pendentes.

## Revalidação local para a entrega de testes — 2026-10-03

Reexecutei os gates de release no código atual contra o Supabase QA local
descartável, em loopback, com tenant e usuários inteiramente sintéticos. Não
houve escrita em produção, disparo do GitHub Actions, push ou publicação.

A matriz autenticada de rotas passou 36/36 em iPhone/WebKit, iPhone SE/WebKit e
Android/Chromium. Com ela passaram também os cenários de navegação/offline (4/4),
Agenda → Confirmações → dialog (1/1), ausência de sobreposição da BottomNav em
14/14 combinações e rotas públicas 5/5. O portal do cliente passou 30/30 em
iPhone portrait/landscape, iPhone SE, Android 360 e iPad; inclui um novo cenário
offline que confirma que o aviso integra o header sem encobrir controles, nav ou
conteúdo inicial. Contraste WCAG AA e tema claro/escuro passaram 36/36 nos mesmos
três perfis de tela usados no gate de acessibilidade.

A revisão das capturas encontrou e corrigiu dois defeitos de teste: a captura
full-page era feita após uma asserção que deixava o scroll no fim, deslocando o
header sticky; e o indicador de churn dependia de valores sintéticos variáveis.
As capturas agora retornam ao topo, mantêm geometria e normalizam somente texto/
preenchimento volátil. A inspeção também revelou que o banner offline fixo
encobria o header no produto; ele passou a ocupar uma faixa dentro do header
sticky tanto no app quanto no portal, com verificação geométrica E2E. Os
baselines móveis autenticados foram regenerados e a comparação seguinte passou
36/36; a imagem do cenário offline foi revisada visualmente após a correção.

Após essas mudanças, typecheck passou, a suíte completa passou 746/746 (62
arquivos), lint terminou com zero erros e os mesmos 17 avisos de Fast Refresh.
`npm audit --omit=dev` encontrou zero vulnerabilidades; os testes de manifesto,
retry, chave de sessão e relatório SQL passaram 15/15. O guard de build sem
variáveis passou, o build de produção isolado gerou 3.264 módulos e service
worker com 138 entradas, actionlint aprovou os quatro workflows, e
`git diff --check` passou. Nenhum build sobrescreveu o diretório `dist` do
workspace.

Esta rodada não aumenta a pontuação, porque a execução local não substitui a
confirmação oficial no GitHub Actions/QA remoto nem revisão integral de
baselines, dispositivos físicos e sandboxes reais dos provedores. Índice
permanece **92,6% na base + 10 pontos extraordinários = 102,6/110 (93,3% da
meta)**; faltam 7,4 pontos da métrica-base para atingir 110/110.

## Campanha de testes reais para entrega — 2026-10-03

Executei uma campanha integrada contra o Supabase QA descartável em loopback
(`127.0.0.1`), usando o runtime Node 22 do CI, build de produção em diretório
temporário e oito contas sintéticas em dois tenants. Nenhuma chamada de escrita
foi enviada ao Supabase de produção, ao Jev ou a provedores externos.

Resultados desta campanha:

- 746/746 testes Vitest; typecheck aprovado; lint com zero erros e os mesmos 17
  avisos conhecidos de Fast Refresh; `npm audit --omit=dev` sem vulnerabilidades;
  guard de build sem variáveis aprovado; build de produção isolado aprovado.
- 16/16 regressões SQL/RLS/IDOR no PostgreSQL local, incluindo Storage,
  referências cross-tenant, auditoria, limites, assinatura e onboarding atômicos.
- 8/8 logins sintéticos (super-admin, owner, manager, frontdesk, professional,
  client, owner tenant B e convidado pendente); quota Jev concorrente 32/32
  decisões (5 reservas aceitas, 27 negadas); Storage real validado em seis
  contextos de papel/tenant, com upload, URL assinada, cota, MIME, isolamento e
  cleanup.
- 58/58 casos E2E ativos aprovados após os reruns com o bootstrap previsto:
  agenda offline/Realtime 7/7 e soak offline de cinco minutos 1/1; central de
  confirmação 12/12 em cinco perfis de tela; RBAC 12/12 nos seis papéis, incluindo
  escrita/restauração segura da assinatura super-admin; logout 7/7; booking 1/1,
  autoatendimento/fila 5/5, CRM/mídia 2/2, convite 1/1, limites 2/2 e importação/
  exportação 3/3. A matriz de isolamento tenant A/B passou 1/1.
- Concorrência: cada rajada de 25, 50 e 100 reservas admitiu exatamente uma por
  horário (P95 observado de 34/43/112 ms); tráfego misto concluiu 250 escritas e
  120 leituras (P95 de leitura 45,7 ms); multi-tenant concluiu 250 escritas e 50
  leituras, P95 de leitura 24,7 ms e zero vazamentos.
- Actionlint e `git diff --check` passaram após correção do workflow.

Os primeiros falsos negativos da execução manual vieram de não reproduzir duas
precondições do job: o seed autenticado de agenda e a origem `cativa.localhost`
necessária ao service worker. Com o bootstrap/configuração oficiais, confirmações
passaram 12/12 e o PWA passou inclusive os testes perto do limite de 24 horas. A
execução revelou ainda que a matriz RBAC local precisava da service-role para
restaurar a fixture super-admin; o passo de limpeza da chave foi movido para
depois do RBAC e antes dos testes que não a necessitam. Isso reduz a janela da
chave e impede falha no CI.

As credenciais temporárias e `storageState` foram removidos ao final; traces que
pudessem conter headers de Auth não foram preservados. Os relatórios JUnit e
capturas permanecem nos diretórios locais de evidência `e2e/.artifacts-delivery-*`
e `e2e/.report-delivery-*` (com dados exclusivamente sintéticos).

A integração GitHub respondeu que precisa de reautenticação; portanto não foi
possível iniciar/confirmar uma execução oficial do Actions. Não houve push nem
publicação nesta rodada. QA remoto, revisão integral dos baselines, devices
físicos e callbacks reais dos provedores continuam bloqueios explícitos para o
aceite externo; essa validação local não os substitui. Índice mantido em
**92,6% base + 10 pontos extraordinários = 102,6/110 (93,3% da meta 110)**.

### Confirmação final para a entrega de hoje — 2026-10-03

Após o reteste anterior, a matriz visual pública expandida terminou **300/300
passando**. Reconsultei o domínio no fim da execução: `/planos` retorna HTTP 404
com `x-lovable-serve-error: cloudflare_no_published_file`. Portanto, embora as
suítes locais de QA real estejam verdes, a versão ainda não está acessível para
testadores externos; falta republicar pelo projeto Lovable correto e confirmar
o ref Supabase antes de qualquer alteração remota. Não fiz push, deploy nem
mutação em produção. Índice permanece **102,6/110 (93,3% da meta 110)**.

### Reteste orientado à entrega — 2026-10-03

Por solicitação de preparar a versão para testes reais ainda hoje, ampliei a
execução sem apontar mutações ao projeto Supabase de produção:

- A matriz visual completa de rotas públicas finalizou **300/300** casos em
  Chromium, Firefox e WebKit, em desktop, tablet portrait/landscape e mobile
  (incluindo 320px e landscape). Cobriu nove rotas, fronteiras de breakpoint,
  scroll/overflow/clipping/foco e reflow com zoom equivalente a 200%/400% e
  espaçamento de texto. Não houve falhas.
- A suíte Vitest ficou em **747/747**; typecheck passou; lint terminou com zero
  erros e 17 avisos `react-refresh/only-export-components` já conhecidos.
  `git diff --check` passou.
- No Supabase QA local efêmero: **16/16** regressões SQL/RLS e a matriz real de
  Storage passaram, incluindo isolamento cross-tenant, permissões por perfil,
  upload/download/remoção, quotas concorrentes, MIME e limpeza de fixtures.
- No navegador contra bundle de produção construído em diretório temporário e
  fixtures autenticadas locais: 17 testes diagnósticos multi-tenant e de
  funcionalidades, 8 jornadas de portal/cliente/confirmação, 7 proteções de
  logout e 7 testes PWA passaram. O soak opcional de cinco minutos foi
  intencionalmente ignorado. A primeira tentativa PWA usou estado de sessão de
  uma origem diferente; após gerar o estado para a origem exata do teste, a
  suíte passou. Isso foi corrigido na configuração do teste, não classificado
  como defeito do produto.
- `npm audit --omit=dev`: zero vulnerabilidades. A varredura no banco QA local
  encerrou com zero achados críticos e zero avisos; cinco achados ficaram na
  allowlist documentada. O gate de build sem variáveis obrigatórias também
  passou em diretório temporário.
- Um smoke real e limitado do Jev, com dados sintéticos sem PII e uma tentativa,
  revelou diferença de arredondamento entre o Score e a distribuição de
  probabilidades devolvidos pelo modelo. Ajustei a validação para tolerar até
  0,02 de arredondamento (sem aceitar inconsistências maiores), acrescentei
  teste de regressão e o smoke real passou: decisão `human_review`, confiança
  baixa, sem ação automática. O comportamento segue o contrato de Score como
  média ponderada das probabilidades e a confidence derivada da distribuição
  descritos na [API TypeSafe](https://docs.typesafe.ai/api) e na documentação
  de [Confidence](https://docs.typesafe.ai/confidence). A chave não foi escrita
  em arquivos, saída de teste ou artefatos.
- Evidências de autenticação geradas por esses testes passaram a aceitar caminho
  temporário configurável; isso permite executar navegadores em origens
  isoladas sem reutilizar nem sobrescrever o estado de sessão padrão.

Esses resultados são uma evidência forte de prontidão funcional local, mas não
equivalem à aprovação de publicação: a inspeção dos fluxos externos/CI continua
dependente de credenciais e configuração QA remota corretas, o projeto
Lovable/domínio canônico ainda precisa ser republicado e validado, os dois refs
Supabase protegidos seguem divergentes, e a revisão dos baselines físicos e
aceite de dispositivos reais continuam pendentes. Não fiz push, deploy,
republicação nem mutação em produção. O checkout segue com alterações
preexistentes e desta rodada misturadas; uma seleção/revisão de commit é
obrigatória antes de entregar um build versionado.

Índice de completude mantido em **102,6/110 (93,3% da meta 110)**: esta rodada
adiciona evidência local, sem eliminar os gates externos acima.

## Reauditoria dos bloqueios de publicação — 2026-10-03

Checagens somente leitura confirmaram os impedimentos externos atuais:

- O `main` remoto continua em `621968e`; o último CI oficial desse commit teve
  Vitest verde, oito diferenças de baseline nas capturas Android 360px e falha
  no provisionamento QA remoto (`HTTP 500: Database error finding users`). As
  correções/novos baselines passaram localmente, mas ainda precisam de CI após
  publicação em branch.
- A lista de secrets do repositório contém somente `E2E_USER`, `E2E_PASS`,
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Não encontrei secrets
  repo-level para `SUPABASE_QA_DB_URL`, `E2E_QA_PROJECT_REF`,
  `E2E_TARGET_ALLOWLIST` ou as credenciais sintéticas `super_admin`; logo não
  posso atestar nem executar o gate remoto de QA. Não criei nem alterei secrets.
- Há dois refs Supabase protegidos distintos no checkout: `.env.example` aponta
  para `uqskxftzmjsumykpkwus`, enquanto o fallback do build aponta para
  `pegvtrvqdvzxysndddts`. Não escolhi um alvo por inferência; a configuração do
  projeto Lovable precisa ser confirmada antes de republicar.
- O checkout está em `main`, igual ao remoto, com 288 caminhos modificados ou
  não rastreados e nenhum staged. Há código, migrations, workflows, testes e
  baselines junto com evidências locais; não os enviei em bloco nem limpei
  arquivos. A auditoria/seleção de commit permanece necessária.

O domínio `cativapp.lovable.app` continua exibindo `Build incomplete`; não houve
republicação, push ou alteração de projeto remoto. O índice permanece
**92,6% base + 10 pontos extraordinários = 102,6/110 (93,3% da meta 110)**.

### Reteste adicional antes da entrega — 2026-10-03

Reexecutei gates independentes no estado atual do checkout, sempre contra o QA
local descartável ou mocks de UI, sem escrita remota:

- A matriz real de Storage passou nos seis contextos de papel/tenant: autenticação,
  acesso cross-tenant negado, upload/download por URL assinada, overwrite,
  remoção, limites e cotas concorrentes, MIME não permitido e cleanup das
  fixtures/objetos.
- O orquestrador SQL passou 16/16 regressões no PostgreSQL local; o JUnit gerado
  contém preflight + 16 casos, sem falhas, erros ou skips.
- A matriz geométrica pública passou 60/60 em Chromium desktop, WebKit tablet e
  Chromium mobile 320px: nove rotas, seis fronteiras de breakpoint e reflow com
  espaçamento WCAG em larguras equivalentes a zoom de 200%/400%.
- Depois da execução visual, removi o aviso repetido de medição de scroll no
  hero: a animação de parallax agora usa `scrollY` da página com intervalo
  explícito, em vez de observar um alvo absoluto contra a raiz. O mesmo conjunto
  visual passou 60/60 novamente, sem esse aviso.
- Repetições finais: Vitest 746/746, TypeScript aprovado, lint sem erros (17
  avisos já conhecidos) e `npm audit --omit=dev` com zero vulnerabilidades.
- O endereço `chatgpt.site` usado como preview redireciona para “Entre para
  acessar” e exige login ChatGPT; ele não é evidência de publicação pública do
  produto. No domínio canônico Lovable `cativapp.lovable.app/planos`, a página
  apresenta “Build incomplete — This project is published, but its files are
  missing. Try re-publishing.” Portanto o app não está publicamente testável
  neste momento. Não acionei a republicação do Lovable nesta etapa.

Esses resultados reforçam os gates locais, mas não alteram o índice: continuam
pendentes o Actions oficial/QA remoto, revisão integral dos baselines, validação
em dispositivos físicos, republicação/verificação do domínio Lovable e integrações
externas autorizadas. A entrega para testes reais ainda não pode ser declarada
publicada. Índice mantido em
**92,6% base + 10 pontos extraordinários = 102,6/110 (93,3% da meta 110)**.

## Revalidação do toolchain e gate público de contraste — 2026-10-03

Esta atualização é posterior aos agregados de 746 testes acima e passa a ser a
referência atual dos gates locais:

- `npm update tailwindcss @tailwindcss/typography lovable-tagger fast-glob`
  resolveu versões dentro das faixas existentes: Tailwind CSS 3.4.19, Typography
  0.5.20, lovable-tagger 1.3.5 e fast-glob 3.3.3. `npm ci --dry-run` confirmou
  consistência do lockfile; typecheck, build de produção temporário, lint e
  **747/747 testes** passaram.
- A regressão pública de layout/reflow foi repetida depois dessas atualizações:
  **300/300**, sem falhas em desktop, notebook, breakpoints, tablet, mobile e
  landscape nos navegadores configurados. Evidência JUnit e HTML em
  `/tmp/cativa-tailwind-visual-5unh2y/`.
- Criei uma configuração sem credenciais para contraste nas rotas públicas e
  adicionei o gate ao job de layout do CI. Axe com contraste ativo passou
  **21/21** em Chromium desktop, Chromium mobile 320 px e WebKit tablet;
  actionlint, usando a imagem fixada pelo workflow, validou todos os workflows.
  Evidência JUnit e HTML em `/tmp/cativa-a11y-public-dlTe5h/`.
- Cobertura V8 atual dos 747 unitários: 19,16% statements, 16,59% branches,
  14,65% funções e 19,93% linhas. O report detalhado está em
  `/tmp/cativa-coverage-20261003/`.
- A auditoria atual continua com zero vulnerabilidades de runtime (`npm audit
  --omit=dev`) e oito alertas altos restritos ao toolchain de desenvolvimento.
  A cadeia converge para `braces@3.0.3`; a [advisory upstream](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  ainda declara **nenhuma versão corrigida**. Não forcei uma versão inexistente
  nem uma migração maior do Tailwind. A configuração `content` do projeto é
  estática; a biblioteca não é chamada pela lógica de aplicação.

Não aumentei o índice com estes retestes locais: a base segue **92,6%** e o
extraordinário **10/10**, total **102,6/110 (93,3% da meta)**. Continuam sem
evidência os gates de Actions/QA remoto, integração OAuth real, aparelhos físicos
e republicação do domínio Lovable.

## Build de produção fechado para alvo Supabase ambíguo — 2026-10-03

A configuração de build continha um fallback para `pegvtrvqdvzxysndddts`, mas
`.env.example` e `supabase/config.toml` identificam `uqskxftzmjsumykpkwus`.
Como não há evidência que autorize escolher o primeiro como backend de produção,
o Vite agora interrompe builds `production` quando `VITE_SUPABASE_URL` ou a
chave pública estão ausentes. Desenvolvimento/build não produtivo sem env usa
somente `http://127.0.0.1:54321` com uma chave placeholder, nunca o backend
remoto divergente. Assim, uma variável esquecida não pode publicar ou operar
silenciosamente contra outro projeto.

Verificações após a mudança:

- `npm run test:build:missing-env` passou em três builds isolados: bloqueia
  produção sem configuração, confirma que configuração sintética explícita é a
  única usada no bundle e comprova que desenvolvimento sem env usa somente
  loopback + chave placeholder. Não escreveu em `dist/` nem conectou a backends.
- Typecheck passou; os testes locais de manifesto, retry de provisionamento,
  chave de sessão e serialização JUnit SQL passaram 3/3, 6/6, 4/4 e 2/2.
- A imagem `actionlint` fixada por digest usada pelo workflow validou os YAMLs
  localmente; `npm audit --omit=dev` reportou zero vulnerabilidades.
- O GET ao domínio público continua retornando HTTP 404
  (`cloudflare_no_published_file`). Não fiz push, deploy, publicação Lovable ou
  mutação no Supabase remoto.

Este hardening melhora a segurança do build, mas não resolve a escolha e a
provisão externa do projeto Supabase. Por isso não eleva o índice: a base segue
**92,6%**, o crédito extraordinário continua **10/10**, totalizando
**102,6/110 (93,3%)**; QA remoto/Actions, integrações reais, dispositivos físicos
e publicação continuam gates pendentes.

## Fallback local-only e varredura do checkout — 2026-10-03

A primeira varredura ampla encontrou cinco strings somente nos bundles antigos
em `dist/` (diretório ignorado pelo Git) e uma chave JWT pública no fallback de
desenvolvimento. Removi essa chave/backend remoto do `vite.config.ts` e passei a
usar loopback + placeholder quando o ambiente de desenvolvimento não tem
Supabase explícito; configurações fornecidas pelo ambiente continuam tendo
precedência. O guard de produção impede que esse fallback local entre em um
release.

Retificação de 2026-10-04: a execução inicialmente atribuída ao Gitleaks v8.30.1
**não produziu uma varredura válida**: o processo terminou com erro fatal ao
carregar a configuração (`.gitleaks` ausente), e um stdout vazio havia sido
interpretado incorretamente como relatório JSON sem achados. Desconsidere o
“zero achados” registrado nesta seção. O upstream também documentou uma
regressão na v8.30.1 que pode deixar de detectar segredos
([issue #2170](https://github.com/gitleaks/gitleaks/issues/2170)). A varredura
foi repetida com uma versão diferente, validada por canário, na seção de aceite
local de 2026-10-04 ao final deste documento.

Após as mudanças: Vitest **747/747**, typecheck passou, lint sem erros (17
avisos conhecidos), o guard de build testou os três cenários acima e a
verificação de inicialização do Supabase aceitou a URL local com a chave
placeholder sem fazer requisições. Nenhum índice foi creditado por retestes
locais: **92,6% base + 10/10 extraordinários = 102,6/110 (93,3%)**. O alvo
canônico, Actions remoto, QA remoto, provedores/dispositivos reais e publicação
continuam pendentes.

## Guard do re-scan standalone do banco — 2026-10-03

Uma revisão de segurança encontrou que `scripts/security-rescan.mjs` aceitava
`DATABASE_URL`/`SUPABASE_DB_URL` genéricos e gravava histórico por padrão. O
workflow fazia uma checagem anterior, mas a execução direta do script não; por
isso, um ambiente shell apontando por engano a um banco protegido poderia
alcançar o scanner e a persistência.

Corrigi o comando para exigir `SUPABASE_QA_DB_URL` e executar
`scripts/e2e-db-target-check.mjs` antes de escolher `psql`, abrir conexão, gerar
relatório ou persistir. Adicionei o gate `test:security:target` ao CI, com três
regressões: rejeita URLs genéricas, bloqueia os refs protegidos embutidos na
política e recusa host não-loopback mesmo quando `local` está na allowlist. Os
testes passaram **3/3** sem realizar conexões. A revalidação do scanner executou
as sete consultas somente na instância QA descartável local, com
`SECURITY_SCAN_PERSIST=0`: **0 achados críticos, 0 avisos abertos e 5 aceitos**;
nenhum histórico foi gravado.

O guard reduz o risco de uma execução local acidental, mas não substitui QA
remoto nem CI publicado. O índice permanece **92,6% base + 10/10
extraordinários = 102,6/110 (93,3%)**.

## Rodada de aceite executável para entrega — 2026-10-03

Repeti os gates principais com Node 22.22.3, conforme o requisito do projeto:
`npm run check:node`, Vitest **747/747**, typecheck, lint sem erros (17 avisos
Fast Refresh já conhecidos), guard de build fail-closed e `npm audit
--omit=dev` passaram. O build de produção isolado do PWA transformou 3.264
módulos e gerou 138 arquivos de precache, em pasta temporária; o `dist/` local
não foi apagado nem substituído. A auditoria completa ainda lista oito alertas
altos somente no toolchain de desenvolvimento; o conjunto de dependências de
runtime não tem vulnerabilidades reportadas.

No Supabase descartável identificado pelas portas loopback 56201/56202, as 16
regressões SQL passaram; o re-scan foi somente leitura, com persistência
desabilitada, e reportou 0 críticos, 0 avisos abertos e 5 achados aceitos já
documentados. Provisionei somente contas e dados sintéticos em dois tenants e
rodei **38/38 jornadas autenticadas**: shell/login, auditoria, CRM/upload,
importação/exportação, limites, agenda, portal, confirmação/cancelamento,
isolamento A/B e RBAC para owner, manager, frontdesk, professional, client e
super_admin. A trilha PWA offline passou **7/7**; o soak opcional de cinco
minutos foi o único caso skip intencional. Senhas e arquivos de sessão foram
removidos dos diretórios temporários após os testes; os dados QA sintéticos
continuam restritos à instância descartável local.

A matriz pública de layout/reflow passou **300/300 também em Node 22.22.3** em
desktop, nove larguras, breakpoints, tablet, mobile, landscape, Chromium,
Firefox e WebKit, incluindo zoom/reflow WCAG 200%/400%. A rota autenticada
`/app/assinatura` também passou o snapshot no iPhone 14. Como as datas da
assinatura são mascaradas intencionalmente no baseline, acrescentei uma
asserção que exige início e renovação carregados antes da captura. A execução
também revelou uma lacuna no harness: `E2E_STORAGE_STATE_PATH` era respeitado
pelo Playwright, mas ignorado pelo global setup. Agora ambos usam o caminho
configurado, validado pela execução autenticada sem sobrescrever
`.auth/storageState.json`.

Os hosts verificados para acesso externo continuam sem serviço público pronto:
`https://cativapp.lovable.app/planos` respondeu 404
(`cloudflare_no_published_file`) e `https://cativa-gestao-clientes.belson91.chatgpt.site/planos`
respondeu 401. Isso não prova falha do preview privado aberto no Lovable, mas
impede homologação externa no endereço público. Não publiquei, não fiz push e
não alterei Supabase remoto; a última execução do Actions ainda precisa ser
repetida após a correção do provisionador.

Esta rodada dá evidência atualizada, mas não crédito adicional em frentes já
pontuadas. Permanecem **92,6% base + 10/10 extraordinários = 102,6/110 (93,3%
da meta)**. Para uma entrega acessível a clientes ainda são gates o endereço
público publicado e autenticável, novo Actions com QA remoto autorizado, revisão
humana integral das baselines, provedor OAuth sandbox e aceite em dispositivos
físicos/device farm; o soak noturno também não foi executado nesta rodada.

## Revalidação adicional local e auditoria do CI — 2026-10-03

Repeti os gates públicos no Node 22.22.3, mantendo relatórios em diretórios
temporários ou ignorados e sem regravar snapshots: a matriz pública de geometria,
breakpoints e reflow 200%/400% passou **300/300 em 6,6 min**; contraste/acessibilidade
pública passou **21/21** em desktop Chromium, tablet WebKit e mobile Chromium;
segurança/conteúdo público passou **65/65**; Core Web Vitals passou **18/18**
com build temporário e backend simulado; OAuth sintético passou **9/9** em
Chromium, Firefox e WebKit; contratos de erro de autenticação passaram **9/9**.
O contador 300 é a matriz pública/reflow; a evidência anterior de **330/330**
refere-se à geometria integral, que inclui as rotas autenticadas, e é uma
medição diferente — os números não devem ser somados como se fossem casos
únicos. Nos Core Web Vitals, CLS foi 0 nos 18 cenários e os limites definidos
para LCP/INP passaram.

Também passaram novamente: retry de provisionamento **6/6**, guard de alvo de
segurança **3/3**, manifesto **3/3**, chave de storage **4/4** e JUnit SQL
**2/2**. O ciclo do CI antigo foi inspecionado somente para leitura: o job
Vitest/build passou; `playwright-mobile` falhou em oito comparações de snapshot
autenticado, e o provisionador remoto recebeu HTTP 500 do Auth
(`Database error finding users`). A recuperação limitada está coberta pelo
retry testado localmente, mas só um novo Actions pode confirmar o comportamento
no runner remoto. O último Actions disponível continua sendo do commit
`621968e` em 2026-09-26; o checkout atual ainda está nesse SHA com alterações
locais não publicadas.

O inventário somente-leitura de secrets do repositório não encontrou
`E2E_QA_PROJECT_REF` nem `E2E_TARGET_ALLOWLIST`; o workflow atual condiciona
qualquer provisão/concorrência remota a esses alvos explícitos e mantém a trilha
local descartável independente. Portanto não executei um novo Actions nem fiz
push, deploy Lovable ou mutação no Supabase remoto. As sondagens públicas seguem
em 404 (`cativapp.lovable.app/planos`) e 401
(`cativa-gestao-clientes.belson91.chatgpt.site/planos`). A nova rodada confirma
gates já pontuados, sem crédito duplicado: **92,6% base + 10/10 extraordinários
= 102,6/110 (93,3% da meta)**. Permanecem sem evidência nova o QA remoto,
Actions no SHA atualizado, revisão humana integral das baselines, OAuth real,
device farm/aparelhos físicos, soak noturno e host público autenticável.

## Validação funcional em build de produção — 2026-10-03

Após as correções de baseline, repeti com Node 22.22.3: typecheck, Vitest
**747/747**, lint (**0 erros; 17 avisos Fast Refresh conhecidos**), validação
do build fail-closed sem env e auditoria runtime (**0 vulnerabilidades**). O
build de produção compilou **3.264 módulos** e gerou **138 arquivos de precache
PWA** no diretório temporário do QA.

A suíte `test:visual:auth:critical` passou integralmente sem atualizar snapshots:
**36 páginas autenticadas** em iPhone 14, iPhone SE e Android 360; **4 cenários
de navegação**, **1 jornada agenda→confirmação** e **14 verificações de
BottomNav** (55 execuções no total). O conteúdo de e-mail do perfil foi marcado
como volátil somente nos dois campos; antes de capturar, o teste verifica que
ambos carregaram um e-mail válido e consistente. As três capturas de baseline
afetadas foram atualizadas pontualmente após inspeção da geometria.

A matriz pública repetida passou **300/300 em 6,7 minutos**. No diagnóstico
funcional abrangente, **47/51** passaram na primeira execução. As quatro falhas
foram de preparação/configuração e foram revalidadas com os runners e fixtures
corretos, sem mudança de regra de produto: a jornada de portal faltava à
provisão local específica e passou **1/1** após `test:qa:provision:local`; os
três casos PWA executados pelo runner genérico não podiam registrar SW em
`127.0.0.1`, comportamento intencional do guard do app. Com o runner PWA
dedicado, host `cativa.localhost` e build isolado, a suíte offline passou
**8/8**, incluindo contexto expirado, restauração perto de 24h e soak de cinco
minutos com **10/10 checkpoints**, seguido de reconexão. Assim, todos os 51
casos únicos do diretório de diagnósticos têm evidência verde entre a execução
abrangente e as reexecuções direcionadas; o artefato da primeira execução
continua registrando honestamente 47/51, não foi sobrescrito.

O comando de build convencional executa um `prebuild` que limpa `dist/` antes
de considerar um `--outDir` fornecido ao Vite. Isso removeu os artefatos locais
ignorados pelo Git durante o build isolado. Recriei `dist/` a partir do bundle
validado; ele está configurado somente para a instância QA loopback
`127.0.0.1:56201` e não deve ser publicado. Não há cópia versionada dos
artefatos anteriores para garantir restauração byte a byte. Para próximos
builds temporários, deve-se invocar Vite diretamente ou corrigir o wrapper para
que uma saída externa não limpe `dist/`.

Não houve alteração/push no GitHub, dispatch de Actions, escrita no Supabase
remoto ou publicação Lovable. Permanecem os bloqueios externos já registrados:
host público ainda não autenticável, QA remoto/Actions no SHA atual, auditoria
humana final das baselines e aceite em provedores/dispositivos reais. Evidência
adicional não duplica pontuação: **92,6% base + 10/10 extraordinários =
102,6/110 (93,3% da meta)**.

## Isolamento do destino de build — 2026-10-03

Corrigi a causa operacional da limpeza anterior: `prebuild` agora verifica
somente a versão do Node. A limpeza do output efetivo fica a cargo do Vite,
que conhece o `outDir` realmente solicitado; `clean:build` continua disponível
como comando explícito. Repeti `npm run build -- --mode development --outDir
<tmp> --emptyOutDir`: os 3.264 módulos compilaram e o bundle temporário gerou
138 arquivos de precache PWA. Um manifesto SHA-256 de todos os arquivos de
`dist/` e a contagem de arquivos permaneceram idênticos antes e depois
(138/138), provando que o build externo não limpou nem alterou esse diretório;
o output temporário foi removido após a asserção.

`npm run test:build:missing-env` também passou novamente: produção continua
falhando de forma fechada sem URL/chave Supabase, build isolado aceita apenas
o host `.invalid` explicitamente fornecido e o fallback de desenvolvimento
permanece limitado ao loopback. O `dist/` atual ainda é o bundle para QA local
em `127.0.0.1:56201`; não deve ser publicado. Nenhum serviço remoto foi
alterado. Sem crédito duplicado: **102,6/110 (93,3% da meta)**.

## Rodada integral de QA local para aceite — 2026-10-04

Executei no checkout atual com Node.js 22.23.2, usando fixtures sintéticas e
exclusivamente a instância Supabase QA descartável `127.0.0.1:56201`/`56202`.
Nenhuma escrita foi feita no Supabase remoto, GitHub Actions ou hospedagem.

- Unitários/componentes: **747/747**; typecheck: passou; lint: **0 erros e 17
  avisos preexistentes de Fast Refresh**.
- Build/configuração: `test:build:missing-env` passou; produção bloqueia a falta
  de URL/chave, alvo `.invalid` explícito e fallback loopback foram verificados.
  O `dist/` existente contém 138 arquivos e aponta para QA loopback; não contém
  host Supabase público nem marcador de service-role, portanto não é artefato
  para entregar a testadores externos.
- SQL backend: **16/16** regressões, incluindo RLS, IDOR, Storage, portal,
  catálogo/CRM, administração, referências tenant-aware, quota Jev e RPCs
  atômicas de onboarding/assinatura.
- Storage via API Supabase local: login sintético, signed URL, upload/download,
  isolamento cross-tenant (403), allowlist MIME, limites de arquivo/cota e oito
  disputas concorrentes; execução limpou os usuários e objetos criados.
- Quota Jev concorrente: **32** chamadas simultâneas, **5** reservas aceitas e
  **27** recusadas conforme o limite; tenant/usuário temporários removidos.
- Integridade da agenda: cinco cenários executados e aprovados entre a suíte
  base e gates dedicados. Rajadas 25/50/100 tiveram p95 de **110/88/127 ms**;
  soak de 60 s completou **1.260 lotes / 10.080 requisições**, sem dupla reserva;
  tráfego misto manteve leitura p95 em 55,2 ms; cenário multi-tenant teve zero
  vazamentos. Agendamentos e fixtures foram removidos.
- Geometria/reflow público: **300/300** em 6,6 min, incluindo breakpoints,
  desktop, notebook, tablet, mobile, WebKit e zoom/reflow 200%/400%; snapshots
  não foram atualizados.
- Acessibilidade/contraste: **21/21**; segurança/conteúdo público: **65/65**;
  Core Web Vitals: **18/18**, CLS 0 nos cenários e LCP/INP dentro dos orçamentos.
- Contratos sintéticos de OAuth: **9/9** em Chromium/Firefox/WebKit; erros de
  autenticação/recuperação: **9/9** nos mesmos motores. Nenhuma credencial real
  de Google/Apple foi usada.
- `npm audit --omit=dev`: **0 vulnerabilidades**. A auditoria completa reporta
  **8 alertas altos**, todos derivados do advisory
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  para `braces <=3.0.3`, transitivo de Tailwind CSS 3.4.19 em ferramentas de
  desenvolvimento. A revisão do advisory em 2026-10-02 lista patched versions
  como “None”. O dry-run do npm só ofereceu correção forçada com mudanças
  incompatíveis; não alterei dependências às cegas. Manter a atualização do
  toolchain como gate de segurança e não expor o servidor de desenvolvimento.

Esta rodada fortalece a evidência dos gates locais, sem crédito duplicado no
roadmap: **92,6% base + 10/10 extraordinários = 102,6/110 (93,3% da meta)**.
Ainda faltam Actions no SHA atualizado e QA remoto explicitamente configurado,
revisão humana final das baselines, verificação do Jev ao vivo/representativa
com credencial disponível, OAuth real em sandbox, dispositivos físicos/device
farm e uma URL publicada que permita a autenticação de aceite. Portanto, os
resultados não equivalem a aprovação de produção nem autorizam publicação.

## Consistência matemática das respostas Jev — 2026-10-04

As instruções oficiais confirmam que a confiança de Choice e Score é derivada
da distribuição de probabilidades, enquanto Noul traz somente a probabilidade
yes/no ([API](https://docs.typesafe.ai/api),
[Confiança](https://docs.typesafe.ai/confidence)). O parser já validava faixas,
soma das probabilidades, opção vencedora e valor esperado do Score, mas aceitava
uma resposta em que `confidence` contradizia sua própria distribuição.

Adicionei checagem independente para as fórmulas de Choice e Score, com
tolerâncias de 0,020001 e 0,030001 para valores arredondados pelo provedor. Em
empates na distribuição de Score, a validação aceita a confiança derivada de
qualquer nível igualmente provável. Dois testes adversariais foram primeiro
executados em vermelho (a inconsistência passava), então a correção foi
implementada; a suíte focada ficou **43/43** e o conjunto completo **750/750**.
Cobertura global após a mudança: **19,30% statements, 16,64% branches, 14,85%
funções e 20,08% linhas**. O módulo Jev ficou em **100%**; a lógica de retenção
em **98,63% statements, 97,90% branches, 100% funções e linhas**. Typecheck e
lint passaram (zero erros, 17 avisos conhecidos); `git diff --check` passou.

Também instalei Deno **2.9.7** em diretório temporário, verificando o SHA-256 do
arquivo oficial antes do uso. O primeiro `deno check` mostrou erros de
compilação: ação do Jev não estreitada para o union, clientes Supabase com
`ReturnType` incompatível, tipo JSON da auditoria amplo demais e RPC de quota
ausente do schema TypeScript. Corrigi esses pontos sem alterar comportamento:
type guard para a ação, tipos `Database`/`Json` compartilhados, assinatura da
RPC alinhada à migration e clientes push com o schema do projeto. Em seguida,
`deno check` passou nas **seis Edge Functions**; `deno lint` passou nos **oito
arquivos** de `supabase/functions`, sem erros.

Adicionei um job independente no CI para repetir `deno check`/`deno lint` sem
secrets, com Deno 2.9.7 e a action oficial setup-deno fixada por commit. O
actionlint isolado na imagem oficial fixada por digest aprovou todos os
workflows. Esse novo job ainda precisa de uma execução remota; não houve push
nem dispatch para dispará-lo.

Não executei nova chamada live: `TYPESAFE_API_KEY` não está exportada no processo
atual; a evidência live anterior permanece como smoke 1/1, mas ainda falta um
corpus representativo para avaliação de drift. Essa confirmação de contrato não
substitui tal benchmark nem gera crédito percentual duplicado.

Inspeção GitHub apenas de leitura: `main`/`origin/main` permanecem em
`621968e15b35c7c39dc044b6d5b99412a1ad9744`. O último workflow CI desse SHA
(26/09/2026) passou nos jobs unitários e de integridade do backend, mas falhou
na provisão autenticada de perfis e na regressão visual autenticada. Retry e
ajustes locais feitos depois ainda não foram enviados ou executados nesse
ambiente. Não houve push, dispatch, mudança de secrets, uso de QA remoto ou
deploy. O índice permanece **92,6% base + 10/10 extras = 102,6/110 (93,3%)**.

## Rodada funcional E2E e inspeção visual em QA local — 2026-10-04

Como complemento à rodada integral acima, executei jornadas reais contra a
aplicação compilada e a instância Supabase descartável de loopback, com contas
e dados sintéticos. Não usei clientes/tenants de produção e não escrevi em
Supabase remoto, Actions, GitHub ou hospedagem.

- **88 casos Playwright passaram**: portal e autoatendimento (8), RBAC e
  isolamento multi-tenant (13), PWA/offline e falhas de rede (7), CRM,
  limites e importação/exportação (7), onboarding, convite, troca de
  tenant/unidade, billing/trial/feature flags, auditoria e logout (14),
  recuperação/erros de autenticação (9), contratos OAuth sintéticos (9) e
  contraste/acessibilidade pública (21). As suítes de login real com sessão
  local também passaram em Chromium, Firefox e WebKit.
- O teste PWA opcional de soak de cinco minutos foi omitido nesta rodada; não
  era gate desta execução. O soak correspondente já tinha passado na rodada
  documentada acima. Os sete casos funcionais executados agora passaram.
- A primeira execução concorrente teve um timeout isolado de visibilidade de
  toast em WebKit. Reexecutei a suíte isoladamente, confirmei o resultado e
  aumentei o limite daquela asserção de 5 s para 10 s para tolerar contenção do
  browser worker; após o ajuste, os nove casos passaram. Esse ajuste reduz
  falso negativo por contenção, mas não substitui monitorar flakiness no CI.
- Testei a página `/planos` da build de QA com backend Supabase real local em
  desktop (1440×900), mobile (390×844) e tablet (768×1024): os três planos e
  preços foram carregados, sem erro HTTP, overflow horizontal, “Falha na
  conexão” ou `[object Object]`. Capturas: `desktop.png`, `mobile.png` e
  `tablet.png` em `/tmp/cativa-qa-reports-20261004-83128321/pricing-real/`.
- Typecheck, build de produção isolado e `npm audit --omit=dev` passaram. A
  suíte unitária permaneceu em 747/747. Lint ficou em zero erros e 17 avisos
  preexistentes. Fixtures/credenciais/sessões temporárias foram limpas ao
  final (2 tenants, 8 contas sintéticas; sem objetos Storage remanescentes).
  O servidor preview temporário foi encerrado; o Supabase QA local existente
  continua ativo.

Não contabilizo casos já cobertos novamente no percentual. O progresso permanece
**92,6% da base + 10/10 pontos extraordinários = 102,6/110 (93,3% da meta)**.
Continuam pendentes os gates que não podem ser certificados apenas nesta
máquina: execução fresca de GitHub Actions no SHA de entrega, QA remoto seguro
e allowlisted, verificação representativa do Jev ao vivo, OAuth de sandbox
real, inspeção humana das baselines e dispositivos físicos/device farm. A
auditoria completa também mantém alertas altos somente no toolchain de
desenvolvimento, conforme detalhado acima. Portanto, esta rodada é evidência
funcional forte para QA, não assinatura para publicação a usuários externos.

## Reexecução de aceite funcional em QA local — 2026-10-04

Repeti os gates de backend e os fluxos de maior risco usando somente o Supabase
QA descartável em loopback (`127.0.0.1:56201`/`56202`). Antes de cada bateria,
validei o alvo; nenhum projeto Supabase hospedado, Actions, GitHub ou serviço de
publicação recebeu escrita.

- As **16 regressões SQL passaram (16/16)**: RLS/IDOR, Storage, isolamento de
  tenant, CRM, agenda, disponibilidade, confirmação/portal, catálogo,
  administração, quota, histórico de segurança e RPCs atômicas. Os testes
  transacionais terminaram em `ROLLBACK`.
- A disputa da quota Jev voltou a aprovar **32 chamadas simultâneas: 5 aceitas
  e 27 negadas**. Usuário e tenant sintéticos foram removidos.
- A matriz de Storage real via API passou com **seis perfis/tenants**, incluindo
  upload, overwrite, signed URL/download, isolamento A/B, cota exata/excedida,
  oito gravações concorrentes, MIME, logo, tamanho e remoção. Objetos, tenants,
  contas e manifesto da execução foram limpos.
- Fiz build de produção em diretório temporário isolado, sem tocar no `dist/`
  compartilhado. Contra esse build e o banco/Auth/Realtime reais do QA local,
  passaram **8/8** jornadas mobile de agendamento do portal, autoatendimento e
  central de confirmação, além de **7/7** cenários mobile de agenda offline,
  falha/retry, reload e Realtime. O soak opcional de cinco minutos não foi
  habilitado nessa repetição (**1 skipped**); a execução reportou 15 aprovados,
  zero falhas e um skip esperado. Todas as contas, tenants, tokens, mídia e
  arquivos temporários foram removidos ao final.
- Uma tentativa inicial da matriz Storage com Node 20 foi recusada antes de
  criar fixtures porque o Supabase JS exige WebSocket nativo. A repetição com
  Node 24 passou; não houve alteração funcional de código por causa do runtime.

Esta repetição não duplica crédito no roadmap: o índice continua **92,6% da
base + 10/10 pontos extraordinários = 102,6/110 (93,3%)**. Continua não sendo
liberação para testadores externos: faltam um Actions atualizado no SHA de
entrega, QA remoto allowlisted, avaliação representativa do Jev ao vivo,
callback OAuth em sandbox, revisão humana integral dos baselines e validação
em dispositivos físicos/device farm.

## Gates locais de entrega — 2026-10-04

Reexecutei os gates locais sem credenciais reais, sem gravar no Supabase remoto,
sem disparar workflow e sem alterar o `dist/` compartilhado. Os builds e
relatórios temporários foram isolados em `/tmp`.

- **1.160 testes automatizados passaram**: 750 Vitest; 18 testes Node para
  manifesto/retries/storage/JUnit/guard de alvo; 300 testes visuais em 15
  projetos Chromium, Firefox e WebKit; 65 testes públicos de segurança e
  acessibilidade; 9 casos de autenticação nos três motores; e 18 casos de Core
  Web Vitals. Todas essas suítes tiveram zero falhas e zero skips.
- A matriz de layout verificou 9 rotas públicas, overflow/clipping, foco e
  teclado, bottoms da página, breakpoints 767/768, 1023/1024 e 1279/1280, e
  reflow equivalente a zoom 200%/400%, em desktop, notebook, tablet, mobile de
  320/360/390 px e orientações landscape. O gate público WCAG 2.2 AA passou em
  nove rotas e três larguras; payloads de conteúdo de tenant foram testados
  contra HTML/XSS e esquemas de link executáveis.
- Nos 18 testes de performance, LCP variou de **184 a 1.556 ms**, CLS foi **0**,
  INP variou de **16 a 64 ms**, FCP de **184 a 888 ms** e TTFB de **0,6 a 3,1
  ms**. Todos os orçamentos operacionais passaram. É medição de navegador local
  com build de produção sintético, backend 503 simulado e hosts externos
  substituídos; não representa Core Web Vitals de campo.
- `npm run typecheck` passou; `npm run lint` terminou sem erros, com os 17
  avisos preexistentes de Fast Refresh. `npm audit --omit=dev` passou com zero
  vulnerabilidades; a auditoria completa mantém **8 alertas altos** no
  toolchain dev do Tailwind/braces, sem patch transitivo compatível conhecido.
- `npm run test:build:missing-env` passou: produção é bloqueada sem URL/chave,
  um bundle temporário aceitou apenas o host sintético explicitamente
  configurado, e o fallback de desenvolvimento ficou limitado a loopback. O
  build sem configuração de alvo falhou pelo guard como esperado; as variáveis
  de produção continuam ausentes nesta máquina.
- A varredura de segredos foi refeita com Gitleaks **v8.30.0**, imagem fixada
  pelo digest `sha256:691af3c7c5a48b16f187ce3446d5f194838f91238f27270ed36eef6359a574d9`
  e configuração padrão oficial dessa tag. Antes do checkout, um PAT GitHub
  fictício aleatório foi detectado pela regra `github-pat`; então o scanner
  analisou **932/932 arquivos elegíveis**, sem symlinks nem arquivos acima do
  limite, e reportou **zero achados**. A cópia temporária foi removida.
- O status remoto continua sem mudança: `main` e `origin/main` estão no SHA
  `621968e15b35c7c39dc044b6d5b99412a1ad9744`; a última CI continua sendo a
  execução de 2026-09-26, com falhas nos jobs visual mobile e provisionamento QA
  autenticado. O checkout tem 174 arquivos rastreados alterados e 234 não
  rastreados (408 arquivos no total; nenhum staged), então
  estes resultados locais ainda não correspondem a um SHA de entrega revisado.

Sem crédito duplicado por repetir gates: permanece **92,6% da base + 10/10
pontos extraordinários = 102,6/110 (93,3% da meta)**. Isso não equivale a
prontidão de publicação. Ainda exigem configuração/ação apropriada: SHA de
entrega revisado e CI verde, alvo Supabase de publicação explícito, QA remoto
allowlisted, verificação Jev ao vivo representativa, OAuth sandbox, revisão
humana das baselines e validação em dispositivos físicos/device farm.

## Reexecução de perfis + Storage no QA local — 2026-10-04

Ampliei `scripts/e2e-storage-local-smoke.mjs`: depois de provisionar as contas
sintéticas e antes da matriz de Storage, agora roda `scripts/e2e-role-check.mjs`
com o mesmo conjunto efêmero e dentro do mesmo `try/finally` de limpeza. Assim,
um erro de autenticação aborta o aceite sem deixar as fixtures criadas.

A repetição usou o workdir QA isolado `/tmp/cativa-qa-local-20261002`. Antes da
provisão, o CLI confirmou API em `http://127.0.0.1:56201` e Postgres em
`127.0.0.1:56202`; ambos loopback, com chaves somente em memória e sem
credenciais embutidas nas URLs. O provisionador exigiu `E2E_LOCAL_SUPABASE`,
`E2E_QA_PROJECT_REF=local` e `E2E_TARGET_ALLOWLIST=local`.

- **8/8 logins sintéticos passaram**: super-admin, owner A, manager, frontdesk,
  professional, client, owner B e convidado pendente.
- A matriz Storage passou novamente para os seis perfis/tenants, com isolamento
  A/B, URL assinada/download, limite e overwrite de cota, oito mutações
  concorrentes, validação MIME/logo, tamanho máximo e remoção.
- Verificação somente de leitura posterior confirmou **0 tenants, 0 contas,
  0 objetos Storage e 0 manifestos** restantes daquela execução. Sintaxe do
  harness, ESLint no arquivo alterado e `git diff --check` também passaram.

É reteste de gates já contabilizados, portanto o índice permanece **102,6/110
(93,3%)**. Não houve escrita em Supabase remoto, disparo de Actions, push ou
publicação; seguem pendentes os gates de entrega listados acima.

## Soak PWA offline — 2026-10-04

Reexecutei o caso opt-in com a variável correta (`E2E_RUN_OFFLINE_SOAK=true`),
build de produção fora do `dist/` compartilhado e owner/tenant sintéticos
temporários. O Playwright passou **1/1** em **5,2 minutos / 10 checkpoints**:
nenhum PATCH e status servidor `pending` durante a desconexão, fila e snapshot
preservados após reload offline e exatamente uma sincronização PATCH ao
reconectar. Fixtures, sessão, manifesto e artefatos privados foram removidos.
A primeira invocação havia usado `E2E_RUN_SOAK` (flag de outro cenário), por
isso o teste foi corretamente skipped; a repetição aqui confirmou a execução
real. Sem crédito percentual duplicado: o gate de soak offline já constava
como concluído na métrica-base.

## Auditoria de dependências — 2026-10-04

Revalidei o lockfile: `npm audit --omit=dev` passou com **0 vulnerabilidades**;
o audit completo lista **8 alertas altos** na cadeia de desenvolvimento do
Tailwind, todos ligados ao `braces@3.0.3`. O advisory oficial continua sem
versão corrigida e cobre `braces <= 3.0.3`
([GitHub Advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm));
o registry não tem `braces@3.0.4`. A sugestão automática de fix não representa
um patch transitivo seguro: os candidatos exibidos incluem downgrades major
de `@tailwindcss/typography` e `lovable-tagger`. Não apliquei downgrade ou
mudança forçada que possa alterar o build; o risco permanece restrito ao
toolchain de desenvolvimento e precisa ser reavaliado quando houver patch
compatível.

## Aceite autenticado em dev e build de produção local — 2026-10-04

Ampliei o wrapper descartável `test:storage:check:local` para executar a suíte
visual autenticada dentro do mesmo ciclo de provisionamento/cleanup. Os dados,
sessão Playwright, HTML e traces usam diretórios temporários; o alvo exige
Supabase de loopback e allowlist exclusivamente `local`.

Na execução contra Vite dev e na repetição contra a build de produção (servida
por `vite preview`), cada uma passou **55/55 testes visuais autenticados**:
36 verificações de 12 rotas em iPhone 14, iPhone SE e Android 360; quatro
cenários de navegação/safe-area; uma jornada Agenda → Confirmações; e 14
verificações de sobreposição do BottomNav em iPhone 14 e iPhone SE. Snapshots
não foram atualizados. Cada ciclo validou **8/8 logins sintéticos**, repetiu a
matriz Storage por papel/tenant, isolamento A/B, MIME, cotas e oito mutações
concorrentes. A inspeção posterior dos dois ciclos encontrou zero tenants,
contas sintéticas e objetos de Storage remanescentes.

Também passaram novamente **750/750 testes Vitest**, typecheck, lint (zero
erros; 17 avisos Fast Refresh preexistentes) e build de produção isolado, com
3.264 módulos e precache PWA de 138 arquivos. `git diff --check` passou.

O smoke externo é o bloqueador de publicação: `https://cativapp.lovable.app/planos`
respondeu HTTP 404 com `Build incomplete`; o preview
`https://cativa-gestao-clientes.belson91.chatgpt.site/planos` respondeu HTTP
401; `127.0.0.1:18083/planos` não estava ativo. O último CI visível no GitHub
continua sendo o run `36257353238`, falho, em 2026-09-26 e SHA
`621968e15b35c7c39dc044b6d5b99412a1ad9744`; o Secret scan desse SHA passou.
O checkout segue com alterações locais não publicadas. Não fiz push, dispatch
de Actions, escrita remota no Supabase nem publicação.

Isto é reteste dos gates locais já pontuados e não eleva o índice: **102,6/110
(93,3%)**. Apesar do aceite local positivo, a versão ainda não pode ser
considerada publicada nem liberada para testes externos enquanto o host não
servir a build e não existir CI verde para o SHA de entrega.

## Triagem Gitleaks e tolerância a falha transitória no Auth — 2026-10-04

Inspecionei os logs do job `qa-authenticated` do CI `36257353238`: a função
`admin-provision-test-users` recebeu HTTP 500 do Supabase Auth com
`Database error finding users` ao listar contas existentes. A cópia local do
provisionador já tinha retry de função, mas apenas três tentativas e atrasos
de 250/500 ms. Ampliei a política, ainda limitada e idempotente, para cinco
tentativas com backoff 500/1.000/2.000/4.000 ms e log explícito do limite.
O teste reproduz quatro respostas HTTP 500 consecutivas antes do sucesso;
**7/7 testes de retry passaram**, incluindo o limite e a não repetição de
falhas de autenticação/cliente. Isso corrige a resiliência localmente, mas
somente uma nova execução no Actions pode confirmar o provedor remoto.

Na varredura Gitleaks v8.30.0 fixada por digest, a cópia exata dos arquivos
rastreáveis e não ignorados (incluindo os novos) foi limpa: **0 achados em
5,68 MB**. A varredura bruta do diretório também percorreu `dist/`, que é
ignorado pelo Git, e marcou cinco ocorrências genéricas. Hashes locais
confirmaram que todas são a mesma chave Supabase `sb_publishable_` usada pelo
frontend compilado; não são chave service-role nem chave Jev, e nenhum desses
artefatos ignorados será enviado pelo Git. Não suprimi as regras do scanner.

O retry e a varredura são progresso de robustez/segurança, mas não pontuam
novamente gates já concluídos. O índice permanece **102,6/110 (93,3%)**; o
Actions novo, o host público funcional e a revisão de todos os arquivos
pendentes ainda precisam de evidência antes da liberação.

## Reexecução ampla local e correção de escala do Jev — 2026-10-04

Corrigi uma representação que a revisão da documentação TypeSafe identificou:
o app convertia o `Score` ordinal de urgência do Jev em porcentagem, embora a
escala não seja uma medida de magnitude calibrada. Agora a interface apresenta
uma faixa textual (`Sem urgência`, `Baixa`, `Moderada`, `Alta` ou `Incerta —
revisar`); empate ou confiança abaixo do limite manda a recomendação à revisão
humana. A validação do contrato, a UI e os testes rejeitam o campo numérico
antigo. Os **45 testes focalizados** de lógica/componente e a suíte completa de
**751/751 Vitest** passaram.

Reteste de build executado com Node 22.22.3 e saída temporária fora de `dist/`,
apontada somente ao Supabase QA em loopback: **3.264 módulos compilados e 138
arquivos PWA precacheados**; o bundle não continha refs dos projetos Supabase
protegidos. O teste `test:build:missing-env` também passou nos três cenários:
sem configuração, host sintético de build e fallback dev restrito a loopback.
Uma chamada direta sem variáveis confirmou que a proteção de build interrompe
a publicação quando não há alvo explícito. Não alterei nem removi o `dist/`
compartilhado.

No QA Supabase local descartável, **16/16 regressões SQL** passaram (RLS, IDOR,
Realtime, Storage/cotas, mídia/CRM, agenda, portal, referências tenant-aware,
quota Jev e transações administrativas/onboarding). Os testes dos harnesses
passaram **19/19**: manifesto de evidência, retry do Auth, Storage key, relatório
JUnit SQL e guard de alvo de segurança. Typecheck passou; lint teve zero erros
e os mesmos 17 avisos Fast Refresh; a auditoria das dependências de runtime
reportou zero vulnerabilidades. A verificação TypeScript estrita e isolada do
núcleo da Edge Function Jev (`logic.ts` + cliente compartilhado) também passou.
Não há runtime Deno nem `TYPESAFE_API_KEY` no ambiente atual, então não alego
um teste HTTP real do Jev nem uma execução da Edge Function em Deno.

O `npm audit` completo ainda informa **8 achados altos** na dependência
`braces <= 3.0.3`, transitiva de Tailwind/Lovable e restrita ao toolchain de
desenvolvimento; a auditoria das dependências de runtime permanece limpa. O
advisory primário continua sem versão corrigida publicada e o auto-fix proposto
exige downgrade breaking de `lovable-tagger`, então não forcei uma alteração
arriscada ([GitHub Advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/ghsa-vfj7-8cjw-p6xm)).

Playwright adicional, sobre mocks locais determinísticos:

- **300/300** layout/reflow nas rotas públicas e onboarding, com 15 combinações
  de desktop, notebook, breakpoint, tablet, mobile 320/360/390 e landscape,
  incluindo Chromium, Firefox e WebKit;
- **21/21** verificações explícitas de contraste AA em desktop, tablet/WebKit e
  mobile de 320 px;
- **65/65** testes de segurança pública: mensagens de Auth 400/429, validação
  pré-envio, teclado/alvos táteis, matriz WCAG/geometria e proteção contra XSS
  e URLs `javascript:`.

O checkout ainda não está pronto para entrega externa: a chamada direta atual
ao host Lovable retornou **404**, o preview `chatgpt.site` retornou **401** e o
servidor local `127.0.0.1:18083` está parado. No GitHub, `main` remoto continua
no mesmo SHA `621968e15b35c7c39dc044b6d5b99412a1ad9744`: o último workflow de CI
(run `36257353238`, 2026-09-26) falhou; Secret scan do mesmo SHA passou. Os
resultados desta rodada são locais e ainda não existem no SHA remoto. Não
disparei o workflow remoto, não fiz push nem alterei Lovable/Supabase remoto.
O checkout contém agora **176 arquivos tracked modificados + 234 untracked =
410 caminhos**; a revisão e seleção segura dessas mudanças continuam pendentes.

Não há crédito duplo por retestes de gates já pontuados. Índice auditável
mantido em **92,6% da base + 10/10 extraordinários = 102,6/110 (93,3% da
meta)**. Portanto, apesar da rodada local limpa, **não libere ainda para
clientes ou usuários reais**: falta revisar/preparar o SHA de entrega, executar
CI verde nele e confirmar uma build funcional no host de testes.

## Aceite integrado local e smoke de publicação — 2026-10-04

Reexecutei os testes contra a instância dedicada Supabase QA em loopback
(`127.0.0.1:56201`, PostgreSQL `56202`), nunca contra Supabase remoto. O harness
criou perfis sintéticos, completou os logins de **8/8 papéis** e passou
**55/55 verificações autenticadas** em iPhone 14, iPhone SE e Android 360,
incluindo rotas de CRM/operação, navegação offline, jornada Agenda →
Confirmações, safe-area e ausência de sobreposição da BottomNav. A matriz real
de Storage aprovou seis papéis/tenants, isolamento A/B, URLs assinadas, MIME,
cotas e oito disputas concorrentes. A auditoria de cleanup confirmou **0
tenants, 0 contas Auth, 0 objetos Storage e 0 manifestos** daquela execução.

As **16/16 regressões SQL** passaram novamente no Postgres local: RLS/IDOR,
Realtime, Storage, CRM, agenda, portal, auditoria tenant-aware, quota Jev e
transações administrativas/onboarding. A contenção da quota Jev também passou
em **32 RPCs concorrentes** (5 aceitas e 27 recusadas). Core Web Vitals aprovou
**18/18** combinações de rota/viewport em build local de produção, com CLS 0 e
os limites de LCP/INP respeitados; backend indisponível e hosts externos foram
simulados, portanto estes números são laboratoriais.

Na mesma revisão, **751/751 Vitest**, typecheck, lint e guard de build sem env
passaram; lint manteve 17 avisos Fast Refresh e zero erros, e `npm audit
--omit=dev` reportou zero vulnerabilidades. Build temporário compilou 3.264
módulos e 138 entradas PWA, sem refs dos Supabase protegidos no bundle. Deno
2.9.7 validou as seis Edge Functions e lintou oito arquivos; `actionlint`
validou os workflows atuais. Os outputs de build e JUnit ficaram em `/tmp`, e
`git diff --check` passou.

O smoke externo foi repetido sem escrita: `cativapp.lovable.app/planos` segue
em **404**, `cativa-gestao-clientes.belson91.chatgpt.site/planos` em **401** e
`127.0.0.1:18083` sem servidor. `main` remoto continua no mesmo SHA do checkout
(`621968e15b35c7c39dc044b6d5b99412a1ad9744`); o CI mais recente desse SHA segue
falho (run `36257353238`, 2026-09-26), embora o Secret scan tenha passado. Não
houve push, dispatch de Actions, escrita Supabase remota ou publicação.
Também não foi repetido o HTTP live do Jev: `TYPESAFE_API_KEY` não está
carregada no ambiente desta sessão.

O checkout tem **176 caminhos rastreados modificados e 234 arquivos não
rastreados (410 arquivos no total)**; todos ainda precisam de revisão/seleção
antes de formar um SHA publicável.
São retestes locais dos gates já pontuados, portanto o índice não sobe por
duplicar execuções: **92,6% da base + 10/10 extraordinários = 102,6/110
(93,3%)**. Ainda não é seguro abrir testes externos a clientes: o host de teste
não serve a aplicação e falta CI verde no SHA revisado.

## Reteste de snapshots mobile e Storage — 2026-10-04

Corrigi um falso positivo da captura full-page: a navegação fixa era validada
geometricamente, mas podia aparecer flutuando no meio da imagem alta. A folha
`e2e/_helpers/full-page-snapshot.css` agora é injetada pela opção correta
`stylePath` do Playwright; snapshots escondem a BottomNav apenas na captura
full-page, após testar visibilidade, safe-area e sobreposições. Também
normalizei fontes somente nos testes visuais (Arial/Georgia locais), pois o
produto importa Inter/Fraunces do Google Fonts e o fallback remoto produzia
diferenças de altura/antialiasing entre execuções. O CSS de produção não foi
alterado.

Com isso, **36/36 capturas autenticadas** passaram em atualização e, numa
segunda execução independente sem atualizar baselines, **36/36 passaram** em
iPhone 14, iPhone SE e Android 360 (12 rotas × 3 viewports). A matriz Storage
foi executada novamente no Supabase descartável em loopback: 8/8 perfis
autenticados, seis papéis/tenant, isolamento cross-tenant (403), signed URL,
MIME, quotas, overwrite e oito disputas concorrentes; o objeto de teste e as
fixtures foram removidos pelo harness.

Após as alterações do harness, **751/751 Vitest**, typecheck e lint integral
foram repetidos. Typecheck e unitários passaram; lint ficou em **0 erros e 17
avisos preexistentes** de Fast Refresh. Essas execuções repetem gates já
incluídos no índice e não aumentam sua pontuação. Continuam bloqueadores para
testes externos o host Lovable (404), o preview (401), CI remoto falho no SHA
atual e a revisão/seleção dos **412 caminhos locais** modificados/não rastreados
(177 rastreados e 235 não rastreados nesta checagem).

## Smoke Jev com provedor real — 2026-10-04

Executei `npm run test:jev:live` com uma credencial fornecida pelo usuário,
mantida somente no ambiente efêmero do processo e sem impressão ou gravação em
arquivo. O script faz uma chamada sem retry para o endpoint oficial
[`POST /v1/systemone`](https://docs.typesafe.ai/api), com fixture de retenção
sintética e sem nome, telefone, e-mail ou identificador. A resposta Jev
`jev-1.13.0` passou contrato, consumo e invariantes do app: recomendação
`human_review`, confiança `0,26`, suficiência `0,63`, urgência `high` e
`automaticAction=false`; latência 495 ms (995 tokens de entrada/106 de saída).
Isso confirma que o provedor responde e que baixa confiança/suficiência não
dispara ação automática. Uma só resposta não é corpus representativo nem prova
estabilidade/drift, e por isso não foi contada como mais de um smoke ou novo
crédito no índice.

## Rodada adicional de release QA — 2026-10-04

Executei jornadas reais contra a instância Supabase QA local descartável em
loopback (`127.0.0.1:56201`) com tenants/usuários sintéticos e limpeza ao final.
RBAC aprovou **12/12** casos; convite e aceite de membro, **1/1**; a suíte
autenticada de operação, **17/17**; e Storage repetiu upload, leitura, remoção,
signed URL, allowlist MIME, cotas, concorrência e isolamento A/B em seis
papéis/tenants. Todas as validações de login dos oito papéis passaram.

A trilha PWA passou **8/8** verificações em Chromium mobile usando build de
produção. Foram testados fila offline sem PII, respostas 503/429, transporte,
reconexões, Realtime, expiração do contexto e reload offline; o soak manteve o
dispositivo desconectado por cinco minutos e **10/10 checkpoints** confirmaram
fila persistida, nenhum PATCH e estado do servidor inalterado. Ao reconectar,
uma única mutação sincronizou e a fila foi limpa. A primeira execução falhou
porque o harness gerava `storageState` em `127.0.0.1`, mas executava o preview
em outro host; alinhei ambos a `http://[::1]:4173` no ramo de teste offline e
reexecutei com sucesso.

Na agenda, as rajadas simultâneas de **25, 50 e 100** reservas produziram uma
reserva vencedora por slot (p95 máximo de **96 ms**). O soak de backend de 60 s
completou **1.987 lotes / 15.896 requisições**, sem dupla reserva nem erro de
limpeza (p95 máximo por lote de 47 ms). Tráfego misto aprovou **250 escritas e
120 leituras** (p95 de leitura 40,2 ms; máximo 50,5 ms); a matriz multi-tenant
aprovou **250 escritas/50 leituras** entre owner, recepção e tenant B, com
**zero vazamentos cross-tenant** (p95 de leitura 28,9 ms). Também passaram
novamente **751/751 Vitest**, typecheck, build de produção (3.264 módulos,
138 entradas PWA), `git diff --check` e lint (zero erros, 17 avisos preexistentes
de Fast Refresh).

O CI consultado em GitHub continua antigo: run `36257353238`, SHA
`621968e15b35c7c39dc044b6d5b99412a1ad9744`, falhou em 26/09. Os logs mostram
falhas de baseline visual mobile/full-page e de provisionamento do QA remoto
com HTTP 500 (`Database error finding users`). Não disparei esse workflow, pois
ele executaria sobre SHA antigo e escreveria no Supabase QA remoto. O smoke
público continua sem destino validável: Lovable `/planos` = **404**, preview
`chatgpt.site` = **401** e `127.0.0.1:18083` indisponível.

A regressão visual crítica Agenda → Confirmações ainda precisa atualizar e
revalidar um snapshot cujo diretório é `root:root` (`755`); sem autorização
administrativa, mantive a baseline intacta. Não houve push, dispatch remoto,
escrita no Supabase remoto ou publicação. São retestes/gates já representados
no índice, portanto não há crédito duplicado: **102,6/110 (93,3% da meta)**.
Os testes locais estão fortes, mas não substituem um SHA revisado com CI verde
nem um ambiente real de prévia funcional.

## Checklist Go-Live local e audit de dependências — 2026-10-04

O checklist Go-Live do owner sintético passou **4/4** em build de produção:
edição e restauração do nome do negócio, bloqueio ao exceder o limite de
unidades, rotas de assinatura/consumo e exportação de clientes. O primeiro
disparo do harness não encontrou o arquivo porque a configuração smoke só
descobre specs sob `e2e/diagnostics`; alinhei o setup à configuração raiz e à
origem `http://127.0.0.1:8080`, e a repetição válida passou. Fixtures locais e
objetos Storage foram removidos após a execução. O caso agora está encapsulado
em `npm run test:local:go-live`, ligado ao job de QA local executado em PR, e
seus relatórios entram no upload de artefatos. A validação de workflow usou a
imagem actionlint por digest definida no CI e passou.

O audit completo atual mantém **8 achados altos exclusivamente no toolchain de
desenvolvimento** (Tailwind 3.4.19, `lovable-tagger`, `@tailwindcss/typography`,
`tailwindcss-animate` e dependências transitivas); `npm audit --omit=dev`
continua em **0 vulnerabilidades**. O achado novo `braces <=3.0.3`
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/ghsa-vfj7-8cjw-p6xm)) é
marcado pelo GitHub como alto e sem versão corrigida disponível; a versão
3.0.3 é a única publicada na linha consultada. As alternativas reportadas para
alguns plugins são downgrades semver-major e não resolvem `braces`. Não apliquei
`npm audit fix` nem migrei Tailwind major automaticamente: isso não seria
correção fundamentada e poderia quebrar o build. A exposição de runtime segue
zerada; a cadeia de desenvolvimento permanece documentada para reavaliar quando
houver correção upstream ou migração testada.

O ambiente da sessão não tem `TYPESAFE_API_KEY`, portanto não ampliei o smoke
de Jev para um corpus pago de drift. Também permanecem sem execução Actions/QA
remotos, revisão do snapshot protegido por proprietário root, callbacks OAuth
com brokers reais e dispositivos físicos. Sem crédito duplicado, a pontuação
permanece **92,6% base + 10/10 extraordinários = 102,6/110 (93,3%)**.

## Aceite ampliado para release — 2026-10-04

Reexecutei os gates no Supabase QA local descartável identificado pelo workdir
`/tmp/cativa-qa-local-20261002` e URL loopback `127.0.0.1:56201`. O runtime do
terminal (Node 20) não fornece o WebSocket nativo exigido pela versão atual do
cliente Supabase; a repetição usou o Node 24.19.0 empacotado no workspace. A
primeira tentativa do harness parou antes de criar fixtures; após alinhar o
`PATH` de subprocessos, a suíte concluiu e o cleanup confirmou tenants,
usuários e objetos sintéticos removidos.

Passaram novamente **751/751 Vitest**, typecheck, build de produção (3.264
módulos e 138 entradas PWA), lint (0 erros; 17 avisos conhecidos de Fast
Refresh), `node --check`, `git diff --check` e `npm audit --omit=dev` (0
vulnerabilidades). E2E autenticado passou **17/17**; RBAC, **12/12**; convite e
aceite, **1/1**; Go-Live do owner, **4/4**; e agenda offline, **8/8**, incluindo
cinco minutos desconectado, dez checkpoints, fila intacta sem mutações offline
e sincronização ao reconectar. A matriz de Storage voltou a passar com seis
papéis/tenants, upload/download assinado, bloqueio cross-tenant (403), limites,
MIME e oito tentativas concorrentes; objetos e fixtures foram limpos.

A agenda passou rajadas de **25/50/100** reservas com exatamente uma vencedora
por slot e p95 de **59/51/90 ms**. O soak concorrente de 60 s passou em **1.633
lotes / 13.064 requisições**, sem dupla reserva e sem falha de limpeza (p95
máximo por lote 29 ms). Tráfego misto passou com 250 escritas/120 leituras
(p95 de leitura 65,2 ms); a disputa multi-tenant com 250 escritas/50 leituras
terminou com **zero vazamentos** (p95 de leitura 45,9 ms). As **16/16
regressões SQL** passaram. O re-scan do banco registrou zero críticos e zero
avisos abertos, com cinco exceções já documentadas por design.

Na apresentação, passaram **300/300** verificações de overflow, clipping,
breakpoints e reflow/zoom em 15 projetos Chromium, Firefox e WebKit; contraste
AA público, **21/21**; lista de espera autenticada, **15/15** em desktop, tablet,
mobile e landscape; e segurança/acessibilidade pública, **65/65** (inclui WCAG
2.2 AA, conteúdo de tenant como texto e rejeição de URLs executáveis). Uma
segunda execução 15/15 validou também a retenção local dos artefatos por run.
Para isso, corrigi o harness: subprocessos agora recebem `node_modules/.bin`
no `PATH` e os diretórios Playwright padrão são persistentes, exclusivos por
run e ignorados pelo Git; `storageState` continua em diretório temporário.

Resta uma falha isolada de regressão visual: a transição Agenda → Confirmações
abre o modal e passa as asserções de overflow, safe-area e BottomNav, mas o
snapshot difere em **37%** dos pixels. O esperado ainda mostra máscaras magenta
nas áreas de formulário; a captura atual corresponde ao helper revisado que
removeu essas máscaras para expor bordas e geometria. Portanto, a evidência
aponta para baseline defasada, mas ela precisa ser revista e atualizada para o
gate ficar verde. A imagem e o diff foram preservados em
`e2e/.artifacts-agenda-visual-20261004/`; a baseline vive em diretório
`root:root`, então não foi sobrescrita nem alterada sem permissão. Asserções
geométricas do modal passaram antes da comparação da imagem.

Também fiz GETs somente-leitura aos destinos: `/planos` na Lovable segue **404**,
o preview `chatgpt.site` segue **401** e `127.0.0.1:18083` não tem servidor.
GitHub ainda aponta `main` para o SHA-base `621968e15b35c7c39dc044b6d5b99412a1ad9744`;
o CI mais recente visível (`36257353238`, 26/09) falhou, e o secret scan do
mesmo push passou. O checkout local contém 183 arquivos rastreados modificados
e 123 não rastreados; não fiz commit, push, dispatch do Actions, escrita no
Supabase remoto ou publicação Lovable. Jev não recebeu nova chamada live nesta
rodada porque a chave Typesafe não está configurada com segurança no ambiente;
o smoke live de fixture única registrado antes não substitui o corpus de drift.

Estes resultados ampliam evidência, mas retestam frentes já pontuadas; não
somam crédito duplicado. Mantém-se **92,6% da base + 10/10 extraordinários =
102,6/110 (93,3% da meta)**. Não liberar a clientes ainda: falta aprovar a
baseline visual, formar/revisar o SHA de entrega, obter CI verde nele e ativar
um destino de prévia/publicação acessível.

## Reteste integrado para entrega no mesmo dia — 2026-10-04

Após os ajustes de UI e do harness, executei novamente a jornada autenticada
local contra o Supabase QA isolado; nenhum cliente ou dado remoto foi usado.
Passaram **21/21 E2E de perfis, onboarding, planos, bloqueios de assinatura e
responsividade**, e **8/8 E2E do portal e da central de confirmações** em WebKit
com viewport iPhone 14. A matriz de Storage também passou para seis
combinações de perfis/tenants: isolamento cross-tenant (403), leitura e upload,
URL assinada, MIME, quotas/overwrite e oito disputas concorrentes. O build de
produção passou. Em verificação separada passaram **751/751 testes Vitest**;
typecheck, lint focado nos arquivos alterados, verificação sintática do
harness e `git diff --check` passaram.

As correções incluíram carregamento sob demanda da busca global em mobile,
descrição acessível para o dialog de busca, navegação E2E resiliente a redirects
e à origem do preview, e dispensa determinística do teclado virtual no onboarding
WebKit. O harness de repetição agora inicia seu próprio preview e gera
`storageState` para a origem correta antes dos smokes autenticados.

A execução limpou seus próprios fixtures. Também removi somente resíduo de QA
antigo do mesmo Supabase local descartável: **11 tenants e 42 contas sintéticas
`@cativa.test`**, verificados como pertencentes exclusivamente ao QA; a
verificação posterior encontrou zero desses tenants/contas e nenhum objeto de
Storage foi removido nessa limpeza. Não houve escrita em Supabase remoto,
commit, push, Actions remoto ou publicação.

Este reteste confirma as jornadas locais, mas não resolve o gate de regressão
visual Agenda → Confirmações descrito acima: a baseline está protegida por
proprietário `root` e ainda requer revisão/atualização autorizada. Para liberar
testes com usuários reais ainda é necessário revisar essa baseline, preparar o
SHA de entrega, obter CI verde nesse SHA e validar um destino de preview
acessível. Não há crédito novo por repetir gates: permanece **102,6/110
(93,3% da meta; 7,4 pontos percentuais da base ainda faltando)**.

## Cobertura crítica dos repositórios de agenda e catálogo — 2026-10-04

Uma nova medição de cobertura mostrou que `src/repositories/scheduling.ts`
estava em apenas 6,4% de statements, apesar de ser a fronteira de persistência
da agenda. Ampliei seus testes para **58 casos**, cobrindo mapeamento,
escopo/filtros, CRUD, estados e timestamps, defaults, hidratação em lote,
referências ausentes, respostas nulas e propagação de erros. A execução focada
atingiu **100% statements, branches, funções e linhas** nesse módulo.

Também acrescentei testes críticos para `src/repositories/catalog.ts`:
categorias, serviços, preços por tenant/unidade/profissional, pacotes, itens,
memberships/benefícios, protocolos/etapas e políticas de cancelamento. Nos
**22 testes focados**, a cobertura foi **89,32% statements, 87,36% branches,
100% funções e 99,15% linhas**. A cobertura global passou da medição anterior
de 21,02% para **23,21% statements, 22,39% branches, 17,49% funções e 23,24%
linhas**. A suíte integral terminou verde com **826/826 testes em 63 arquivos**;
typecheck, lint dos arquivos modificados e `git diff --check` passaram. O gate
de build isolado também foi reexecutado: build de produção sem alvo explícito
foi bloqueado e os alvos sintéticos/loopback continuaram isolados.

Os testes adversariais encontraram dois falsos sucessos em `updateService`:
erros ao consultar/inserir/atualizar o preço-base eram ignorados. Agora essas
falhas são propagadas. Em `createService`, a falha ao gravar o preço-base
dispara compensação que tenta remover o serviço recém-criado; se a compensação
falha, o erro retornado preserva a falha original e a de rollback para revisão.

Limite restante explicitado pelos testes: `updateService` ainda grava os campos
principais antes da mutação do preço, e as rotinas de substituição de overrides,
itens de pacote, benefícios e etapas seguem em operações delete-then-insert;
uma falha na segunda escrita pode deixar estado parcial. Propagar erros e
compensar a criação reduz falsos sucessos, mas não equivale a transação. Esses
fluxos precisam de mutações atômicas no banco e regressões SQL antes de poderem
ser considerados integralmente seguros para produção; não foram mascarados por
testes unitários.

Esta expansão aumenta a evidência sem redefinir a média nem creditar novamente
gates já pontuados. O índice permanece **92,6% da base + 10/10 extraordinários
= 102,6/110 (93,3% da meta)**. QA remoto/Actions no SHA preparado, baseline
visual protegida por `root`, OAuth/integrações reais e destino de preview
acessível seguem sem autorização/evidência nesta rodada.

## Reteste integral em Supabase QA local descartável — 2026-10-04

Para antecipar a validação sem tocar em sistemas protegidos, esta rodada usou
uma instância Supabase local em loopback, contas/tenants sintéticos e serviços
externos bloqueados ou simulados. Não houve escrita em Supabase remoto, GitHub,
Lovable ou contas de clientes. O guard confirmou `project_ref=local` e a
allowlist exclusivamente local antes das regressões destrutivas.

Foram aprovados **1.306 casos únicos** em conjuntos complementares:

- **826/826** Vitest; typecheck passou; lint completo sem erros (**17 avisos
  preexistentes**); `git diff --check` passou.
- **16/16** regressões SQL/RLS/IDOR, incluindo Storage, escopo de agenda,
  catálogo/CRM, portal, quotas Jev, onboarding e assinatura atômicos.
- **300/300** testes geométricos e de reflow em Chromium, Firefox e WebKit,
  incluindo breakpoints, tablet, landscape, 200%/400% e rotas públicas.
- **65/65** testes de segurança e acessibilidade pública e **21/21** verificações
  de contraste AA.
- **17/17** jornadas autenticadas reais contra o app e o banco QA locais;
  **4/4** checks de go-live (com restauração dos dados de perfil ao final); e
  **8/8** fluxos de portal, autoatendimento e central de confirmações.
- **7/7** casos PWA/offline obrigatórios. O soak opcional de cinco minutos foi
  explicitamente deixado de fora; portanto continua não validado.
- **18/18** Web Vitals em build de produção isolado e **5/5** cenários de
  concorrência, carga, soak de 60 segundos, tráfego misto e isolamento
  multi-tenant. Nas rajadas de 25/50/100 reservas, persistiu exatamente uma
  reserva por horário (p95 de 62/79/109 ms); no soak houve 1.242 lotes e 9.936
  requisições sem dupla reserva; o teste simultâneo multi-tenant registrou
  **zero vazamentos**.
- **19/19** testes dos helpers de evidência, retry, Storage key, JUnit e guard
  de segurança; o build sem alvo foi corretamente bloqueado.

A varredura de segurança do banco local terminou com **0 achados críticos,
0 avisos e 5 itens aceitos documentados**. A configuração temporária usada no
reteste ocultou credenciais e produziu relatórios fora do bundle/release.

Esta é evidência nova de execução, não um aumento automático do índice: gates já
pontuados não recebem crédito novamente. Mantém-se **102,6/110 (93,3%)**. Ainda
não é seguro declarar release: permanecem a atomicidade das gravações agrupadas
do catálogo (`updateService`, overrides, pacotes, memberships e protocolos), a
revisão humana da baseline Agenda → Confirmações protegida por `root`, CI/QA
remotos sobre o SHA de entrega, integrações OAuth/JeV reais quando houver
credenciais sandbox apropriadas, e um preview acessível no destino de publicação.
O teste visual autentica e mede layout mas não substitui revisão humana de
baseline. Nenhum commit, push ou deploy foi realizado nesta rodada.

## Reteste real do catálogo para a candidata de entrega — 2026-10-04

Fechei localmente o bloqueio de gravações parciais do catálogo. A migration
`20261004130000_atomic_catalog_mutations.sql` oferece RPCs transacionais para
criar/atualizar serviço e preço-base, substituir preços por unidade/profissional
e salvar pacotes, memberships e protocolos junto de seus filhos. As funções
rodam como `SECURITY INVOKER`, mantêm RLS, exigem papel owner/manager (ou
super_admin), restringem os grants a authenticated e validam arrays nulos,
limites de itens, valores negativos e referências cross-tenant. No repositório,
as operações agrupadas agora usam essas RPCs; a substituição de itens sem
`tenantId` obrigatório falha cedo em vez de retornar sucesso sem persistir.

Validei o código atual contra Supabase QA descartável em loopback: **827/827
Vitest**, **17/17 regressões SQL/RLS**, incluindo novo teste transacional de
rollback de pai e filhos; **7/7 RPCs** exercitadas por PostgREST como owner
sintético, com criação, atualização, leitura de filhos e limpeza dos registros;
**3/3 jornadas E2E** do owner, frontdesk e profissional em iPhone 14. Typecheck,
lint dos arquivos aplicáveis e `git diff --check` passaram. O build de produção
isolado transformou 3.264 módulos e gerou PWA com 138 entradas. O lint ignorou
`src/integrations/supabase/types.ts` pela configuração existente; o arquivo foi
coberto pelo typecheck, sem erro. Os dados dos testes foram sintéticos; a
regressão SQL terminou com `ROLLBACK` e o cliente autenticado confirmou a
limpeza dos registros próprios. A atualização manual da definição de RPC foi
aplicada somente ao PostgreSQL local, não ao Supabase remoto.

Não há nova pontuação por repetir gates já medidos: permanece **102,6/110
(93,3% da meta)**. O bloqueio de atomicidade do catálogo fica resolvido na
candidata local, mas ainda não é autorização/evidência de release. Continuam
pendentes a revisão humana da baseline Agenda → Confirmações (diferença visual
registrada anteriormente; a pasta segue sob `root`), validar e aplicar a
migration no QA remoto autorizado, obter CI verde no SHA de entrega e dispor de
preview acessível para o aceite. Não houve escrita remota, commit, push,
execução de Actions remoto nem publicação.

## Reteste para entrega no mesmo dia — 2026-10-04

Reexecutei os gates locais em Node 24.19.0, com o QA Supabase descartável em
loopback e fixtures sintéticas. O guard confirmou alvo e allowlist
exclusivamente locais antes das mutações SQL. Resultados desta rodada:

- **829/829 Vitest**, em 63 arquivos; cobertura global: 23,07% statements e
  linhas, 22,48% branches e 17,51% funções.
- Typecheck dos projetos app e node aprovado; lint completo com **0 erros e
  17 avisos conhecidos**; `git diff --check` aprovado.
- `npm audit --omit=dev`: **0 vulnerabilidades** nas dependências de produção.
- **17/17** regressões SQL/RLS/IDOR passaram, inclusive catálogo atômico; as
  mudanças transacionais foram testadas no banco QA local descartável.
- **3/3** jornadas autenticadas com owner, frontdesk e professional contra o
  app e Auth/PostgREST locais, em iPhone 14.
- **300/300** verificações públicas de geometria/reflow em 15 projetos
  Chromium, Firefox e WebKit; **65/65** verificações públicas de segurança e
  acessibilidade; **21/21** verificações separadas de contraste WCAG AA.
- Build de produção isolado passou: 3.264 módulos, PWA com 138 entradas de
  precache. A saída foi gravada em `/tmp/cativa-release-build.DJp64c`, sem
  tocar no `dist` existente do usuário.

Os relatórios Playwright, SQL/JUnit e cobertura desta rodada ficaram em
`/tmp/cativa-*20261004*`. A métrica global de cobertura permanece baixa e
continua sendo um limite explícito; os gates verdes atestam as áreas exercitadas,
não todo o código do sistema.

O `npm audit` completo apresenta **8 entradas altas em dependências de
desenvolvimento**, todas no toolchain Tailwind/estilização, decorrentes da
dependência transitiva `braces <=3.0.3` (CVE-2026-93687). O advisory oficial
classifica o problema como stack exhaustion e lista **nenhuma versão corrigida**
até 2026-10-04. O npm não oferece correção compatível; as sugestões disponíveis
envolvem downgrades major. Não apliquei overrides nem downgrades especulativos.
O audit de produção continua limpo, mas a cadeia de build permanece um risco
conhecido a aceitar ou corrigir quando houver versão segura compatível.

Durante uma tentativa adicional de injetar falha no endpoint de planos, a página
mostrou os preços base e não exibiu `[object Object]`, mas a automação não
reproduziu de forma consistente o banner de conexão/retry esperado. Esse caso
exploratório não foi incorporado nem contado como aprovado; precisa de um teste
de falha dedicado antes de declarar a recuperação visual integralmente aceita.

Não há crédito novo por repetir gates já pontuados: o índice permanece
**102,6/110 (93,3% do plano)**. Isso não é um percentual de prontidão para
publicação. Ainda impedem declarar a candidata pronta para usuários reais: a
revisão humana da baseline Agenda → Confirmações protegida por `root`, ter CI
verde no SHA de entrega, QA remoto autorizado, preview acessível e aceite de
OAuth/integrações e dispositivos reais. Nesta rodada não houve commit, push, CI
remoto, escrita remota ou deploy.

## Regressão HTTP 503/retry dos planos — 2026-10-04

Fechei a lacuna de reprodução anotada na rodada anterior com um E2E dedicado,
`e2e/security/pricing-connection-recovery.spec.ts`. O mock local mantém o
endpoint de planos em HTTP 503 durante as tentativas automáticas reais do
cliente PostgREST; só responde com o catálogo sintético após o clique explícito
em “Tentar novamente”. O teste confirma o alerta acessível, os cartões-base,
ausência de `[object Object]`, recuperação do plano/valor e área clicável de ao
menos 44×44 CSS px. O teste/configuração ficaram reproduzíveis por
`npm run test:pricing:recovery` e `playwright.pricing-recovery.config.ts`.

A sequência passou **3/3 em desenvolvimento** (Chromium desktop, WebKit tablet,
Chromium mobile) e **3/3 no build/preview de produção isolado** nos mesmos
perfis. A build temporária transformou 3.264 módulos e gerou 138 entradas PWA,
sem tocar no `dist` do usuário. Também passaram typecheck app/node e ESLint nos
arquivos novos. A interceptação usa hostname `.invalid`, fixtures sintéticas e
o isolamento do harness público; CDNs de fontes também são bloqueadas/mockadas.
Não houve chamada a Supabase/Auth real, escrita ou uso de credencial remota.
Esta evidência fecha somente essa regressão local e não aumenta o índice por
repetição nem substitui CI no SHA, QA remoto autorizado ou aceite de dispositivos
físicos/provedores reais. O índice mantém-se em **102,6/110 (93,3%)**.

## Retenção/Jev: casos de borda e disponibilidade do smoke live — 2026-10-04

Consultei a documentação TypeSafe vigente: Choice retorna distribuição e
confiança, Score retorna nível ponderado/distribuição/confiança e Noul retorna
somente probabilidade; confiança não significa correção global da decisão
([API](https://docs.typesafe.ai/api),
[Confidence](https://docs.typesafe.ai/confidence)). A referência Jev 1.13 também
recomenda que contagem e comparações numéricas fiquem em código e alerta para
sensibilidade à ordem das opções
([Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).

Reforcei os testes determinísticos da retenção: VIP sem outro sinal não basta
para justificar contato prioritário; um no-show isolado não aciona a regra de
no-show recorrente, enquanto dois acionam; appointment com estado `confirmed`
não vira “futuro sem confirmação” só porque `confirmed_at` está vazio; e a
flag VIP é preservada na projeção minimizada. A suíte focada passou **46/46**;
typecheck app/node e ESLint do teste passaram. A suíte completa passou
**831/831** em 63 arquivos. Cobertura global manteve 23,07% statements/linhas,
22,48% branches e 17,51% funções. `_shared/jev.ts` permanece em 100% de
statements/branches/funções/linhas; a lógica de retenção ficou em 98,68%
statements, 97,97% branches e 100% funções/linhas. Os três ramos não cobertos
são guardas para distribuição singleton ou fallback de total de pacote que a
filtragem de pacote ativo torna inalcançável.

Também tentei `npm run test:jev:live`. O processo encerrou com código 2 antes de
qualquer chamada: `TYPESAFE_API_KEY` não está no ambiente nem nos arquivos
locais de configuração conferidos. Não copiei a chave do histórico e não
consultei secrets remotos. Portanto, nenhum consumo foi feito nesta tentativa;
a evidência live de uma fixture única já registrada acima não substitui o
corpus de drift representativo, que continua pendente até a credencial ser
disponibilizada no ambiente de execução. Não somei crédito nem alterei a nota:
**92,6% base + 10/10 extraordinários = 102,6/110 (93,3%)**.

## Aceite ampliado com QA Supabase local — 2026-10-04

Reexecutei os gates sem credenciais reais contra a instância QA local descartável
confirmada em `127.0.0.1:56201`/`56202`. O harness provisionou oito papéis e dois
tenants sintéticos com sufixo único, executou as suites e encerrou com limpeza
confirmada. As **17/17 regressões SQL** passaram: RLS/IDOR, Storage, CRM, notas,
agenda, disponibilidade/fila, confirmação/portal, catálogo, administração,
auditoria de referências, quota Jev, histórico do scanner e mutações atômicas.
O teste de Storage pela API verificou upload/overwrite/download assinado,
remoção, cotas e MIME; rejeitou upload cross-tenant com HTTP 403, cobriu owner,
manager, frontdesk, professional, client e owner do tenant B, e confirmou a
limpeza dos objetos e fixtures.

A integridade de agenda passou disputas reais no PostgreSQL local com **25, 50
e 100 chamadas simultâneas**, uma reserva vencedora por slot, sem double-booking
(p95 90/99/129 ms). O soak de 60 s concluiu **1.247 lotes/9.976 requisições**,
com 1.247 reservas e conflitos esperados, p95 máximo de lote 43 ms e
`cleanupFailure=null`. Tráfego misto passou com 250 gravações/120 leituras
(p95 de leitura 70,4 ms). A matriz multi-tenant passou com 250 gravações/50
leituras e **zero vazamentos cross-tenant** (p95 de leitura 48,5 ms).

Na validação browser e código passaram novamente **831/831 Vitest**, typecheck
app/node, lint (0 erros; 17 avisos conhecidos) e `test:build:missing-env`. A
matriz pública de layout/reflow passou **300/300** em 15 configurações
Chromium/Firefox/WebKit; contraste público passou **21/21**; segurança pública,
**66/66**; autenticação/recovery, **9/9**; OAuth sintético, **9/9**; e
recuperação de planos após HTTP 503, **3/3** tanto em dev quanto no bundle de
produção isolado. Core Web Vitals no bundle de produção local passou **18/18**:
CLS 0 em todos os perfis, LCP máximo de 2.000 ms na landing/296 ms em planos,
INP máximo de 80 ms e zero imagens quebradas. O bundle compilou 3.264 módulos
e gerou 138 entradas PWA. A URL hospedada testada anonimamente respondeu
**HTTP 401**, então o smoke do
deploy externo não prosseguiu; não contornei o controle. O build de entrega
continua exigindo `VITE_SUPABASE_URL` e chave pública corretas, indisponíveis
nesta sessão. Jev live/drift representativo também não foi repetido por falta
de `TYPESAFE_API_KEY` no ambiente; não houve consumo nessa rodada.

Esta evidência não concede pontos novos por repetir gates: índice mantido em
**102,6/110 (93,3%)**. Não publiquei, não enviei alterações ao GitHub, não
disparei Actions e não escrevi em Supabase remoto. Para abrir testes reais com
usuários ainda faltam alvo/segredos corretos de release, preview acessível,
execução verde no SHA candidato e revisão humana das baselines protegidas.

## Regressões autenticadas, onboarding e aceite operacional — 2026-10-04

Na instância Supabase descartável em loopback, rodei novamente as jornadas com
tenants/contas sintéticas e limpeza por execução: cadastro/onboarding,
owner/manager/frontdesk/professional, limites de plano, trial, bloqueio de
assinatura, busca, responsividade e portal. O conjunto autenticado fechou
**21/21**; confirmação e autosserviço no portal, **8/8**. A matriz de Storage
passou novamente para seis perfis/tenants, incluindo negação cross-tenant,
MIME, assinatura de URL, quota e oito disputas simultâneas; a limpeza do objeto
foi confirmada. A matriz RBAC fechou **12/12**, convite de equipe **1/1** e o
checklist operacional de go-live **4/4** (perfil, unidades, assinatura e
exportação). O build de produção local gerou 3.264 módulos e o teste de build
fail-closed sem configuração de produção passou.

O E2E de onboarding revelou um defeito real: depois do signup, o guard podia
desmontar a tela enquanto verificava o tenant e apagar o passo atual do wizard.
A etapa de configuração agora sobrevive a esse remount por um marcador de rota
sem PII, removido ao avançar. Também tratei rejeição de rede da SDK para que o
formulário não permaneça carregando. Os dois testes unitários novos passaram e
a jornada ponta a ponta passou no conjunto autenticado **21/21**.

A verificação de layout Agenda → Confirmações passou overflow, BottomNav,
safe-area e restauração da rolagem do modal. A asserção visual ainda compara
com um PNG antigo (35% de diferença), armazenado em diretório `root:root` sem
permissão de escrita para o usuário atual; mantive a baseline intacta. A URL
hospedada voltou a responder **HTTP 401**. Neste ambiente também estão ausentes
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `TYPESAFE_API_KEY`, então
não executei escrita remota nem smoke pago do Jev. O checkout tem **315**
arquivos modificados/não rastreados nesta data; nenhum foi enviado ao GitHub,
nenhuma Action foi disparada e nada foi publicado.

Essa rodada não credita pontos por repetição; o índice permanece em
**102,6/110 (93,3%)**. Ainda não é seguro liberar testes com clientes até
restaurar o acesso público autorizado, revisar/publicar um SHA candidato com
configuração de produção, atualizar e revisar a baseline visual protegida e
obter os segredos/provedores necessários para os aceites externos.

## Rodada real final para o onboarding e portal — 2026-10-04

Corrigi a checagem final do fluxo: a sessão autenticada já é mantida pelo
`AuthProvider`/guard, então removi a consulta redundante a `getSession()` antes
da RPC e uso a identidade validada pelo provider. O `OnboardingGuard` agora
mantém o wizard montado, mas oculto pelo loader enquanto verifica o tenant;
isso eliminou o reset intermitente para “Vamos começar” após o signup. O estado
de criação comunica `aria-busy` e um rótulo/status acessível; listas de
profissionais e serviços usam atualização funcional. Também corrigi o cartão
de revisão em telas pequenas para empilhar rótulo e valor, e adicionei
asserções geométricas no E2E para impedir sobreposição e saída do conteúdo em
320, 390 e 768 px.

No Supabase local descartável, com contas e tenants sintéticos e limpeza
automática, o build/PWA foi gerado, a jornada de cadastro criou tenant/unidade/
profissional/serviço pela RPC e chegou ao dashboard, validando a saudação real
do painel; jornadas de papel, onboarding, assinatura, trial e UX passaram
**18/18 no WebKit mobile**; a matriz de entitlements passou **3/3 em Chromium
mobile**, com validação também da página “Meu plano” quando um recurso está
bloqueado; portal e confirmações passaram **8/8**. Isolamos a matriz de
entitlements do WebKit headless porque traces de tentativas anteriores
confirmaram crash do processo de rede do próprio WebKit em deep-links
sequenciais. A configuração E2E principal bloqueia Service Worker; offline/PWA
continua na configuração dedicada. Storage completou a matriz de seis perfis,
cross-tenant (403), MIME, URL assinada, cotas e oito disputas concorrentes,
com limpeza confirmada.
`npm test` passou **833/833** em 64 arquivos, typecheck app/node passou e ESLint
encerrou com **0 erros e 17 avisos preexistentes**. As tentativas intermediárias
foram depuradas pelos traces; a execução final terminou verde, não se contando
as repetições como pontos extras.

O smoke externo anônimo continua bloqueado: o host `chatgpt.site` responde
**401** e `cativapp.lovable.app/planos` responde **404**. O preview autenticado
embutido no editor Lovable está acessível para leitura, mas aponta para o SHA
antigo `621968e1`; ele não contém as mudanças locais nem equivale a uma versão
publicada para clientes. Não fizemos login no Cativa, escrita, push ou deploy
remoto. O índice de cobertura do plano permanece **102,6/110 (93,3%)**; isso
mede execução do plano, não prontidão de release.

## Revalidação visual e dos gates locais com Node suportado — 2026-10-04

Na inspeção somente-leitura da prévia Lovable antiga, `/`, `/planos` e
`/auth/login` carregaram. O rodapé ainda apontava “Falar com Especialista” para
um telefone placeholder; retirei esse destino fictício, mantendo o e-mail de
contato já publicado, e acrescentei
`src/components/marketing/layout/PremiumFooter.test.tsx` para impedir regressão.
O preview remoto não foi alterado e continuará exibindo a versão antiga até
uma entrega autorizada.

As ferramentas do shell padrão estavam em Node 20.20.2, abaixo do mínimo 22 do
projeto. Repeti os gates com Node 24.19.0 empacotado: Vitest **834/834 em 65
arquivos**, typecheck app/node aprovado, ESLint com **0 erros e os mesmos 17
avisos Fast Refresh**, e `test:build:missing-env` aprovado. Um build de produção
local, configurado deliberadamente para loopback com chave sintética e escrito
em diretório temporário, compilou **3.264 módulos** e gerou 138 entradas PWA.

Instalei Deno **2.9.7**, a versão fixada no workflow, somente em `/tmp`. O
`deno check --no-config supabase/functions/*/index.ts` passou para as seis
Edge Functions e `deno lint --no-config supabase/functions` verificou oito
arquivos sem erro.

Depois da correção de contato, a matriz visual pública passou **300/300** em
Chromium/Firefox/WebKit, com rotas públicas, fronteiras responsivas e reflow
200%/400%; a matriz de segurança/acessibilidade passou **66/66**, contraste
WCAG AA **21/21** e Core Web Vitals do bundle local **18/18**. Neste último gate,
CLS ficou em zero e não houve imagens quebradas. Backend 503, fontes e hosts
externos foram simulados, então estes resultados continuam sendo QA local,
não medição de tráfego real.

Consulta somente-leitura ao GitHub confirmou que o CI mais recente segue no SHA
`621968e15b35c7c39dc044b6d5b99412a1ad9744`: Vitest e integridade do backend
passaram; regressão visual autenticada e provisão de usuários QA falharam.
Nenhuma Action foi disparada nesta rodada porque o checkout atual contém
alterações ainda não enviadas. A baseline `Agenda → Confirmações` permanece
`root:root` e exige a revisão/ação de permissões registrada acima. Variáveis de
produção, credencial Jev, QA remoto autorizado e dispositivos/provedores reais
continuam indisponíveis. Não houve novo crédito por repetir gates: o índice
permanece **92,6% base + 10/10 extraordinários = 102,6/110 (93,3%)**.

## Confirmação final dos gates públicos em runtime suportado — 2026-10-04

Repeti no Node 24.19.0 os três gates de navegador que haviam sido executados
anteriormente com Node abaixo do mínimo do projeto. A matriz pública de
responsividade/reflow terminou **300/300** (Chromium, Firefox e WebKit; desktop,
tablet, mobile e orientação paisagem), segurança/acessibilidade/geométrica
**66/66** (incluindo login e recuperação com erros simulados) e contraste WCAG
AA **21/21**. Nenhuma falha foi reportada nesses três conjuntos. São testes
reproduzíveis contra o build local com backend substituído por alvos inválidos
controlados; não simulam tráfego nem autenticação de cliente em produção.

As duas URLs públicas foram consultadas por HTTPS com validação TLS: o domínio
`chatgpt.site` respondeu **401** sem redirecionamento e
`cativapp.lovable.app/planos` respondeu **404** sem redirecionamento. Portanto
não foi possível executar jornada externa autenticada ou validar a versão
candidata com usuários reais. A consulta de somente leitura ao GitHub ainda
mostra como execução mais recente o CI de 26/09/2026 no SHA antigo
`621968e15b35c7c39dc044b6d5b99412a1ad9744`: unitários e integridade do backend
passaram; regressão visual autenticada falhou e a provisão de QA falhou,
fazendo com que as jornadas autenticadas e multi-tenant fossem ignoradas.

Não publiquei, não alterei serviços remotos, não disparei Actions e não enviei
o checkout. Para release/teste com clientes ainda é necessário ter um host
público autorizado respondendo corretamente, configuração e acesso ao projeto
Supabase de QA, execução verde no SHA candidato e revisão humana da baseline
visual `Agenda → Confirmações` protegida por propriedade `root:root`. Os gates
locais aprovados nesta rodada não aumentam o índice por repetição; ele segue
**102,6/110 (93,3%)**, que é completude do plano de testes, não aprovação de
release.

## Revalidação do schema e regressões SQL locais — 2026-10-04

Conferi o destino pelo `project_id`, nome dos containers Docker, portas loopback
56201/56202 e resposta HTTP local antes de executar SQL. A instância descartável
`cativa-qa-local-20261002` estava íntegra, mas seu histórico parava em
`20261003120000`; o checkout contém a migration nova
`20261004130000_atomic_catalog_mutations.sql`. Apliquei-a com transação única,
registrei a versão somente no histórico desse banco local e validei as funções e
permissões pela regressão correspondente.

Com `E2E_LOCAL_SUPABASE=true`, `E2E_QA_PROJECT_REF=local` e allowlist exatamente
`local`, a suíte agregada terminou **17/17 regressões SQL aprovadas, 0 falhas e
0 ignoradas**. Cobriu RLS/IDOR, Realtime, Storage/cotas, CRM/media, notas,
agenda/referências, portal, catálogo, unidades/admin, auditoria, quota Jev,
histórico de scans, assinatura atômica, onboarding atômico e mutações atômicas
de catálogo. O JUnit integral ficou em
`/tmp/cativa-sql-regressions-node24.xml`; os dados de fixture do caso de
catálogo foram verificados ausentes depois do `ROLLBACK`.

O recálculo de cobertura global com Vitest **834/834 em 65 arquivos** mostrou
23,64% statements, 22,97% branches, 18,01% funções e 23,73% linhas; o quadro
acima foi atualizado sem alterar a nota por repetição. O teste live/drift do
Jev continua pendente porque `TYPESAFE_API_KEY` não está configurada neste
ambiente. Não houve chamadas ao provedor, Actions, escrita remota, push ou
publicação. A frente RLS continua em 99% enquanto faltarem a validação no QA
remoto autorizado e o CI do SHA candidato; o índice auditável continua
**102,6/110 (93,3%)**.

## Reexecução local solicitada para entrega — 2026-10-04

Após a solicitação de testes reais, repeti a matriz pública de layout/reflow:
**300/300 passaram em 13,3 min**, cobrindo 15 configurações de navegador e
viewport, dez rotas públicas, limites de breakpoint e reflow 200%/400%. Nenhum
baseline foi alterado. Na aplicação compilada local e autenticada contra o QA
descartável, executei a checagem geométrica do BottomNav em WebKit: **14/14**
combinações passaram (7 rotas × 390×844 e 320×568), com quatro alvos presentes e
sem sobreposição acima de 10%. Uma execução preliminar reutilizando a mesma
página sofreu uma navegação interrompida na lista de espera; isolando cada rota
em uma página nova, a rota passou nos dois viewports e a repetição completa
terminou verde. Isso foi uma corrida do harness de diagnóstico, não uma falha
confirmada do produto.

Também passaram nesta rodada os gates já contabilizados: **36/36** capturas
autenticadas de rota e **4/4** transições de navegação. O cenário Agenda →
Confirmações concluiu as asserções de overflow, BottomNav e safe-area, mas a
comparação de screenshot continua falhando contra uma referência antiga
(35% de pixels): o PNG esperado ainda tem máscaras magenta nos campos; a captura
atual mostra o formulário sem essas máscaras. A imagem é legível e os controles
ficam alcançáveis pela área rolável; não encontrei evidência de defeito funcional
na tela. Mantive o baseline protegido (`root:root`) intacto; sua atualização
continua exigindo revisão/ação autorizada.

O smoke HTTPS somente-leitura confirmou novamente `cativapp.lovable.app` em
**404** (raiz e `/planos`) e `cativa-gestao-clientes.belson91.chatgpt.site` em
**401** (raiz e `/planos`). Portanto, não há uma prévia pública autorizada onde
executar login E2E ou validar release com clientes. A varredura local de
conteúdo atual não encontrou segredos, mas a varredura histórica identificou
uma credencial secreta Supabase antiga no histórico Git, repetida em dois
scripts. O proprietário confirmou que fará a rotação no painel; até confirmação
da revogação e revisão dos secrets de CI/Edge, isso permanece bloqueador de
segurança. Não tentei rotacionar nem alterar qualquer serviço remoto.

As execuções desta rodada são revalidações, sem crédito duplicado. Mantém-se
**102,6/110 (93,3%) de completude do plano**, não prontidão de release. Não
houve login em produção, alteração remota, dispatch de Actions, push ou deploy.
O checkout segue com **316 entradas modificadas ou não rastreadas**; elas foram
preservadas e não devem ser publicadas em bloco sem separar/revisar o SHA
candidato.

## Correção mobile do dialog de confirmações — 2026-10-04

Na inspeção em WebKit, o dialog de confirmação tinha controles de toque entre
38 e 40 CSS px, abaixo dos 44 px definidos pelo próprio plano. A aba Status
também excedia a largura interna em cerca de 9 px no viewport de 320 px: o
botão “Pediu reagendar” não cabia na coluna da grade. Corrigi os alvos do
dialog, tabs, seletores e fechar para mínimo de 44×44 px; campos de horário
também passaram a 44 px, e a linha de checkbox oferece uma área clicável de 44
px sem ampliar visualmente o quadrado. A grade de Status fica em coluna única
abaixo de 340 px, duas colunas em celulares maiores e três no breakpoint `sm`.

Ampliei `e2e/visual/agenda-to-confirmation.spec.ts`: percorre as cinco abas e
falha se qualquer alvo visível ficar abaixo de 44×44 px (com tolerância de
0,5 px para arredondamento subpixel), se houver overflow interno inesperado ou
se o último controle não puder ser alcançado dentro do dialog/safe-area. O
script `test:visual:auth:critical` agora executa essa jornada também em iPhone
SE e Android 360, além do iPhone 14.

Validação no bundle de produção local, com conta sintética autenticada contra o
Supabase descartável: **30/30 estados passaram** (seis viewports: 320×568,
360×800, 375×667, 390×844, 768×1024 e 1024×768; cinco abas por viewport).
Todas as rotas mantiveram os alvos, safe-area e alcance do conteúdo, sem
overflow horizontal inesperado. Também passaram **834/834** Vitest em 65
arquivos, os **43/43** testes de contrato visual focados, typecheck, build de
produção com 3.264 módulos/138 entradas PWA, lint focado e `git diff --check`;
lint completo terminou com zero erros e os mesmos 17 avisos Fast Refresh já
conhecidos. O diagnóstico não alterou dados de negócio.

A spec Playwright oficial do fluxo também passou **2/2** no bundle local, em
iPhone SE e no projeto Android 360. Para tornar a execução reprodutível sem
sobrescrever uma sessão local, o helper de autenticação e a configuração de
preview agora leem o mesmo `E2E_STORAGE_STATE_PATH` do setup global.

O baseline antigo da captura Agenda → Confirmações permanece sem atualização:
ele ainda contém máscaras magenta e precisa da revisão/ação autorizada já
registrada. As revalidações não concedem crédito duplicado; o índice fica em
**102,6/110 (93,3%)**. CI no SHA de entrega, rotação/revisão de secrets,
baseline, preview público acessível e aceites externos/físicos continuam
pendentes; nenhuma alteração remota foi feita.

## Alvos de toque dos dialogs móveis — 2026-10-04

Ampliei o contrato dos dialogs para que botões/fechar, comboboxes, campos e
links recebam pelo menos 44×44 CSS px em celulares. O switch mantém a trilha
visual de 44×24 px, mas tem hit area real de 44×44 px. Em Agenda, os switches
agora expõem nome e descrição acessíveis; a regressão também alterna
“Encaixe / overbooking” nas duas direções e verifica a entrada/remoção do campo
de horário manual.

A `dialog-overflow.spec.ts` verifica geometria dos alvos além do tamanho do
modal. No bundle isolado de produção, autenticado contra o Supabase QA local,
Agenda, Clientes e Ações na fila passaram **6/6** em iPhone SE e Android 360;
a jornada Agenda → Confirmações passou **2/2** nesses dois perfis. A suíte
Vitest completa terminou **834/834** (65 arquivos); typecheck, lint focado nos
arquivos alterados, build de produção em diretório temporário com Node 24
(3.264 módulos/138 entradas PWA) e `git diff --check` também passaram.

A execução em iPhone 14 percorreu os checks geométricos e de safe-area, mas a
comparação de screenshot ainda reprova contra o baseline antigo (máscaras
magenta e estado de rolagem/formulário diferentes). Mantive o baseline intacto
para revisão, sem atualizar snapshots automaticamente. Esta correção fecha um
gap de cobertura já incluído na frente de layout; não somo pontos duplicados.
Completude permanece **102,6/110 (93,3%)**; CI atualizado, referência visual
revisada, rotação de credencial histórica e demais gates externos continuam
pendentes.

## Viewport 320 px integrado ao gate crítico — 2026-10-04

Incluí o projeto `mobile-320-portrait` (320×568, Chromium touch) tanto na
configuração padrão quanto na de preview, limitado deliberadamente às specs de
dialogs e Agenda → Confirmações para não exigir snapshots de rotas ainda sem
baseline nesse perfil. O gate crítico agora inclui a jornada em 320 px e os
três dialogs em 320, 360 e 375 px.

Ao executar com o runner padrão encontrei que o `global-setup` substituía por
um storage vazio uma sessão autenticada explicitamente indicada por
`E2E_STORAGE_STATE_PATH` quando faltavam credenciais de login. Corrigi para
preservar o arquivo fornecido e falhar com diagnóstico se ele contiver JSON
inválido; a sessão temporária foi preservada nos testes sem consultar Auth
remoto.

Evidências no bundle local: **9/9** dialogs (Agenda, Clientes e Confirmações em
320/360/375 px) e **1/1** jornada Agenda → Confirmações em 320 px passaram no
runner padrão; junto dos **2/2** em iPhone SE e Android 360 previamente
reexecutados, a jornada ficou verde nos três viewports mobile. Typecheck, lint
focado das alterações, validação JSON do `package.json` e `git diff --check`
também passaram. Nenhum baseline foi atualizado ou escrito no Supabase. A
cobertura está no escopo já contabilizado de layout/E2E, então a nota fica em
**102,6/110 (93,3%)**; continuam faltando confirmação de CI, QA remoto,
baseline visual revisada e validações externas/dispositivos físicos.

## Contraste WCAG no viewport mínimo — 2026-10-04

Ampliei `test:a11y:contrast` para incluir o projeto 320×568 sem criar snapshots
de rota. Uma primeira execução achou 11/12 casos: o portal não pôde preparar a
identidade porque o login sintético de cliente não estava no ambiente daquele
processo. Provisionei perfis fictícios somente no Supabase QA local descartável,
mantive as credenciais em memória/arquivo temporário protegido e removi esse
arquivo após a execução; não usei Auth remoto.

Com o cliente vinculado provisionado, repeti a matriz no runner Playwright
padrão: **48/48 testes passaram** em iPhone SE, Android 360, 320×568 e iPad,
cobrindo sete rotas públicas no tema claro e cinco rotas autenticadas em tema
claro/escuro (68 análises Axe no total). Nenhuma violação séria/crítica foi
reportada. Typecheck, lint focado, validação do JSON do `package.json` e
`git diff --check` passaram no estado final. O relatório HTML está em
`e2e/.report-a11y-320-full/index.html`; os diagnósticos JSON ficam no diretório
de artefatos correspondente.

Não alterei snapshots nem sistemas remotos. Este gate fecha mais cobertura
local de contraste, mas não substitui leitor de tela/dispositivo físico, a
revisão visual humana do baseline antigo, CI no SHA candidato ou QA remoto; a
nota auditável continua **102,6/110 (93,3%)**.

## Proteção dos estados autenticados e artefatos Playwright — 2026-10-04

Uma revisão de permissões encontrou o `storageState` local com modo `0664` e
artefatos de teste recém-gerados com permissões de grupo amplas. O estado de
autenticação contém tokens de sessão, e traces/relatórios podem registrar dados
da página; corrigi o harness para aplicar `0600` a cada estado gravado ou
preservado, antes até da validação do JSON, e `0700` ao diretório `.auth`.
Também incluí um helper privado importado por todas as configurações Playwright
para que arquivos e pastas futuros sejam criados com `umask 0077` em POSIX.

O token temporário usado na verificação foi removido. Os relatórios/evidências
locais foram preservados, agora sem leitura/escrita por grupo ou outros
usuários. Dois diretórios antigos de relatório, pertencentes a `root`, não
puderam ser ajustados sem elevar privilégios e foram deixados intactos; não
continham o estado de sessão removido. Esta correção de segurança não aumenta
a nota de cobertura: **102,6/110 (93,3%)** permanece, com CI candidato, revisão
humana do baseline, rotação remota da chave histórica e aceites externos ainda
pendentes.

## Rodada local de aceite ampliado — 2026-10-04

Concluí uma rodada integrada contra o Supabase QA descartável local (sem
conexão ao projeto remoto), além de gates de navegador com serviços externos
simulados. Resultados por frente:

- **SQL/RLS/IDOR:** 17/17 regressões passaram, incluindo escopo multi-tenant,
  storage, agenda, portal, auditoria, Jev quota e mutações atômicas.
- **Segurança pública:** 66/66 passaram (contraste/acessibilidade, layout,
  sanitização de conteúdo e recuperação simulada para HTTP 401/503).
- **Reflow WCAG:** 150/150 passaram em Chromium, Firefox e WebKit, com zoom de
  200/400%, espaçamento de texto, breakpoints e layouts mobile/tablet.
- **E2E com perfis fictícios locais:** RBAC 12/12; convite 1/1; QA autenticado
  17/17; jornadas estendidas 18/18, entitlements 3/3, portal/autoatendimento
  8/8 e prontidão de onboarding/planos/exportação 4/4.
- **Armazenamento:** matriz de proprietário, gerente, recepção, profissional,
  cliente e outro tenant passou; upload cross-tenant foi negado; URL assinada,
  limites de quota, concorrência, tipos MIME e limpeza foram verificados.
- **Agenda/resiliência:** disputas concorrentes de 25/50/100 requisições
  produziram exatamente uma reserva válida por horário. No soak local de 60 s,
  passaram 1.804 lotes/14.432 requisições; a matriz multi-tenant reportou zero
  vazamentos. Leituras e mutações ficaram abaixo dos limites p95 configurados.
- **PWA/offline:** 8/8 cenários passaram, incluindo soak de 5 min (10/10
  checkpoints), falhas 429/503/transporte, replay único e restauração de
  conexão/realtime.
- **Layout autenticado:** 36/36 rotas/casos passaram após atualizar três
  baselines legítimos da área de Confirmações (hit areas acessíveis de 44 px).
  Os nove dialogs mobile já cobertos anteriormente também continuam verdes.
- **Core Web Vitals:** 18/18 cenários passaram no build de produção isolado,
  em nove viewports (mobile, landscape, tablet e desktop) nas rotas landing e
  planos. LCP, CLS e interação
  respeitaram os budgets (LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms); backend
  respondeu com falha simulada e hosts de terceiros foram substituídos por
  fixtures, portanto estes números não representam telemetria de produção.
- **Regressão de código:** suíte Vitest 834/834 aprovada na rodada anterior;
  nesta rodada typecheck, ESLint direcionado, `node --check` do gerador de
  storage state e `git diff --check` passaram.

O cenário visual Agenda → Confirmações passou em três viewports mobile. O
quarto baseline (iPhone 14) está desatualizado e pertence a `root`; a tentativa
de atualizá-lo foi corretamente bloqueada por permissão (`EACCES`). Não alterei
permissões privilegiadas nem o baseline. Para liberá-lo, o proprietário da
máquina deve transferir a propriedade apenas do diretório
`e2e/__screenshots__/visual/agenda-to-confirmation.spec.ts` para o usuário de
desenvolvimento e então repetir a atualização/revisão visual.

Esta rodada amplia evidências locais, mas não fecha os gates que dependem de
ação ou infraestrutura externa: rotação da chave histórica no Supabase (o
usuário informou que fará a rotação; ainda não foi confirmada), CI no SHA
candidato, inspeção do baseline bloqueado, QA remoto permitido, provedores
OAuth/push/WhatsApp e dispositivos físicos. Não executei ações GitHub, deploy,
checkout ou mutações no Supabase remoto. Como os novos resultados são
reexecuções e evidências dentro das frentes já pontuadas, a completude permanece
**102,6/110 (93,3%)**, com 7,4 pontos até o teto do plano.

Como smoke externo somente de leitura, abri o domínio publicado
`cativa-gestao-clientes.belson91.chatgpt.site`; ele respondeu com uma tela de
login do ChatGPT antes de expor a aplicação. Não tentei autenticar nem contornar
essa barreira, portanto as rotas publicadas continuam sem validação visual ou
funcional autenticada.

## Cobertura unitária dos domínios Portal e Catálogo de planos — 2026-10-04

A cobertura global identificou `src/domain/portal.ts` e
`src/domain/plan-catalog.ts` com 0% de cobertura unitária. Adicionei 35 casos
determinísticos para fronteiras de política de cancelamento, horários passados,
presentes e futuros, estados visíveis no portal, nomes, moeda BRL, unicidade de
features e limites de plano. A execução integral passou **869/869 testes em 67
arquivos**. Os dois módulos agora têm 100% de statements, branches, funções e
linhas. A suíte TypeScript e o lint direcionado passaram; o lint global terminou
com zero erros e os mesmos 17 avisos Fast Refresh já registrados.

O teste de timestamp inválido reproduziu um defeito concreto: o cálculo anterior
produzia `NaN` horas e indicava a taxa configurada como devida. A regra agora
falha de forma segura, sem permitir a decisão automática e sem exibir multa
quando a data não pode ser interpretada. A cobertura global passou a 23,82%
statements, 23,20% branches, 18,18% funções e 23,91% linhas; o relatório V8
completo desta execução foi escrito isoladamente em
`/tmp/cativa-coverage-tQF7z3`. Esta melhoria aumenta evidência e reduz risco, mas
não resolve o benchmark de drift Jev nem substitui QA/CI remoto; não atribuo
crédito duplicado e mantenho o índice em **102,6/110 (93,3%)**.

## Proteção do payload cliente → Edge Function Jev — 2026-10-04

A skill TypeSafe AI e a documentação viva atual foram consultadas para confirmar
as formas atuais de Choice/Score (distribuição e confiança) e Noul (probabilidade
sem campo de confiança separado), mantendo aritmética e decisão determinística
no código. Não executei chamadas ao modelo. A revisão do adaptador encontrou
que, embora a assinatura TypeScript só declare tenant e cliente, um objeto maior
estruturalmente compatível poderia encaminhar e-mail, telefone ou notas para a
Edge Function. A chamada agora constrói explicitamente o corpo mínimo com
`tenantId` e `clientId`.

Cinco testes locais mockados cobrem o contrato da invocação, filtragem de PII
extra, validação Zod da resposta, propagação do erro e fallback sem mensagem.
Os módulos `retentionAdvisor.ts`, `domain/portal.ts` e `domain/plan-catalog.ts`
ficaram todos com 100% statements, branches, funções e linhas. A suíte integral
passou **874/874 em 68 arquivos**; typecheck e lint direcionado passaram. Os
harnesses locais de manifesto, retry de provisionamento, chave de storage, JUnit
SQL e guarda de alvos passaram **19/19**; `actionlint` no container do digest
fixado pelo CI passou em leitura somente. O build isolado de produção também
passou com URL/chave placeholder e saída em `/tmp` (3.264 módulos, 138 entradas
de precache), sem tocar no `dist` local ou conectar aos serviços. O lint global
permanece com zero erros e 17 avisos Fast Refresh conhecidos. Cobertura global:
23,84% statements, 23,24% branches, 18,21% funções e 23,94% linhas.

A melhoria não valida drift de respostas ao vivo nem substitui credencial
rotacionada, QA autorizado ou execução do Actions no SHA candidato. Não somo
reexecuções ao índice: permanece **102,6/110 (93,3%)**.

Referências TypeSafe: [API HTTP](https://docs.typesafe.ai/api),
[Confidence](https://docs.typesafe.ai/confidence),
[Choice](https://docs.typesafe.ai/primitives/choice),
[Score](https://docs.typesafe.ai/primitives/score),
[Noul](https://docs.typesafe.ai/primitives/noul),
[limitações conhecidas do Jev 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

## Hardening unitário do agendamento pelo portal — 2026-10-04

O serviço `src/services/portal/booking.ts` estava sem cobertura unitária própria
e possui a última barreira cliente antes das RPCs seguras. Acrescentei **32
casos mockados** para criação, reagendamento, cancelamento, confirmação,
notificação secundária, leitura de política, limites de slots, antecedência,
timezone e falhas de repositório/RPC. Os casos não acessam banco, Auth, push ou
provedores externos.

Os testes reproduziram entradas temporais/dados inválidos que podiam chegar à
consulta ou produzir `Invalid time value`: data impossível, hora impossível,
timezone malformado, duração zero/negativa/fracionária/NaN e antecedência
negativa/NaN/infinita. O serviço agora rejeita essas entradas antes de consultar
slots ou chamar RPC, com mensagens de domínio; data/hora ISO válida continua
aceita, o limite de correspondência de slot permanece estritamente abaixo de
60 segundos e cancelamento/reagendamento/confirmação continuam delegados às
funções server-side. Falha do aviso push segue secundária e não desfaz uma
confirmação já aprovada.

A matriz final passou **906/906 testes em 69 arquivos**. `booking.ts` chegou a
100% em statements, branches, funções e linhas; também permanecem 100% os outros
três módulos listados acima. Typecheck, ESLint dos arquivos afetados, `git diff
--check` e build de produção isolado passaram; o build transformou 3.264 módulos
e gerou 138 entradas PWA sem substituir o `dist` existente. A cobertura global
subiu para 24,29% statements, 23,73% branches, 18,45% funções e 24,41% linhas.
Não alterei baselines, Auth, GitHub, Lovable ou Supabase remoto. A pontuação não
muda por reexecuções: **102,6/110 (93,3%)**. A verificação final do checkout
encontrou **329 entradas** na branch `main` (195 arquivos rastreados modificados
e 134 não rastreados); não fiz staging, commit, push nem deploy. Esse conjunto
precisa ser selecionado e revisado antes de preparar um SHA candidato.

### Pendência de produto descoberta no autoagendamento

O fluxo `PortalBooking` não envia preço; `PortalServiceOption` também não lê o
preço do catálogo, e `createBookingFromPortal` deixa o valor opcional no padrão
zero. A função `create_appointment_atomic` grava os parâmetros recebidos tanto
em `appointments.total_price_cents` quanto em `appointment_items.price_cents`,
sem recalcular o valor do serviço. Portanto, reservas feitas pelo portal podem
ficar registradas como R$ 0 e distorcer ticket/receita futura. Não alterei essa
regra financeira: é preciso decidir se o portal deve congelar o preço do serviço
no momento da reserva ou se o valor só é definido posteriormente pela equipe.
Até essa confirmação e a regressão correspondente, o aceite financeiro do
portal permanece pendente.

## Bateria integrada local de concorrência, layout e portal — 2026-10-04

Validei novamente a instância cativa-qa-local-20261002 por workdir, nome dos
containers e portas loopback. Todos os testes com escrita usaram tenants,
usuários, objetos e agendamentos sintéticos; não houve chamada a Supabase
remoto, Actions, publicação ou alteração de baselines.

- **Perfis e Storage:** 8/8 autenticações sintéticas passaram (super_admin,
  owner A, manager, frontdesk, professional, client, owner B e convidado).
  A matriz real de Storage passou para seis papéis/contextos, incluindo
  isolamento cross-tenant HTTP 403, signed URL/download, cota e overwrite,
  oito disputas simultâneas, allowlist MIME e limites de logo. O helper
  confirmou a limpeza de objetos e fixtures.
- **Concorrência:** a bateria base passou 2/2 (três testes opt-in aparecem como
  skips esperados nesse gate); nas rajadas de 25/50/100 requisições houve uma
  reserva aceita por lote, zero double-booking e p95 de 83/53/94 ms. O soak
  completo de 10 minutos passou com 12.537 lotes, 100.296 tentativas,
  12.537 reservas aceitas, 87.759 conflitos de exclusão esperados, p95 máximo
  de 30 ms, mediana de 10 ms e cleanupFailure nulo.
- **Tráfego misto e isolamento:** 10 rodadas misturaram 250 escritas com 120
  leituras; p95 de leitura 57,3 ms, máximo 82,5 ms, p95 máximo de mutação
  77 ms. A execução multi-tenant usou owner e recepção no tenant A e owner no
  tenant B: 250 escritas, 50 leituras, zero vazamentos, p95 de leitura
  31,5 ms e p95 de mutação 38 ms. Ambos os JUnit registraram zero falhas.
- **Visual e acessibilidade:** o gate público concluiu 300/300 casos em 15
  combinações Chromium/Firefox/WebKit, incluindo desktop, tablet, landscape,
  mobile, breakpoints, teclado/foco, reflow e espaçamento WCAG 200%/400%.
  Não houve falhas geométricas ou de foco e nenhuma baseline foi atualizada.
- **Contraste:** 21/21 verificações WCAG AA no tema claro passaram novamente em
  desktop Chromium, tablet WebKit e 320×568 Chromium. JUnit:
  /tmp/cativa-a11y-contrast.9cSZRb.
- **Recuperação de planos:** o fault-injection HTTP 503 passou 3/3 em desktop
  Chromium, tablet WebKit e mobile Chromium. O fallback permaneceu legível,
  não exibiu [object Object], respeitou alvo de toque 44×44 e o retry carregou
  o catálogo sintético. JUnit: /tmp/cativa-pricing-recovery-run.YNYjQr.
- **Portal de cliente:** o autoagendamento passou em 1/1 contra o build de
  produção gerado em diretório temporário; serviço, profissional, slot,
  persistência do agendamento e escopo do tenant foram confirmados. O teste e
  o harness removeram a reserva, contas e objetos sintéticos ao final.
- **Smoke publicado somente de leitura:** a URL chatgpt.site respondeu HTTP
  401 sem redirecionamento (barreira de login) e cativapp.lovable.app/planos
  respondeu HTTP 404 sem redirecionamento. Não tentei autenticar nem contornar
  a barreira; o host publicado não permite aceite funcional nesta rodada.

Para evitar que as reexecuções substituam evidências anteriores, os quatro
scripts de backend agora aceitam diretórios de JUnit/HTML independentes por
variáveis PW_BACKEND_*_OUTPUT_DIR e PW_BACKEND_*_REPORT_DIR. O runner Storage
local também falha cedo com mensagem clara quando Node <22 é usado (a versão
declarada pelo projeto); a bateria foi executada em Node 24.19.0. O build do
portal e seu preview ficaram isolados em /tmp e não alteraram o dist existente.
Evidências desta execução: /tmp/cativa-backend-matrix.vB93ux;
/tmp/cativa-public-layout.EANGhB; /tmp/cativa-portal-production.mejFPh.

Essas execuções reforçam gates já contabilizados, sem somar crédito por
repetição. A completude auditável permanece **102,6/110 (93,3%)**. Para uma
versão candidata ainda faltam, entre outros: confirmar a rotação da chave
histórica no Supabase (o usuário informou que fará a rotação), executar e
revisar CI no SHA candidato, QA remoto explicitamente autorizado, revisão do
baseline iPhone 14 protegido por root, e aceite em provedores/dispositivos
reais. A regra de preço do autoagendamento também aguarda decisão de produto.

## Revalidação local de aceite e contraste autenticado — 2026-10-04

Na sequência, executei a matriz Axe/WCAG de rotas autenticadas contra o Vite e
Supabase descartável local, com login real de conta sintética provisionada pelo
Auth local. **15/15 cenários Playwright passaram**: cinco rotas (`/app`, agenda,
clientes, confirmações e portal) em iPhone SE, Android 360 e iPad; cada cenário
varreu temas claro e escuro (30 análises de rota/tema no total), sem violações
WCAG críticas ou sérias. A bateria Storage repetiu os **8/8 logins sintéticos**,
seis contextos de papel/tenant e as verificações reais de upload/download,
isolamento HTTP 403, cota concorrente e MIME. O cleanup removeu o objeto e as
fixtures desta execução. Artefatos Playwright: `/tmp/cativa-auth-a11y.sYUD7Q`.

A revalidação independente passou **906/906 unitários**, typecheck, lint
completo (0 erros; 17 avisos Fast Refresh conhecidos), **19/19** testes de
harness/evidência/segurança, verificação do build sem ambiente e `npm audit
--omit=dev` (zero vulnerabilidades de runtime). O build de produção sem alvo
foi bloqueado como esperado e o modo local usou somente loopback. `git diff
--check` também passou.

O smoke HTTPS público, sem login nem tentativas de contornar a proteção,
continua sem destino de aceite: `chatgpt.site` respondeu HTTP 401 e
`cativapp.lovable.app/planos` HTTP 404. Jev real, QA remoto e Actions no SHA
candidato não foram executados: a chave Jev não está configurada nesta sessão,
o usuário informou que fará a rotação da credencial histórica Supabase (ainda
sem confirmação de conclusão), o checkout permanece na branch `main` com 329
entradas locais alteradas e não há SHA limpo selecionado para CI. Também não
foram feitas escritas remotas, dispatch do Actions, commit, push ou deploy.

Esses resultados confirmam testes locais integrados, não aceite por clientes
reais. Não alteram a pontuação por repetirem gates existentes: permanece
**102,6/110 (93,3%)**. A candidata ainda não está liberada para usuários reais
até resolver os gates remotos, a credencial, a decisão financeira do preço do
autoagendamento, a revisão da baseline protegida por root e a acessibilidade do
destino de preview/publicação.

## Jornadas autenticadas, RBAC e PWA offline — 2026-10-04

Ampliei os runners locais para produzir builds/relatórios sob `/tmp` e nunca
apagar ou substituir o `dist` compartilhado do checkout. As jornadas de dev
usam somente Vite em loopback; as jornadas de preview recebem `--outDir`
temporário e encerram o servidor ao final. O `dist` permaneceu com a mesma
propriedade e timestamp anterior à execução, e o runner removeu as contas,
tenants e objetos sintéticos ao terminar.

No Supabase QA descartável local, passaram **71/71 jornadas E2E funcionais**:

- **18/18** fluxos por papel, onboarding, estados de assinatura/trial e UX; **3/3**
  planos/entitlements; **8/8** confirmação, reserva e autosserviço do portal.
- **17/17** smoke autenticado, shell, RPC/auditoria, limite de clientes, CRM com
  upload, importação/exportação, portal e troca de tenant/unidade. JUnit:
  `/tmp/cativa-authenticated-qa.W3okex/artifacts/junit.xml`.
- **13/13** testes RBAC para owner, manager, frontdesk, professional, client e
  super-admin (rotas e leitura de CRM), além do convite/aceite de equipe. JUnit:
  `/tmp/cativa-rbac-invite.H3VkJz/artifacts/junit.xml`.
- **4/4** checks Go-Live, incluindo restauração do nome do estabelecimento.
- **8/8** testes PWA/offline, incluindo soak real de cinco minutos: 10/10
  checkpoints sem PATCH ou mudança no banco enquanto offline; após reconexão,
  exatamente uma sincronização, sem duplicação. JUnit:
  `/tmp/cativa-offline-soak.ytJLfG/artifacts/junit.xml`.

Os **15/15** contrastes Axe/WCAG autenticados (30 varreduras claro/escuro)
registrados na seção anterior também passaram. As cinco rodadas com escrita
repetiram a matriz Storage de seis contextos de papel/tenant e terminaram com
cleanup bem-sucedido. Artefatos adicionais: `/tmp/cativa-extended-e2e.gSmkym`
e `/tmp/cativa-go-live-e2e.oXdgBD`.

Esses resultados aumentam a evidência E2E local, mas não completam testes de
provedores reais, dispositivos físicos, QA remoto ou CI no SHA de entrega. Não
altero o índice por somar reexecuções/cobertura sobreposta: **102,6/110
(93,3%)**. A autorização de publicar no GitHub/Lovable só será usada depois de
selecionar e revisar as 329 entradas locais, confirmar a rotação histórica da
credencial, decidir a regra de preço do autoagendamento e validar a candidata
em CI/QA e no destino acessível.

### Geometria mobile autenticada e dialogs

A matriz visual adicional passou **29/29** checks em iPhone SE, Android 360 e,
para dialogs estreitos, 320×568: dialogs de novo agendamento, novo cliente e
ações da Central de Confirmação caberam na viewport, sem overflow, com alvos de
toque mínimos; o BottomNav foi verificado em sete rotas nas duas larguras de
telefone e não encobriu ações; Axe passou nas rotas login, acesso ao portal e
app autenticado nos dois primeiros viewports. O contraste continua sendo
avaliado pelo gate claro/escuro separado. Relatórios e capturas anexadas:
`/tmp/cativa-auth-layout-e2e.7aNdeJ`. Nenhum snapshot foi atualizado e os testes
que dependem da baseline protegida por root continuam intocados.

Para fechar a lacuna de evidência do runner principal, `playwright.config.ts`
agora também produz JUnit em `${PW_OUTPUT_DIR}/junit.xml` por padrão e aceita
um destino privado explícito em `PW_JUNIT_FILE`. Typecheck e lint focado
passaram; o checklist Go-Live foi reexecutado **4/4** e o JUnit confirmou zero
falhas/skips em `/tmp/cativa-go-live-junit.SLaPeY/artifacts/junit.xml`.

## Matriz visual autenticada ampliada — 2026-10-04

A matriz de geometria de rotas autenticadas concluiu **180/180 cenários** sem
falhas, skips ou erros (JUnit: `/tmp/cativa-auth-layout-full.D0Ev0S/artifacts/junit.xml`).
Foram exercitadas 12 rotas do app e do portal em 15 projetos: Chromium desktop,
Firefox desktop, notebook, larguras 767/768/1023/1024/1279/1280, tablet portrait
com WebKit e tablet landscape, mobile 320, 360 com WebKit, 390 e landscape com
WebKit. O gate verifica geometria e overflow, navegação por teclado/foco,
rolagem e dialogs quando disponíveis; não atualiza snapshots.

A matriz visual autenticada específica da fila de espera também passou **15/15**
nos mesmos projetos (JUnit: `/tmp/cativa-waitlist-layout.YBM5J6/artifacts/junit.xml`).
Em seguida, a bateria de Storage local descartável concluiu novamente: upload,
overwrite, download, remoção, MIME, limites concorrentes e isolamento em seis
contextos sintéticos; acesso cruzado ao outro tenant foi recusado com HTTP 403 e
o objeto de teste foi removido. A limpeza automática finalizou com sucesso.

`git diff --check` passou, e a propriedade e o timestamp do `dist` permaneceram
inalterados; build e artefatos visuais ficaram isolados em `/tmp`. Essa matriz
reforça frentes visuais já pontuadas, sem crédito duplicado. A nota permanece
**102,6/110 (93,3%)**. Continuam pendentes os gates externos e a revisão humana
da baseline protegida, descritos acima; estes testes locais não equivalem a
aceite em aparelhos físicos nem a autorização para liberar a candidata a
clientes reais.

## Correção da vitrine de planos e trial — 2026-10-04

Na inspeção visual somente-leitura do preview do projeto no Lovable, a rota
`/planos` carregava sem o erro antigo de conexão, mas o plano Começo era
apresentado como “Sob consulta”. A fonte de produto (`drizzle/migrations/0030`
e a migration Supabase de onboarding) define Começo como R$ 0 durante 30 dias,
seguido de modo somente consulta; Solo, Equipe e Rede têm avaliação de 14 dias.
Também identifiquei que o fallback de indisponibilidade ainda mostrava planos
legados Apoio/Empreendedor/Studio e a tela Assinatura prometia “Apoio gratuito
para sempre”.

Corrigi a regra visual: preço zero com trial finito aparece como grátis com o
prazo explícito; “Sob consulta” fica reservado a ciclo `custom`. O fallback
agora contém Começo, Solo, Equipe e Rede, seus preços/características e trials
da migration atual, em quatro colunas responsivas. FAQ, hero e tela Assinatura
deixaram de contradizer esses prazos; o card de assinatura exibe a duração real
do plano.

O teste de recuperação agora comprova falha 503, exibição do fallback atual,
ausência de `[object Object]`, retry bem-sucedido e um plano sintético de R$ 0
com 30 dias sem a etiqueta errada “Sob consulta”. **3/3** passaram em Chromium
desktop, WebKit tablet e Chromium mobile, com checagem de overflow horizontal;
as respostas foram mockadas e nenhum serviço externo recebeu gravação. JUnit:
`/tmp/cativa-pricing-fix-final.9QnlGa/artifacts/junit.xml`. Typecheck e ESLint
focado passaram. A visualização manual local também mostrou os quatro cards e
o estado de fallback legíveis, sem erro serializado. A matriz de snapshots de
marketing foi atualizada e revisada na rodada seguinte, sem tocar na baseline
protegida de Agenda→Confirmações.

O `git diff --check` continua sendo o gate final desta rodada. A correção fecha
uma inconsistência concreta, mas não remove os bloqueios de QA/CI remoto,
rotação da credencial, acesso ao preview público ou revisão humana que ainda
impedem declarar a candidata pronta para clientes. Não há crédito duplicado:
**102,6/110 (93,3%)**.

## Estabilidade das capturas de marketing — 2026-10-04

Na revisão das capturas, o cabeçalho fixo e a CTA inferior pareciam deixar
texto passar por trás. A inspeção em Chromium confirmou `background-color`
branco opaco e `opacity: 1` nos dois elementos; parte do efeito vinha do
conteúdo que cruza a borda do viewport, e parte de capturas feitas durante as
animações `whileInView`. A asserção visual agora verifica a cor calculada nos
estados rolados e preserva a checagem geométrica de que a CTA não cobre o link
social do rodapé.

Ajustei o helper de captura para esperar 1,3 s após posicionar cada viewport,
deixando as animações do conteúdo visível assentarem antes do snapshot. Uma
primeira abordagem que varria a página inteira em passos pequenos excedeu o
limite de 30 s em páginas longas; foi substituída por navegação direta à região
sob revisão e estabilização local, evitando o timeout sem relaxar as
asserções. A matriz passou **15/15** em iPhone 14 retrato/paisagem, iPhone SE,
Android 360 e iPad, cobrindo landing, planos e login; JUnit:
`/tmp/cativa-marketing-reveal-fixed.pe7uNT/artifacts/junit.xml`. A repetição
sem `--update-snapshots` passou também **15/15**, com zero falhas, skips ou
erros (JUnit: `/tmp/cativa-marketing-verify.7sSzRC/artifacts/junit.xml`). A
suíte unitária terminou **906/906**; typecheck, ESLint focado e verificação de
whitespace passaram. O `dist` permaneceu inalterado. As capturas revisadas
continuam isoladas das baselines protegidas.

Essa rodada melhora a confiabilidade da evidência visual, não acrescenta
crédito duplicado: **102,6/110 (93,3%)**. Os gates remotos e a revisão humana
continuam pendentes.

Revalidei os destinos públicos por GET sem autenticação: o domínio
`cativa-gestao-clientes.belson91.chatgpt.site` respondeu **401** e
`cativapp.lovable.app/planos` respondeu **404**. Não tentei contornar a proteção
nem fiz escrita remota; esses destinos ainda não permitem um E2E público de
aceite.

## Reflow, contraste e compilação de produção — 2026-10-04

Na verificação WCAG de reflow de `/planos` com zoom de 200% e 400%, viewport de
320 px, foi reproduzido overflow horizontal (documento com 325/326 px) e o selo
animado “Mais escolhido” perdia a centralização. Corrigi a grade móvel para uma
coluna explícita, impedi a expansão mínima dos cards e separei o elemento
animado do elemento que centraliza o selo, removendo a colisão entre transforms.
Após a correção, os **15/15** casos da matriz de reflow passaram. Os snapshots de
marketing de `/planos` foram atualizados apenas onde necessário e a repetição
sem atualização passou **5/5**. O gate de contraste passou **21/21** nas sete
rotas públicas e, isoladamente, **3/3** em `/planos` após o ajuste.

Reexecução local desta rodada: Vitest **906/906** (69 arquivos), typecheck
completo, ESLint **0 erros e 17 avisos** já conhecidos de Fast Refresh e
`git diff --check` passaram. A compilação de produção passou em diretório
temporário, transformou 3.264 módulos e gerou precache PWA de 138 arquivos;
foram usadas apenas variáveis dummy de build, sem serviços reais, e o `dist`
compartilhado permaneceu intacto. O diagnóstico de cobertura atual foi
Statements 24,29%, Branches 23,72%, Functions 18,45% e Lines 24,41%; é uma
medição de cobertura do código, não evidência suficiente para aumentar a nota
de conclusão e não concede crédito adicional.

A nota continua **102,6/110 (93,3%)**, sem crédito duplicado. Estes são testes
locais e com serviços isolados/mockados, não um aceite real da versão publicada.
Os previews verificados continuam sem acesso público (401/404); ainda faltam
execução autorizada após a rotação da credencial exposta, acesso válido de QA
remoto/Actions, revisão humana das baselines protegidas e decisão de produto
sobre o preço gravado em agendamentos autenticados do portal. Nenhuma gravação
remota, execução de GitHub Actions ou publicação foi feita nesta rodada.

## Revalidação em runtime suportado — 2026-10-04

A execução padrão do shell estava usando Node.js **20.20.2**, incompatível com o
contrato do projeto; `npm run check:node` falhou corretamente antes de qualquer
build. Não aceitei como evidência final a matriz que, por engano, foi iniciada
nesse runtime. Localizei o Node.js empacotado **24.19.0**, e `check:node`
passou. Com ele, a matriz pública completa passou **300/300**, com zero
falhas, erros ou skips, em 15 projetos/10 rotas, Chromium, Firefox e WebKit,
breakpoints, tablet, mobile, paisagem e reflow/espaçamento WCAG a 200%/400%.
JUnit: `/tmp/cativa-public-layout-node24.zpmet5/artifacts/junit.xml`.

No mesmo runtime, repetiram-se Vitest **906/906** (69 arquivos), typecheck,
ESLint completo (**0 erros, 17 avisos Fast Refresh**) e build isolado (**3.264
módulos**, precache PWA de 138 entradas). A auditoria Vitest V8 em diretório
temporário confirmou 24,29% statements, 23,72% branches, 18,45% funções e
24,41% linhas; `npm audit --omit=dev` encontrou zero vulnerabilidades. O
`dist` compartilhado manteve proprietário e timestamp; nenhum snapshot foi
alterado por essa matriz.

A confirmação de status do GitHub foi tentada em modo somente leitura, mas a
conexão do app respondeu que precisa de reautenticação; portanto, o estado atual
do Actions não pôde ser consultado. Não houve disparo de workflow, push ou
publicação. A leitura `git ls-remote` confirmou que `origin/main` ainda aponta
para `621968e15b35c7c39dc044b6d5b99412a1ad9744`, o mesmo HEAD local; as 331
alterações do checkout continuam apenas locais e não foram empacotadas/enviadas.

O audit completo atualizado reporta oito vulnerabilidades altas somente na
árvore de desenvolvimento e zero na árvore de runtime. `npm audit fix
--dry-run` não reduziu as oito ocorrências; os hashes de `package.json` e
`package-lock.json` antes/depois foram idênticos. Sem uma atualização compatível
e verificada, não apliquei downgrade/upgrade major nem mexi no lockfile.

Também passaram **19/19** testes Node auxiliares dos manifests de evidência,
retry de fixtures, chave de Storage, emissão JUnit e guarda de alvo de segurança.
O teste de build sem variáveis passou seus três cenários: build de produção
bloqueado sem Supabase explícito, build isolado apontando só para `.invalid` e
fallback de desenvolvimento limitado a loopback. Todos rodaram sem segredos e
sem alterações no `dist` compartilhado.

Essa revalidação não altera a pontuação: **92,6% da base + 10/10 extras =
102,6/110 (93,3%)**. Seguem pendentes os gates externos, a rotação confirmada
da credencial histórica e a decisão sobre preço do portal.

## Integrações simuladas e segurança pública — 2026-10-04

Com Node.js 24.19.0, os contratos OAuth simulados passaram **9/9** em Chromium,
Firefox e WebKit: início Google/Apple e callback sintético, sem credenciais de
provedor. A suíte de erros de autenticação passou **9/9** nos mesmos motores,
incluindo credenciais inválidas, recuperação de senha e rate limit. O gate
completo público passou **66/66**: WCAG 2.2 AA em sete rotas/3 larguras,
geometria/foco, validação de conteúdo de tenant contra XSS e esquemas de URL
executáveis, e recuperação de `/planos` diante de 503. Os JUnits confirmam zero
falhas, skips ou erros: `/tmp/cativa-auth-integrations.R3g8Aa/oauth-artifacts/junit.xml`,
`/tmp/cativa-auth-integrations.R3g8Aa/auth-artifacts/junit.xml` e
`/tmp/cativa-auth-integrations.R3g8Aa/security-artifacts/junit.xml`.

Core Web Vitals passou **18/18** no bundle de produção temporário, em landing e
planos, nove perfis desktop/tablet/mobile/paisagem. As medições usaram somente
backend 503 e provedores externos simulados em `.invalid`, verificando os
orçamentos definidos de LCP, CLS, INP e estabilidade de imagens; não são métricas
de campo. JUnit: `/tmp/cativa-auth-integrations.R3g8Aa/cwv-artifacts/junit.xml`.

Os 102 casos foram exercitados no código local e isolado, sem contas de clientes
ou escritas remotas. São evidências adicionais/recorrentes, não pontos novos: o
índice segue **102,6/110 (93,3%)**. OAuth real, QA remoto/Actions e telemetria de
campo ainda dependem de credenciais/acesso; não houve publicação nesta fase.

## Jornadas locais autenticadas e PWA offline — 2026-10-04

No Supabase QA descartável `127.0.0.1:56201` (DB loopback `56202`), com guardas
de alvo estritas, fixtures novas e sintéticas e build em diretório temporário,
passaram o agendamento pelo portal **1/1**, a Central de Confirmação **2/2** e
as jornadas de autoatendimento **5/5**. Os testes validaram gravação no tenant
correto, cancelamento, reagendamento, confirmação via RPC, bloqueio de UPDATE
direto do cliente, limites e isolamento entre clientes. A confirmação passou
novamente depois de fortalecer a limpeza; auditoria por marcador encontrou zero
agendamentos e zero clientes `e2e_local_confirmation` remanescentes.

A matriz offline identificou uma diferença de harness importante: o guard do
app desabilitava Service Worker em todo host loopback, inclusive no build de QA
de produção. Acrescentei o opt-in `VITE_E2E_ENABLE_LOCAL_PWA=true`, condicionado
a `import.meta.env.PROD` e `localhost`/loopback; sem a variável, dev e previews
mantêm o comportamento anterior. O teste PWA foi então executado pela
configuração dedicada `playwright.pwa.config.ts` em Chromium móvel: **8/8**, zero
skips/falhas/erros, incluindo 10/10 checkpoints durante cinco minutos offline,
retorno de conexão, retry 503/429/transporte, Realtime, janela de validade de
24 horas e limpeza auditada com zero agendamentos/clientes de fixture restantes.
JUnit sanitizado: `/tmp/cativa-pwa-chromium-evidence-Bxt7Vt/junit.xml`.

Também endureci `local-confirmation-center.spec.ts`: a limpeza agora confirma a
ausência do agendamento, fila, itens, histórico e cliente antes de passar; a
limpeza de fixtures antigas só remove clientes de origem E2E no tenant local
esperado. A auditoria encontrou e removeu exatamente dois agendamentos e dois
clientes históricos identificados por marcador E2E e tenant QA; após a remoção,
os dois casos da Central repetiram **2/2** e o marcador global permaneceu em
zero. JUnit: `/tmp/cativa-confirm-cleanup-evidence-WB0Fq4/junit.xml`.

Limitação explicitamente preservada: no projeto WebKit emulado no Linux, após
permitir o registro local do Service Worker, `page.reload()` com a rede desligada
retornou `WebKit encountered an internal error` nos três casos que recarregam
offline. Isso não foi contado como sucesso WebKit; o fluxo PWA completo passou
no motor Chromium móvel previsto pelo config dedicado. Aceite final de Safari
continua dependente de iPhone/iPad físico ou device farm.

Após as alterações, `npm run typecheck`, ESLint completo (**0 erros; 17 avisos
Fast Refresh já existentes**) e Vitest **906/906** passaram. O build PWA usou
saída isolada; `dist` compartilhado, GitHub, Supabase remoto e Lovable não
foram alterados. A chave
histórica continua pendente de rotação confirmada pelo usuário, e o preço salvo
em agendamentos autenticados ainda requer decisão de produto; por isso não
executei testes em produção nem publiquei.

Não atribuo pontos duplicados por reexecução/maior evidência de gates já
contabilizados: **102,6/110 (93,3%)**. Esse é o avanço do plano de testes, não
prontidão para clientes reais.

## Jornadas E2E ampliadas e revisão visual do onboarding — 2026-10-04

No QA descartável local, repeti a suíte ampliada com identidades e tenants
sintéticos temporários. Os fluxos de papéis, assinatura, trial, feature flags e
UX passaram **17/17**; entitlements de plano passaram **3/3**. O onboarding
transacional passou **5/5** em iPhone 14, iPhone SE, Android 360, mobile 320×568
e iPad. Cada projeto executa em viewport fixa, cria uma conta exclusiva, valida
RPC HTTP 200, tenant/catálogo resultantes e remove usuário e tenant de teste.

A tentativa inicial no iPhone SE identificou o texto do CTA final cortado na
largura de 320 px; também revelou que redimensionar o mesmo contexto após o
signup tornava a posição de toque instável. O botão agora permite quebra de
linha, mantém a seta e o texto dentro da área clicável, e o teste verifica seus
limites geométricos antes do toque. Os viewports passaram a ser projetos
independentes, e o projeto 320 px inclui agora o fluxo de onboarding. Após a
correção, todas as cinco jornadas completaram a chamada ao servidor e a limpeza.

A regressão visual autenticada, sem modo de atualização, passou **67/67**:
36 rotas principais em iPhone 14/iPhone SE/Android 360, 4 cenários de
navegação/offline, 4 transições Agenda → Confirmações nas larguras móveis, 9
dialogs e 14 rotas/configurações do BottomNav. A primeira execução comparou o
modal de confirmação com uma baseline antiga, que mostrava o diálogo rolado e
campos ocultados em magenta; revisei a captura no topo, atualizei apenas esse
PNG e a comparação normal passou nos quatro viewports. O PNG original foi
preservado em `e2e/__screenshots__/visual/.agenda-to-confirmation-baseline-20261004/`
como backup local não rastreado; por ser `root:root`, sua movimentação para fora
da árvore de snapshots foi recusada pelo ambiente.

Também passaram **8/8** casos de confirmação e autosserviço do portal em preview
de produção isolado. A verificação real do Storage local repetiu a matriz de
owner, manager, frontdesk, professional, client e owner do tenant B: isolamento
cross-tenant, URL assinada/download, MIME, limites e oito disputas concorrentes
de cota passaram; o objeto de teste foi removido. Build de produção temporário,
Vitest **906/906**, typecheck, `git diff --check` e ESLint completo passaram; o
lint mantém **0 erros e 17 avisos Fast Refresh preexistentes**.

Não houve escrita em Supabase remoto, GitHub Actions, GitHub ou Lovable, nem
uso de contas/dados de clientes. A chave histórica exposta continua aguardando
confirmação de que o usuário concluiu sua rotação. Nova execução de CI no SHA
candidato, QA remoto, OAuth/provedores reais, device farm/aparelhos físicos e
aceite humano final seguem pendentes. Como os gates repetidos não recebem
crédito duplicado, a completude permanece **102,6/110 (93,3% da meta)**; ainda
não é liberação para clientes reais.

## Revalidação Jev e situação da rotação — 2026-10-04

Os testes locais de contrato HTTP do Jev e da lógica de retenção passaram
**91/91** (`src/test/jev-client.test.ts` e
`src/test/retention-intelligence.test.ts`). `git diff --check` também passou.
O smoke que faria uma chamada real de baixo volume foi deliberadamente
interrompido antes da rede: `TYPESAFE_API_KEY` não está configurada neste
ambiente. Não reutilizei uma credencial do histórico nem a chave do Supabase;
são segredos distintos. O usuário informou que fará a rotação no painel do
Supabase, mas ainda não confirmou a conclusão. Não fiz mutações remotas, nem
disparei Actions ou publiquei alterações.

Não há crédito adicional por esses testes de contrato já cobertos; a nota fica
em **102,6/110 (93,3%)**. O smoke real Jev continua pendente até haver uma
credencial válida configurada com segurança no ambiente apropriado, e a
validação remota permanece bloqueada até a confirmação da rotação e do acesso
de QA autorizado.

## Matriz geométrica autenticada em todos os viewports — 2026-10-04

No mesmo Supabase QA descartável em loopback, o harness provisionou perfis e
tenants sintéticos exclusivos, validou os logins e executou as 12 rotas
autenticadas do app/portal em 15 projetos de browser e viewport: desktop
Chromium/Firefox, notebook, breakpoints 767/768, 1023/1024 e 1279/1280, iPad
portrait/WebKit, tablet landscape, mobile 320/360/390 e mobile landscape. O
contrato geométrico, teclado/foco, rolagem e dialogs terminou **180/180**, sem
falhas ou skips; JUnit: `/tmp/cativa-authenticated-layout.1q7jhg/artifacts/junit.xml`.

O gate seguinte de Storage passou nos seis contextos sintéticos (owner,
manager, frontdesk, professional, client e tenant B): negação cross-tenant
HTTP 403, URL assinada/download, MIME, quota e disputas concorrentes; os
objetos, contas e tenants criados pelo harness foram limpos antes do encerramento.
Uma consulta somente leitura posterior no alvo loopback contou **0 tenants e 0
contas Auth** com o sufixo exclusivo desta execução, confirmando a limpeza dos
fixtures; o harness confirmou a remoção do objeto temporário de Storage.
Todo o ciclo foi restrito a `127.0.0.1:56201`; não houve escritas remotas,
publicação ou atualização do GitHub. É evidência nova de execução, mas não
substitui QA remoto, CI no SHA candidato, dispositivos físicos/device farm ou
os aceites reais externos. Portanto, não altera o índice: **102,6/110 (93,3%)**.

## Redimensionamento durante formulário modal — 2026-10-04

Fechei uma lacuna distinta da matriz estática: o formulário autenticado de novo
cliente agora permanece aberto durante sete mudanças sucessivas entre desktop,
notebook, tablet portrait, mobile landscape, mobile 390/320 px e desktop baixo.
Em cada etapa o E2E valida caixa do diálogo, ausência de overflow, foco preso ao
modal, persistência do valor digitado, ação final dentro da tela, alvos móveis
de pelo menos 44×44 px e permanência na mesma rota; termina com `Escape`, sem
salvar dados. Foram **15/15** casos, um por projeto Chromium/Firefox/WebKit e
viewport; JUnit: `/tmp/cativa-authenticated-layout-resize.VJl4hN/artifacts/junit.xml`.

Lint focado, typecheck completo e `git diff --check` passaram. O Storage repetiu
ao fim o gate nos seis contextos sintéticos; a auditoria posterior contou zero
tenant e zero conta Auth do run. Essa cobertura de reflow autenticado é nova,
mas não pontua como dispositivo físico nem como aceitação externa; o índice
permanece **102,6/110 (93,3%)**.

## Migrations limpas e gates locais nas versões fixadas pela CI — 2026-10-04

Reproduzi o ambiente de banco em um projeto Supabase temporário e isolado, com
CLI **2.119.0**, igual à versão fixada no workflow. A configuração de produção
de testes agora declara `[db.seed] enabled = false`: não há `supabase/seed.sql`,
e CI cria fixtures sintéticas explicitamente após recriar o schema. `db reset`
aplicou as **88 migrations** sem avisos de seed; `supabase db lint --local
--fail-on warning` terminou com **nenhum erro ou aviso de schema**.

O lint encontrou `v_price_id` como aparentemente não lida na RPC
`catalog_update_service_with_price`. A tentativa inicial de remover o
`RETURNING ... INTO` fez a regressão de preço duplicado falhar (**16/17**),
confirmando que a atribuição também aplicava a proteção automática de
cardinalidade do PL/pgSQL (`P0003`). Restaurei o retorno e passei a usar o UUID
retornado para decidir quando inserir o preço padrão. No banco limpo, lint e
regressões passaram juntos: **17/17**, incluindo rollback atômico diante de
preços padrão duplicados. JUnit:
`/tmp/cativa-migration-repo-config.1WwDBZ/artifacts/sql-regressions-verified-junit.xml`.

Sob **Node 22.22.3**, `check:node`, Vitest (**906/906 em 69 arquivos**),
typecheck e ESLint passaram; ESLint manteve os **17 avisos Fast Refresh já
conhecidos, sem erros**. Cobertura: 24,29% statements, 23,71% branches, 18,45%
funções e 24,41% linhas. O teste de build verificou as três condições: falha
segura sem configuração, build isolado apontando para alvo `.invalid` e
fallback de desenvolvimento restrito a loopback. `npm audit --omit=dev`
reportou zero vulnerabilidades.

O `npm audit` completo ainda lista oito entradas altas, mas elas convergem para
uma única falha de negação de serviço na dependência `braces` da cadeia de
build (Tailwind 3 / `chokidar` / `micromatch` / `fast-glob`), em pacotes de
desenvolvimento. A advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/ghsa-vfj7-8cjw-p6xm)
marca afetadas as versões até `3.0.3` e ainda não registra versão corrigida;
na conferência ao npm registry, `3.0.3` continua sendo a última versão estável
publicada. Não forcei downgrade de plugin nem `override` especulativo. O audit
do conjunto de dependências de runtime permanece limpo; remover os alertas
restantes exige correção upstream ou migração deliberada do toolchain, seguida
de regressão visual completa.

Também executei os cinco testes Node independentes usados pelos gates da
pipeline: manifesto de evidências (**3/3**), retries de provisionamento (**7/7**),
chave de Storage (**4/4**), guard do alvo do security rescan (**3/3**) e contrato
JUnit SQL (**2/2**), totalizando **19/19**, sem skips. Não existem arquivos de
teste `Deno.test` nas Edge Functions; seus contratos/lógica permanecem cobertos
pelos testes Vitest específicos já registrados acima, além dos gates Deno de
tipos e lint.

Como o Deno não estava instalado, baixei **Deno 2.9.7** em `/tmp`, validei o
SHA-256 oficial e executei `deno check --no-config` e `deno lint --no-config`:
**8/8 Edge Functions passaram** nos dois gates. As duas pilhas Supabase
temporárias foram paradas após a execução; relatórios e logs sanitizados
permanecem em `/tmp/cativa-migration-repo-config.1WwDBZ/`. Não consultei nem
alterei Supabase remoto, GitHub Actions, GitHub ou publicação. A correção e os
retestes fecham evidência local, mas são reexecuções de gates já pontuados; o
índice continua **102,6/110 (93,3%)**. Permanecem necessários QA remoto/Actions
no SHA candidato, confirmação da rotação feita pelo usuário, smoke Jev com
credencial válida configurada com segurança, aceites reais de provedores e
revisão em dispositivos físicos.

## PWA offline em WebKit e soak com reconexão — 2026-10-04

No Supabase local descartável, executei a suíte móvel WebKit sob Node 22.22.3.
Os sete fluxos funcionais passaram **7/7** (JUnit:
`/tmp/cativa-migration-repo-config.1WwDBZ/webkit-pwa-final-functional-artifacts/junit.xml`):
fila sem PII, HTTP 503, HTTP 429/`Retry-After`, falhas de transporte, repetição
de sincronização, atualização Realtime por segunda sessão, reload do snapshot
offline e recusa após expiração de 24 horas. Typecheck, ESLint focado e
`git diff --check` passaram após a alteração do harness.

O soak de cinco minutos passou **1/1**, com dez checkpoints a cada 30 segundos
(`/tmp/cativa-migration-repo-config.1WwDBZ/webkit-pwa-soak-final-artifacts/junit.xml`):
a fila permaneceu persistida, nenhum `PATCH` foi enviado e o status no banco
continuou `pending` durante o período; após reload pelo Service Worker, a
reconexão sincronizou exatamente um `PATCH`, confirmou o agendamento e esvaziou
a fila. Uma execução anterior completou os checkpoints, mas mostrou que o
reload final ainda usava o modo offline nativo e falhava no WebKit; corrigi o
harness e repeti o soak com sucesso.

Há uma limitação conhecida: o Playwright/WebKit pode abortar uma navegação mesmo
quando o Service Worker deveria responder offline ([issue upstream
#42775](https://github.com/microsoft/playwright/issues/42775)). Para esses
reloads, mantive o transporte do motor ativo, fiz a aplicação receber
`navigator.onLine=false`, bloqueei chamadas cross-origin e pausei apenas o
preview Vite descartável; na reconexão, restaurei fetch/rota e validei a
sincronização contra o Supabase local. Isso testa o comportamento do app e do
cache do Service Worker, mas não equivale a desligar a rede de um iPhone físico.
A pilha Supabase temporária e seus volumes foram removidos; a instância QA
local compartilhada permaneceu intacta. Não consultei nem alterei Supabase
remoto, GitHub Actions ou publicação.

Esta rodada acrescenta evidência WebKit e corrige o harness; não conta os mesmos
gates de offline/soak duas vezes. O índice permanece **102,6/110 (93,3%)**.
Continuam pendentes QA remoto, nova execução Actions no SHA candidato,
confirmação da rotação de chave, credencial real do Jev, provedores externos e
validação em aparelhos físicos.

## Rodada ampliada de aceite local — 2026-10-04

Executei a trilha de CI que pode rodar sem acesso remoto, com build de produção
em diretório temporário, Supabase **2.119.0** isolado em loopback e tenants,
contas, clientes, convites, horários e mídias inteiramente sintéticos. Não usei
dados de clientes nem escrevi no Supabase remoto, GitHub, Actions ou hospedagem.

| Área | Resultado |
| --- | --- |
| Vitest | **906/906**, 69 arquivos |
| SQL/RLS/IDOR/migrations | **18/18**, incluindo o guard de alvo |
| Storage por perfil/tenant | **21 verificações OK**; dois avisos apenas por `.env` opcionais ausentes |
| RBAC e isolamento | **12/12** perfis/rotas/RLS; tenant A × B **1/1** |
| Operação e portal | confirmação **2/2**, matriz confirmação **10/10**, booking **1/1**, self-service **5/5**, CRM/mídia **2/2**, convite **1/1**, limites **2/2**, import/export **3/3**, checklist Go-Live **4/4**, logout **7/7** |
| Agenda concorrente | **5/5**; 25/50/100 tentativas aceitaram exatamente uma reserva por horário; soak de 60 s completou 1.927 lotes e 15.416 requisições sem violação |
| PWA offline | Chromium **7/7** e WebKit **7/7**; o caso opt-in de soak aparece como um skip explícito em cada execução |
| Layout/acessibilidade | layout público **300/300**, layout autenticado **65/65**, contraste público **21/21**, contraste autenticado light/dark **20/20**, segurança pública **66/66** |
| Contratos e performance | auth errors **9/9**, OAuth sintético **9/9**, Core Web Vitals **18/18** |
| Segurança de banco | rescan local com persistência desligada: **0 achados críticos, 0 avisos não aceitos** |
| Ferramentas/build | typecheck, lint (0 erros; 17 avisos Fast Refresh já existentes), build isolado sem env e `npm audit --omit=dev` (0 vulnerabilidades) passaram |
| Edge Functions | Deno 2.9.7: `deno check` e `deno lint` passaram |

Também tornei o encerramento dos Supabase efêmeros não interativo (`--yes`)
nos jobs de CI e soak, evitando que a limpeza dependa de prompt; `actionlint`
e `git diff --check` passaram após a alteração.

Os 27 arquivos JUnit da rodada somam **597 casos: 595 passaram, 2 skips
explícitos e 0 falhas** (os 18 SQL estão incluídos). Além disso, passaram os
906 unitários e as 21 verificações independentes de Storage.

Os 18 testes de performance usaram fixtures locais e falhas 503 simuladas para
o backend; não representam RUM nem uma medição de produção. Nesse runner local,
LCP ficou entre 224 e 1.684 ms, CLS foi 0 em todos os casos, INP entre 16 e 64
ms, FCP entre 224 e 892 ms, sem imagens quebradas. Não extrapolo esses números
para rede/dispositivos reais.

Uma primeira execução da matriz RBAC encontrou uma corrida ao esperar o diálogo
de assinatura do super-admin com o timeout padrão de 5 s. A tela abriu na
reprodução isolada; aumentei a espera do teste para 15 s e repeti a matriz
completa: **12/12**, sem falhas. Não foi necessária alteração da lógica da
assinatura. Os relatórios JUnit e o rescan sanitizado estão em
`/tmp/cativa-webkit-ci.ZkHEOW/`; removi a fixture de sessão e o trace da primeira
falha, pois traces podem conter tokens locais.

A chamada real do Jev permaneceu sem execução: `TYPESAFE_API_KEY` não está no
ambiente e não reutilizei segredo do histórico nem o inseri em comandos. O
usuário confirmou que rotacionou a chave Supabase exposta. O preflight posterior
encontrou este checkout sem `.env.local`/`.env`, URL/chave Supabase e credenciais
QA; por isso não fez login remoto. Um GET público sem chave também não recebeu
resposta HTTP: o DNS retornou `ENOTFOUND`. Não houve escrita remota. CI em SHA
candidato, QA remoto acessível, Google/Apple/Push/WhatsApp em sandbox real,
device farm/aparelhos físicos e revisão humana seguem necessários antes de
abrir para clientes reais. Estes resultados locais não substituem esses gates;
a completude continua **102,6/110 (93,3%)**.

## Cobertura unitária de templates de confirmação — 2026-10-04

A auditoria com Vitest foi repetida após cobrir a renderização das mensagens:
**911/911 testes em 70 arquivos**, cobertura global de **24,44% statements,
23,91% branches, 18,62% funções e 24,54% linhas**. O serviço
`src/services/confirmation/renderTemplate.ts` ficou em **100% statements,
branches, funções e linhas**. A cobertura inclui nomes com espaços, campos
opcionais, placeholders ausentes, data válida e timestamp inválido. Corrigi
esse último caso para nunca inserir o texto literal `Invalid Date` na mensagem
que o operador revisa; o envio continua exclusivamente manual. Typecheck,
ESLint focado e todos os thresholds seletivos de cobertura passaram.

A mesma inspeção identificou uma lacuna funcional ainda sem correção: o
`queueGenerator.ts` carrega as opções `hours_before_appointment`, filtros VIP,
alto risco e protocolo, valor mínimo e `skip_if_already_confirmed`, mas a geração
não as aplica. A UI permite configurá-las, então a fila pode divergir do que o
gestor selecionou. A semântica de combinação dos filtros (AND/OR), a associação
de protocolo via `appointment_items` e o momento de materializar/mostrar tarefas
agendadas não estão documentados. Não alterei essas regras sem contrato
inequívoco; este é um item de produto e um alvo prioritário para a próxima fase,
com teste caracterizador antes de implementar o comportamento aprovado.

## Recuperação de planos e disponibilidade de smoke remoto — 2026-10-04

A trilha isolada de recuperação dos planos passou **3/3** em desktop Chromium,
tablet WebKit e mobile Chromium. Ela injeta HTTP 503 e restaura o catálogo com
fixtures sintéticas, sem acessar o Supabase externo.

A rotação da chave está confirmada pelo usuário, mas o smoke remoto e o aceite
autenticado seguem sem evidência por falta de configuração E2E local e porque o
ambiente não resolveu o DNS do endpoint. A chave antiga não foi reutilizada e
nenhum segredo foi gravado no repositório ou na conversa.

## Importação de dados e recuperação de falhas parciais — 2026-10-04

Após a correção de associação por ID e do teste de fronteira entre lotes, a
suíte integral terminou com **931/931 testes em 71 arquivos**. A cobertura global é **25,26% statements, 25,04%
branches, 19,13% funções e 25,37% linhas**. Em
`src/services/import-export/importers.ts`, a cobertura focada chegou a
**97,56% statements, 85,18% branches, 100% funções e 99,04% linhas**, com 20
casos cobrindo lotes, mapeamento, associação de preço por ID retornado,
respostas parciais, erros de leitura/escrita, valores inválidos e importação
de agenda/equipe/pacotes.

Essa inspeção encontrou e corrigiu dois riscos: falhas ao gravar o preço eram
ignoradas, e uma consulta posterior por nome podia associar o preço à linha
errada quando já existia serviço homônimo. Agora a importação usa o ID retornado
no mesmo INSERT, relata falhas parciais e não associa preço quando a resposta
não confirma um ID ou quando nomes repetidos no lote tornam a relação ambígua.
Os testes são totalmente mockados; nenhuma mutação de banco foi feita.
`npm run typecheck`, lint focado, `npm run lint` (0 erros e 17 avisos
Fast Refresh preexistentes), build seguro em diretórios temporários, auditoria
runtime (`npm audit --omit=dev`: 0 vulnerabilidades), suíte integral e
`git diff --check` passaram.

## Regras da fila e repetição das jornadas locais — 2026-10-04

O item histórico acima sobre filtros ainda não aplicados foi resolvido: os
parâmetros configurados para janela até o atendimento, VIP, alto risco,
protocolo, valor mínimo e clientes já confirmados agora são considerados pela
geração da fila; os filtros ativos são combinados de forma cumulativa (AND), e
ações com horário futuro não aparecem como executáveis antes do momento
programado. A suíte focada de fila passou 23/23 casos; `queueRules.ts` atingiu
100% statements, branches, funções e linhas. O registro histórico foi mantido
para preservar a sequência da auditoria.

Com fixtures somente sintéticas no Supabase local descartável, passaram nesta
rodada: **26/26** testes da matriz RBAC/multi-tenant em iPhone e iPad, incluindo
os seis papéis e tentativas cross-tenant; **18/18** jornadas de reserva,
cancelamento, reagendamento e portal em mobile/tablet; **16/16** verificações
de shell, autenticação, auditoria, CRM/mídia, limites, importação/exportação e
troca de tenant/unidade; e **10/10** confirmações em viewports mobile/tablet.
Além disso, a regressão pública passou **300/300** combinações de rota e
viewport, a auditoria pública de contraste WCAG AA passou **21/21**, e os gates
SQL locais passaram **18/18** após incluir uma regressão específica para o
merge canônico de planos. Uma falha transitória interna do WebKit foi
reproduzida durante a matriz de papéis; o teste passou a repetir uma vez apenas
esse erro específico e, após a correção de posicionamento/rolagem do controle,
a matriz integral terminou verde em nova execução. Isso não mascara erros de
aplicação nem falhas repetidas do navegador.

A suíte unitária atual terminou em **952/952** testes em 73 arquivos. Typecheck,
lint integral e `git diff --check` passaram; o lint mantém 17 avisos conhecidos
de Fast Refresh, sem erros. Nenhum teste desta rodada escreveu no Supabase
remoto ou publicou alterações. A pontuação-base passa a **92,7%** (média de
dez frentes); incluindo os dez pontos de extensão já conquistados, o índice é
**102,7/110, equivalente a 93,4%** do objetivo estendido.

Esse resultado ainda não é autorização de publicação para clientes reais: a
execução CI no SHA candidato e os testes autenticados no QA remoto continuam
pendentes, assim como credenciais reais do Jev e de provedores externos,
validação em dispositivos físicos/device farm e revisão humana integral das
baselines visuais.

## Segurança da linha do tempo de migrations — 2026-10-04

A análise pré-PR detectou que `20260505013200_fix_dup_apoio.sql` usa UUIDs
históricos fixos: em um reset limpo, esses IDs não removem todos os planos
`Apoio` e a constraint de nome único falha antes da próxima migration. Mantive
as atualizações históricas dessa migration e tornei condicional somente a
criação da constraint quando ainda há nomes duplicados. A migration aditiva
`20261004140000_reconcile_duplicate_plan_names.sql` então consolida as linhas
remanescentes, também cobrindo bancos que já registraram o timestamp antigo.

Validei a sequência completa com `supabase@2.119.0 db reset --local` no Supabase
descartável. Todas as migrations aplicaram, incluindo a nova. Em seguida,
**18/18 regressões SQL passaram** e os **17/17 testes E2E autenticados** passaram
com perfis e tenants sintéticos: shell, autorização de auditoria, limites,
CRM/mídia, importação/exportação, portal e troca de tenant/unidade. Nenhuma
escrita foi feita em Supabase remoto.

Adicionei a regressão transacional `plan-name-deduplication-regression.sql`:
ela cria dois planos fictícios de mesmo nome, verifica que a seleção canônica
preserva features conflitantes e combina features não conflitantes, redireciona
assinatura e histórico e restaura a constraint; termina em `ROLLBACK`. O teste
foi incluído na suíte local; os **18 SQL gates** passaram após o reset limpo. A
PR continua sendo o próximo gate para validar o SHA candidato no GitHub Actions
e confirmar as proteções para QA remoto antes de considerar publicação no
Lovable.

## Reauditoria do GitHub Actions — 2026-10-04

Consulta somente leitura ao GitHub confirmou que o `origin/main` continua no
commit `621968e15b35c7c39dc044b6d5b99412a1ad9744`; o run CI mais recente desse
SHA é o `36257353238` e concluiu em falha. Os jobs que falharam foram
`playwright-mobile` e `qa-authenticated`: oito comparações de screenshots
autenticados divergiram da baseline versionada (inclusive diferenças de altura
em dashboard/clientes) e o provisionamento de perfis recebeu HTTP 500 do Auth,
com `Database error finding users`. O Secret scan do mesmo SHA passou. Não fiz
push, rerun, publicação ou qualquer escrita remota nesta auditoria.

O candidato foi enviado na branch `codex/cativa-testing-candidate` e está em
revisão na [PR #1](https://github.com/BelsonNoles91/cativa-gest-o-inteligente-de-clientes/pull/1);
nenhum arquivo de estado do Playwright/Supabase ou backup de baseline foi
versionado. A primeira execução dos workflows está em andamento, portanto ainda
não comprova que o SHA candidato passará integralmente. A sincronização com
Lovable e a produção continuam bloqueadas até os checks ficarem verdes e haver
aceite remoto autorizado.

Na primeira execução da PR #1, o scanner Gitleaks falhou ao tentar enumerar os
commits da PR (`GET /pulls/1/commits`, `Resource not accessible by integration`),
sem apontar segredos encontrados. O job agora tem somente `pull-requests: read`
além de `contents: read`; comentários automáticos continuam desativados. O
Gitleaks passou no run atualizado.

No primeiro run completo do CI, **952/952 Vitest passaram**, assim como lint,
typecheck, Deno, actionlint e Gitleaks. O gate de build sem env falhou porque o
Actions representa secrets ausentes como variáveis vazias; a configuração
tratava `""` como URL/chave definidos e deixava de aplicar o fallback local.
Agora valores vazios ou só com espaços são normalizados como ausentes, e o
próprio gate sempre simula essa condição. A reprodução, os três builds isolados,
typecheck e lint focado passaram sob Node 22.22.3; o CI no novo SHA confirmou o
gate e os 952 testes. Os jobs dependentes tinham sido corretamente pulados após
a falha anterior.

No run seguinte, o gate de build, **952/952 Vitest** e a medição Core Web Vitals
**18/18** passaram. O contrato OAuth iniciou os três cenários em
Chromium, mas os seis casos Firefox/WebKit não iniciaram: o job instalava apenas
Chromium, embora a matriz exigisse os três motores. Atualizei o job para
instalar Chromium, Firefox e WebKit; essa correção local passou pelo actionlint,
mas ainda aguarda novo SHA no Actions. As matrizes de layout e jornadas locais
continuam em execução. Os checks de QA remoto foram pulados por não haver
secrets QA configurados; nenhum projeto protegido foi acessado.

## Correção de compatibilidade do Storage e validação em banco recriado — 2026-10-05

O primeiro run limpo da PR reproduziu uma falha no teste de Storage: o serviço
Storage usado pelo CI não tem a coluna opcional `storage.objects.archived_at`,
enquanto a instância descartável persistente local tinha. Uma primeira
compatibilização por conversão da linha inteira para JSON removeu o erro de
coluna, mas o runner encerrou o processo Postgres ao consultar a RPC de uso.
Substituí-a por consultas SQL dinâmicas escolhidas após verificar o catálogo:
com `archived_at`, objetos arquivados ficam fora do uso/cota; sem a coluna,
todos os objetos são ativos. Não há mutação da tabela gerenciada pelo Storage.

Recriei o banco QA estritamente local, reapliquei toda a sequência de migrations
e executei a matriz SQL agregada: **18/18 passaram**, incluindo Storage/cotas,
RLS, IDOR, agenda, portal, referências entre tenants, quota Jev e auditoria.
Storage passou em duas variantes locais — com `archived_at` e com a coluna
removida temporariamente para simular o schema do CI. Também repetimos as
jornadas autenticadas locais: **17/17 passaram** após build de produção e novo
provisionamento sintético. Nenhum ambiente remoto foi usado.

O CI no SHA `d3094f5` confirmou novamente **952/952 Vitest**, typecheck, build,
lint, Deno, actionlint e scanner de segredos, mas a variante JSON fez o processo
Postgres terminar durante a RPC do gate Storage e interrompeu mais seis SQL
gates em cascata. A implementação com consultas dinâmicas foi validada nas duas
variantes locais e aguarda push/novo Actions; não considero o run anterior prova
de aprovação da correção atual.

A pontuação permanece **92,7% base + 10/10 extraordinários = 102,7/110
(93,4%)**: a reexecução fecha uma falha de compatibilidade dentro de uma frente
já pontuada, mas ainda falta confirmar o novo SHA no Actions. Também seguem
pendentes os secrets do QA remoto, aceite de provedores reais e revisão humana
do preview visual. Por isso, ainda não recomendo publicar a versão no Lovable.
