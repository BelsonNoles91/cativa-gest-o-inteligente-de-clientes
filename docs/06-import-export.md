# 6. Importação e exportação

A tela vive em **Configurações → Importar & Exportar** (`/app/dados`).

## Importação CSV

Suporta:

- **Clientes** — base de CRM (nome, telefone, e-mail, nascimento, cidade, …).
- **Serviços** — catálogo com duração e preço.
- **Equipe** — profissionais (vinculação a auth.user é manual depois).
- **Pacotes & Protocolos**.
- **Agendamentos** — apenas via suporte/migração guiada (requer mapeamento de IDs).

Fluxo:

1. Selecionar tipo de dado.
2. Anexar CSV (UTF-8; vírgula ou ponto-e-vírgula; aceita BOM).
3. Mapeamento automático por header. Ajuste manualmente se quiser.
4. Prévia + validação (campos obrigatórios, parsing de número/data/telefone).
5. Confirma → grava em chunks de 100 registros.

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
- Agendamentos (últimos 5 mil)
- Métricas resumo (contadores agregados)

## Convenções

- Toda exportação CSV é UTF-8 + BOM + CRLF (Excel friendly).
- Toda exportação JSON é um array de objetos com chaves estáveis (não
  prefixadas por DB internals).
- Os exporters vivem em `src/services/import-export/exporters.ts` —
  trocar de backend não exige mexer aqui.
