# 5. Backup e restore

## Backup nativo (Supabase Cloud)

Plano Pro+ faz backup automático. Para baixar manualmente:

```bash
pg_dump --no-owner --no-privileges \
  -h db.<ref>.supabase.co -U postgres -d postgres \
  -F c -f cativa-$(date +%Y%m%d).dump
```

`SUPABASE_DB_URL` (em secrets) traz a string completa.

## Restore

```bash
pg_restore --no-owner --no-privileges \
  -h db.<destino>.supabase.co -U postgres -d postgres \
  cativa-YYYYMMDD.dump
```

## Storage

O bucket `client-media` (privado) guarda arquivos/fotos de clientes.
Faça backup com `supabase storage` ou via API:

```bash
supabase storage download client-media/* ./backup-storage/
```

## Backup por tenant (lógico)

Para migrar **um único negócio** sem mexer no banco inteiro, use a tela de
**Importar & Exportar** (Configurações). Ela exporta CSV/JSON de:

- Clientes
- Serviços (com preços base)
- Equipe
- Pacotes
- Memberships
- Protocolos
- Agendamentos (últimos 5 mil)
- Métricas resumo

Esse pacote é suficiente para reimportar em outra instância.

Para demo rápida ou tenant novo, use também os packs em
[11-seeds-demo.md](./11-seeds-demo.md).
