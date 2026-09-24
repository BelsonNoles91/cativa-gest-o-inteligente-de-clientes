# Roadmap Cativa

Status por fase: ✅ concluída · 🔜 próxima · ⏳ planejada

## Fase 0 — Regras de autoatendimento do cliente ✅ concluída
- [x] Confirmar / remarcar / cancelar configuráveis por estabelecimento
- [x] Limites antiabuso validados no servidor (antecedência, remarcações, cancelamentos, faltas, suspensão)
- [x] Aviso ao cliente em texto livre, sem menção a taxas

## Fase 1 — Valor do cliente e previsão de faturamento ✅ concluída
- [x] Valor histórico por cliente, ticket médio, frequência e potencial em 12 meses
- [x] Concentração de receita (20% que mais gastam) e valor típico (mediana)
- [x] Previsão de faturamento para 30 e 90 dias com média mensal, tendência e agenda marcada
- [x] Blocos no Painel do gestor + testes automatizados

## Fase 2 — Lembretes inteligentes de retorno ✅ concluída
- [x] Sugerir o momento ideal de retorno a partir do intervalo médio de cada cliente
- [x] Fila de lembretes na tela Retorno e reativação (texto pronto, envio manual por WhatsApp)

## Fase 3 — Campanhas de reativação ✅ concluída
- [x] Listas automáticas de clientes em risco e perdidos
- [x] Mensagens modelo, frase de incentivo e registro do resultado do contato

## Fase 4 — Lista de espera automática ✅ concluída
- [x] Ao cancelar (ou marcar falta), a agenda oferece a vaga a quem combina na fila
- [x] Ranking por serviço, profissional, unidade, janela desejada e prioridade
- [x] Mensagem pronta por WhatsApp, cópia do texto e reserva em um toque

## Fase 5 — Metas e ranking da equipe ✅ concluída
- [x] Meta mensal de receita e de atendimentos por profissional (dono/gerente)
- [x] Tela Metas e ranking com visão de semana e de mês, progresso e desempenho

## Fase 6 — App instalável com notificações (Android/iOS) ✅ concluída
- [x] Convite de instalação no celular (Android nativo, passo a passo no iPhone)
- [x] Notificações push: ativação por aparelho no perfil do cliente, envio de teste e lembrete automático 24h antes do horário (verificação de hora em hora)


## Fase 7 — Opcionais aprovados ✅ concluída
- [x] Fidelidade com pontos e recompensas (configuração em Configurações → Fidelidade; saldo e meta no portal do cliente)
- [x] Avaliação pós-atendimento → Google Meu Negócio (Configurações → Avaliações + tela Avaliações com convite por WhatsApp e registro de envio)
- [x] Comissões e fechamento por profissional com extrato (tela Comissões: percentual por profissional, extrato do mês, fechar e reabrir mês)
- [x] Anamnese digital assinada (modelos em Configurações → Anamnese; cliente preenche e assina em /portal/anamnese)
- [x] Cupons de reativação: gerados na fila de reativação e exibidos no portal do cliente

Roadmap concluído: todas as fases (0 a 7) entregues.

## Gestão administrativa de assinaturas dos estabelecimentos ✅ concluída
- [x] Painel por status e plano, separado dos planos vendidos aos clientes finais
- [x] Gestão de plano, situação, teste, ciclo, desconto, limites e observações
- [x] Operação protegida para super administrador com histórico completo
- [x] Validação visual em computador e celular; acesso e validações críticas confirmados sem alterar assinaturas reais

## Fase 8 — Dados reais e notificações (23/09/2026) ✅
- [x] Push de lembrete 24h (cron horário) e push de confirmação do cliente (avisa recepção e cliente)
- [x] Cartão "Avisos no celular" também no perfil da equipe (/app/perfil)
- [x] Resumo de comissões do mês no Painel do gestor (link para /app/comissoes)
- [x] Studio New Visual populado: 3 profissionais, 6 serviços, horários, 20 clientes, 170 atendimentos, agenda futura, metas e comissões
- [ ] Validação no celular (depende do usuário) e teste do portal com login Google/Apple (depende do usuário)

