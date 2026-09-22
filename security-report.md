## Re-scan de segurança do banco

Achados críticos: **0** · avisos: **0** · aceitos: **3**

### ✅ Tabelas públicas sem RLS habilitada

Nenhum achado.

### ✅ Tabelas com RLS habilitada mas sem nenhuma policy (acesso totalmente bloqueado)

Nenhum achado.

### ✅ Tabelas públicas sem GRANT para authenticated nem service_role

Nenhum achado.

### ✅ Tabelas com escrita efetivamente aberta a anon (GRANT + policy permissiva)

Nenhum achado.

### ✅ Policies que expõem leitura a anon/public

| tabela | policy | comando | status |
| --- | --- | --- | --- |
| plans | plans: público lê | r | aceito — tabela de planos alimenta a página pública de preços |
| system_status | Status viewable by everyone | r | aceito — página pública /status exibe o estado do serviço |

### ✅ Funções SECURITY DEFINER sem search_path fixo

Nenhum achado.

### ✅ Buckets de storage públicos

| bucket | status |
| --- | --- |
| tenant-logos | aceito — logos precisam ser lidas pelo portal público e pela landing |
