# Operação do re-scan de segurança

Guia prático para configurar, executar e interpretar o re-scan de segurança do banco.

## 1. Configurar o segredo `SUPABASE_DB_URL`

O re-scan roda SQL direto no Postgres, então precisa de uma URL de conexão.

Formato:

```
postgresql://postgres:<SENHA>@<HOST>:5432/postgres?sslmode=require
```

### No GitHub (obrigatório para o CI)

1. Repositório → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Nome: `SUPABASE_DB_URL`. Valor: a URL completa de conexão.
3. Salve. Sem esse segredo, o job `security-rescan` avisa e para — nenhum PR é bloqueado por engano.

Recomendações:

- Use um usuário de banco com permissão de leitura de catálogo e escrita apenas nas tabelas `security_scans` e `security_scan_findings`.
- Rotacione a credencial se ela aparecer em qualquer log.
- Nunca commite a URL em arquivos do repositório nem em `.env` versionado.

### Localmente

```bash
export SUPABASE_DB_URL='postgresql://...'
```

Guarde em um arquivo fora do repositório (ex.: `~/.config/cativa/db.env`) e carregue com `source`.

## 2. Executar o re-scan localmente

```bash
npm run security:rescan          # gera security-report.md e grava o histórico
npm run test:rls                 # testes de regressão de RLS
```

Variáveis opcionais:

| Variável | Efeito |
| --- | --- |
| `SECURITY_SCAN_PERSIST=0` | roda o scan sem gravar no histórico |
| `SECURITY_SCAN_MIGRATIONS` | lista (vírgula/linha) de migrations associadas à execução |
| `SECURITY_SCAN_PR` | número do pull request associado |

Saída:

- `security-report.md` na raiz — mesmo conteúdo publicado no PR.
- Exit code `1` quando há achados críticos não aceitos; `0` caso contrário; `2` quando falta `SUPABASE_DB_URL`.

### Aceitar um achado intencional

Adicione em `.security-allowlist.json`:

```json
{
  "accepted": [
    { "id": "anon_readable_policies:plans", "reason": "tabela de planos é pública na landing" }
  ]
}
```

O `id` pode ser `<check_id>:<objeto>` (um caso) ou apenas `<check_id>` (a checagem inteira). Todo item aceito precisa de justificativa escrita.

## 3. Interpretar o resumo publicado no pull request

O job comenta um único bloco no PR (atualizado a cada execução) com três partes:

1. **Alterações de backend** — migrations e edge functions tocadas no PR.
2. **Testes de regressão de RLS** — resultado dos testes de permissão por papel e por tenant.
3. **Re-scan de segurança** — contagem de críticos, avisos e aceitos, seguida de uma tabela por checagem.

Legenda dos ícones:

| Ícone | Significado | Ação |
| --- | --- | --- |
| ✅ | nenhum achado aberto | seguir |
| ⚠️ | aviso | avaliar; aceitar com justificativa se for intencional |
| ❌ | crítico | corrigir antes do merge (nova migration) ou aceitar formalmente |

O job falha quando há crítico aberto ou quando os testes de RLS quebram. Corrija com uma nova migration e reexecute (push no PR ou **Re-run jobs**).

## 4. Histórico no painel administrativo

Super administradores acompanham o histórico em **Painel Administrativo → Segurança**:

- lista das últimas execuções com contagens e origem (CI ou local);
- comparação entre duas execuções: achados novos, resolvidos e persistentes;
- filtros por severidade, migration e número do pull request;
- botão **Explicar risco**, que usa IA para descrever o risco e sugerir uma remediação priorizada.

As tabelas `security_scans` e `security_scan_findings` são legíveis apenas por super administradores (RLS) e escritas pelo script de re-scan.