## Auditoria pré-produção — Fase 4: motor de agendamento e concorrência 🔄 em validação
- [x] Proteção atômica contra horários sobrepostos por profissional e por recurso físico
- [x] Encaixe manual autorizado sem remover a proteção dos agendamentos regulares
- [x] Horários de falta e cancelados liberam a vaga corretamente
- [x] Disponibilidade calculada no fuso do estabelecimento, incluindo múltiplas janelas do profissional
- [x] Criação de agendamento e item de serviço em uma única operação, sem registros parciais
- [x] Transições inválidas de status bloqueadas também no servidor
- [x] Valores inválidos de duração, intervalos e preço bloqueados no servidor
- [x] Página pública validada com tenant realmente publicado; slug inexistente retorna indisponível como esperado
- [x] Horários públicos exibidos no fuso do estabelecimento, independentemente do aparelho do cliente
- [x] Trigger legado alinhado às constraints: buffers, recurso, encaixe autorizado e fuso do tenant
- [ ] Cancelamento e reagendamento completos no portal com sessão real (bloqueado: conta de teste sem vínculo com estabelecimento)
- [x] Corrida simultânea com duas transações independentes: uma gravação confirmada e a concorrente bloqueada

## Auditoria pré-produção — Fase 5: layouts e responsividade 🔄 em validação
- [x] Varredura automática de 13 telas em celular (390px), tablet (768px) e computador (1440px)
- [x] Nenhuma tela com rolagem horizontal indevida
- [x] Abas de Configurações: no computador agora quebram em duas linhas (a aba "Link público" ficava escondida)
- [x] Página pública, Agenda, Clientes e Painel conferidos visualmente no celular
- [ ] Revisão de telas restantes com sessão de recepção/profissional (conta de teste pendente)

## FASE 6 — UX e acessibilidade (WCAG AA) — CONCLUÍDA
Varredura axe-core (wcag2a/2aa/21a/21aa) em 12 rotas, viewport 390px: 0 violações ao final.
Corrigido:
- index.html: removido maximum-scale=1.0 (zoom bloqueado no celular) — violação crítica em todas as rotas.
- Botões sem nome acessível: pontos do carrossel (MetricsSection), selects de unidade/profissional (Agenda), segmento/fuso/moeda (BusinessSettings).
- Campos sem rótulo: data base da agenda, nome do estabelecimento.
- Abas Radix sem conteúdo associado (aria-controls inválido): Agenda e TeamGoals + aria-label nas TabsList.
- Barras de progresso sem nome: TeamGoals.
- Links sociais sem nome: PremiumFooter.
- Contraste: novo token --accent-strong e --success-strong; StatusBadge success, botão premium, textos de apoio da landing, rodapé e seção escura final.

## FASE 7 — Segurança e privacidade — CONCLUÍDA
- Pacotes vulneráveis atualizados: @supabase/supabase-js 2.104 → 2.117 (corrige ws) e baseline-browser-mapping 2.11.25.
- Migration 0016/0017: funções internas SECURITY DEFINER deixaram de ser executáveis sem login (revogado EXECUTE de PUBLIC/anon); continuam públicas apenas as da página de divulgação e a consulta de convite.
- get_public_tenant_timezone alinhada à mesma regra da página pública (agora responde também em período de teste).
- Índices/limites de arquivos: bucket de mídia de clientes 10MB, logos 2MB (ambos com política por estabelecimento já ativa).
- Verificado: página pública responde 200; funções administrativas retornam "permissão negada" sem login; 448 testes e compilação OK.
- Avisos aceitos pelo usuário permanecem como estão (status público e SECURITY DEFINER para usuários logados).

