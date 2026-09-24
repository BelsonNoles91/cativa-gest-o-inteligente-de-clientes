# Correção global de contraste e TS2686

## Objetivo
Garantir leitura adequada em todo o sistema nos modos claro e escuro e eliminar a origem do erro TypeScript informado.

## Implementação
- Confirmar a origem real do TS2686 e ajustar o arquivo/configuração responsável sem mascarar erros.
- Corrigir os tokens globais de contraste para textos, botões, estados e fundos em ambos os temas.
- Substituir cores fixas e transparências problemáticas nas telas internas e componentes compartilhados.
- Manter páginas institucionais exclusivamente claras quando seus elementos não suportarem tema escuro.
- Validar telas principais em celular e computador, nos dois temas, com auditoria automatizada WCAG AA.

## Validação
- Verificação completa do TypeScript.
- Testes automatizados existentes.
- Varredura de contraste e inspeção visual das telas autenticadas principais em claro e escuro.
- Conferência do estado final de compilação.
