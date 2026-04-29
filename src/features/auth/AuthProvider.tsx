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
import { handleError } from "@/lib/error-handler";

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
    let resolved = false;

    // 1) listener primeiro — qualquer evento de auth também marca loading=false
    //    para evitar que a app fique presa em FullScreenLoader caso o evento
    //    chegue antes do getSession() (ex.: refresh de token, magic link).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    });

    // 2) sessão atual depois
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 400 && error.message.includes("Invalid login credentials")) {
        // Silencioso aqui pois o componente Login já trata e mostra toast
        handleError(error, { category: 'AUTH', silent: true });
      } else {
        handleError(error, { category: 'AUTH' });
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
