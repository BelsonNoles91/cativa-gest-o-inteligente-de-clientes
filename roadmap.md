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
- [ ] Cancelamento e reagendamento completos no portal com sessão real, incluindo liberação do horário anterior
- [x] Corrida simultânea com duas transações independentes: uma gravação confirmada e a concorrente bloqueada
