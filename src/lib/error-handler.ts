
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

const DEFAULT_ERROR_MESSAGES: Record<ErrorCategory, string> = {
  NETWORK: "Erro de conexão. Verifique sua internet.",
  AUTH: "Sessão expirada ou acesso negado.",
  DATABASE: "Falha ao processar dados. Tente novamente em instantes.",
  VALIDATION: "Verifique as informações fornecidas.",
  NOT_FOUND: "Recurso não encontrado.",
  UNKNOWN: "Ocorreu um erro inesperado.",
};

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message.trim() || undefined;
  }

  if (typeof error === "string") {
    const message = error.trim();
    return message && message !== "[object Object]" ? message : undefined;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; error_description?: unknown };
    for (const value of [candidate.message, candidate.error_description]) {
      if (typeof value === "string" && value.trim() && value.trim() !== "[object Object]") {
        return value.trim();
      }
    }
  }

  return undefined;
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
  const category = error instanceof AppError ? error.category : options.category ?? "UNKNOWN";
  const appError = error instanceof AppError
    ? error
    : new AppError(getErrorMessage(error) ?? DEFAULT_ERROR_MESSAGES[category], {
        originalError: error instanceof Error ? error : undefined,
        category,
      });

  const mergedContext = { ...appError.context, ...options.context };
  const userMessage = appError.message.trim() || DEFAULT_ERROR_MESSAGES[appError.category];

  // Logging persistente e estruturado para debug
  console.error(
    `[${appError.category}] ${userMessage}`,
    {
      timestamp: appError.timestamp,
      context: mergedContext,
      stack: appError.stack
    }
  );

  captureSentry(error instanceof Error ? error : appError, mergedContext);

  // Feedback visual ao usuário (se não for silencioso)
  if (!options.silent && !appError.context.silent) {
    // A categoria técnica permanece no console/Sentry; não deve aparecer no toast.
    toast.error(userMessage);
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
