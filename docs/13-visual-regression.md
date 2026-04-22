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
- **Main reserva padding-bottom suficiente**: padding-bottom computado de
  `[data-app-main]` é `>=` altura do BottomNav. Captura regressões em que
  removem `pb-bottom-nav` ou trocam por padding insuficiente.
- **Conteúdo não oculto após scroll até o fim**: rola a página para o bottom
  e garante que o último elemento renderizado (não-fixed/sticky) tem `bottom`
  acima do top do BottomNav. Captura casos sutis onde um elemento sticky ou
  uma seção nova ultrapassa o padding reservado.
- **Itens do BottomNav respeitam safe-area**: para cada `<a>`/`<button>` do
  nav, valida que `rect.left >= safe-inset-left`, `rect.right <= vw -
  safe-inset-right` e `rect.bottom <= vh - safe-inset-bottom`. Pega
  sobreposição com notch lateral (iPhone landscape) e home indicator.
- **Ações críticas acima do BottomNav**: qualquer elemento com atributo
  `data-critical-action` (FABs, "Salvar" sticky, CTA principal) deve ter
  `bottom <= top do nav`. Convenção: marque o JSX com
  `<Button data-critical-action>...</Button>` e o teste alerta se o botão
  for ocultado pela nav.

> **Complementar (Vitest)**: `src/test/safe-area-bottom-nav-computed.test.tsx`
> renderiza o `BottomNav` em jsdom e lê `getComputedStyle` do nó real,
> garantindo que `pb-safe`, `pl-safe`, `pr-safe` e `pb-bottom-nav` continuam
> resolvendo para os valores esperados (e que `min-h-touch >= 44px` em todos
> os itens). Roda em <100ms a cada commit, antes mesmo do Playwright.

Se essas asserções falham, o diff visual nem chega a rodar — você recebe um
erro com a tag/classe do elemento problemático.

## Cenários de navegação multi-página

Além dos snapshots por rota isolada, o spec
`e2e/visual/navigation-scenarios.spec.ts` exercita **fluxos reais de usuário**
para garantir que `safe-area` e `BottomNav` permanecem corretos ao **mudar de
estado** (não só ao montar a página do zero):

1. **Home (`/app`)** → entra, valida nav + safe-area.
2. **Navega via clique no BottomNav** para `/app/clientes` (lista longa).
3. **Scroll até o fim** → reafirma que o conteúdo não fica oculto.
4. **Ativa offline** (via `context.setOffline(true)` + evento `offline`) →
   valida que o `OfflineBanner` aparece **acima do conteúdo**, respeita
   `safe-area-inset-top` e **não cobre o BottomNav**.
5. **Restaura conexão** → layout volta ao normal.
6. **Volta para Home** via clique no nav → safe-area e ações críticas
   continuam íntegras.
7. **Abre o sheet "Mais"** → valida que o último item clicável respeita
   `pb-safe` (não fica embaixo do home indicator).

Roda apenas em viewports `< 768px` (onde o BottomNav existe) e captura
regressões que screenshots estáticos não pegam: state-leak entre rotas,
banner sobrepondo nav, sheet com altura mal calculada em iPhone landscape,
etc.

### Cenário Agenda → Confirmações → Modal de ação

O spec `e2e/visual/agenda-to-confirmation.spec.ts` cobre um fluxo
operacional completo:

1. **`/app/agenda`** → carrega a agenda e valida nav + safe-area.
2. **Transição para `/app/confirmacoes`** via clique no BottomNav (com
   fallback para `goto` se o link estiver indisponível).
3. **Aguarda fila renderizar** (cards) ou EmptyState — nunca tela em branco.
4. **Abre o modal de ação** clicando no primeiro item da fila
   (`QueueItemCard` com `role="button"`).
5. **Valida com modal aberto**:
   - BottomNav segue presente (Radix Dialog é portal — não desmonta o shell).
   - Sem overflow horizontal causado pelo overlay.
   - O último elemento interativo do dialog **respeita
     `safe-area-inset-bottom`** (botões de ação não ficam ocultos atrás da
     home indicator do iPhone).
6. **Fecha o modal** (botão close ou Escape) e revalida o layout original.

O spec é tolerante a tenants sem dados na fila: se o EmptyState for
detectado, valida o estado vazio e encerra sem falhar.

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

## Resiliência e tratamento de erros

A infraestrutura de E2E é endurecida para falhar de forma **rastreável,
recuperável e sem ruído**:

### Helpers de resiliência (`e2e/_helpers/resilience.ts`)

- `withRetry(label, fn, { retries, baseDelayMs })` — backoff exponencial
  para operações idempotentes flaky (animação, hidratação).
- `waitFor(label, predicate, { timeoutMs, pollMs })` — polling determinístico
  em vez de `waitForTimeout(N)` cego.
- `navigateOrFallback(page, opts)` — tenta clique no link real; cai em
  `goto(fallbackUrl)` se o link não estiver disponível ou navegação falhar.
- `ensureOnline(context)` — usado em `afterEach` para garantir que offline
  state nunca vaze entre testes.
- `captureDebugInfo(page, label)` — snapshot URL/viewport/title/online,
  incluído em mensagens de erro para diagnóstico.
- `logStep(scenario, step)` / `logWarn` — logs prefixados `[e2e]` para
  filtragem em CI.

### Login resiliente (`global-setup.ts`)

- 3 tentativas com backoff (1s, 2s) — absorve hidratação lenta do app.
- Selectors específicos (`input[type="password"]`) — não colidem com
  "confirmar senha" se houver na página.
- **Validação pós-login**: o `storageState` precisa conter cookies OU
  localStorage não-vazio. Se sair vazio, falha imediatamente em vez de
  gerar baseline corrompida em runs subsequentes.
- Carregador de `.env` sem `require()` — compatível com ESM puro.
- Cleanup garantido do browser via `try/finally`.

### Helpers de visual robustos

- `prepareForSnapshot` aplica timeout de 3s em `document.fonts.ready` —
  fontes que falham em carregar não travam o teste por 30s.
- `assertContentNotHiddenByBottomNav` valida que o scroll de fato aconteceu
  e loga aviso se a página é maior que o viewport mas não rolou (modal
  aberto, `overflow:hidden` em ancestral).
- `goOffline` aguarda o banner aparecer ATIVAMENTE (até 3s) em vez de
  sleep fixo; loga aviso se não aparecer (potencial regressão no hook).

### Spec de cenários defensivo

- `afterEach` chama `ensureOnline` mesmo se o teste falhar.
- `try/finally` ao redor do bloco offline garante `restore()` em caso de
  assert quebrado — sem vazamento de estado para o próximo teste.
- `waitForMain` substitui o pattern repetitivo `locator.waitFor` e inclui
  `captureDebugInfo` na mensagem de erro (URL, online, viewport).

### Convenção de logs

Todos os logs seguem prefixos consistentes para filtragem em CI:

```bash
# Ver só o fluxo dos cenários
npm run test:visual 2>&1 | grep '\[e2e\]'

# Ver só warnings e falhas
npm run test:visual 2>&1 | grep -E 'WARN'
```

