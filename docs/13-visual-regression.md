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

Se `E2E_USER` e `E2E_PASS` não estiverem configurados, os specs autenticados
serão **pulados explicitamente** e você pode validar apenas a frente pública.

### Rodar apenas a frente pública

```bash
npm run test:visual:public
```

Executa a baseline pública sem depender de login real.

### Preflight do ambiente E2E

```bash
npm run test:visual:check
```

Inspeciona `.env.local`/`.env`, confirma variáveis-chave e informa
objetivamente se a trilha autenticada está pronta.

### Rodar apenas a frente autenticada

```bash
npm run test:visual:auth
```

Esse comando falha rápido se `E2E_USER` e `E2E_PASS` estiverem ausentes,
evitando gastar minutos de execução do Playwright sem chance real de sucesso.

### Rodar a frente autenticada crítica no perfil principal

```bash
npm run test:visual:auth:critical
```

Executa a trilha autenticada crítica no perfil `iphone-14-portrait`, cobrindo:

- baseline visual de `/app`, `/app/agenda`, `/app/clientes` e `/app/confirmacoes`;
- cenário transicional Home → Clientes → offline → Home;
- cenário Agenda → Confirmações;
- detecção de overlap do `BottomNav` nas rotas principais.

### Validar contas QA por papel

```bash
npm run test:visual:roles
```

Confirma via Supabase Auth que as credenciais de `owner`, `manager`,
`frontdesk` e `professional` são utilizáveis antes de avançar para cenários
multi-perfil.

### Observação para Windows/local

O `playwright.config.ts` já força um modo mais estável para execução local:

- `PW_TEST_SCREENSHOT_NO_FONTS_READY=1` por padrão no ambiente local;
- `workers=1` fora de CI para reduzir flakiness do `webServer` local.

Isso foi incorporado após a auditoria de 23/04/2026 para estabilizar a
geração/validação do baseline público.

### Validação realmente executada em 23/04/2026

- Baseline pública de `/auth/login` gerada em
  `e2e/__screenshots__/visual/public-routes.spec.ts/`.
- Browsers Playwright instalados localmente com `npm run test:visual:install`.
- Suite pública validada com sucesso em execução local serial.
- Suite Vitest de navegação/safe-area limpa, sem warnings residuais do React Router
  nos testes críticos do shell mobile.
- Baseline pública atualizada após refinamentos recentes do layout de login
  (`iphone-14-portrait` e `ipad-portrait`).
- `npx playwright test --workers 1` executado sem credenciais externas com
  resultado `5 passed / 55 skipped`, validando que os specs autenticados agora
  são pulados de forma explícita e segura.
- `npm run test:visual:check` e `node scripts/e2e-preflight.mjs --require-auth`
  validados localmente; a trilha autenticada agora falha rápido com mensagem
  objetiva quando as credenciais não existem.
- O preflight também passou a validar login real no Supabase antes do Playwright.
- Em 23/04/2026, a credencial `owner` de QA passou a validar corretamente no
  preflight autenticado.
- Em 23/04/2026, a matriz de contas QA por papel também foi validada com
  sucesso: `owner`, `manager`, `frontdesk` e `professional`.
- Na mesma data, foi corrigido um bug do spec `public-routes.spec.ts` que
  aplicava `storageState` vazio ao arquivo inteiro e invalidava as rotas
  autenticadas por desenho.
- Também foi criada uma trilha de smoke autenticada separada (`playwright.smoke.config.ts`)
  e o `globalSetup` passou a tentar autenticação direta via Supabase antes do
  fallback por UI.
- Em 23/04/2026, a smoke autenticada multi-rota também foi validada com
  sucesso em preview/build local: `/app`, `/app/agenda`, `/app/clientes` e
  `/app/confirmacoes`.
- O comando `npm run test:auth:smoke` agora cobre essa smoke multi-rota e
  deixou de validar apenas o shell isolado de `/app`.
- Em 23/04/2026, a trilha visual autenticada crítica no perfil
  `iphone-14-portrait` também foi validada com sucesso para as quatro rotas
  principais, para os cenários `navigation-scenarios` e
  `agenda-to-confirmation`, e para o detector `bottom-nav-overlap`.
