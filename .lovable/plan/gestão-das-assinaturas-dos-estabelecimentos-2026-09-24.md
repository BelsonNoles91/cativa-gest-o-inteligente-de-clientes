# Gestão das assinaturas dos estabelecimentos

## Objetivo
Criar em **Painel Administrativo → Contas e acessos** uma área exclusiva para acompanhar e administrar as assinaturas que cada estabelecimento paga à Cativa, sem misturar com pacotes ou planos vendidos aos clientes finais.

## O que será entregue
- Visão geral com totais por situação: em teste, ativa, em atraso, suspensa, cancelada e sem assinatura.
- Lista pesquisável por estabelecimento, plano e situação, mostrando valor do plano, período atual, fim do teste, desconto e alertas.
- Painel detalhado por estabelecimento com:
  - troca entre Começo, Solo, Equipe e Rede;
  - alteração de situação, com confirmação para suspensão e cancelamento;
  - definição e extensão do período de teste;
  - datas do ciclo atual e próxima renovação;
  - desconto individual em reais e motivo;
  - limites personalizados de unidades, profissionais, clientes, armazenamento e agendamentos;
  - observação administrativa;
  - histórico cronológico de todas as mudanças.
- Tratamento dos estabelecimentos que ainda não possuem assinatura, permitindo criar e atribuir um plano.
- Atualização imediata da lista e dos indicadores após salvar.

## Segurança e integridade
- Todas as alterações serão executadas por operações protegidas disponíveis apenas ao super administrador.
- Cada operação validará plano, situação, datas, desconto e limites antes de gravar.
- Alterações de plano, situação, teste, desconto, ciclo, limites e observações gerarão histórico com responsável, valores anteriores e novos.
- A interface operacional dos estabelecimentos continuará apenas para consulta e ações permitidas; a gestão global ficará nesta nova área.
- Nenhum dado ou assinatura existente será removido.

## Organização da tela
- A antiga área **Períodos de teste** será incorporada à nova aba **Assinaturas**, evitando controles fragmentados.
- A aba **Planos de clientes** continuará separada, pois trata das assinaturas vendidas pelos estabelecimentos aos seus clientes finais.
- No celular, a lista abre os detalhes em uma janela ampla com rolagem interna; no computador, os dados serão apresentados de forma densa e comparável.

## Validação
- Testar criação de assinatura para estabelecimento sem plano.
- Testar troca de plano, mudança de situação, extensão de teste, desconto, datas, limites e observações.
- Confirmar que cada alteração aparece no histórico e reflete no painel do estabelecimento.
- Confirmar bloqueio para usuários sem permissão de super administrador.
- Executar verificação de tipos, testes automatizados e conferir a tela em computador e celular.

## Observação
Esta etapa gerencia o cadastro e o ciclo da assinatura dentro da Cativa. Cobrança automática, cartão, emissão fiscal e integração com uma operadora de pagamentos não serão inventados nesta etapa, pois não existem atualmente no produto.
