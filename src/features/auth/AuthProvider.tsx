/**
 * AuthProvider — sessão Supabase real.
 *
 * Padrão obrigatório:
 *   1) onAuthStateChange ANTES de getSession
 *   2) callbacks síncronos no listener (sem await direto)
 *   3) deferir chamadas extras com setTimeout(0)
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    options?: {
      emailRedirectTo?: string;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<{ error: Error | null; requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) listener primeiro
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    // 2) sessão atual depois
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[Auth:signIn]", error);
      // Erro 400 em auth geralmente é credencial inválida ou e-mail não confirmado
      if (error.status === 400 && error.message.includes("Invalid login credentials")) {
        // Silencioso aqui pois o componente Login já trata e mostra toast
      } else {
        // Outros erros (rede, timeout) reportamos para facilitar debug
        toast.error("Erro de conexão", {
          description: "Não conseguimos contato com o servidor de autenticação. Verifique sua rede."
        });
      }
    }
    return { error };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName, options) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: options?.emailRedirectTo ?? `${window.location.origin}/onboarding`,
        data: {
          full_name: fullName,
          ...(options?.metadata ?? {}),
        },
      },
    });
    return {
      error,
      requiresEmailConfirmation: !data.session,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword: AuthContextValue["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}