- Os specs `agenda-to-confirmation` e `bottom-nav-overlap` foram endurecidos
  com orçamento de tempo compatível com a carga real de `/app/confirmacoes`,
  eliminando falso negativo por timeout prematuro.
- O spec `public-routes.spec.ts` também recebeu orçamento maior para
  screenshots full-page autenticados, e a baseline do dashboard no perfil
  `iphone-14-portrait` foi realinhada ao estado atual do app.
- O ponto aberto desta frente deixou de ser a subida autenticada básica. O que
  resta agora é expandir a validação para baseline visual autenticada completa,
  portal real, bucket real e conferência humana de RLS/dispositivo.
- Ainda existe instabilidade residual ao encadear toda a trilha crítica em um
  único comando serial, por oscilação de `globalSetup`/rede Supabase no
  ambiente local.
- Em 23/04/2026, a primeira tentativa de expansão para outros perfis via
  trilha sem `globalSetup` não foi adotada: com `storageState` bootstrapado,
  os testes autenticados passaram a cair de volta no login. O caminho foi
  mantido como hipótese técnica e não como fluxo operacional do projeto.
- Ainda em 23/04/2026, a trilha preview-crítica recebeu recuperação explícita
  de cold-start autenticado nas rotas visuais.
- Na mesma rodada, `/app/clientes` voltou a subir corretamente no preview após
  correção de `ReferenceError: cn is not defined` introduzido durante o ajuste
  de responsividade do CRM.
- Com isso, `/app/clientes` e `/app/confirmacoes` passaram com sucesso nos
  perfis `iphone-se` e `iphone-14-landscape` na trilha preview-crítica.

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

## Relatório automático de falhas de safe-area

Quando qualquer assert de safe-area / BottomNav falha, o helper
`e2e/_helpers/safeAreaReport.ts` gera dois artefatos em
`e2e/.artifacts/safe-area-failures/` (e os anexa ao HTML report do
Playwright em `e2e/.report`):

1. **`<timestamp>-<label>-<project>.png`** — screenshot anotado com:
   - Box vermelha translúcida sobre cada elemento ofensor.
   - Linhas tracejadas verdes nos limites resolvidos de
     `env(safe-area-inset-top/right/bottom/left)`.
   - Label sobre cada ofensor: `#1 BottomNav · bottom +12px`.
   - Legenda no canto superior-direito com viewport, valores de safe-area
     e contagem de ofensores.

2. **`<timestamp>-<label>-<project>.json`** — relatório estruturado com:
   - `viewport`, `safeArea` (px resolvidos), URL e nome do teste.
   - `bottomNav.rect` + `bottomNav.bottomGap` (gap até o fim do viewport).
   - `main.rect` + `main.paddingBottomPx` (padding-bottom computado).
   - Lista de `offenders` com `rect`, `side`, `delta` e `hint`.

### Asserts instrumentados

Todos os asserts em `_helpers/visual.ts` chamam `captureFailureReport`
**antes** de re-lançar a exceção:

| Assert                                | Label do relatório                               |
| ------------------------------------- | ------------------------------------------------ |
| `assertBottomNavVisible`              | `bottom-nav-not-visible`, `bottom-nav-cut-off-top`, `bottom-nav-escapes-bottom` |
| `assertMainHasBottomPadding`          | `main-missing-bottom-padding`                    |
| `assertContentNotHiddenByBottomNav`   | `content-hidden-by-bottom-nav`                   |
| `assertBottomNavItemsRespectSafeArea` | `bottom-nav-items-violate-safe-area`             |
| `assertCriticalActionsAboveBottomNav` | `critical-actions-covered-by-nav`                |
| `assertOfflineBannerLayout`           | `offline-banner-overlaps-nav`, `offline-banner-violates-safe-top` |

### Como usar para acelerar correção

```bash
# Listar relatórios mais recentes
ls -lt e2e/.artifacts/safe-area-failures/ | head

# Abrir o screenshot anotado
open e2e/.artifacts/safe-area-failures/<timestamp>-<label>.png

# Ler o JSON para ver delta exato
jq '.offenders' e2e/.artifacts/safe-area-failures/<timestamp>-<label>.json
```

