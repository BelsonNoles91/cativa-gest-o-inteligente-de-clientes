
import { toast } from "sonner";

/**
 * Categorias de erro para classificação e métricas.
 */
export type ErrorCategory = 'NETWORK' | 'AUTH' | 'DATABASE' | 'VALIDATION' | 'UNKNOWN' | 'NOT_FOUND';

export interface AppErrorOptions {
  category?: ErrorCategory;
  originalError?: unknown;
  context?: Record<string, unknown>;
  silent?: boolean;
}

/**
 * Erro customizado da aplicação para padronização de tratamento.
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly context: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.category = options.category || 'UNKNOWN';
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();

    // Preserva o stack trace do erro original se disponível
    if (options.originalError instanceof Error) {
      this.stack = options.originalError.stack;
    }
  }
}

let sentryInitPromise: Promise<void> | null = null;

async function ensureSentry(): Promise<typeof import("@sentry/react") | null> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return null;

  if (!sentryInitPromise) {
    sentryInitPromise = import("@sentry/react").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        enabled: !import.meta.env.DEV,
      });
    });
  }
  await sentryInitPromise;
  return import("@sentry/react");
}

function captureSentry(error: unknown, context?: Record<string, unknown>) {
  void ensureSentry().then((Sentry) => {
    if (!Sentry) return;
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: context });
    } else {
      Sentry.captureMessage(String(error), { extra: context });
    }
  });
}

/**
 * Manipulador centralizado de exceções.
 * Realiza logging, telemetria (Sentry quando configurado) e feedback ao usuário.
 */
export const handleError = (error: unknown, options: AppErrorOptions = {}) => {
  const isDevelopment = import.meta.env.DEV;
  
  // Normalização do erro
  let appError: AppError;
  
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    appError = new AppError(error.message, { 
      originalError: error, 
      category: options.category 
    });
  } else {
    appError = new AppError(String(error), { category: options.category });
  }

  const mergedContext = { ...appError.context, ...options.context };

  // Logging persistente e estruturado para debug
  console.error(
    `[${appError.category}] ${appError.message}`,
    {
      timestamp: appError.timestamp,
      context: mergedContext,
      stack: appError.stack
    }
  );

  captureSentry(error instanceof Error ? error : appError, mergedContext);

  // Feedback visual ao usuário (se não for silencioso)
  if (!options.silent && !appError.context.silent) {
    const defaultMessages: Record<ErrorCategory, string> = {
      NETWORK: "Erro de conexão. Verifique sua internet.",
      AUTH: "Sessão expirada ou acesso negado.",
      DATABASE: "Falha ao processar dados. Tente novamente em instantes.",
      VALIDATION: "Verifique as informações fornecidas.",
      NOT_FOUND: "Recurso não encontrado.",
      UNKNOWN: "Ocorreu um erro inesperado."
    };

    toast.error(appError.message || defaultMessages[appError.category], {
      description: isDevelopment ? `[${appError.category}]` : undefined,
    });
  }

  return appError;
};

/**
 * Wrapper para operações assíncronas com retry strategy e tratamento de erro.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delay?: number; category?: ErrorCategory } = {}
): Promise<T> {
  const { retries = 2, delay = 1000, category = 'NETWORK' } = options;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Não tenta novamente se for erro de validação ou auth (não vai mudar com retry)
      const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
      if (category === 'AUTH' || category === 'VALIDATION' || status === 401) {
        throw handleError(error, { category });
      }

      if (attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw handleError(lastError, { 
    category, 
    context: { attempts: retries + 1 } 
  });
}
