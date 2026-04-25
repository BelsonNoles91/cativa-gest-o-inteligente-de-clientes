# 6. Importação e exportação

A tela vive em **Configurações → Importar & Exportar** (`/app/dados`).

## Status de validação

Validado em 24/04/2026 contra preview/build local + Supabase real:

- `npm run test:import-export:clients`: importação CSV de cliente pela tela
  `/app/dados`, persistência em `clients`, exportação CSV de clientes,
  conferência do cliente importado no arquivo baixado e cleanup sem sobras.
- `npm run test:import-export:services`: importação CSV de serviço pela tela
  `/app/dados`, persistência em `services`, persistência de preço base em
  `service_prices`, exportação CSV de serviços, conferência do serviço
  importado no arquivo baixado e cleanup sem sobras.
- `npm run test:import-export:team`: importação CSV de profissional pela tela
  `/app/dados`, persistência em `professionals`, leitura de comissão via RPC
  segura, exportação CSV de equipe com comissão e cleanup sem sobras.

Pendência restante: expandir o mesmo round-trip automatizado para pacotes e
agendamentos, incluindo cenários com homônimos.

## Importação CSV

Suporta:

- **Clientes** — base de CRM (nome, telefone, e-mail, nascimento, cidade, …).
- **Serviços** — catálogo com duração e preço.
- **Equipe** — profissionais com apelido, função, **especialidade, e-mail,
  telefone, comissão (%) e flag de ativo**. O vínculo a `auth.users` (login)
  continua sendo feito pelo fluxo de convite em Configurações → Equipe.
- **Pacotes & Protocolos**.
- **Agendamentos** — via nomes de cliente/profissional/serviço; a unidade pode vir vazia
  quando o tenant tiver apenas uma unidade ativa.

Fluxo:

1. Selecionar tipo de dado.
2. Anexar CSV (UTF-8; vírgula ou ponto-e-vírgula; aceita BOM).
3. Mapeamento automático por header. Ajuste manualmente se quiser.
4. Prévia + validação (campos obrigatórios, parsing de número/data/telefone).
5. Confirma → grava em chunks de 100 registros.

### Importação de agendamentos

O CSV de agendamentos é deliberadamente **portável**, sem exigir IDs internos:

- `cliente` → casa por `clients.full_name`
- `profissional` → casa por `professionals.display_name` ou `full_name`
- `servico` → casa por `services.name`
- `unidade` → opcional quando houver só uma unidade ativa no tenant

Campos aceitos:

- `inicio` em ISO (`2026-04-21T14:30:00Z`) ou `dd/mm/aaaa hh:mm`
- `duracao`
- `preco` em reais
- `status`
- `origem`
- `observacoes`

Falhas de mapeamento ficam registradas por linha no resumo da importação.

### Modelos prontos

A tela disponibiliza um botão **Baixar modelo CSV** para cada entidade.

### Aliases reconhecidos

Cada coluna canônica casa com vários aliases comuns em pt-BR/en. Exemplos:

- `fullName` ← `nome`, `cliente`, `nome_completo`, `name`, `full name`
- `phone` ← `celular`, `telefone`, `phone`, `fone`
- `priceCents` ← `preco`, `price`, `valor`
- `birthDate` ← `data_nascimento`, `aniversario`, `dob` (aceita ISO ou `dd/mm/aaaa`)

## Exportação

Disponível em CSV (com BOM, abre direto em Excel) e JSON:

- Clientes
- Serviços (com preços base)
- Equipe
- Pacotes
- Memberships
- Protocolos
- Agendamentos (últimos 5 mil)
- Métricas resumo (contadores agregados)

As exportações foram ajustadas para serem **round-trip friendly**:

- preços saem em reais, não em centavos crus;
- agendamentos saem com nomes de cliente/profissional/serviço/unidade;
- os headers seguem aliases aceitos pelo importador.

## Convenções

- Toda exportação CSV é UTF-8 + BOM + CRLF (Excel friendly).
- Toda exportação JSON é um array de objetos com chaves estáveis (não
  prefixadas por DB internals).
- Os exporters vivem em `src/services/import-export/exporters.ts` —
  trocar de backend não exige mexer aqui.
- Seeds de demonstração prontos para importação ficam em [11-seeds-demo.md](./11-seeds-demo.md).
