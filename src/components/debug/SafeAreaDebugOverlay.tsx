/**
 * SafeAreaDebugOverlay — overlay flutuante para inspecionar safe-area insets
 * em dispositivos reais (iPhone com notch, Android com gesture bar, etc).
 *
 * Mostra em tempo real:
 *  - Valores brutos de `env(safe-area-inset-*)` (top, right, bottom, left)
 *  - Padding computado em pixels nas regiões críticas:
 *      • <body>
 *      • elemento `[data-app-main]` (main do AppLayout)
 *      • elemento `[data-bottom-nav]` (bottom nav mobile)
 *  - Viewport: window.innerWidth × window.innerHeight, devicePixelRatio,
 *    visualViewport (quando teclado abre no iOS), orientação.
 *  - User agent resumido (iOS / Android / outros).
 *
 * Habilitação:
 *  - Em DEV (`import.meta.env.DEV`) sempre disponível.
 *  - Em produção/preview: ative via
 *      `localStorage.setItem("cativa.debug.safearea", "1")`
 *    e recarregue a página.
 *  - Atalho: Ctrl/Cmd + Shift + S abre/fecha (não conflita com Ctrl+S do navegador
 *    porque exige Shift).
 *
 * Também loga no console (`console.info("[safe-area]", snapshot)`) na primeira
 * abertura e a cada mudança de orientação/resize, para inspeção via Safari
 * Remote Debug ou chrome://inspect.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ruler, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LS_ENABLED = "cativa.debug.safearea";
const LS_VISIBLE = "cativa.debug.safearea.visible";

function isAutomatedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.webdriver;
}

function isEnabled(): boolean {
  if (isAutomatedBrowser()) return false;
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(LS_ENABLED) === "1";
  } catch {
    return false;
  }
}

type Insets = { top: number; right: number; bottom: number; left: number };

type Snapshot = {
  envInsets: Insets;
  bodyPadding: Insets;
  mainPadding: Insets | null;
  bottomNavPadding: Insets | null;
  bottomNavHeight: number | null;
  viewport: {
    innerWidth: number;
    innerHeight: number;
    visualWidth: number | null;
    visualHeight: number | null;
    dpr: number;
    orientation: string;
  };
  ua: { platform: string; raw: string };
};

function readEnvInsets(): Insets {
  // Cria um probe invisível com padding = env(safe-area-inset-*) e mede.
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:0",
    "height:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top, 0px)",
    "padding-right:env(safe-area-inset-right, 0px)",
    "padding-bottom:env(safe-area-inset-bottom, 0px)",
    "padding-left:env(safe-area-inset-left, 0px)",
  ].join(";");
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out: Insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  document.body.removeChild(probe);
  return out;
}

function readPadding(el: Element | null): Insets | null {
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

function detectPlatform(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "unknown";
}

function captureSnapshot(): Snapshot {
  const envInsets = readEnvInsets();
  const bodyPadding = readPadding(document.body) ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const mainEl = document.querySelector("[data-app-main]");
  const bottomNavEl = document.querySelector("[data-bottom-nav]");
  const ua = navigator.userAgent;
  const orientation =
    typeof screen !== "undefined" && "orientation" in screen
      ? (screen as { orientation?: { type?: string } }).orientation?.type ?? "unknown"
      : window.matchMedia("(orientation: landscape)").matches
        ? "landscape"
        : "portrait";

  return {
    envInsets,
    bodyPadding,
    mainPadding: readPadding(mainEl),
    bottomNavPadding: readPadding(bottomNavEl),
    bottomNavHeight: bottomNavEl
      ? Math.round((bottomNavEl as HTMLElement).getBoundingClientRect().height)
      : null,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualWidth: window.visualViewport?.width ?? null,
      visualHeight: window.visualViewport?.height ?? null,
      dpr: window.devicePixelRatio || 1,
      orientation,
    },
    ua: { platform: detectPlatform(ua), raw: ua },
  };
}

export function SafeAreaDebugOverlay() {
  const enabled = isEnabled();
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(LS_VISIBLE);
      if (stored !== null) return stored === "1";
      // default: fechado em mobile, aberto em desktop dev
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
      ) {
        return false;
      }
      return false; // mais discreto: começa fechado também em desktop
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const loggedOnceRef = useRef(false);

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    const snap = captureSnapshot();
    setSnapshot(snap);
    if (!loggedOnceRef.current) {

      console.info("[safe-area]", snap);
      loggedOnceRef.current = true;
    }
  }, []);

  // Captura inicial + listeners
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const onResize = () => {
      refresh();

      console.info("[safe-area] resize/orientation", captureSnapshot());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [enabled, refresh]);

  // Atalho Ctrl/Cmd + Shift + S
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          try {
            localStorage.setItem(LS_VISIBLE, next ? "1" : "0");
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);

  const insetEdges = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.envInsets;
  }, [snapshot]);

  if (!enabled) return null;

  return (
    <>
      {/* Bordas coloridas overlay para visualizar a safe-area */}
      {open && insetEdges && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[9998]"
          style={{
            // Top
            boxShadow: [
              `inset 0 ${insetEdges.top}px 0 0 hsl(var(--destructive) / 0.18)`,
              `inset 0 -${insetEdges.bottom}px 0 0 hsl(var(--accent) / 0.18)`,
              `inset ${insetEdges.left}px 0 0 0 hsl(var(--warning) / 0.18)`,
              `inset -${insetEdges.right}px 0 0 0 hsl(var(--warning) / 0.18)`,
            ].join(", "),
          }}
        />
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            try {
              localStorage.setItem(LS_VISIBLE, "1");
            } catch {
              /* ignore */
            }
          }}
          className="fixed bottom-20 left-3 z-[9999] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:scale-105 md:bottom-4 md:left-4 md:h-10 md:w-10"
          aria-label="Abrir overlay de safe-area"
        >
          <Ruler className="h-4 w-4" />
        </button>
      ) : (
        <div
          className={cn(
            "fixed bottom-20 left-3 z-[9999] w-[300px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-background/95 text-foreground shadow-2xl backdrop-blur md:bottom-4 md:left-4 md:w-[340px]",
            "font-mono text-xs",
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-primary" />
              <span className="font-sans text-xs font-semibold tracking-wide">
                Safe-Area
              </span>
              <Badge variant="outline" className="font-sans text-[10px] uppercase">
                {snapshot?.ua.platform ?? "—"}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={refresh}
                title="Recarregar snapshot"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setCollapsed((c) => !c)}
                title={collapsed ? "Expandir" : "Recolher"}
              >
                {collapsed ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  setOpen(false);
                  try {
                    localStorage.setItem(LS_VISIBLE, "0");
                  } catch {
                    /* ignore */
                  }
                }}
                title="Fechar (Ctrl/Cmd+Shift+S)"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </header>

          {!collapsed && snapshot && (
            <div className="max-h-[60vh] space-y-3 overflow-auto p-3">
              <Section title="env(safe-area-inset-*)" legend>
                <Row label="top" value={`${snapshot.envInsets.top}px`} swatch="destructive" />
                <Row label="right" value={`${snapshot.envInsets.right}px`} swatch="warning" />
                <Row label="bottom" value={`${snapshot.envInsets.bottom}px`} swatch="accent" />
                <Row label="left" value={`${snapshot.envInsets.left}px`} swatch="warning" />
              </Section>

              <Section title="<body> padding (computed)">
                <Row label="top" value={`${snapshot.bodyPadding.top}px`} />
                <Row label="bottom" value={`${snapshot.bodyPadding.bottom}px`} />
                <Row label="left" value={`${snapshot.bodyPadding.left}px`} />
                <Row label="right" value={`${snapshot.bodyPadding.right}px`} />
              </Section>

              <Section title="[data-app-main] padding">
                {snapshot.mainPadding ? (
                  <>
                    <Row label="top" value={`${snapshot.mainPadding.top}px`} />
                    <Row label="bottom" value={`${snapshot.mainPadding.bottom}px`} />
                    <Row label="left" value={`${snapshot.mainPadding.left}px`} />
                    <Row label="right" value={`${snapshot.mainPadding.right}px`} />
                  </>
                ) : (
                  <p className="text-muted-foreground">— elemento não encontrado</p>
                )}
              </Section>

              <Section title="[data-bottom-nav]">
                {snapshot.bottomNavPadding ? (
                  <>
                    <Row
                      label="height"
                      value={`${snapshot.bottomNavHeight ?? "?"}px`}
                    />
                    <Row label="pb" value={`${snapshot.bottomNavPadding.bottom}px`} />
                    <Row label="pt" value={`${snapshot.bottomNavPadding.top}px`} />
                  </>
                ) : (
                  <p className="text-muted-foreground">— sem bottom-nav (desktop?)</p>
                )}
              </Section>

              <Section title="Viewport">
                <Row
                  label="window"
                  value={`${snapshot.viewport.innerWidth}×${snapshot.viewport.innerHeight}`}
                />
                {snapshot.viewport.visualWidth !== null && (
                  <Row
                    label="visual"
                    value={`${Math.round(snapshot.viewport.visualWidth)}×${Math.round(
                      snapshot.viewport.visualHeight ?? 0,
                    )}`}
                  />
                )}
                <Row label="dpr" value={String(snapshot.viewport.dpr)} />
                <Row label="orient." value={snapshot.viewport.orientation} />
              </Section>

              <Section title="UA">
                <p className="break-all text-[10px] text-muted-foreground">
                  {snapshot.ua.raw}
                </p>
              </Section>

              <p className="pt-1 text-[10px] text-muted-foreground">
                Ctrl/Cmd + Shift + S para abrir/fechar · bordas coloridas mostram
                top/right/bottom/left
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Section({
  title,
  legend = false,
  children,
}: {
  title: string;
  legend?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-border/60 bg-card/40 p-2">
      <header className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {legend && (
          <div className="flex items-center gap-1.5 text-[9px]">
            <LegendDot color="destructive" label="T" />
            <LegendDot color="warning" label="L/R" />
            <LegendDot color="accent" label="B" />
          </div>
        )}
      </header>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: "destructive" | "warning" | "accent";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {swatch && <LegendDot color={swatch} />}
        {label}
      </span>
      <span className="text-right font-mono text-[11px]">{value}</span>
    </div>
  );
}

function LegendDot({
  color,
  label,
}: {
  color: "destructive" | "warning" | "accent";
  label?: string;
}) {
  const bg =
    color === "destructive"
      ? "bg-destructive/70"
      : color === "warning"
        ? "bg-warning/70"
        : "bg-accent/70";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-2 w-2 rounded-sm", bg)} />
      {label && <span className="font-sans text-muted-foreground">{label}</span>}
    </span>
  );
}