## FASE 8 — Desempenho — CONCLUÍDA
- Migration 0018: índices criados em 64 chaves estrangeiras sem índice (joins e exclusões em cascata).
- Busca global agora carrega sob demanda: pacote de 60 kB comprimidos sai do carregamento inicial do app.
- Cache de dados já configurado (10 min de validade, 60 min em memória, sem recarregar ao voltar à aba).
- Consultas lentas do banco revisadas: nenhuma consulta de uso real acima de 40 ms.
- Compilação e 448 testes OK após as mudanças.

## FASE 9 — Bateria automatizada de testes — CONCLUÍDA
- 448 testes automatizados em 38 arquivos: todos passando.
- Checagem de qualidade de código: 0 erros (antes 1, em arquivo gerado pela plataforma, agora fora da checagem) e 16 avisos sem impacto.
- Corrigido aviso real em "Retorno e reativação": o filtro de busca agora é recalculado de forma estável.
- Testes de segurança do banco: acrescentado o caso "dono não consegue virar administrador geral" comparando o valor antes/depois (o teste antigo media a coisa errada). Rodados contra o banco real: visitante não vê incidentes, clientes nem agendamentos; token de convite protegido; dono vê os 8 membros; profissional só a própria ficha; autoelevação bloqueada.
- Páginas públicas (início, entrar, status, preços e página do estabelecimento) abertas no navegador em tela de celular: todas carregam, sem rolagem lateral e sem erros de aplicação.
- Aviso de "ref" no console vem da ferramenta de desenvolvimento da plataforma (lovable-tagger) e não existe no app publicado.
- Limitação do ambiente: as suítes de navegador (Playwright) que exigem login não rodam aqui por falta de conta de teste e de bibliotecas de sistema dos navegadores; devem rodar no CI.

## FASE 10 — Regressão por perfil — CONCLUÍDA (com 1 decisão pendente)
Testado no banco real, com contas reais de cada função do Studio Teste QA.
- Dono e gestor: leem clientes (22) e agendamentos (28), editam clientes, catálogo, dados do estabelecimento e convidam equipe. OK.
- Recepção: lê e edita clientes e agendamentos; NÃO altera catálogo, NÃO altera dados do estabelecimento, NÃO vê a lista da equipe, NÃO convida. OK.
- Profissional: lê agenda e clientes; NÃO edita cliente, catálogo nem estabelecimento; NÃO vê equipe nem convida. OK, exceto item aberto abaixo.
- Cliente (portal): vê só a própria ficha, nenhum agendamento de terceiros, não altera catálogo. OK.
- Nenhuma função enxerga dados de outro estabelecimento (0 registros em todos os casos).
- ITEM ABERTO: o profissional enxerga a agenda e a lista de clientes do estabelecimento inteiro, não só os próprios. Decidir se restringe (privacidade) ou mantém (visibilidade de equipe).

## FASE 11 — Checklist final de produção — CONCLUÍDA
- Build de produção gerado sem erros (maior arquivo inicial ~78 KB comprimido; telas pesadas carregam sob demanda).
- Título, descrição e imagem de compartilhamento configurados; app instalável com atalhos (Agenda, Confirmações, Novo cliente).
- Adicionados mapa do site (sitemap.xml) e referência dele no robots.txt.
- Nenhuma chave secreta no pacote publicado; único registro de depuração é exclusivo do modo desenvolvimento.
- Página fora do ar (offline) e página "não encontrada" presentes; página pública de status funcionando.
- Verificação de segurança do banco: só 7 funções abertas a visitantes, todas da página pública e da leitura de convite (esperado). Demais avisos já aceitos.
- 448 testes passando.

## FASE 12 — Correção final — CONCLUÍDA
- Avaliado o último aviso corrigível de qualidade de código: a correção quebrava a checagem de tipos, então foi revertida. Restam 16 avisos, todos do recurso de recarregamento rápido do ambiente de desenvolvimento e de tipagem de teste — sem efeito no app publicado.
- Compilação limpa, 448 testes passando, build de produção OK.
- Decisão pendente do cliente (visão do profissional sobre agenda/clientes do estabelecimento) mantida como está, registrada como ressalva.
