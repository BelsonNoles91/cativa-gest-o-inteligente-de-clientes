# Visual Regression (Playwright)

Captura screenshots full-page de **5 rotas** em **5 perfis de dispositivo** e
compara com baseline para garantir que `safe-area`, `BottomNav` e layout
mobile não quebrem entre commits.

## Perfis cobertos

| Projeto Playwright       | Viewport         | Foco do teste                              |
| ------------------------ | ---------------- | ------------------------------------------ |
| `iphone-14-portrait`     | 390×844, DPR 3   | Notch superior (safe-area-inset-top)       |
| `iphone-14-landscape`    | 844×390, DPR 3   | **Notch lateral** — pior caso de safe-area |
| `iphone-se`              | 375×667, DPR 2   | Tela curta (modo compacto KPI)             |
| `android-360-portrait`   | 360×800, DPR 3   | Largura mínima viável (overflow lateral)   |
| `ipad-portrait`          | 810×1080, DPR 2  | Breakpoint `md` / sidebar                  |

## Rotas cobertas

1. `/auth/login` (sem auth)
2. `/app` — dashboard
3. `/app/agenda`
4. `/app/clientes`
5. `/app/confirmacoes`

Total: **25 screenshots** por execução completa.

## Pré-requisitos (uma vez)

### 1. Instalar browsers Playwright

```bash
npm run test:visual:install
```

Baixa Chromium + WebKit (cobre iOS via WebKit, Android via Chromium). ~250 MB.

### 2. Criar usuário de teste no Supabase

Os testes precisam de um usuário com pelo menos **1 tenant_membership ativo**
(senão cai em `/onboarding`). Crie um seed manual ou via UI:

1. Acesse o app, faça signup com `visual-test@cativa.local`.
2. Complete o onboarding (cria tenant + unidade demo).
3. Confirme o e-mail (em produção; em DEV o autoconfirm pode estar ativo).

### 3. Configurar credenciais locais

Crie `.env.local` na raiz (já no `.gitignore`):

```bash
E2E_USER=visual-test@cativa.local
E2E_PASS=<senha-forte>
# Opcional — se quiser apontar para outro ambiente que não localhost:
# E2E_BASE_URL=https://staging.seuapp.com
```

## Uso diário

### Rodar testes contra o baseline atual

```bash
npm run test:visual
```

- Sobe `npm run dev` automaticamente (porta 8080) se `E2E_BASE_URL` não for definido.
- Faz login uma vez via `e2e/global-setup.ts`, salva `e2e/.auth/storageState.json`.
- Compara cada screenshot com `e2e/__screenshots__/...`.
- Falha se diff > 0.2% de pixels.

### Ver relatório HTML após falha

```bash
npm run test:visual:report
```

Abre `e2e/.report/index.html` com diff visual lado-a-lado (atual vs baseline vs delta).

### Atualizar baseline (após mudança intencional de design)

```bash
npm run test:visual:update
```

⚠️ Sempre revise os PNGs gerados em `e2e/__screenshots__/` antes de commitar.
Diff visual num review é a única forma confiável de pegar regressões aqui.

## Estrutura

```
e2e/
├── global-setup.ts                 # login real via UI + storageState
├── _helpers/
│   └── visual.ts                   # prepareForSnapshot, asserts de overflow
├── visual/
│   └── public-routes.spec.ts       # 5 rotas × 5 perfis
├── __screenshots__/                # baseline (commitado)
│   └── visual/public-routes.spec.ts/
│       ├── login-iphone-14-portrait.png
│       ├── dashboard-android-360-portrait.png
│       └── ...
├── .auth/                          # storageState (NÃO commitar)
├── .artifacts/                     # outputs da última run (NÃO commitar)
└── .report/                        # HTML report (NÃO commitar)
```

## Asserções estruturais (além do diff visual)

Antes de comparar pixels, cada teste valida:

- **Sem overflow horizontal**: nenhum elemento tem `boundingClientRect.width >
  viewport.width`. Captura cortes laterais comuns em Android 360.
- **BottomNav visível e dentro do viewport**: top do `[data-bottom-nav]` está
  acima do bottom da tela e o nav inteiro cabe. Captura safe-area calculada
  errado que empurra o nav para fora.

Se essas asserções falham, o diff visual nem chega a rodar — você recebe um
erro com a tag/classe do elemento problemático.

## Mascaramento de áreas voláteis

Áreas que mudam entre runs (relógio, contadores) são mascaradas via:

- Atributo `data-volatile` em qualquer elemento (recomendado).
- Tag `<time>` (mascarada por padrão).

Exemplo:
```tsx
<span data-volatile>{formatDistanceToNow(date)}</span>
```

## Troubleshooting

| Sintoma                                        | Provável causa                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `storageState vazio` no log do setup           | `E2E_USER` / `E2E_PASS` ausentes em `.env.local`                     |
| Login bem-sucedido mas redireciona p/ `/onboarding` | Usuário não tem `tenant_membership` — cadastre via UI primeiro  |
| Diff em todos os screenshots da mesma rota     | Provavelmente mudança real de design — revise e rode `:update`       |
| Diff em UM perfil só (ex: só Android 360)      | Regressão real específica daquele viewport — investigue              |
| Timeout no `webServer`                         | `npm run dev` falhou — rode manualmente para ver o erro              |
| Cores levemente diferentes (~0.1%)             | Antialiasing entre máquinas — já absorvido pela tolerância 0.2%      |

## CI (futuro)

O config já é compatível com CI:

```yaml
# .github/workflows/visual.yml (stub — não habilitado por padrão)
- run: npm ci
- run: npx playwright install --with-deps chromium webkit
- run: npm run test:visual
  env:
    E2E_USER: ${{ secrets.E2E_USER }}
    E2E_PASS: ${{ secrets.E2E_PASS }}
    E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: e2e/.report/
```

Para ativar: salve como `.github/workflows/visual.yml` e adicione os secrets
no GitHub. Recomendado rodar só em PRs que tocam `src/components/**` ou
`src/pages/**` para reduzir custo de CI.