O HTML report (`npx playwright show-report e2e/.report`) também exibe os
artefatos anexados em cada teste falho — basta clicar no teste vermelho.

### Adicionando relatórios em asserts customizados

Para specs próprios, use o wrapper `withFailureReport`:

```ts
import { withFailureReport } from "../_helpers/safeAreaReport";

await withFailureReport(
  page,
  "meu-assert-customizado",
  async () => {
    expect(algo).toBe(esperado);
  },
  () => ({
    offenders: [{ label: "Botão X", rect, side: "bottom", delta: 8 }],
    extra: { contexto: "abrindo o sheet de detalhes" },
  }),
);
```

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


## Convenção de seletores estáveis

Para reduzir flaky tests e desacoplar os specs de detalhes visuais (texto, classes, estrutura DOM), o shell expõe atributos `data-*` padronizados. **Sempre prefira esses seletores nos novos specs** em vez de `text=`, classes Tailwind ou estrutura aninhada.

### Marcadores de região (presença booleana)

| Atributo | Onde | Uso em E2E |
| --- | --- | --- |
| `data-app-main="true"` | `<main>` em `AppLayout` e `PortalLayout` | `[data-app-main]` |
| `data-bottom-nav="true"` | `<nav>` do BottomNav (app e portal) | `[data-bottom-nav]` |
| `data-app-context="tenant" \| "portal"` | em main/nav | distinguir app vs portal |
| `data-offline-banner="true"` + `data-offline-state="offline" \| "recovered"` | OfflineBanner | `[data-offline-banner][data-offline-state="offline"]` |
| `data-sheet-content="true"` + `data-sheet-side="bottom" \| "right" \| ...` | SheetContent (Radix) | `[data-sheet-content][data-sheet-side="bottom"]` |
| `data-sheet-overlay="true"` | SheetOverlay | bg overlay |

### `data-testid` (alvo direto)

| Testid | Componente |
| --- | --- |
| `app-main` | `<main>` do layout |
| `bottom-nav` | `<nav>` do BottomNav |
| `bottom-nav-item` (com `data-route="<slug>"` e `data-locked="true\|false"`) | itens primary do nav |
| `bottom-nav-more` (com `data-state="open\|closed"`) | botão "Mais" |
| `bottom-nav-sheet` | sheet aberto pelo "Mais" |
| `bottom-nav-sheet-item` (com `data-route` e `data-active`) | módulos secundários no sheet |
| `bottom-nav-sheet-close` | botão fechar do sheet |
| `offline-banner` / `offline-banner-message` | banner offline |
| `agenda-create-cta`, `clients-create-cta`, `services-create-cta`, `waitlist-create-cta`, `confirmation-generate-cta`, `confirmation-refresh`, `packages-refresh` | CTAs principais por página |

### `data-critical-action`

Marca botões/FABs cuja ocultação atrás do BottomNav é regressão crítica. O helper `assertCriticalActionsAboveBottomNav(page)` itera todos esses elementos e falha se algum estiver coberto pela nav fixa.

```tsx
<Button data-critical-action data-testid="agenda-create-cta" onClick={...}>
  Criar agendamento
</Button>
```

### `data-route` em vez de `href`

A rota muda menos que o copy do botão, mas mais que o slug interno. Para localizar um item do nav inferior por destino:

```ts
// ✅ recomendado — resiste a mudança de copy E a alias de URL
page.locator('[data-testid="bottom-nav-item"][data-route="app-clientes"]')

// ⚠️ aceitável — quebra se o href mudar
page.locator('[data-bottom-nav] a[href="/app/clientes"]')

// ❌ frágil — quebra com i18n
page.getByRole('link', { name: 'Clientes' })
```

O slug é gerado por `slugOf(to)` no `BottomNav`: barras viram `-` e a barra inicial é removida (`/app/clientes` → `app-clientes`, `/app` → `app`).

### Compatibilidade

Os specs atuais já usam selectors `OR` cobrindo o testid novo + o seletor antigo (ex.: `'[data-testid="bottom-nav-more"], [data-bottom-nav] button[aria-label="Mais opções"]'`). Isso permite migração gradual sem quebrar baseline.
