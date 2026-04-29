import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { handleError } from "@/lib/error-handler";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Boundary global/local para capturar erros de renderização.
 * Evita que o erro em um widget derrube a aplicação inteira.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    handleError(error, { 
      category: 'UNKNOWN', 
      context: { componentStack: errorInfo.componentStack, boundaryName: this.props.name || "Global" },
      silent: true // Evita toast duplo (ErrorBoundary já renderiza fallback visual)
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-danger/30 bg-danger-soft/10 p-6 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-danger/10 text-danger">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold">Algo deu errado</h3>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Ocorreu um erro ao carregar este componente.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5 rounded-lg border-danger/20 hover:bg-danger-soft/20"
            onClick={this.handleReset}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Tentar novamente
          </Button>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-4 max-w-full overflow-auto rounded bg-muted p-2 text-[10px] text-danger">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
