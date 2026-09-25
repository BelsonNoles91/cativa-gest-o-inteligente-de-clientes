import { act, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  callback: null as ((event: string, session: Session | null) => void) | null,
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
}));

const handleErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        authMock.callback = callback;
        return { data: { subscription: { unsubscribe: authMock.unsubscribe } } };
      }),
      getSession: authMock.getSession,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("@/lib/error-handler", () => ({
  handleError: handleErrorMock,
}));

import { AuthProvider, useAuth } from "./AuthProvider";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function session(id: string): Session {
  return {
    access_token: `access-${id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 9_999_999_999,
    refresh_token: `refresh-${id}`,
    user: {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: `${id}@example.com`,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function Probe() {
  const { loading, user, session: currentSession } = useAuth();
  return (
    <div
      data-testid="auth-state"
      data-loading={String(loading)}
      data-user-id={user?.id ?? "none"}
      data-session-user-id={currentSession?.user.id ?? "none"}
    />
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    authMock.callback = null;
    authMock.getSession.mockReset();
    authMock.unsubscribe.mockReset();
    handleErrorMock.mockReset();
  });

  it("encerra o loading quando getSession rejeita", async () => {
    authMock.getSession.mockRejectedValueOnce(new Error("session unavailable"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveAttribute("data-loading", "false");
    });
    expect(screen.getByTestId("auth-state")).toHaveAttribute("data-user-id", "none");
    expect(handleErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ category: "AUTH", silent: true }),
    );
  });

  it("não deixa getSession atrasado sobrescrever evento de auth mais novo", async () => {
    const pending = deferred<{ data: { session: Session | null } }>();
    authMock.getSession.mockReturnValueOnce(pending.promise);
    const newerSession = session("newer-user");
    const staleSession = session("stale-user");

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      authMock.callback?.("SIGNED_IN", newerSession);
    });
    expect(screen.getByTestId("auth-state")).toHaveAttribute("data-user-id", "newer-user");

    await act(async () => {
      pending.resolve({ data: { session: staleSession } });
      await pending.promise;
    });

    expect(screen.getByTestId("auth-state")).toHaveAttribute("data-user-id", "newer-user");
    expect(screen.getByTestId("auth-state")).toHaveAttribute(
      "data-session-user-id",
      "newer-user",
    );
  });

  it("remove usuário e sessão quando recebe SIGNED_OUT", async () => {
    const initialSession = session("active-user");
    authMock.getSession.mockResolvedValueOnce({ data: { session: initialSession } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveAttribute("data-user-id", "active-user");
    });

    await act(async () => {
      authMock.callback?.("SIGNED_OUT", null);
    });

    expect(screen.getByTestId("auth-state")).toHaveAttribute("data-user-id", "none");
    expect(screen.getByTestId("auth-state")).toHaveAttribute("data-session-user-id", "none");
  });
});
