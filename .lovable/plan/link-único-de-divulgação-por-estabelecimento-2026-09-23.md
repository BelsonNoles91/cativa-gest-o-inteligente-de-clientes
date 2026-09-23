# Link único de divulgação por estabelecimento

Cada estabelecimento ganha um endereço próprio, no formato `cativapp.lovable.app/e/nome-do-estudio`, para divulgar nas redes e receber agendamentos direto do público.

## O que o visitante vê

- Capa, logo, nome, texto de apresentação e contatos do estabelecimento.
- Lista de unidades de atendimento (endereço, telefone, horário de funcionamento) com seleção.
- Serviços da unidade escolhida: nome, descrição, duração e preço.
- Escolha de profissional (ou "sem preferência") e dos horários realmente livres.
- Ao confirmar o horário: entrar com Google ou Apple e o agendamento é criado, já no portal do cliente.
- Botões de WhatsApp, Instagram e "como chegar" quando preenchidos.

## Painel do estabelecimento

Nova aba em Configurações, para proprietário e gerente:

- Link público com botão de copiar, QR code para baixar e prévia.
- Editor da página: capa, logo, apresentação, WhatsApp, Instagram, site.
- Escolher quais unidades e serviços aparecem publicamente.
- Interruptor para ligar/desligar a página pública.
- Endereço editável (com verificação de disponibilidade).

## Detalhes técnicos

- Rota pública `/e/:slug` em `src/App.tsx`, fora dos guards, com página nova em `src/pages/public/TenantPublic.tsx` e seções em `src/components/public/`.
- Nova tabela `tenant_public_pages` (tenant_id único, is_published, headline, about, cover_url, whatsapp, instagram, website, theme) + colunas `is_public` em `units` e `services`; grants e RLS: leitura anônima só de linhas publicadas, escrita restrita a owner/manager/super_admin do tenant.
- Leitura pública sem vazar dados internos: funções `SECURITY DEFINER` `get_public_tenant_page(_slug)`, `get_public_units(_slug)`, `get_public_services(_slug, _unit_id)`, `get_public_professionals(_slug, _service_id)` e `get_public_availability(_slug, _unit_id, _service_id, _professional_id, _date)`, expondo apenas campos de vitrine (sem comissão, sem dados de clientes). Reaproveita o cálculo de horários já usado em `PortalBooking`.
- Agendamento: RPC `create_public_appointment(...)` `SECURITY DEFINER`, exige usuário autenticado, revalida slug/unidade/serviço/horário no servidor, cria ou reaproveita o cliente do tenant pelo e-mail da conta e grava origem "link público" na auditoria.
- Login social reaproveita o fluxo existente (`sessionStorage cativa:auth_redirect`), voltando para `/e/:slug` com a seleção preservada.
- Repositório `src/repositories/public-page.ts`; aba nova em `src/pages/app/Settings.tsx` com permissão `settings.manage`.
- SEO: título, descrição e Open Graph por estabelecimento; `robots` liberado apenas quando publicado.
- Testes: unitários das regras de visibilidade e da validação de horário, teste de RLS (anônimo não lê tenant despublicado nem dados internos) e teste de ponta a ponta do fluxo de agendar pelo link com conta de teste.
